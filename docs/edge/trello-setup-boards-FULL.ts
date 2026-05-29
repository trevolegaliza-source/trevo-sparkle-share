// =============================================
// Edge Function: trello-setup-boards
// =============================================
// FEATURE 29/05/2026: one-shot admin pra linkar Trello ↔ ERP
//
// Hoje 0 de 51 clientes têm trello_board_id no ERP, e nenhum processo tem
// trello_card_id. A integração Trello existe (provisioner+guard rodando há
// meses) mas o link "ID lado ERP ↔ ID lado Trello" nunca foi feito.
//
// Esta edge faz isso em 3 modos (controle via body):
//
//  { mode: "dry_run" }
//    → Lista boards da workspace + cards de cada board
//    → Propõe match com clientes (por nome fuzzy) e processos (por nome+tipo)
//    → NÃO escreve nada no banco. Retorna JSON pro Thales aprovar.
//
//  { mode: "link_boards", board_to_cliente: { "board_id": "cliente_uuid", ... } }
//    → Aplica os links manualmente confirmados pelo Thales
//    → UPDATE clientes.trello_board_id
//
//  { mode: "link_cards", auto_match: true }
//    → Pra cada board já linkado, puxa cards e tenta match com processos
//    → UPDATE processos.trello_card_id em massa
//    → (auto_match=false ainda não implementado — exigiria UI de revisão)
//
//  { mode: "register_webhooks" }
//    → Pra cada board com trello_board_id, registra webhook do
//      trello-cards-events. Idempotente (Trello recusa duplicata).
//
// AUTH: requer role 'master' (mais restritivo que outras edges porque
// mexe em massa em dados do banco).
// =============================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const TRELLO_KEY = Deno.env.get("TRELLO_API_KEY") ?? Deno.env.get("TRELLO_KEY") ?? "";
const TRELLO_TOKEN = Deno.env.get("TRELLO_TOKEN") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const CARDS_EVENTS_URL = `${SUPABASE_URL}/functions/v1/trello-cards-events`;

// ────────────────────────────────────────────────
// Trello API helpers
// ────────────────────────────────────────────────
// AUDIT-025 (29/05/2026): AbortController 10s pra cada fetch Trello.
// Setup roda em loop por todos boards — se algum board travar, sem timeout
// a edge inteira fica pendurada até wall-time 400s.
const TRELLO_FETCH_TIMEOUT_MS = 10_000;

