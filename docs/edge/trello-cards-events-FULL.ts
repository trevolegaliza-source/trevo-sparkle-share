// =============================================
// Edge Function: trello-cards-events
// =============================================
// FEATURE 29/05/2026: webhook do Trello dispara automações no ERP.
//
// 2 lógicas implementadas:
//
// (1) DEFERIMENTO (updateCard movido pra lista TARGET_DEFERIMENTO)
//     - Resolve processo via processos.trello_card_id
//     - Se tipo válido → seta data_deferimento = hoje
//
// (2) CRIAÇÃO AUTOMÁTICA (createCard na lista TARGET_NOVO)
//     - Resolve cliente via clientes.trello_board_id
//     - Se cliente NÃO existe → loga + notifica master ("cliente novo, cadastre")
//     - Se existe → GET na API Trello pra pegar cor da capa
//     - Mapeia cor → tipo:
//         green=abertura, orange=transformacao, purple=alteracao,
//         pink=alteracao+TROCA_UF, red=baixa
//     - Cria processo no ERP com etapa=ativo, prioridade=alta,
//       notas=[AUTO-TRELLO ...], trello_card_id já linkado
//     - Notifica master
//
// IDEMPOTÊNCIA: action.id é UNIQUE em trello_card_events. Webhook duplicado
// (Trello retry após 5xx) é ignorado.
//
// VALIDAÇÃO: HMAC-SHA1 com TRELLO_SECRET (mesma lógica trello-guard).
//
// Roda em paralelo ao trello-guard (mesmo board terá 2+ webhooks Trello).
// =============================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-trello-webhook",
  "Access-Control-Allow-Methods": "GET, POST, HEAD, OPTIONS",
};

const TRELLO_KEY = Deno.env.get("TRELLO_API_KEY") ?? Deno.env.get("TRELLO_KEY") ?? "";
const TRELLO_TOKEN = Deno.env.get("TRELLO_TOKEN") ?? "";
const TRELLO_SECRET = Deno.env.get("TRELLO_SECRET") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// ────────────────────────────────────────────────
// Constantes de mapeamento
// ────────────────────────────────────────────────

// Lista alvo do deferimento: card movido pra cá → marca data_deferimento
const TARGET_LIST_DEFERIMENTO = "🍀 INSCRIÇÃO MUNICIPAL E ESTADUAL";

// Lista alvo da criação automática: card criado AQUI → cria processo no ERP
const TARGET_LIST_NOVO = "🍀 RECÉM CHEGADOS";

// Tipos de processo que têm "deferimento" como conceito
const TIPOS_COM_DEFERIMENTO = new Set([
  "abertura", "alteracao", "transformacao", "baixa",
]);

// Mapeamento cor da capa do card → tipo do processo no ERP
// Cores definidas pelo Thales em 29/05/2026:
//   verde   = abertura
//   laranja = transformacao
//   roxo    = alteracao
//   rosa    = alteracao + TROCA DE UF (nota adicional)
//   vermelho= baixa (encerramento)
// API Trello retorna cor como string ('green', 'orange', 'purple', 'pink', 'red').
const COR_PARA_TIPO: Record<string, { tipo: string; nota_extra?: string }> = {
  green: { tipo: "abertura" },
  orange: { tipo: "transformacao" },
  purple: { tipo: "alteracao" },
  pink: { tipo: "alteracao", nota_extra: "TROCA DE UF" },
  red: { tipo: "baixa" },
};

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

// DEBUG MODE 29/05/2026: retorna info detalhada em vez de só boolean,
// pra diagnosticar HMAC failing silencioso. Quando confirmado, restaurar.
interface SignatureCheck {
  valid: boolean;
  reason: string;
  expected_hash_prefix?: string;
  received_hash_prefix?: string;
  callback_url_used?: string;
  secret_present?: boolean;
}

async function verifySignature(req: Request, rawBody: string): Promise<SignatureCheck> {
  if (!TRELLO_SECRET) {
    console.error("[trello-cards-events] CRITICAL: TRELLO_SECRET ausente; rejeitando webhook");
    return { valid: false, reason: "secret_ausente", secret_present: false };
  }
  const signature = req.headers.get("x-trello-webhook");
  if (!signature) {
    return { valid: false, reason: "header_x-trello-webhook_ausente", secret_present: true };
  }
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
  const valid = timingSafeEqual(expected, signature);
  return {
    valid,
    reason: valid ? "ok" : "hmac_mismatch",
    expected_hash_prefix: expected.substring(0, 8),
    received_hash_prefix: signature.substring(0, 8),
    callback_url_used: callbackUrl,
    secret_present: true,
  };
}

