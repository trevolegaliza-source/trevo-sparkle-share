// =============================================
// Edge Function: gerar-proposta-msa-pdf
// =============================================
// 26/05/2026 (Fase 2 — Geração de PDF):
// Recebe `orcamento_id` da RPC `aceitar_proposta_terceirizacao` (ou call
// manual), busca dados completos via service_role, renderiza HTML do
// template, posta no PDFShift e salva o PDF no Supabase Storage bucket
// `propostas-pdf/`. Atualiza `terc_pdf_url` com a URL pública.
//
// Configuração necessária (Supabase secrets):
//  - PDFSHIFT_API_KEY = sua chave PDFShift
//  - SUPABASE_URL (já existe)
//  - SUPABASE_SERVICE_ROLE_KEY (já existe)
//
// Idempotência: chamada com mesmo orcamento_id retorna URL existente se já gerado.
// Erros: logados + status 500. Não bloqueia o fluxo de aceite (RPC já marcou).
// =============================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { renderProposalHTML, type ProposalData } from "../_shared-proposta-msa-template.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const PDFSHIFT_API_KEY = Deno.env.get("PDFSHIFT_API_KEY") ?? "";

const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

const BUCKET_NAME = "propostas-pdf";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  if (!PDFSHIFT_API_KEY) {
    console.error("[gerar-proposta-pdf] PDFSHIFT_API_KEY não configurada");
    return jsonResponse(503, { error: "PDFSHIFT_API_KEY_MISSING" });
  }

  let body: { orcamento_id?: string; force?: boolean };
  try {
    body = await req.json();
  } catch {
    return jsonResponse(400, { error: "INVALID_JSON" });
  }

  const { orcamento_id, force } = body;
  if (!orcamento_id) return jsonResponse(400, { error: "MISSING_orcamento_id" });

  try {
    // 1. Busca dados completos da proposta
    const { data: orc, error: orcErr } = await admin
      .from("orcamentos")
      .select("*")
      .eq("id", orcamento_id)
      .eq("tipo_proposta", "terceirizacao")
      .maybeSingle();

    if (orcErr || !orc) {
      console.error("[gerar-proposta-pdf] orcamento não encontrado:", orcErr);
      return jsonResponse(404, { error: "ORCAMENTO_NOT_FOUND" });
    }

    // 2. Idempotência: se já tem PDF e não é force, retorna URL existente
    if ((orc as any).terc_pdf_url && !force) {
      return jsonResponse(200, {
        ok: true,
        cached: true,
        pdf_url: (orc as any).terc_pdf_url,
      });
    }

    // 3. Monta dados pro template
    const data: ProposalData = {
      numero: (orc as any).numero,
      prospect_nome: (orc as any).prospect_nome,
      prospect_cnpj: (orc as any).prospect_cnpj,
      prospect_contato: (orc as any).prospect_contato,
      prospect_email: (orc as any).prospect_email,
      prospect_telefone: (orc as any).prospect_telefone,
      terc_modalidade: (orc as any).terc_modalidade,
      terc_servicos: (orc as any).terc_servicos || [],
      terc_naturezas: (orc as any).terc_naturezas || [],
      terc_inclusos: (orc as any).terc_inclusos || [],
      terc_valor_base: Number((orc as any).terc_valor_base || 0),
      terc_valor_pro: Number((orc as any).terc_valor_pro || 0),
      terc_valor_final_override: (orc as any).terc_valor_final_override,
      terc_valor_abertura: (orc as any).terc_valor_abertura,
      terc_dia_pagamento: (orc as any).terc_dia_pagamento,
      terc_precos_por_tipo: (orc as any).terc_precos_por_tipo,
      terc_regras_rapidas_ativas: (orc as any).terc_regras_rapidas_ativas,
      terc_observacoes_publicas: (orc as any).terc_observacoes_publicas,
      validade_dias: (orc as any).validade_dias || 15,
      created_at: (orc as any).created_at,
    };

    // 4. Renderiza HTML
    const html = renderProposalHTML(data);

    // 5. PDFShift
    console.log("[gerar-proposta-pdf] chamando PDFShift…");
    const pdfRes = await fetch("https://api.pdfshift.io/v3/convert/pdf", {
      method: "POST",
      headers: {
        "Authorization": "Basic " + btoa("api:" + PDFSHIFT_API_KEY),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        source: html,
        format: "A4",
        sandbox: false,
        delay: 1500,  // dá tempo do Inter Google Font carregar
      }),
    });

    if (!pdfRes.ok) {
      const errText = await pdfRes.text().catch(() => "");
      console.error("[gerar-proposta-pdf] PDFShift erro:", pdfRes.status, errText);
      return jsonResponse(502, {
        error: "PDFSHIFT_FAILED",
        status: pdfRes.status,
        detail: errText.substring(0, 500),
      });
    }

    const pdfBuffer = await pdfRes.arrayBuffer();

    // 6. Upload no Storage
    const fileName = `PROP-${String(data.numero).padStart(4, "0")}-${Date.now()}.pdf`;
    const { error: uploadErr } = await admin.storage
      .from(BUCKET_NAME)
      .upload(fileName, pdfBuffer, {
        contentType: "application/pdf",
        cacheControl: "3600",
        upsert: false,
      });

    if (uploadErr) {
      console.error("[gerar-proposta-pdf] upload storage falhou:", uploadErr);
      return jsonResponse(500, { error: "STORAGE_UPLOAD_FAILED", detail: uploadErr.message });
    }

    // 7. URL pública
    const { data: pub } = admin.storage.from(BUCKET_NAME).getPublicUrl(fileName);
    const publicUrl = pub.publicUrl;

    // 8. Atualiza orcamento com URL
    await admin
      .from("orcamentos")
      .update({ terc_pdf_url: publicUrl })
      .eq("id", orcamento_id);

    return jsonResponse(200, {
      ok: true,
      cached: false,
      pdf_url: publicUrl,
      file_name: fileName,
    });
  } catch (e) {
    console.error("[gerar-proposta-pdf] erro inesperado:", e);
    return jsonResponse(500, {
      error: "UNEXPECTED",
      detail: e instanceof Error ? e.message : String(e),
    });
  }
});

function jsonResponse(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
