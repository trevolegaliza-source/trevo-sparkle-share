// =============================================
// Edge Function: asaas-gerar-cobranca
// =============================================
// Recebe { cobranca_id, data_vencimento? } autenticado (usuário master/financeiro/gerente).
// Cria (ou reutiliza) Customer no Asaas, cria Payment (boleto+PIX) e grava
// os IDs + URLs na tabela cobrancas. Retorna dados pra UI mostrar.
// =============================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { buildCorsHeaders, handlePreflight } from "../_shared/cors.ts";

// audit fix #24 — fetch externo (API Asaas) sem timeout pode travar
// edge function pelo wall time inteiro (400s). Definimos AbortController
// agressivo (15s) — Asaas normalmente responde <1s; se passou disso é
// problema de rede e devemos falhar rápido.
const ASAAS_FETCH_TIMEOUT_MS = 15_000;

const ASAAS_API_KEY = Deno.env.get("ASAAS_API_KEY") ?? "";
const ASAAS_BASE_URL = Deno.env.get("ASAAS_BASE_URL") ?? "https://api.asaas.com/v3";
const ASAAS_WALLET_ID = Deno.env.get("ASAAS_WALLET_ID") ?? "";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// ── Multa e juros (máximo permitido por lei no Brasil) ──
const FINE_PERCENT = 2;      // multa única 2%
const INTEREST_PERCENT = 1;  // 1% ao mês (0,033%/dia)

type AsaasResponse = { ok: boolean; status: number; data: any };

async function asaasFetch(path: string, init: RequestInit = {}): Promise<AsaasResponse> {
  const baseUrl = ASAAS_BASE_URL.replace(/\/+$/, ""); // remove trailing slash
  const fullUrl = `${baseUrl}${path}`;
  let res: Response;
  // audit fix #24 — timeout via AbortController; cancela fetch se Asaas
  // demorar > ASAAS_FETCH_TIMEOUT_MS. Sem isso, edge function poderia
  // ficar travada até o wall time global (400s).
  const ctrl = new AbortController();
  const timeoutId = setTimeout(() => ctrl.abort(), ASAAS_FETCH_TIMEOUT_MS);
  try {
    res = await fetch(fullUrl, {
      ...init,
      signal: ctrl.signal,
      headers: {
        "access_token": ASAAS_API_KEY,
        "Content-Type": "application/json",
        "User-Agent": "trevo-legaliza-erp/1.0",
        ...(init.headers || {}),
      },
    });
  } catch (e) {
    const aborted = (e as any)?.name === "AbortError";
    console.error("[asaasFetch] network error", {
      url: fullUrl,
      error: String(e),
      timeout: aborted,
    });
    throw new Error(
      aborted
        ? `Asaas timeout após ${ASAAS_FETCH_TIMEOUT_MS}ms (${fullUrl})`
        : `Falha de rede ao chamar Asaas (${fullUrl}): ${String(e)}`,
    );
  } finally {
    clearTimeout(timeoutId);
  }
  const text = await res.text();
  let data: any = {};
  try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }
  if (!res.ok) {
    console.error("[asaasFetch] error response", {
      url: fullUrl,
      method: init.method ?? "GET",
      status: res.status,
      body: text?.substring(0, 500),
    });
  }
  return { ok: res.ok, status: res.status, data };
}

function onlyDigits(v: string | null | undefined): string {
  return (v ?? "").replace(/\D/g, "");
}

function addDaysISO(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}

// FIN bugfix 29/05/2026 (caso ZYGOS — auto-Asaas falhou silenciosamente
// com 5 processos): Asaas /payments retorna 400 "dueDate cannot be in the
// past" quando a cobrança herda data_vencimento de lançamento já vencido
// (comum em extrato retroativo). Antes essa 400 virava 500 do edge e o
// auto-Asaas falhava sem motivo claro — Thales precisava clicar manual e
// escolher data nova no modal. Agora clampamos: data no passado vira
// hoje+3 (mesmo fallback do default). Log warning pra rastreamento.
function clampDueDate(raw: string | null | undefined): string {
  const fallback = addDaysISO(3);
  if (!raw) return fallback;
  const today = new Date().toISOString().split("T")[0];
  if (raw < today) {
    console.warn(`[asaas-gerar-cobranca] dueDate ${raw} no passado — clampando pra ${fallback}`);
    return fallback;
  }
  return raw;
}

