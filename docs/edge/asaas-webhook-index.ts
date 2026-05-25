// =============================================
// Edge Function: asaas-webhook
// =============================================
// Recebe webhooks do Asaas quando pagamentos mudam de estado.
//
// Proteções em camadas:
//  1. FAIL-FAST: se ASAAS_WEBHOOK_TOKEN não estiver configurado, recusa 503
//  2. TOKEN CHECK com comparação timing-safe
//  3. IDEMPOTÊNCIA ATÔMICA via INSERT em asaas_webhook_events(event_id)
//     — conflito em unique index = já processado, retorna 200 duplicate
//  4. CUSTOMER MATCH: valida que payment.customer bate com
//     clientes.asaas_customer_id da cobrança antes de mudar estado
//  5. BODY DE RESPOSTA SANITIZADO: não vaza mensagem de erro crua
//  6. audit fix #3 — STATUS HONESTO. Antes: SEMPRE 200, mesmo em erro
//     de DB → Asaas marcava entregue, ninguém retentava, divergia silente.
//     Agora: BusinessRuleError (cobrança não achada, customer mismatch)
//     devolve 200 (já registrado em asaas_webhook_events.error pra
//     investigação humana — Asaas não retenta erro permanente). Erro
//     genérico (DB indisponível, JS exception) devolve 500 (transitório,
//     Asaas retenta com backoff).
//
// Fluxo de estados das cobranças:
//   PAYMENT_CONFIRMED / PAYMENT_RECEIVED → cobranca.status = 'paga',
//     lançamentos: status=pago, etapa=honorario_pago, confirmado_recebimento=true
//   PAYMENT_OVERDUE → cobranca.status = 'vencida' (só se ainda ativa)
//   PAYMENT_DELETED / PAYMENT_RESTORED → cobranca.status = 'cancelada'
//   PAYMENT_REFUNDED / PAYMENT_REFUND_IN_PROGRESS → cobranca.status = 'cancelada'
//     + lançamentos voltam para pendente/cobranca_enviada
//   PAYMENT_UPDATED → 25/05/2026: sincroniza data_vencimento quando Thales
//     ou alguém edita pelo painel do Asaas (mesmo caminho do nosso edge
//     asaas-atualizar-vencimento — fica round-trip idempotente). Antes
//     deste fix: evento era ignorado, banco desincronizava silenciosamente.
// =============================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, asaas-access-token",
  "Access-Control-Allow-Methods": "POST, OPTIONS, HEAD, GET",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const WEBHOOK_TOKEN = Deno.env.get("ASAAS_WEBHOOK_TOKEN") ?? "";

const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

function todayISO(): string {
  return new Date().toISOString().split("T")[0];
}

function nowISO(): string {
  return new Date().toISOString();
}

// audit fix #3 — erros de regra de negócio (não retenta) vs erros
// transitórios (retenta). Asaas retenta com backoff em 5xx; em 200
// considera entregue. Distinguir é vital pra não esconder problemas
// nem entrar em loop infinito de retry em erro permanente.
class BusinessRuleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BusinessRuleError";
  }
}

// Comparação de strings resistente a timing attacks.
// Sempre percorre o maior tamanho, evitando early-return por length diff.
function timingSafeEqual(a: string, b: string): boolean {
  const len = Math.max(a.length, b.length);
  let diff = a.length ^ b.length;
  for (let i = 0; i < len; i++) {
    diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  }
  return diff === 0;
}

type CobrancaWithCliente = {
  id: string;
  lancamento_ids: string[] | null;
  status: string;
  cliente_id: string;
  empresa_id: string;
  total_geral: number | null;
  data_vencimento: string | null;
  clientes:
    | { asaas_customer_id: string | null; nome: string | null }
    | null;
};

async function fetchCobrancaByPaymentId(
  paymentId: string
): Promise<CobrancaWithCliente | null> {
  const { data } = await admin
    .from("cobrancas")
    .select(
      "id, lancamento_ids, status, cliente_id, empresa_id, total_geral, data_vencimento, clientes(asaas_customer_id, nome)"
    )
    .eq("asaas_payment_id", paymentId)
    .maybeSingle();
  return (data as any) ?? null;
}

