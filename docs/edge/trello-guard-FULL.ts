// =============================================
// AUDIT-010 (29/05/2026): versionado do estado em produção
// versão capturada em 2026-05-29
// =============================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-trello-webhook",
  "Access-Control-Allow-Methods": "GET, POST, HEAD, OPTIONS",
};

const MASTER_USER = "trevolegaliza"; // único admin total

const TRELLO_KEY = Deno.env.get("TRELLO_API_KEY") ?? Deno.env.get("TRELLO_KEY") ?? "";
const TRELLO_TOKEN = Deno.env.get("TRELLO_TOKEN") ?? "";
const TRELLO_SECRET = Deno.env.get("TRELLO_SECRET") ?? "";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// In-memory whitelist cache (60s TTL)
let whitelistCache: { staff: Set<string>; ts: number } | null = null;
const CACHE_TTL_MS = 60_000;

async function getWhitelist(): Promise<{ master: string; staff: Set<string> }> {
  if (whitelistCache && Date.now() - whitelistCache.ts < CACHE_TTL_MS) {
    return { master: MASTER_USER, staff: whitelistCache.staff };
  }
  const { data, error } = await supabase
    .from("colaboradores")
    .select("trello_username")
    .eq("status", "ativo")
    .not("trello_username", "is", null);

  if (error) console.error("getWhitelist error:", error.message);

  const staff = new Set<string>();
  for (const c of (data || [])) {
    const u = ((c as any).trello_username || "").trim().toLowerCase();
    if (u) staff.add(u);
  }
  // Master também pode tudo que staff pode
  staff.add(MASTER_USER);
  whitelistCache = { staff, ts: Date.now() };
  return { master: MASTER_USER, staff };
}

async function trelloCall(method: string, path: string, params: Record<string, string> = {}) {
  const url = new URL(`https://api.trello.com${path}`);
  url.searchParams.set("key", TRELLO_KEY);
  url.searchParams.set("token", TRELLO_TOKEN);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return fetch(url.toString(), { method });
}

async function commentCard(cardId: string, text: string) {
  return trelloCall("POST", `/1/cards/${cardId}/actions/comments`, { text });
}

async function logAction(entry: {
  action_type: string;
  board_id?: string;
  board_name?: string;
  card_id?: string;
  card_name?: string;
  member_username?: string;
  was_reverted: boolean;
  revert_detail?: string;
  raw_action: unknown;
}) {
  try {
    await supabase.from("trello_guard_logs").insert(entry);
  } catch (e) {
    console.error("Failed to log:", e);
  }
}

// Comparação resistente a timing attacks (audit fix #12)
function timingSafeEqual(a: string, b: string): boolean {
  const len = Math.max(a.length, b.length);
  let diff = a.length ^ b.length;
  for (let i = 0; i < len; i++) {
    diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  }
  return diff === 0;
}

// Trello assina webhooks com HMAC-SHA1 (limitação documentada da API deles).
// Não dá pra mudar pra SHA-256 sem que eles emitam o header diferente.
// O que blindamos: comparação timing-safe + fail-closed quando secret ausente.
async function verifySignature(req: Request, rawBody: string): Promise<boolean> {
  if (!TRELLO_SECRET) {
    // FAIL-CLOSED (audit fix #12): sem secret, recusa tudo em vez de passar
    console.error(
      "[trello-guard] CRITICAL: TRELLO_SECRET não configurado; rejeitando webhook",
    );
    return false;
  }
  const signature = req.headers.get("x-trello-webhook");
  if (!signature) return false;
  const callbackUrl = `${SUPABASE_URL}/functions/v1/trello-guard`;
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

async function processAction(payload: any) {
  const action = payload?.action;
  if (!action) return;

  const type: string = action.type;
  const username: string = (action.memberCreator?.username ?? "").toLowerCase();
  const board = action.data?.board ?? {};
  const card = action.data?.card ?? {};

  const baseLog = {
    action_type: type,
    board_id: board.id,
    board_name: board.name,
    card_id: card.id,
    card_name: card.name,
    member_username: username,
    raw_action: action,
  };

  try {
    const { master, staff } = await getWhitelist();
    const isMaster = username === master;
    const isStaff = staff.has(username);

    // 1. createCard — staff (e master) podem
    if (type === "createCard" && !isStaff) {
      const r = await trelloCall("PUT", `/1/cards/${card.id}/closed`, { value: "true" });
      await commentCard(
        card.id,
        `⚠️ Cartão arquivado — usuário (@${username}) não autorizado a criar.`,
      );
      await logAction({ ...baseLog, was_reverted: r.ok, revert_detail: `archived (status ${r.status})` });
      return;
    }

    // 2. updateCard — movimento entre listas (staff e master podem)
    if (type === "updateCard" && action.data?.listBefore && action.data?.listAfter && !isStaff) {
      const r = await trelloCall("PUT", `/1/cards/${card.id}/idList`, {
        value: action.data.listBefore.id,
      });
      await commentCard(
        card.id,
        `⚠️ Movimento revertido — usuário (@${username}) não autorizado.`,
      );
      await logAction({
        ...baseLog,
        was_reverted: r.ok,
        revert_detail: `moved back to ${action.data.listBefore.name} (status ${r.status})`,
      });
      return;
    }

    // 3. updateCard — arquivamento (closed: false → true) — APENAS master
    if (
      type === "updateCard" &&
      action.data?.old?.closed === false &&
      action.data?.card?.closed === true &&
      !isMaster
    ) {
      const r = await trelloCall("PUT", `/1/cards/${card.id}/closed`, { value: "false" });
      await commentCard(card.id, `Somente o admim pode arquivar cartões`);
      await logAction({ ...baseLog, was_reverted: r.ok, revert_detail: `unarchived (status ${r.status})` });
      return;
    }

    // 4. createLabel — APENAS master
    if (type === "createLabel" && !isMaster) {
      const labelId = action.data?.label?.id;
      if (labelId) {
        const r = await trelloCall("DELETE", `/1/labels/${labelId}`);
        await logAction({
          ...baseLog,
          was_reverted: r.ok,
          revert_detail: `label deleted ${labelId} (status ${r.status})`,
        });
      }
      return;
    }

    // 5. deleteAttachmentFromCard — staff (e master) podem; outros só comentam
    if (type === "deleteAttachmentFromCard" && !isStaff) {
      await commentCard(
        card.id,
        `⚠️ @${username} deletou anexo sem permissão.`,
      );
      await logAction({
        ...baseLog,
        was_reverted: false,
        revert_detail: "attachment cannot be recovered, only commented",
      });
      return;
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("processAction error:", msg);
    await logAction({ ...baseLog, was_reverted: false, revert_detail: `ERROR: ${msg}` });
  }
}

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

  const valid = await verifySignature(req, rawBody);
  if (!valid) {
    console.warn("Invalid Trello webhook signature");
    return new Response("ok", { status: 200, headers: corsHeaders });
  }

  processAction(payload).catch((e) => console.error("async processAction:", e));

  return new Response("ok", { status: 200, headers: corsHeaders });
});
