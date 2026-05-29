// =============================================
// Edge Function: trello-cards-pendentes
// =============================================
// FEATURE 29/05/2026: lista cards do board Trello de um cliente que ainda
// NÃO foram linkados a processos do ERP. Usado pela página
// /admin/trello-cards-pendentes pra revisão manual dos 26 ambíguos +
// 4 sem_match que sobraram do backfill automático.
//
// Recebe { board_id }. Retorna:
//  - cards: lista de cards não-arquivados do board (não-linkados)
//  - cards_linkados: ids dos cards já linkados a algum processo (pra UI
//    poder filtrar/desabilitar)
//
// AUTH: master/gerente
// =============================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

const TRELLO_KEY = Deno.env.get("TRELLO_API_KEY") ?? Deno.env.get("TRELLO_KEY") ?? "";
const TRELLO_TOKEN = Deno.env.get("TRELLO_TOKEN") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Score de similaridade por palavras em comum (mesmo do trello-setup-boards)
function normalize(s: string): string {
  return (s || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
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

// AUDIT-025 (29/05/2026): AbortController 10s pra evitar travar wall-time
const TRELLO_FETCH_TIMEOUT_MS = 10_000;

async function trelloGet<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(`https://api.trello.com${path}`);
  url.searchParams.set("key", TRELLO_KEY);
  url.searchParams.set("token", TRELLO_TOKEN);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

  const ctrl = new AbortController();
  const timeoutId = setTimeout(() => ctrl.abort(), TRELLO_FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url.toString(), { signal: ctrl.signal });
    if (!res.ok) {
      const txt = await res.text();
      throw new Error(`Trello ${path} ${res.status}: ${txt.substring(0, 200)}`);
    }
    return await res.json();
  } catch (e: any) {
    if (e?.name === "AbortError") {
      throw new Error(`Trello timeout ${TRELLO_FETCH_TIMEOUT_MS}ms em ${path}`);
    }
    throw e;
  } finally {
    clearTimeout(timeoutId);
  }
}

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

  // Auth master/gerente
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
  if (!profile || !profile.ativo || !["master", "gerente"].includes(profile.role)) {
    return new Response(JSON.stringify({ error: "apenas master/gerente" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!TRELLO_KEY || !TRELLO_TOKEN) {
    return new Response(JSON.stringify({ error: "TRELLO_API_KEY/TRELLO_TOKEN ausentes" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let body: any = {};
  try { body = await req.json(); } catch { /* empty */ }
  const boardId = body.board_id as string | undefined;
  const processoId = body.processo_id as string | undefined;

  if (!boardId) {
    return new Response(JSON.stringify({ error: "board_id obrigatório" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    // 1) Cards do board (só não-arquivados)
    const allCards = await trelloGet<any[]>(`/1/boards/${boardId}/cards`, {
      fields: "id,name,url,idList,closed,due,desc",
      limit: "1000",
    });
    const openCards = allCards.filter((c) => !c.closed);

    // 2) Listas do board pra UI mostrar onde cada card está
    const lists = await trelloGet<any[]>(`/1/boards/${boardId}/lists`, {
      filter: "open",
      fields: "id,name",
    });
    const listById = new Map<string, string>(lists.map((l) => [l.id, l.name]));

    // 3) Cards já linkados a algum processo (pra UI poder destacar/filtrar)
    const cardIds = openCards.map((c) => c.id);
    const { data: linkados } = await admin
      .from("processos")
      .select("id, trello_card_id, tipo, razao_social")
      .in("trello_card_id", cardIds.length > 0 ? cardIds : [""]);
    const linkadosMap = new Map<string, { processo_id: string; tipo: string; razao_social: string }>();
    for (const p of (linkados || []) as any[]) {
      linkadosMap.set(p.trello_card_id, {
        processo_id: p.id,
        tipo: p.tipo,
        razao_social: p.razao_social,
      });
    }

    // 4) Se veio processo_id, busca dados pra calcular score de candidato
    //    (UI vai sortar candidatos pela relevância)
    let processoInfo: any = null;
    if (processoId) {
      const { data: proc } = await admin
        .from("processos")
        .select("id, tipo, razao_social")
        .eq("id", processoId)
        .single();
      processoInfo = proc;
    }

    // 5) Enriquece cards com:
    //    - lista atual (nome)
    //    - se está linkado a outro processo
    //    - score de similaridade com o processo alvo (se veio processo_id)
    const cardsEnriched = openCards.map((c) => {
      const linkado = linkadosMap.get(c.id);
      let score = 0;
      if (processoInfo) {
        const tipo = (processoInfo.tipo as string).toUpperCase();
        const nomeUpper = (c.name as string).toUpperCase();
        const tipoMatch = nomeUpper.includes(tipo) ? 1 : 0;
        const refMatch = processoInfo.razao_social
          ? similarity(c.name, processoInfo.razao_social)
          : 0;
        score = tipoMatch + refMatch;
      }
      return {
        id: c.id,
        name: c.name,
        url: c.url,
        list_id: c.idList,
        list_name: listById.get(c.idList) ?? "(lista removida)",
        due: c.due,
        ja_linkado_a: linkado ?? null,
        score,
      };
    });

    // Sort: maior score primeiro (candidatos mais relevantes no topo)
    cardsEnriched.sort((a, b) => b.score - a.score);

    return new Response(JSON.stringify({
      ok: true,
      board_id: boardId,
      total_cards: openCards.length,
      cards_ja_linkados: linkadosMap.size,
      cards_disponiveis: openCards.length - linkadosMap.size,
      cards: cardsEnriched,
      lists: lists.map((l) => ({ id: l.id, name: l.name })),
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("[trello-cards-pendentes] error:", e);
    return new Response(JSON.stringify({ error: String(e?.message ?? e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
