// =============================================
// Edge Function: asaas-cancelar-cobranca
// =============================================
// 27/05/2026 — Cancela uma cobrança Asaas via DELETE /payments/:id.
// Authenticado, valida role master/gerente/financeiro + empresa do usuário.
// Atualiza asaas_status='DELETED' e asaas_cancelada_em=NOW() na tabela
// cobrancas. Idempotente: se já foi cancelada, retorna OK sem chamar API.
//
// Cuidado: DELETE no Asaas só funciona em cobranças NÃO PAGAS. Se já tem
// pagamento confirmado, Asaas retorna 400 — mas o ERP deveria nem oferecer
// botão de cancelar nesse caso (UI filtra). Mesmo assim, mensagem clara
// no erro caso aconteça.
// =============================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { buildCorsHeaders, handlePreflight } from "../_shared/cors.ts";

const ASAAS_FETCH_TIMEOUT_MS = 15_000;

const ASAAS_API_KEY = Deno.env.get("ASAAS_API_KEY") ?? "";
const ASAAS_BASE_URL = Deno.env.get("ASAAS_BASE_URL") ?? "https://api.asaas.com/v3";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

type AsaasResponse = { ok: boolean; status: number; data: any };

async function asaasFetch(path: string, init: RequestInit = {}): Promise<AsaasResponse> {
  const baseUrl = ASAAS_BASE_URL.replace(/\/+$/, "");
  const fullUrl = `${baseUrl}${path}`;
  const ctrl = new AbortController();
  const timeoutId = setTimeout(() => ctrl.abort(), ASAAS_FETCH_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(fullUrl, {
      ...init,
      signal: ctrl.signal,
      headers: {
        access_token: ASAAS_API_KEY,
        "Content-Type": "application/json",
        "User-Agent": "trevo-legaliza-erp/1.0",
        ...(init.headers || {}),
      },
    });
  } catch (e) {
    const aborted = (e as any)?.name === "AbortError";
    throw new Error(
      aborted
        ? `Asaas timeout após ${ASAAS_FETCH_TIMEOUT_MS}ms (${fullUrl})`
        : `Falha de rede ao chamar Asaas (${fullUrl}): ${String(e)}`,
    );
  } finally {
    clearTimeout(timeoutId);
  }
  const text = await res.text();
  let data: any = {};
  try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }
  if (!res.ok) {
    console.error("[asaasFetch] error response", {
      url: fullUrl,
      method: init.method ?? "GET",
      status: res.status,
      body: text?.substring(0, 500),
    });
  }
  return { ok: res.ok, status: res.status, data };
}

Deno.serve(async (req) => {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;
  const corsHeaders = buildCorsHeaders(req.headers.get("Origin"));

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const authHeader = req.headers.get("Authorization") || "";
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Autenticação obrigatória" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user }, error: userError } = await userClient.auth.getUser();
  if (userError || !user) {
    return new Response(JSON.stringify({ error: "Sessão inválida" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { data: profile } = await admin
    .from("profiles")
    .select("role, empresa_id, ativo")
    .eq("id", user.id)
    .single();
  if (!profile || !profile.ativo) {
    return new Response(JSON.stringify({ error: "Usuário inativo" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  if (!["master", "gerente", "financeiro"].includes(profile.role)) {
    return new Response(JSON.stringify({ error: "Sem permissão para cancelar cobrança" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!ASAAS_API_KEY) {
    return new Response(JSON.stringify({ error: "ASAAS_API_KEY não configurado" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let body: any = {};
  try { body = await req.json(); } catch {}
  const cobrancaId = body.cobranca_id as string | undefined;

  if (!cobrancaId) {
    return new Response(JSON.stringify({ error: "cobranca_id obrigatório" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const { data: cobranca, error: cobErr } = await admin
      .from("cobrancas")
      .select("id, empresa_id, asaas_payment_id, asaas_status, asaas_pago_em, status")
      .eq("id", cobrancaId)
      .single();
    if (cobErr || !cobranca) {
      return new Response(JSON.stringify({ error: "Cobrança não encontrada" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if ((cobranca as any).empresa_id !== profile.empresa_id) {
      return new Response(JSON.stringify({ error: "Cobrança não pertence a esta empresa" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const c = cobranca as any;

    if (!c.asaas_payment_id) {
      return new Response(JSON.stringify({ error: "Cobrança não tem boleto/PIX Asaas associado" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (c.asaas_pago_em) {
      return new Response(JSON.stringify({
        error: "Cobrança já paga não pode ser cancelada. Considere estorno (refund) manual pelo painel Asaas.",
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Idempotência: já cancelada
    if (c.asaas_status === "DELETED" || c.asaas_status === "CANCELLED") {
      return new Response(JSON.stringify({ ok: true, already_cancelled: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // DELETE /v3/payments/{id}
    const del = await asaasFetch(`/payments/${c.asaas_payment_id}`, { method: "DELETE" });

    if (!del.ok) {
      // Caso especial: 404 = já foi removido no Asaas. Tratamos como sucesso.
      if (del.status === 404) {
        await admin.from("cobrancas").update({
          asaas_status: "DELETED",
          asaas_cancelada_em: new Date().toISOString(),
        }).eq("id", c.id);
        return new Response(JSON.stringify({ ok: true, already_deleted_at_asaas: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({
        error: `Asaas retornou ${del.status}: ${JSON.stringify(del.data?.errors ?? del.data ?? {})}`,
      }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Atualiza banco local
    await admin.from("cobrancas").update({
      asaas_status: "DELETED",
      asaas_cancelada_em: new Date().toISOString(),
    }).eq("id", c.id);

    return new Response(JSON.stringify({
      ok: true,
      asaas_payment_id: c.asaas_payment_id,
      deleted: del.data?.deleted ?? true,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (err: any) {
    console.error("asaas-cancelar-cobranca error:", err);
    return new Response(JSON.stringify({ error: String(err?.message ?? err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
