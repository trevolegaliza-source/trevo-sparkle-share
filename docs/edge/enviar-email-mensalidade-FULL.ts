// =============================================
// Edge Function: enviar-email-mensalidade
// =============================================
// Envia email pro cliente avisando que mensalidade foi gerada e vence em N dias.
// Usado pelo fluxo recurring billing D-5 (doc 06 #3, decisão Thales 14/05/2026).
//
// Trigger: pode ser chamada manualmente pelo Thales ou via pg_cron secundário
// que varre lancamentos auto-gerados sem email enviado.
//
// Setup necessario (1×, depois rola sozinho):
//   1. Conta Resend (resend.com) — gratuito até 100/dia
//   2. Adicionar dominio trevolegaliza.com.br + validar DNS (SPF/DKIM)
//   3. Pegar API key (resend.com/api-keys)
//   4. supabase secrets set RESEND_API_KEY=re_xxxxxxxxxx
//
// Sem RESEND_API_KEY → função retorna 503 graciosamente, recurring billing
// segue funcionando (só notif in-app dispara).
// =============================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const EMAIL_FROM = Deno.env.get("EMAIL_FROM") ?? "Trevo Legaliza <financeiro@trevolegaliza.com.br>";

// AUDIT-002 (29/05/2026): token interno pra autenticar chamadas server-to-server
// (cron interno / Apps Script). Comparação timing-safe pra resistir a timing attacks.
const INTERNAL_TRIGGER_TOKEN = Deno.env.get("INTERNAL_TRIGGER_TOKEN") ?? "";

const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// AUDIT-002 (29/05/2026): comparação resistente a timing attacks
function timingSafeEqual(a: string, b: string): boolean {
  const len = Math.max(a.length, b.length);
  let diff = a.length ^ b.length;
  for (let i = 0; i < len; i++) {
    diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  }
  return diff === 0;
}

const fmt = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const fmtDate = (iso: string) => {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("pt-BR");
};

