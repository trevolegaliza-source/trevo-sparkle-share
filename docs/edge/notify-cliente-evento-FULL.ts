// =============================================
// Edge Function: notify-cliente-evento
// =============================================
// Envia email pro cliente em eventos chave do ciclo (doc 06 #5):
//   - deferimento: processo deferiu (data_deferimento mudou)
//   - cobranca_gerada: cobrança Asaas gerada
//   - pagamento: pagamento confirmado
//
// Chamada por triggers Postgres via pg_net quando os eventos acontecem.
// Fail-soft: sem RESEND_API_KEY retorna 503 silencioso, não quebra a transação
// que disparou o trigger.
//
// Idempotência: cada evento marca campo timestamp no row de origem (ex.:
// cobrancas.notif_pagamento_enviado_em). Trigger só dispara 1×.
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

// AUDIT-003 (29/05/2026): token interno pra autenticar chamadas server-to-server
// (trigger Postgres via pg_net). Comparação timing-safe.
const INTERNAL_TRIGGER_TOKEN = Deno.env.get("INTERNAL_TRIGGER_TOKEN") ?? "";

const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// AUDIT-003 (29/05/2026): comparação resistente a timing attacks
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
  const d = new Date(iso.length === 10 ? iso + "T00:00:00" : iso);
  return d.toLocaleDateString("pt-BR");
};

type EventoTipo = "deferimento" | "cobranca_gerada" | "pagamento";

interface PayloadIn {
  tipo: EventoTipo;
  cliente_id: string;
  processo_id?: string;
  cobranca_id?: string;
}