async function trelloCall(method: string, path: string, params: Record<string, string> = {}) {
  const url = new URL(`https://api.trello.com${path}`);
  url.searchParams.set("key", TRELLO_KEY);
  url.searchParams.set("token", TRELLO_TOKEN);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

  const ctrl = new AbortController();
  const timeoutId = setTimeout(() => ctrl.abort(), TRELLO_FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url.toString(), { method, signal: ctrl.signal });
    return res;
  } catch (e: any) {
    if (e?.name === "AbortError") {
      throw new Error(`Trello timeout ${TRELLO_FETCH_TIMEOUT_MS}ms em ${method} ${path}`);
    }
    throw e;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function trelloGet<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const res = await trelloCall("GET", path, params);
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Trello ${path} ${res.status}: ${txt.substring(0, 200)}`);
  }
  return res.json();
}

// ────────────────────────────────────────────────
// Normalização de nomes pra matching fuzzy
// ────────────────────────────────────────────────
function normalize(s: string): string {
  return (s || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Similaridade básica por palavras em comum (fallback quando match por
// código não existe)
function similarity(a: string, b: string): number {
  const na = normalize(a);
  const nb = normalize(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  if (na.includes(nb) || nb.includes(na)) return 0.85;

  const setA = new Set(na.split(" ").filter((w) => w.length > 2));
  const setB = new Set(nb.split(" ").filter((w) => w.length > 2));
  if (setA.size === 0 || setB.size === 0) return 0;
  let inter = 0;
  for (const w of setA) if (setB.has(w)) inter++;
  return inter / Math.max(setA.size, setB.size);
}

// FEATURE 29/05/2026 — Thales descobriu que o nome do board sempre tem o
// codigo_identificador do cliente (XXX.XXX no ERP vira XXXXXX no board).
// Match por código é 100% confiável vs heurística fuzzy por nome.
// Regex: sequências isoladas de 5-7 dígitos (cobre 6 dig do padrão atual
// + tolerância pra códigos que possam variar).
function extractCodigosFromBoard(boardName: string): string[] {
  const matches = boardName.match(/\b\d{5,7}\b/g) || [];
  return matches;
}

// Codigo limpo (só dígitos) pra comparar com extracted
function codigoSomenteDigitos(codigo: string | null | undefined): string {
  return (codigo ?? "").replace(/\D/g, "");
}

// ────────────────────────────────────────────────
// Modo: dry_run
// ────────────────────────────────────────────────
async function modeDryRun() {
  // 1) Lista boards da workspace (não arquivados)
  const boards = await trelloGet<any[]>("/1/members/me/boards", {
    filter: "open",
    fields: "id,name,url,idOrganization",
  });

  // 2) Clientes do ERP (com codigo_identificador pra match por código)
  const { data: clientes } = await admin
    .from("clientes")
    .select("id, nome, apelido, codigo_identificador, trello_board_id");
  const clientesArr = (clientes || []) as any[];

  // Index pra lookup rápido por código (digits only)
  const clientesPorCodigo = new Map<string, any>();
  for (const c of clientesArr) {
    const cod = codigoSomenteDigitos(c.codigo_identificador);
    if (cod) clientesPorCodigo.set(cod, c);
  }

  // 3) Propor match (prioridade: código exato > nome similar)
  const propostas: any[] = [];
  for (const b of boards) {
    const codigosDoBoard = extractCodigosFromBoard(b.name);

    // PRIORIDADE 1: match por código (100% confiável)
    let matchCodigo: any = null;
    for (const cod of codigosDoBoard) {
      const cli = clientesPorCodigo.get(cod);
      if (cli) {
        matchCodigo = {
          cliente_id: cli.id,
          cliente_nome: cli.nome,
          cliente_apelido: cli.apelido,
          codigo_identificador: cli.codigo_identificador,
          codigo_encontrado: cod,
          ja_linkado_outro: cli.trello_board_id && cli.trello_board_id !== b.id,
        };
        break;
      }
    }

    if (matchCodigo) {
      propostas.push({
        board_id: b.id,
        board_name: b.name,
        board_url: b.url,
        metodo_match: "codigo_identificador",
        match: matchCodigo,
        sugestao: { cliente_id: matchCodigo.cliente_id, confianca: "altissima" },
      });
      continue;
    }

    // PRIORIDADE 2: fallback fuzzy por nome (versão antiga)
    const candidatos = clientesArr
      .map((c) => ({
        cliente_id: c.id,
        cliente_nome: c.nome,
        cliente_apelido: c.apelido,
        score_nome: similarity(b.name, c.nome),
        score_apelido: c.apelido ? similarity(b.name, c.apelido) : 0,
        ja_linkado_outro: c.trello_board_id && c.trello_board_id !== b.id,
      }))
      .map((x) => ({ ...x, score: Math.max(x.score_nome, x.score_apelido) }))
      .filter((x) => x.score > 0.5)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);

    propostas.push({
      board_id: b.id,
      board_name: b.name,
      board_url: b.url,
      metodo_match: "fuzzy_nome",
      codigos_extraidos: codigosDoBoard,
      candidatos_top3: candidatos,
      sugestao: candidatos[0] && candidatos[0].score >= 0.85
        ? { cliente_id: candidatos[0].cliente_id, confianca: "alta" }
        : candidatos[0] && candidatos[0].score >= 0.7
        ? { cliente_id: candidatos[0].cliente_id, confianca: "media" }
        : null,
    });
  }

  const matchsCodigo = propostas.filter((p) => p.metodo_match === "codigo_identificador").length;
  const matchsNome = propostas.filter((p) => p.metodo_match === "fuzzy_nome" && p.sugestao).length;
  const semMatch = propostas.filter((p) => !p.sugestao).length;

  return {
    mode: "dry_run",
    total_boards_trello: boards.length,
    total_clientes_erp: clientesArr.length,
    clientes_ja_linkados: clientesArr.filter((c) => c.trello_board_id).length,
    resumo: {
      por_codigo_100pct: matchsCodigo,
      por_nome_fuzzy: matchsNome,
      sem_match: semMatch,
    },
    propostas,
    proximo_passo: 'Pra aplicar TODOS os matches "altissima" (código exato), use {mode:"link_boards_auto"}. Pra escolher manualmente, use {mode:"link_boards", board_to_cliente:{...}}.',
  };
}

// ────────────────────────────────────────────────
// Modo: link_boards_auto (aplica só matches altissima — código exato)
// ────────────────────────────────────────────────
async function modeLinkBoardsAuto() {
  // Reutiliza dryRun pra encontrar matches por código
  const dryRun: any = await modeDryRun();
  const altissimas = (dryRun.propostas as any[]).filter(
    (p) => p.sugestao?.confianca === "altissima" && !p.match?.ja_linkado_outro,
  );

  const results: any[] = [];
  for (const p of altissimas) {
    try {
      const { error } = await admin
        .from("clientes")
        .update({
          trello_board_id: p.board_id,
          trello_board_url: p.board_url,
          trello_provisionado_em: new Date().toISOString(),
        } as any)
        .eq("id", p.match.cliente_id);

      results.push({
        board_id: p.board_id,
        board_name: p.board_name,
        cliente_id: p.match.cliente_id,
        cliente_nome: p.match.cliente_apelido || p.match.cliente_nome,
        codigo: p.match.codigo_encontrado,
        status: error ? "erro" : "linkado",
        erro: error?.message,
      });
    } catch (e: any) {
      results.push({
        board_id: p.board_id,
        cliente_id: p.match.cliente_id,
        status: "erro",
        erro: String(e?.message ?? e),
      });
    }
  }

  return {
    mode: "link_boards_auto",
    total_aplicado: results.filter((r) => r.status === "linkado").length,
    total_erros: results.filter((r) => r.status === "erro").length,
    results,
  };
}

// ────────────────────────────────────────────────
// Modo: link_boards (aplica map confirmado pelo Thales)
// ────────────────────────────────────────────────
async function modeLinkBoards(boardToCliente: Record<string, string>) {
  const results: any[] = [];
  for (const [boardId, clienteId] of Object.entries(boardToCliente)) {
    try {
      // Confirma que board existe e busca URL
      const board = await trelloGet<any>(`/1/boards/${boardId}`, { fields: "name,url" });

      const { error } = await admin
        .from("clientes")
        .update({
          trello_board_id: boardId,
          trello_board_url: board.url,
          trello_provisionado_em: new Date().toISOString(),
        } as any)
        .eq("id", clienteId);

      if (error) {
        results.push({ board_id: boardId, cliente_id: clienteId, status: "erro", erro: error.message });
      } else {
        results.push({ board_id: boardId, cliente_id: clienteId, board_name: board.name, status: "linkado" });
      }
    } catch (e: any) {
      results.push({ board_id: boardId, cliente_id: clienteId, status: "erro", erro: String(e?.message ?? e) });
    }
  }
  return { mode: "link_boards", results, total: results.length };
}

// ────────────────────────────────────────────────
// Modo: link_cards (auto_match: linka cards aos processos)
// ────────────────────────────────────────────────
async function modeLinkCards() {
  const { data: clientes } = await admin
    .from("clientes")
    .select("id, nome, apelido, trello_board_id")
    .not("trello_board_id", "is", null);
  const clientesArr = (clientes || []) as any[];

  const results: any[] = [];

  for (const cliente of clientesArr) {
    try {
      const cards = await trelloGet<any[]>(`/1/boards/${cliente.trello_board_id}/cards`, {
        fields: "id,name,url,idList,closed",
        limit: "1000",
      });

      const { data: processos } = await admin
        .from("processos")
        .select("id, tipo, razao_social, trello_card_id")
        .eq("cliente_id", cliente.id);
      const procArr = (processos || []) as any[];

      let linkados = 0;
      let ambíguos = 0;
      let sem_match = 0;

      for (const proc of procArr) {
        if (proc.trello_card_id) continue; // já linkado

        // Heurística: card.name contém o tipo (ABERTURA/ALTERAÇÃO/...) + razao_social do processo
        // (geralmente o card é nomeado como "ABERTURA - EMPRESA XYZ LTDA")
        const tipo = (proc.tipo as string).toUpperCase();
        const candidatos = cards
          .filter((c) => !c.closed)
          .map((c) => {
            const nomeUpper = (c.name as string).toUpperCase();
            const tipoMatch = nomeUpper.includes(tipo);
            const refMatch = proc.razao_social
              ? similarity(c.name, proc.razao_social) > 0.5
              : false;
            return { card: c, score: (tipoMatch ? 1 : 0) + (refMatch ? 1 : 0) };
          })
          .filter((x) => x.score > 0)
          .sort((a, b) => b.score - a.score);

        if (candidatos.length === 0) {
          sem_match++;
        } else if (candidatos.length > 1 && candidatos[0].score === candidatos[1].score) {
          ambíguos++;
        } else {
          const card = candidatos[0].card;
          const { error } = await admin
            .from("processos")
            .update({
              trello_card_id: card.id,
              trello_card_url: card.url,
              trello_card_linked_em: new Date().toISOString(),
            } as any)
            .eq("id", proc.id);
          if (!error) linkados++;
        }
      }

      results.push({
        cliente_id: cliente.id,
        cliente_nome: cliente.apelido || cliente.nome,
        board_id: cliente.trello_board_id,
        total_processos: procArr.length,
        cards_no_board: cards.length,
        linkados,
        ambiguos: ambíguos,
        sem_match,
      });
    } catch (e: any) {
      results.push({
        cliente_id: cliente.id,
        cliente_nome: cliente.apelido || cliente.nome,
        status: "erro",
        erro: String(e?.message ?? e),
      });
    }
  }

  return { mode: "link_cards", results, total_clientes: clientesArr.length };
}

// ────────────────────────────────────────────────
// Modo: register_webhooks
// ────────────────────────────────────────────────
async function modeRegisterWebhooks() {
  const { data: clientes } = await admin
    .from("clientes")
    .select("id, nome, apelido, trello_board_id")
    .not("trello_board_id", "is", null);
  const clientesArr = (clientes || []) as any[];

  const results: any[] = [];

  for (const cliente of clientesArr) {
    try {
      const res = await trelloCall("POST", "/1/webhooks", {
        callbackURL: CARDS_EVENTS_URL,
        idModel: cliente.trello_board_id,
        description: `trello-cards-events for ${cliente.apelido || cliente.nome}`,
      });
      const txt = await res.text();

      if (res.ok) {
        results.push({
          cliente_id: cliente.id,
          board_id: cliente.trello_board_id,
          status: "registrado",
        });
      } else if (txt.includes("already exists") || txt.includes("já existe")) {
        results.push({
          cliente_id: cliente.id,
          board_id: cliente.trello_board_id,
          status: "ja_existia",
        });
      } else {
        results.push({
          cliente_id: cliente.id,
          board_id: cliente.trello_board_id,
          status: "erro",
          http: res.status,
          erro: txt.substring(0, 200),
        });
      }
    } catch (e: any) {
      results.push({
        cliente_id: cliente.id,
        board_id: cliente.trello_board_id,
        status: "erro",
        erro: String(e?.message ?? e),
      });
    }
  }

  return { mode: "register_webhooks", results, total: results.length };
}

// ────────────────────────────────────────────────
// HTTP handler
// ────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "POST only" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Auth: requer master
  const authHeader = req.headers.get("Authorization") || "";
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "auth obrigatório" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) {
    return new Response(JSON.stringify({ error: "sessão inválida" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const { data: profile } = await admin
    .from("profiles")
    .select("role, ativo")
    .eq("id", user.id)
    .single();
  if (!profile || !profile.ativo || profile.role !== "master") {
    return new Response(JSON.stringify({ error: "apenas master" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!TRELLO_KEY || !TRELLO_TOKEN) {
    return new Response(JSON.stringify({ error: "TRELLO_API_KEY/TRELLO_TOKEN ausente nos secrets" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let body: any = {};
  try { body = await req.json(); } catch { /* empty */ }
  const mode = body.mode as string;

  try {
    let result;
    switch (mode) {
      case "dry_run":
        result = await modeDryRun();
        break;
      case "link_boards":
        if (!body.board_to_cliente || typeof body.board_to_cliente !== "object") {
          return new Response(JSON.stringify({ error: 'board_to_cliente obrigatório (object {board_id: cliente_uuid})' }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        result = await modeLinkBoards(body.board_to_cliente);
        break;
      case "link_boards_auto":
        result = await modeLinkBoardsAuto();
        break;
      case "link_cards":
        result = await modeLinkCards();
        break;
      case "register_webhooks":
        result = await modeRegisterWebhooks();
        break;
      default:
        return new Response(JSON.stringify({
          error: "mode inválido",
          modos_validos: ["dry_run", "link_boards", "link_boards_auto", "link_cards", "register_webhooks"],
        }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    return new Response(JSON.stringify(result, null, 2), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("[trello-setup-boards] error:", e);
    return new Response(JSON.stringify({ error: String(e?.message ?? e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
