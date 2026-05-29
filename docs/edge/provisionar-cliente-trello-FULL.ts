// =============================================
// AUDIT-010 (29/05/2026): versionado do estado em produção
// versão capturada em 2026-05-29
// =============================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const TRELLO_KEY = Deno.env.get("TRELLO_API_KEY") ?? Deno.env.get("TRELLO_KEY") ?? "";
const TRELLO_TOKEN = Deno.env.get("TRELLO_TOKEN") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const ORG_NAME = "areadetrabalhodouser67159231";
const MODELO_PREFIX = "MODELO - CLIENTE NOVO";

async function trelloCall(method: string, path: string, params: Record<string, string> = {}) {
  const url = new URL(`https://api.trello.com${path}`);
  url.searchParams.set("key", TRELLO_KEY);
  url.searchParams.set("token", TRELLO_TOKEN);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return fetch(url.toString(), { method });
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  // Auth + role check
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

  const supaUser = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: authErr } = await supaUser.auth.getUser();
  if (authErr || !userData?.user) return json({ error: "Unauthorized" }, 401);

  const userId = userData.user.id;
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, empresa_id")
    .eq("id", userId)
    .single();

  if (!profile || !["master", "gerente"].includes(profile.role)) {
    return json({ error: "Permissão negada (somente master/gerente)" }, 403);
  }

  let body: { cliente_id?: string; cliente_nome?: string; cliente_codigo?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Body inválido" }, 400);
  }
  const { cliente_id, cliente_nome, cliente_codigo } = body;
  if (!cliente_id || !cliente_nome || !cliente_codigo) {
    return json({ error: "cliente_id, cliente_nome e cliente_codigo são obrigatórios" }, 400);
  }

  // Validate cliente belongs to user's empresa
  const { data: cliente } = await supabase
    .from("clientes")
    .select("id, empresa_id, trello_board_id")
    .eq("id", cliente_id)
    .single();
  if (!cliente || cliente.empresa_id !== profile.empresa_id) {
    return json({ error: "Cliente não encontrado" }, 404);
  }
  if (cliente.trello_board_id) {
    return json({ error: "Cliente já possui board provisionado" }, 400);
  }

  try {
    // 1. Buscar boards arquivados MODELO
    const listRes = await trelloCall(
      "GET",
      `/1/organizations/${ORG_NAME}/boards`,
      { filter: "closed", fields: "name,id,shortLink,url" },
    );
    if (!listRes.ok) {
      const t = await listRes.text();
      return json({ error: `Falha ao listar boards: ${t}` }, 500);
    }
    const boards: Array<{ id: string; name: string; shortLink: string; url: string }> = await listRes.json();
    const modelo = boards.find((b) => (b.name || "").toUpperCase().startsWith(MODELO_PREFIX));
    if (!modelo) {
      return json({
        success: false,
        error: "Sem boards MODELO disponíveis. Crie novos boards MODELO - CLIENTE NOVO_X e arquive-os.",
      }, 400);
    }

    // 2. Desarquivar
    const unarchive = await trelloCall("PUT", `/1/boards/${modelo.id}/closed`, { value: "false" });
    if (!unarchive.ok) {
      const t = await unarchive.text();
      return json({ error: `Falha ao desarquivar: ${t}` }, 500);
    }

    // 3. Renomear
    const novoNome = `${cliente_nome} - AVULSO - COD ${cliente_codigo}`.toUpperCase();
    const rename = await trelloCall("PUT", `/1/boards/${modelo.id}/name`, { value: novoNome });
    if (!rename.ok) {
      const t = await rename.text();
      return json({ error: `Falha ao renomear: ${t}` }, 500);
    }

    const board_url = `https://trello.com/b/${modelo.shortLink}/`;

    // 4. Salvar no banco
    const { error: updErr } = await supabase
      .from("clientes")
      .update({
        trello_board_id: modelo.id,
        trello_board_url: board_url,
        trello_provisionado_em: new Date().toISOString(),
      })
      .eq("id", cliente_id);
    if (updErr) {
      return json({ error: `Falha ao salvar no banco: ${updErr.message}` }, 500);
    }

    return json({ success: true, board_url, board_id: modelo.id, board_name: novoNome });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return json({ error: msg }, 500);
  }
});