function shellHtml(corpoInner: string, subject: string): string {
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>${subject}</title></head>
<body style="margin:0;padding:0;font-family:'Plus Jakarta Sans','Inter',-apple-system,BlinkMacSystemFont,sans-serif;background:#f8fafc;color:#0f172a;">
  <div style="max-width:560px;margin:32px auto;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e2e8f0;">
    <div style="height:4px;background:#16a34a;"></div>
    <div style="padding:28px 32px 20px;border-bottom:1px solid #f1f5f9;">
      <div style="font-size:22px;font-weight:800;letter-spacing:-0.02em;color:#0f172a;">
        <span style="color:#16a34a;">Trevo</span><span style="font-weight:500;"> Legaliza</span>
      </div>
    </div>
    ${corpoInner}
    <div style="padding:16px 32px;border-top:1px solid #f1f5f9;background:#f8fafc;display:flex;justify-content:space-between;font-size:10px;color:#94a3b8;font-weight:500;">
      <span>Trevo Legaliza · CNPJ 39.969.412/0001-70</span>
      <span>(11) 93492-7001 · trevolegaliza.com.br</span>
    </div>
  </div>
</body></html>`;
}

function templateDeferimento(cliente: any, processo: any): { subject: string; html: string } {
  const nome = cliente.apelido || cliente.nome;
  const razao = processo.razao_social || "sua empresa";
  const dataDef = processo.data_deferimento ? fmtDate(processo.data_deferimento) : "hoje";
  const subject = `🎉 Processo deferido — ${razao}`;
  const corpoInner = `
    <div style="padding:28px 32px;">
      <p style="font-size:15px;line-height:1.6;color:#334155;margin:0 0 16px;">
        Boas notícias, <strong>${nome}</strong>! 🍀
      </p>
      <p style="font-size:14px;line-height:1.6;color:#475569;margin:0 0 20px;">
        O processo <strong>${razao}</strong> foi <strong style="color:#15803d;">deferido</strong>
        em <strong>${dataDef}</strong>.
      </p>
      <div style="background:linear-gradient(135deg,#f0fdf4 0%,#ffffff 100%);border:1px solid #bbf7d0;border-radius:12px;padding:20px 24px;margin:24px 0;position:relative;overflow:hidden;">
        <div style="position:absolute;left:0;top:0;bottom:0;width:4px;background:#16a34a;"></div>
        <div style="font-size:10px;color:#15803d;text-transform:uppercase;letter-spacing:0.12em;font-weight:700;">Status</div>
        <div style="font-size:18px;font-weight:800;color:#15803d;letter-spacing:-0.02em;margin-top:6px;">
          ✓ Deferido
        </div>
      </div>
      <p style="font-size:13px;line-height:1.6;color:#64748b;margin:20px 0 0;">
        Em breve nossa equipe entrará em contato com os próximos passos.
        Qualquer dúvida: <a href="mailto:contato@trevolegaliza.com.br" style="color:#16a34a;text-decoration:none;font-weight:600;">contato@trevolegaliza.com.br</a>
      </p>
    </div>`;
  return { subject, html: shellHtml(corpoInner, subject) };
}

function templateCobrancaGerada(cliente: any, cobranca: any): { subject: string; html: string } {
  const nome = cliente.apelido || cliente.nome;
  const subject = `Sua cobrança Trevo Legaliza — ${fmt(cobranca.total_geral)}`;
  const linkCobranca = `https://app.trevolegaliza.com/cobranca/${cobranca.share_token}`;
  const corpoInner = `
    <div style="padding:28px 32px;">
      <p style="font-size:15px;line-height:1.6;color:#334155;margin:0 0 16px;">
        Olá, <strong>${nome}</strong>!
      </p>
      <p style="font-size:14px;line-height:1.6;color:#475569;margin:0 0 20px;">
        Sua cobrança está pronta. Você pode pagar via PIX ou boleto.
      </p>
      <div style="background:linear-gradient(135deg,#f0fdf4 0%,#ffffff 100%);border:1px solid #bbf7d0;border-radius:12px;padding:20px 24px;margin:24px 0;position:relative;overflow:hidden;">
        <div style="position:absolute;left:0;top:0;bottom:0;width:4px;background:#16a34a;"></div>
        <div style="font-size:10px;color:#15803d;text-transform:uppercase;letter-spacing:0.12em;font-weight:700;">Valor a pagar</div>
        <div style="font-size:32px;font-weight:800;color:#15803d;letter-spacing:-0.03em;margin-top:8px;line-height:1;font-variant-numeric:tabular-nums;">
          ${fmt(cobranca.total_geral)}
        </div>
        ${cobranca.data_vencimento ? `<div style="font-size:11px;color:#64748b;margin-top:8px;font-weight:500;">Vencimento: ${fmtDate(cobranca.data_vencimento)}</div>` : ""}
      </div>
      <a href="${linkCobranca}" style="display:inline-block;background:#16a34a;color:#ffffff;text-decoration:none;font-weight:700;font-size:14px;padding:14px 28px;border-radius:10px;margin:8px 0 16px;letter-spacing:-0.01em;">
        Acessar cobrança
      </a>
      <p style="font-size:12px;line-height:1.6;color:#94a3b8;margin:16px 0 0;">
        Ou copie o link: <a href="${linkCobranca}" style="color:#16a34a;text-decoration:none;">${linkCobranca}</a>
      </p>
    </div>`;
  return { subject, html: shellHtml(corpoInner, subject) };
}

function templatePagamento(cliente: any, cobranca: any): { subject: string; html: string } {
  const nome = cliente.apelido || cliente.nome;
  const subject = `✅ Pagamento confirmado — ${fmt(cobranca.total_geral)}`;
  const corpoInner = `
    <div style="padding:28px 32px;">
      <p style="font-size:15px;line-height:1.6;color:#334155;margin:0 0 16px;">
        Obrigado, <strong>${nome}</strong>! 🙌
      </p>
      <p style="font-size:14px;line-height:1.6;color:#475569;margin:0 0 20px;">
        Recebemos seu pagamento de <strong>${fmt(cobranca.total_geral)}</strong>.
        Nossa equipe já iniciou os trâmites do processo.
      </p>
      <div style="background:linear-gradient(135deg,#f0fdf4 0%,#ffffff 100%);border:1px solid #bbf7d0;border-radius:12px;padding:20px 24px;margin:24px 0;position:relative;overflow:hidden;">
        <div style="position:absolute;left:0;top:0;bottom:0;width:4px;background:#16a34a;"></div>
        <div style="font-size:10px;color:#15803d;text-transform:uppercase;letter-spacing:0.12em;font-weight:700;">Pagamento confirmado</div>
        <div style="font-size:24px;font-weight:800;color:#15803d;letter-spacing:-0.03em;margin-top:8px;line-height:1;font-variant-numeric:tabular-nums;">
          ${fmt(cobranca.total_geral)}
        </div>
        <div style="font-size:11px;color:#64748b;margin-top:8px;font-weight:500;">
          Recebido em ${cobranca.asaas_pago_em ? fmtDate(cobranca.asaas_pago_em) : "hoje"}
        </div>
      </div>
      <p style="font-size:13px;line-height:1.6;color:#64748b;margin:20px 0 0;">
        Você receberá atualizações por aqui conforme o processo avançar.
        Qualquer dúvida: <a href="mailto:contato@trevolegaliza.com.br" style="color:#16a34a;text-decoration:none;font-weight:600;">contato@trevolegaliza.com.br</a>
      </p>
    </div>`;
  return { subject, html: shellHtml(corpoInner, subject) };
}