// FIN-001 (17/05/2026): fallback pra resolver a race em que o webhook chega
// ANTES da edge `asaas-gerar-cobranca` ter salvado o `asaas_payment_id` no
// banco. `externalReference` é setado pela edge ao chamar `createPayment`
// como `cobranca.id` — Asaas devolve no webhook em `payment.externalReference`.
async function fetchCobrancaByExternalReference(
  externalRef: string
): Promise<CobrancaWithCliente | null> {
  if (!externalRef) return null;
  const { data } = await admin
    .from("cobrancas")
    .select(
      "id, lancamento_ids, status, cliente_id, empresa_id, total_geral, data_vencimento, clientes(asaas_customer_id, nome)"
    )
    .eq("id", externalRef)
    .maybeSingle();
  return (data as any) ?? null;
}

/**
 * FIN-001 (17/05/2026): resolve cobrança tentando 2 caminhos.
 *   1º) por asaas_payment_id (caminho normal — webhook chega depois do UPDATE da edge)
 *   2º) por externalReference (fallback pra race window — webhook chegou antes do UPDATE)
 * Retorna também flag `needsPaymentIdUpdate` pra o handler saber se precisa
 * gravar asaas_payment_id e liberar o lock no mesmo UPDATE de status.
 */
async function resolveCobrancaFromPayment(
  event: any
): Promise<{ cobranca: CobrancaWithCliente | null; needsPaymentIdUpdate: boolean }> {
  const paymentId: string | undefined = event?.payment?.id;
  const externalRef: string | undefined = event?.payment?.externalReference;

  if (paymentId) {
    const cobranca = await fetchCobrancaByPaymentId(paymentId);
    if (cobranca) return { cobranca, needsPaymentIdUpdate: false };
  }

  if (externalRef) {
    const cobranca = await fetchCobrancaByExternalReference(externalRef);
    if (cobranca) {
      console.log(
        "[asaas-webhook] FIN-001 race fallback: cobrança achada por externalReference",
        { externalRef, paymentId }
      );
      return { cobranca, needsPaymentIdUpdate: true };
    }
  }

  return { cobranca: null, needsPaymentIdUpdate: false };
}

