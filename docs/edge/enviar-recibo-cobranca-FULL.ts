// =============================================
// Edge Function: enviar-recibo-cobranca
// =============================================
// FIN-006 (27/05/2026): disparada por trigger AFTER UPDATE em cobrancas
// quando asaas_pago_em é populado pelo webhook. Marca recibo_enviado_em
// pra evitar reenvio. Notifica master e cliente final (via notif/recibo).
//
// MVP conservador: NÃO envia WhatsApp automático ainda (precisa de WhatsApp
// Cloud API integrado, risco de envio errado). Cria notif master com link
// pra Letícia enviar manualmente o recibo pelo botão Compartilhar do
// DetalhesCobrancaModal.
//
// Quando integração WhatsApp Cloud API tiver, basta extender essa edge.
// =============================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// AUDIT-005 (29/05/2026): token interno pra autenticar trigger pg_net.
const INTERNAL_TRIGGER_TOKEN = Deno.env.get("INTERNAL_TRIGGER_TOKEN") ?? "";

function fmtBRL(v: number | null | undefined): string {
  const n = Number(v ?? 0);
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

// AUDIT-005 (29/05/2026): comparação resistente a timing attacks
function timingSafeEqual(a: string, b: string): boolean {
  const len = Math.max(a.length, b.length);
  let diff = a.length ^ b.length;
  for (let i = 0; i < len; i++) {
    diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  }
  return diff === 0;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  // AUDIT-005 (29/05/2026): adicionada auth — token interno (trigger pg_net).
  // FAIL-CLOSED: sem INTERNAL_TRIGGER_TOKEN nos secrets, rejeita.
  if (!INTERNAL_TRIGGER_TOKEN) {
    console.error("[enviar-recibo-cobranca] CRITICAL: INTERNAL_TRIGGER_TOKEN não configurado; rejeitando");
    return new Response(JSON.stringify({ error: "INTERNAL_AUTH_NOT_CONFIGURED" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
  const providedToken = req.headers.get("x-internal-token") ?? "";
  if (!providedToken || !timingSafeEqual(providedToken, INTERNAL_TRIGGER_TOKEN)) {
    console.warn("[enviar-recibo-cobranca] token inválido ou ausente — rejeitado");
    return new Response(JSON.stringify({ error: "UNAUTHORIZED" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  let body: any = {};
  try { body = await req.json(); } catch {}
  const cobrancaId = body.cobranca_id as string | undefined;

  if (!cobrancaId) {
    return new Response(JSON.stringify({ error: "cobranca_id obrigatório" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const { data: cobranca, error: cobErr } = await admin
      .from("cobrancas")
      .select(
        "id, empresa_id, cliente_id, total_geral, asaas_pago_em, recibo_enviado_em, clientes(nome, apelido, telefone, telefone_financeiro)"
      )
      .eq("id", cobrancaId)
      .single();

    if (cobErr || !cobranca) {
      return new Response(JSON.stringify({ error: "Cobrança não encontrada" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    const c = cobranca as any;

    if (!c.asaas_pago_em) {
      return new Response(JSON.stringify({ error: "Cobrança ainda não foi paga" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (c.recibo_enviado_em) {
      return new Response(JSON.stringify({ ok: true, already_sent: true }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    const nomeCliente = c.clientes?.apelido || c.clientes?.nome || "Cliente";
    const valorFmt = fmtBRL(c.total_geral);

    // Notif master pra Letícia/Thales: cobrança paga, gerar recibo
    await admin.from("notificacoes").insert({
      empresa_id: c.empresa_id,
      tipo: "recibo_pendente",
      titulo: "📄 Gerar recibo · " + nomeCliente,
      mensagem:
        `${nomeCliente} pagou ${valorFmt}. Cobrança ${c.id}. ` +
        `Use "Ver cobrança" → "Compartilhar PDF" pra enviar o recibo agora. ` +
        `Quando WhatsApp Cloud API estiver integrado, recibo será enviado automaticamente.`,
    });

    // Marca como enviado pra evitar dispatch duplo (mesmo que o envio físico
    // seja manual via UI por enquanto — o objetivo da flag é não criar 2 notif)
    await admin
      .from("cobrancas")
      .update({ recibo_enviado_em: new Date().toISOString() })
      .eq("id", c.id);

    return new Response(
      JSON.stringify({ ok: true, notif_created: true, cobranca_id: c.id }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("enviar-recibo-cobranca error:", err);
    return new Response(JSON.stringify({ error: String(err?.message ?? err) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