function buildEmailHtml(cliente: {
  nome: string;
  apelido: string | null;
}, lanc: {
  descricao: string;
  valor: number;
  data_vencimento: string;
}): string {
  const nome = cliente.apelido || cliente.nome;
  const venc = new Date(lanc.data_vencimento + "T00:00:00");
  const diasAteVenc = Math.ceil((venc.getTime() - Date.now()) / 86400000);
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Sua mensalidade ${lanc.descricao}</title>
</head>
<body style="margin:0;padding:0;font-family:'Plus Jakarta Sans','Inter',-apple-system,BlinkMacSystemFont,sans-serif;background:#f8fafc;color:#0f172a;">
  <div style="max-width:560px;margin:32px auto;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e2e8f0;">
    <!-- Accent strip -->
    <div style="height:4px;background:#16a34a;"></div>

    <!-- Header -->
    <div style="padding:28px 32px 20px;border-bottom:1px solid #f1f5f9;">
      <div style="font-size:22px;font-weight:800;letter-spacing:-0.02em;color:#0f172a;">
        <span style="color:#16a34a;">Trevo</span><span style="font-weight:500;"> Legaliza</span>
      </div>
      <div style="font-size:11px;color:#94a3b8;margin-top:4px;letter-spacing:0.05em;text-transform:uppercase;font-weight:600;">
        Sua mensalidade ${lanc.descricao}
      </div>
    </div>

    <!-- Body -->
    <div style="padding:28px 32px;">
      <p style="font-size:15px;line-height:1.6;color:#334155;margin:0 0 16px;">
        Olá, <strong>${nome}</strong>! 👋
      </p>
      <p style="font-size:14px;line-height:1.6;color:#475569;margin:0 0 24px;">
        Sua mensalidade referente a <strong>${lanc.descricao}</strong> foi gerada e vence
        em <strong>${fmtDate(lanc.data_vencimento)}</strong>${diasAteVenc > 0 ? ` (em ${diasAteVenc} dia${diasAteVenc !== 1 ? "s" : ""})` : ""}.
      </p>

      <!-- Valor card -->
      <div style="background:linear-gradient(135deg,#f0fdf4 0%,#ffffff 100%);border:1px solid #bbf7d0;border-radius:12px;padding:20px 24px;margin:24px 0;position:relative;overflow:hidden;">
        <div style="position:absolute;left:0;top:0;bottom:0;width:4px;background:#16a34a;"></div>
        <div style="font-size:10px;color:#15803d;text-transform:uppercase;letter-spacing:0.12em;font-weight:700;">
          Valor a pagar
        </div>
        <div style="font-size:32px;font-weight:800;color:#15803d;letter-spacing:-0.03em;margin-top:8px;line-height:1;font-variant-numeric:tabular-nums;">
          ${fmt(lanc.valor)}
        </div>
        <div style="font-size:11px;color:#64748b;margin-top:8px;font-weight:500;">
          Vencimento: ${fmtDate(lanc.data_vencimento)}
        </div>
      </div>

      <p style="font-size:13px;line-height:1.6;color:#64748b;margin:24px 0 0;">
        Em breve enviaremos o link de pagamento (PIX ou boleto). Se preferir adiantar
        ou tiver qualquer dúvida, fale com a gente:
        <a href="mailto:financeiro@trevolegaliza.com.br" style="color:#16a34a;text-decoration:none;font-weight:600;">financeiro@trevolegaliza.com.br</a>
      </p>
    </div>

    <!-- Footer -->
    <div style="padding:16px 32px;border-top:1px solid #f1f5f9;background:#f8fafc;display:flex;justify-content:space-between;font-size:10px;color:#94a3b8;font-weight:500;">
      <span>Trevo Legaliza · CNPJ 39.969.412/0001-70</span>
      <span>(11) 93492-7001 · trevolegaliza.com.br</span>
    </div>
  </div>
</body>
</html>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // AUDIT-002 (29/05/2026): adicionada auth — exige x-internal-token bem
  // formado. FAIL-CLOSED: sem INTERNAL_TRIGGER_TOKEN nos secrets, rejeita
  // tudo (impede que esquecimento de config vire vazamento aberto).
  if (!INTERNAL_TRIGGER_TOKEN) {
    console.error("[enviar-email-mensalidade] CRITICAL: INTERNAL_TRIGGER_TOKEN não configurado; rejeitando");
    return new Response(JSON.stringify({ error: "INTERNAL_AUTH_NOT_CONFIGURED" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const providedToken = req.headers.get("x-internal-token") ?? "";
  if (!providedToken || !timingSafeEqual(providedToken, INTERNAL_TRIGGER_TOKEN)) {
    console.warn("[enviar-email-mensalidade] token inválido ou ausente — rejeitado");
    return new Response(JSON.stringify({ error: "UNAUTHORIZED" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Fail-soft se Resend não configurado — não quebra recurring billing
  if (!RESEND_API_KEY) {
    return new Response(JSON.stringify({
      ok: false,
      skipped: true,
      reason: "RESEND_API_KEY não configurado nos secrets. Email não enviado.",
    }), {
      status: 503,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let body: any = {};
  try { body = await req.json(); } catch { /* empty */ }

  const lancamentoId: string | undefined = body.lancamento_id;
  if (!lancamentoId) {
    return new Response(JSON.stringify({ error: "lancamento_id obrigatório" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    // Busca lancamento + cliente
    const { data: lanc, error: lancErr } = await admin
      .from("lancamentos")
      .select("id, descricao, valor, data_vencimento, cliente_id, data_ultimo_contato")
      .eq("id", lancamentoId)
      .single();
    if (lancErr || !lanc) {
      return new Response(JSON.stringify({ error: "Lançamento não encontrado" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Já enviou? (idempotência)
    if (lanc.data_ultimo_contato) {
      return new Response(JSON.stringify({
        ok: true,
        reused: true,
        sent_at: lanc.data_ultimo_contato,
        message: "Email já enviado anteriormente",
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: cliente, error: clErr } = await admin
      .from("clientes")
      .select("id, nome, apelido, email")
      .eq("id", lanc.cliente_id)
      .single();
    if (clErr || !cliente) {
      return new Response(JSON.stringify({ error: "Cliente não encontrado" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!cliente.email) {
      return new Response(JSON.stringify({
        ok: false,
        reason: "Cliente sem email cadastrado",
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Envia via Resend
    const html = buildEmailHtml(cliente as any, lanc as any);
    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: EMAIL_FROM,
        to: [cliente.email],
        subject: `${lanc.descricao} — ${cliente.apelido || cliente.nome}`,
        html,
      }),
    });

    if (!resendRes.ok) {
      const errText = await resendRes.text();
      console.error("[enviar-email-mensalidade] Resend error", { status: resendRes.status, body: errText });
      return new Response(JSON.stringify({
        ok: false,
        error: `Resend ${resendRes.status}: ${errText.slice(0, 200)}`,
      }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const resendData = await resendRes.json();

    // Marca como enviado
    await admin
      .from("lancamentos")
      .update({
        data_ultimo_contato: new Date().toISOString(),
        notas_cobranca: (lanc as any).notas_cobranca
          ? `${(lanc as any).notas_cobranca} · Email D-5 enviado em ${new Date().toLocaleDateString("pt-BR")}`
          : `Email D-5 enviado em ${new Date().toLocaleDateString("pt-BR")} (Resend ID: ${resendData.id})`,
      })
      .eq("id", lancamentoId);

    return new Response(JSON.stringify({
      ok: true,
      resend_id: resendData.id,
      sent_to: cliente.email,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (err: any) {
    console.error("[enviar-email-mensalidade] error", err);
    return new Response(JSON.stringify({ error: String(err?.message ?? err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
