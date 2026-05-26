// =============================================
// Edge Function: gerar-proposta-msa-pdf
// =============================================
// 26/05/2026 (Fase 2 — PDF unificado da Proposta Comercial de Terceirização).
// Arquivo all-in-one pra colar direto no Supabase Dashboard.
//
// Configuração necessária (Supabase Secrets):
//   PDFSHIFT_API_KEY = sua chave PDFShift (formato sk_...)
//
// Fluxo:
//   1. RPC `aceitar_proposta_terceirizacao` dispara esta edge async
//   2. Busca dados completos da proposta via service_role
//   3. Renderiza HTML do template (6-7 páginas A4)
//   4. POST PDFShift → PDF binário
//   5. Upload no bucket Storage `propostas-pdf`
//   6. Atualiza terc_pdf_url com URL pública
// =============================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const PDFSHIFT_API_KEY = Deno.env.get("PDFSHIFT_API_KEY") ?? "";
const BUCKET_NAME = "propostas-pdf";
const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

// ─── Catálogo de regras rápidas (cláusulas pré-definidas) ───────────────────
const REGRAS_CATALOGO: Array<{ id: string; label: string; texto: string }> = [
  { id: 'mat',              label: 'MAT',              texto: 'A responsabilidade técnica, preenchimento e envio do Módulo de Administração Tributária (MAT) permanecerá sob encargo EXCLUSIVO da Contabilidade.' },
  { id: 'troca_uf',         label: 'TROCA UF',         texto: 'Processos que envolvam transferência de UF serão cobrados como 2 processos avulsos.' },
  { id: 'doc_completa',     label: 'DOC COMPLETA',     texto: 'PRAZO: O prazo de 5 dias úteis inicia-se EXCLUSIVAMENTE após recebimento de 100% da documentação solicitada.' },
  { id: 'alvaras_600',      label: 'ALVARÁS +600',     texto: 'ALVARÁS EXTRAS: Processos que exijam Alvarás e Licenças (não inclusos no serviço) terão cobrança adicional de R$ 600,00 por processo + taxas + responsável técnico.' },
  { id: 'taxas_fora',       label: 'TAXAS FORA',       texto: 'TAXAS GOVERNAMENTAIS: DAREs, DARFs, emolumentos e guias oficiais NÃO estão inclusos nos honorários.' },
  { id: 'fast_track',       label: 'FAST TRACK',       texto: 'URGÊNCIA (FAST TRACK): Solicitações com prazo inferior a 24h terão acréscimo de 50% sobre o valor + taxa de registro junta e regional.' },
  { id: 'retrabalho',       label: 'RETRABALHO',       texto: 'RETRABALHO: Exigências decorrentes de dados incorretos fornecidos pela CONTRATANTE serão cobradas 50% a mais do valor do processo avulso.' },
  { id: 'inadimplencia',    label: 'INADIMPLÊNCIA',    texto: 'INADIMPLÊNCIA: Atrasos superiores a 5 dias resultarão em suspensão imediata do acesso à plataforma e protocolização de novos processos.' },
  { id: 'lgpd',             label: 'LGPD',             texto: 'LGPD: A CONTRATANTE autoriza a CONTRATADA a tratar dados pessoais exclusivamente para execução deste contrato, conforme Lei 13.709/2018.' },
  { id: 'escopo_estendido', label: 'ESCOPO ESTENDIDO', texto: 'ESCOPO ESTENDIDO: Processos que excederem a complexidade média prevista no escopo contratual (ex: holdings patrimoniais com múltiplos imóveis a integralizar, sociedades anônimas com estrutura ampla, contratos extensos ou cláusulas atípicas) serão analisados caso a caso e poderão sofrer cobrança de honorário adicional, mediante orçamento prévio e aprovação por escrito da CONTRATANTE.' },
];

const TIPO_PROCESSO_LABEL: Record<string, string> = {
  abertura: 'Abertura',
  alteracao: 'Alteração',
  baixa: 'Baixa',
  transformacao: 'Transformação',
  encerramento: 'Encerramento',
};

const MODALIDADE_LABEL: Record<string, string> = {
  avulso: 'Avulso — Pontual',
  pro_5: 'Plano PRO',
  preco_por_tipo: 'Preço por tipo de processo',
  custom: 'Customizado',
};

