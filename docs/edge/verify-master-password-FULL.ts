// =============================================
// AUDIT-010 (29/05/2026): versionado do estado em produção
// versão capturada em 2026-05-29
// =============================================

// =============================================
// Edge Function: verify-master-password
// =============================================
// Valida senha master de operação sensível.
//
// Estratégia (audit fix #2 27/04/2026):
//  1. Tenta RPC verify_master_password_hash (bcrypt em pg via pgcrypto)
//  2. Se RPC retorna NULL (= hash não setado ainda no banco),
//     fallback pra MASTER_PASSWORD env var (modo legado/migração)
//  3. Comparação timing-safe em ambos os caminhos
//
// Rate limit (audit fix #11):
//  - 5 falhas/hora por user_id
//  - 10 falhas/hora por IP
//  Usa RPC register_master_password_attempt que registra + retorna allowed.
//  Antes: contava qualquer tentativa (mesmo sucesso) por user — atacante
//  rotacionava contas authenticated pra burlar. Agora bloqueia também
//  por IP (máquina comprometida não vira oráculo de brute force).
// =============================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildCorsHeaders, handlePreflight } from "../_shared/cors.ts";

// Comparação resistente a timing attacks (mesma forma que asaas-webhook)
function timingSafeEqual(a: string, b: string): boolean {
  const len = Math.max(a.length, b.length);
  let diff = a.length ^ b.length;
  for (let i = 0; i < len; i++) {
    diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  }
  return diff === 0;
}

Deno.serve(async (req) => {
  // audit fix #21 — CORS allowlist (substitui Allow-Origin: *)
  const preflight = handlePreflight(req);
  if (preflight) return preflight;
  const corsHeaders = buildCorsHeaders(req.headers.get("Origin"));

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ valid: false, error: "Not authenticated" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ valid: false, error: "Invalid session" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const { password } = await req.json();
    if (typeof password !== "string" || password.length === 0) {
      return new Response(
        JSON.stringify({ valid: false, error: "Senha ausente" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // audit fix #11 — extrai IP do request (Cloudflare/Supabase proxy
    // popula x-forwarded-for; pegamos primeiro IP da cadeia).
    const xff = req.headers.get("x-forwarded-for") ?? "";
    const callerIp = xff.split(",")[0]?.trim() || null;

    // === Validação ===
    // 1) Tenta RPC com hash bcrypt (audit fix #2)
    let valid = false;
    let usedFallback = false;

    try {
      const { data: hashResult, error: rpcErr } = await supabaseAdmin.rpc(
        "verify_master_password_hash",
        { p_password: password },
      );

      if (rpcErr) {
        // RPC não existe ainda? Migration não rodou? Loga e cai pra fallback.
        console.warn(
          "[verify-master-password] RPC verify_master_password_hash falhou:",
          rpcErr.message,
        );
        usedFallback = true;
      } else if (hashResult === null || hashResult === undefined) {
        // Hash não configurado ainda no banco — fallback pro env var
        usedFallback = true;
      } else {
        valid = hashResult === true;
      }
    } catch (e) {
      console.warn(
        "[verify-master-password] erro chamando RPC:",
        e instanceof Error ? e.message : String(e),
      );
      usedFallback = true;
    }

    // 2) Fallback pra MASTER_PASSWORD env (modo legado/migração)
    if (usedFallback) {
      const masterPassword = Deno.env.get("MASTER_PASSWORD") ?? "";
      if (!masterPassword) {
        // Nem hash no banco nem env — operação impossível
        console.error(
          "[verify-master-password] CRITICAL: nem hash no banco nem MASTER_PASSWORD env",
        );
        return new Response(
          JSON.stringify({
            valid: false,
            error: "Configuração de segurança ausente. Contate o administrador.",
          }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }
      valid = timingSafeEqual(password, masterPassword);
    }

    // audit fix #11 — registra tentativa (com resultado real) e checa
    // rate limit por user_id E por IP. Resposta 429 se excedeu;
    // valid=false sem revelar se a senha estava correta (preservando
    // ordem: ataque com senha correta também conta como falha pra
    // limite, mas só se rate limit barrar antes — improvável em uso real).
    const { data: rateData, error: rateErr } = await supabaseAdmin.rpc(
      "register_master_password_attempt",
      {
        p_user_id: user.id,
        p_ip: callerIp,
        p_success: valid,
      },
    );

    if (rateErr) {
      // RPC nova ainda não disponível (migration não rodou) — degradação
      // suave: não bloqueia, mas loga. Em produção esperamos sempre OK.
      console.warn(
        "[verify-master-password] RPC register_master_password_attempt indisponível:",
        rateErr.message,
      );
    } else if (Array.isArray(rateData) && rateData[0] && rateData[0].allowed === false) {
      const retry = rateData[0].retry_after_seconds ?? 3600;
      return new Response(
        JSON.stringify({
          valid: false,
          error: "Muitas tentativas. Aguarde antes de tentar novamente.",
          retry_after_seconds: retry,
        }),
        {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    return new Response(JSON.stringify({ valid }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (_error) {
    return new Response(JSON.stringify({ valid: false, error: "Server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
