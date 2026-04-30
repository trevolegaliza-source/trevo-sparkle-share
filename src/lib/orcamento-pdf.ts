import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import {
  type OrcamentoItem, type OrcamentoPacote, type OrcamentoSecao,
  type OrcamentoModo, type OrcamentoPDFMode, type RiscoOperacao,
  type EtapaFluxo, type BeneficioCapa, type CenarioOrcamento,
  getItemValor, DEFAULT_SECOES,
} from '@/components/orcamentos/types';

export interface OrcamentoPDFData {
  modo: OrcamentoModo;
  modoContador?: boolean; // legacy compat
  modoPDF?: OrcamentoPDFMode; // 'contador' | 'cliente' | 'direto'
  destinatario?: 'contador' | 'cliente_via_contador' | 'cliente_direto';
  prospect_nome: string;
  prospect_cnpj: string | null;
  // Escritório contábil (used in contador and cliente_via_contador modes)
  escritorioNome?: string;
  escritorioEmail?: string;
  escritorioTelefone?: string;
  escritorioCnpj?: string;
  // Legacy compat fields
  clienteNome?: string;
  contadorNome?: string;
  contadorEmail?: string;
  contadorTelefone?: string;
  itens: OrcamentoItem[];
  pacotes: OrcamentoPacote[];
  secoes: OrcamentoSecao[];
  contexto: string;
  ordem_execucao: string;
  desconto_pct: number;
  subtotal: number;
  total: number;
  validade_dias: number;
  prazo_execucao: string;
  pagamento: string;
  observacoes: string;
  numero: number;
  data_emissao: string;
  // Dynamic fields
  riscos?: RiscoOperacao[];
  etapas_fluxo?: EtapaFluxo[];
  beneficios_capa?: BeneficioCapa[];
  headline_cenario?: string;
  cenarios?: CenarioOrcamento[];
}

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br/>');

/** Sanitize rich-text HTML from TipTap editor — allow only safe tags */
function sanitizeRichHtml(html: string): string {
  if (!html) return '';
  // If it looks like plain text (no HTML tags), escape and convert newlines
  if (!/<[a-z][\s\S]*>/i.test(html)) return esc(html);
  // Remove dangerous tags/attributes
  let safe = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, '')
    .replace(/<img[^>]*>/gi, '')
    .replace(/\s*on\w+\s*=\s*"[^"]*"/gi, '')
    .replace(/\s*on\w+\s*=\s*'[^']*'/gi, '');
  return safe;
}

/** Wrap rich HTML with inline styles for PDF rendering */
function richHtmlForPdf(html: string, fontSize = '11px', color = '#374151'): string {
  if (!html) return '';
  const sanitized = sanitizeRichHtml(html);
  return `<div style="font-size: ${fontSize}; color: ${color}; line-height: 1.6;">
    <style>
      .rte p { margin-bottom: 6px; }
      .rte strong { font-weight: 700; }
      .rte em { font-style: italic; }
      .rte u { text-decoration: underline; }
      .rte ul { margin-left: 18px; margin-bottom: 6px; list-style-type: disc; }
      .rte ol { margin-left: 18px; margin-bottom: 6px; list-style-type: decimal; }
      .rte li { margin-bottom: 3px; }
      .rte a { color: #2563eb; text-decoration: underline; }
    </style>
    <div class="rte">${sanitized}</div>
  </div>`;
}

// FIX 5 — Title Case for ALL CAPS names (smart: keeps conjunctions lowercase)
function toTitleCase(str: string): string {
  const minusculas = new Set([
    'e', 'de', 'da', 'do', 'das', 'dos',
    'em', 'no', 'na', 'nos', 'nas',
    'por', 'para', 'com', 'sem', 'sob',
    'a', 'o', 'as', 'os',
    'um', 'uma',
  ]);
  const semEspacos = str.replace(/\s+/g, '');
  if (semEspacos !== semEspacos.toUpperCase()) return str;
  return str
    .toLowerCase()
    .split(' ')
    .map((word, index) => {
      if (!word) return word;
      if (index === 0) return word.charAt(0).toUpperCase() + word.slice(1);
      if (minusculas.has(word)) return word;
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(' ');
}

// FIX 7 — Format contexto: handles both plain text and rich HTML from editor
function formatarContextoPDF(texto: string): string {
  if (!texto) return '';
  // If it's already HTML from the rich text editor, sanitize and return
  if (/<[a-z][\s\S]*>/i.test(texto)) {
    let html = sanitizeRichHtml(texto);
    // Still highlight risk words and monetary values within the HTML text nodes
    html = html.replace(
      /(R\$[\s]?[\d.,kmKM\-]+)/g,
      '<strong style="color: #b91c1c; font-weight: 700;">$1</strong>'
    );
    const palavrasRisco = [
      'interdição', 'interditada', 'embargo', 'embargada',
      'multa', 'multas', 'autuação', 'penalidade',
      'bloqueio', 'bloqueada', 'suspensão',
      'proibição', 'proibida', 'ilegal',
    ];
    palavrasRisco.forEach(palavra => {
      const regex = new RegExp(`\\b(${palavra})\\b`, 'gi');
      html = html.replace(regex, '<strong style="color: #b91c1c; font-weight: 700;">$1</strong>');
    });
    return html;
  }
  // Plain text fallback (legacy data)
  let html = texto
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  html = html.replace(
    /(R\$[\s]?[\d.,kmKM\-]+)/g,
    '<strong style="color: #b91c1c; font-weight: 700;">$1</strong>'
  );
  const palavrasRisco = [
    'interdição', 'interditada', 'embargo', 'embargada',
    'multa', 'multas', 'autuação', 'penalidade',
    'bloqueio', 'bloqueada', 'suspensão',
    'proibição', 'proibida', 'ilegal',
  ];
  palavrasRisco.forEach(palavra => {
    const regex = new RegExp(`\\b(${palavra})\\b`, 'gi');
    html = html.replace(regex, '<strong style="color: #b91c1c; font-weight: 700;">$1</strong>');
  });
  html = html.replace(/\n/g, '<br>');
  return html;
}

const LOGO_URLS = [
  'https://aahhauquuicvtwtrxyan.supabase.co/storage/v1/object/public/documentos/logo/trevo-legaliza-hd.png',
  'https://aahhauquuicvtwtrxyan.supabase.co/storage/v1/object/public/documentos/logo%2Ftrevo-legaliza-hd.png',
  'https://aahhauquuicvtwtrxyan.supabase.co/storage/v1/object/public/documentos/logo/trevo-legaliza.png',
  'https://aahhauquuicvtwtrxyan.supabase.co/storage/v1/object/public/documentos/logo%2Ftrevo-legaliza.png',
];

async function preloadImageAsBase64(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { mode: 'cors' });
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise<string | null>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch { return null; }
}

async function preloadLogo(): Promise<string | null> {
  for (const url of LOGO_URLS) {
    const b64 = await preloadImageAsBase64(url);
    if (b64) return b64;
  }
  return null;
}

/**
 * Measures the real rendered height of an HTML block in the DOM.
 * Uses getBoundingClientRect() for pixel-accurate measurement.
 */
async function medirAlturaReal(html: string): Promise<number> {
  const probe = document.createElement('div');
  probe.style.cssText = `
    position: absolute;
    top: -99999px;
    left: -99999px;
    width: 722px;
    visibility: hidden;
    pointer-events: none;
    box-sizing: border-box;
  `;
  // Match the exact same CSS context as the render container for accurate measurement
  probe.innerHTML = `<div style="width:722px;"><style>* { -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; text-rendering: optimizeLegibility; } body, div, p, span, td, th, li { font-family: 'Inter', 'Segoe UI', -apple-system, BlinkMacSystemFont, sans-serif; }</style>${html}</div>`;
  document.body.appendChild(probe);

  // Wait one frame for the browser to calculate layout
  await new Promise(r => requestAnimationFrame(r));

  const altura = probe.firstElementChild
    ? (probe.firstElementChild as HTMLElement).getBoundingClientRect().height
    : probe.getBoundingClientRect().height;
  document.body.removeChild(probe);
  return Math.ceil(altura) + 8; // +8px safety margin to prevent content bleeding between pages
}

const HEADER_HEIGHT = 64;

function logoHtml(logo: string | null, height = 36, width?: number): string {
  const widthStyle = width ? `width: ${width}px !important; height: auto !important;` : `height: ${height}px !important; width: auto !important; max-height: ${height}px !important; min-height: ${height}px !important;`;
  return logo
    ? `<img src="${logo}" style="${widthStyle} object-fit: contain !important; display: block !important; flex-shrink: 0 !important;" crossorigin="anonymous" />`
    : `<div style="font-size: 22px; font-weight: 800; line-height: 1.2;">
         <span style="color: #22c55e;">Trevo</span>
         <span style="color: #ffffff; font-weight: 400; font-size: 18px;"> Legaliza</span>
       </div>`;
}

const HEADER_TREVO = (numero: number, data: string, logo: string | null) => `
  <div style="height:${HEADER_HEIGHT}px !important;min-height:${HEADER_HEIGHT}px !important;max-height:${HEADER_HEIGHT}px !important;overflow:hidden !important;flex-shrink:0;background: linear-gradient(135deg, #0f1f0f 0%, #1a3a1a 100%); padding: 0 32px; position:relative; display:flex; align-items:center; justify-content:space-between;">
    <div style="display:flex;align-items:center;gap:12px;">
      ${logoHtml(logo, 36, 140)}
    </div>
    <div style="text-align: right;">
      <div style="font-size: 10px; color: #4ade80; text-transform: uppercase; letter-spacing: 1px; font-weight: 600;">PROPOSTA #${String(numero).padStart(3, '0')}</div>
      <div style="font-size: 10px; color: rgba(255,255,255,0.5); margin-top: 2px;">${data}</div>
    </div>
  </div>
  <div style="height: 4px; flex-shrink:0; background: linear-gradient(90deg, #22c55e, #86efac, #22c55e);"></div>
`;

const HEADER_CLIENTE = (numero: number, data: string, nomeContabilidade: string) => `
  <div style="height:${HEADER_HEIGHT}px !important;min-height:${HEADER_HEIGHT}px !important;max-height:${HEADER_HEIGHT}px !important;overflow:hidden !important;flex-shrink:0;background: linear-gradient(135deg, #1e293b 0%, #334155 100%); padding: 0 32px; position:relative; display:flex; align-items:center; justify-content:space-between;">
    <div>
      <div style="font-size: 20px; font-weight: 800; color: #ffffff;">${esc(nomeContabilidade)}</div>
      <div style="font-size: 9px; color: rgba(255,255,255,0.5); margin-top: 2px;">Assessoria empresarial</div>
    </div>
    <div style="text-align: right;">
      <div style="font-size: 10px; color: #93c5fd; text-transform: uppercase; letter-spacing: 1px; font-weight: 600;">PROPOSTA #${String(numero).padStart(3, '0')}</div>
      <div style="font-size: 10px; color: rgba(255,255,255,0.5); margin-top: 2px;">${data}</div>
    </div>
  </div>
  <div style="height: 4px; flex-shrink:0; background: linear-gradient(90deg, #3b82f6, #93c5fd, #3b82f6);"></div>
`;

const FOOTER_TREVO = `
  <div style="padding: 16px 40px; border-top: 1px solid #e2e8f0; background: #f8fafc; text-align: center;">
    <div style="font-size: 10px; color: #94a3b8;">
      Trevo Legaliza · CNPJ 39.969.412/0001-70 · Rua Brasil, nº 1170, Rudge Ramos, SBC/SP · administrativo@trevolegaliza.com.br · (11) 93492-7001 · trevolegaliza.com.br
    </div>
  </div>
`;

const FOOTER_CLIENTE = (nome: string) => `
  <div style="padding: 16px 40px; border-top: 1px solid #e2e8f0; background: #f8fafc; text-align: center;">
    <div style="font-size: 10px; color: #94a3b8;">${esc(nome)}</div>
  </div>
`;

function sanitizeFilename(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9\s-]/g, '')
    .replace(/\s+/g, '_')
    .substring(0, 50);
}

