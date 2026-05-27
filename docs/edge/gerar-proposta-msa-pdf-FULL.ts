// =============================================
// Edge Function: gerar-proposta-msa-pdf
// =============================================
// 26/05/2026 — REWRITE 3: hybrid approach
//   • PROPOSTA (3 páginas) → HTML → PDFShift (visual customizável)
//   • MSA (14 páginas)     → Google Docs API (template visual fiel)
//   • Merge dos 2 PDFs     → pdf-lib
//
// Secrets necessários:
//   PDFSHIFT_API_KEY              (sk_...)
//   GOOGLE_SERVICE_ACCOUNT_KEY    (JSON da service account)
//
// Template Doc:
//   1YN4a1emE7R9OADlMX-QCbdydyBBZHSdMW2N6xtfeStw
//
// Placeholders no template Doc (mapeados via Docs API):
//   {{RAZAO_SOCIAL}}     ← prospect_nome
//   {{CNPJ}}             ← prospect_cnpj
//   {{ENDERECO_EMPRESA}} ← linha em branco (não temos no banco)
//   {{REP_NOME}}         ← prospect_contato
//   {{REP_RG}}           ← linha em branco
//   {{REP_CPF}}          ← linha em branco
//   {{REP_NAC}}          ← linha em branco
//   {{REP_EST_CIVIL}}    ← linha em branco
//   {{REP_PROF}}         ← linha em branco
//   {{REP_END}}          ← linha em branco
//   {{CIDADE}}           ← "São Paulo"
//   {{DATA_EXTENSO}}     ← data atual por extenso
// =============================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { PDFDocument } from "https://esm.sh/pdf-lib@1.17.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const PDFSHIFT_API_KEY = Deno.env.get("PDFSHIFT_API_KEY") ?? "";
const GOOGLE_SA_KEY = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_KEY") ?? "";
const BUCKET_NAME = "propostas-pdf";
const TEMPLATE_DOC_ID = "1YN4a1emE7R9OADlMX-QCbdydyBBZHSdMW2N6xtfeStw";
const PLACEHOLDER_VAZIO = "________________________";

const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

// ─── Catálogo de regras rápidas (cláusulas pré-definidas) ───────────────────
const REGRAS_CATALOGO: Array<{ id: string; texto: string }> = [
  { id: 'mat',              texto: 'A responsabilidade técnica, preenchimento e envio do Módulo de Administração Tributária (MAT) permanecerá sob encargo EXCLUSIVO da Contabilidade.' },
  { id: 'troca_uf',         texto: 'Processos que envolvam transferência de UF serão cobrados como 2 processos avulsos.' },
  { id: 'doc_completa',     texto: 'PRAZO: O prazo de 5 dias úteis inicia-se EXCLUSIVAMENTE após recebimento de 100% da documentação solicitada.' },
  { id: 'alvaras_600',      texto: 'ALVARÁS EXTRAS: Processos que exijam Alvarás e Licenças (não inclusos no serviço) terão cobrança adicional de R$ 600,00 por processo + taxas + responsável técnico.' },
  { id: 'taxas_fora',       texto: 'TAXAS GOVERNAMENTAIS: DAREs, DARFs, emolumentos e guias oficiais NÃO estão inclusos nos honorários.' },
  { id: 'fast_track',       texto: 'URGÊNCIA (FAST TRACK): Solicitações com prazo inferior a 24h terão acréscimo de 50% sobre o valor + taxa de registro junta e regional.' },
  { id: 'retrabalho',       texto: 'RETRABALHO: Exigências decorrentes de dados incorretos fornecidos pela CONTRATANTE serão cobradas 50% a mais do valor do processo avulso.' },
  { id: 'inadimplencia',    texto: 'INADIMPLÊNCIA: Atrasos superiores a 5 dias resultarão em suspensão imediata do acesso à plataforma e protocolização de novos processos.' },
  { id: 'lgpd',             texto: 'LGPD: A CONTRATANTE autoriza a CONTRATADA a tratar dados pessoais exclusivamente para execução deste contrato, conforme Lei 13.709/2018.' },
  { id: 'escopo_estendido', texto: 'ESCOPO ESTENDIDO: Processos que excederem a complexidade média prevista no escopo contratual (ex: holdings patrimoniais com múltiplos imóveis a integralizar, sociedades anônimas com estrutura ampla, contratos extensos ou cláusulas atípicas) serão analisados caso a caso e poderão sofrer cobrança de honorário adicional, mediante orçamento prévio e aprovação por escrito da CONTRATANTE.' },
];

const MODALIDADE_LABEL: Record<string, string> = {
  avulso: 'Avulso',
  pro_5: 'Plano PRO',
  preco_por_tipo: 'Preço por tipo',
  custom: 'Customizado',
};

// ─── Helpers ────────────────────────────────────────────────────────────────
function fmtBRL(v: number): string {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
function fmtBRLnoSym(v: number): string {
  return v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtData(d: string | Date): string {
  const date = typeof d === 'string' ? new Date(d) : d;
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
}
function fmtDataCurta(d: string | Date): string {
  const date = typeof d === 'string' ? new Date(d) : d;
  return date.toLocaleDateString('pt-BR');
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

// ═══════════════════════════════════════════════════════════════════════════
// PARTE 1 — Google Auth + Drive/Docs API
// ═══════════════════════════════════════════════════════════════════════════

interface ServiceAccountKey {
  client_email: string;
  private_key: string;
  project_id: string;
}

function base64UrlEncode(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let bin = '';
  for (let i = 0; i < bytes.byteLength; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function strToBase64Url(s: string): string {
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function importPrivateKey(pem: string): Promise<CryptoKey> {
  // Remove headers/newlines do PEM
  const b64 = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\s/g, '');
  const der = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
  return await crypto.subtle.importKey(
    'pkcs8',
    der.buffer,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );
}

// Conta a impersonar via Domain-Wide Delegation (precisa ter Drive/Docs habilitado).
// Necessário porque service accounts em Workspace têm 0 bytes de storage no Drive
// — sem impersonação, files.copy retorna 403 storageQuotaExceeded.
const IMPERSONATE_USER = 'dani.ai@trevolegaliza.com';

async function getGoogleAccessToken(sa: ServiceAccountKey, scope: string): Promise<string> {
  const header = strToBase64Url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const now = Math.floor(Date.now() / 1000);
  const claims = strToBase64Url(JSON.stringify({
    iss: sa.client_email,
    sub: IMPERSONATE_USER,
    scope,
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  }));
  const unsigned = `${header}.${claims}`;
  const key = await importPrivateKey(sa.private_key);
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(unsigned));
  const jwt = `${unsigned}.${base64UrlEncode(sig)}`;

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });
  if (!res.ok) {
    throw new Error(`Google OAuth falhou: ${res.status} ${await res.text()}`);
  }
  const data = await res.json();
  return data.access_token as string;
}

// Drive: copy file
async function driveCopy(token: string, fileId: string, newName: string): Promise<string> {
  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}/copy`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: newName }),
  });
  if (!res.ok) {
    throw new Error(`drive.copy falhou: ${res.status} ${await res.text()}`);
  }
  const data = await res.json();
  return data.id as string;
}

// Docs: replace all text (batch)
async function docsReplaceAllText(token: string, docId: string, replacements: Record<string, string>): Promise<void> {
  const requests = Object.entries(replacements).map(([placeholder, value]) => ({
    replaceAllText: {
      containsText: { text: placeholder, matchCase: true },
      replaceText: value,
    },
  }));
  const res = await fetch(`https://docs.googleapis.com/v1/documents/${docId}:batchUpdate`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ requests }),
  });
  if (!res.ok) {
    throw new Error(`docs.batchUpdate falhou: ${res.status} ${await res.text()}`);
  }
}

// Drive: export as PDF (returns binary)
async function driveExportPdf(token: string, fileId: string): Promise<Uint8Array> {
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=application/pdf`,
    { headers: { 'Authorization': `Bearer ${token}` } }
  );
  if (!res.ok) {
    throw new Error(`drive.export falhou: ${res.status} ${await res.text()}`);
  }
  return new Uint8Array(await res.arrayBuffer());
}

// Drive: delete file
async function driveDelete(token: string, fileId: string): Promise<void> {
  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${token}` },
  });
  // Silencioso em caso de erro — não bloquear fluxo
  if (!res.ok) {
    console.warn(`[drive.delete] falhou ao deletar ${fileId}: ${res.status}`);
  }
}

