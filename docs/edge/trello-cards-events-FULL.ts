// =============================================
// Edge Function: trello-cards-events
// =============================================
// FEATURE 29/05/2026: Detecta quando card chega na lista
// "🍀 INSCRIÇÃO MUNICIPAL E ESTADUAL" e marca data_deferimento no processo.
//
// FLUXO:
// 1. Trello envia POST com action (updateCard, createCard, etc)
// 2. Validamos HMAC-SHA1 com TRELLO_SECRET (mesma lógica do trello-guard)
// 3. Idempotência: action.id como UNIQUE em trello_card_events
// 4. Se for updateCard com listAfter.name = TARGET:
//    - Resolve processo via processos.trello_card_id = card.id
//    - Se tipo válido (abertura, alteracao, transformacao, encerramento, baixa)
//      e data_deferimento ainda NULL → seta NOW()
// 5. Audit em trello_card_events com acao_aplicada
//
// Roda em paralelo ao trello-guard (mesmo board terá 2 webhooks Trello).
// Provisioner registra ambos.
// =============================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-trello-webhook",
  "Access-Control-Allow-Methods": "GET, POST, HEAD, OPTIONS",
};

const TRELLO_SECRET = Deno.env.get("TRELLO_SECRET") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Lista alvo — quando card chega aqui, é deferimento.
const TARGET_LIST_NAME = "🍀 INSCRIÇÃO MUNICIPAL E ESTADUAL";

// Tipos de processo que têm "deferimento" como conceito.
// (orcamento/avulso NÃO têm deferimento — Letícia não usaria essa lista pra eles)
const TIPOS_COM_DEFERIMENTO = new Set([
  "abertura", "alteracao", "transformacao", "encerramento", "baixa",
]);

// ────────────────────────────────────────────────
// HMAC validation — mesma lógica do trello-guard
// ────────────────────────────────────────────────
function timingSafeEqual(a: string, b: string): boolean {
  const len = Math.max(a.length, b.length);
  let diff = a.length ^ b.length;
  for (let i = 0; i < len; i++) {
    diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  }
  return diff === 0;
}

async function verifySignature(req: Request, rawBody: string): Promise<boolean> {
  if (!TRELLO_SECRET) {
    console.error("[trello-cards-events] CRITICAL: TRELLO_SECRET ausente; rejeitando webhook");
    return false;
  }
  const signature = req.headers.get("x-trello-webhook");
  if (!signature) return false;
  const callbackUrl = `${SUPABASE_URL}/functions/v1/trello-cards-events`;
  const content = rawBody + callbackUrl;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(TRELLO_SECRET),
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"],
  );
  const sigBuf = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(content),
  );
  const expected = btoa(String.fromCharCode(...new Uint8Array(sigBuf)));
  return timingSafeEqual(expected, signature);
}

// ────────────────────────────────────────────────
// Processamento principal
// ────────────────────────────────────────────────
interface ProcessResult {
  acao: string;
  detalhe?: string;
  processo_id?: string;
}