async function ensureCustomer(clienteRow: any): Promise<string> {
  if (clienteRow.asaas_customer_id) return clienteRow.asaas_customer_id;

  // 18/05/2026: suporta cliente PF (cpf) além de PJ (cnpj). Asaas aceita
  // ambos no mesmo campo cpfCnpj (11 ou 14 dígitos).
  const tipoPessoa = (clienteRow.tipo_pessoa as "PF" | "PJ") || "PJ";
  const docDigits = tipoPessoa === "PF"
    ? onlyDigits(clienteRow.cpf)
    : onlyDigits(clienteRow.cnpj);
  const cpfCnpj = docDigits;
  if (!cpfCnpj || (tipoPessoa === "PF" ? cpfCnpj.length !== 11 : cpfCnpj.length !== 14)) {
    const docLabel = tipoPessoa === "PF" ? "CPF" : "CNPJ";
    throw new Error(`Cliente sem ${docLabel} válido cadastrado. Cadastre o ${docLabel} antes de gerar a cobrança.`);
  }

  // 1) tenta localizar por CPF/CNPJ antes de criar
  const search = await asaasFetch(`/customers?cpfCnpj=${cpfCnpj}&limit=1`);
  if (search.ok && Array.isArray(search.data?.data) && search.data.data.length > 0) {
    const customerId = search.data.data[0].id;
    await admin.from("clientes").update({ asaas_customer_id: customerId }).eq("id", clienteRow.id);
    return customerId;
  }

  // 2) cria
  const payload: Record<string, any> = {
    name: (clienteRow.apelido || clienteRow.nome || "Cliente").substring(0, 100),
    cpfCnpj,
    email: clienteRow.email || undefined,
    mobilePhone: onlyDigits(clienteRow.telefone_financeiro || clienteRow.telefone) || undefined,
    externalReference: clienteRow.id,
  };

  const created = await asaasFetch("/customers", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  if (!created.ok) {
    const detail = JSON.stringify(created.data);
    if (created.status === 401) {
      throw new Error("Asaas: chave de API inválida ou não autorizada. Confirme ASAAS_API_KEY nos secrets.");
    }
    if (created.status === 404) {
      throw new Error(`Asaas: endpoint não encontrado em ${ASAAS_BASE_URL}/customers. Verifique se ASAAS_BASE_URL está correto (produção: https://api.asaas.com/v3, sandbox: https://api-sandbox.asaas.com/v3).`);
    }
    throw new Error(`Asaas customer (${created.status}): ${detail || "(sem corpo)"}`);
  }

  const customerId = created.data.id;
  await admin.from("clientes").update({ asaas_customer_id: customerId }).eq("id", clienteRow.id);
  return customerId;
}

async function createPayment(params: {
  customerId: string;
  value: number;
  dueDate: string;
  description: string;
  externalReference: string;
}) {
  const payload: Record<string, any> = {
    customer: params.customerId,
    billingType: "UNDEFINED", // permite boleto OU pix
    value: Number(params.value.toFixed(2)),
    dueDate: params.dueDate,
    description: params.description.substring(0, 500),
    externalReference: params.externalReference,
    fine: { value: FINE_PERCENT, type: "PERCENTAGE" },
    interest: { value: INTEREST_PERCENT, type: "PERCENTAGE" },
  };
  if (ASAAS_WALLET_ID) {
    payload.split = undefined; // reservado pra futuro
  }

  const r = await asaasFetch("/payments", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  if (!r.ok) throw new Error(`Asaas payment ${r.status}: ${JSON.stringify(r.data)}`);
  return r.data;
}

async function fetchPixQrCode(paymentId: string) {
  const r = await asaasFetch(`/payments/${paymentId}/pixQrCode`);
  if (!r.ok) return null;
  return r.data; // { encodedImage, payload, expirationDate }
}

async function fetchIdentificationField(paymentId: string) {
  const r = await asaasFetch(`/payments/${paymentId}/identificationField`);
  if (!r.ok) return null;
  return r.data; // { identificationField, nossoNumero, barCode }
}

Deno.serve(async (req) => {
  // audit fix #21 — CORS allowlist (substitui "*")
  const preflight = handlePreflight(req);
  if (preflight) return preflight;
  const corsHeaders = buildCorsHeaders(req.headers.get("Origin"));

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const authHeader = req.headers.get("Authorization") || "";
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Autenticação obrigatória" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // valida usuário + role
  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user }, error: userError } = await userClient.auth.getUser();
  if (userError || !user) {
    return new Response(JSON.stringify({ error: "Sessão inválida" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const { data: profile } = await admin
    .from("profiles")
    .select("role, empresa_id, ativo")
    .eq("id", user.id)
    .single();
  if (!profile || !profile.ativo) {
    return new Response(JSON.stringify({ error: "Usuário inativo" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const role = profile.role;
  if (!["master", "gerente", "financeiro"].includes(role)) {
    return new Response(JSON.stringify({ error: "Sem permissão para gerar cobrança" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!ASAAS_API_KEY) {
    return new Response(JSON.stringify({ error: "ASAAS_API_KEY não configurado" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let body: any = {};
  try { body = await req.json(); } catch { /* empty */ }
  const cobrancaId = body.cobranca_id as string | undefined;
  const customDueDate = body.data_vencimento as string | undefined;

  if (!cobrancaId) {
    return new Response(JSON.stringify({ error: "cobranca_id obrigatório" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // lockAcquired vira true quando este worker ganha o lock — precisa
  // liberar manualmente em caso de erro (o UPDATE final libera no sucesso).
  let lockAcquired = false;

  try {
    // 1) SELECT leve só pra validar isolamento por empresa antes do lock.
    const { data: cobranca, error: cobErr } = await admin
      .from("cobrancas")
      .select("id, cliente_id, empresa_id, total_geral, data_vencimento, share_token, asaas_payment_id, status")
      .eq("id", cobrancaId)
      .single();
    if (cobErr || !cobranca) throw new Error("Cobrança não encontrada");

    if (cobranca.empresa_id !== profile.empresa_id) {
      return new Response(JSON.stringify({ error: "Cobrança não pertence a esta empresa" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2) Tenta adquirir o lock atomicamente (CAS em asaas_gerando_lock_ate).
    //    A RPC também valida status e payment_id existente — fonte de verdade
    //    blindada contra race condition entre SELECT acima e UPDATE lá embaixo.
    const { data: lockResultRaw, error: lockErr } = await admin.rpc(
      "asaas_tentar_lock_cobranca",
      { p_cobranca_id: cobrancaId },
    );
    if (lockErr) throw new Error(`Falha ao adquirir lock: ${lockErr.message}`);
    const lockResult = (lockResultRaw ?? {}) as any;

    if (!lockResult.acquired) {
      switch (lockResult.reason) {
        case "not_found":
          return new Response(JSON.stringify({ error: "Cobrança não encontrada" }), {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        case "wrong_status":
          return new Response(JSON.stringify({
            error: `Cobrança ${lockResult.status} não pode ser reenviada`,
          }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        case "already_generated":
          return new Response(JSON.stringify({
            ok: true,
            reused: true,
            asaas_payment_id: lockResult.asaas_payment_id,
            message: "Cobrança Asaas já existe para este registro.",
          }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        case "in_progress":
          return new Response(JSON.stringify({
            error: "Outra geração de cobrança Asaas já está em andamento para este registro. Aguarde alguns segundos e tente novamente.",
          }), {
            status: 409,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        default:
          throw new Error(`Lock não adquirido por motivo desconhecido: ${JSON.stringify(lockResult)}`);
      }
    }
    lockAcquired = true;

    const { data: cliente, error: clErr } = await admin
      .from("clientes")
      .select("id, nome, apelido, cnpj, cpf, tipo_pessoa, email, telefone, telefone_financeiro, asaas_customer_id")
      .eq("id", cobranca.cliente_id)
      .single();
    if (clErr || !cliente) throw new Error("Cliente da cobrança não encontrado");

    const customerId = await ensureCustomer(cliente);

    // FIN bugfix 29/05/2026: clampDueDate previne 400 do Asaas quando data
    // vem do passado (extrato retroativo, lanç vencido). Antes virava 500.
    const dueDate = clampDueDate(customDueDate || cobranca.data_vencimento);

    const payment = await createPayment({
      customerId,
      value: Number(cobranca.total_geral),
      dueDate,
      description: `Cobrança ${cliente.apelido || cliente.nome}`,
      externalReference: cobranca.id,
    });

    const [pix, boleto] = await Promise.all([
      fetchPixQrCode(payment.id),
      fetchIdentificationField(payment.id),
    ]);

    const update = {
      asaas_payment_id: payment.id,
      asaas_status: payment.status,
      asaas_invoice_url: payment.invoiceUrl ?? null,
      asaas_boleto_url: payment.bankSlipUrl ?? null,
      asaas_boleto_barcode: boleto?.identificationField ?? null,
      asaas_pix_qrcode: pix?.encodedImage ?? null,
      asaas_pix_payload: pix?.payload ?? null,
      asaas_gerado_em: new Date().toISOString(),
      asaas_gerando_lock_ate: null, // libera o lock junto com o write final
      data_vencimento: dueDate,
    };
    await admin.from("cobrancas").update(update).eq("id", cobranca.id);
    lockAcquired = false; // já liberado pelo UPDATE acima

    return new Response(JSON.stringify({
      ok: true,
      reused: false,
      asaas_payment_id: payment.id,
      invoice_url: payment.invoiceUrl,
      boleto_url: payment.bankSlipUrl,
      boleto_barcode: boleto?.identificationField ?? null,
      pix_payload: pix?.payload ?? null,
      due_date: dueDate,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (err: any) {
    console.error("asaas-gerar-cobranca error:", err);

    // Se adquirimos o lock mas falhamos antes do UPDATE final,
    // liberamos manualmente pra não segurar a cobrança por 60s.
    if (lockAcquired) {
      try {
        await admin
          .from("cobrancas")
          .update({ asaas_gerando_lock_ate: null })
          .eq("id", cobrancaId);
      } catch (releaseErr) {
        console.error("asaas-gerar-cobranca: falha ao liberar lock:", releaseErr);
      }
    }

    return new Response(JSON.stringify({ error: String(err?.message ?? err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