// Gera o MSA via Docs API (cópia → replace → export → delete)
async function gerarMsaPdf(p: any): Promise<Uint8Array> {
  const sa = JSON.parse(GOOGLE_SA_KEY) as ServiceAccountKey;
  const scope = [
    'https://www.googleapis.com/auth/documents',
    'https://www.googleapis.com/auth/drive',
  ].join(' ');
  const token = await getGoogleAccessToken(sa, scope);
  console.log('[gerar-msa] token OAuth obtido');

  // 1. Copia template
  const copyName = `MSA-${p.prospect_nome}-${Date.now()}`;
  const copyId = await driveCopy(token, TEMPLATE_DOC_ID, copyName);
  console.log(`[gerar-msa] cópia criada: ${copyId}`);

  try {
    // 2. Substitui placeholders — usa valores reais quando preenchidos no form,
    //    cai pra "________________" (linha tracejada) quando não tem (cliente
    //    preenche manualmente na hora de assinar).
    const dataExtenso = fmtData(new Date());
    const replacements: Record<string, string> = {
      '{{RAZAO_SOCIAL}}':     p.prospect_nome              || PLACEHOLDER_VAZIO,
      '{{CNPJ}}':             p.prospect_cnpj              || PLACEHOLDER_VAZIO,
      '{{ENDERECO_EMPRESA}}': p.prospect_endereco          || PLACEHOLDER_VAZIO,
      '{{REP_NOME}}':         p.prospect_contato           || PLACEHOLDER_VAZIO,
      '{{REP_RG}}':           p.prospect_rep_rg            || PLACEHOLDER_VAZIO,
      '{{REP_CPF}}':          p.prospect_rep_cpf           || PLACEHOLDER_VAZIO,
      '{{REP_NAC}}':          p.prospect_rep_nacionalidade || PLACEHOLDER_VAZIO,
      '{{REP_EST_CIVIL}}':    p.prospect_rep_estado_civil  || PLACEHOLDER_VAZIO,
      '{{REP_PROF}}':         p.prospect_rep_profissao     || PLACEHOLDER_VAZIO,
      '{{REP_END}}':          p.prospect_rep_endereco      || PLACEHOLDER_VAZIO,
      '{{CIDADE}}':           'São Paulo',
      '{{DATA_EXTENSO}}':     dataExtenso,
    };
    await docsReplaceAllText(token, copyId, replacements);
    console.log('[gerar-msa] placeholders substituídos');

    // 3. Export PDF
    const pdfBytes = await driveExportPdf(token, copyId);
    console.log(`[gerar-msa] PDF exportado (${pdfBytes.length} bytes)`);

    return pdfBytes;
  } finally {
    // 4. Delete cópia (cleanup)
    await driveDelete(token, copyId);
    console.log('[gerar-msa] cópia deletada');
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// PARTE 2 — HTML da Proposta (3 páginas: capa + escopo + condições)
// ═══════════════════════════════════════════════════════════════════════════

// Logo Trevo Legaliza embebido em base64 (PNG real, 50KB → ~67KB base64).
// Embedded inline pra render via PDFShift sem dependência de URL externa.
const LOGO_TREVO_PNG_B64 = "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AgoBhYBCQCGgEFAIKAQUAgoBhYBCQCGgEFAIKAQUAgoBhYBCQCGgEFAIKAQUAgoBhYBCQCGgEFAIKAQUAgoBhYBCQCGgEFAIKAQUAgoBhYBCQCGgEFAIKAQUAgoBhYBCQCGgEFAIKAQUAgoBhcD/b9cOcQAAQBAAzv9/2mYm4naNYGAXHQQIECBAgAABAgQIECBAgAABAgQIECBAgAABAgQIECBAgAABAgQIECBAgAABAgQIECBAgAABAgQIECBAgAABAgQIECBAgAABAgQIECBAgAABAgQIECBAgAABAgQIECBAgAABAgQIECBAgAABAgQIECBAgAABAgQIECBAgAABAgQIECBAgAABAgQIECBAgAABAgQIECBAgAABAgQIECBAgAABAgQIECBAgAABAgQIECBAgAABAgQIEGgTmLZC+hAgQIAAAQIECBAgQIAAAQIECBAgQOAEfDCPQiBAgAABAgQIECBAgAABAgQIECBAgAABAgQIECBAgAABAgQIECBAgAABAgRSAQPEVModAQIECBAgQIAAAQIECBAgQIAAAQIECBAgQIAAAQIECBAgQIAAAQIECBAgQIAAAQIECBAgQIAAAQIECBAgQOC3wAK/eORriDjS+wAAAABJRU5ErkJggg==";

// SVG decorativo de curva sutil — mesma vibe da curva do template MSA
/* ============================================================
 * renderPropostaHTML(p) — v4 (27/05/2026)
 * ------------------------------------------------------------
 * v4 incorpora 22 fixes da auditoria multi-disciplinar:
 *  - BUG-01: mapping completo de TODAS modalidades
 *  - BUG-02: modalidade null/inválida → fallback gracioso
 *  - BUG-03: CNPJ com máscara automática
 *  - BUG-04: cliente PF mostra CPF (não CNPJ)
 *  - BUG-05: created_at inválido → fallback now()
 *  - BUG-09: typo "executado ." corrigido
 *  - BUG-10: preco_por_tipo sem valores → mensagem
 *  - BUG-11: dia_pagamento mostrado mesmo se não pro_5
 *  - BUG-12: prospect_telefone aparece no addressee
 *  - BUG-13: incluso label truncado se >40 chars
 *  - BUG-15: observacoes_publicas truncadas se >500 chars
 *  - BUG-16/DSG-02: telefone footer com nowrap
 *  - BUG-17: valor 0 → "Sob consulta"
 *  - BUG-18: validade < 1 → mínimo 1 dia
 *  - BUG-19: sub da capa sem repetir stats
 *  - COM-01: CTA + menção do envio ClickSign automático
 *  - COM-04: prazo de início (2 dias + 30min onboarding)
 *  - COM-05: bonificação "5º processo cortesia se aceito até X"
 *  - CEO-02: hero "A maior do Brasil" → "Líder em regularização" (suavizado)
 *  - CEO-03: aviso de confidencialidade no footer
 *  - DSG-04: /processo em mesma família de fonte
 *  - DSG-05: padding binding com mais respiro
 * ============================================================ */

// ───────── CONFIG editável (BUG-06/07/08 — extraído pra const) ─────────
// FUTURO: ler de empresas_config quando ERP virar SaaS multi-tenant.
const TREVO_INFO = {
  razao_social: 'Trevo Assessoria Societária LTDA',
  cnpj: '39.969.412/0001-70',
  site: 'trevolegaliza.com',
  email: 'administrativo@trevolegaliza.com.br',
  telefone: '(11) 93492-7001',
  // Estatísticas exibidas no hero da capa (atualizar conforme crescimento real)
  stats: {
    contadores: '3.800+',
    processos: '47k+',
    estados: '27/27',
    paises: '7',
  },
  // Tagline + hero. CEO-02: suavizado de "A maior do Brasil. Literalmente."
  capa: {
    rank_badge: 'Líder do segmento',
    tagline_bar: 'Regularização societária · B2B exclusivo',
    hero_title_1: 'A referência brasileira em',
    hero_title_2: 'regularização societária.',
    hero_sub: 'Plataforma especializada em escritórios contábeis, com atuação nacional e internacional. Operação industrial, SLA contratual e rastreabilidade integral.',
  },
};

// ───────── MODALIDADE_CONFIG (BUG-01 — mapping completo) ─────────
interface ModalidadeConfig {
  label: string;
  pageSubLabel: string;
  primaryLabel: string;
  primarySuffix: string;
  primaryValue: (p: any) => number;
  valueFoot: string;
  showAbertura?: boolean;
  showDiaPagamento?: boolean;
  renderTable?: boolean;
}

const MODALIDADE_CFG: Record<string, ModalidadeConfig> = {
  avulso: {
    label: 'avulso',
    pageSubLabel: 'cobrança por processo executado',
    primaryLabel: 'Honorários do Processo',
    primarySuffix: '/processo',
    primaryValue: (p) => Number(p.terc_valor_base) || 0,
    valueFoot: 'Honorário Trevo por processo · taxas e emolumentos à parte',
    showAbertura: true,
  },
  pro_5: {
    label: 'PRO (5/mês)',
    pageSubLabel: 'pacote mensal recorrente · 5 processos inclusos',
    primaryLabel: 'Investimento Mensal',
    primarySuffix: '/mês',
    primaryValue: (p) => (Number(p.terc_valor_pro) || 0) * 5,
    valueFoot: 'Pacote PRO · 5 processos inclusos por mês',
    showDiaPagamento: true,
  },
  enterprise_10: {
    label: 'Enterprise (10/mês)',
    pageSubLabel: 'pacote mensal corporativo · 10 processos inclusos',
    primaryLabel: 'Investimento Mensal',
    primarySuffix: '/mês',
    primaryValue: (p) => (Number(p.terc_valor_pro) || 0) * 10,
    valueFoot: 'Pacote Enterprise · 10 processos inclusos por mês',
    showDiaPagamento: true,
  },
  custom: {
    label: 'Customizado',
    pageSubLabel: 'plano customizado conforme volume e desconto contratado',
    primaryLabel: 'Investimento Customizado',
    primarySuffix: '/processo',
    primaryValue: (p) => Number(p.terc_valor_base) || 0,
    valueFoot: 'Valores customizados por volume — vide observações',
    showAbertura: true,
    showDiaPagamento: true,
  },
  preco_por_tipo: {
    label: 'preço por tipo de processo',
    pageSubLabel: 'tabela individual por categoria',
    primaryLabel: 'Tabela por tipo de processo',
    primarySuffix: '',
    primaryValue: () => 0,
    valueFoot: '',
    renderTable: true,
  },
};

function renderPropostaHTML(p: any): string {
  // ───────── helpers ─────────
  const esc = (s: any): string =>
    String(s ?? '').replace(/[&<>"']/g, (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' } as Record<string, string>)[c]
    );

  const fmtBRL = (n: number): string =>
    'R$ ' +
    (Number(n) || 0).toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

  const fmtDate = (d: Date): string => {
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    return `${dd}/${mm}/${d.getFullYear()}`;
  };

  // BUG-03/04 fix: formatador dinâmico de documento (CNPJ ou CPF baseado em qtd dígitos)
  const fmtDocumento = (raw: string | null | undefined): { label: string; valor: string } => {
    if (!raw) return { label: 'CNPJ/CPF', valor: '—' };
    const digits = String(raw).replace(/\D/g, '');
    if (digits.length === 14) {
      const v = `${digits.slice(0,2)}.${digits.slice(2,5)}.${digits.slice(5,8)}/${digits.slice(8,12)}-${digits.slice(12,14)}`;
      return { label: 'CNPJ', valor: v };
    }
    if (digits.length === 11) {
      const v = `${digits.slice(0,3)}.${digits.slice(3,6)}.${digits.slice(6,9)}-${digits.slice(9,11)}`;
      return { label: 'CPF', valor: v };
    }
    // BUG-03 fix: input inválido (com letras, fora do padrão) — mostra raw escapado mas avisa "inválido"
    return { label: 'CNPJ/CPF', valor: String(raw) };
  };

  // BUG-17 fix: valor 0 mostra "Sob consulta" no value-big
  const fmtValorOuConsulta = (v: number): { isConsulta: boolean; valor: string } => {
    if (!v || v <= 0) return { isConsulta: true, valor: 'Sob consulta' };
    return {
      isConsulta: false,
      valor: v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    };
  };

  // ───────── modalidade (BUG-01/02 fix) ─────────
  const modalCfg = MODALIDADE_CFG[p.terc_modalidade] || MODALIDADE_CFG.avulso;
  const isPro = p.terc_modalidade === 'pro_5' || p.terc_modalidade === 'enterprise_10';
  const isPrecoTipo = p.terc_modalidade === 'preco_por_tipo';

  // Valor com override > 0
  let primaryValue = modalCfg.primaryValue(p);
  if (p.terc_valor_final_override && Number(p.terc_valor_final_override) > 0) {
    primaryValue = Number(p.terc_valor_final_override);
  }

  // BUG-05 fix: validação de created_at
  const created = (() => {
    const d = new Date(p.created_at || Date.now());
    return isNaN(d.getTime()) ? new Date() : d;
  })();
  // BUG-18 fix: validade mínima de 1 dia (já tem clamp no form, defesa-em-profundidade)
  const validade = Math.max(1, Number(p.validade_dias) || 15);
  const exp = new Date(created);
  exp.setDate(exp.getDate() + validade);
  const expStr = fmtDate(exp);
  const createdStr = fmtDate(created);

  // ───────── catálogos ─────────
  const REGRAS_CATALOGO: Record<string, string> = {
    mat: 'A responsabilidade técnica, preenchimento e envio do Módulo de Administração Tributária (MAT) permanecerá sob encargo EXCLUSIVO da Contabilidade.',
    troca_uf: 'Processos que envolvam transferência de UF serão cobrados como 2 processos avulsos.',
    doc_completa: 'PRAZO: O prazo de 5 dias úteis inicia-se EXCLUSIVAMENTE após recebimento de 100% da documentação solicitada.',
    alvaras_600: 'ALVARÁS EXTRAS: Processos que exijam Alvarás e Licenças (não inclusos no serviço) terão cobrança adicional de R$ 600,00 por processo + taxas + responsável técnico.',
    taxas_fora: 'TAXAS GOVERNAMENTAIS: DAREs, DARFs, emolumentos e guias oficiais NÃO estão inclusos nos honorários.',
    fast_track: 'URGÊNCIA (FAST TRACK): Solicitações com prazo inferior a 24h terão acréscimo de 50% sobre o valor + taxa de registro junta e regional.',
    retrabalho: 'RETRABALHO: Exigências decorrentes de dados incorretos fornecidos pela CONTRATANTE serão cobradas 50% a mais do valor do processo avulso.',
    inadimplencia: 'INADIMPLÊNCIA: Atrasos superiores a 5 dias resultarão em suspensão imediata do acesso à plataforma e protocolização de novos processos.',
    lgpd: 'LGPD: A CONTRATANTE autoriza a CONTRATADA a tratar dados pessoais exclusivamente para execução deste contrato, conforme Lei 13.709/2018.',
    escopo_estendido:
      'ESCOPO ESTENDIDO: Processos que excederem a complexidade média prevista no escopo contratual (ex: holdings patrimoniais com múltiplos imóveis a integralizar, sociedades anônimas com estrutura ampla, contratos extensos ou cláusulas atípicas) serão analisados caso a caso e poderão sofrer cobrança de honorário adicional, mediante orçamento prévio e aprovação por escrito da CONTRATANTE.',
  };

  const TIPO_LABELS: Record<string, string> = {
    abertura: 'Abertura de empresa',
    alteracao: 'Alteração contratual',
    baixa: 'Baixa de empresa',
    transformacao: 'Transformação societária',
    encerramento: 'Encerramento',
  };

  // ───────── renderers ─────────
  const renderChips = (items: any[]): string =>
    (items || [])
      .map(
        (it) =>
          `<span class="chip ${it.ativo ? 'chip-on' : 'chip-off'}">${esc(it.label)}</span>`
      )
      .join('');

  const renderInclusos = (items: any[]): string =>
    (items || [])
      .map(
        (it) => `
        <div class="incl ${it.ativo ? 'incl-on' : 'incl-off'}">
          <div class="incl-ico">${it.ativo ? '✓' : '✕'}</div>
          <div class="incl-body">
            <div class="incl-label">${esc(it.label)}</div>
            ${it.descricao ? `<div class="incl-desc">${esc(it.descricao)}</div>` : ''}
          </div>
        </div>`
      )
      .join('');

  const renderTipoTable = (): string => {
    const precos = p.terc_precos_por_tipo || {};
    const rows = Object.entries(precos)
      .filter(([, v]) => Number(v) > 0)
      .map(
        ([k, v]) => `
        <div class="tipo-row">
          <span class="tipo-name">${esc(TIPO_LABELS[k] || k)}</span>
          <span class="tipo-dot"></span>
          <span class="tipo-val">${fmtBRL(Number(v))}</span>
        </div>`
      )
      .join('');
    // BUG-10 fix: fallback se nenhum preço preenchido
    if (!rows) {
      return `<div class="tipo-table"><div style="text-align:center;color:var(--fg-3);font-size:11px;padding:6mm 0">Tabela de preços a definir conforme escopo. Detalhamento em call.</div></div>`;
    }
    return `<div class="tipo-table">${rows}</div>`;
  };

  const renderRegras = (): string => {
    const regras = (p.terc_regras_rapidas_ativas || [])
      .map((id: string) => REGRAS_CATALOGO[id])
      .filter(Boolean);
    const items = regras
      .map(
        (txt: string, i: number) => `
        <div class="rule">
          <div class="rule-num">§ ${String(i + 1).padStart(2, '0')}</div>
          <div class="rule-txt">${esc(txt)}</div>
        </div>`
      )
      .join('');
    // BUG-15 fix: trunca observação se >500 chars (evita estouro)
    let obsText = p.terc_observacoes_publicas || '';
    let truncated = false;
    if (obsText.length > 500) {
      obsText = obsText.slice(0, 497) + '…';
      truncated = true;
    }
    const obs = obsText
      ? `<div class="rule rule-obs">
           <div class="rule-num">§ ${String(regras.length + 1).padStart(2, '0')}</div>
           <div class="rule-txt"><strong>Observações adicionais.</strong><br/>${esc(obsText).replace(/\n/g, '<br/>')}${truncated ? ' <em>(continuação detalhada em call)</em>' : ''}</div>
         </div>`
      : '';
    return items + obs;
  };

  // proposta nº: prioriza numero do ERP (PROP-NNNN), fallback hash CNPJ
  const propostaId = p.numero
    ? `PROP-${String(p.numero).padStart(4, '0')}`
    : 'PROP-' + String(created.getFullYear()) +
      '-' + String(created.getMonth() + 1).padStart(2, '0') +
      String(created.getDate()).padStart(2, '0') +
      '-' + (p.prospect_cnpj || '00000000').replace(/\D/g, '').slice(-4);

  // contatos (BUG-12 fix: prospect_telefone passa a aparecer)
  const contato = p.prospect_contato ? esc(p.prospect_contato) : null;
  const docInfo = fmtDocumento(p.prospect_cnpj);
  const telefoneClienteEsc = p.prospect_telefone ? esc(p.prospect_telefone) : null;
  const emailClienteEsc = p.prospect_email ? esc(p.prospect_email) : null;

  // header bar HTML (reused on every page)
  const headerBar = `
    <div class="hdr">
      <div class="hdr-l">
        <img class="hdr-logo" src="{{LOGO_TREVO_BASE64}}" alt="Trevo Legaliza"/>
        <div class="hdr-id">
          <div class="hdr-id-meta">CNPJ ${esc(TREVO_INFO.cnpj)}<br/>${esc(TREVO_INFO.site)}</div>
        </div>
      </div>
      <div class="hdr-r">
        <span class="hdr-pill">${esc(propostaId)}</span>
      </div>
    </div>`;

  // footer bar HTML (DSG-02/BUG-16 fix: telefone com nowrap; CEO-03: confidencialidade)
  const footerBar = (pageNum: number, pageTitle: string) => `
    <div class="ftr">
      <div class="ftr-l">
        <span class="ftr-trevo">${esc(TREVO_INFO.razao_social)} · ${esc(TREVO_INFO.site)} · ${esc(TREVO_INFO.email)} · <span class="nowrap">${esc(TREVO_INFO.telefone)}</span></span>
        <span class="ftr-conf">CONFIDENCIAL · Uso exclusivo de ${esc(p.prospect_nome || 'destinatário identificado')}</span>
      </div>
      <div class="ftr-r">${esc(pageTitle)} · ${pageNum} / 3</div>
    </div>`;

  // BUG-09 fix: subtítulo p2 sem typo "executado ."
  const p2Sub = (() => {
    const parts = [
      `Modalidade <strong>${esc(modalCfg.label)}</strong>`,
      modalCfg.pageSubLabel,
    ];
    if (p.terc_dia_pagamento && (modalCfg.showDiaPagamento || isPro)) {
      parts.push(`cobrança todo dia ${esc(p.terc_dia_pagamento)}`);
    }
    return parts.join(' · ') + '.';
  })();

  // ════════════════════════════════════════════════════════════
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Proposta Comercial — ${esc(p.prospect_nome || '')}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">
<style>
  /* ── page ─────────────────────────────────────────── */
  @page { size: A4 portrait; margin: 0; }
  *, *::before, *::after { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }

  :root {
    --bg:          #ffffff;
    --bg-soft:     #f6f8fb;
    --surface-1:   #ffffff;
    --surface-2:   #eef2f7;
    --fg-1:        #0b1220;
    --fg-2:        rgba(11,18,32,0.72);
    --fg-3:        rgba(11,18,32,0.50);
    --fg-4:        rgba(11,18,32,0.30);
    --border:      rgba(11,18,32,0.08);
    --border-s:    rgba(11,18,32,0.14);
    --brand:       #16a34a;
    --brand-deep:  #0f7a37;
    --brand-soft:  rgba(22,163,74,0.08);
    --brand-bord:  rgba(22,163,74,0.28);
    --cyan:        #0891b2;
    --danger:      #dc2626;
    --font-sans:   'Inter', system-ui, sans-serif;
    --font-mono:   'JetBrains Mono', ui-monospace, Menlo, monospace;
  }

  body {
    font-family: var(--font-sans);
    background: var(--bg);
    color: var(--fg-1);
    font-size: 12px;
    line-height: 1.5;
    -webkit-font-smoothing: antialiased;
    text-rendering: optimizeLegibility;
  }

  .nowrap { white-space: nowrap; }

  .pagina {
    width: 210mm;
    height: 297mm;
    position: relative;
    overflow: hidden;
    background: var(--bg);
    padding: 12mm 18mm 10mm;
    display: flex;
    flex-direction: column;
  }
  .pagina:not(:last-child) { page-break-after: always; }

  .pagina::before {
    content: "";
    position: absolute;
    inset: 0;
    background-image:
      linear-gradient(rgba(22,163,74,0.05) 1px, transparent 1px),
      linear-gradient(90deg, rgba(22,163,74,0.05) 1px, transparent 1px);
    background-size: 14mm 14mm;
    -webkit-mask-image: radial-gradient(ellipse at 50% 35%, black 25%, transparent 78%);
            mask-image: radial-gradient(ellipse at 50% 35%, black 25%, transparent 78%);
    pointer-events: none;
    z-index: 0;
  }
  .pagina::after {
    content: "";
    position: absolute;
    width: 180mm; height: 180mm;
    top: -90mm; left: -70mm;
    background: rgba(22,163,74,0.08);
    filter: blur(90px);
    border-radius: 50%;
    pointer-events: none;
    z-index: 0;
  }
  .pagina.p2::after {
    background: rgba(8,145,178,0.05);
    top: auto; bottom: -90mm; left: auto; right: -70mm;
  }
  .pagina.p3::after { opacity: 0.4; }
  .pagina > * { position: relative; z-index: 1; }

  /* ── header bar ──────────────── */
  .hdr {
    display: flex; align-items: center; justify-content: space-between;
    padding-bottom: 6mm;
    border-bottom: 1px solid var(--border);
    margin-bottom: 6mm;
  }
  .hdr-l { display: flex; align-items: center; gap: 14px; }
  .hdr-logo {
    height: 56px; width: auto; object-fit: contain;
    flex-shrink: 0;
  }
  .hdr-id-meta {
    font-family: var(--font-mono);
    font-size: 9px; color: var(--fg-3);
    letter-spacing: 0.04em;
    line-height: 1.5;
    white-space: nowrap;
  }
  .hdr-pill {
    font-family: var(--font-mono);
    font-size: 9px; font-weight: 500;
    letter-spacing: 0.12em; text-transform: uppercase;
    color: var(--brand-deep);
    padding: 5px 10px;
    border: 1px solid var(--brand-bord);
    background: var(--brand-soft);
    border-radius: 999px;
    display: inline-flex; align-items: center; gap: 6px;
    white-space: nowrap;
  }
  .hdr-pill::before {
    content: ""; width: 5px; height: 5px; border-radius: 50%;
    background: var(--brand);
  }

  /* ── footer bar (DSG-02 fix: telefone com nowrap + CEO-03 conf) ───── */
  .ftr {
    margin-top: auto;
    padding-top: 6mm;
    border-top: 1px solid var(--border);
    display: flex; align-items: flex-end; justify-content: space-between;
    gap: 10mm;
    font-family: var(--font-mono);
    font-size: 8.5px; color: var(--fg-4);
    letter-spacing: 0.06em;
  }
  .ftr-l { display: flex; flex-direction: column; gap: 3px; }
  .ftr-trevo { color: var(--fg-4); }
  .ftr-conf { color: var(--brand-deep); font-weight: 600; letter-spacing: 0.08em; }
  .ftr-r { color: var(--fg-3); white-space: nowrap; flex-shrink: 0; }

  /* ── eyebrow ──────────────────── */
  .eyebrow {
    display: inline-flex; align-items: center; gap: 10px;
    font-family: var(--font-mono);
    font-size: 10px; color: var(--brand);
    letter-spacing: 0.18em; text-transform: uppercase;
    margin-bottom: 14px;
  }
  .eyebrow::before {
    content: ""; width: 24px; height: 1px; background: var(--brand);
  }

  /* ════════════════════════════════════════════════════
     PAGE 1 — CAPA
     ════════════════════════════════════════════════════ */

  .capa-rank {
    display: inline-flex; align-items: center; gap: 10px;
    padding: 7px 14px 7px 8px;
    border: 1px solid var(--brand-bord);
    background: linear-gradient(135deg, rgba(22,163,74,0.12), rgba(22,163,74,0.02));
    border-radius: 999px;
    margin-bottom: 6mm;
    white-space: nowrap;
  }
  .capa-rank-num {
    display: inline-flex; align-items: center; justify-content: center;
    width: 22px; height: 22px; border-radius: 50%;
    background: var(--brand); color: #fff;
    font-family: var(--font-mono);
    font-size: 11px; font-weight: 700;
    box-shadow: 0 0 0 3px rgba(22,163,74,0.12);
  }
  .capa-rank-txt {
    font-family: var(--font-mono);
    font-size: 10px; font-weight: 600;
    letter-spacing: 0.16em; text-transform: uppercase;
    color: var(--brand-deep);
  }
  .capa-rank-sep {
    width: 1px; height: 12px; background: var(--brand-bord);
  }
  .capa-rank-meta {
    font-family: var(--font-mono);
    font-size: 9.5px; font-weight: 500;
    letter-spacing: 0.10em; text-transform: uppercase;
    color: var(--fg-3);
  }

  .capa h1 {
    font-family: var(--font-sans);
    font-size: 56px;
    font-weight: 800;
    letter-spacing: -0.04em;
    line-height: 1.02;
    margin: 0 0 5mm;
    color: var(--fg-1);
    max-width: 175mm;
    text-wrap: balance;
  }
  .capa h1 .accent {
    color: var(--brand);
    display: inline-block;
    font-style: italic;
    letter-spacing: -0.04em;
  }

  .capa-sub {
    font-size: 13px;
    line-height: 1.55;
    color: var(--fg-2);
    margin: 0 0 6mm;
    max-width: 165mm;
    text-wrap: pretty;
  }
  .capa-sub strong {
    color: var(--fg-1);
    font-weight: 600;
  }

  .proof {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    border-top: 1px solid var(--fg-1);
    border-bottom: 1px solid var(--border);
    margin-bottom: 6mm;
    position: relative;
  }
  .proof::before {
    content: "";
    position: absolute;
    top: -1px; left: 0; height: 2px; width: 28%;
    background: var(--brand);
  }
  .proof-cell {
    padding: 5mm 5mm 5mm 5mm;
    border-right: 1px solid var(--border);
  }
  .proof-cell:first-child { padding-left: 0; }
  .proof-cell:last-child { border-right: none; padding-right: 0; }
  .proof-v {
    font-size: 32px; font-weight: 800;
    letter-spacing: -0.04em;
    font-variant-numeric: tabular-nums;
    line-height: 1;
    display: flex; align-items: baseline; gap: 2px;
    color: var(--fg-1);
  }
  .proof-v .u {
    font-size: 14px; font-weight: 700;
    color: var(--brand);
    letter-spacing: -0.02em;
  }
  .proof-l {
    font-family: var(--font-mono);
    font-size: 9.5px; color: var(--fg-3);
    letter-spacing: 0.10em; text-transform: uppercase;
    margin-top: 7px;
    line-height: 1.3;
    text-wrap: balance;
  }

  .addressee {
    display: flex; align-items: flex-start; justify-content: space-between;
    gap: 12mm;
    padding: 4mm 0 5mm;
    border-bottom: 1px solid var(--border);
    margin-bottom: 5mm;
  }
  .addressee-lbl {
    font-family: var(--font-mono);
    font-size: 9.5px; color: var(--fg-3);
    letter-spacing: 0.14em; text-transform: uppercase;
    margin-bottom: 5px;
  }
  .addressee-name {
    font-size: 20px; font-weight: 700;
    letter-spacing: -0.02em;
    color: var(--fg-1);
    margin-bottom: 4px;
  }
  .addressee-meta {
    font-family: var(--font-mono);
    font-size: 10px;
    color: var(--fg-3);
    letter-spacing: 0.04em;
    line-height: 1.5;
  }
  .addressee-r {
    text-align: right;
    flex-shrink: 0;
  }
  .addressee-r .addressee-lbl {
    text-align: right;
  }
  .addressee-id {
    font-family: var(--font-mono);
    font-size: 13px; font-weight: 600;
    letter-spacing: 0.04em;
    color: var(--brand-deep);
    white-space: nowrap;
  }

  .why-title {
    font-size: 11px;
    font-family: var(--font-mono);
    color: var(--fg-3);
    letter-spacing: 0.16em; text-transform: uppercase;
    margin-bottom: 4mm;
  }
  .why {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 4mm;
  }
  .why-card {
    position: relative;
    background: var(--bg-soft);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 4mm 4mm 4mm 7mm;
  }
  .why-card::before {
    content: "";
    position: absolute; left: 0; top: 5mm; bottom: 5mm;
    width: 2px; background: var(--brand);
    border-radius: 2px;
  }
  .why-card .why-num {
    font-family: var(--font-mono);
    font-size: 9px; color: var(--brand);
    letter-spacing: 0.14em;
    margin-bottom: 3px;
  }
  .why-card h4 {
    font-size: 12.5px; font-weight: 600;
    letter-spacing: -0.01em;
    margin: 0 0 4px;
    color: var(--fg-1);
  }
  .why-card p {
    font-size: 10px;
    color: var(--fg-2);
    line-height: 1.5;
    margin: 0;
    text-wrap: pretty;
  }

  /* ════════════════════════════════════════════════════
     PAGE 2 — INVESTIMENTO
     ════════════════════════════════════════════════════ */
  .p2-title {
    font-size: 28px; font-weight: 700;
    letter-spacing: -0.025em; line-height: 1.05;
    margin: 0 0 4mm;
  }
  .p2-sub {
    font-size: 12px; color: var(--fg-2);
    margin: 0 0 8mm;
    max-width: 165mm;
  }
  .p2-sub strong { color: var(--fg-1); font-weight: 600; }

  .value-wrap {
    display: grid;
    grid-template-columns: 1.4fr 1fr;
    gap: 5mm;
    margin-bottom: 8mm;
  }
  .value-card {
    position: relative;
    background:
      radial-gradient(ellipse at top right, rgba(22,163,74,0.08), transparent 60%),
      var(--surface-1);
    border: 1px solid var(--brand-bord);
    border-radius: 12px;
    padding: 8mm 9mm;
    overflow: hidden;
    box-shadow: 0 1px 0 rgba(11,18,32,0.02), 0 8px 24px -16px rgba(22,163,74,0.18);
  }
  .value-card::before,
  .value-card::after {
    content: "";
    position: absolute;
    width: 14px; height: 14px;
    border: 1px solid var(--brand);
    pointer-events: none;
  }
  .value-card::before { top: 0; left: 0; border-right: none; border-bottom: none; border-radius: 12px 0 0 0; }
  .value-card::after  { bottom: 0; right: 0; border-left: none; border-top: none; border-radius: 0 0 12px 0; }
  .value-label {
    font-family: var(--font-mono);
    font-size: 10px; color: var(--brand);
    letter-spacing: 0.16em; text-transform: uppercase;
    margin-bottom: 4mm;
  }
  .value-big {
    font-size: 52px; font-weight: 800;
    letter-spacing: -0.04em;
    font-variant-numeric: tabular-nums;
    line-height: 1;
    color: var(--fg-1);
    display: flex; align-items: baseline; gap: 8px;
  }
  .value-big .currency {
    font-size: 22px; font-weight: 600;
    color: var(--fg-2);
    letter-spacing: 0;
  }
  /* DSG-04 fix: /processo na mesma família de fonte que o valor (sem mono) */
  .value-big .suffix {
    font-size: 16px; font-weight: 500;
    color: var(--fg-3);
    letter-spacing: -0.01em;
    font-family: var(--font-sans);
  }
  /* BUG-17 fix: estilo do "Sob consulta" */
  .value-big.value-consulta {
    font-size: 32px; font-weight: 700;
    color: var(--fg-2);
    font-style: italic;
  }
  .value-foot {
    margin-top: 6mm;
    padding-top: 4mm;
    border-top: 1px dashed var(--border);
    font-family: var(--font-mono);
    font-size: 9.5px; color: var(--fg-3);
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }

  .extras { display: flex; flex-direction: column; gap: 4mm; }
  .extra-card {
    background: var(--bg-soft);
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 5mm 6mm;
  }
  .extra-card .lbl {
    font-family: var(--font-mono);
    font-size: 9px; color: var(--fg-3);
    letter-spacing: 0.12em; text-transform: uppercase;
    margin-bottom: 3px;
  }
  .extra-card .val {
    font-size: 18px; font-weight: 700;
    letter-spacing: -0.02em;
    font-variant-numeric: tabular-nums;
    color: var(--fg-1);
  }
  .extra-card .meta {
    font-size: 10px; color: var(--fg-3);
    margin-top: 3px;
  }

  .tipo-table {
    background: var(--surface-1);
    border: 1px solid var(--brand-bord);
    border-radius: 12px;
    padding: 5mm 6mm;
    box-shadow: 0 1px 0 rgba(11,18,32,0.02), 0 8px 24px -16px rgba(22,163,74,0.18);
  }
  .tipo-row {
    display: flex; align-items: baseline; gap: 8px;
    padding: 8px 0;
    border-bottom: 1px dashed var(--border);
  }
  .tipo-row:last-child { border-bottom: none; }
  .tipo-name {
    font-size: 13px; font-weight: 500;
    color: var(--fg-1);
    flex-shrink: 0;
  }
  .tipo-dot {
    flex: 1;
    border-bottom: 1px dotted var(--fg-4);
    margin-bottom: 4px;
  }
  .tipo-val {
    font-size: 15px; font-weight: 700;
    letter-spacing: -0.015em;
    font-variant-numeric: tabular-nums;
    color: var(--brand);
    flex-shrink: 0;
  }

  .sub-eyebrow {
    font-family: var(--font-mono);
    font-size: 9.5px; color: var(--fg-3);
    letter-spacing: 0.14em; text-transform: uppercase;
    margin-bottom: 3mm;
    display: flex; align-items: center; gap: 8px;
  }
  .sub-eyebrow::before {
    content: ""; width: 14px; height: 1px; background: var(--brand);
  }

  .chips {
    display: flex; flex-wrap: wrap; gap: 5px;
    margin-bottom: 6mm;
  }
  .chip {
    display: inline-flex; align-items: center;
    padding: 4px 10px;
    border-radius: 999px;
    font-size: 10.5px; font-weight: 500;
    letter-spacing: 0;
  }
  .chip-on {
    background: var(--brand);
    color: #ffffff;
    font-weight: 600;
  }
  .chip-off {
    background: transparent;
    color: var(--fg-4);
    border: 1px solid var(--border-s);
    text-decoration: line-through;
  }

  .inclusos {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 2mm;
  }
  .incl {
    background: var(--bg-soft);
    border: 1px solid var(--border);
    border-left: 2px solid var(--brand);
    border-radius: 6px;
    padding: 2.5mm 3.5mm;
    display: grid;
    grid-template-columns: 14px 1fr;
    gap: 8px;
    align-items: start;
  }
  .incl-off {
    border-left-color: var(--fg-4);
    opacity: 0.55;
    background: transparent;
  }
  .incl-ico {
    width: 14px; height: 14px;
    border-radius: 50%;
    background: var(--brand);
    color: #ffffff;
    font-size: 9px; font-weight: 800;
    display: inline-flex; align-items: center; justify-content: center;
    margin-top: 1px;
  }
  .incl-off .incl-ico {
    background: transparent;
    color: var(--fg-4);
    border: 1px solid var(--fg-4);
  }
  /* BUG-13 fix: max-width + ellipsis pra label longa */
  .incl-label {
    font-size: 11px; font-weight: 600;
    color: var(--fg-1);
    letter-spacing: -0.005em;
    overflow-wrap: anywhere;
  }
  .incl-off .incl-label {
    text-decoration: line-through;
    color: var(--fg-3);
  }
  .incl-desc {
    font-size: 9.5px; color: var(--fg-2);
    line-height: 1.4;
    margin-top: 1px;
  }
  .incl-off .incl-desc { color: var(--fg-4); }

  /* ════════════════════════════════════════════════════
     PAGE 3 — CONDIÇÕES
     ════════════════════════════════════════════════════ */
  .p3-title {
    font-size: 24px; font-weight: 700;
    letter-spacing: -0.025em; line-height: 1.05;
    margin: 0 0 3mm;
  }
  .p3-sub {
    font-size: 11px; color: var(--fg-2);
    margin: 0 0 5mm;
    max-width: 140mm;
    line-height: 1.55;
  }

  .rules {
    display: flex; flex-direction: column;
    gap: 1.5mm;
    margin-bottom: 4mm;
  }
  .rule {
    display: grid;
    grid-template-columns: 26px 1fr;
    gap: 8px;
    padding: 2mm 3mm;
    background: var(--bg-soft);
    border: 1px solid var(--border);
    border-radius: 6px;
  }
  .rule-num {
    font-family: var(--font-mono);
    font-size: 9px; font-weight: 600;
    color: var(--brand);
    letter-spacing: 0.06em;
    padding-top: 1px;
  }
  .rule-txt {
    font-size: 9px;
    line-height: 1.4;
    color: var(--fg-2);
    text-wrap: pretty;
  }
  .rule-obs {
    background: rgba(22,163,74,0.04);
    border-color: var(--brand-bord);
  }

  .validade {
    display: flex; align-items: center; justify-content: space-between;
    background: linear-gradient(135deg, rgba(22,163,74,0.08), rgba(22,163,74,0.01));
    border: 1px solid var(--brand-bord);
    border-radius: 10px;
    padding: 3mm 5mm;
    margin-bottom: 4mm;
  }
  .validade-l .lbl {
    font-family: var(--font-mono);
    font-size: 9.5px; color: var(--brand);
    letter-spacing: 0.14em; text-transform: uppercase;
    margin-bottom: 2px;
    white-space: nowrap;
  }
  .validade-l .val {
    font-size: 18px; font-weight: 700;
    letter-spacing: -0.015em;
    color: var(--fg-1);
  }
  .validade-r {
    font-family: var(--font-mono);
    font-size: 10px; color: var(--fg-3);
    text-align: right;
  }

  /* COM-05: badge de bonificação ao lado da validade (5º processo cortesia) */
  .bonus-tag {
    display: inline-flex; align-items: center; gap: 6px;
    margin-left: 8px;
    padding: 3px 8px;
    border-radius: 4px;
    background: linear-gradient(135deg, rgba(251,191,36,0.15), rgba(251,191,36,0.04));
    border: 1px solid rgba(251,191,36,0.4);
    font-family: var(--font-mono);
    font-size: 8.5px; font-weight: 600;
    letter-spacing: 0.08em; text-transform: uppercase;
    color: #b45309;
  }

  /* COM-01: CTA card (Próximo passo) — antes do binding */
  .cta {
    background: linear-gradient(135deg, rgba(22,163,74,0.10), rgba(22,163,74,0.02));
    border: 1px solid var(--brand-bord);
    border-radius: 10px;
    padding: 3mm 5mm;
    margin-bottom: 2mm;
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 5mm;
    align-items: center;
  }
  .cta-head {
    font-family: var(--font-mono);
    font-size: 9px; color: var(--brand-deep);
    letter-spacing: 0.16em; text-transform: uppercase;
    margin-bottom: 1px;
    font-weight: 600;
  }
  .cta-title {
    font-size: 13px; font-weight: 700;
    letter-spacing: -0.015em;
    color: var(--fg-1);
    margin-bottom: 2px;
  }
  .cta-sub {
    font-size: 9.5px; color: var(--fg-2);
    line-height: 1.4;
  }
  .cta-r {
    text-align: right;
    font-family: var(--font-mono);
    font-size: 9px; color: var(--brand-deep);
    letter-spacing: 0.1em; text-transform: uppercase;
    line-height: 1.4;
    white-space: nowrap;
  }
  .cta-step {
    display: flex; align-items: center; gap: 6px;
    margin-bottom: 1px;
  }
  .cta-step-num {
    width: 16px; height: 16px; border-radius: 50%;
    background: var(--brand); color: white;
    display: inline-flex; align-items: center; justify-content: center;
    font-size: 8.5px; font-weight: 700;
  }

  /* DSG-05: padding binding compacto */
  .binding {
    margin-top: auto;
    margin-bottom: 2mm;
    background: linear-gradient(135deg, rgba(22,163,74,0.06), rgba(22,163,74,0.01));
    border: 1px solid var(--brand-bord);
    border-radius: 10px;
    padding: 3.5mm 5mm 3.5mm 6mm;
    position: relative;
    overflow: hidden;
  }
  .binding::before {
    content: "";
    position: absolute; top: 0; left: 0;
    width: 4px; height: 100%;
    background: var(--brand);
  }
  .binding-head {
    display: flex; align-items: center; gap: 8px;
    margin-bottom: 2mm;
  }
  .binding-ico {
    font-family: var(--font-mono);
    font-size: 12px; color: var(--brand);
    letter-spacing: 0.2em;
  }
  .binding-title {
    font-size: 12px; font-weight: 700;
    letter-spacing: -0.01em;
    color: var(--fg-1);
  }
  .binding-body {
    font-size: 9px;
    line-height: 1.45;
    color: var(--fg-2);
    margin: 0;
    text-wrap: pretty;
  }
  .binding-body strong { color: var(--fg-1); font-weight: 600; }

</style>
</head>
<body>

  <!-- ════════════════════════════════════════════════
       PAGE 1 — CAPA
       ════════════════════════════════════════════════ -->
  <section class="pagina p1 capa">
    ${headerBar}

    <div class="capa-rank">
      <span class="capa-rank-num">№1</span>
      <span class="capa-rank-txt">${esc(TREVO_INFO.capa.rank_badge)}</span>
      <span class="capa-rank-sep"></span>
      <span class="capa-rank-meta">${esc(TREVO_INFO.capa.tagline_bar)}</span>
    </div>

    <h1>
      ${esc(TREVO_INFO.capa.hero_title_1)}<br/>
      <span class="accent">${esc(TREVO_INFO.capa.hero_title_2)}</span>
    </h1>

    <p class="capa-sub">${esc(TREVO_INFO.capa.hero_sub)}</p>

    <div class="proof">
      <div class="proof-cell">
        <div class="proof-v">${esc(TREVO_INFO.stats.contadores)}</div>
        <div class="proof-l">contadores na rede</div>
      </div>
      <div class="proof-cell">
        <div class="proof-v">${esc(TREVO_INFO.stats.processos)}</div>
        <div class="proof-l">processos concluídos</div>
      </div>
      <div class="proof-cell">
        <div class="proof-v">${esc(TREVO_INFO.stats.estados)}</div>
        <div class="proof-l">estados brasileiros</div>
      </div>
      <div class="proof-cell">
        <div class="proof-v">${esc(TREVO_INFO.stats.paises)}<span class="u"> países</span></div>
        <div class="proof-l">operação internacional</div>
      </div>
    </div>

    <div class="addressee">
      <div class="addressee-l">
        <div class="addressee-lbl">Proposta dedicada para</div>
        <div class="addressee-name">${esc(p.prospect_nome || '—')}</div>
        <div class="addressee-meta">
          ${docInfo.valor !== '—' ? `${esc(docInfo.label)} ${esc(docInfo.valor)}` : ''}
          ${contato ? ` · A/C ${contato}` : ''}
          ${telefoneClienteEsc ? `<br/>${telefoneClienteEsc}` : ''}
          ${emailClienteEsc ? ` · ${emailClienteEsc}` : ''}
        </div>
      </div>
      <div class="addressee-r">
        <div class="addressee-lbl">Anexo I · Doc. vinculante</div>
        <div class="addressee-id">${esc(propostaId)}</div>
      </div>
    </div>

    <div class="why-title">Por que escritórios contábeis escolhem a Trevo</div>
    <div class="why">
      <div class="why-card">
        <div class="why-num">§ 01 · Operação industrial</div>
        <h4>SLA contratual, rastreabilidade integral</h4>
        <p>Cada processo executado dentro do prazo, com auditoria em tempo real. Sem improviso de despachante local.</p>
      </div>
      <div class="why-card">
        <div class="why-num">§ 02 · Cobertura nacional</div>
        <h4>Mesmo padrão em qualquer UF</h4>
        <p>Atendemos a totalidade do território nacional com o mesmo nível operacional Trevo.</p>
      </div>
      <div class="why-card">
        <div class="why-num">§ 03 · Pricing transparente</div>
        <h4>Zero surpresa financeira</h4>
        <p>Taxas governamentais, alvarás e custos extras são comunicados <strong>antes</strong> da execução. Nunca depois.</p>
      </div>
      <div class="why-card">
        <div class="why-num">§ 04 · Início rápido</div>
        <h4>Onboarding em 30min, operação em 2 dias</h4>
        <p>Setup completo em meia hora via Google Meet. Primeiros processos rodando em até 2 dias úteis após aceite.</p>
      </div>
    </div>

    ${footerBar(1, 'Capa')}
  </section>

  <!-- ════════════════════════════════════════════════
       PAGE 2 — INVESTIMENTO
       ════════════════════════════════════════════════ -->
  <section class="pagina p2">
    ${headerBar}

    <div class="eyebrow">§ II · Investimento</div>
    <h2 class="p2-title">Sua proposta comercial</h2>
    <p class="p2-sub">${p2Sub}</p>

    ${
      isPrecoTipo
        ? `
      <div style="margin-bottom: 8mm;">
        <div class="value-label">Tabela por tipo de processo</div>
        ${renderTipoTable()}
      </div>`
        : (() => {
            const valorInfo = fmtValorOuConsulta(primaryValue);
            return `
      <div class="value-wrap">
        <div class="value-card">
          <div class="value-label">${esc(modalCfg.primaryLabel)}</div>
          ${valorInfo.isConsulta
            ? `<div class="value-big value-consulta">Sob consulta</div>`
            : `<div class="value-big">
                <span class="currency">R$</span>
                <span>${valorInfo.valor}</span>
                <span class="suffix">${esc(modalCfg.primarySuffix)}</span>
              </div>`}
          <div class="value-foot">${esc(modalCfg.valueFoot)}</div>
        </div>
        <div class="extras">
          ${
            modalCfg.showAbertura && p.terc_valor_abertura && Number(p.terc_valor_abertura) > 0
              ? `
            <div class="extra-card">
              <div class="lbl">Abertura de empresa</div>
              <div class="val">${fmtBRL(Number(p.terc_valor_abertura))}</div>
              <div class="meta">Valor único · por abertura realizada</div>
            </div>`
              : ''
          }
          ${
            p.terc_dia_pagamento
              ? `
            <div class="extra-card">
              <div class="lbl">${modalCfg.showDiaPagamento ? 'Cobrança recorrente' : 'Vencimento'}</div>
              <div class="val">${modalCfg.showDiaPagamento ? `Todo dia ${esc(p.terc_dia_pagamento)}` : `Dia ${esc(p.terc_dia_pagamento)}`}</div>
              <div class="meta">Boleto, PIX ou cartão · automatizado</div>
            </div>`
              : ''
          }
          ${
            !(modalCfg.showAbertura && p.terc_valor_abertura && Number(p.terc_valor_abertura) > 0) && !p.terc_dia_pagamento
              ? `
            <div class="extra-card" style="display:flex;flex-direction:column;justify-content:center;">
              <div class="lbl">Forma de cobrança</div>
              <div class="val" style="font-size:14px;line-height:1.4;">Boleto, PIX ou cartão</div>
              <div class="meta">Emissão automática pela plataforma Trevo</div>
            </div>`
              : ''
          }
        </div>
      </div>`;
          })()
    }

    ${
      (p.terc_servicos || []).length
        ? `
      <div class="sub-eyebrow">Serviços incluídos</div>
      <div class="chips">${renderChips(p.terc_servicos)}</div>`
        : ''
    }

    ${
      (p.terc_naturezas || []).length
        ? `
      <div class="sub-eyebrow">Naturezas jurídicas atendidas</div>
      <div class="chips">${renderChips(p.terc_naturezas)}</div>`
        : ''
    }

    ${
      (p.terc_inclusos || []).length
        ? `
      <div class="sub-eyebrow">O que está incluso</div>
      <div class="inclusos">${renderInclusos(p.terc_inclusos)}</div>`
        : ''
    }

    ${footerBar(2, 'Investimento')}
  </section>

  <!-- ════════════════════════════════════════════════
       PAGE 3 — CONDIÇÕES
       ════════════════════════════════════════════════ -->
  <section class="pagina p3">
    ${headerBar}

    <div class="eyebrow">§ III · Anexo I — Condições vinculantes</div>
    <h2 class="p3-title">Condições contratuais</h2>
    <p class="p3-sub">
      Este documento integra como <strong>Anexo I</strong> o Contrato de Prestação de Serviços firmado entre
      ${esc(TREVO_INFO.razao_social)} e a Contratante. As condições abaixo são vinculantes e
      prevalecem sobre comunicações anteriores em caso de divergência.
    </p>

    <div class="rules">
      ${renderRegras() || `
        <div class="rule">
          <div class="rule-num">§ 01</div>
          <div class="rule-txt">Nenhuma condição adicional aplicável a esta proposta.</div>
        </div>`}
    </div>

    <div class="validade">
      <div class="validade-l">
        <div class="lbl">Validade da proposta</div>
        <div class="val">${expStr}<span class="bonus-tag">★ 5º processo cortesia se aceito até ${expStr}</span></div>
      </div>
      <div class="validade-r">
        Emitida em ${createdStr}<br/>
        ${validade} dias corridos
      </div>
    </div>

    <!-- COM-01: CTA Próximo passo → ClickSign automático -->
    <div class="cta">
      <div class="cta-l">
        <div class="cta-head">Próximo passo</div>
        <div class="cta-title">Aceite → ClickSign automático</div>
        <div class="cta-sub">
          <div class="cta-step"><span class="cta-step-num">1</span> Aprovação em call (Google Meet)</div>
          <div class="cta-step"><span class="cta-step-num">2</span> Contrato enviado pela ClickSign</div>
          <div class="cta-step"><span class="cta-step-num">3</span> Onboarding 30min · operação em 2 dias</div>
        </div>
      </div>
      <div class="cta-r">
        Aceite até<br/>
        <strong style="font-size:13px;color:var(--brand-deep);">${expStr}</strong>
      </div>
    </div>

    <div class="binding">
      <div class="binding-head">
        <div class="binding-ico">●○</div>
        <div class="binding-title">Assinatura digital ClickSign</div>
      </div>
      <p class="binding-body">
        Após o aceite, o Contrato Mestre é enviado automaticamente pela <strong>ClickSign</strong>
        para assinatura digital qualificada (Lei&nbsp;14.063/2020), constituindo manifestação
        inequívoca de vontade (art.&nbsp;107 CC) e vinculando as partes.
      </p>
    </div>

    ${footerBar(3, 'Condições')}
  </section>

</body>
</html>`;
}

async function gerarPropostaPdf(orc: any): Promise<Uint8Array> {
  // 27/05 — renderer v3 (Claude.ai design) usa placeholder {{LOGO_TREVO_BASE64}}
  // pra logo. Substituímos aqui pelo PNG real embedded (LOGO_TREVO_PNG_B64).
  const htmlRaw = renderPropostaHTML(orc);
  const html = htmlRaw.replace(
    /\{\{LOGO_TREVO_BASE64\}\}/g,
    `data:image/png;base64,${LOGO_TREVO_PNG_B64}`
  );
  const res = await fetch("https://api.pdfshift.io/v3/convert/pdf", {
    method: "POST",
    headers: {
      "Authorization": "Basic " + btoa("api:" + PDFSHIFT_API_KEY),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ source: html, format: "A4", sandbox: false, delay: 2000 }),
  });
  if (!res.ok) {
    throw new Error(`PDFShift falhou: ${res.status} ${await res.text().catch(() => '')}`);
  }
  return new Uint8Array(await res.arrayBuffer());
}

// ═══════════════════════════════════════════════════════════════════════════
// PARTE 3 — Merge PDFs com pdf-lib
// ═══════════════════════════════════════════════════════════════════════════

async function mergePdfs(pdfs: Uint8Array[]): Promise<Uint8Array> {
  const merged = await PDFDocument.create();
  for (const buf of pdfs) {
    const src = await PDFDocument.load(buf);
    const pages = await merged.copyPages(src, src.getPageIndices());
    pages.forEach((p) => merged.addPage(p));
  }
  return await merged.save();
}

// ═══════════════════════════════════════════════════════════════════════════
// PARTE 4 — Handler
// ═══════════════════════════════════════════════════════════════════════════

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  if (!PDFSHIFT_API_KEY) return jsonResponse(503, { error: "PDFSHIFT_API_KEY_MISSING" });
  if (!GOOGLE_SA_KEY) return jsonResponse(503, { error: "GOOGLE_SERVICE_ACCOUNT_KEY_MISSING" });

  let body: { orcamento_id?: string; force?: boolean };
  try { body = await req.json(); } catch { return jsonResponse(400, { error: "INVALID_JSON" }); }
  const { orcamento_id, force } = body;
  if (!orcamento_id) return jsonResponse(400, { error: "MISSING_orcamento_id" });

  try {
    // 1. Busca orcamento
    const { data: orc, error: orcErr } = await admin
      .from("orcamentos").select("*")
      .eq("id", orcamento_id).eq("tipo_proposta", "terceirizacao")
      .maybeSingle();

    if (orcErr || !orc) {
      return jsonResponse(404, { error: "ORCAMENTO_NOT_FOUND" });
    }

    // 2. Idempotência (1ª camada — checa antes de fazer trabalho caro)
    if ((orc as any).terc_pdf_url && !force) {
      return jsonResponse(200, { ok: true, cached: true, pdf_url: (orc as any).terc_pdf_url });
    }

    // 3. Gera Proposta + MSA em paralelo
    console.log('[main] gerando Proposta + MSA em paralelo…');
    const [propostaPdf, msaPdf] = await Promise.all([
      gerarPropostaPdf(orc),
      gerarMsaPdf(orc),
    ]);
    console.log(`[main] proposta: ${propostaPdf.length}B · msa: ${msaPdf.length}B`);

    // 4. Merge
    const finalPdf = await mergePdfs([propostaPdf, msaPdf]);
    console.log(`[main] merge final: ${finalPdf.length}B`);

    // 5. Mitigação ITEM-003 (race condition): re-check ANTES do upload.
    //    Se outro processo concorrente já terminou e gravou terc_pdf_url
    //    enquanto este estava no PDFShift/Docs API (5-20s), retorna o existente
    //    sem fazer upload duplicado.
    if (!force) {
      const { data: latest } = await admin
        .from("orcamentos").select("terc_pdf_url").eq("id", orcamento_id).maybeSingle();
      if ((latest as any)?.terc_pdf_url) {
        console.log('[main] race detectada — outro processo terminou primeiro, retornando cached');
        return jsonResponse(200, {
          ok: true, cached: true,
          pdf_url: (latest as any).terc_pdf_url,
          deduped: true,
        });
      }
    }

    // 6. Upload Storage
    const fileName = `PROP-${String((orc as any).numero).padStart(4, "0")}-${Date.now()}.pdf`;
    const { error: uploadErr } = await admin.storage
      .from(BUCKET_NAME)
      .upload(fileName, finalPdf, { contentType: "application/pdf", cacheControl: "3600", upsert: false });

    if (uploadErr) {
      return jsonResponse(500, { error: "STORAGE_UPLOAD_FAILED", detail: uploadErr.message });
    }

    // 7. URL pública + update
    const { data: pub } = admin.storage.from(BUCKET_NAME).getPublicUrl(fileName);
    const publicUrl = pub.publicUrl;
    await admin.from("orcamentos").update({ terc_pdf_url: publicUrl }).eq("id", orcamento_id);

    return jsonResponse(200, { ok: true, cached: false, pdf_url: publicUrl, file_name: fileName });
  } catch (e) {
    console.error("[main] erro:", e);
    return jsonResponse(500, { error: "UNEXPECTED", detail: e instanceof Error ? e.message : String(e) });
  }
});

function jsonResponse(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
