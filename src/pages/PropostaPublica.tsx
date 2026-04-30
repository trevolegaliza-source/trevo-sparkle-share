import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { Loader2, CheckCircle, XCircle, Download, FileText, Lock as LockIcon } from 'lucide-react';
import { normalizeItem, type OrcamentoItem, type CenarioOrcamento } from '@/components/orcamentos/types';
import DOMPurify from 'dompurify';

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

const anonHeaders = {
  'apikey': SUPABASE_KEY,
  'Authorization': `Bearer ${SUPABASE_KEY}`,
  'Content-Type': 'application/json',
};

// ─── DESIGN TOKENS ────────────────────────────────────────────────────────────
const fonts = `@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');`;

function buildStyles(accent: string, accentDark: string) {
  return `
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Inter', system-ui, -apple-system, sans-serif; background: #f1f5f9; color: #1e293b; -webkit-font-smoothing: antialiased; }
    .page { min-height: 100vh; background: #f1f5f9; padding-bottom: 110px; }
    .max { max-width: 700px; margin: 0 auto; padding: 0 16px; }

    .header { background: #0f172a; padding: 18px 0; position: sticky; top: 0; z-index: 40; box-shadow: 0 1px 0 rgba(255,255,255,0.06); }
    .header-inner { max-width: 700px; margin: 0 auto; padding: 0 16px; display: flex; align-items: center; justify-content: space-between; }
    .header-logo { display: flex; align-items: center; gap: 10px; }
    .header-logo-mark { width: 30px; height: 30px; background: ${accent}; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 16px; flex-shrink: 0; }
    .header-logo-name { font-size: 14px; font-weight: 700; color: #f8fafc; }
    .header-logo-sub { font-size: 10px; color: #64748b; margin-top: 1px; }
    .header-badge { font-size: 11px; font-weight: 600; color: ${accent}; background: ${accent}18; padding: 4px 10px; border-radius: 20px; letter-spacing: 0.04em; }

    .hero { background: #0f172a; padding: 44px 0 36px; border-bottom: 1px solid #1e293b; }
    .hero-label { font-size: 11px; font-weight: 600; letter-spacing: 0.12em; text-transform: uppercase; color: ${accent}; margin-bottom: 10px; }
    .hero-name { font-size: 34px; font-weight: 900; color: #f8fafc; line-height: 1.1; letter-spacing: -0.02em; margin-bottom: 6px; }
    .hero-cnpj { font-size: 13px; color: #475569; margin-bottom: 28px; }
    .hero-price-box { display: inline-block; background: ${accent}18; border: 1px solid ${accent}44; border-radius: 14px; padding: 20px 28px; }
    .hero-price-label { font-size: 10px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: ${accent}; margin-bottom: 6px; }
    .hero-price { font-size: 38px; font-weight: 900; color: ${accent}; line-height: 1; letter-spacing: -0.02em; }
    .hero-meta { display: flex; gap: 20px; margin-top: 20px; }
    .hero-meta-item { font-size: 12px; color: #475569; display: flex; align-items: center; gap: 5px; }
    .hero-dot { width: 3px; height: 3px; border-radius: 50%; background: ${accent}; }

    .content { padding: 28px 0; display: flex; flex-direction: column; gap: 16px; }

    .card { background: #fff; border-radius: 14px; border: 1px solid #e2e8f0; overflow: hidden; }
    .card-hd { padding: 14px 18px; border-bottom: 1px solid #f1f5f9; display: flex; align-items: center; gap: 10px; }
    .card-hd-icon { width: 26px; height: 26px; border-radius: 7px; background: ${accent}14; display: flex; align-items: center; justify-content: center; font-size: 13px; flex-shrink: 0; }
    .card-title { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.07em; color: #64748b; }
    .card-body { padding: 18px; }

    .card-risk { background: #fff5f5; border-color: #fecaca; }
    .card-risk .card-hd { background: #fff5f5; border-bottom-color: #fecaca; }
    .card-risk .card-title { color: #ef4444; }

    /* ── SERVIÇOS (CONTADOR) ── */
    .svc-table { width: 100%; border-collapse: collapse; }
    .svc-table th { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.07em; color: #94a3b8; padding: 0 0 10px; text-align: left; }
    .svc-table th:last-child, .svc-table td:last-child { text-align: right; }
    .svc-row { border-top: 1px solid #f1f5f9; }
    .svc-row td { padding: 12px 0; vertical-align: top; }
    .svc-check { width: 36px; padding-right: 10px !important; vertical-align: middle !important; }
    .svc-checkbox { width: 18px; height: 18px; accent-color: ${accent}; cursor: pointer; }
    .svc-name { font-size: 14px; font-weight: 600; color: #1e293b; }
    .svc-detail { font-size: 12px; color: #64748b; margin-top: 3px; line-height: 1.5; }
    .svc-badge-obrig { display: inline-flex; align-items: center; gap: 4px; font-size: 10px; font-weight: 600; color: #64748b; background: #f1f5f9; border: 1px solid #e2e8f0; padding: 2px 7px; border-radius: 4px; margin-top: 4px; }
    .svc-badge-opt { font-size: 10px; font-weight: 600; color: #ca8a04; background: #fef9c3; padding: 2px 7px; border-radius: 4px; margin-top: 4px; display: inline-block; }
    .svc-price-trevo { font-size: 13px; font-weight: 600; color: #94a3b8; text-align: right; }
    .svc-price-input { width: 110px; padding: 6px 8px; border: 1px solid #e2e8f0; border-radius: 8px; font-size: 13px; font-weight: 600; color: #1e293b; text-align: right; font-family: inherit; outline: none; transition: border-color 0.15s; }
    .svc-price-input:focus { border-color: ${accent}; box-shadow: 0 0 0 3px ${accent}18; }
    .svc-price-input:disabled { background: #f8fafc; color: #94a3b8; cursor: not-allowed; }
    .col-trevo { min-width: 90px; }
    .col-cobra { min-width: 120px; }

    /* ── SERVIÇOS (CLIENTE FINAL) ── */
    .svc-item { border: 1px solid #e2e8f0; border-radius: 11px; overflow: hidden; }
    .svc-item + .svc-item { margin-top: 10px; }
    .svc-item-hd { display: flex; align-items: center; padding: 12px 14px; background: #f8fafc; gap: 10px; }
    .svc-num { width: 20px; height: 20px; border-radius: 5px; background: ${accent}18; color: ${accent}; font-size: 10px; font-weight: 700; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
    .svc-item-name { font-size: 14px; font-weight: 600; color: #1e293b; flex: 1; }
    .svc-item-price { font-size: 14px; font-weight: 700; color: #1e293b; }
    .svc-item-body { padding: 8px 14px 10px; font-size: 12px; color: #64748b; line-height: 1.6; border-top: 1px solid #f1f5f9; }
    .svc-item-meta { display: flex; justify-content: space-between; padding: 7px 14px; background: #f8fafc; border-top: 1px solid #f1f5f9; font-size: 11px; color: #94a3b8; }

    /* ── TOTALS ── */
    .total-row { display: flex; justify-content: space-between; font-size: 14px; margin-bottom: 8px; }
    .total-row .lbl { color: #64748b; }
    .total-row .val { font-weight: 500; }
    .total-row.red .val { color: #ef4444; }
    .total-row.amber .val { color: #f59e0b; }
    .total-final { display: flex; justify-content: space-between; align-items: center; padding: 16px 18px; margin-top: 10px; border-radius: 11px; background: ${accent}0c; border: 2px solid ${accent}30; }
    .total-final-lbl { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: ${accent}; }
    .total-final-val { font-size: 26px; font-weight: 900; color: ${accentDark}; letter-spacing: -0.02em; }

    /* ── DOWNLOAD BAR ── */
    .dl-bar { display: flex; gap: 8px; padding: 12px 18px; background: #f8fafc; border-top: 1px solid #f1f5f9; }
    .btn-dl { flex: 1; display: flex; align-items: center; justify-content: center; gap: 6px; padding: 9px 14px; border: 1px solid #e2e8f0; border-radius: 9px; background: #fff; color: #475569; font-size: 13px; font-weight: 600; cursor: pointer; transition: all 0.15s; font-family: inherit; }
    .btn-dl:hover { background: #f1f5f9; color: #1e293b; }

    /* ── CONDITIONS ── */
    .cond-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
    .cond-item { background: #f8fafc; border-radius: 9px; padding: 12px; }
    .cond-lbl { font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em; color: #94a3b8; margin-bottom: 5px; }
    .cond-val { font-size: 13px; font-weight: 600; color: #1e293b; }
    .obs-box { margin-top: 10px; background: #fffbeb; border: 1px solid #fde68a; border-radius: 9px; padding: 12px; font-size: 13px; color: #92400e; line-height: 1.6; }

    /* ── FLOW ── */
    .flow-wrap { display: flex; align-items: flex-start; overflow-x: auto; padding-bottom: 4px; gap: 0; }
    .flow-step { display: flex; align-items: flex-start; flex-shrink: 0; }
    .flow-inner { display: flex; flex-direction: column; align-items: center; text-align: center; width: 90px; }
    .flow-circle { width: 34px; height: 34px; border-radius: 50%; background: ${accent}; color: #fff; font-size: 12px; font-weight: 700; display: flex; align-items: center; justify-content: center; }
    .flow-lbl { font-size: 11px; font-weight: 500; color: #374151; margin-top: 7px; line-height: 1.3; }
    .flow-sub { font-size: 10px; color: #94a3b8; margin-top: 3px; }
    .flow-arrow { color: #cbd5e1; margin-top: 16px; padding: 0 4px; font-size: 14px; }

    /* ── BENEFITS ── */
    .ben-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
    .ben-item { padding: 14px 10px; border-radius: 10px; border: 1px solid #e2e8f0; background: #f8fafc; text-align: center; }
    .ben-item.feat { background: ${accent}0c; border-color: ${accent}30; }
    .ben-icon { font-size: 24px; margin-bottom: 8px; }
    .ben-title { font-size: 12px; font-weight: 700; color: #1e293b; margin-bottom: 3px; }
    .ben-desc { font-size: 11px; color: #64748b; line-height: 1.4; }

    /* ── PACKAGES ── */
    .pkg-item { border-radius: 11px; overflow: hidden; border: 1px solid #e2e8f0; }
    .pkg-item + .pkg-item { margin-top: 10px; }
    .pkg-item.feat { border: 2px solid ${accent}; }
    .pkg-hd { padding: 12px 14px; background: #0f172a; display: flex; justify-content: space-between; align-items: center; }
    .pkg-name { font-size: 14px; font-weight: 700; color: #f8fafc; }
    .pkg-disc { font-size: 12px; color: ${accent}; font-weight: 600; background: ${accent}22; padding: 2px 8px; border-radius: 5px; }
    .pkg-badge { font-size: 10px; font-weight: 700; color: #f8fafc; background: rgba(255,255,255,0.15); padding: 2px 7px; border-radius: 4px; }
    .pkg-items { padding: 10px 14px; border-bottom: 1px solid #f1f5f9; }
    .pkg-svc { font-size: 12px; color: #475569; padding: 2px 0; }
    .pkg-svc::before { content: '✓ '; color: ${accent}; font-weight: 700; }
    .pkg-pricing { padding: 10px 14px; background: #f8fafc; }
    .pkg-old { display: flex; justify-content: space-between; font-size: 12px; color: #94a3b8; }
    .pkg-old span:last-child { text-decoration: line-through; }
    .pkg-new { display: flex; justify-content: space-between; font-size: 13px; font-weight: 700; color: ${accent}; margin-top: 2px; }
    .pkg-save { text-align: right; font-size: 11px; color: #16a34a; font-weight: 600; margin-top: 2px; }

    /* ── STICKY CTA ── */
    .sticky-cta { position: fixed; bottom: 0; left: 0; right: 0; z-index: 50; background: #fff; border-top: 1px solid #e2e8f0; padding: 12px 16px; display: flex; gap: 10px; box-shadow: 0 -4px 20px rgba(0,0,0,0.08); }
    .btn-approve { flex: 1; height: 50px; background: linear-gradient(135deg, ${accent} 0%, ${accentDark} 100%); color: #fff; border: none; border-radius: 11px; font-size: 15px; font-weight: 700; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px; box-shadow: 0 4px 14px ${accent}44; font-family: inherit; transition: opacity 0.15s; }
    .btn-approve:hover { opacity: 0.92; }
    .btn-approve:disabled { opacity: 0.6; cursor: not-allowed; }
    .btn-reject { height: 50px; width: 50px; background: #fff; color: #ef4444; border: 1px solid #fecaca; border-radius: 11px; cursor: pointer; display: flex; align-items: center; justify-content: center; font-family: inherit; transition: background 0.15s; }
    .btn-reject:hover { background: #fef2f2; }

    /* ── MODAL ── */
    .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.55); display: flex; align-items: flex-end; justify-content: center; z-index: 60; }
    @media (min-width: 480px) { .modal-overlay { align-items: center; padding: 16px; } }
    .modal { background: #fff; width: 100%; max-width: 440px; border-radius: 18px 18px 0 0; padding: 24px 22px 28px; }
    @media (min-width: 480px) { .modal { border-radius: 18px; } }
    .modal-handle { width: 32px; height: 3px; background: #e2e8f0; border-radius: 2px; margin: 0 auto 18px; }
    .modal-title { font-size: 17px; font-weight: 800; color: #1e293b; margin-bottom: 4px; letter-spacing: -0.01em; }
    .modal-sub { font-size: 13px; color: #64748b; margin-bottom: 18px; }
    .modal-val-box { background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 11px; padding: 14px; text-align: center; margin-bottom: 18px; }
    .modal-val-lbl { font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; color: #16a34a; margin-bottom: 3px; }
    .modal-val { font-size: 26px; font-weight: 900; color: #15803d; letter-spacing: -0.02em; }
    .modal-actions { display: flex; gap: 8px; justify-content: flex-end; }
    .btn-cancel { padding: 9px 16px; border: 1px solid #e2e8f0; border-radius: 9px; background: #fff; color: #374151; font-size: 14px; font-weight: 500; cursor: pointer; font-family: inherit; }
    .btn-confirm { padding: 9px 18px; border: none; border-radius: 9px; background: #16a34a; color: #fff; font-size: 14px; font-weight: 700; cursor: pointer; display: flex; align-items: center; gap: 7px; font-family: inherit; }
    .btn-confirm.red { background: #dc2626; }
    .btn-confirm:disabled { opacity: 0.6; cursor: not-allowed; }
    .textarea-field { width: 100%; padding: 9px 11px; border: 1px solid #e2e8f0; border-radius: 9px; font-size: 14px; resize: vertical; outline: none; color: #1e293b; font-family: inherit; line-height: 1.5; margin-bottom: 14px; }
    .textarea-field:focus { border-color: ${accent}; }
    .form-lbl { font-size: 13px; font-weight: 600; color: #374151; margin-bottom: 5px; display: block; }

    /* ── STATUS / PW PAGES ── */
    .center-page { min-height: 100vh; display: flex; align-items: center; justify-content: center; background: #f1f5f9; padding: 16px; }
    .center-card { background: #fff; border-radius: 18px; padding: 36px 28px; max-width: 400px; width: 100%; text-align: center; border: 1px solid #e2e8f0; box-shadow: 0 4px 20px rgba(0,0,0,0.06); }
    .center-title { font-size: 20px; font-weight: 800; letter-spacing: -0.01em; margin: 16px 0 8px; }
    .center-desc { font-size: 14px; color: #64748b; line-height: 1.6; }
    .pw-input { width: 100%; padding: 11px 13px; border: 1px solid #e2e8f0; border-radius: 9px; font-size: 15px; outline: none; color: #1e293b; margin-bottom: 8px; font-family: inherit; }
    .pw-input:focus { border-color: ${accent}; }
    .pw-err { font-size: 12px; color: #ef4444; margin-bottom: 8px; }
    .btn-pw { width: 100%; padding: 12px; background: ${accent}; color: #fff; border: none; border-radius: 9px; font-size: 15px; font-weight: 700; cursor: pointer; font-family: inherit; }
    .btn-review { margin-top: 16px; padding: 9px 18px; border: 1px solid #e2e8f0; border-radius: 9px; background: #fff; color: #374151; font-size: 14px; cursor: pointer; font-family: inherit; }

    .footer { text-align: center; padding: 28px 18px 20px; border-top: 1px solid #e2e8f0; }
    .footer-name { font-size: 13px; font-weight: 700; color: #374151; margin-bottom: 5px; }
    .footer-info { font-size: 11px; color: #94a3b8; line-height: 1.8; }

    .alert-rascunho { background: #fffbeb; border: 1px solid #fde68a; border-radius: 11px; padding: 14px 18px; text-align: center; font-size: 14px; color: #92400e; font-weight: 500; }

    /* ── HINT BOX (contador) ── */
    .hint-box { background: ${accent}08; border: 1px solid ${accent}22; border-radius: 11px; padding: 12px 16px; font-size: 12px; color: #374151; line-height: 1.6; margin-bottom: 4px; }
    .hint-box strong { font-weight: 700; color: ${accentDark}; }

    @media (max-width: 480px) {
      .hero-name { font-size: 24px; }
      .hero-price { font-size: 28px; }
      .ben-grid { grid-template-columns: 1fr 1fr; }
      .cond-grid { grid-template-columns: 1fr; }
      .total-final-val { font-size: 22px; }
      .col-trevo { display: none; }
    }
  `;
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────

function fmtInput(v: number): string {
  if (!v) return '';
  return v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function parseInput(s: string): number {
  const cleaned = s.replace(/[^\d,]/g, '').replace(',', '.');
  return parseFloat(cleaned) || 0;
}

// ─── COMPONENT ────────────────────────────────────────────────────────────────

export default function PropostaPublica() {
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [orc, setOrc] = useState<any>(null);
  const [itens, setItens] = useState<OrcamentoItem[]>([]);

  // Auth
  const [senhaRequerida, setSenhaRequerida] = useState(false);
  const [senhaInput, setSenhaInput] = useState('');
  const [senhaErro, setSenhaErro] = useState(false);
  const [autenticado, setAutenticado] = useState(false);

  // Seleção de itens (ambos os fluxos)
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());

  // Valores que o contador vai cobrar do cliente (apenas fluxo contador)
  const [valoresContador, setValoresContador] = useState<Record<string, number>>({});

  // Aprovação / recusa
  const [showAprovacao, setShowAprovacao] = useState(false);
  const [showRecusa, setShowRecusa] = useState(false);
  const [motivoRecusa, setMotivoRecusa] = useState('');
  const [processando, setProcessando] = useState(false);
  const [statusFinal, setStatusFinal] = useState<'aprovado' | 'recusado' | null>(null);

  // Save silencioso (debounce)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Force light theme
  useEffect(() => {
    document.documentElement.classList.remove('dark');
    document.documentElement.classList.add('light');
    return () => {
      document.documentElement.classList.remove('light');
      document.documentElement.classList.add('dark');
    };
  }, []);

  // Carrega proposta
  useEffect(() => {
    if (!token) { setError('Link inválido'); setLoading(false); return; }
    (async () => {
      try {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_proposta_por_token`, {
          method: 'POST', headers: anonHeaders, body: JSON.stringify({ p_token: token }),
        });
        if (!res.ok) { setError('Erro ao carregar proposta.'); setLoading(false); return; }
        const results = await res.json();
        if (!results?.length) { setError('Proposta não encontrada ou link expirado.'); setLoading(false); return; }

        const orcData = results[0];

        // Validade
        if (orcData.validade_dias && orcData.created_at) {
          const expira = new Date(new Date(orcData.created_at).getTime() + orcData.validade_dias * 86400000);
          if (new Date() > expira) { setError('Esta proposta expirou. Entre em contato para solicitar uma nova.'); setLoading(false); return; }
        }

        if (['aguardando_pagamento', 'convertido'].includes(orcData.status)) setStatusFinal('aprovado');
        else if (orcData.status === 'recusado') setStatusFinal('recusado');

        if (orcData.destinatario === 'contador' && orcData.has_password) setSenhaRequerida(true);
        else setAutenticado(true);

        const rawItens: OrcamentoItem[] = Array.isArray(orcData.servicos) ? orcData.servicos.map(normalizeItem) : [];
        setItens(rawItens);
        setOrc(orcData);

        // Inicializa selecionados: todos marcados por padrão
        // Se houver itens_selecionados salvos, usa eles
        if (Array.isArray(orcData.itens_selecionados) && orcData.itens_selecionados.length > 0) {
          const ids = new Set<string>(orcData.itens_selecionados.map((i: any) => i.id));
          setSelecionados(ids);
          // Inicializa valores do contador a partir do save anterior
          const vals: Record<string, number> = {};
          orcData.itens_selecionados.forEach((i: any) => {
            if (i.valor_contador != null) vals[i.id] = i.valor_contador;
          });
          setValoresContador(vals);
        } else {
          // Seleciona todos por padrão
          setSelecionados(new Set(rawItens.map(i => i.id)));
          // Inicializa valores sugeridos do contador
          const vals: Record<string, number> = {};
          rawItens.forEach(i => { vals[i.id] = i.honorario_minimo_contador || i.honorario; });
          setValoresContador(vals);
        }

        // Log view (fire-and-forget)
        fetch(`${SUPABASE_URL}/rest/v1/rpc/criar_evento_proposta`, {
          method: 'POST', headers: anonHeaders,
          body: JSON.stringify({ p_orcamento_id: orcData.id, p_tipo: 'visualizou', p_dados: { token } }),
        }).catch(() => {});

        setLoading(false);
      } catch { setError('Erro ao carregar proposta.'); setLoading(false); }
    })();
  }, [token]);

  // ── Salva seleção silenciosamente (debounce 1.5s)
  const salvarSelecaoSilencioso = useCallback((sel: Set<string>, vals: Record<string, number>, allItens: OrcamentoItem[]) => {
    if (!token) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      const payload = allItens
        .filter(i => sel.has(i.id))
        .map(i => ({ id: i.id, descricao: i.descricao, valor_contador: vals[i.id] ?? i.honorario_minimo_contador ?? i.honorario }));
      await fetch(`${SUPABASE_URL}/rest/v1/rpc/salvar_selecao_proposta`, {
        method: 'POST', headers: anonHeaders,
        body: JSON.stringify({ p_token: token, p_itens_selecionados: payload }),
      }).catch(() => {});
    }, 1500);
  }, [token]);

  // ── Toggle item selecionado
  function toggleItem(id: string, isObrigatorio: boolean) {
    if (isObrigatorio) return; // obrigatórios nunca podem ser desmarcados
    setSelecionados(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      salvarSelecaoSilencioso(next, valoresContador, itens);
      return next;
    });
  }

  // ── Atualiza valor que o contador vai cobrar
  function atualizarValorContador(id: string, valor: number) {
    setValoresContador(prev => {
      const next = { ...prev, [id]: valor };
      salvarSelecaoSilencioso(selecionados, next, itens);
      return next;
    });
  }

  async function verificarSenha() {
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/verificar_senha_proposta`, {
        method: 'POST', headers: anonHeaders, body: JSON.stringify({ p_token: token, p_senha: senhaInput }),
      });
      const result = await res.json();
      if (result === true) { setAutenticado(true); setSenhaErro(false); } else setSenhaErro(true);
    } catch { setSenhaErro(true); }
  }

  // ── Derivados
  const modoPDF = orc?.destinatario === 'cliente_direto' ? 'direto' : orc?.destinatario === 'cliente_via_contador' ? 'cliente' : 'contador';
  const isContador = modoPDF === 'contador';
  const isClienteFinal = orc?.destinatario === 'cliente_direto';
  const accent = isContador ? '#22c55e' : '#3b82f6';
  const accentDark = isContador ? '#16a34a' : '#2563eb';
  const escritorioNome = orc?.escritorio_nome || '';
  const nomeDisplay = isContador ? 'Trevo Legaliza' : (escritorioNome || 'Trevo Legaliza');
  const cenarios: CenarioOrcamento[] = Array.isArray(orc?.cenarios) ? orc.cenarios : [];

  const itensFiltrados = useMemo(() => itens.filter(i => i.descricao.trim()), [itens]);

  // Total considerando apenas itens selecionados
  const { subtotalSel, totalTaxaMinSel, totalTaxaMaxSel, descontoSel, totalSel } = useMemo(() => {
    const sel = itensFiltrados.filter(i => selecionados.has(i.id));
    const sub = isClienteFinal
      ? sel.reduce((s, i) => s + (i.valorVendaDireto ?? i.honorario_minimo_contador ?? i.honorario) * i.quantidade, 0)
      : sel.reduce((s, i) => s + (i.honorario || 0) * i.quantidade, 0);
    const tMin = sel.reduce((s, i) => s + i.taxa_min, 0);
    const tMax = sel.reduce((s, i) => s + i.taxa_max, 0);
    const desc = sub * ((orc?.desconto_pct || 0) / 100);
    return { subtotalSel: sub, totalTaxaMinSel: tMin, totalTaxaMaxSel: tMax, descontoSel: desc, totalSel: sub - desc };
  }, [itensFiltrados, selecionados, orc, isClienteFinal]);

  // Total que o contador vai cobrar do cliente (só para o fluxo contador)
  const totalContador = useMemo(() => {
    return itensFiltrados
      .filter(i => selecionados.has(i.id))
      .reduce((s, i) => s + (valoresContador[i.id] ?? i.honorario_minimo_contador ?? i.honorario) * i.quantidade, 0);
  }, [itensFiltrados, selecionados, valoresContador]);

  const totalStr = (totalTaxaMinSel > 0 || totalTaxaMaxSel > 0)
    ? `${fmt(totalSel + totalTaxaMinSel)} a ${fmt(totalSel + totalTaxaMaxSel)}`
    : fmt(totalSel);

  // ── Aprovação
  async function handleAprovar() {
    setProcessando(true);
    try {
      await fetch(`${SUPABASE_URL}/rest/v1/rpc/atualizar_proposta_por_token`, {
        method: 'POST', headers: anonHeaders,
        body: JSON.stringify({ p_token: token, p_status: 'aprovado' }),
      });
      await fetch(`${SUPABASE_URL}/rest/v1/rpc/criar_notificacao_proposta`, {
        method: 'POST', headers: anonHeaders,
        body: JSON.stringify({
          p_orcamento_id: orc.id, p_tipo: 'aprovacao',
          p_mensagem: `${orc.prospect_nome} aprovou a proposta #${String(orc.numero).padStart(3, '0')} no valor de ${fmt(totalSel)}. Aguardando pagamento.`,
        }),
      });
      fetch(`${SUPABASE_URL}/rest/v1/rpc/criar_evento_proposta`, {
        method: 'POST', headers: anonHeaders,
        body: JSON.stringify({ p_orcamento_id: orc.id, p_tipo: 'aprovou', p_dados: { total: totalSel, itens_count: selecionados.size } }),
      }).catch(() => {});
      setStatusFinal('aprovado');
      setShowAprovacao(false);
    } catch (err) { console.error(err); } finally { setProcessando(false); }
  }

  async function handleRecusar() {
    if (!motivoRecusa.trim()) return;
    setProcessando(true);
    try {
      await fetch(`${SUPABASE_URL}/rest/v1/rpc/atualizar_proposta_por_token`, {
        method: 'POST', headers: anonHeaders,
        body: JSON.stringify({ p_token: token, p_status: 'recusado', p_motivo: motivoRecusa }),
      });
      await fetch(`${SUPABASE_URL}/rest/v1/rpc/criar_notificacao_proposta`, {
        method: 'POST', headers: anonHeaders,
        body: JSON.stringify({
          p_orcamento_id: orc.id, p_tipo: 'recusa',
          p_mensagem: `${orc.prospect_nome} recusou a proposta #${String(orc.numero).padStart(3, '0')}. Motivo: ${motivoRecusa}`,
        }),
      });
      fetch(`${SUPABASE_URL}/rest/v1/rpc/criar_evento_proposta`, {
        method: 'POST', headers: anonHeaders,
        body: JSON.stringify({ p_orcamento_id: orc.id, p_tipo: 'recusou', p_dados: { motivo: motivoRecusa } }),
      }).catch(() => {});
      setStatusFinal('recusado');
      setShowRecusa(false);
    } catch (err) { console.error(err); } finally { setProcessando(false); }
  }

  // ── Download HTML (proposta para o cliente final — white-label)
  function handleDownloadHTML() {
    if (!orc) return;
    const num = String(orc.numero).padStart(3, '0');
    const data = new Date(orc.created_at).toLocaleDateString('pt-BR');
    const nomeEscritorio = escritorioNome || 'Escritório Contábil';
    const itensSel = itensFiltrados.filter(i => selecionados.has(i.id));

    const itensHtml = itensSel.map((item, idx) => {
      const valorExibido = valoresContador[item.id] ?? item.honorario_minimo_contador ?? item.honorario;
      const valorTotal = valorExibido * item.quantidade;
      const hasTaxa = item.taxa_min > 0 || item.taxa_max > 0;
      return `
        <div style="border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;margin-bottom:10px;">
          <div style="display:flex;justify-content:space-between;align-items:center;padding:12px 14px;background:#f8fafc;">
            <div style="display:flex;align-items:center;gap:8px;">
              <span style="width:20px;height:20px;border-radius:5px;background:#3b82f618;color:#3b82f6;font-size:10px;font-weight:700;display:inline-flex;align-items:center;justify-content:center;">${idx + 1}</span>
              <span style="font-size:14px;font-weight:600;color:#1e293b;">${item.descricao}</span>
              ${item.isOptional ? '<span style="font-size:11px;font-weight:600;padding:2px 7px;border-radius:5px;background:#fef9c3;color:#ca8a04;margin-left:6px;">Opcional</span>' : ''}
            </div>
            <span style="font-size:14px;font-weight:700;color:#1e293b;">${fmt(valorTotal)}</span>
          </div>
          ${item.detalhes ? `<div style="padding:8px 14px;font-size:12px;color:#475569;border-top:1px solid #f1f5f9;">${DOMPurify.sanitize(item.detalhes)}</div>` : ''}
          ${(item.prazo || hasTaxa) ? `<div style="padding:8px 14px;background:#f8fafc;border-top:1px solid #f1f5f9;font-size:12px;color:#94a3b8;display:flex;justify-content:space-between;">${item.prazo ? `<span>Prazo: ${item.prazo}</span>` : ''}${hasTaxa ? `<span style="color:#f59e0b;">Taxas: ${fmt(item.taxa_min)} a ${fmt(item.taxa_max)}</span>` : ''}</div>` : ''}
        </div>`;
    }).join('');

    const totalClienteStr = fmt(totalContador);

    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Proposta — ${orc.prospect_nome}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f1f5f9; color: #1e293b; }
  .page { max-width: 680px; margin: 40px auto; background: #fff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 40px rgba(0,0,0,0.10); }
  .header { background: #0f172a; padding: 22px 30px; display: flex; justify-content: space-between; align-items: center; }
  .header-name { font-size: 16px; font-weight: 700; color: #f8fafc; }
  .header-sub { font-size: 11px; color: #64748b; margin-top: 2px; }
  .hero { background: #0f172a; padding: 36px 30px; border-bottom: 1px solid #1e293b; }
  .hero-lbl { font-size: 10px; font-weight: 600; letter-spacing: 0.12em; text-transform: uppercase; color: #3b82f6; margin-bottom: 8px; }
  .hero-name { font-size: 30px; font-weight: 900; color: #f8fafc; letter-spacing: -0.02em; margin-bottom: 6px; }
  .hero-cnpj { font-size: 13px; color: #475569; margin-bottom: 24px; }
  .hero-box { display: inline-block; background: #3b82f618; border: 1px solid #3b82f644; border-radius: 12px; padding: 18px 24px; }
  .hero-box-lbl { font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em; color: #3b82f6; margin-bottom: 4px; }
  .hero-box-val { font-size: 32px; font-weight: 900; color: #3b82f6; letter-spacing: -0.02em; }
  .hero-meta { margin-top: 16px; font-size: 12px; color: #475569; display: flex; gap: 20px; }
  .section { padding: 24px 30px; border-top: 1px solid #f1f5f9; }
  .section-title { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #94a3b8; margin-bottom: 14px; }
  .total-final { display: flex; justify-content: space-between; align-items: center; padding: 14px 18px; border-radius: 11px; background: #3b82f60c; border: 2px solid #3b82f630; margin-top: 10px; }
  .total-final-lbl { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: #3b82f6; }
  .total-final-val { font-size: 24px; font-weight: 900; color: #2563eb; letter-spacing: -0.02em; }
  .footer { padding: 24px 30px; border-top: 1px solid #f1f5f9; text-align: center; font-size: 11px; color: #94a3b8; line-height: 1.8; }
  .footer-name { font-size: 13px; font-weight: 700; color: #374151; margin-bottom: 5px; }
  @media print { body { background: white; } .page { box-shadow: none; margin: 0; border-radius: 0; } }
</style>
</head>
<body>
<div class="page">
  <div class="header">
    <div>
      <div class="header-name">${nomeEscritorio}</div>
      <div class="header-sub">Assessoria Empresarial</div>
    </div>
    <div style="font-size:11px;font-weight:600;color:#3b82f6;background:#3b82f618;padding:4px 10px;border-radius:20px;">${data}</div>
  </div>
  <div class="hero">
    <div class="hero-lbl">Proposta Comercial</div>
    <div class="hero-name">${orc.prospect_nome}</div>
    ${orc.prospect_cnpj && orc.prospect_cnpj !== '0000000000' && orc.prospect_cnpj !== '00000000000000' ? `<div class="hero-cnpj">CNPJ: ${orc.prospect_cnpj}</div>` : ''}
    <div class="hero-box">
      <div class="hero-box-lbl">Investimento</div>
      <div class="hero-box-val">${totalClienteStr}</div>
    </div>
    <div class="hero-meta">
      <span>📋 ${itensSel.length} serviços</span>
      <span>⏱️ Válido por ${orc.validade_dias} dias</span>
    </div>
  </div>
  ${orc.contexto ? `<div class="section"><div class="section-title">Contexto</div><div style="font-size:14px;line-height:1.6;color:#374151;">${DOMPurify.sanitize(orc.contexto)}</div></div>` : ''}
  <div class="section">
    <div class="section-title">Serviços Incluídos</div>
    ${itensHtml}
  </div>
  <div class="section">
    <div class="section-title">Investimento</div>
    <div class="total-final">
      <span class="total-final-lbl">Total</span>
      <span class="total-final-val">${totalClienteStr}</span>
    </div>
  </div>
  <div class="section">
    <div class="section-title">Condições</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
      <div style="background:#f8fafc;border-radius:9px;padding:12px;"><div style="font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:0.08em;color:#94a3b8;margin-bottom:5px;">Validade</div><div style="font-size:13px;font-weight:600;">${orc.validade_dias} dias</div></div>
      <div style="background:#f8fafc;border-radius:9px;padding:12px;"><div style="font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:0.08em;color:#94a3b8;margin-bottom:5px;">Pagamento</div><div style="font-size:13px;font-weight:600;">${orc.pagamento || 'A combinar'}</div></div>
    </div>
    ${orc.observacoes ? `<div style="margin-top:10px;background:#fffbeb;border:1px solid #fde68a;border-radius:9px;padding:12px;font-size:13px;color:#92400e;line-height:1.6;">${DOMPurify.sanitize(orc.observacoes)}</div>` : ''}
  </div>
  <div class="footer">
    <div class="footer-name">${nomeEscritorio}</div>
    ${orc.escritorio_cnpj ? `<div>CNPJ: ${orc.escritorio_cnpj}</div>` : ''}
    ${orc.escritorio_email ? `<div>${orc.escritorio_email}</div>` : ''}
    ${orc.escritorio_telefone ? `<div>${orc.escritorio_telefone}</div>` : ''}
  </div>
</div>
</body>
</html>`;

    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const nome = (orc.prospect_nome || 'proposta').replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_').substring(0, 40);
    a.href = url;
    a.download = `Proposta_${nome}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  async function handleDownloadPDF() {
    if (!orc) return;
    try {
      const { gerarOrcamentoPDF, downloadBlob } = await import('@/lib/orcamento-pdf');
      const { normalizeItem: ni, DEFAULT_SECOES } = await import('@/components/orcamentos/types');
      const itensSel = itensFiltrados.filter(i => selecionados.has(i.id)).map(ni);
      const sub = itensSel.reduce((s: number, i: any) => s + (Number(i.honorario) || 0) * (Number(i.quantidade) || 1), 0);
      const desc2 = sub * ((orc.desconto_pct || 0) / 100);
      const hasDetailed = itensSel.some((i: any) => i.taxa_min > 0 || i.taxa_max > 0 || i.prazo || i.docs_necessarios);
      const doc = await gerarOrcamentoPDF({
        modo: hasDetailed || orc.contexto ? 'detalhado' : 'simples',
        modoPDF: modoPDF as any,
        destinatario: orc.destinatario,
        escritorioNome, escritorioCnpj: orc.escritorio_cnpj || '',
        escritorioEmail: orc.escritorio_email || '', escritorioTelefone: orc.escritorio_telefone || '',
        clienteNome: escritorioNome, contadorNome: escritorioNome,
        contadorEmail: orc.escritorio_email || '', contadorTelefone: orc.escritorio_telefone || '',
        prospect_nome: orc.prospect_nome, prospect_cnpj: orc.prospect_cnpj,
        itens: itensSel, pacotes: Array.isArray(orc.pacotes) ? orc.pacotes : [],
        secoes: Array.isArray(orc.secoes) && orc.secoes.length > 0 ? orc.secoes : [...DEFAULT_SECOES],
        contexto: orc.contexto || '', ordem_execucao: orc.ordem_execucao || '',
        desconto_pct: orc.desconto_pct || 0, subtotal: sub, total: sub - desc2,
        validade_dias: orc.validade_dias, prazo_execucao: orc.prazo_execucao || '',
        pagamento: orc.pagamento, observacoes: orc.observacoes, numero: orc.numero,
        data_emissao: new Date(orc.created_at).toLocaleDateString('pt-BR'),
        riscos: Array.isArray(orc.riscos) ? orc.riscos : [],
        etapas_fluxo: Array.isArray(orc.etapas_fluxo) ? orc.etapas_fluxo : [],
        beneficios_capa: Array.isArray(orc.beneficios_capa) ? orc.beneficios_capa : [],
        headline_cenario: orc.headline_cenario || '', cenarios: Array.isArray(orc.cenarios) ? orc.cenarios : [],
      });
      const nome = (orc.prospect_nome || 'proposta').replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_').substring(0, 40);
      downloadBlob(doc, `Proposta_${nome}_${String(orc.numero).padStart(3, '0')}.pdf`);
    } catch (err: any) { console.error('Erro ao gerar PDF:', err); }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // RENDERS DE ESTADO
  // ─────────────────────────────────────────────────────────────────────────────

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f1f5f9' }}>
      <Loader2 style={{ height: 28, width: 28, color: '#94a3b8' }} className="animate-spin" />
    </div>
  );

  if (error) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f1f5f9', padding: 16 }}>
      <div style={{ background: '#fff', borderRadius: 18, padding: '36px 28px', maxWidth: 400, width: '100%', textAlign: 'center', border: '1px solid #e2e8f0' }}>
        <XCircle style={{ height: 44, width: 44, color: '#ef4444', margin: '0 auto 14px' }} />
        <h2 style={{ fontSize: 18, fontWeight: 800, color: '#1e293b', marginBottom: 6 }}>Proposta Indisponível</h2>
        <p style={{ fontSize: 14, color: '#64748b', lineHeight: 1.6 }}>{error}</p>
      </div>
    </div>
  );

  if (senhaRequerida && !autenticado) return (
    <>
      <style>{fonts}</style>
      <style>{buildStyles('#22c55e', '#16a34a')}</style>
      <div className="center-page">
        <div className="center-card">
          <div style={{ width: 48, height: 48, background: '#f1f5f9', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto' }}>
            <LockIcon style={{ height: 22, width: 22, color: '#64748b' }} />
          </div>
          <div className="center-title">Acesso Protegido</div>
          <div className="center-desc" style={{ marginBottom: 20 }}>Insira a senha para visualizar esta proposta.</div>
          <input type="password" placeholder="Senha" value={senhaInput}
            onChange={e => { setSenhaInput(e.target.value); setSenhaErro(false); }}
            onKeyDown={e => e.key === 'Enter' && verificarSenha()}
            className="pw-input" />
          {senhaErro && <div className="pw-err">Senha incorreta. Tente novamente.</div>}
          <button onClick={verificarSenha} className="btn-pw">Acessar Proposta</button>
        </div>
      </div>
    </>
  );

  if (statusFinal) return (
    <>
      <style>{fonts}</style>
      <style>{buildStyles(accent, accentDark)}</style>
      <div className="center-page">
        <div className="center-card">
          {statusFinal === 'aprovado' ? (
            <>
              <CheckCircle style={{ height: 52, width: 52, color: '#22c55e', margin: '0 auto' }} />
              <div className="center-title" style={{ color: '#15803d' }}>Proposta Aprovada!</div>
              <div className="center-desc">Obrigado! Nossa equipe entrará em contato para os próximos passos.</div>
            </>
          ) : (
            <>
              <XCircle style={{ height: 52, width: 52, color: '#ef4444', margin: '0 auto' }} />
              <div className="center-title" style={{ color: '#dc2626' }}>Proposta Recusada</div>
              <div className="center-desc">Recebemos sua resposta. Caso mude de ideia, este link ainda estará disponível.</div>
              {orc?.status === 'recusado' && (
                <button className="btn-review" onClick={() => setStatusFinal(null)}>Revisar proposta novamente</button>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // PROPOSTA PRINCIPAL
  // ─────────────────────────────────────────────────────────────────────────────

  const riscos = Array.isArray(orc?.riscos) ? orc.riscos : [];
  const etapasFluxo = Array.isArray(orc?.etapas_fluxo) ? orc.etapas_fluxo : [];
  const beneficios = Array.isArray(orc?.beneficios_capa) ? orc.beneficios_capa : [];
  const pacotes = Array.isArray(orc?.pacotes) ? orc.pacotes.filter((p: any) => p.nome && p.itens_ids?.length > 0) : [];

  return (
    <>
      <style>{fonts}</style>
      <style>{buildStyles(accent, accentDark)}</style>

      <div className="page" data-theme="light">

        {/* HEADER */}
        <div className="header">
          <div className="header-inner">
            <div className="header-logo">
              <div className="header-logo-mark">🍀</div>
              <div>
                <div className="header-logo-name">{nomeDisplay}</div>
                <div className="header-logo-sub">{isContador ? 'Painel do Parceiro' : 'Assessoria Empresarial'}</div>
              </div>
            </div>
            <div className="header-badge">Proposta #{String(orc?.numero || 0).padStart(3, '0')}</div>
          </div>
        </div>

        {/* HERO */}
        <div className="hero">
          <div className="max">
            <div className="hero-label">
              {isContador ? 'Proposta para o Parceiro · ' : 'Proposta Comercial · '}
              {orc?.created_at ? new Date(orc.created_at).toLocaleDateString('pt-BR') : ''}
            </div>
            <div className="hero-name">{orc?.prospect_nome}</div>
            {orc?.prospect_cnpj && orc.prospect_cnpj !== '0000000000' && orc.prospect_cnpj !== '00000000000000' && (
              <div className="hero-cnpj">CNPJ: {orc.prospect_cnpj}</div>
            )}
            <div className="hero-price-box">
              <div className="hero-price-label">
                {isContador ? 'Custo Trevo (seus honorários)' : 'Investimento Estimado'}
              </div>
              <div className="hero-price">{totalStr}</div>
            </div>
            {isContador && (
              <div style={{ marginTop: 12, fontSize: 12, color: '#4ade80', fontWeight: 500 }}>
                💰 Você cobra do cliente: <strong style={{ fontSize: 14 }}>{fmt(totalContador)}</strong>
              </div>
            )}
            <div className="hero-meta">
              <span className="hero-meta-item"><span className="hero-dot" />📋 {itensFiltrados.length} serviços</span>
              <span className="hero-meta-item"><span className="hero-dot" />⏱️ Válido por {orc?.validade_dias} dias</span>
              {isContador && selecionados.size < itensFiltrados.length && (
                <span className="hero-meta-item"><span className="hero-dot" />✅ {selecionados.size} selecionados</span>
              )}
            </div>
          </div>
        </div>

        <div className="max">
          <div className="content">

            {/* ── HINT (contador) */}
            {isContador && (
              <div className="hint-box">
                <strong>Como usar:</strong> Selecione os serviços que quer fechar com o cliente, ajuste os valores que você vai cobrar (coluna "Você cobra"), depois clique em <strong>Gerar PDF pro cliente</strong>. Quando o cliente aprovar, volte aqui e clique em <strong>Aprovar Proposta</strong>.
              </div>
            )}

            {/* CONTEXTO */}
            {orc?.contexto && (
              <div className="card">
                <div className="card-hd"><div className="card-hd-icon">💡</div><div className="card-title">Cenário e Oportunidade</div></div>
                <div className="card-body">
                  {orc.headline_cenario && <p style={{ fontSize: 15, fontWeight: 600, color: '#1e293b', marginBottom: 10 }}>{orc.headline_cenario}</p>}
                  <div style={{ fontSize: 14, lineHeight: 1.7, color: '#374151' }} dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(orc.contexto || '') }} />
                </div>
              </div>
            )}

            {/* RISCOS */}
            {riscos.length > 0 && (
              <div className="card card-risk">
                <div className="card-hd"><div className="card-hd-icon">⛔</div><div className="card-title">Riscos Sem Regularização</div></div>
                <div className="card-body">
                  <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {riscos.map((r: any) => (
                      <li key={r.id} style={{ fontSize: 14, color: '#b91c1c', paddingLeft: 14, position: 'relative' }}>
                        <span style={{ position: 'absolute', left: 0 }}>•</span>
                        {r.penalidade}{r.condicao ? `: ${r.condicao}` : ''}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            {/* BENEFÍCIOS */}
            {beneficios.length > 0 && (
              <div className="card">
                <div className="card-body" style={{ padding: 14 }}>
                  <div className="ben-grid">
                    {beneficios.map((ben: any, idx: number) => (
                      <div key={ben.id} className={`ben-item${idx === 1 ? ' feat' : ''}`}>
                        <div className="ben-icon">{['🛡️', '📋', '⏱️'][idx % 3]}</div>
                        <div className="ben-title">{ben.titulo}</div>
                        <div className="ben-desc">{ben.descricao}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* FLUXO */}
            {etapasFluxo.length > 0 && (
              <div className="card">
                <div className="card-hd"><div className="card-hd-icon">🔄</div><div className="card-title">Fluxo de Execução</div></div>
                <div className="card-body">
                  <div className="flow-wrap">
                    {etapasFluxo.map((e: any, i: number) => (
                      <div key={e.id} className="flow-step">
                        <div className="flow-inner">
                          <div className="flow-circle">{i === etapasFluxo.length - 1 ? '✓' : i + 1}</div>
                          <div className="flow-lbl">{e.nome}</div>
                          {e.prazo && <div className="flow-sub">{e.prazo}</div>}
                        </div>
                        {i < etapasFluxo.length - 1 && <div className="flow-arrow">→</div>}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ── SERVIÇOS — FLUXO CONTADOR */}
            {isContador && (
              <div className="card">
                <div className="card-hd"><div className="card-hd-icon">📋</div><div className="card-title">Selecione os Serviços</div></div>
                <div className="card-body" style={{ overflowX: 'auto' }}>
                  <table className="svc-table">
                    <thead>
                      <tr>
                        <th className="svc-check"></th>
                        <th>Serviço</th>
                        <th className="col-trevo" style={{ textAlign: 'right' }}>Custo Trevo</th>
                        <th className="col-cobra" style={{ textAlign: 'right' }}>Você cobra</th>
                      </tr>
                    </thead>
                    <tbody>
                      {itensFiltrados.map(item => {
                        const isObrig = !item.isOptional;
                        const checked = selecionados.has(item.id);
                        const valorCobra = valoresContador[item.id] ?? item.honorario_minimo_contador ?? item.honorario;
                        return (
                          <tr key={item.id} className="svc-row" style={{ opacity: checked ? 1 : 0.45 }}>
                            <td className="svc-check">
                              <input
                                type="checkbox"
                                checked={checked}
                                disabled={isObrig}
                                onChange={() => toggleItem(item.id, isObrig)}
                                className="svc-checkbox"
                              />
                            </td>
                            <td>
                              <div className="svc-name">{item.descricao}</div>
                              {item.detalhes && (
                                <div className="svc-detail" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(item.detalhes) }} />
                              )}
                              {isObrig
                                ? <span className="svc-badge-obrig">🔒 Obrigatório</span>
                                : <span className="svc-badge-opt">Opcional</span>
                              }
                              {(item.prazo || item.taxa_min > 0 || item.taxa_max > 0) && (
                                <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>
                                  {item.prazo && <span>Prazo: {item.prazo}</span>}
                                  {item.taxa_min > 0 && <span style={{ marginLeft: item.prazo ? 8 : 0, color: '#f59e0b' }}>Taxas: {fmt(item.taxa_min)} – {fmt(item.taxa_max)}</span>}
                                </div>
                              )}
                            </td>
                            <td className="col-trevo" style={{ textAlign: 'right', verticalAlign: 'middle' }}>
                              <div className="svc-price-trevo">{fmt(item.honorario * item.quantidade)}</div>
                            </td>
                            <td className="col-cobra" style={{ textAlign: 'right', verticalAlign: 'middle' }}>
                              <input
                                type="text"
                                className="svc-price-input"
                                value={fmtInput(valorCobra)}
                                disabled={!checked}
                                onChange={e => atualizarValorContador(item.id, parseInput(e.target.value))}
                                onFocus={e => e.target.select()}
                              />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ── SERVIÇOS — FLUXO CLIENTE FINAL */}
            {isClienteFinal && (
              <div className="card">
                <div className="card-hd"><div className="card-hd-icon">📋</div><div className="card-title">Serviços</div></div>
                <div className="card-body">
                  {itensFiltrados.map((item, idx) => {
                    const isObrig = !item.isOptional;
                    const checked = selecionados.has(item.id);
                    const valorExibido = item.valorVendaDireto ?? item.honorario_minimo_contador ?? item.honorario;
                    const hasTaxa = item.taxa_min > 0 || item.taxa_max > 0;
                    return (
                      <div key={item.id} className="svc-item" style={{ opacity: checked ? 1 : 0.5 }}>
                        <div className="svc-item-hd">
                          {!isObrig && (
                            <input type="checkbox" checked={checked} onChange={() => toggleItem(item.id, false)}
                              className="svc-checkbox" style={{ flexShrink: 0 }} />
                          )}
                          {isObrig && <span style={{ fontSize: 14 }}>🔒</span>}
                          <span className="svc-num">{idx + 1}</span>
                          <span className="svc-item-name">{item.descricao}</span>
                          <span className="svc-item-price">{fmt(valorExibido * item.quantidade)}</span>
                        </div>
                        {item.detalhes && (
                          <div className="svc-item-body" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(item.detalhes) }} />
                        )}
                        {(item.prazo || hasTaxa) && (
                          <div className="svc-item-meta">
                            {item.prazo && <span>Prazo: {item.prazo}</span>}
                            {hasTaxa && <span style={{ color: '#f59e0b' }}>Taxas: {fmt(item.taxa_min)} a {fmt(item.taxa_max)}</span>}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ── SERVIÇOS — MODO PADRÃO (cliente_via_contador — sem seleção) */}
            {!isContador && !isClienteFinal && (
              <div className="card">
                <div className="card-hd"><div className="card-hd-icon">📋</div><div className="card-title">Escopo dos Serviços</div></div>
                <div className="card-body">
                  {itensFiltrados.map((item, idx) => {
                    const valorExibido = item.honorario_minimo_contador || item.honorario;
                    const hasTaxa = item.taxa_min > 0 || item.taxa_max > 0;
                    return (
                      <div key={item.id} className="svc-item">
                        <div className="svc-item-hd">
                          <span className="svc-num">{idx + 1}</span>
                          <span className="svc-item-name">{item.descricao}</span>
                          <span className="svc-item-price">{fmt(valorExibido * item.quantidade)}</span>
                        </div>
                        {item.detalhes && (
                          <div className="svc-item-body" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(item.detalhes) }} />
                        )}
                        {(item.prazo || hasTaxa) && (
                          <div className="svc-item-meta">
                            {item.prazo && <span>Prazo: {item.prazo}</span>}
                            {hasTaxa && <span style={{ color: '#f59e0b' }}>Taxas: {fmt(item.taxa_min)} a {fmt(item.taxa_max)}</span>}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* PACOTES */}
            {pacotes.length > 0 && (
              <div className="card">
                <div className="card-hd"><div className="card-hd-icon">📦</div><div className="card-title">Pacotes Disponíveis</div></div>
                <div className="card-body">
                  {pacotes.map((pac: any) => {
                    const selected = itens.filter(i => pac.itens_ids.includes(i.id));
                    const valorKey = isContador ? 'honorario' : 'honorario_minimo_contador';
                    const precoSem = selected.reduce((s: number, i: any) => s + ((i[valorKey] || i.honorario || 0) * i.quantidade), 0);
                    const preco = precoSem * (1 - (pac.desconto_pct || 0) / 100);
                    const featured = pac.nome.toLowerCase().includes('completo');
                    return (
                      <div key={pac.id} className={`pkg-item${featured ? ' feat' : ''}`}>
                        <div className="pkg-hd">
                          <span className="pkg-name">{pac.nome}</span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            {featured && <span className="pkg-badge">★ RECOMENDADO</span>}
                            <span className="pkg-disc">-{pac.desconto_pct}%</span>
                          </div>
                        </div>
                        <div className="pkg-items">{selected.map((i: any) => <div key={i.id} className="pkg-svc">{i.descricao}</div>)}</div>
                        <div className="pkg-pricing">
                          <div className="pkg-old"><span>Sem desconto</span><span>{fmt(precoSem)}</span></div>
                          <div className="pkg-new"><span>Com -{pac.desconto_pct}%</span><span>{fmt(preco)}</span></div>
                          <div className="pkg-save">↓ Economia de {fmt(precoSem - preco)}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* RESUMO */}
            <div className="card">
              <div className="card-hd"><div className="card-hd-icon">💰</div><div className="card-title">
                {isContador ? 'Resumo (Custo Trevo)' : 'Resumo do Investimento'}
              </div></div>
              <div className="card-body">
                {(descontoSel > 0 || totalTaxaMinSel > 0 || totalTaxaMaxSel > 0) && (
                  <>
                    <div className="total-row"><span className="lbl">Honorários</span><span className="val">{fmt(subtotalSel)}</span></div>
                    {descontoSel > 0 && <div className="total-row red"><span className="lbl">Desconto ({orc.desconto_pct}%)</span><span className="val">- {fmt(descontoSel)}</span></div>}
                    {(totalTaxaMinSel > 0 || totalTaxaMaxSel > 0) && <div className="total-row amber"><span className="lbl">Taxas estimadas</span><span className="val">{fmt(totalTaxaMinSel)} a {fmt(totalTaxaMaxSel)}</span></div>}
                  </>
                )}
                <div className="total-final">
                  <span className="total-final-lbl">Total</span>
                  <span className="total-final-val">{totalStr}</span>
                </div>
                {isContador && (
                  <div style={{ marginTop: 12, padding: '12px 14px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#16a34a', marginBottom: 4 }}>Você cobra do cliente</div>
                    <div style={{ fontSize: 22, fontWeight: 900, color: '#15803d' }}>{fmt(totalContador)}</div>
                    <div style={{ fontSize: 11, color: '#86efac', marginTop: 2 }}>
                      Margem estimada: {fmt(totalContador - totalSel)} ({totalSel > 0 ? Math.round(((totalContador - totalSel) / totalSel) * 100) : 0}%)
                    </div>
                  </div>
                )}
              </div>
              {/* DOWNLOAD BAR */}
              <div className="dl-bar">
                {isContador && (
                  <button className="btn-dl" onClick={handleDownloadHTML}>
                    <Download style={{ width: 13, height: 13 }} />
                    Gerar PDF pro cliente
                  </button>
                )}
                {!isContador && (
                  <>
                    <button className="btn-dl" onClick={handleDownloadHTML}>
                      <Download style={{ width: 13, height: 13 }} />
                      Salvar HTML
                    </button>
                    <button className="btn-dl" onClick={handleDownloadPDF}>
                      <FileText style={{ width: 13, height: 13 }} />
                      Baixar PDF
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* CONDIÇÕES */}
            <div className="card">
              <div className="card-hd"><div className="card-hd-icon">📄</div><div className="card-title">Condições</div></div>
              <div className="card-body">
                <div className="cond-grid">
                  <div className="cond-item"><div className="cond-lbl">Validade</div><div className="cond-val">{orc?.validade_dias} dias</div></div>
                  <div className="cond-item"><div className="cond-lbl">Pagamento</div><div className="cond-val">{orc?.pagamento || 'A combinar'}</div></div>
                </div>
                {orc?.observacoes && (
                  <div className="obs-box" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(orc.observacoes || '') }} />
                )}
              </div>
            </div>

            {orc?.status === 'rascunho' && (
              <div className="alert-rascunho">Esta proposta ainda está sendo preparada. Você será notificado quando estiver pronta.</div>
            )}

            {/* FOOTER */}
            <div className="footer">
              <div className="footer-name">{isContador ? 'Trevo Legaliza' : (escritorioNome || 'Trevo Legaliza')}</div>
              {isContador ? (
                <div className="footer-info">
                  <div>CNPJ 39.969.412/0001-70 · Rua Brasil, nº 1170, Rudge Ramos, SBC/SP</div>
                  <div>(11) 93492-7001 · administrativo@trevolegaliza.com.br · trevolegaliza.com.br</div>
                  <div style={{ marginTop: 6, fontStyle: 'italic', fontSize: 10 }}>Desde 2018 · Referência nacional em regularização empresarial · 27 estados</div>
                </div>
              ) : (
                <div className="footer-info">
                  <div>CNPJ 39.969.412/0001-70</div>
                  <div>(11) 93492-7001 · administrativo@trevolegaliza.com.br</div>
                </div>
              )}
            </div>

          </div>
        </div>

        {/* STICKY CTA */}
        {(orc?.status === 'enviado' || orc?.status === 'recusado') && (
          <div className="sticky-cta">
            <button className="btn-approve" onClick={() => setShowAprovacao(true)}>
              <CheckCircle style={{ height: 17, width: 17 }} />
              {isContador
                ? (orc?.status === 'recusado' ? 'Mudei de ideia — Aprovar' : 'Aprovar e fechar negócio')
                : (orc?.status === 'recusado' ? 'Mudei de ideia — Aprovar' : 'Aprovar Proposta')}
            </button>
            {orc?.status === 'enviado' && (
              <button className="btn-reject" onClick={() => setShowRecusa(true)} title="Recusar proposta">
                <XCircle style={{ height: 19, width: 19 }} />
              </button>
            )}
          </div>
        )}

      </div>

      {/* MODAL APROVAÇÃO */}
      {showAprovacao && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setShowAprovacao(false); }}>
          <div className="modal">
            <div className="modal-handle" />
            <div className="modal-title">{isContador ? 'Confirmar e fechar negócio' : 'Confirmar Aprovação'}</div>
            <div className="modal-sub">
              {isContador
                ? 'Ao aprovar, nossa equipe será notificada e emitirá a cobrança.'
                : 'Ao aprovar, nossa equipe será notificada imediatamente.'}
            </div>
            <div className="modal-val-box">
              <div className="modal-val-lbl">{isContador ? 'Seus honorários (Trevo)' : 'Valor total'}</div>
              <div className="modal-val">{totalStr}</div>
            </div>
            {isContador && (
              <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10, padding: 12, marginBottom: 16, textAlign: 'center' }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#16a34a', marginBottom: 3 }}>Você cobra do cliente</div>
                <div style={{ fontSize: 20, fontWeight: 900, color: '#15803d' }}>{fmt(totalContador)}</div>
              </div>
            )}
            <div className="modal-actions">
              <button className="btn-cancel" onClick={() => setShowAprovacao(false)} disabled={processando}>Cancelar</button>
              <button className="btn-confirm" onClick={handleAprovar} disabled={processando}>
                {processando ? <Loader2 style={{ height: 13, width: 13 }} className="animate-spin" /> : <CheckCircle style={{ height: 13, width: 13 }} />}
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL RECUSA */}
      {showRecusa && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setShowRecusa(false); }}>
          <div className="modal">
            <div className="modal-handle" />
            <div className="modal-title">Recusar Proposta</div>
            <div className="modal-sub">Informe o motivo para que possamos melhorar.</div>
            <label className="form-lbl">Motivo da recusa *</label>
            <textarea value={motivoRecusa} onChange={e => setMotivoRecusa(e.target.value)}
              placeholder="Ex: Valor acima do orçamento, optamos por outro fornecedor…"
              rows={3} className="textarea-field" />
            <div className="modal-actions">
              <button className="btn-cancel" onClick={() => setShowRecusa(false)} disabled={processando}>Cancelar</button>
              <button className="btn-confirm red" onClick={handleRecusar} disabled={processando || !motivoRecusa.trim()}>
                {processando ? <Loader2 style={{ height: 13, width: 13 }} className="animate-spin" /> : <XCircle style={{ height: 13, width: 13 }} />}
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