// ─── Helpers ────────────────────────────────────────────────────────────────
function fmtBRL(v: number): string {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
function fmtData(d: string | Date): string {
  const date = typeof d === 'string' ? new Date(d) : d;
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
}
function escapeHtml(s: string | null | undefined): string {
  if (!s) return '';
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
function calcExpiracao(createdAt: string, validade: number): Date {
  const d = new Date(createdAt);
  d.setDate(d.getDate() + (validade || 15));
  return d;
}
function valorPrincipal(p: any): number {
  if (p.terc_valor_final_override && p.terc_valor_final_override > 0) return p.terc_valor_final_override;
  if (p.terc_modalidade === 'pro_5') return p.terc_valor_pro * 5;
  return p.terc_valor_base;
}

// ─── CSS embeddado ──────────────────────────────────────────────────────────
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');
@page { size: A4 portrait; margin: 0; }
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: 'Inter', system-ui, -apple-system, sans-serif; font-size: 11px; color: #0f172a; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.pagina { width: 210mm; min-height: 297mm; padding: 18mm 16mm; position: relative; page-break-after: always; }
.pagina:last-child { page-break-after: auto; }
.pagina-capa { background: linear-gradient(135deg, #022c22 0%, #052e16 60%, #0f172a 100%); color: #ecfdf5; display: flex; flex-direction: column; }
.capa-header { padding-bottom: 14mm; border-bottom: 1px solid rgba(255,255,255,0.1); }
.brand-name { font-weight: 700; font-size: 12px; letter-spacing: 0.02em; }
.brand-meta { font-size: 9px; color: rgba(255,255,255,0.6); margin-top: 2px; }
.capa-hero { padding: 12mm 0; flex: 1; }
.capa-eyebrow { font-size: 9px; letter-spacing: 0.2em; color: #6ee7b7; font-weight: 700; margin-bottom: 12px; }
.capa-titulo { font-size: 36px; font-weight: 800; line-height: 1.1; color: white; max-width: 75%; }
.capa-cnpj { font-size: 11px; color: rgba(255,255,255,0.7); margin-top: 4px; }
.capa-badge { display: inline-block; margin-top: 10mm; padding: 6px 14px; background: #047857; color: white; font-size: 9px; font-weight: 700; letter-spacing: 0.1em; border-radius: 4px; }
.capa-headline { margin-top: 14mm; max-width: 80%; }
.capa-headline h2 { font-size: 20px; font-weight: 400; color: white; line-height: 1.3; }
.capa-headline p { font-size: 11px; color: rgba(236,253,245,0.8); margin-top: 8px; line-height: 1.6; }
.capa-stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8mm; padding: 8mm 0; border-top: 1px solid rgba(255,255,255,0.1); }
.capa-stats div strong { display: block; font-size: 14px; font-weight: 700; color: #6ee7b7; }
.capa-stats div span { display: block; font-size: 9px; color: rgba(255,255,255,0.6); margin-top: 2px; line-height: 1.3; }
.capa-footer { display: flex; justify-content: space-between; padding-top: 6mm; border-top: 1px solid rgba(255,255,255,0.1); font-size: 9px; color: rgba(255,255,255,0.6); }
.capa-footer .mono { font-family: monospace; }
.pag-header { margin-bottom: 10mm; padding-bottom: 4mm; border-bottom: 1px solid #e2e8f0; font-size: 10px; }
.pag-header p { font-weight: 600; }
.muted { color: #64748b; font-weight: 400; }
.sec-title { background: #0f172a; color: white; font-size: 10px; font-weight: 700; letter-spacing: 0.1em; padding: 6px 10px; margin-bottom: 8mm; }
.escopo-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6mm; }
.escopo-label { font-size: 9px; color: #64748b; font-weight: 700; letter-spacing: 0.05em; margin-bottom: 6px; text-transform: uppercase; }
.chips { display: flex; flex-wrap: wrap; gap: 4px; }
.chip { display: inline-block; padding: 4px 9px; border-radius: 12px; font-size: 9px; font-weight: 600; }
.chip-on { background: #0f172a; color: white; }
.chip-green { background: #047857; color: white; }
.chip-off { background: #f1f5f9; color: #94a3b8; text-decoration: line-through; }
.inclusos-list { display: grid; grid-template-columns: 1fr 1fr; gap: 4px; margin-top: 4mm; }
.incluso-on, .incluso-off { display: flex; gap: 6px; padding: 6px 8px; border-radius: 4px; align-items: flex-start; }
.incluso-on { background: rgba(16,185,129,0.06); border-left: 2px solid #10b981; }
.incluso-off { background: #f8fafc; border-left: 2px solid #cbd5e1; opacity: 0.5; }
.icon-check { color: #059669; font-weight: 800; font-size: 11px; }
.icon-cross { color: #94a3b8; font-weight: 800; font-size: 11px; }
.incluso-label { font-size: 9.5px; font-weight: 700; color: #0f172a; }
.incluso-off .incluso-label { text-decoration: line-through; color: #94a3b8; }
.incluso-desc { font-size: 8.5px; color: #475569; margin-top: 1px; line-height: 1.4; }
.valor-destaque { background: #047857; color: white; padding: 6mm; border-radius: 6px; margin-bottom: 4mm; }
.valor-label { font-size: 9px; letter-spacing: 0.1em; color: #6ee7b7; font-weight: 700; }
.valor-numero { font-size: 36px; font-weight: 800; margin-top: 4px; letter-spacing: -1px; }
.valor-numero span { font-size: 14px; font-weight: 400; color: #a7f3d0; }
.valor-sub { font-size: 10px; color: #d1fae5; margin-top: 4px; }
.valor-extras { display: grid; grid-template-columns: 1fr 1fr; gap: 4mm; margin-top: 4mm; }
.valor-extras div { padding: 4mm; border: 1px solid #e2e8f0; border-radius: 4px; }
.valor-extras p { font-size: 9px; color: #64748b; font-weight: 600; letter-spacing: 0.05em; text-transform: uppercase; }
.valor-extras strong { display: block; font-size: 18px; font-weight: 700; color: #0f172a; margin-top: 2px; }
.precos-tabela { margin-top: 4mm; }
.preco-linha { display: flex; justify-content: space-between; padding: 8px 12px; background: rgba(16,185,129,0.04); border: 1px solid #d1fae5; border-radius: 4px; margin-bottom: 4px; font-size: 11px; }
.preco-linha strong { color: #047857; font-size: 14px; }
.dia-pagto { margin-top: 4mm; padding: 4mm; background: #fef3c7; border: 1px solid #fcd34d; border-radius: 4px; font-size: 10px; color: #78350f; }
.cond-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 4mm; margin-bottom: 6mm; }
.cond-box { padding: 4mm; border-left: 2px solid #047857; background: rgba(16,185,129,0.04); }
.cond-label { font-size: 8px; font-weight: 700; letter-spacing: 0.1em; color: #047857; margin-bottom: 4px; }
.cond-box p { font-size: 9.5px; color: #475569; line-height: 1.5; }
.obs-box { padding: 4mm; background: #fffbeb; border: 1px solid #fde68a; border-radius: 4px; margin-bottom: 4mm; }
.obs-label { font-size: 8px; font-weight: 700; letter-spacing: 0.1em; color: #92400e; margin-bottom: 6px; }
.obs-box p { font-size: 9.5px; color: #1e293b; line-height: 1.6; margin-bottom: 4px; }
.obs-livre { background: #f1f5f9; border-color: #cbd5e1; }
.obs-livre .obs-label { color: #475569; }
.vinculacao { background: #022c22; color: #ecfdf5; padding: 6mm; border-radius: 4px; margin-top: 6mm; }
.vinc-label { font-size: 8px; letter-spacing: 0.1em; color: #6ee7b7; font-weight: 700; margin-bottom: 6px; }
.vinculacao p { font-size: 10px; line-height: 1.6; }
.badge-bind { display: inline-block; margin-top: 6px; padding: 3px 8px; background: #047857; border-radius: 3px; font-size: 9px; font-weight: 700; letter-spacing: 0.05em; }
.assinatura-data { margin-top: 8mm; font-size: 10px; color: #475569; }
.pagina-msa-capa { background: linear-gradient(135deg, #052e16 0%, #022c22 100%); color: white; display: flex; align-items: center; justify-content: center; }
.msa-capa-content { text-align: center; max-width: 70%; }
.msa-titulo { font-size: 28px; font-weight: 800; letter-spacing: -0.5px; }
.msa-subtitulo { font-size: 13px; font-weight: 400; color: #a7f3d0; letter-spacing: 0.1em; margin-top: 6px; text-transform: uppercase; }
.msa-cliente { margin: 14mm 0; padding: 8mm; background: rgba(255,255,255,0.05); border-radius: 6px; border: 1px solid rgba(255,255,255,0.1); }
.msa-cliente p { font-size: 11px; margin-top: 4px; }
.msa-cliente-nome { font-size: 18px; font-weight: 700; color: white; margin-bottom: 8px; }
.msa-rodape { font-size: 9px; color: rgba(255,255,255,0.5); margin-top: 14mm; }
.partes-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6mm; margin-bottom: 6mm; }
.parte-box { padding: 4mm; border: 1px solid #e2e8f0; border-radius: 4px; }
.parte-label { font-size: 8px; font-weight: 700; letter-spacing: 0.1em; color: #047857; margin-bottom: 6px; padding: 3px 6px; background: rgba(16,185,129,0.1); display: inline-block; border-radius: 3px; }
.parte-nome { font-size: 11px; font-weight: 700; margin-bottom: 6px; }
.parte-box p { font-size: 9px; margin-top: 2px; line-height: 1.5; }
.msa-celebracao { font-size: 10px; font-style: italic; color: #64748b; margin: 4mm 0 6mm; }
.clausula-titulo { background: #0f172a; color: white; font-size: 9px; font-weight: 700; letter-spacing: 0.08em; padding: 5px 10px; margin: 5mm 0 3mm; }
.pagina-msa-clausulas p { font-size: 9.5px; line-height: 1.6; margin-bottom: 2mm; }
.pagina-msa-assinatura { padding-top: 30mm; }
.local-data { font-size: 11px; text-align: center; font-weight: 600; margin-bottom: 14mm; }
.assinaturas { display: grid; grid-template-columns: 1fr 1fr; gap: 10mm; margin-bottom: 14mm; }
.linha-assinatura { height: 1px; background: #0f172a; margin-bottom: 4mm; }
.ass-label { font-size: 8px; font-weight: 700; letter-spacing: 0.1em; color: #047857; padding: 3px 6px; background: rgba(16,185,129,0.1); display: inline-block; border-radius: 3px; }
.ass-nome { font-size: 11px; font-weight: 700; margin-top: 4px; }
.assinaturas p { font-size: 10px; margin-top: 2px; }
.msa-rodape-pdf { font-size: 9px; font-style: italic; color: #94a3b8; text-align: center; padding-top: 6mm; border-top: 1px solid #e2e8f0; }
`;

// ─── Renderizador ───────────────────────────────────────────────────────────
function renderHTML(p: any): string {
  const expira = calcExpiracao(p.created_at, p.validade_dias);
  const modalLabel = MODALIDADE_LABEL[p.terc_modalidade] || 'Customizada';
  const servicos = Array.isArray(p.terc_servicos) ? p.terc_servicos : [];
  const naturezas = Array.isArray(p.terc_naturezas) ? p.terc_naturezas : [];
  const inclusos = Array.isArray(p.terc_inclusos) ? p.terc_inclusos : [];
  const isPrecoPorTipo = p.terc_modalidade === 'preco_por_tipo';
  const isPlanoMensal = p.terc_modalidade === 'pro_5';
  const ativas = Array.isArray(p.terc_regras_rapidas_ativas) ? p.terc_regras_rapidas_ativas : [];
  const regrasObj = REGRAS_CATALOGO.filter((r) => ativas.includes(r.id));
  const precosTipo = p.terc_precos_por_tipo || {};

  const capa = `
    <section class="pagina pagina-capa">
      <header class="capa-header">
        <div>
          <p class="brand-name">TREVO ASSESSORIA SOCIETÁRIA LTDA</p>
          <p class="brand-meta">CNPJ 39.969.412/0001-70 • Atuação Nacional</p>
        </div>
      </header>
      <div class="capa-hero">
        <p class="capa-eyebrow">PROPOSTA PREPARADA EXCLUSIVAMENTE PARA</p>
        <h1 class="capa-titulo">${escapeHtml(p.prospect_nome)}</h1>
        ${p.prospect_cnpj ? `<p class="capa-cnpj">${escapeHtml(p.prospect_cnpj)}</p>` : ''}
        <span class="capa-badge">${modalLabel.toUpperCase()}</span>
        <div class="capa-headline">
          <h2>Seu escritório contábil cresceu.</h2>
          <h2 style="color:#34d399">Sua estrutura societária ainda te acompanha?</h2>
          <p>Somos o departamento jurídico-societário que escritórios de alto volume precisam — com SLA formalizado, rastreabilidade integral e operação 100% B2B. Processos simples ou extremamente complexos, do início ao deferimento.</p>
        </div>
      </div>
      <div class="capa-stats">
        <div><strong>12 Anos</strong><span>de expertise societária</span></div>
        <div><strong>26 Estados</strong><span>de atuação ativa</span></div>
        <div><strong>Reconhecida</strong><span>parcerias com Juntas Comerciais</span></div>
        <div><strong>Exclusivo B2B</strong><span>só atendemos contabilidades</span></div>
      </div>
      <footer class="capa-footer">
        <span>Reconhecida nacionalmente • 12 anos de mercado</span>
        <span>⚠ EXPIRA EM ${fmtData(expira).toUpperCase()}</span>
        <span class="mono">PROP-${String(p.numero).padStart(4, '0')}</span>
      </footer>
    </section>
  `;

  const escopo = `
    <section class="pagina">
      <header class="pag-header">
        <p>${escapeHtml(p.prospect_nome)}</p>
        <p class="muted">Escopo & Condições Financeiras</p>
      </header>
      <h2 class="sec-title">ANEXO I — ESCOPO DE SERVIÇOS</h2>
      <div class="escopo-grid">
        <div>
          <p class="escopo-label">Serviços Societários</p>
          <div class="chips">${servicos.map((s: any) => `<span class="${s.ativo ? 'chip chip-on' : 'chip chip-off'}">${escapeHtml(s.label)}</span>`).join('')}</div>
        </div>
        <div>
          <p class="escopo-label">Natureza Jurídica Atendida</p>
          <div class="chips">${naturezas.map((n: any) => `<span class="${n.ativo ? 'chip chip-green' : 'chip chip-off'}">${escapeHtml(n.label)}</span>`).join('')}</div>
        </div>
      </div>
      <p class="escopo-label" style="margin-top:18px">O que está incluso no processo</p>
      <div class="inclusos-list">
        ${inclusos.map((i: any) => `
          <div class="${i.ativo ? 'incluso-on' : 'incluso-off'}">
            <span class="${i.ativo ? 'icon-check' : 'icon-cross'}">${i.ativo ? '✓' : '✗'}</span>
            <div>
              <p class="incluso-label">${escapeHtml(i.label)}</p>
              ${i.descricao ? `<p class="incluso-desc">${escapeHtml(i.descricao)}</p>` : ''}
            </div>
          </div>
        `).join('')}
      </div>
      <h2 class="sec-title" style="margin-top:24px">ANEXO II — CONDIÇÕES FINANCEIRAS</h2>
      ${isPrecoPorTipo ? `
        <div class="precos-tabela">
          <p class="escopo-label" style="margin-bottom:8px">Tabela de honorários por tipo de processo</p>
          ${Object.entries(precosTipo).filter(([_, v]: any) => v && v > 0).map(([tipo, valor]: any) => `
            <div class="preco-linha"><span>${TIPO_PROCESSO_LABEL[tipo] || tipo}</span><strong>${fmtBRL(valor as number)}</strong></div>
          `).join('')}
        </div>
      ` : `
        <div class="valor-destaque">
          <p class="valor-label">${isPlanoMensal ? 'INVESTIMENTO MENSAL' : 'HONORÁRIOS POR PROCESSO'}</p>
          <p class="valor-numero">${fmtBRL(valorPrincipal(p))}${isPlanoMensal ? ' <span>/mês</span>' : ''}</p>
          ${isPlanoMensal ? `<p class="valor-sub">5 processos inclusos / mês · 15% de desconto</p>` : ''}
        </div>
        ${p.terc_valor_abertura && p.terc_valor_abertura > 0 ? `
          <div class="valor-extras">
            <div><p>Abertura de empresa</p><strong>${fmtBRL(p.terc_valor_abertura)}</strong></div>
            <div><p>Alteração / Baixa / Transformação</p><strong>${fmtBRL(valorPrincipal(p))}</strong></div>
          </div>
        ` : ''}
      `}
      ${p.terc_dia_pagamento ? `<div class="dia-pagto">📅 Cobrança recorrente todo dia <strong>${p.terc_dia_pagamento}</strong> do mês.</div>` : ''}
    </section>
  `;

  const condicoes = `
    <section class="pagina">
      <header class="pag-header">
        <p>${escapeHtml(p.prospect_nome)}</p>
        <p class="muted">Condições Operacionais & Vinculação Contratual</p>
      </header>
      <h2 class="sec-title">CONDIÇÕES OPERACIONAIS</h2>
      <div class="cond-grid">
        <div class="cond-box"><p class="cond-label">PAGAMENTO</p><p>Cobrança via boleto bancário em até 3 dias da data da solicitação. Pagamento à vista.</p></div>
        <div class="cond-box"><p class="cond-label">SLA & PRAZOS</p><p>Prazo de início: até 5 dias úteis após recebimento COMPLETO da documentação. SLA de atendimento: 48 horas úteis.</p></div>
        <div class="cond-box"><p class="cond-label">VALIDADE</p><p>Válida por <strong>${p.validade_dias} dias</strong> a partir da data de emissão.</p></div>
      </div>
      ${regrasObj.length > 0 ? `
        <div class="obs-box">
          <p class="obs-label">OBSERVAÇÕES ADICIONAIS</p>
          ${regrasObj.map((r) => `<p>• ${escapeHtml(r.texto)}</p>`).join('')}
        </div>
      ` : ''}
      ${p.terc_observacoes_publicas ? `
        <div class="obs-box obs-livre">
          <p class="obs-label">OBSERVAÇÕES ESPECÍFICAS</p>
          <p>${escapeHtml(p.terc_observacoes_publicas).replace(/\n/g, '<br>')}</p>
        </div>
      ` : ''}
      <div class="vinculacao">
        <p class="vinc-label">VINCULAÇÃO CONTRATUAL</p>
        <p>A presente Proposta Comercial é parte integrante do relacionamento jurídico entre <strong>${escapeHtml(p.prospect_nome)}</strong> e <strong>TREVO Assessoria Societária LTDA</strong>, incorporando por referência o Contrato Mestre de Prestação de Serviços (Master Service Agreement) que segue nas páginas seguintes. O aceite implica concordância integral com os termos.</p>
        <span class="badge-bind">● DOCUMENTO VINCULANTE</span>
      </div>
      <div class="assinatura-data">São Paulo, ${fmtData(new Date())}.</div>
    </section>
  `;

  const msa = `
    <section class="pagina pagina-msa-capa">
      <div class="msa-capa-content">
        <h1 class="msa-titulo">MASTER SERVICE AGREEMENT — MSA</h1>
        <p class="msa-subtitulo">Contrato de Prestação de Serviços Societários e Empresariais</p>
        <div class="msa-cliente">
          <p class="muted">CLIENTE CONTRATANTE</p>
          <p class="msa-cliente-nome">${escapeHtml(p.prospect_nome)}</p>
          <p>Modalidade: <strong>${modalLabel}</strong></p>
          <p class="muted">São Paulo, ${fmtData(new Date())}</p>
        </div>
        <div class="msa-rodape"><p>Trevo Legaliza · CEO Thales Felipe Burger Soares</p></div>
      </div>
    </section>
    <section class="pagina">
      <h2 class="sec-title">IDENTIFICAÇÃO DAS PARTES</h2>
      <div class="partes-grid">
        <div class="parte-box">
          <p class="parte-label">CONTRATADA</p>
          <p class="parte-nome">TREVO ASSESSORIA SOCIETÁRIA LTDA</p>
          <p><strong>CNPJ:</strong> 39.969.412/0001-70</p>
          <p><strong>Endereço:</strong> Rua Brasil, nº 1170 — Rudge Ramos — São Bernardo do Campo/SP</p>
          <p><strong>Representante:</strong> Thales Felipe Burger Soares</p>
          <p><strong>CPF:</strong> 447.821.658-46</p>
          <p><strong>Qualificação:</strong> Sócio Administrador — CEO</p>
        </div>
        <div class="parte-box">
          <p class="parte-label">CONTRATANTE</p>
          <p class="parte-nome">${escapeHtml(p.prospect_nome)}</p>
          ${p.prospect_cnpj ? `<p><strong>CNPJ/CPF:</strong> ${escapeHtml(p.prospect_cnpj)}</p>` : ''}
          ${p.prospect_contato ? `<p><strong>Representante:</strong> ${escapeHtml(p.prospect_contato)}</p>` : ''}
          ${p.prospect_email ? `<p><strong>Email:</strong> ${escapeHtml(p.prospect_email)}</p>` : ''}
          ${p.prospect_telefone ? `<p><strong>Telefone:</strong> ${escapeHtml(p.prospect_telefone)}</p>` : ''}
        </div>
      </div>
      <p class="msa-celebracao">As partes acima identificadas resolvem celebrar o presente Contrato, que se regerá pelas cláusulas e condições abaixo.</p>
      <h3 class="clausula-titulo">01 DO OBJETO</h3>
      <p>1.1 O presente instrumento tem por objeto a prestação de serviços técnicos especializados em assessoria societária, legalização empresarial e atos correlatos, conforme detalhamento constante no Anexo I — Proposta Comercial.</p>
      <p>1.2 A modalidade contratada será: <strong>${modalLabel}</strong>, conforme expressamente indicado na proposta aceita.</p>
      <p>1.3 O escopo limita-se estritamente aos serviços descritos no Anexo I.</p>
      <h3 class="clausula-titulo">02 DO ONBOARDING E INÍCIO DA PARCERIA</h3>
      <p>2.1 Em até 2 (dois) dias úteis após a assinatura deste instrumento, a CONTRATANTE receberá acesso à Plataforma Trevo e o checklist completo de documentação necessária.</p>
      <p>2.2 O suporte inicial de onboarding inclui orientação sobre fluxo operacional, canais de comunicação e pontos de contato dedicados.</p>
    </section>
    <section class="pagina pagina-msa-clausulas">
      <header class="pag-header"><p>${escapeHtml(p.prospect_nome)}</p><p class="muted">Master Service Agreement — Cláusulas Contratuais</p></header>
      <h3 class="clausula-titulo">03 DA MODALIDADE CONTRATUAL</h3>
      <p>3.1 Na modalidade Avulsa, a prestação possui caráter pontual, encerrando-se com a conclusão do ato societário específico.</p>
      <p>3.2 Na modalidade Mensal/Recorrente, os serviços serão prestados de forma contínua, dentro dos limites do escopo contratado.</p>
      <p>3.3 A relação contratual é baseada em confiança mútua e resultados. Não há cláusulas de fidelização compulsória.</p>
      <h3 class="clausula-titulo">04 DOCUMENTAÇÃO E PRAZO</h3>
      <p>4.1 O início da contagem de qualquer prazo contratual está condicionado ao recebimento integral da documentação solicitada.</p>
      <p>4.2 A eventual antecipação de etapas por liberalidade da CONTRATADA não implica início formal de prazo.</p>
      <p>4.3 A inércia da CONTRATANTE por período superior a 30 (trinta) dias autoriza a suspensão ou encerramento da execução, sem restituição de valores já pagos.</p>
      <h3 class="clausula-titulo">05 DA NATUREZA JURÍDICA DA OBRIGAÇÃO</h3>
      <p>5.1 A obrigação assumida pela CONTRATADA é de meio, comprometendo-se a empregar técnica, diligência e expertise compatíveis com padrões profissionais elevados, sem garantia de resultado específico perante decisões discricionárias de órgãos públicos.</p>
      <p>5.2 A CONTRATADA não se responsabiliza por indeferimentos, exigências ou atrasos decorrentes de: I — análises discricionárias de órgãos públicos; II — instabilidades sistêmicas governamentais; III — alterações normativas supervenientes; IV — informações inexatas fornecidas pela CONTRATANTE; V — ausência de certificados digitais.</p>
      <h3 class="clausula-titulo">06 CERTIFICADOS DIGITAIS</h3>
      <p>6.1 Caso a CONTRATANTE forneça certificados digitais (e-CPF ou e-CNPJ), estes serão utilizados exclusivamente para a execução do objeto contratual.</p>
      <p>6.2 Na hipótese de não fornecimento, caberá exclusivamente à CONTRATANTE a realização das assinaturas necessárias.</p>
      <p>6.3 Os certificados eventualmente disponibilizados serão excluídos dos sistemas da CONTRATADA em até 30 (trinta) dias após a conclusão do serviço.</p>
    </section>
    <section class="pagina pagina-msa-clausulas">
      <header class="pag-header"><p>${escapeHtml(p.prospect_nome)}</p><p class="muted">Master Service Agreement — Cláusulas Contratuais</p></header>
      <h3 class="clausula-titulo">07 HONORÁRIOS E CONDIÇÕES FINANCEIRAS</h3>
      <p>7.1 Os valores devidos constam no Anexo II — Condições Financeiras, parte integrante deste instrumento.</p>
      <p>7.2 Tributos, taxas, emolumentos e encargos públicos não estão incluídos nos honorários e serão repassados ao custo real.</p>
      <p>7.3 Valores em atraso superior a 5 (cinco) dias poderão suspender a abertura de novos protocolos, mantendo os processos já em andamento até regularização do pagamento.</p>
      <h3 class="clausula-titulo">08 AJUSTES POR INFORMAÇÃO INCOMPLETA E SERVIÇOS ADICIONAIS</h3>
      <p>8.1 Exigências decorrentes de informações incorretas ou incompletas fornecidas pela CONTRATANTE — caracterizando retrabalho técnico — poderão ser cobradas no percentual de 50% (cinquenta por cento) do valor do processo original.</p>
      <p>8.2 Serviços não previstos no escopo contratado serão objeto de orçamento específico e aprovação prévia.</p>
      <h3 class="clausula-titulo">09 URGÊNCIA OPERACIONAL</h3>
      <p>9.1 Demandas com prazo inferior a 24 (vinte e quatro) horas caracterizam regime de urgência e poderão sofrer acréscimo de até 50% (cinquenta por cento) sobre os honorários, além das taxas de registro aplicáveis.</p>
      <h3 class="clausula-titulo">10 REAJUSTE</h3>
      <p>10.1 Nos contratos de natureza mensal, os valores poderão ser reajustados anualmente com base na variação acumulada do IPCA, mediante comunicação prévia de 30 (trinta) dias.</p>
      <h3 class="clausula-titulo">11 CONFIDENCIALIDADE</h3>
      <p>11.1 As partes obrigam-se a manter absoluto sigilo sobre quaisquer informações estratégicas, técnicas, comerciais ou operacionais a que tenham acesso em razão deste contrato.</p>
      <p>11.2 O descumprimento sujeitará o infrator ao pagamento de multa compensatória de R$ 20.000,00 (vinte mil reais), sem prejuízo de apuração de perdas e danos adicionais.</p>
    </section>
    <section class="pagina pagina-msa-clausulas">
      <header class="pag-header"><p>${escapeHtml(p.prospect_nome)}</p><p class="muted">Master Service Agreement — Cláusulas Contratuais</p></header>
      <h3 class="clausula-titulo">12 PROPRIEDADE INTELECTUAL</h3>
      <p>12.1 A metodologia, fluxos operacionais, padronizações societárias, estrutura tecnológica e demais ativos intangíveis utilizados na execução contratual são de titularidade exclusiva da CONTRATADA.</p>
      <p>12.2 É vedada a reprodução, compartilhamento ou utilização com finalidade concorrencial de qualquer ativo intelectual da CONTRATADA.</p>
      <h3 class="clausula-titulo">13 NÃO CONCORRÊNCIA E NÃO ALICIAMENTO</h3>
      <p>13.1 A CONTRATANTE compromete-se, pelo prazo de 24 (vinte e quatro) meses após o término contratual, a não: I — replicar metodologia ou modelo operacional da CONTRATADA para fins concorrenciais; II — aliciar colaboradores ou prestadores vinculados à CONTRATADA.</p>
      <h3 class="clausula-titulo">14 PROTEÇÃO DE DADOS</h3>
      <p>14.1 O tratamento de dados observará integralmente a Lei nº 13.709/2018 (LGPD) e suas regulamentações.</p>
      <p>14.2 Dados sensíveis serão eliminados em até 30 (trinta) dias após o encerramento da prestação.</p>
      <p>14.3 Dados cadastrais básicos poderão ser mantidos para fins de histórico contratual e cumprimento de obrigações legais.</p>
      <h3 class="clausula-titulo">15 LIMITAÇÃO DE RESPONSABILIDADE</h3>
      <p>15.1 A responsabilidade total da CONTRATADA, a qualquer título, limita-se ao valor efetivamente pago pela CONTRATANTE no contrato vigente.</p>
      <p>15.2 Ficam excluídos lucros cessantes, danos indiretos, reflexos ou consequências de qualquer natureza.</p>
      <h3 class="clausula-titulo">16 RESCISÃO</h3>
      <p>16.1 O presente contrato poderá ser rescindido por qualquer das partes mediante aviso prévio escrito de 30 (trinta) dias, sem penalidade.</p>
      <p>16.2 Serão devidos apenas os valores proporcionais aos serviços já executados até a data da rescisão.</p>
      <h3 class="clausula-titulo">17 FORÇA MAIOR</h3>
      <p>17.1 Eventos imprevisíveis ou inevitáveis suspendem temporariamente as obrigações da parte afetada, pelo prazo estritamente necessário à sua superação.</p>
      <h3 class="clausula-titulo">18 FORO</h3>
      <p>18.1 Fica eleito o Foro da Comarca de São Bernardo do Campo/SP, com renúncia expressa a qualquer outro, por mais privilegiado que seja.</p>
    </section>
    <section class="pagina pagina-msa-assinatura">
      <p class="local-data">São Paulo, ${fmtData(new Date())}.</p>
      <div class="assinaturas">
        <div>
          <div class="linha-assinatura"></div>
          <p class="ass-label">CONTRATADA</p>
          <p class="ass-nome">TREVO ASSESSORIA SOCIETÁRIA LTDA</p>
          <p>Thales Felipe Burger Soares</p>
          <p class="muted">CEO</p>
        </div>
        <div>
          <div class="linha-assinatura"></div>
          <p class="ass-label">CONTRATANTE</p>
          <p class="ass-nome">${escapeHtml(p.prospect_nome)}</p>
          ${p.prospect_contato ? `<p>${escapeHtml(p.prospect_contato)}</p>` : ''}
          <p class="muted">Representante Legal</p>
        </div>
      </div>
      <p class="msa-rodape-pdf">Este instrumento é gerado automaticamente pela plataforma TREVO ENGINE e integra o conjunto documental composto pela Proposta Comercial (Anexo I) e Condições Financeiras (Anexo II). O conjunto completo constitui o acordo entre as partes.</p>
    </section>
  `;

  return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8" /><title>Proposta Comercial — ${escapeHtml(p.prospect_nome)}</title><style>${CSS}</style></head><body>${capa}${escopo}${condicoes}${msa}</body></html>`;
}

// ─── Handler ────────────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  if (!PDFSHIFT_API_KEY) {
    console.error("[gerar-proposta-pdf] PDFSHIFT_API_KEY não configurada");
    return jsonResponse(503, { error: "PDFSHIFT_API_KEY_MISSING" });
  }

  let body: { orcamento_id?: string; force?: boolean };
  try { body = await req.json(); } catch { return jsonResponse(400, { error: "INVALID_JSON" }); }
  const { orcamento_id, force } = body;
  if (!orcamento_id) return jsonResponse(400, { error: "MISSING_orcamento_id" });

  try {
    const { data: orc, error: orcErr } = await admin
      .from("orcamentos").select("*")
      .eq("id", orcamento_id).eq("tipo_proposta", "terceirizacao")
      .maybeSingle();

    if (orcErr || !orc) {
      console.error("[gerar-proposta-pdf] orcamento não encontrado:", orcErr);
      return jsonResponse(404, { error: "ORCAMENTO_NOT_FOUND" });
    }

    if ((orc as any).terc_pdf_url && !force) {
      return jsonResponse(200, { ok: true, cached: true, pdf_url: (orc as any).terc_pdf_url });
    }

    const html = renderHTML(orc);

    console.log("[gerar-proposta-pdf] chamando PDFShift…");
    const pdfRes = await fetch("https://api.pdfshift.io/v3/convert/pdf", {
      method: "POST",
      headers: {
        "Authorization": "Basic " + btoa("api:" + PDFSHIFT_API_KEY),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ source: html, format: "A4", sandbox: false, delay: 1500 }),
    });

    if (!pdfRes.ok) {
      const errText = await pdfRes.text().catch(() => "");
      console.error("[gerar-proposta-pdf] PDFShift erro:", pdfRes.status, errText);
      return jsonResponse(502, { error: "PDFSHIFT_FAILED", status: pdfRes.status, detail: errText.substring(0, 500) });
    }

    const pdfBuffer = await pdfRes.arrayBuffer();
    const fileName = `PROP-${String((orc as any).numero).padStart(4, "0")}-${Date.now()}.pdf`;

    const { error: uploadErr } = await admin.storage
      .from(BUCKET_NAME)
      .upload(fileName, pdfBuffer, { contentType: "application/pdf", cacheControl: "3600", upsert: false });

    if (uploadErr) {
      console.error("[gerar-proposta-pdf] upload storage falhou:", uploadErr);
      return jsonResponse(500, { error: "STORAGE_UPLOAD_FAILED", detail: uploadErr.message });
    }

    const { data: pub } = admin.storage.from(BUCKET_NAME).getPublicUrl(fileName);
    const publicUrl = pub.publicUrl;

    await admin.from("orcamentos").update({ terc_pdf_url: publicUrl }).eq("id", orcamento_id);

    return jsonResponse(200, { ok: true, cached: false, pdf_url: publicUrl, file_name: fileName });
  } catch (e) {
    console.error("[gerar-proposta-pdf] erro inesperado:", e);
    return jsonResponse(500, { error: "UNEXPECTED", detail: e instanceof Error ? e.message : String(e) });
  }
});

function jsonResponse(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