// ────────────────────────────────────────────────
// Trello API helper (pra puxar cor da capa do card)
// ────────────────────────────────────────────────
async function trelloGet<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(`https://api.trello.com${path}`);
  url.searchParams.set("key", TRELLO_KEY);
  url.searchParams.set("token", TRELLO_TOKEN);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url.toString());
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Trello ${path} ${res.status}: ${txt.substring(0, 200)}`);
  }
  return res.json();
}

// ────────────────────────────────────────────────
// HELPER: notifica master da empresa
// ────────────────────────────────────────────────
async function notificarMaster(empresaId: string, tipo: string, titulo: string, mensagem: string, processoId?: string) {
  try {
    const { data: master } = await admin.rpc("get_empresa_master_id" as any, { p_empresa_id: empresaId });
    if (!master) return;
    await admin.from("notificacoes").insert({
      empresa_id: empresaId,
      destinatario_id: master,
      tipo,
      titulo,
      mensagem,
      processo_id: processoId,
    } as any);
  } catch (e) {
    console.error("[notificarMaster] falhou:", e);
  }
}

// ────────────────────────────────────────────────
// Handler 1: updateCard (deferimento)
// ────────────────────────────────────────────────
async function processarMovimentoLista(eventBase: any, action: any): Promise<{ acao: string; detalhe?: string; processo_id?: string }> {
  const listAfter = action.data?.listAfter;
  const card = action.data?.card ?? {};
  const cardId = card.id as string | undefined;

  if (listAfter?.name !== TARGET_LIST_DEFERIMENTO) {
    await admin.from("trello_card_events").insert({
      ...eventBase,
      acao_aplicada: "lista_irrelevante",
      acao_detalhe: `listAfter=${listAfter?.name}`,
    } as any);
    return { acao: "lista_irrelevante" };
  }

  if (!cardId) {
    await admin.from("trello_card_events").insert({
      ...eventBase,
      acao_aplicada: "erro",
      acao_detalhe: "card.id ausente",
    } as any);
    return { acao: "erro" };
  }

  const { data: processo } = await admin
    .from("processos")
    .select("id, tipo, data_deferimento, cliente_id")
    .eq("trello_card_id", cardId)
    .maybeSingle();

  if (!processo) {
    await admin.from("trello_card_events").insert({
      ...eventBase,
      acao_aplicada: "card_sem_processo",
      acao_detalhe: `nenhum processo com trello_card_id=${cardId}`,
    } as any);
    return { acao: "card_sem_processo" };
  }

  const tipo = (processo.tipo as string)?.toLowerCase();
  if (!TIPOS_COM_DEFERIMENTO.has(tipo)) {
    await admin.from("trello_card_events").insert({
      ...eventBase,
      acao_aplicada: "tipo_incompativel",
      acao_detalhe: `tipo=${tipo}`,
      processo_id: processo.id,
    } as any);
    return { acao: "tipo_incompativel", processo_id: processo.id };
  }

  if (processo.data_deferimento) {
    await admin.from("trello_card_events").insert({
      ...eventBase,
      acao_aplicada: "deferimento_ja_setado",
      acao_detalhe: `data_deferimento=${processo.data_deferimento}`,
      processo_id: processo.id,
    } as any);
    return { acao: "deferimento_ja_setado", processo_id: processo.id };
  }

  const hoje = new Date().toISOString().split("T")[0];
  const { error: updErr } = await admin
    .from("processos")
    .update({ data_deferimento: hoje } as any)
    .eq("id", processo.id);

  if (updErr) {
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
    acao_detalhe: `data_deferimento=${hoje}`,
    processo_id: processo.id,
  } as any);

  return { acao: "deferimento_setado", processo_id: processo.id };
}

// ────────────────────────────────────────────────
// Handler 2: createCard (criação automática)
// ────────────────────────────────────────────────
async function processarCriacaoCard(eventBase: any, action: any): Promise<{ acao: string; detalhe?: string; processo_id?: string }> {
  const list = action.data?.list ?? {};
  const card = action.data?.card ?? {};
  const board = action.data?.board ?? {};

  // Filtro: só lista TARGET_LIST_NOVO dispara criação automática
  if (list.name !== TARGET_LIST_NOVO) {
    await admin.from("trello_card_events").insert({
      ...eventBase,
      acao_aplicada: "createCard_lista_irrelevante",
      acao_detalhe: `list=${list.name}`,
    } as any);
    return { acao: "createCard_lista_irrelevante" };
  }

  const cardId = card.id as string | undefined;
  const cardName = (card.name as string) || "(sem nome)";
  const boardId = board.id as string | undefined;

  if (!cardId || !boardId) {
    await admin.from("trello_card_events").insert({
      ...eventBase,
      acao_aplicada: "erro",
      acao_detalhe: "card.id ou board.id ausente",
    } as any);
    return { acao: "erro" };
  }

  // 1) Resolve cliente via clientes.trello_board_id
  const { data: cliente } = await admin
    .from("clientes")
    .select("id, nome, apelido, empresa_id, valor_base")
    .eq("trello_board_id", boardId)
    .maybeSingle();

  if (!cliente) {
    // Cliente NOVO — board não linkado ao ERP. Notifica pra cadastrar manual.
    await admin.from("trello_card_events").insert({
      ...eventBase,
      acao_aplicada: "board_sem_cliente",
      acao_detalhe: `board=${board.name} sem cliente no ERP — cadastre manual`,
    } as any);
    // Não dá pra notificar sem empresa_id; client cadastrar via /clientes
    // (sem empresa_id, não temos pra quem notificar; fica só audit log)
    return { acao: "board_sem_cliente" };
  }

  // 2) Idempotência: processo já existe pra esse card?
  const { data: jaExiste } = await admin
    .from("processos")
    .select("id")
    .eq("trello_card_id", cardId)
    .maybeSingle();

  if (jaExiste) {
    await admin.from("trello_card_events").insert({
      ...eventBase,
      acao_aplicada: "processo_ja_existe",
      acao_detalhe: `processo_id=${jaExiste.id}`,
      processo_id: jaExiste.id,
    } as any);
    return { acao: "processo_ja_existe", processo_id: jaExiste.id };
  }

  // 3) Pega cor da capa do card via API Trello
  let coverColor: string | null = null;
  try {
    const cardFull = await trelloGet<any>(`/1/cards/${cardId}`, {
      fields: "cover,name,desc,url",
    });
    coverColor = cardFull?.cover?.color || null;
  } catch (e: any) {
    console.error("[trello-cards-events] erro fetch card:", e);
    await admin.from("trello_card_events").insert({
      ...eventBase,
      acao_aplicada: "erro",
      acao_detalhe: `fetch card cover: ${e?.message ?? e}`,
    } as any);
    return { acao: "erro", detalhe: String(e?.message ?? e) };
  }

  if (!coverColor) {
    // Capa ainda não foi definida — Letícia provavelmente vai pintar depois.
    // Audit + aguarda futuro updateCard com cover.
    await admin.from("trello_card_events").insert({
      ...eventBase,
      acao_aplicada: "aguardando_cor",
      acao_detalhe: `card=${cardName} ainda sem cor de capa`,
    } as any);
    return { acao: "aguardando_cor" };
  }

  const mapping = COR_PARA_TIPO[coverColor];
  if (!mapping) {
    // Cor desconhecida (azul, amarelo, etc) — não é processo. Ignora.
    await admin.from("trello_card_events").insert({
      ...eventBase,
      acao_aplicada: "cor_irrelevante",
      acao_detalhe: `cover=${coverColor} não mapeia pra tipo conhecido`,
    } as any);
    return { acao: "cor_irrelevante" };
  }

  // 4) Cria processo no ERP
  const hojeBr = new Date().toLocaleDateString("pt-BR");
  const notaPartes: string[] = [`[AUTO-TRELLO ${hojeBr}] Card criado em "${TARGET_LIST_NOVO}" no Trello. Tipo deduzido pela cor da capa (${coverColor}).`];
  if (mapping.nota_extra) {
    notaPartes.push(`⚠️ ${mapping.nota_extra}`);
  }
  notaPartes.push("Revise valor, prioridade e detalhes.");

  const cardUrl = action.data?.card?.shortLink
    ? `https://trello.com/c/${action.data.card.shortLink}`
    : null;

  const { data: novoProcesso, error: insErr } = await admin
    .from("processos")
    .insert({
      cliente_id: cliente.id,
      razao_social: cardName,
      tipo: mapping.tipo,
      prioridade: "alta",
      valor: Number(cliente.valor_base) || 0,
      etapa: "ativo",
      empresa_id: cliente.empresa_id,
      notas: notaPartes.join("\n"),
      trello_card_id: cardId,
      trello_card_url: cardUrl,
      trello_card_linked_em: new Date().toISOString(),
    } as any)
    .select("id")
    .single();

  if (insErr || !novoProcesso) {
    await admin.from("trello_card_events").insert({
      ...eventBase,
      acao_aplicada: "erro",
      acao_detalhe: `INSERT processo: ${insErr?.message ?? "sem detalhe"}`,
    } as any);
    return { acao: "erro", detalhe: insErr?.message };
  }

  // 5) Notifica master pra revisão
  const apelido = cliente.apelido || cliente.nome;
  await notificarMaster(
    cliente.empresa_id,
    "processo_criado",
    `Processo ${mapping.tipo.toUpperCase()} criado automaticamente — ${apelido}`,
    `Card "${cardName}" foi criado no Trello (${apelido}) — ERP criou processo ${mapping.tipo.toUpperCase()} com prioridade ALTA. Revise valor e detalhes em /processos.`,
    novoProcesso.id,
  );

  await admin.from("trello_card_events").insert({
    ...eventBase,
    acao_aplicada: "processo_criado_auto",
    acao_detalhe: `tipo=${mapping.tipo} cor=${coverColor}${mapping.nota_extra ? " +" + mapping.nota_extra : ""}`,
    processo_id: novoProcesso.id,
  } as any);

  console.log(`[trello-cards-events] processo criado auto: ${novoProcesso.id} (${mapping.tipo}, ${cardName})`);
  return { acao: "processo_criado_auto", processo_id: novoProcesso.id };
}

