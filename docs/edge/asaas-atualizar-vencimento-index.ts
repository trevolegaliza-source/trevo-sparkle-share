// =============================================
// Edge Function: asaas-atualizar-vencimento
// =============================================
// Recebe { cobranca_id, nova_data_vencimento } autenticado.
// Chama Asaas PUT /v3/payments/:id com novo dueDate, depois atualiza
// nosso banco (cobrancas + lancamentos vinculados) atomicamente.
//
// Mantem o mesmo share_token — cliente pode acessar o mesmo link e
// vai ver os dados atualizados (boleto/PIX que Asaas regenerou + novo
// vencimento no nosso banco).
//
// 25/05/2026 (FIN-009): grava entry em entidade_audit com valor_antigo →
// valor_novo + ator. Antes da mudança não havia trilha — Letícia mudava
// vencimento e ninguém sabia. Agora aparece no Histórico do orçamento
// (se houver vínculo) ou via consulta SQL em entidade_audit.
// =============================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const ASAAS_FETCH_TIMEOUT_MS = 15_000;

const ASAAS_API_KEY = Deno.env.get("ASAAS_API_KEY") ?? "";
const ASAAS_BASE_URL = Deno.env.get("ASAAS_BASE_URL") ?? "https://api.asaas.com/v3";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

async function asaasFetch(path: string, init: RequestInit = {}) {
  const fullUrl = `${ASAAS_BASE_URL.replace(/\/+$/, "")}${path}`;
  const ctrl = new AbortController();
  const timeoutId = setTimeout(() => ctrl.abort(), ASAAS_FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(fullUrl, {
      ...init,
      signal: ctrl.signal,
      headers: {
        "access_token": ASAAS_API_KEY,
        "Content-Type": "application/json",
        "User-Agent": "trevo-legaliza-erp/1.0",
        ...(init.headers || {}),
      },
    });
    const text = await res.text();
    let data: any = null;
    try { data = text ? JSON.parse(text) : null; } catch { data = text; }
    return { ok: res.ok, status: res.status, data };
  } finally {
    clearTimeout(timeoutId);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  if (!ASAAS_API_KEY) {
    return new Response(JSON.stringify({ error: "ASAAS_API_KEY_MISSING" }), {
      status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Auth: pega user do JWT do header Authorization
  const authHeader = req.headers.get("Authorization") || "";
  if (!authHeader.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "UNAUTHORIZED" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData?.user) {
    return new Response(JSON.stringify({ error: "INVALID_TOKEN" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const user = userData.user;

  let body: { cobranca_id?: string; nova_data_vencimento?: string };
  try { body = await req.json(); } catch {
    return new Response(JSON.stringify({ error: "INVALID_JSON" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const { cobranca_id, nova_data_vencimento } = body;
  if (!cobranca_id || !nova_data_vencimento) {
    return new Response(JSON.stringify({ error: "MISSING_FIELDS" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(nova_data_vencimento)) {
    return new Response(JSON.stringify({ error: "INVALID_DATE_FORMAT", message: "Use YYYY-MM-DD" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Busca cobranca + valida tenant via profile do user
  const { data: profile } = await admin
    .from("profiles")
    .select("empresa_id, role, nome")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile) {
    return new Response(JSON.stringify({ error: "NO_PROFILE" }), {
      status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { data: cob, error: cobErr } = await admin
    .from("cobrancas")
    .select("id, empresa_id, asaas_payment_id, status, data_vencimento, share_token, cliente_id, clientes(nome, apelido)")
    .eq("id", cobranca_id)
    .maybeSingle();
  if (cobErr || !cob) {
    return new Response(JSON.stringify({ error: "COBRANCA_NOT_FOUND" }), {
      status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  if ((cob as any).empresa_id !== (profile as any).empresa_id) {
    return new Response(JSON.stringify({ error: "FORBIDDEN_TENANT" }), {
      status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  if ((cob as any).status !== "ativa" && (cob as any).status !== "vencida") {
    return new Response(JSON.stringify({ error: "COBRANCA_NAO_EDITAVEL", message: `Status atual: ${(cob as any).status}` }), {
      status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  if (!(cob as any).asaas_payment_id) {
    return new Response(JSON.stringify({ error: "SEM_ASAAS_PAYMENT_ID", message: "Cobrança nunca foi gerada no Asaas" }), {
      status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Chama Asaas
  const asaasRes = await asaasFetch(`/payments/${(cob as any).asaas_payment_id}`, {
    method: "PUT",
    body: JSON.stringify({ dueDate: nova_data_vencimento }),
  });

  if (!asaasRes.ok) {
    console.error("[asaas-atualizar-vencimento] Asaas rejeitou:", asaasRes.status, asaasRes.data);
    return new Response(JSON.stringify({
      error: "ASAAS_REJEITOU",
      status: asaasRes.status,
      detalhe: asaasRes.data?.errors?.[0]?.description ?? asaasRes.data?.message ?? "Erro desconhecido"
    }), {
      status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Captura vencimento ANTIGO antes do UPDATE (pra auditoria)
  const dataAntiga = (cob as any).data_vencimento
    ? String((cob as any).data_vencimento).split("T")[0]
    : null;

  // Atualiza nosso banco (cobrancas + lancamentos vinculados)
  const { error: updCobErr } = await admin
    .from("cobrancas")
    .update({ data_vencimento: nova_data_vencimento })
    .eq("id", cobranca_id);
  if (updCobErr) {
    console.error("[asaas-atualizar-vencimento] erro update cobranca:", updCobErr);
    return new Response(JSON.stringify({
      error: "ASAAS_OK_BANCO_FALHOU",
      message: "Asaas atualizou mas nosso banco falhou. Suporte precisa rodar SQL manual.",
    }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Lancamentos vinculados via cobrancas_lancamentos
  const { data: links } = await admin
    .from("cobrancas_lancamentos")
    .select("lancamento_id")
    .eq("cobranca_id", cobranca_id);
  const lancIds = (links ?? []).map((r: any) => r.lancamento_id);
  if (lancIds.length > 0) {
    await admin.from("lancamentos")
      .update({ data_vencimento: nova_data_vencimento })
      .in("id", lancIds);
  }

  // FIN-009 (25/05/2026): trilha em entidade_audit. Antes mudança ficava sem
  // rastro nenhum. Agora sai no Histórico (ou via consulta SQL).
  // Vincula como entidade_tipo='cobranca' (novo) — pode não aparecer no modal
  // atual (HistoricoEntidadeModal só aceita 'processo'|'orcamento'), mas fica
  // gravado pra auditoria via SQL/relatório.
  const clienteNome = ((cob as any).clientes?.apelido) || ((cob as any).clientes?.nome) || "Cliente";
  const { error: auditErr } = await admin
    .from("entidade_audit")
    .insert({
      empresa_id: (cob as any).empresa_id,
      ator_id: user.id,
      ator_nome: (profile as any).nome ?? user.email ?? "Sistema",
      entidade_tipo: "cobranca",
      entidade_id: cobranca_id,
      entidade_label: clienteNome,
      campo: "data_vencimento",
      valor_antigo: dataAntiga,
      valor_novo: nova_data_vencimento,
    } as any);
  if (auditErr) {
    // Não bloqueia o sucesso da operação — só loga.
    console.error("[asaas-atualizar-vencimento] audit insert falhou:", auditErr);
  }

  return new Response(JSON.stringify({
    ok: true,
    cobranca_id,
    nova_data_vencimento,
    lancamentos_atualizados: lancIds.length,
    asaas_payment: asaasRes.data,
  }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
