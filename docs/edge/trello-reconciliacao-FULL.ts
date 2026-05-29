// =============================================
// AUDIT-010 (29/05/2026): versionado do estado em produção
// versão capturada em 2026-05-29
// =============================================

import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";

interface TrelloBoard {
  id: string;
  name: string;
  closed: boolean;
}

interface TrelloList {
  id: string;
  name: string;
  closed: boolean;
}

interface TrelloCard {
  id: string;
  name: string;
  idBoard: string;
  idList: string;
  closed: boolean;
  url: string;
}

// Boards a ignorar por prefixo/conteúdo
const BOARD_IGNORE_PREFIXES = [
  "INTERNO",
  "MODELO",
  "PROCESSOS DR.",
  "PROCESOS DR.",
  "AUTOMAÇÃO",
  "AUTOMACAO",
];
const BOARD_IGNORE_CONTAINS = [
  "SUA ÁREA DE TRABALHO",
  "SUA AREA DE TRABALHO",
  "RONALDO - MS",
];

// Listas (colunas) a ignorar dentro de boards válidos
const LIST_IGNORE_CONTAINS = [
  "CONTROLE INTERNO",
  "SOLICITAR UM PROCESSO",
  "SOLICITAR PROCESSO",
  "INFORMAÇÕES CONTABILIDADE",
  "INFORMACOES CONTABILIDADE",
  "MODELOS",
];

// Cards (templates) a ignorar
const CARD_IGNORE_EXACT = [
  "LINK OFICIAL DO NOSSO FORMULÁRIO INTEGRADO",
  "LINK OFICIAL DO NOSSO FORMULARIO INTEGRADO",
  "DADOS DA CONTABILIDADE",
  "CERTIFICADO DIGITAL",
  "FORMULÁRIO CRM",
  "FORMULARIO CRM",
];
const CARD_IGNORE_PREFIXES = ["COD CLIENTE"];

function normalizeUpper(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .trim();
}

function shouldIgnoreBoard(name: string): boolean {
  const n = normalizeUpper(name);
  if (BOARD_IGNORE_PREFIXES.some((p) => n.startsWith(p))) return true;
  if (BOARD_IGNORE_CONTAINS.some((c) => n.includes(c))) return true;
  return false;
}

function isValidBoard(name: string): boolean {
  // Tem código de cliente (6 dígitos)
  if (/\b\d{6}\b/.test(name)) return true;
  // Ou tem tipo AVULSO/MENSAL no nome
  const n = normalizeUpper(name);
  if (/\b(AVULSO|MENSAL|MENSALISTA)\b/.test(n)) return true;
  return false;
}

function shouldIgnoreList(name: string): boolean {
  const n = normalizeUpper(name);
  return LIST_IGNORE_CONTAINS.some((c) => n.includes(c));
}

function shouldIgnoreCard(name: string): boolean {
  const n = normalizeUpper(name);
  if (CARD_IGNORE_EXACT.includes(n)) return true;
  if (CARD_IGNORE_PREFIXES.some((p) => n.startsWith(p))) return true;
  return false;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get("TRELLO_API_KEY")?.trim();
    const token = Deno.env.get("TRELLO_TOKEN")?.trim();

    if (!apiKey || !token) {
      return new Response(
        JSON.stringify({ error: "Trello credentials not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const auth = `key=${apiKey}&token=${token}`;

    // 1. Fetch all boards
    const boardsRes = await fetch(
      `https://api.trello.com/1/members/me/boards?fields=id,name,closed&filter=open&${auth}`
    );
    if (!boardsRes.ok) {
      const text = await boardsRes.text();
      throw new Error(`Trello boards fetch failed [${boardsRes.status}]: ${text}`);
    }
    const allBoards: TrelloBoard[] = await boardsRes.json();

    // 2. Filtrar boards: abertos + não-ignorados + válidos (com código ou tipo)
    const validBoards = allBoards.filter(
      (b) => !b.closed && !shouldIgnoreBoard(b.name) && isValidBoard(b.name)
    );

    // 3. Para cada board válido, buscar listas + cards (paralelo)
    const cardsByBoard = await Promise.all(
      validBoards.map(async (board) => {
        const [listsRes, cardsRes] = await Promise.all([
          fetch(`https://api.trello.com/1/boards/${board.id}/lists?fields=id,name,closed&${auth}`),
          fetch(`https://api.trello.com/1/boards/${board.id}/cards?fields=id,name,idBoard,idList,closed,url&${auth}`),
        ]);

        if (!listsRes.ok || !cardsRes.ok) return { board, cards: [] as TrelloCard[] };

        const lists: TrelloList[] = await listsRes.json();
        const cards: TrelloCard[] = await cardsRes.json();

        // IDs de listas a ignorar
        const ignoredListIds = new Set(
          lists.filter((l) => shouldIgnoreList(l.name)).map((l) => l.id)
        );

        const filteredCards = cards.filter(
          (c) =>
            !c.closed &&
            !ignoredListIds.has(c.idList) &&
            !shouldIgnoreCard(c.name)
        );

        return { board, cards: filteredCards };
      })
    );

    return new Response(
      JSON.stringify({
        boards: validBoards,
        cardsByBoard: cardsByBoard.map(({ board, cards }) => ({
          boardId: board.id,
          boardName: board.name,
          cards,
        })),
        totalBoards: validBoards.length,
        totalCards: cardsByBoard.reduce((sum, b) => sum + b.cards.length, 0),
        ignoredBoards: allBoards.length - validBoards.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("trello-reconciliacao error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