// ────────────────────────────────────────────────
// Roteador principal
// ────────────────────────────────────────────────
async function processAction(payload: any): Promise<{ acao: string }> {
  const action = payload?.action;
  if (!action || !action.id) return { acao: "payload_invalido" };

  const actionType = action.type as string;
  const card = action.data?.card ?? {};
  const board = action.data?.board ?? {};
  const listBefore = action.data?.listBefore;
  const listAfter = action.data?.listAfter;
  const list = action.data?.list;
  const member = action.memberCreator?.username ?? null;

  const eventBase = {
    action_id: action.id,
    action_type: actionType,
    card_id: card.id ?? null,
    card_name: card.name ?? null,
    board_id: board.id ?? null,
    list_before_id: listBefore?.id ?? list?.id ?? null,
    list_before_name: listBefore?.name ?? null,
    list_after_id: listAfter?.id ?? list?.id ?? null,
    list_after_name: listAfter?.name ?? list?.name ?? null,
    member_username: member,
    raw_action: action,
  };

  // Rota 1: updateCard com movimento de lista → deferimento
  if (actionType === "updateCard" && listAfter) {
    return await processarMovimentoLista(eventBase, action);
  }

  // Rota 2: createCard → criação automática
  if (actionType === "createCard") {
    return await processarCriacaoCard(eventBase, action);
  }

  // Outros eventos: só audit log
  await admin.from("trello_card_events").insert({
    ...eventBase,
    acao_aplicada: "nao_relevante",
    acao_detalhe: `actionType=${actionType}`,
  } as any);
  return { acao: "nao_relevante" };
}

// ────────────────────────────────────────────────
// HTTP handler
// ────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method === "HEAD" || req.method === "GET") {
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

  const sigCheck = await verifySignature(req, rawBody);
  if (!sigCheck.valid) {
    console.warn("[trello-cards-events] invalid signature:", sigCheck.reason);
    return new Response("ok", { status: 200, headers: corsHeaders });
  }

  // @ts-ignore EdgeRuntime existe no Supabase Edge Runtime
  if (typeof EdgeRuntime !== "undefined" && EdgeRuntime?.waitUntil) {
    // @ts-ignore
    EdgeRuntime.waitUntil(processAction(payload));
  } else {
    processAction(payload).catch((e) => console.error("[trello-cards-events] async error:", e));
  }

  return new Response("ok", { status: 200, headers: corsHeaders });
});