function resolvePDFMode(d: OrcamentoPDFData): OrcamentoPDFMode {
  if (d.modoPDF) return d.modoPDF;
  if (d.destinatario === 'cliente_via_contador') return 'cliente';
  if (d.destinatario === 'cliente_direto') return 'direto';
  return d.modoContador ? 'cliente' : 'contador';
}

/** Resolve the escritório name from new or legacy fields */
function getEscritorioNome(d: OrcamentoPDFData): string {
  return d.escritorioNome || d.clienteNome || d.contadorNome || '';
}

function getNomeExibicao(d: OrcamentoPDFData, pdfMode: OrcamentoPDFMode, contexto: 'header' | 'capa_principal' | 'headline_cenario' | 'cta_final' | 'rodape'): string {
  const escritorio = getEscritorioNome(d);
  const empresa = toTitleCase(d.prospect_nome || '');

  switch (pdfMode) {
    case 'contador':
      if (contexto === 'header' || contexto === 'rodape' || contexto === 'cta_final') return 'Trevo Legaliza';
      if (contexto === 'capa_principal') return escritorio || empresa;
      if (contexto === 'headline_cenario') return empresa;
      break;
    case 'cliente':
      if (contexto === 'header' || contexto === 'rodape' || contexto === 'cta_final') return escritorio || empresa;
      if (contexto === 'capa_principal' || contexto === 'headline_cenario') return empresa;
      break;
    case 'direto':
      if (contexto === 'header' || contexto === 'rodape' || contexto === 'cta_final') return 'Trevo Legaliza';
      if (contexto === 'capa_principal' || contexto === 'headline_cenario') return empresa;
      break;
  }
  return empresa;
}

function getHeader(d: OrcamentoPDFData, logo: string | null, pdfMode: OrcamentoPDFMode): string {
  if (pdfMode === 'cliente') {
    return HEADER_CLIENTE(d.numero, d.data_emissao, getNomeExibicao(d, pdfMode, 'header'));
  }
  return HEADER_TREVO(d.numero, d.data_emissao, logo);
}

function getFooter(d: OrcamentoPDFData, pdfMode: OrcamentoPDFMode): string {
  if (pdfMode === 'cliente') {
    return FOOTER_CLIENTE(getNomeExibicao(d, pdfMode, 'rodape'));
  }
  return FOOTER_TREVO;
}

/** For rendering logic: 'direto' behaves like 'cliente' (no margins/costs) but with Trevo branding */
function isClienteView(pdfMode: OrcamentoPDFMode): boolean {
  return pdfMode === 'cliente' || pdfMode === 'direto';
}

// Short name for prazos
function shortName(descricao: string): string {
  const map: Record<string, string> = {
    'LICENÇA BOMBEIROS': 'Bombeiros',
    'LICENCA BOMBEIROS': 'Bombeiros',
    'ALVARÁ SANITÁRIO': 'Vigilância Sanitária',
    'ALVARA SANITARIO': 'Vigilância Sanitária',
    'ATUALIZAÇÃO CADASTRO': 'Cadastro Prefeitura',
    'ATUALIZACAO CADASTRO': 'Cadastro Prefeitura',
    'ATUALIZAÇÃO SC BEM': 'JUCESC',
    'REGISTRO CRM': 'CRM PJ',
    'CADASTRO CNES': 'CNES',
    'REGISTRO MARCA': 'Marca INPI',
    'REGISTRO DE MARCA': 'Marca INPI',
  };
  const upper = descricao.toUpperCase();
  for (const [key, val] of Object.entries(map)) {
    if (upper.includes(key)) return val;
  }
  return descricao.split(' ').slice(0, 3).join(' ');
}

// FIX 6 — Ordem de execução: filter meta-text lines ending with ":"
function formatarOrdemExecucao(texto: string, isCliente: boolean): string {
  const linhas = texto.split('\n').filter(l => l.trim());
  const bgColor = isCliente ? 'linear-gradient(135deg, #3b82f6, #2563eb)' : 'linear-gradient(135deg, #22c55e, #16a34a)';
  const arrowColor = isCliente ? '#3b82f6' : '#22c55e';

  let html = '';
  let stepNum = 0;

  for (const linha of linhas) {
    const trimmed = linha.trim();
    // Meta-text: ends with ":" or first line that doesn't start with a number
    const isMetaText = trimmed.endsWith(':');
    if (isMetaText) {
      // Render as subtitle, not numbered step
      html += `<div style="font-size: 9px; color: #9ca3af; font-style: italic; padding: 4px 0 2px; margin-top: 4px;">${esc(trimmed)}</div>`;
      continue;
    }
    stepNum++;
    const isLast = linhas.indexOf(linha) === linhas.length - 1;
    html += `
      <div style="display: flex; align-items: center; gap: 10px; padding: 8px 0;">
        <div style="display: flex; align-items: center; justify-content: center; width: 28px; height: 28px; border-radius: 50%; background: ${bgColor}; color: #fff; font-size: 11px; font-weight: 800; flex-shrink: 0;">${stepNum}</div>
        <div style="flex: 1; font-size: 10px; color: #374151; line-height: 1.5;">${esc(trimmed)}</div>
        
      </div>
    `;
  }
  return html;
}

// ────────────────────────────────────────
// SIMPLES MODE (unchanged logic)
// ────────────────────────────────────────
function buildSimplesHTML(d: OrcamentoPDFData, logo: string | null): string {
  const itensHtml = d.itens.map((item, idx) => `
    <div style="display: flex; justify-content: space-between; align-items: flex-start; padding: 14px 0; ${idx > 0 ? 'border-top: 1px solid #e2e8f0;' : ''}">
      <div style="flex: 1; padding-right: 20px;">
        <div style="font-size: 13px; font-weight: 700; color: #1a1a2e;">${idx + 1}. ${esc(item.descricao)}${item.quantidade > 1 ? ` (×${item.quantidade})` : ''}</div>
        ${item.detalhes ? `<div style="font-size: 11px; color: #64748b; margin-top: 4px; line-height: 1.4;">${sanitizeRichHtml(item.detalhes)}</div>` : ''}
      </div>
      <div style="font-size: 14px; font-weight: 800; color: #166534; white-space: nowrap;">${fmt(getItemValor(item) * item.quantidade)}</div>
    </div>
  `).join('');

  const descontoHtml = d.desconto_pct > 0
    ? `<div style="display: flex; justify-content: space-between; padding: 10px 0; border-top: 1px solid #e2e8f0; font-size: 12px;">
        <span style="color: #64748b;">Desconto (${d.desconto_pct}%)</span>
        <span style="color: #dc2626; font-weight: 600;">- ${fmt(d.subtotal * d.desconto_pct / 100)}</span>
       </div>` : '';

  const observacoesHtml = d.observacoes
    ? `<div style="margin-top: 20px;">
        <div style="font-size: 10px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 8px;">Observações</div>
        <div style="background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 12px; font-size: 11px; color: #92400e; line-height: 1.5;">${sanitizeRichHtml(d.observacoes)}</div>
       </div>` : '';

  return `
    <div style="font-family: Arial, Helvetica, sans-serif; width: 794px; min-height: 1123px; background: white; position: relative;">
      ${HEADER_TREVO(d.numero, d.data_emissao, logo)}
      <div style="padding: 24px 40px; background: #f8fafc; border-bottom: 1px solid #e2e8f0;">
        <div style="font-size: 10px; color: #64748b; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 6px;">Preparada para</div>
        <div style="font-size: 18px; font-weight: 800; color: #1a1a2e;">${esc(d.prospect_nome)}</div>
        ${d.prospect_cnpj ? `<div style="font-size: 11px; color: #64748b; margin-top: 2px;">CNPJ: ${esc(d.prospect_cnpj)}</div>` : ''}
        <div style="font-size: 11px; color: #64748b; margin-top: 2px;">Válida por ${d.validade_dias} dias</div>
      </div>
      <div style="padding: 24px 40px;">
        <div style="font-size: 10px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 16px; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px;">Escopo dos Serviços</div>
        ${itensHtml}
      </div>
      <div style="padding: 0 40px 24px;">
        <div style="border-top: 2px solid #e2e8f0; padding-top: 12px;">
          <div style="display: flex; justify-content: space-between; font-size: 12px; color: #64748b; padding: 6px 0;">
            <span>Subtotal</span><span style="font-weight: 600;">${fmt(d.subtotal)}</span>
          </div>
          ${descontoHtml}
          <div style="display: flex; justify-content: space-between; align-items: center; padding: 16px 20px; margin-top: 8px; background: #f0fdf4; border: 2px solid #22c55e; border-radius: 12px;">
            <span style="font-size: 12px; font-weight: 700; color: #166534; text-transform: uppercase; letter-spacing: 1px;">Total</span>
            <span style="font-size: 28px; font-weight: 900; color: #166534;">${fmt(d.total)}</span>
          </div>
        </div>
      </div>
      <div style="padding: 0 40px 24px;">
        <div style="font-size: 10px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 12px; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px;">Condições</div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px;">
            <div style="font-size: 9px; color: #94a3b8; text-transform: uppercase; letter-spacing: 1px;">Pagamento</div>
            <div style="font-size: 12px; font-weight: 600; color: #1e293b; margin-top: 4px;">${sanitizeRichHtml(d.pagamento || 'A combinar')}</div>
          </div>
          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px;">
            <div style="font-size: 9px; color: #94a3b8; text-transform: uppercase; letter-spacing: 1px;">Prazo de Execução</div>
            <div style="font-size: 12px; font-weight: 600; color: #1e293b; margin-top: 4px;">${esc(d.prazo_execucao || 'A combinar')}</div>
          </div>
        </div>
        ${observacoesHtml}
      </div>
      <div style="position: absolute; bottom: 0; left: 0; right: 0;">${FOOTER_TREVO}</div>
    </div>
  `;
}