async function enviarEmail(to: string, subject: string, html: string): Promise<{ ok: boolean; data?: any; error?: string }> {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Authorization": `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: EMAIL_FROM, to: [to], subject, html }),
  });
  if (!res.ok) {
    const errText = await res.text();
    return { ok: false, error: `Resend ${res.status}: ${errText.slice(0, 200)}` };
  }
  return { ok: true, data: await res.json() };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // AUDIT-003 (29/05/2026): adicionada auth — exige x-internal-token bem
  // formado. FAIL-CLOSED: sem INTERNAL_TRIGGER_TOKEN nos secrets, rejeita
  // tudo (impede vazamento aberto por falta de config).
  if (!INTERNAL_TRIGGER_TOKEN) {
    console.error("[notify-cliente-evento] CRITICAL: INTERNAL_TRIGGER_TOKEN não configurado; rejeitando");
    return new Response(JSON.stringify({ error: "INTERNAL_AUTH_NOT_CONFIGURED" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const providedToken = req.headers.get("x-internal-token") ?? "";
  if (!providedToken || !timingSafeEqual(providedToken, INTERNAL_TRIGGER_TOKEN)) {
    console.warn("[notify-cliente-evento] token inválido ou ausente — rejeitado");
    return new Response(JSON.stringify({ error: "UNAUTHORIZED" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Fail-soft sem Resend
  if (!RESEND_API_KEY) {
    return new Response(JSON.stringify({
      ok: false, skipped: true,
      reason: "RESEND_API_KEY não configurado nos secrets",
    }), {
      status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let body: PayloadIn;
  try { body = await req.json(); } catch {
    return new Response(JSON.stringify({ error: "JSON inválido" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { tipo, cliente_id, processo_id, cobranca_id } = body;
  if (!tipo || !cliente_id) {
    return new Response(JSON.stringify({ error: "tipo e cliente_id obrigatórios" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    // Cliente
    const { data: cliente, error: clErr } = await admin
      .from("clientes")
      .select("id, nome, apelido, email")
      .eq("id", cliente_id)
      .single();
    if (clErr || !cliente) {
      return new Response(JSON.stringify({ error: "Cliente não encontrado" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!cliente.email) {
      return new Response(JSON.stringify({ ok: false, skipped: true, reason: "Cliente sem email" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let template: { subject: string; html: string } | null = null;
    let idempotencyTable: string | null = null;
    let idempotencyId: string | null = null;
    let idempotencyField: string | null = null;

    if (tipo === "deferimento") {
      if (!processo_id) return new Response(JSON.stringify({ error: "processo_id obrigatório" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const { data: processo } = await admin
        .from("processos")
        .select("id, razao_social, data_deferimento, notif_deferimento_enviado_em")
        .eq("id", processo_id).single();
      if (!processo) return new Response(JSON.stringify({ error: "Processo não encontrado" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if ((processo as any).notif_deferimento_enviado_em) {
        return new Response(JSON.stringify({ ok: true, reused: true, sent_at: (processo as any).notif_deferimento_enviado_em }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      template = templateDeferimento(cliente, processo);
      idempotencyTable = "processos"; idempotencyId = processo_id; idempotencyField = "notif_deferimento_enviado_em";
    } else if (tipo === "cobranca_gerada") {
      if (!cobranca_id) return new Response(JSON.stringify({ error: "cobranca_id obrigatório" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const { data: cobranca } = await admin
        .from("cobrancas")
        .select("id, total_geral, data_vencimento, share_token, notif_geracao_enviado_em")
        .eq("id", cobranca_id).single();
      if (!cobranca) return new Response(JSON.stringify({ error: "Cobrança não encontrada" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if ((cobranca as any).notif_geracao_enviado_em) {
        return new Response(JSON.stringify({ ok: true, reused: true, sent_at: (cobranca as any).notif_geracao_enviado_em }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      template = templateCobrancaGerada(cliente, cobranca);
      idempotencyTable = "cobrancas"; idempotencyId = cobranca_id; idempotencyField = "notif_geracao_enviado_em";
    } else if (tipo === "pagamento") {
      if (!cobranca_id) return new Response(JSON.stringify({ error: "cobranca_id obrigatório" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const { data: cobranca } = await admin
        .from("cobrancas")
        .select("id, total_geral, asaas_pago_em, notif_pagamento_enviado_em")
        .eq("id", cobranca_id).single();
      if (!cobranca) return new Response(JSON.stringify({ error: "Cobrança não encontrada" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if ((cobranca as any).notif_pagamento_enviado_em) {
        return new Response(JSON.stringify({ ok: true, reused: true, sent_at: (cobranca as any).notif_pagamento_enviado_em }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      template = templatePagamento(cliente, cobranca);
      idempotencyTable = "cobrancas"; idempotencyId = cobranca_id; idempotencyField = "notif_pagamento_enviado_em";
    } else {
      return new Response(JSON.stringify({ error: `Tipo desconhecido: ${tipo}` }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const send = await enviarEmail(cliente.email, template!.subject, template!.html);
    if (!send.ok) {
      // FIN-007 (17/05/2026): se Resend cai por horas, master não sabia.
      // Cria notificação in-app pro master da empresa avisando do problema.
      // Throttle: só 1 alerta por empresa por 24h (evita flood se Resend cair
      // completo). Falha do alerta NÃO derruba a edge — só loga.
      try {
        const { data: cli } = await admin
          .from("clientes")
          .select("empresa_id")
          .eq("id", cliente_id)
          .single();
        const empresaId = (cli as any)?.empresa_id;
        if (empresaId) {
          const { data: existing } = await admin
            .from("notificacoes")
            .select("id")
            .eq("empresa_id", empresaId)
            .eq("tipo", "email_falhou")
            .gte("created_at", new Date(Date.now() - 86400000).toISOString())
            .limit(1);
          if (!existing || existing.length === 0) {
            const { data: masterId } = await admin.rpc(
              "get_empresa_master_id",
              { p_empresa_id: empresaId },
            );
            if (masterId) {
              await admin.from("notificacoes").insert({
                empresa_id: empresaId,
                destinatario_id: masterId,
                tipo: "email_falhou",
                titulo: `Email pra cliente falhou (${tipo})`,
                mensagem: `Resend retornou erro ao enviar pra ${cliente.email}: ${send.error}. Verifica RESEND_API_KEY ou status.resend.com. Próximo alerta em 24h.`,
              });
            }
          }
        }
      } catch (alertErr) {
        console.error("[notify-cliente-evento] alerta in-app falhou:", alertErr);
      }
      return new Response(JSON.stringify({ ok: false, error: send.error }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Marca idempotencia
    if (idempotencyTable && idempotencyId && idempotencyField) {
      await admin.from(idempotencyTable as any).update({ [idempotencyField]: new Date().toISOString() }).eq("id", idempotencyId);
    }

    return new Response(JSON.stringify({
      ok: true, resend_id: send.data?.id, tipo, sent_to: cliente.email,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (err: any) {
    console.error("[notify-cliente-evento] error", err);
    return new Response(JSON.stringify({ error: String(err?.message ?? err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