function fmtBRL(v: number | null | undefined): string {
  const n = Number(v ?? 0);
  return n.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function fmtDateBR(iso: string | null | undefined): string {
  if (!iso) return "";
  const s = String(iso).split("T")[0];
  const [y, m, d] = s.split("-");
  return `${d}/${m}/${y}`;
}

/**
 * Insere notificação in-app pra empresa. Falhas aqui são silenciosas:
 * notificação é UX, não pode quebrar o fluxo de webhook (que já gravou
 * cobrança/lançamentos com sucesso). Realtime no frontend dispara toast/sino.
 */
async function notifyEmpresa(
  empresaId: string | null | undefined,
  tipo: string,
  titulo: string,
  mensagem: string
): Promise<void> {
  if (!empresaId) {
    console.warn("[asaas-webhook] notifyEmpresa abortado: empresaId vazio");
    return;
  }
  // Supabase client NÃO joga exception — retorna { data, error }.
  // Try/catch antes era inútil, escondia falha de RLS/schema.
  const { error } = await admin.from("notificacoes").insert({
    empresa_id: empresaId,
    tipo,
    titulo,
    mensagem,
    lida: false,
  } as any);
  if (error) {
    console.error(
      "[asaas-webhook] falha ao inserir notificação:",
      JSON.stringify({
        empresaId,
        tipo,
        titulo,
        message: error.message,
        details: (error as any).details,
        hint: (error as any).hint,
        code: (error as any).code,
      })
    );
  } else {
    console.log(
      "[asaas-webhook] notificação inserida:",
      JSON.stringify({ empresaId, tipo, titulo })
    );
  }
}

/**
 * Garante que o customer informado no payload do Asaas corresponde
 * ao asaas_customer_id registrado no cliente desta cobrança.
 * Defende contra webhook forjado com payment_id válido mas customer divergente.
 */
function assertCustomerMatches(
  cobranca: CobrancaWithCliente,
  payload: any
): void {
  const payloadCustomer: string | undefined = payload?.payment?.customer;
  const clienteCustomer = cobranca.clientes?.asaas_customer_id ?? null;
  if (!payloadCustomer) {
    throw new BusinessRuleError("payload sem payment.customer");
  }
  if (!clienteCustomer) {
    throw new BusinessRuleError(
      `cliente ${cobranca.cliente_id} sem asaas_customer_id registrado`
    );
  }
  if (payloadCustomer !== clienteCustomer) {
    throw new BusinessRuleError(
      `customer mismatch: payload=${payloadCustomer} cobranca=${clienteCustomer}`
    );
  }
}

async function handlePaidEvent(paymentId: string, event: any) {
  // FIN-001 (17/05/2026): resolve com fallback por externalReference.
  const { cobranca, needsPaymentIdUpdate } = await resolveCobrancaFromPayment(event);
  if (!cobranca) {
    throw new BusinessRuleError(
      `cobrança não encontrada para payment_id=${paymentId} nem externalReference=${event?.payment?.externalReference}`
    );
  }
  assertCustomerMatches(cobranca, event);

  const confirmedAt =
    event?.payment?.confirmedDate ||
    event?.payment?.creditDate ||
    event?.payment?.paymentDate ||
    nowISO();

  const cobrancaUpdate: Record<string, any> = {
    status: "paga",
    asaas_status: event?.payment?.status ?? "RECEIVED",
    asaas_pago_em: confirmedAt,
    asaas_last_event: event,
    asaas_webhook_recebido_em: nowISO(),
  };
  // FIN-001: se achou via fallback, grava payment_id e libera o lock no mesmo UPDATE
  if (needsPaymentIdUpdate) {
    cobrancaUpdate.asaas_payment_id = paymentId;
    cobrancaUpdate.asaas_gerando_lock_ate = null;
  }

  await admin
    .from("cobrancas")
    .update(cobrancaUpdate)
    .eq("id", cobranca.id);

  const lancamentoIds = cobranca.lancamento_ids;
  if (Array.isArray(lancamentoIds) && lancamentoIds.length > 0) {
    await admin
      .from("lancamentos")
      .update({
        status: "pago",
        etapa_financeiro: "honorario_pago",
        data_pagamento:
          (confirmedAt && String(confirmedAt).split("T")[0]) || todayISO(),
        confirmado_recebimento: true,
      } as any)
      .in("id", lancamentoIds);
  }

  // Notificação in-app — sino + toast via Realtime no frontend
  const nomeCliente = cobranca.clientes?.nome ?? "Cliente";
  const valorFmt = fmtBRL(cobranca.total_geral);
  await notifyEmpresa(
    cobranca.empresa_id,
    "pagamento",
    "💰 Pagamento recebido",
    `${nomeCliente} pagou ${valorFmt}.`
  );
}

async function handleOverdueEvent(paymentId: string, event: any) {
  // FIN-001: mesmo fallback dos outros handlers
  const { cobranca, needsPaymentIdUpdate } = await resolveCobrancaFromPayment(event);
  if (!cobranca) return;
  assertCustomerMatches(cobranca, event);
  if (cobranca.status !== "ativa") return; // já paga/cancelada

  const cobrancaUpdate: Record<string, any> = {
    status: "vencida",
    asaas_status: event?.payment?.status ?? "OVERDUE",
    asaas_last_event: event,
    asaas_webhook_recebido_em: nowISO(),
  };
  if (needsPaymentIdUpdate) {
    cobrancaUpdate.asaas_payment_id = paymentId;
    cobrancaUpdate.asaas_gerando_lock_ate = null;
  }

  await admin
    .from("cobrancas")
    .update(cobrancaUpdate)
    .eq("id", cobranca.id);

  const nomeCliente = cobranca.clientes?.nome ?? "Cliente";
  const valorFmt = fmtBRL(cobranca.total_geral);
  await notifyEmpresa(
    cobranca.empresa_id,
    "cobranca",
    "⚠️ Cobrança vencida",
    `${nomeCliente} — ${valorFmt} venceu sem pagamento.`
  );
}

async function handleCanceledEvent(paymentId: string, event: any) {
  // FIN-001: mesmo fallback
  const { cobranca, needsPaymentIdUpdate } = await resolveCobrancaFromPayment(event);
  if (!cobranca) return;
  assertCustomerMatches(cobranca, event);
  if (cobranca.status === "paga") return; // conservador: não cancela o que já foi pago

  const cobrancaUpdate: Record<string, any> = {
    status: "cancelada",
    asaas_status: event?.payment?.status ?? "CANCELED",
    asaas_last_event: event,
    asaas_webhook_recebido_em: nowISO(),
  };
  if (needsPaymentIdUpdate) {
    cobrancaUpdate.asaas_payment_id = paymentId;
    cobrancaUpdate.asaas_gerando_lock_ate = null;
  }

  await admin
    .from("cobrancas")
    .update(cobrancaUpdate)
    .eq("id", cobranca.id);
  // Conservador: não mexe em lançamentos aqui; Thales/Carolina reagem manualmente.
}

async function handleRefundedEvent(paymentId: string, event: any) {
  // FIN-001: mesmo fallback
  const { cobranca, needsPaymentIdUpdate } = await resolveCobrancaFromPayment(event);
  if (!cobranca) return;
  assertCustomerMatches(cobranca, event);

  const cobrancaUpdate: Record<string, any> = {
    status: "cancelada",
    asaas_status: event?.payment?.status ?? "REFUNDED",
    asaas_pago_em: null,
    asaas_last_event: event,
    asaas_webhook_recebido_em: nowISO(),
  };
  if (needsPaymentIdUpdate) {
    cobrancaUpdate.asaas_payment_id = paymentId;
    cobrancaUpdate.asaas_gerando_lock_ate = null;
  }

  await admin
    .from("cobrancas")
    .update(cobrancaUpdate)
    .eq("id", cobranca.id);

  const lancamentoIds = cobranca.lancamento_ids;
  if (Array.isArray(lancamentoIds) && lancamentoIds.length > 0) {
    await admin
      .from("lancamentos")
      .update({
        status: "pendente",
        etapa_financeiro: "cobranca_enviada",
        data_pagamento: null,
        confirmado_recebimento: false,
      } as any)
      .in("id", lancamentoIds);
  }
}

// 25/05/2026: PAYMENT_UPDATED. Asaas dispara este evento quando admin
// edita cobrança via painel (dueDate, value, description). Antes era
// ignorado → divergência silenciosa entre banco e Asaas (caso UCONT 18/05:
// Thales editou dueDate no Asaas via painel, ERP continuou com a data
// antiga até rodar SQL manual).
//
// Conservador: só sincronizamos dueDate (data_vencimento) — o campo mais
// editado na prática. Mudança de valor é caixa de pandora (qual lançamento
// recebe qual delta?), fica fora deste handler. Se aparecer caso real,
// tratar manualmente como antes.
//
// Também rodamos round-trip idempotente: quando NÓS chamamos
// `asaas-atualizar-vencimento`, Asaas dispara PAYMENT_UPDATED de volta.
// Comparação dueDate vs cobranca.data_vencimento detecta no-op e pula.
async function handleUpdatedEvent(paymentId: string, event: any) {
  const { cobranca, needsPaymentIdUpdate } = await resolveCobrancaFromPayment(event);
  if (!cobranca) return;
  assertCustomerMatches(cobranca, event);
  if (cobranca.status === "paga" || cobranca.status === "cancelada") {
    // Cobrança finalizada: não retroatua mudanças.
    return;
  }

  const novoDueDate: string | undefined = event?.payment?.dueDate;
  if (!novoDueDate || !/^\d{4}-\d{2}-\d{2}/.test(novoDueDate)) {
    // Sem dueDate válido no payload — pode ser update de outro campo (descrição etc).
    return;
  }
  const novoDueDateISO = novoDueDate.split("T")[0];
  const atualISO = cobranca.data_vencimento ? String(cobranca.data_vencimento).split("T")[0] : null;
  if (atualISO === novoDueDateISO) {
    // Idempotente: já sincronizado (provavelmente round-trip do nosso edge).
    return;
  }

  const cobrancaUpdate: Record<string, any> = {
    data_vencimento: novoDueDateISO,
    asaas_status: event?.payment?.status ?? cobranca.status,
    asaas_last_event: event,
    asaas_webhook_recebido_em: nowISO(),
  };
  if (needsPaymentIdUpdate) {
    cobrancaUpdate.asaas_payment_id = paymentId;
    cobrancaUpdate.asaas_gerando_lock_ate = null;
  }

  await admin
    .from("cobrancas")
    .update(cobrancaUpdate)
    .eq("id", cobranca.id);

  // Atualiza lançamentos vinculados — tanto via lancamento_ids (array legado)
  // quanto via cobrancas_lancamentos (link table mais nova).
  const lancIdsArr = (Array.isArray(cobranca.lancamento_ids) ? cobranca.lancamento_ids : []) as string[];
  const { data: links } = await admin
    .from("cobrancas_lancamentos")
    .select("lancamento_id")
    .eq("cobranca_id", cobranca.id);
  const linksArr = (links ?? []).map((r: any) => r.lancamento_id);
  const allLancIds = Array.from(new Set([...lancIdsArr, ...linksArr]));
  if (allLancIds.length > 0) {
    await admin
      .from("lancamentos")
      .update({ data_vencimento: novoDueDateISO } as any)
      .in("id", allLancIds);
  }

  // Notificação só quando a mudança veio de FORA do nosso fluxo (admin editou
  // no painel Asaas). Heurística: se atualizamos via edge `asaas-atualizar-vencimento`,
  // o banco JÁ estaria com a nova data antes do webhook chegar — e o early-return
  // de `atualISO === novoDueDateISO` acima cobre esse caso. Se chegou aqui, é
  // porque a mudança vem do painel. Notifica master.
  const nomeCliente = cobranca.clientes?.nome ?? "Cliente";
  await notifyEmpresa(
    cobranca.empresa_id,
    "cobranca",
    "📅 Vencimento alterado no Asaas",
    `${nomeCliente}: ${fmtDateBR(atualISO)} → ${fmtDateBR(novoDueDateISO)} (alterado pelo painel Asaas).`
  );
}

// Marcador de versão — se aparece nos logs, deploy novo pegou.
const VERSION_TAG = "2026-05-25-payment-updated-sync";

Deno.serve(async (req) => {
  console.log(`[asaas-webhook] handler v=${VERSION_TAG} method=${req.method}`);
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method === "HEAD" || req.method === "GET") {
    return new Response("ok", { status: 200, headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // === FAIL-FAST ===
  // Sem token configurado, o webhook ficaria completamente aberto.
  // Retornamos 503 e logamos em CRITICAL — Asaas vai retentar,
  // dando tempo pro Thales configurar o secret sem perder eventos.
  if (!WEBHOOK_TOKEN || WEBHOOK_TOKEN.trim().length === 0) {
    console.error(
      "[asaas-webhook] CRITICAL: ASAAS_WEBHOOK_TOKEN não configurado; rejeitando todas as chamadas"
    );
    // FIN-008 (17/05/2026): alertar todos os masters via notif in-app. Asaas
    // retenta por ~24h e desiste — sem alerta o master só descobre quando
    // descobre que nenhum pagamento desde X horas atualizou status. Throttle
    // 24h por master pra evitar flood.
    try {
      const { data: masters } = await admin
        .from("profiles")
        .select("id, empresa_id")
        .eq("role", "master")
        .eq("ativo", true);
      for (const m of (masters ?? []) as any[]) {
        const { data: existing } = await admin
          .from("notificacoes")
          .select("id")
          .eq("destinatario_id", m.id)
          .eq("tipo", "webhook_config_missing")
          .gte("created_at", new Date(Date.now() - 86400000).toISOString())
          .limit(1);
        if (!existing || existing.length === 0) {
          await admin.from("notificacoes").insert({
            empresa_id: m.empresa_id,
            destinatario_id: m.id,
            tipo: "webhook_config_missing",
            titulo: "Webhook Asaas não configurado",
            mensagem:
              "ASAAS_WEBHOOK_TOKEN está vazio em produção. Asaas pode parar de retentar webhooks após ~24h e nenhum pagamento será atualizado automaticamente. Configure em Supabase Dashboard → Edge Functions → Secrets.",
          });
        }
      }
    } catch (alertErr) {
      console.error("[asaas-webhook] alerta WEBHOOK_TOKEN missing falhou:", alertErr);
    }
    return new Response(
      JSON.stringify({ error: "webhook token not configured" }),
      {
        status: 503,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  // Validação de origem — comparação timing-safe
  const headerToken = req.headers.get("asaas-access-token") ?? "";
  if (!timingSafeEqual(headerToken, WEBHOOK_TOKEN)) {
    console.warn("[asaas-webhook] invalid access-token header");
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let payload: any = null;
  try {
    payload = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "invalid JSON" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const eventId: string | undefined = payload?.id ?? payload?.event_id;
  const eventType: string = payload?.event ?? payload?.type ?? "UNKNOWN";
  const paymentId: string | undefined = payload?.payment?.id;

  // === IDEMPOTÊNCIA ATÔMICA ===
  // Tentamos INSERT já; o unique index parcial em event_id (WHERE event_id IS NOT NULL)
  // garante que só um worker consegue inserir. Conflito (23505) = já processado/processando,
  // respondemos 200 duplicate sem reexecutar efeito.
  // Eventos sem event_id passam sem dedupe (raro, melhor processar do que perder).
  let logId: string | null = null;
  if (eventId) {
    const { data: inserted, error: insertErr } = await admin
      .from("asaas_webhook_events")
      .insert({
        event_id: eventId,
        event_type: eventType,
        asaas_payment_id: paymentId ?? null,
        processed: false,
        payload,
      })
      .select("id")
      .maybeSingle();

    if (insertErr) {
      if ((insertErr as any).code === "23505") {
        // unique_violation → já existe esse event_id
        return new Response(JSON.stringify({ ok: true, duplicate: true }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      console.error("[asaas-webhook] erro ao registrar evento:", insertErr);
      return new Response(JSON.stringify({ ok: false }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    logId = (inserted as any)?.id ?? null;
  } else {
    const { data: inserted } = await admin
      .from("asaas_webhook_events")
      .insert({
        event_id: null,
        event_type: eventType,
        asaas_payment_id: paymentId ?? null,
        processed: false,
        payload,
      })
      .select("id")
      .maybeSingle();
    logId = (inserted as any)?.id ?? null;
  }

  let processError: string | null = null;
  let isBusinessRule = false;
  try {
    if (!paymentId) {
      console.log("[asaas-webhook] evento sem payment.id:", eventType);
    } else {
      switch (eventType) {
        case "PAYMENT_CONFIRMED":
        case "PAYMENT_RECEIVED":
          await handlePaidEvent(paymentId, payload);
          break;
        case "PAYMENT_OVERDUE":
          await handleOverdueEvent(paymentId, payload);
          break;
        case "PAYMENT_DELETED":
        case "PAYMENT_RESTORED":
          await handleCanceledEvent(paymentId, payload);
          break;
        case "PAYMENT_REFUNDED":
        case "PAYMENT_REFUND_IN_PROGRESS":
          await handleRefundedEvent(paymentId, payload);
          break;
        case "PAYMENT_UPDATED":
          await handleUpdatedEvent(paymentId, payload);
          break;
        case "PAYMENT_CREATED":
        case "PAYMENT_AWAITING_RISK_ANALYSIS":
        case "PAYMENT_APPROVED_BY_RISK_ANALYSIS":
        case "PAYMENT_REPROVED_BY_RISK_ANALYSIS":
        case "PAYMENT_DUNNING_RECEIVED":
        case "PAYMENT_DUNNING_REQUESTED":
        case "PAYMENT_BANK_SLIP_VIEWED":
        case "PAYMENT_CHECKOUT_VIEWED":
        case "PAYMENT_CREDIT_CARD_CAPTURE_REFUSED":
          // informacional — só registramos
          break;
        default:
          console.log("[asaas-webhook] evento não tratado:", eventType);
      }
    }
  } catch (e) {
    processError = e instanceof Error ? e.message : String(e);
    isBusinessRule = e instanceof BusinessRuleError;
    if (isBusinessRule) {
      console.warn("[asaas-webhook] business rule:", processError);
    } else {
      console.error("[asaas-webhook] erro transitório:", processError);
    }
  }

  if (logId) {
    await admin
      .from("asaas_webhook_events")
      .update({
        processed: processError === null,
        error: processError,
      })
      .eq("id", logId);
  }

  // audit fix #3 — status honesto ao Asaas:
  //  - sucesso → 200
  //  - business rule (cobrança não achada, customer mismatch): 200
  //    (não retenta — erro permanente, registrado em asaas_webhook_events
  //    pra investigação humana via Painel)
  //  - erro transitório (DB, network, JS exception): 500
  //    (Asaas retenta com backoff; problema some sozinho na próxima)
  const status = processError === null || isBusinessRule ? 200 : 500;
  return new Response(
    JSON.stringify({
      ok: processError === null,
      event_type: eventType,
      ...(isBusinessRule ? { business_rule: true } : {}),
    }),
    {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    }
  );
});