// ────────────────────────────────────────
// DETALHADO MODE
// ────────────────────────────────────────
async function buildDetalhadoPages(d: OrcamentoPDFData, logo: string | null): Promise<string[]> {
  const pages: string[] = [];
  const pdfMode = resolvePDFMode(d);
  const isCliente = isClienteView(pdfMode); // true for 'cliente' and 'direto' (hides costs/margins)
  const secoes = d.secoes.length > 0 ? d.secoes : DEFAULT_SECOES;
  const header = getHeader(d, logo, pdfMode);
  const footer = getFooter(d, pdfMode);

  // Compute values
  const getCustoTrevo = (item: OrcamentoItem) => (item.honorario || 0) * item.quantidade;
  const getPrecoCliente = (item: OrcamentoItem) => ((item.honorario_minimo_contador || item.honorario || 0)) * item.quantidade;
  const getPrecoDireto = (item: OrcamentoItem) => ((item.valorVendaDireto || item.valor_mercado || item.honorario_minimo_contador || item.honorario || 0)) * item.quantidade;

  // Scenario support
  const cenarios = (d.cenarios || []).filter(c => c.nome.trim());
  const temCenarios = cenarios.length > 0;
  // Items without a scenario (always included)
  const itensAvulsos = d.itens.filter(i => !i.cenarioId);
  // Helper: get items for a specific scenario (avulsos + scenario items)
  const getItensCenario = (cenarioId: string) => [
    ...itensAvulsos,
    ...d.itens.filter(i => i.cenarioId === cenarioId),
  ];
  // Helper: compute totals for a set of items
  const computeTotals = (items: OrcamentoItem[]) => {
    const custoTrevo = items.reduce((s, i) => s + getCustoTrevo(i), 0);
    const precoCliente = items.reduce((s, i) => s + getPrecoCliente(i), 0);
    const precoDireto = items.reduce((s, i) => s + getPrecoDireto(i), 0);
    const taxaMin = items.reduce((s, i) => s + i.taxa_min, 0);
    const taxaMax = items.reduce((s, i) => s + i.taxa_max, 0);
    return { custoTrevo, precoCliente, precoDireto, taxaMin, taxaMax };
  };

  const totalCustoTrevo = d.itens.reduce((s, i) => s + getCustoTrevo(i), 0);
  const totalPrecoCliente = d.itens.reduce((s, i) => s + getPrecoCliente(i), 0);
  const totalPrecoDireto = d.itens.reduce((s, i) => s + getPrecoDireto(i), 0);
  const totalTaxaMin = d.itens.reduce((s, i) => s + i.taxa_min, 0);
  const totalTaxaMax = d.itens.reduce((s, i) => s + i.taxa_max, 0);
  const hasTaxas = totalTaxaMin > 0 || totalTaxaMax > 0;

  const totalHonorariosCapa = pdfMode === 'direto' ? totalPrecoDireto : isCliente ? totalPrecoCliente : totalCustoTrevo;
  const descontoValorCapa = totalHonorariosCapa * (d.desconto_pct / 100);
  const honorarioFinalCapa = totalHonorariosCapa - descontoValorCapa;
  const investimentoMin = honorarioFinalCapa + totalTaxaMin;
  const investimentoMax = honorarioFinalCapa + totalTaxaMax;
  const valorCapa = hasTaxas
    ? `${fmt(investimentoMin)} a ${fmt(investimentoMax)}`
    : fmt(honorarioFinalCapa);

  // Contador-specific cover values
  const custoTrevoFinalCapa = totalCustoTrevo * (1 - d.desconto_pct / 100);
  const precoClienteFinalCapa = totalPrecoCliente * (1 - d.desconto_pct / 100);
  // Margem mínima (baseado no honorario_minimo_contador)
  const margemCapaMin = precoClienteFinalCapa - custoTrevoFinalCapa;
  const margemCapaMinPct = custoTrevoFinalCapa > 0 ? (((precoClienteFinalCapa / custoTrevoFinalCapa) - 1) * 100).toFixed(0) : '0';
  // Margem ideal (baseado no valor_mercado)
  const totalPrecoIdeal = d.itens.reduce((s, i) => s + ((i.valor_mercado || i.honorario_minimo_contador || i.honorario || 0)) * i.quantidade, 0);
  const precoIdealFinalCapa = totalPrecoIdeal * (1 - d.desconto_pct / 100);
  const margemCapaIdeal = precoIdealFinalCapa - custoTrevoFinalCapa;
  const margemCapaIdealPct = custoTrevoFinalCapa > 0 ? (((precoIdealFinalCapa / custoTrevoFinalCapa) - 1) * 100).toFixed(0) : '0';
  const temMargemFaixa = margemCapaIdeal > margemCapaMin && totalPrecoIdeal > totalPrecoCliente;
  // Detecta se algum item tem recomendação de preço (mínimo ou mercado preenchidos)
  const temRecomendacaoPreco = d.itens.some(i => 
    (i.honorario_minimo_contador > 0 && i.honorario_minimo_contador !== i.honorario) || 
    (i.valor_mercado > 0 && i.valor_mercado !== i.honorario)
  );

  const useBlueTheme = pdfMode === 'cliente'; // only pure client mode uses blue; direto uses Trevo green
  const accentColor = useBlueTheme ? '#3b82f6' : '#22c55e';
  const accentColorLight = useBlueTheme ? '#93c5fd' : '#4ade80';
  const accentBg = useBlueTheme ? '#eff6ff' : '#f0fdf4';
  const accentBorder = useBlueTheme ? '#3b82f6' : '#22c55e';
  const accentText = useBlueTheme ? '#1e40af' : '#166534';

  // Display name via getNomeExibicao
  const displayName = getNomeExibicao(d, pdfMode, 'capa_principal');
  const nomeEmpresaCurto = getNomeExibicao(d, pdfMode, 'headline_cenario').split(' ').slice(0, 3).join(' ');

  // --- PAGE 1: Cover ---
  const itemCount = d.itens.filter(i => i.descricao.trim()).length;
  const escritorioNome = getEscritorioNome(d);

  if (!isCliente) {
    // ═══════════════════════════════════════════
    // INTERNAL COVER — 4 zones: Identity header, Client ID, 3 financial cards, Footer info
    // ═══════════════════════════════════════════
    const badgeNome = escritorioNome || 'USO EXCLUSIVO DA CONTABILIDADE';

    pages.push(`
      <div style="font-family: Arial, Helvetica, sans-serif; width: 794px; height: 1123px; background: white; position: relative; display: flex; flex-direction: column;">

        <!-- ZONA 1: Identity header (dark green, ~30%) -->
        <div style="background: #0f3d24; padding: 48px 40px 36px; position: relative; flex-shrink: 0;">
          <div style="display: flex; justify-content: space-between; align-items: flex-start;">
            <div>
              ${logoHtml(logo, 48, 140)}
              <div style="font-size: 13px; color: #86efac; margin-top: 10px;">Seu Departamento Societário Completo</div>
              <div style="font-size: 9px; color: #6ee7b7; font-style: italic; margin-top: 6px; opacity: 0.8;">🤝 PAINEL DO PARCEIRO — ${esc(badgeNome)}</div>
            </div>
            <div style="text-align: right;">
              <div style="font-size: 10px; color: #ffffff; text-transform: uppercase; letter-spacing: 1px; font-weight: 600;">PROPOSTA #${String(d.numero).padStart(3, '0')}</div>
              <div style="font-size: 10px; color: rgba(255,255,255,0.6); margin-top: 4px;">${d.data_emissao}</div>
              <div style="font-size: 9px; color: #6ee7b7; font-style: italic; margin-top: 16px;">Desde 2018 · 27 estados · Referência nacional</div>
            </div>
          </div>
        </div>

        <!-- ZONA 2: Client identification -->
        <div style="padding: 32px 40px 24px; flex-shrink: 0;">
          <div style="font-size: 9px; color: #0f3d24; text-transform: uppercase; letter-spacing: 2px; font-weight: 700; margin-bottom: 10px;">PAINEL DO PARCEIRO — PROPOSTA #${String(d.numero).padStart(3, '0')}</div>
          <div style="font-size: 22px; font-weight: 700; color: #0f3d24; margin-bottom: 6px;">${esc(escritorioNome || toTitleCase(d.prospect_nome))}</div>
          ${escritorioNome ? `<div style="font-size: 12px; color: #6b7280;">Para: ${esc(toTitleCase(d.prospect_nome))}</div>` : ''}
          ${d.prospect_cnpj ? `<div style="font-size: 11px; color: #9ca3af; margin-top: 4px;">CNPJ: ${esc(d.prospect_cnpj)}</div>` : ''}
        </div>

        <!-- ZONA 3: Financial cards -->
        <div style="padding: 0 40px; flex-shrink: 0;">
          ${temCenarios ? `
          <!-- Per-scenario financial cards -->
          <div style="font-size: 9px; color: #0f3d24; text-transform: uppercase; letter-spacing: 1px; font-weight: 600; margin-top: 20px; margin-bottom: 10px;">COMPARATIVO POR CENÁRIO</div>
          ${cenarios.map((cen, ci) => {
            const items = getItensCenario(cen.id);
            const t = computeTotals(items);
            const custoFinal = t.custoTrevo * (1 - d.desconto_pct / 100);
            const precoMinFinal = t.precoCliente * (1 - d.desconto_pct / 100);
            // Ideal price (valor_mercado) for margin range
            const precoIdealCen = items.reduce((s, i) => s + ((i.valor_mercado || i.honorario_minimo_contador || i.honorario || 0)) * i.quantidade, 0) * (1 - d.desconto_pct / 100);
            const margemMin = precoMinFinal - custoFinal;
            const margemIdeal = precoIdealCen - custoFinal;
            const margemMinPct = custoFinal > 0 ? (((precoMinFinal / custoFinal) - 1) * 100).toFixed(0) : '0';
            const margemIdealPct = custoFinal > 0 ? (((precoIdealCen / custoFinal) - 1) * 100).toFixed(0) : '0';
            const temFaixa = margemIdeal > margemMin && precoIdealCen > precoMinFinal;
            const hasTx = t.taxaMin > 0 || t.taxaMax > 0;
            const investVal = hasTx ? `${fmt(precoMinFinal + t.taxaMin)} a ${fmt(precoMinFinal + t.taxaMax)}` : fmt(precoMinFinal);
            return `
              <div style="display: flex; gap: 12px; width: 100%; margin-bottom: 12px;">
                <div style="width: 28px; height: 28px; background: #0f3d24; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: #86efac; font-size: 13px; font-weight: 800; flex-shrink: 0; margin-top: 12px;">${String.fromCharCode(65 + ci)}</div>
                <div style="flex: 1; display: flex; gap: 10px;">
                  <div style="flex: 1; background: #f8f8f8; border: 1px solid #e0e0e0; border-radius: 8px; padding: 12px; text-align: center;">
                    <div style="font-size: 8px; color: #666; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">CUSTO TREVO</div>
                    <div style="font-size: 16px; font-weight: 700; color: #333;">${fmt(custoFinal)}</div>
                  </div>
                  <div style="flex: 1; background: #e8f5e9; border: 2px solid #2d6a4f; border-radius: 8px; padding: 12px; text-align: center;">
                    <div style="font-size: 8px; color: #1a4731; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">COBRAR DO CLIENTE</div>
                    <div style="font-size: 16px; font-weight: 700; color: #0f3d24;">${investVal}</div>
                  </div>
                  <div style="flex: 1; background: #1a4731; border-radius: 8px; padding: 12px; text-align: center;">
                    <div style="font-size: 8px; color: #86efac; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">MARGEM</div>
                    <div style="font-size: ${temFaixa ? '13' : '16'}px; font-weight: 700; color: #ffffff;">${temFaixa ? `${fmt(margemMin)} a ${fmt(margemIdeal)}` : fmt(margemMin)}</div>
                    <div style="font-size: 9px; color: #86efac; margin-top: 2px;">${temFaixa ? `${margemMinPct}% a ${margemIdealPct}%` : `${margemMinPct}%`}</div>
                  </div>
                </div>
              </div>
              <div style="font-size: 9px; color: #666; margin-left: 40px; margin-top: -8px; margin-bottom: 8px;">${esc(cen.nome)}${cen.descricao ? ' — ' + esc(cen.descricao) : ''}</div>
            `;
          }).join('')}
          ` : `
          ${temRecomendacaoPreco ? `
          <div style="display: flex; gap: 16px; width: 100%; margin-top: 24px;">
            <div style="flex: 1; background: #f8f8f8; border: 1px solid #e0e0e0; border-radius: 8px; padding: 20px 16px; text-align: center;">
              <div style="font-size: 9px; color: #666; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px;">SEU CUSTO TREVO</div>
              <div style="font-size: 20px; font-weight: 700; color: #333;">${fmt(custoTrevoFinalCapa)}</div>
            </div>
            <div style="flex: 1; background: #e8f5e9; border: 2px solid #2d6a4f; border-radius: 8px; padding: 20px 16px; text-align: center;">
              <div style="font-size: 9px; color: #1a4731; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px;">COBRAR DO CLIENTE</div>
              <div style="font-size: 24px; font-weight: 700; color: #0f3d24;">${valorCapa}</div>
              <div style="font-size: 9px; color: #555; margin-top: 6px;">honorários${hasTaxas ? ' + taxas gov. estimadas' : ''}</div>
            </div>
            <div style="flex: 1; background: #1a4731; border-radius: 8px; padding: 20px 16px; text-align: center;">
              <div style="font-size: 9px; color: #86efac; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px;">SUA MARGEM</div>
              <div style="font-size: ${temMargemFaixa ? '18' : '24'}px; font-weight: 700; color: #ffffff;">${temMargemFaixa ? `${fmt(margemCapaMin)} a ${fmt(margemCapaIdeal)}` : fmt(margemCapaMin)}</div>
              <div style="font-size: 11px; color: #86efac; margin-top: 6px;">${temMargemFaixa ? `${margemCapaMinPct}% a ${margemCapaIdealPct}%` : `${margemCapaMinPct}%`} de lucro</div>
            </div>
          </div>
          ` : `
          <div style="display: flex; justify-content: center; width: 100%; margin-top: 24px;">
            <div style="background: #f8f8f8; border: 1px solid #e0e0e0; border-radius: 8px; padding: 24px 48px; text-align: center;">
              <div style="font-size: 9px; color: #666; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px;">SEU CUSTO TREVO</div>
              <div style="font-size: 28px; font-weight: 700; color: #0f3d24;">${fmt(custoTrevoFinalCapa)}</div>
              <div style="font-size: 9px; color: #555; margin-top: 6px;">honorários${hasTaxas ? ' + taxas gov. estimadas' : ''}</div>
            </div>
          </div>
          `}
          `}
        </div>

        ${(d.etapas_fluxo && d.etapas_fluxo.length > 0) ? `
        <!-- Dynamic flow from form -->
        <div style="padding: 0 48px; flex-shrink: 0; margin-top: 32px;">
          <div style="border-top: 1px solid #e2e8f0; margin-bottom: 24px;"></div>
          <div style="font-size: 10px; font-weight: 600; color: #64748b; letter-spacing: 0.8px; text-transform: uppercase; margin-bottom: 14px;">Fluxo de execução estimado</div>
          <div style="display: flex; align-items: flex-start; justify-content: center; gap: 8px; padding: 16px 0;">
            ${d.etapas_fluxo.map((etapa, idx, arr) => {
              const isLast = idx === arr.length - 1;
              const circleContent = isLast ? '✓' : String(idx + 1);
              const circleBg = isLast ? '#0f3d24' : '#1a4731';
              const circleColor = isLast ? '#86efac' : 'white';
              const labelWeight = isLast ? '700' : '600';
              return `
                <div style="flex: 1; text-align: center; max-width: 180px; flex-shrink: 1; min-width: 0;">
                  <div style="width: 32px; height: 32px; background: ${circleBg}; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: ${isLast ? '11' : '13'}px; font-weight: 700; color: ${circleColor}; margin: 0 auto 6px auto; line-height: 1; text-align: center;">${circleContent}</div>
                  <div style="font-weight: ${labelWeight}; font-size: 10px; color: #111827; line-height: 1.3; word-wrap: break-word; overflow-wrap: break-word;">${esc(etapa.nome)}</div>
                  ${etapa.prazo ? `<div style="font-size: 9px; color: #6b7280; margin-top: 4px; line-height: 1.3; word-wrap: break-word; overflow-wrap: break-word;">${esc(etapa.prazo)}</div>` : ''}
                </div>
                ${!isLast ? '<div style="font-size: 18px; color: #9ca3af; margin-top: 14px; flex-shrink: 0;">→</div>' : ''}
              `;
            }).join('')}
          </div>
        </div>
        ` : ''}

        <!-- ZONA 4: Footer info -->
        <div style="padding: 0 40px 20px; flex-shrink: 0; margin-top: 24px;">
          <div style="border-top: 1px solid #e0e0e0; padding-top: 12px; text-align: center;">
            <div style="font-size: 10px; color: #888;">
              📋 ${itemCount} serviços incluídos &nbsp;·&nbsp; Válido por ${d.validade_dias} dias &nbsp;·&nbsp; Emissão: ${d.data_emissao}
            </div>
            <div style="font-size: 9px; color: #aaa; font-style: italic; margin-top: 6px;">
              Desde 2018 · Referência nacional em regularização empresarial · Atuação em 27 estados
            </div>
          </div>
        </div>

        <div style="position: absolute; bottom: 0; left: 0; right: 0;">${footer}</div>
      </div>
    `);
  } else {
    // ═══════════════════════════════════════════
    // CLIENT COVER — unchanged layout
    // ═══════════════════════════════════════════
    const coverValueBoxHtml = temCenarios ? (() => {
      // Show per-scenario values
      return `
        <div style="margin-top: 40px; width: 100%;">
          <div style="font-size: 10px; color: ${accentText}; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 12px; text-align: center;">Investimento por Cenário</div>
          <div style="display: flex; gap: 12px; justify-content: center;">
            ${cenarios.map((cen, ci) => {
              const items = getItensCenario(cen.id);
              const t = computeTotals(items);
              const hon = pdfMode === 'direto' ? t.precoDireto : t.precoCliente;
              const honFinal = hon * (1 - d.desconto_pct / 100);
              const valMin = honFinal + t.taxaMin;
              const valMax = honFinal + t.taxaMax;
              const hasTx = t.taxaMin > 0 || t.taxaMax > 0;
              const val = hasTx ? `${fmt(valMin)} a ${fmt(valMax)}` : fmt(honFinal);
              return `
                <div style="flex: 1; max-width: 260px; padding: 16px; background: ${accentBg}; border: 2px solid ${accentBorder}; border-radius: 12px; text-align: center;">
                  <div style="font-size: 9px; font-weight: 700; color: ${accentText}; letter-spacing: 1px; margin-bottom: 6px;">${String.fromCharCode(65 + ci)} — ${esc(cen.nome)}</div>
                  ${cen.descricao ? `<div style="font-size: 8px; color: #6b7280; margin-bottom: 8px;">${esc(cen.descricao)}</div>` : ''}
                  <div style="font-size: ${hasTx ? '20' : '26'}px; font-weight: 900; color: ${accentText};">${val}</div>
                </div>
              `;
            }).join('')}
          </div>
          <div style="font-size: 8px; color: #9ca3af; margin-top: 8px; letter-spacing: 0.3px; text-align: center;">
            O cliente escolhe um dos cenários acima. Honorários profissionais${hasTaxas ? ' + taxas governamentais estimadas' : ''}
          </div>
        </div>
      `;
    })() : `
      <div style="margin-top: 40px; padding: 20px 40px; background: ${accentBg}; border: 2px solid ${accentBorder}; border-radius: 16px; text-align: center;">
        <div style="font-size: 10px; color: ${accentText}; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 4px;">Investimento Estimado</div>
        <div style="font-size: ${hasTaxas ? '26' : '36'}px; font-weight: 900; color: ${accentText};">${valorCapa}</div>
      </div>
      <div style="font-size: 8px; color: #9ca3af; margin-top: 8px; letter-spacing: 0.3px;">
        Honorários profissionais${hasTaxas ? ' + taxas governamentais estimadas' : ''}
      </div>
    `;

    const coverBulletsHtml = `
      <div style="margin-top: 24px; border-top: 1px solid #e0e0e0; padding-top: 16px; width: 100%; max-width: 500px; text-align: center;">
        <div style="font-size: 11px; color: #555;">
          📋 ${itemCount} serviços incluídos
        </div>
        <div style="font-size: 10px; color: #888; margin-top: 6px; word-wrap: break-word; overflow-wrap: break-word;">
          Válido por ${d.validade_dias} dias
        </div>
        <div style="font-size: 10px; color: #888; margin-top: 4px; word-wrap: break-word; overflow-wrap: break-word;">
          ${sanitizeRichHtml(d.pagamento || 'Pagamento à vista via PIX/boleto bancário ou parcelamento')}
        </div>
        ${d.data_emissao ? `<div style="font-size: 10px; color: #888; margin-top: 4px;">Proposta emitida em ${d.data_emissao}</div>` : ''}
      </div>
    `;

    pages.push(`
      <div style="font-family: Arial, Helvetica, sans-serif; width: 794px; height: 1123px; background: white; position: relative; display: flex; flex-direction: column;">
        ${header}
        <div style="flex: 1; display: flex; flex-direction: column; justify-content: center; align-items: center; padding: 40px 60px;">
          <div style="font-size: 10px; color: ${accentColorLight}; text-transform: uppercase; letter-spacing: 4px; font-weight: 700; margin-bottom: 20px;">Proposta Comercial</div>
          <div style="font-size: 28px; font-weight: 600; color: #1a1a2e; text-align: center; margin-bottom: 8px;">${esc(displayName)}</div>
          ${d.prospect_cnpj ? `<div style="font-size: 14px; color: #64748b;">CNPJ: ${esc(d.prospect_cnpj)}</div>` : ''}
          ${coverValueBoxHtml}
          ${coverBulletsHtml}

          ${(d.beneficios_capa && d.beneficios_capa.length > 0) ? `
          <!-- Dynamic benefits from form -->
          <div style="margin-top: 36px; width: 100%; max-width: 560px;">
            <div style="border-top: 1px solid #e2e8f0; margin-bottom: 28px;"></div>
            <div style="display: flex; gap: 16px; justify-content: center; margin-bottom: 28px;">
              ${d.beneficios_capa.map((ben, idx) => {
                const svgIcons = [
                  `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="${accentColor}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/></svg>`,
                  `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="${accentColor}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/><path d="m9 14 2 2 4-4"/></svg>`,
                  `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="${accentColor}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`,
                ];
                const isMiddle = idx === 1 && d.beneficios_capa!.length >= 2;
                const bgStyle = isMiddle ? `background: ${accentBg}; border: 1px solid ${useBlueTheme ? '#bfdbfe' : '#bbf7d0'};` : 'background: #f8fafc; border: 1px solid #e2e8f0;';
                const titleColor = isMiddle ? accentText : '#1e293b';
                return `
                  <div style="flex: 1; text-align: center; padding: 16px 12px; ${bgStyle} border-radius: 10px;">
                    <div style="margin-bottom: 8px; display: flex; justify-content: center;">${svgIcons[idx % 3]}</div>
                    <div style="font-size: 11px; font-weight: 700; color: ${titleColor}; margin-bottom: 4px;">${esc(ben.titulo)}</div>
                    <div style="font-size: 10px; color: #64748b; line-height: 1.4;">${esc(ben.descricao)}</div>
                  </div>
                `;
              }).join('')}
            </div>
            ${d.headline_cenario ? `
            <div style="text-align: center; font-size: 12px; font-style: italic; color: #475569; padding: 14px 20px; background: #f1f5f9; border-radius: 8px; line-height: 1.5;">
              "${esc(d.headline_cenario)}"
            </div>
            ` : ''}
          </div>
          ` : (d.headline_cenario ? `
          <div style="margin-top: 36px; width: 100%; max-width: 560px;">
            <div style="border-top: 1px solid #e2e8f0; margin-bottom: 28px;"></div>
            <div style="text-align: center; font-size: 12px; font-style: italic; color: #475569; padding: 14px 20px; background: #f1f5f9; border-radius: 8px; line-height: 1.5;">
              "${esc(d.headline_cenario)}"
            </div>
          </div>
          ` : '')}
        </div>
        <div style="position: absolute; bottom: 0; left: 0; right: 0;">${footer}</div>
      </div>
    `);
  }

  // ═══════════════════════════════════════════════════════════════
  // SMART PAGINATION: All content after the cover is collected as
  // "blocks" (HTML fragments), measured for real height, then packed
  // into pages using height accumulation — no forced page breaks.
  // ═══════════════════════════════════════════════════════════════
  interface ContentBlock { html: string; height: number; }
  const contentBlocks: ContentBlock[] = [];

  async function addBlock(html: string) {
    const h = await medirAlturaReal(html);
    contentBlocks.push({ html, height: h });
  }

  // --- CONTEXT / RISKS / FLOW BLOCKS ---
  const temContexto = d.contexto && d.contexto.trim().length > 0;
  const temOrdem = d.ordem_execucao && d.ordem_execucao.trim().length > 0;
  const temRiscos = d.riscos && d.riscos.length > 0 && d.riscos.some(r => r.penalidade.trim());
  const temEtapasFluxo = d.etapas_fluxo && d.etapas_fluxo.length > 0 && d.etapas_fluxo.some(e => e.nome.trim());
  const temHeadline = d.headline_cenario && d.headline_cenario.trim().length > 0;

  if (temRiscos) {
    await addBlock(`
      <div style="background: #FEF2F2; border-left: 4px solid #B03030; border-radius: 8px; padding: 16px 20px; margin-bottom: 20px;">
        <div style="font-size: 11px; font-weight: 700; color: #7F1D1D; margin-bottom: 8px;">⛔ SITUAÇÃO ATUAL — RISCOS DE OPERAÇÃO SEM REGULARIZAÇÃO</div>
        <div style="font-size: 11px; color: #991B1B; line-height: 1.8;">
          ${d.riscos!.filter(r => r.penalidade.trim()).map(r =>
            `• ${esc(r.penalidade)}${r.condicao ? ': ' + esc(r.condicao) : ''}`
          ).join('<br/>')}
        </div>
      </div>
    `);
  }

  if (temContexto) {
    const leadForteHtml = temHeadline ? `
      <div style="font-weight: 600; font-size: 13px; color: #1a4731; margin-bottom: 12px; line-height: 1.5;">
        ${esc(d.headline_cenario!)}
      </div>
    ` : '';
    await addBlock(`
      <div style="margin-bottom: 30px;">
        <div style="font-size: 10px; font-weight: 700; color: ${accentColorLight}; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 12px; border-bottom: 2px solid ${accentBg}; padding-bottom: 8px;">Cenário e Oportunidade</div>
        ${leadForteHtml}
        <div style="background: #fafafa; border: 1px solid #e5e7eb; border-radius: 16px; padding: 24px; margin-top: 12px;">
          <div style="line-height: 1.7; font-size: 11px; color: #374151;">${formatarContextoPDF(d.contexto)}</div>
        </div>
      </div>
    `);
  }

  if (temEtapasFluxo && isCliente) {
    const etapas = d.etapas_fluxo!.filter(e => e.nome.trim());
    await addBlock(`
      <div style="margin-top: 24px; margin-bottom: 20px;">
        <div style="font-size: 10px; font-weight: 700; color: ${accentColorLight}; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 12px; border-bottom: 2px solid ${accentBg}; padding-bottom: 8px;">Fluxo de Execução Estimado</div>
        <div style="display: flex; align-items: flex-start; justify-content: center; gap: 8px; padding: 16px 0;">
          ${etapas.map((etapa, idx) => {
            const isLast = idx === etapas.length - 1;
            const circleContent = isLast ? '✓' : String(idx + 1);
            const bgColor = useBlueTheme ? (isLast ? '#1e40af' : '#3b82f6') : (isLast ? '#0f3d24' : '#1a4731');
            const textColor = isLast ? (useBlueTheme ? '#93c5fd' : '#86efac') : 'white';
            return `
              <div style="flex: 1; text-align: center; max-width: 180px; flex-shrink: 1; min-width: 0;">
                <div style="width: 32px; height: 32px; background: ${bgColor}; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: ${isLast ? '11' : '13'}px; font-weight: 700; color: ${textColor}; margin: 0 auto 6px auto; line-height: 1; text-align: center;">${circleContent}</div>
                <div style="font-weight: 600; font-size: 10px; color: #111827; line-height: 1.3; word-wrap: break-word; overflow-wrap: break-word;">${esc(etapa.nome)}</div>
                ${etapa.prazo ? `<div style="font-size: 9px; color: #6b7280; margin-top: 4px; line-height: 1.3; word-wrap: break-word; overflow-wrap: break-word;">${esc(etapa.prazo)}</div>` : ''}
              </div>
              ${!isLast ? `<div style="font-size: 18px; color: #9ca3af; margin-top: 14px; flex-shrink: 0;">→</div>` : ''}
            `;
          }).join('')}
        </div>
      </div>
    `);
  }

  if (temOrdem) {
    await addBlock(`
      <div style="margin-bottom: 20px;">
        <div style="font-size: 10px; font-weight: 700; color: ${accentColorLight}; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 12px; border-bottom: 2px solid ${accentBg}; padding-bottom: 8px;">Ordem Sugerida de Execução</div>
        <div style="background: #f8fafc; border-radius: 12px; padding: 16px; border: 1px solid #e2e8f0;">
          ${formatarOrdemExecucao(d.ordem_execucao, useBlueTheme)}
        </div>
      </div>
    `);
    if (!isCliente || pdfMode === 'direto') {
      await addBlock(`
        <div style="margin-bottom: 20px; padding: 20px 24px; background: #f0faf4; border-left: 4px solid #1a4731; border-radius: 0 8px 8px 0;">
          <div style="font-size: 12px; font-weight: 700; color: #1a4731; margin-bottom: 12px;">Por que a Trevo Legaliza?</div>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px 16px;">
            <div style="font-size: 11px; color: #333;">✓ +8 anos de mercado</div>
            <div style="font-size: 11px; color: #333;">✓ 27 estados de atuação</div>
            <div style="font-size: 11px; color: #333;">✓ Expertise full-service</div>
            <div style="font-size: 11px; color: #333;">✓ Honorários fixos por item</div>
          </div>
          <div style="font-size: 10px; color: #555; font-style: italic; margin-top: 10px;">${pdfMode === 'direto' ? 'Regularize sua empresa com quem entende do assunto.' : 'Você vende. A Trevo executa. Simples assim.'}</div>
        </div>
      `);
    }
  }

  // --- SCOPE ITEMS BLOCKS ---
  const grouped = secoes
    .map(s => ({ ...s, items: d.itens.filter(i => i.secao === s.key).sort((a, b) => a.ordem - b.ordem) }))
    .filter(g => g.items.length > 0);

  interface ItemEntry {
    item: OrcamentoItem;
    sectionLabel?: string;
    sectionKey?: string;
  }

  const allEntries: ItemEntry[] = [];
  for (const group of grouped) {
    const label = group.key !== 'geral' ? `${group.label} (${group.items.length})` : undefined;
    group.items.forEach((item, i) => {
      allEntries.push({ item, sectionLabel: i === 0 ? label : undefined, sectionKey: group.key });
    });
  }

  // Add scope section title as its own block (only once, before first item)
  if (allEntries.length > 0) {
    await addBlock(`
      <div style="font-size: 10px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 16px; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px;">Escopo dos Serviços</div>
    `);
  }

  // Build HTML for a single entry card (extracted for measurement)
  function buildEntryHtml(entry: ItemEntry): string {
    let cardHtml = '';
    const item = entry.item;

    if (entry.sectionLabel) {
      cardHtml += `<div style="font-size: 11px; font-weight: 700; color: ${accentText}; text-transform: uppercase; letter-spacing: 2px; margin: 20px 0 10px; padding-bottom: 6px; border-bottom: 2px solid ${accentBg};">${esc(entry.sectionLabel)}</div>`;
    }

    const valorExibido = pdfMode === 'direto'
      ? (item.valorVendaDireto || item.valor_mercado || item.honorario_minimo_contador || item.honorario)
      : isCliente
        ? (item.honorario_minimo_contador || item.honorario)
        : getItemValor(item);
    const valorTotal = valorExibido * item.quantidade;
    const totalMin = valorTotal + item.taxa_min;
    const totalMax = valorTotal + item.taxa_max;
    const hasTaxaItem = item.taxa_min > 0 || item.taxa_max > 0;
    const isOpcional = item.isOptional === true || entry.sectionKey === 'opcionais' || (secoes.find(s => s.key === entry.sectionKey)?.label || '').toLowerCase().includes('opcional');
    const isCNES = /cnes|altamente recomendado/i.test(item.descricao);
    const borderColor = isOpcional
      ? (isCNES ? '#10b981' : '#e5e7eb')
      : (entry.sectionKey === 'obrigatorios' ? '#22c55e' : '#e5e7eb');
    const borderStyle = 'solid';

    // Financial section based on PDF mode
    let financialHtml = '';
    if (!isCliente) {
      const hMin = item.honorario_minimo_contador || 0;
      const vMerc = item.valor_mercado || 0;
      const vPrem = item.valor_premium || 0;
      const margemMin = hMin > 0 && item.honorario > 0 ? hMin - item.honorario : 0;
      const margemMinPct = item.honorario > 0 && hMin > 0 ? ((hMin / item.honorario - 1) * 100).toFixed(0) : '0';
      const margemMerc = vMerc > 0 && item.honorario > 0 ? vMerc - item.honorario : 0;
      const margemMercPct = item.honorario > 0 && vMerc > 0 ? ((vMerc / item.honorario - 1) * 100).toFixed(0) : '0';
      const hasContadorFields = hMin > 0 || vMerc > 0 || vPrem > 0;

      if (hasContadorFields) {
        financialHtml = `
          <div style="padding: 0 18px 12px;">
            <div style="display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 1px; background: #e5e7eb; border-radius: 12px; overflow: hidden; margin: 12px 0;">
              <div style="padding: 10px; background: #f5f5f5; text-align: center;">
                <div style="font-size: 8px; font-weight: 800; letter-spacing: 0.8px; text-transform: uppercase; color: #666666; margin-bottom: 4px;">NOSSO CUSTO</div>
                <div style="font-size: 12px; font-weight: 400; color: #666666;">${fmt(item.honorario)}</div>
              </div>
              <div style="padding: 10px; background: #e8f5e9; border: 1px solid #a5d6a7; text-align: center;">
                <div style="font-size: 8px; font-weight: 800; letter-spacing: 0.8px; text-transform: uppercase; color: #9ca3af; margin-bottom: 4px;">COBRAR NO MÍNIMO</div>
                <div style="font-size: 12px; font-weight: 500; color: #2e7d32;">${hMin > 0 ? fmt(hMin) : '—'}</div>
                ${margemMin > 0 ? `<div style="font-size: 8px; color: #388e3c; margin-top: 2px;">Margem: ${fmt(margemMin)} (${margemMinPct}%)</div>` : ''}
              </div>
              <div style="padding: 10px; background: #c8e6c9; border: 2px solid #4caf50; text-align: center;">
                <div style="font-size: 9px; color: #2e7d32; font-weight: 700; margin-bottom: 2px;">✓ IDEAL</div>
                <div style="font-size: 8px; font-weight: 800; letter-spacing: 0.8px; text-transform: uppercase; color: #9ca3af; margin-bottom: 4px;">VALOR DE MERCADO</div>
                <div style="font-size: 12px; font-weight: 700; color: #1b5e20;">${vMerc > 0 ? fmt(vMerc) : '—'}</div>
                ${margemMerc > 0 ? `<div style="font-size: 8px; color: #2e7d32; font-weight: 600; margin-top: 2px;">Margem: ${fmt(margemMerc)} (${margemMercPct}%)</div>` : ''}
              </div>
              <div style="padding: 10px; background: #fff3cd; border: 1px solid #ffc107; text-align: center;">
                <div style="font-size: 8px; font-weight: 800; letter-spacing: 0.8px; text-transform: uppercase; color: #9ca3af; margin-bottom: 4px;">ACIMA = CARO</div>
                <div style="font-size: 12px; font-weight: 400; color: #856404;">${vPrem > 0 ? fmt(vPrem) : '—'}</div>
              </div>
            </div>
            ${hasTaxaItem ? `<div style="font-size: 8px; color: #6b7280; text-align: center; padding: 4px 0;">Taxas externas (pagas pelo cliente): ${fmt(item.taxa_min)} a ${fmt(item.taxa_max)}</div>` : ''}
          </div>
        `;
      } else {
        financialHtml = `
          <div style="padding: 12px 18px; background: #fafafa;">
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 4px 0; font-size: 10px;">
              <span style="color: #6b7280;">Honorário Trevo</span>
              <span style="font-weight: 700; color: #1a1a2e;">${fmt(valorTotal)}</span>
            </div>
            ${hasTaxaItem ? `
              <div style="display: flex; justify-content: space-between; align-items: center; padding: 4px 0; font-size: 10px;">
                <span style="color: #6b7280;">Taxas externas (estimativa)</span>
                <span style="font-weight: 500; color: #92400e;">${fmt(item.taxa_min)} a ${fmt(item.taxa_max)}</span>
              </div>
              <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 6px; padding-top: 8px; border-top: 1px solid #e5e7eb; font-size: 10px;">
                <span style="font-weight: 700; color: #1a1a2e;">Total estimado</span>
                <span style="font-size: 11px; font-weight: 700; color: ${accentText};">${fmt(totalMin)} a ${fmt(totalMax)}</span>
              </div>
            ` : ''}
          </div>
        `;
      }
    } else {
      financialHtml = `
        <div style="padding: 12px 18px; background: #fafafa;">
          <div style="display: flex; justify-content: space-between; align-items: center; padding: 4px 0; font-size: 10px;">
            <span style="color: #6b7280;">Investimento</span>
            <span style="font-weight: 700; color: #1a1a2e;">${fmt(valorTotal)}</span>
          </div>
          ${hasTaxaItem ? `
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 4px 0; font-size: 10px;">
              <span style="color: #6b7280;">Taxas governamentais (estimativa)</span>
              <span style="font-weight: 500; color: #92400e;">${fmt(item.taxa_min)} a ${fmt(item.taxa_max)}</span>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 6px; padding-top: 8px; border-top: 1px solid #e5e7eb; font-size: 10px;">
              <span style="font-weight: 700; color: #1a1a2e;">Total estimado</span>
              <span style="font-size: 11px; font-weight: 700; color: ${accentText};">${fmt(totalMin)} a ${fmt(totalMax)}</span>
            </div>
          ` : ''}
        </div>
      `;
    }

    const showDocsSection = item.prazo || item.docs_necessarios;
    const cenarioDoItem = temCenarios && item.cenarioId ? cenarios.find(c => c.id === item.cenarioId) : null;
    const cenarioIdx = cenarioDoItem ? cenarios.indexOf(cenarioDoItem) : -1;

    const numeroItem = item.ordem || (allEntries.indexOf(entry) + 1);
    cardHtml += `
      <div style="border: 1px solid #e5e7eb; border-left: 4px ${borderStyle} ${borderColor}; border-radius: 16px; margin-bottom: 14px; overflow: hidden;">
        <div style="display: flex; align-items: center; background: linear-gradient(135deg, #1a3a2a 0%, #2d5a3d 100%); padding: 10px 16px; gap: 10px; min-height: 48px;">
          <div style="width: 32px; height: 32px; min-width: 32px; border-radius: 50%; background: rgba(255,255,255,0.15); display: flex; align-items: center; justify-content: center; color: white; font-weight: 700; font-size: 14px; flex-shrink: 0;">${numeroItem}</div>
          <div style="flex: 1; min-width: 0; color: white; font-weight: 600; font-size: 12px; line-height: 1.4;">${esc(item.descricao)}</div>
          ${cenarioDoItem ? `<div style="display: inline-flex; align-items: center; justify-content: center; width: 24px; height: 24px; min-width: 24px; border-radius: 4px; background: rgba(255,255,255,0.2); color: white; font-weight: 800; font-size: 11px; flex-shrink: 0;">${String.fromCharCode(65 + cenarioIdx)}</div>` : ''}
          ${isOpcional ? `<div style="display: inline-flex; align-items: center; padding: 2px 8px; border-radius: 3px; font-size: 9px; font-weight: 700; letter-spacing: 0.3px; white-space: nowrap; flex-shrink: 0; background: rgba(255,255,255,0.15); color: ${isCNES ? '#4ade80' : '#fbbf24'};">${isCNES ? '★ RECOMENDADO' : 'OPCIONAL'}</div>` : ''}
          <div style="font-weight: 800; font-size: 15px; white-space: nowrap; color: white; flex-shrink: 0;">${fmt(valorTotal)}</div>
        </div>
        ${item.detalhes ? `<div style="padding: 12px 18px; font-size: 10.5px; line-height: 1.6; color: #6b7280; border-bottom: 1px solid #f3f4f6;">${sanitizeRichHtml(item.detalhes)}</div>` : ''}
        ${showDocsSection ? `
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1px; background: #f3f4f6; border-bottom: 1px solid #f3f4f6;">
            <div style="padding: 10px 18px; background: #ffffff;">
              <div style="font-size: 8px; font-weight: 800; color: #9ca3af; letter-spacing: 0.6px; text-transform: uppercase; margin-bottom: 4px;">Prazo</div>
              <div style="font-size: 10px; color: #374151; font-weight: 500;">${esc(item.prazo || 'A definir')}</div>
            </div>
            <div style="padding: 10px 18px; background: #ffffff;">
              <div style="font-size: 8px; font-weight: 800; color: #9ca3af; letter-spacing: 0.6px; text-transform: uppercase; margin-bottom: 4px;">Documentos necessários</div>
              <div style="font-size: 10px; color: #374151; font-weight: 500;">${esc(item.docs_necessarios || '—')}</div>
            </div>
          </div>
        ` : ''}
        ${financialHtml}
      </div>
    `;

    return cardHtml;
  }

  // Add each item as a block
  for (const entry of allEntries) {
    await addBlock(buildEntryHtml(entry));
  }

  // --- PACKAGES BLOCKS ---
  const validPacotes = d.pacotes.filter(p => p.nome && p.itens_ids.length > 0);
  if (validPacotes.length > 0) {
    await addBlock(`
      <div style="font-size: 10px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 16px; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px;">Pacotes Disponíveis</div>
    `);

    for (const pac of validPacotes) {
      const selected = d.itens.filter(i => pac.itens_ids.includes(i.id));
      const descontoPct = pac.desconto_pct / 100;
      const custoSemDesconto = selected.reduce((s, i) => s + (i.honorario || 0) * i.quantidade, 0);
      const custoComDesconto = custoSemDesconto * (1 - descontoPct);
      const precoSemDescontoCliente = selected.reduce((s, i) => s + ((i.honorario_minimo_contador || i.honorario || 0)) * i.quantidade, 0);
      const precoSemDescontoDireto = selected.reduce((s, i) => s + ((i.valorVendaDireto || i.valor_mercado || i.honorario_minimo_contador || i.honorario || 0)) * i.quantidade, 0);
      const precoSemDesconto = pdfMode === 'direto' ? precoSemDescontoDireto : precoSemDescontoCliente;
      const precoComDesconto = precoSemDesconto * (1 - descontoPct);
      const margemValor = precoComDesconto - custoComDesconto;
      const margemPct = custoComDesconto > 0 ? ((margemValor / custoComDesconto) * 100).toFixed(0) : '0';
      const taxaMin = selected.reduce((s, i) => s + i.taxa_min, 0);
      const taxaMax = selected.reduce((s, i) => s + i.taxa_max, 0);
      const hasTaxaPac = taxaMin > 0 || taxaMax > 0;
      const itensNomes = selected.map(i => `✓ ${i.ordem}. ${i.descricao}`);
      const isCompleto = pac.nome.toLowerCase().includes('completo');
      const recomendadoBadge = isCompleto
        ? `<div style="background: #1a4731; color: #ffffff; font-size: 9px; padding: 3px 8px; border-radius: 4px; font-weight: 700;">★ RECOMENDADO</div>`
        : '';
      const pacBorder = isCompleto ? '2px solid #1a4731' : '1px solid #e5e7eb';

      if (!isCliente) {
        await addBlock(`
          <div style="border: ${pacBorder}; border-radius: 16px; margin-bottom: 16px; overflow: hidden;">
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 14px 18px; background: linear-gradient(135deg, #0f1f0f 0%, #1a3a1a 100%);">
              <span style="font-size: 14px; font-weight: 800; color: #ffffff;">${esc(pac.nome)}</span>
              <div style="display: flex; align-items: center; gap: 8px;">
                ${recomendadoBadge}
                <span style="font-size: 11px; color: #4ade80; font-weight: 700;">-${pac.desconto_pct}% de desconto</span>
              </div>
            </div>
            <div style="padding: 12px 18px; border-bottom: 1px solid #f3f4f6;">
              ${itensNomes.map(n => `<div style="font-size: 10px; color: #374151; padding: 2px 0;">${esc(n)}</div>`).join('')}
            </div>
            <div style="border-top: 1px solid #e5e7eb;">
              <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 18px; border-bottom: 1px solid #f3f4f6;">
                <div style="font-size: 8px; font-weight: 800; letter-spacing: 0.6px; text-transform: uppercase; color: #9ca3af;">SEU CUSTO TREVO</div>
                <div style="text-align: right; font-size: 11px;">
                  <span style="text-decoration: line-through; color: #9ca3af; margin-right: 8px; font-size: 9px;">${fmt(custoSemDesconto)}</span>
                  <span style="font-weight: 700;">${fmt(custoComDesconto)}</span>
                </div>
              </div>
              <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 18px; border-bottom: 1px solid #f3f4f6; background: #f0fdf4;">
                <div style="font-size: 8px; font-weight: 800; letter-spacing: 0.6px; text-transform: uppercase; color: #9ca3af;">SUGESTÃO PARA SEU CLIENTE</div>
                <div style="text-align: right; font-size: 11px;">
                  <span style="text-decoration: line-through; color: #9ca3af; margin-right: 8px; font-size: 9px;">${fmt(precoSemDesconto)}</span>
                  <span style="font-weight: 700; color: #166534;">${fmt(precoComDesconto)}</span>
                </div>
              </div>
              <div style="margin: 14px 18px 10px; padding: 14px 20px; background: #f0fdf4; border: 1.5px solid #4ade80; border-radius: 10px; display: flex; align-items: center; justify-content: space-between;">
                <div>
                  <div style="font-size: 10px; font-weight: 600; color: #166534; letter-spacing: 0.5px; text-transform: uppercase; margin-bottom: 4px;">Você ganha com este pacote</div>
                  <div style="font-size: 22px; font-weight: 700; color: #15803d; line-height: 1;">${fmt(margemValor)}</div>
                  <div style="font-size: 11px; color: #4ade80; margin-top: 3px; font-weight: 500;">${margemPct}% de lucro líquido</div>
                </div>
                <div style="width: 52px; height: 52px; background: #dcfce7; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 22px;">💰</div>
              </div>
              ${hasTaxaPac ? `
                <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 18px; border-bottom: 1px solid #f3f4f6;">
                  <div style="font-size: 8px; font-weight: 800; letter-spacing: 0.6px; text-transform: uppercase; color: #9ca3af;">TAXAS EXTERNAS</div>
                  <div style="font-size: 11px;">${fmt(taxaMin)} a ${fmt(taxaMax)}</div>
                </div>
              ` : ''}
              <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px 18px; background: #fafafa; border-top: 2px solid #e5e7eb;">
                <div style="font-size: 8px; font-weight: 800; letter-spacing: 0.6px; text-transform: uppercase; color: #1a1a2e;">INVESTIMENTO TOTAL CLIENTE</div>
                <div style="font-size: 13px; font-weight: 800;">${hasTaxaPac ? `${fmt(precoComDesconto + taxaMin)} a ${fmt(precoComDesconto + taxaMax)}` : fmt(precoComDesconto)}</div>
              </div>
            </div>
          </div>
        `);
      } else {
        await addBlock(`
          <div style="border: ${pacBorder}; border-radius: 16px; margin-bottom: 16px; overflow: hidden;">
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 14px 18px; background: linear-gradient(135deg, #1e293b 0%, #334155 100%);">
              <span style="font-size: 14px; font-weight: 800; color: #ffffff;">${esc(pac.nome)}</span>
              <div style="display: flex; align-items: center; gap: 8px;">
                ${recomendadoBadge}
                <span style="font-size: 11px; color: #93c5fd; font-weight: 700;">-${pac.desconto_pct}% de desconto</span>
              </div>
            </div>
            <div style="padding: 12px 18px; border-bottom: 1px solid #f3f4f6;">
              ${itensNomes.map(n => `<div style="font-size: 10px; color: #374151; padding: 2px 0;">${esc(n)}</div>`).join('')}
            </div>
            <div style="padding: 12px 18px; background: #fafafa;">
              <div style="display: flex; justify-content: space-between; padding: 4px 0; font-size: 10px;">
                <span style="color: #6b7280;">Investimento sem desconto</span>
                <span style="text-decoration: line-through; color: #94a3b8;">${fmt(precoSemDesconto)}</span>
              </div>
              <div style="display: flex; justify-content: space-between; padding: 4px 0; font-size: 10px;">
                <span style="color: #1e40af; font-weight: 600;">Investimento com -${pac.desconto_pct}%</span>
                <span style="color: #1e40af; font-weight: 700;">${fmt(precoComDesconto)}</span>
              </div>
              <div style="font-size: 10px; color: #15803d; font-weight: 600; text-align: right; margin-top: -4px; margin-bottom: 8px; padding: 0 0;">
                ↓ Economia de ${fmt(precoSemDesconto - precoComDesconto)} com este pacote
              </div>
              ${hasTaxaPac ? `
                <div style="display: flex; justify-content: space-between; padding: 4px 0; font-size: 10px;">
                  <span style="color: #6b7280;">Taxas governamentais estimadas</span>
                  <span style="color: #92400e;">${fmt(taxaMin)} a ${fmt(taxaMax)}</span>
                </div>
              ` : ''}
              <div style="display: flex; justify-content: space-between; margin-top: 6px; padding-top: 8px; border-top: 1px solid #e5e7eb; font-size: 11px;">
                <span style="font-weight: 700; color: #1a1a2e;">INVESTIMENTO TOTAL</span>
                <span style="font-weight: 800; color: #1e40af;">${hasTaxaPac ? `${fmt(precoComDesconto + taxaMin)} a ${fmt(precoComDesconto + taxaMax)}` : fmt(precoComDesconto)}</span>
              </div>
            </div>
          </div>
        `);
      }
    }
  }

  // --- SUMMARY / CONDITIONS / CTA BLOCKS ---
  const prazosItens = d.itens.filter(i => i.prazo);
  let prazoHtml = '';
  if (prazosItens.length > 0) {
    const prazoItems = prazosItens.map(i => `
      <div style="display: flex; align-items: baseline; gap: 4px; font-size: 9px; padding: 3px 0;">
        <span style="font-weight: 600; color: #374151; white-space: nowrap;">${esc(shortName(i.descricao))}</span>
        <span style="flex: 1; border-bottom: 1px dotted #d1d5db; min-width: 20px; margin: 0 4px;"></span>
        <span style="font-weight: 500; color: #6b7280; white-space: nowrap;">${esc(i.prazo)}</span>
      </div>
    `).join('');
    prazoHtml = `
      <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; margin-bottom: 16px;">
        <div style="font-size: 9px; color: #94a3b8; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px;">Prazos por Serviço</div>
        ${prazoItems}
        <div style="margin-top: 8px; font-size: 8px; font-style: italic; color: #9ca3af;">Prazo total estimado: execução sequencial, 6 a 12 semanas.</div>
      </div>
    `;
  } else if (d.prazo_execucao) {
    prazoHtml = `
      <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; margin-bottom: 16px;">
        <div style="font-size: 9px; color: #94a3b8; text-transform: uppercase; letter-spacing: 1px;">Prazo de Execução</div>
        <div style="font-size: 12px; font-weight: 600; color: #1e293b; margin-top: 4px;">${esc(d.prazo_execucao)}</div>
      </div>
    `;
  }

  const ctaSection = (!isCliente || pdfMode === 'direto') ? `
    <div style="background: linear-gradient(135deg, #0f1f0f 0%, #1a3a1a 100%); border-radius: 16px; padding: 24px; text-align: center;">
      <div style="font-size: 11px; font-weight: 700; color: #4ade80; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 8px;">Próximo Passo</div>
      <div style="font-size: 10px; color: rgba(255,255,255,0.7); margin-bottom: 16px;">Para aprovar esta proposta, entre em contato conosco:</div>
      <div style="display: flex; justify-content: center; gap: 24px; font-size: 10px; color: #ffffff;">
        <span>📱 (11) 93492-7001</span>
        <span>✉️ administrativo@trevolegaliza.com.br</span>
        <span>🌐 trevolegaliza.com.br</span>
      </div>
    </div>
  ` : (() => {
    const ctaNome = d.escritorioNome || d.contadorNome || '';
    const ctaTelefone = d.escritorioTelefone || d.contadorTelefone || '';
    const ctaEmail = d.escritorioEmail || d.contadorEmail || '';
    if (ctaNome) {
      const contactLines: string[] = [];
      if (ctaTelefone) contactLines.push(`<div style="font-size: 11px; color: #ffffff; margin-top: 6px;">📱 ${esc(ctaTelefone)}</div>`);
      if (ctaEmail) contactLines.push(`<div style="font-size: 11px; color: #ffffff; margin-top: 4px;">✉️ ${esc(ctaEmail)}</div>`);
      return `
        <div style="background: linear-gradient(135deg, #1e293b 0%, #334155 100%); border-radius: 16px; padding: 24px; text-align: center;">
          <div style="font-size: 11px; font-weight: 700; color: #93c5fd; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 8px;">Próximo Passo</div>
          <div style="font-size: 10px; color: rgba(255,255,255,0.7); margin-bottom: 12px;">Esta proposta é válida por ${d.validade_dias} dias. Para avançar ou esclarecer dúvidas, entre em contato — estamos prontos para começar.</div>
          <div style="font-size: 14px; font-weight: 700; color: #ffffff; margin-top: 8px;">${esc(ctaNome)}</div>
          ${contactLines.join('')}
        </div>
      `;
    }
    return `
      <div style="background: linear-gradient(135deg, #1e293b 0%, #334155 100%); border-radius: 16px; padding: 24px; text-align: center;">
        <div style="font-size: 11px; font-weight: 700; color: #93c5fd; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 8px;">Próximo Passo</div>
        <div style="font-size: 10px; color: rgba(255,255,255,0.7);">Esta proposta é válida por ${d.validade_dias} dias. Para avançar ou esclarecer dúvidas, entre em contato com o escritório responsável.</div>
      </div>
    `;
  })();

  // Resumo per mode
  let resumoHtml = '';
  const cenarioResumoHtml = temCenarios ? (() => {
    return cenarios.map((cen, ci) => {
      const items = getItensCenario(cen.id);
      const t = computeTotals(items);
      const honTotal = pdfMode === 'direto' ? t.precoDireto : isCliente ? t.precoCliente : t.custoTrevo;
      const honFinal = honTotal * (1 - d.desconto_pct / 100);
      const hasTx = t.taxaMin > 0 || t.taxaMax > 0;
      const precoC = t.precoCliente * (1 - d.desconto_pct / 100);
      const custoT = t.custoTrevo * (1 - d.desconto_pct / 100);
      const precoIdealRes = items.reduce((s, i) => s + ((i.valor_mercado || i.honorario_minimo_contador || i.honorario || 0)) * i.quantidade, 0) * (1 - d.desconto_pct / 100);
      const margemMin = precoC - custoT;
      const margemIdeal = precoIdealRes - custoT;
      const margemMinPct = custoT > 0 ? (((precoC / custoT) - 1) * 100).toFixed(0) : '0';
      const margemIdealPct = custoT > 0 ? (((precoIdealRes / custoT) - 1) * 100).toFixed(0) : '0';
      const temFaixaRes = margemIdeal > margemMin && precoIdealRes > precoC;
      const totalVal = hasTx ? `${fmt(honFinal + t.taxaMin)} a ${fmt(honFinal + t.taxaMax)}` : fmt(honFinal);
      const letter = String.fromCharCode(65 + ci);
      return `
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px 20px; margin-bottom: 12px;">
          <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 10px;">
            <span style="display:inline-flex;align-items:center;justify-content:center;width:24px;height:24px;border-radius:50%;background:#6366f1;color:#fff;font-size:12px;font-weight:800;">${letter}</span>
            <span style="font-size: 13px; font-weight: 700; color: #1a1a2e;">${esc(cen.nome)}</span>
            ${cen.descricao ? `<span style="font-size: 10px; color: #6b7280;">— ${esc(cen.descricao)}</span>` : ''}
          </div>
          ${!isCliente ? `
            <div style="display: flex; justify-content: space-between; font-size: 12px; padding: 4px 0;">
              <span style="color: #64748b;">Custo Trevo</span><span style="font-weight: 600;">${fmt(custoT)}</span>
            </div>
            <div style="display: flex; justify-content: space-between; font-size: 12px; padding: 4px 0; color: #166534;">
              <span>Sugestão cliente</span><span style="font-weight: 700;">${fmt(precoC)}</span>
            </div>
            <div style="display: flex; justify-content: space-between; font-size: 12px; padding: 4px 0; color: #1e40af;">
              <span>Margem</span><span style="font-weight: 700;">${temFaixaRes ? `${fmt(margemMin)} a ${fmt(margemIdeal)} (${margemMinPct}% a ${margemIdealPct}%)` : `${fmt(margemMin)} (${margemMinPct}%)`}</span>
            </div>
          ` : `
            <div style="display: flex; justify-content: space-between; font-size: 12px; padding: 4px 0;">
              <span style="color: #64748b;">Honorários</span><span style="font-weight: 600;">${fmt(honFinal)}</span>
            </div>
          `}
          ${hasTx ? `<div style="display: flex; justify-content: space-between; font-size: 11px; padding: 4px 0; color: #b45309;"><span>Taxas estimadas</span><span>${fmt(t.taxaMin)} a ${fmt(t.taxaMax)}</span></div>` : ''}
          <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; margin-top: 8px; background: ${accentBg}; border: 2px solid ${accentBorder}; border-radius: 10px;">
            <span style="font-size: 11px; font-weight: 700; color: ${accentText}; text-transform: uppercase;">Total Cenário ${letter}</span>
            <span style="font-size: 20px; font-weight: 900; color: ${accentText};">${totalVal}</span>
          </div>
        </div>
      `;
    }).join('');
  })() : '';

  if (!isCliente) {
    const descontoCusto = totalCustoTrevo * (d.desconto_pct / 100);
    const custoFinal = totalCustoTrevo - descontoCusto;
    const descontoPreco = totalPrecoCliente * (d.desconto_pct / 100);
    const precoFinal = totalPrecoCliente - descontoPreco;
    const margemTotal = precoFinal - custoFinal;
    const margemTotalPct = custoFinal > 0 ? (((precoFinal / custoFinal) - 1) * 100).toFixed(0) : '0';

    resumoHtml = temCenarios ? `
      <div style="margin-bottom: 16px;">
        <div style="font-size: 10px; color: #6b7280; margin-bottom: 12px;">O cliente escolhe um dos cenários abaixo:</div>
        ${cenarioResumoHtml}
      </div>
    ` : `
      ${temRecomendacaoPreco ? `
      <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
        <div style="display: flex; justify-content: space-between; font-size: 13px; padding: 6px 0;">
          <span style="color: #64748b;">Seu custo Trevo (honorários)</span>
          <span style="font-weight: 600;">${fmt(totalCustoTrevo)}</span>
        </div>
        <div style="display: flex; justify-content: space-between; font-size: 13px; padding: 6px 0; background: #f0fdf4; margin: 2px -20px; padding-left: 20px; padding-right: 20px;">
          <span style="color: #166534;">Sugestão para seu cliente (honorários)</span>
          <span style="font-weight: 700; color: #166534;">${fmt(totalPrecoCliente)}</span>
        </div>
        ${d.desconto_pct > 0 ? `
          <div style="display: flex; justify-content: space-between; font-size: 13px; padding: 6px 0; color: #dc2626;">
            <span>Desconto (${d.desconto_pct}%)</span>
            <span style="font-weight: 600;">- ${fmt(descontoPreco)} (cliente) / - ${fmt(descontoCusto)} (custo)</span>
          </div>
        ` : ''}
        <div style="display: flex; justify-content: space-between; font-size: 13px; padding: 6px 0; background: #eff6ff; margin: 2px -20px; padding-left: 20px; padding-right: 20px;">
          <span style="color: #1e40af;">Sua margem total</span>
          <span style="font-weight: 700; color: #1e40af;">${fmt(margemTotal)} (${margemTotalPct}%)</span>
        </div>
        ${hasTaxas ? `
          <div style="display: flex; justify-content: space-between; font-size: 13px; padding: 6px 0; border-top: 1px solid #e2e8f0;">
            <span style="color: #64748b;">Taxas externas estimadas</span>
            <span style="color: #b45309; font-weight: 600;">${fmt(totalTaxaMin)} a ${fmt(totalTaxaMax)}</span>
          </div>
        ` : ''}
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 16px 20px; margin-top: 10px; background: #f0fdf4; border: 2px solid #22c55e; border-radius: 12px;">
          <span style="font-size: 12px; font-weight: 700; color: #166534; text-transform: uppercase; letter-spacing: 1px;">Investimento Total do Cliente</span>
          <span style="font-size: ${hasTaxas ? '22' : '28'}px; font-weight: 900; color: #166534;">
            ${hasTaxas ? `${fmt(precoFinal + totalTaxaMin)} a ${fmt(precoFinal + totalTaxaMax)}` : fmt(precoFinal)}
          </span>
        </div>
      </div>
      ` : `
      <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
        <div style="display: flex; justify-content: space-between; font-size: 13px; padding: 6px 0;">
          <span style="color: #64748b;">Custo Trevo (honorários)</span>
          <span style="font-weight: 600;">${fmt(totalCustoTrevo)}</span>
        </div>
        ${d.desconto_pct > 0 ? `
          <div style="display: flex; justify-content: space-between; font-size: 13px; padding: 6px 0; color: #dc2626;">
            <span>Desconto (${d.desconto_pct}%)</span>
            <span style="font-weight: 600;">- ${fmt(descontoCusto)}</span>
          </div>
        ` : ''}
        ${hasTaxas ? `
          <div style="display: flex; justify-content: space-between; font-size: 13px; padding: 6px 0; border-top: 1px solid #e2e8f0;">
            <span style="color: #64748b;">Taxas externas estimadas</span>
            <span style="color: #b45309; font-weight: 600;">${fmt(totalTaxaMin)} a ${fmt(totalTaxaMax)}</span>
          </div>
        ` : ''}
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 16px 20px; margin-top: 10px; background: #f0fdf4; border: 2px solid #22c55e; border-radius: 12px;">
          <span style="font-size: 12px; font-weight: 700; color: #166534; text-transform: uppercase; letter-spacing: 1px;">Total</span>
          <span style="font-size: ${hasTaxas ? '22' : '28'}px; font-weight: 900; color: #166534;">
            ${hasTaxas ? `${fmt(custoFinal + totalTaxaMin)} a ${fmt(custoFinal + totalTaxaMax)}` : fmt(custoFinal)}
          </span>
        </div>
      </div>
      `}
    `;
  } else {
    const totalHonResumo = pdfMode === 'direto' ? totalPrecoDireto : totalPrecoCliente;
    const descontoResumo = totalHonResumo * (d.desconto_pct / 100);
    const honFinalResumo = totalHonResumo - descontoResumo;
    resumoHtml = temCenarios ? `
      <div style="margin-bottom: 16px;">
        <div style="font-size: 10px; color: #6b7280; margin-bottom: 12px;">Escolha o cenário que melhor se adequa à sua necessidade:</div>
        ${cenarioResumoHtml}
      </div>
    ` : `
      <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
        <div style="display: flex; justify-content: space-between; font-size: 13px; padding: 6px 0;">
          <span style="color: #64748b;">Investimento (honorários)</span>
          <span style="font-weight: 600;">${fmt(totalHonResumo)}</span>
        </div>
        ${d.desconto_pct > 0 ? `
          <div style="display: flex; justify-content: space-between; font-size: 13px; padding: 6px 0; color: #dc2626;">
            <span>Desconto (${d.desconto_pct}%)</span>
            <span style="font-weight: 600;">- ${fmt(descontoResumo)}</span>
          </div>
        ` : ''}
        ${hasTaxas ? `
          <div style="display: flex; justify-content: space-between; font-size: 13px; padding: 6px 0; border-top: 1px solid #e2e8f0;">
            <span style="color: #64748b;">Taxas externas estimadas</span>
            <span style="color: #b45309; font-weight: 600;">${fmt(totalTaxaMin)} a ${fmt(totalTaxaMax)}</span>
          </div>
        ` : ''}
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 16px 20px; margin-top: 10px; background: ${accentBg}; border: 2px solid ${accentBorder}; border-radius: 12px;">
          <span style="font-size: 12px; font-weight: 700; color: ${accentText}; text-transform: uppercase; letter-spacing: 1px;">${hasTaxas ? 'Investimento Total' : 'Total'}</span>
          <span style="font-size: ${hasTaxas ? '22' : '28'}px; font-weight: 900; color: ${accentText};">
            ${hasTaxas ? `${fmt(honFinalResumo + totalTaxaMin)} a ${fmt(honFinalResumo + totalTaxaMax)}` : fmt(honFinalResumo)}
          </span>
        </div>
      </div>
    `;
  }

  // Add summary section title + content as blocks
  await addBlock(`
    <div style="font-size: 10px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 16px; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px;">Resumo do Investimento</div>
    ${resumoHtml}
  `);

  // Conditions block
  await addBlock(`
    <div style="font-size: 10px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 12px; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px;">Condições</div>
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 16px;">
      <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px;">
        <div style="font-size: 9px; color: #94a3b8; text-transform: uppercase; letter-spacing: 1px;">Validade</div>
        <div style="font-size: 12px; font-weight: 600; color: #1e293b; margin-top: 4px;">${d.validade_dias} dias</div>
      </div>
      <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px;">
        <div style="font-size: 9px; color: #94a3b8; text-transform: uppercase; letter-spacing: 1px;">Pagamento</div>
        <div style="font-size: 12px; font-weight: 600; color: #1e293b; margin-top: 4px;">${sanitizeRichHtml(d.pagamento || 'A combinar')}</div>
      </div>
    </div>
  `);

  if (prazoHtml) {
    await addBlock(prazoHtml);
  }

  if (d.observacoes) {
    await addBlock(`
      <div style="margin-bottom: 16px;">
        <div style="font-size: 10px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 8px;">Observações</div>
        <div style="background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 12px; font-size: 11px; color: #92400e; line-height: 1.5;">${sanitizeRichHtml(d.observacoes)}</div>
      </div>
    `);
  }

  // Disclaimer
  await addBlock(`
    <div style="font-size: 8px; color: #9ca3af; line-height: 1.6; margin-bottom: 24px; padding: 10px; background: #f8fafc; border-radius: 6px;">
      * Taxas governamentais são estimativas baseadas em tabelas vigentes em 2026 e podem sofrer alterações pelos órgãos competentes. Valores de honorários são fixos e não sofrem reajuste durante a execução do projeto.
    </div>
  `);

  // CTA
  await addBlock(ctaSection);

  // ═══════════════════════════════════════════════════════
  // PAGINATE: pack all contentBlocks into pages by height
  // ═══════════════════════════════════════════════════════
  const FOOTER_HEIGHT = 60;
  const PADDING_VERTICAL = 48; // 24px top + 24px bottom padding
  const MARGEM_SEGURANCA = 30; // Restore safety margin to prevent content bleeding between pages
  const ALTURA_DISPONIVEL = 1123 - HEADER_HEIGHT - FOOTER_HEIGHT - PADDING_VERTICAL - MARGEM_SEGURANCA;

  const pageGroups: number[][] = [[]];
  let alturaAcumulada = 0;

  // Helper: check if a block is a "title-only" block (section header, scenario header)
  // These should never be the last block on a page — always bring at least 1 content block with them
  function isTitleBlock(blockHtml: string): boolean {
    const trimmed = blockHtml.trim();
    // Short blocks that are section titles or scenario headers
    return (
      (trimmed.includes('text-transform: uppercase') && trimmed.includes('letter-spacing: 2px') && trimmed.length < 500) ||
      trimmed.includes('CENÁRIO') && trimmed.includes('border-radius: 8px') && !trimmed.includes('border-left: 4px')
    );
  }

  for (let i = 0; i < contentBlocks.length; i++) {
    const blockH = contentBlocks[i].height;
    // If adding this block exceeds available height AND current page is not empty, start new page
    if (alturaAcumulada + blockH > ALTURA_DISPONIVEL && pageGroups[pageGroups.length - 1].length > 0) {
      // Anti-orphan: if the LAST block on current page is a title, move it to the new page
      const currentPage = pageGroups[pageGroups.length - 1];
      if (currentPage.length > 0) {
        const lastIdx = currentPage[currentPage.length - 1];
        if (isTitleBlock(contentBlocks[lastIdx].html)) {
          currentPage.pop();
          alturaAcumulada = 0;
          pageGroups.push([lastIdx]);
          alturaAcumulada += contentBlocks[lastIdx].height;
        } else {
          pageGroups.push([]);
          alturaAcumulada = 0;
        }
      } else {
        pageGroups.push([]);
        alturaAcumulada = 0;
      }
    }
    pageGroups[pageGroups.length - 1].push(i);
    alturaAcumulada += blockH;
  }

  // Build page HTML from each group
  for (const group of pageGroups) {
    if (group.length === 0) continue; // skip empty pages
    const blocksHtml = group.map(i => contentBlocks[i].html).join('');
    pages.push(`
      <div style="font-family: Arial, Helvetica, sans-serif; width: 794px; min-height: 1123px; background: white; position: relative;">
        ${header}
        <div style="padding: 24px 36px; box-sizing: border-box;">
          ${blocksHtml}
        </div>
        <div style="position: absolute; bottom: 0; left: 0; right: 0;">${footer}</div>
      </div>
    `);
  }

  return pages;
}