async function processAction(payload: any): Promise<ProcessResult> {
  const action = payload?.action;
  if (!action || !action.id) {
    return { acao: "payload_invalido" };
  }

  const actionType = action.type as string;
  const card = action.data?.card ?? {};
  const cardId = card.id as string | undefined;
  const board = action.data?.board ?? {};
  const listBefore = action.data?.listBefore;
  const listAfter = action.data?.listAfter;
  const member = action.memberCreator?.username ?? null;

  // 1) Idempotência: tenta INSERT do action. Se já existe (UNIQUE violation),
  //    significa que esse webhook já foi processado — pula.
  const eventBase = {
    action_id: action.id,
    action_type: actionType,
    card_id: cardId ?? null,
    card_name: card.name ?? null,
    board_id: board.id ?? null,
    list_before_id: listBefore?.id ?? null,
    list_before_name: listBefore?.name ?? null,
    list_after_id: listAfter?.id ?? null,
    list_after_name: listAfter?.name ?? null,
    member_username: member,
    raw_action: action,
  };

  // 2) Filtro inicial: só processa updateCard com listAfter (= movimento entre listas)
  if (actionType !== "updateCard" || !listAfter) {
    await admin.from("trello_card_events").insert({
      ...eventBase,
      acao_aplicada: "nao_updateCard",
      acao_detalhe: `type=${actionType} listAfter=${!!listAfter}`,
    } as any);
    return { acao: "nao_updateCard" };
  }

  // 3) Lista é a alvo?
  if (listAfter.name !== TARGET_LIST_NAME) {
    await admin.from("trello_card_events").insert({
      ...eventBase,
      acao_aplicada: "lista_irrelevante",
      acao_detalhe: `listAfter=${listAfter.name}`,
    } as any);
    return { acao: "lista_irrelevante" };
  }

  // 4) Resolve processo via trello_card_id
  if (!cardId) {
    await admin.from("trello_card_events").insert({
      ...eventBase,
      acao_aplicada: "erro",
      acao_detalhe: "card.id ausente no payload",
    } as any);
    return { acao: "erro", detalhe: "card.id ausente" };
  }

  const { data: processo, error: procErr } = await admin
    .from("processos")
    .select("id, tipo, data_deferimento, cliente_id")
    .eq("trello_card_id", cardId)
    .maybeSingle();

  if (procErr) {
    console.error("[trello-cards-events] erro select processo:", procErr);
    await admin.from("trello_card_events").insert({
      ...eventBase,
      acao_aplicada: "erro",
      acao_detalhe: `select processo: ${procErr.message}`,
    } as any);
    return { acao: "erro", detalhe: procErr.message };
  }

  if (!processo) {
    // Card não está linkado a nenhum processo — backfill pendente, card novo
    // criado direto no Trello, ou processo deletado. Audit pra Thales investigar.
    await admin.from("trello_card_events").insert({
      ...eventBase,
      acao_aplicada: "card_sem_processo",
      acao_detalhe: `nenhum processo com trello_card_id=${cardId}`,
    } as any);
    return { acao: "card_sem_processo" };
  }

  // 5) Tipo compatível?
  const tipo = (processo.tipo as string)?.toLowerCase();
  if (!TIPOS_COM_DEFERIMENTO.has(tipo)) {
    await admin.from("trello_card_events").insert({
      ...eventBase,
      acao_aplicada: "tipo_incompativel",
      acao_detalhe: `tipo=${tipo} não tem conceito de deferimento`,
      processo_id: processo.id,
    } as any);
    return { acao: "tipo_incompativel", processo_id: processo.id };
  }

  // 6) Já está deferido? Idempotente.
  if (processo.data_deferimento) {
    await admin.from("trello_card_events").insert({
      ...eventBase,
      acao_aplicada: "deferimento_ja_setado",
      acao_detalhe: `data_deferimento=${processo.data_deferimento}`,
      processo_id: processo.id,
    } as any);
    return { acao: "deferimento_ja_setado", processo_id: processo.id };
  }

  // 7) Marca deferimento como hoje
  const hoje = new Date().toISOString().split("T")[0];
  const { error: updErr } = await admin
    .from("processos")
    .update({ data_deferimento: hoje } as any)
    .eq("id", processo.id);

  if (updErr) {
    console.error("[trello-cards-events] erro update processo:", updErr);
    await admin.from("trello_card_events").insert({
      ...eventBase,
      acao_aplicada: "erro",
      acao_detalhe: `update processo: ${updErr.message}`,
      processo_id: processo.id,
    } as any);
    return { acao: "erro", detalhe: updErr.message };
  }

  await admin.from("trello_card_events").insert({
    ...eventBase,
    acao_aplicada: "deferimento_setado",
    acao_detalhe: `data_deferimento=${hoje} por @${member ?? "desconhecido"}`,
    processo_id: processo.id,
  } as any);

  console.log(`[trello-cards-events] deferimento setado processo=${processo.id} card=${cardId} tipo=${tipo}`);
  return { acao: "deferimento_setado", processo_id: processo.id };
}

// ────────────────────────────────────────────────
// HTTP handler
// ────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method === "HEAD" || req.method === "GET") {
    // Trello faz HEAD pra validar webhook ao registrar
    return new Response("ok", { status: 200, headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  let rawBody = "";
  let payload: any = null;
  try {
    rawBody = await req.text();
    payload = JSON.parse(rawBody);
  } catch {
    return new Response("ok", { status: 200, headers: corsHeaders });
  }

  const valid = await verifySignature(req, rawBody);
  if (!valid) {
    console.warn("[trello-cards-events] invalid signature");
    // Devolve 200 pra Trello não desabilitar o webhook após 3 falhas
    return new Response("ok", { status: 200, headers: corsHeaders });
  }

  // Processa async — Trello quer resposta <10s
  // @ts-ignore EdgeRuntime existe no Supabase Edge Runtime
  if (typeof EdgeRuntime !== "undefined" && EdgeRuntime?.waitUntil) {
    // @ts-ignore
    EdgeRuntime.waitUntil(processAction(payload));
  } else {
    processAction(payload).catch((e) => console.error("[trello-cards-events] async error:", e));
  }

  return new Response("ok", { status: 200, headers: corsHeaders });
});