// FIX: Fresh DOM container per page + image preload + windowWidth
async function renderPageToCanvas(html: string): Promise<HTMLCanvasElement> {
  // 1. Remove any leftover container
  const old = document.getElementById('orcamento-render-container');
  if (old) old.parentNode?.removeChild(old);

  // 2. Create a brand-new element
  const container = document.createElement('div');
  container.id = 'orcamento-render-container';
  container.style.cssText = 'position:absolute;top:-9999px;left:-9999px;width:794px;overflow:hidden;';
  // Wrap content in a div so firstElementChild is always the renderable element
  container.innerHTML = `<div style="width:794px;"><style>* { -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; text-rendering: optimizeLegibility; } body, div, p, span, td, th, li { font-family: 'Inter', 'Segoe UI', -apple-system, BlinkMacSystemFont, sans-serif; }</style>${html}</div>`;
  document.body.appendChild(container);

  // 3. Wait for ALL images (logo) to fully load
  const images = container.querySelectorAll('img');
  await Promise.all(Array.from(images).map(img =>
    img.complete
      ? Promise.resolve()
      : new Promise<void>(resolve => {
          img.onload = () => resolve();
          img.onerror = () => resolve();
        })
  ));

  // 4. Extra reflow wait
  window.scrollTo(0, 0);
  await new Promise(resolve => setTimeout(resolve, 200));

  // 5. Capture with explicit width to guarantee consistent layout
  const el = container.firstElementChild as HTMLElement;
  const canvas = await html2canvas(el, {
    scale: 1.5,
    useCORS: true,
    allowTaint: false,
    logging: false,
    backgroundColor: '#ffffff',
    width: 794,
    windowWidth: 794,
  });

  // 6. Clean up
  document.body.removeChild(container);
  return canvas;
}

export async function gerarOrcamentoPDF(data: OrcamentoPDFData): Promise<Blob> {
  const logo = await preloadLogo();

  const isDetalhado = data.modo === 'detalhado' ||
    data.itens.some(i => i.taxa_min > 0 || i.taxa_max > 0 || i.prazo || i.docs_necessarios) ||
    !!(data.contexto && data.contexto.trim());

  if (!isDetalhado) {
    const html = buildSimplesHTML(data, logo);
    const canvas = await renderPageToCanvas(html);
    const doc = new jsPDF('p', 'mm', 'a4');
    addCanvasToDoc(doc, canvas);
    return doc.output('blob');
  }

  const pagesHtml = await buildDetalhadoPages(data, logo);
  const doc = new jsPDF('p', 'mm', 'a4');

  for (let i = 0; i < pagesHtml.length; i++) {
    if (i > 0) doc.addPage();
    const canvas = await renderPageToCanvas(pagesHtml[i]);
    addCanvasToDoc(doc, canvas);
  }

  return doc.output('blob');
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function addCanvasToDoc(doc: jsPDF, canvas: HTMLCanvasElement) {
  const pdfW = doc.internal.pageSize.getWidth();
  const pdfH = doc.internal.pageSize.getHeight();
  // Guard against zero-dimension canvas
  if (!canvas.width || !canvas.height) {
    console.warn('Skipping empty canvas page:', canvas.width, canvas.height);
    return;
  }
  const imgData = canvas.toDataURL('image/jpeg', 0.85);
  let imgW = pdfW;
  let imgH = (canvas.height / canvas.width) * pdfW;
  if (imgH > pdfH) {
    const ratio = pdfH / imgH;
    imgW = pdfW * ratio;
    imgH = pdfH;
  }
  const offsetX = (pdfW - imgW) / 2;
  doc.addImage(imgData, 'JPEG', offsetX, 0, imgW, imgH);
}

export { sanitizeFilename };
