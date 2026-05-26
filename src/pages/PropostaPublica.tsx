import { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Loader2, CheckCircle, XCircle, Download, FileText, Lock as LockIcon, Lightbulb, AlertTriangle, GitBranch, ListChecks, Package, Sparkles, ChevronRight, Send, Hash, Clock, ShieldCheck, ArrowLeft, CreditCard } from 'lucide-react';
import { normalizeItem, type OrcamentoItem, type CenarioOrcamento } from '@/components/orcamentos/types';
import DOMPurify from 'dompurify';
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY as SUPABASE_KEY } from '@/integrations/supabase/client';
import logoTrevo from '@/assets/logo-trevo-legaliza.png';
import daniAvatar from '@/assets/dani-avatar.png';
import { TerceirizacaoPublicaView } from '@/components/orcamentos/publico/TerceirizacaoPublicaView';
import {
  StatsBarTrevo,
  PorqueTrevoBlock,
  GarantiaSLABlock,
  ComoFuncionaPos,
  ValidadeCountdown,
  ProvaSocialBlock,
  FooterInstitucional,
} from '@/components/orcamentos/publico/AutoridadeBlocks';

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const anonHeaders = {
  'apikey': SUPABASE_KEY,
  'Authorization': `Bearer ${SUPABASE_KEY}`,
  'Content-Type': 'application/json',
};

// ─── DESIGN TOKENS ────────────────────────────────────────────────────────────
const fonts = `@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap');`;

function buildStyles(accent: string, accentDark: string) {
  return `
    * { box-sizing: border-box; margin: 0; padding: 0; }
    :root {
      --pp-accent: ${accent};
      --pp-accent-dark: ${accentDark};
      --pp-accent-soft: ${accent}1a;
      --pp-fg-1: #0f172a;
      --pp-fg-2: #475569;
      --pp-fg-3: #64748b;
      --pp-fg-4: #94a3b8;
      --pp-bg: #f4f7fa;
      --pp-bg-card: #ffffff;
      --pp-border: rgba(11, 18, 32, 0.08);
      --pp-border-strong: rgba(11, 18, 32, 0.14);
      --pp-danger: #ef4444;
      --pp-radius-md: 10px;
      --pp-radius-lg: 12px;
      --pp-radius-xl: 14px;
      --pp-radius-2xl: 18px;
      --pp-radius-3xl: 22px;
    }
    body {
      font-family: 'Inter', system-ui, -apple-system, sans-serif;
      background: var(--pp-bg);
      color: var(--pp-fg-1);
      -webkit-font-smoothing: antialiased;
      background-image: radial-gradient(60% 40% at 50% 0%, ${accent}0a, transparent 70%);
      background-attachment: fixed;
    }
    .pp-shell { min-height: 100vh; display: flex; flex-direction: column; position: relative; padding-bottom: 110px; }

    /* fade-up entrance */
    .pp-fade > * { animation: ppFade 0.5s cubic-bezier(0.4, 0, 0.2, 1) both; }
    .pp-fade > *:nth-child(1) { animation-delay: 0ms; }
    .pp-fade > *:nth-child(2) { animation-delay: 70ms; }
    .pp-fade > *:nth-child(3) { animation-delay: 140ms; }
    .pp-fade > *:nth-child(4) { animation-delay: 210ms; }
    .pp-fade > *:nth-child(5) { animation-delay: 280ms; }
    .pp-fade > *:nth-child(6) { animation-delay: 350ms; }
    .pp-fade > *:nth-child(7) { animation-delay: 420ms; }
    .pp-fade > *:nth-child(8) { animation-delay: 490ms; }
    @keyframes ppFade { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }

    /* TOP BAR */
    .pp-top {
      background: rgba(255, 255, 255, 0.85);
      backdrop-filter: blur(20px) saturate(150%);
      -webkit-backdrop-filter: blur(20px) saturate(150%);
      border-bottom: 1px solid var(--pp-border);
      padding: 14px 24px; position: sticky; top: 0; z-index: 20;
    }
    .pp-top-inner { max-width: 920px; margin: 0 auto; display: flex; align-items: center; justify-content: space-between; gap: 16px; }
    .pp-brand { display: flex; align-items: center; gap: 12px; min-width: 0; }
    .pp-logo-img { height: 38px; width: auto; max-width: 140px; object-fit: contain; display: block; flex-shrink: 0; animation: ppPulse 4s ease-in-out infinite; }
    @keyframes ppPulse {
      0%, 100% { filter: drop-shadow(0 0 0 rgba(34,197,94,0)); transform: scale(1); }
      50%      { filter: drop-shadow(0 0 10px rgba(34,197,94,0.40)); transform: scale(1.015); }
    }
    .pp-brand-text { min-width: 0; }
    .pp-brand-name { font-size: 15px; font-weight: 700; color: var(--pp-fg-1); letter-spacing: -0.01em; line-height: 1.15; }
    .pp-brand-sub { font-size: 10.5px; font-weight: 500; color: var(--pp-fg-3); text-transform: uppercase; letter-spacing: 0.08em; margin-top: 2px; }
    .pp-prop-id {
      font-family: ui-monospace, Menlo, monospace; font-size: 11.5px; font-weight: 600;
      color: ${accentDark}; background: ${accent}14; border: 1px solid ${accent}40;
      padding: 5px 12px; border-radius: 999px; letter-spacing: 0.04em;
      display: inline-flex; align-items: center; gap: 6px; white-space: nowrap;
    }
    .pp-prop-id .dot { width: 5px; height: 5px; border-radius: 50%; background: ${accent}; box-shadow: 0 0 6px currentColor; }

    /* HERO */
    .pp-hero {
      position: relative; overflow: hidden;
      background:
        radial-gradient(120% 80% at 80% -10%, rgba(34,197,94,0.32), transparent 55%),
        radial-gradient(80% 80% at 0% 100%, rgba(6,182,212,0.12), transparent 50%),
        linear-gradient(140deg, #0a1a14 0%, #0b3d23 45%, #082617 100%);
      color: #fafafa; padding: 48px 24px;
    }
    .pp-hero::before {
      content: ""; position: absolute; inset: 0;
      background-image:
        linear-gradient(rgba(34,197,94,0.06) 1px, transparent 1px),
        linear-gradient(90deg, rgba(34,197,94,0.06) 1px, transparent 1px);
      background-size: 48px 48px;
      mask-image: radial-gradient(ellipse 80% 60% at 50% 30%, black, transparent 80%);
      -webkit-mask-image: radial-gradient(ellipse 80% 60% at 50% 30%, black, transparent 80%);
      pointer-events: none;
    }
    .pp-hero-inner { max-width: 920px; margin: 0 auto; position: relative; z-index: 1; }
    .pp-hero-kicker-row { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin-bottom: 18px; }
    .pp-hero-kicker {
      display: inline-flex; align-items: center; gap: 8px;
      font-family: ui-monospace, Menlo, monospace; font-size: 10.5px; font-weight: 600;
      letter-spacing: 0.14em; text-transform: uppercase; color: ${accent};
      background: rgba(34,197,94,0.10); border: 1px solid rgba(34,197,94,0.32);
      padding: 5px 12px; border-radius: 999px;
    }
    .pp-hero-kicker-num { color: rgba(250,250,250,0.70); background: rgba(255,255,255,0.08); border-color: rgba(255,255,255,0.15); letter-spacing: 0.08em; }
    .pp-hero-kicker .dot { width: 5px; height: 5px; border-radius: 50%; background: ${accent}; box-shadow: 0 0 8px currentColor; animation: ppPulseDot 1.6s ease-in-out infinite; }
    @keyframes ppPulseDot { 0%,100% { opacity: 1; } 50% { opacity: 0.4; } }

    .pp-hero-title { font-size: 38px; font-weight: 800; letter-spacing: -0.03em; line-height: 1.05; margin: 0 0 6px; color: #fafafa; text-wrap: balance; }
    .pp-hero-sub { font-size: 13.5px; color: rgba(250,250,250,0.55); font-family: ui-monospace, Menlo, monospace; margin-bottom: 28px; }
    .pp-hero-grid { display: grid; grid-template-columns: 1fr auto; gap: 32px; align-items: end; }
    @media (max-width: 720px) { .pp-hero-grid { grid-template-columns: 1fr; gap: 22px; } .pp-hero-title { font-size: 28px; } }

    .pp-hero-meta { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 22px; }
    .pp-hero-pill {
      display: inline-flex; align-items: center; gap: 6px; padding: 6px 12px;
      border-radius: 999px; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.10);
      font-size: 11.5px; color: rgba(250,250,250,0.80); white-space: nowrap;
    }
    .pp-hero-pill svg { width: 13px; height: 13px; color: ${accent}; }
    .pp-hero-pill b { color: #fafafa; font-weight: 600; }

    .pp-hero-value {
      background: rgba(34,197,94,0.12); border: 1px solid rgba(34,197,94,0.35);
      border-radius: var(--pp-radius-2xl); padding: 20px 28px;
      box-shadow: 0 0 0 1px rgba(34,197,94,0.08) inset, 0 12px 40px -12px rgba(34,197,94,0.35);
      min-width: 240px; position: relative; overflow: hidden;
    }
    .pp-hero-value::before { content: ""; position: absolute; inset: 0; background: radial-gradient(80% 60% at 50% 0%, rgba(34,197,94,0.25), transparent 70%); pointer-events: none; }
    .pp-hero-value-lbl { font-size: 9.5px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.14em; color: rgba(255,255,255,0.7); margin-bottom: 6px; position: relative; z-index: 1; }
    .pp-hero-value-amount { font-size: 38px; font-weight: 800; letter-spacing: -0.03em; line-height: 1; font-variant-numeric: tabular-nums; color: #fafafa; position: relative; z-index: 1; }
    .pp-hero-value-meta { font-size: 11px; color: rgba(255,255,255,0.65); margin-top: 8px; position: relative; z-index: 1; }
    .pp-hero-value-meta b { color: ${accent}; font-weight: 600; }
    @media (max-width: 720px) { .pp-hero-value-amount { font-size: 30px; } }

    /* MAIN BODY */
    .pp-main { max-width: 920px; margin: 0 auto; padding: 32px 24px; width: 100%; }
    @media (max-width: 720px) { .pp-main { padding: 22px 16px 32px; } }
    .pp-stack { display: flex; flex-direction: column; gap: 16px; }

    /* CARDS */
    .pp-card {
      background: var(--pp-bg-card); border: 1px solid var(--pp-border);
      border-radius: var(--pp-radius-2xl); overflow: hidden;
      box-shadow: 0 1px 2px rgba(11,18,32,0.04), 0 8px 24px -16px rgba(11,18,32,0.08);
      transition: border-color 0.2s, box-shadow 0.2s;
    }
    .pp-card:hover { border-color: var(--pp-border-strong); }
    .pp-card-head { display: flex; align-items: center; gap: 12px; padding: 16px 22px; border-bottom: 1px solid var(--pp-border); }
    .pp-card-icon {
      width: 32px; height: 32px; border-radius: var(--pp-radius-md);
      background: ${accent}1a; color: ${accentDark};
      display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0;
    }
    .pp-card-icon svg { width: 16px; height: 16px; }
    .pp-card-title { font-size: 15px; font-weight: 700; letter-spacing: -0.01em; color: var(--pp-fg-1); }
    .pp-card-sub { font-size: 11.5px; color: var(--pp-fg-3); margin-top: 1px; }
    .pp-card-body { padding: 18px 22px; }

    /* DANGER variant */
    .pp-card.pp-danger { border-color: rgba(239,68,68,0.28); background: linear-gradient(180deg, rgba(239,68,68,0.03), #ffffff); }
    .pp-card.pp-danger .pp-card-head { border-bottom-color: rgba(239,68,68,0.18); background: rgba(239,68,68,0.045); }
    .pp-card.pp-danger .pp-card-icon { background: rgba(239,68,68,0.12); color: var(--pp-danger); }

    /* RISK LIST */
    .pp-risk-list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 10px; }
    .pp-risk-row { display: flex; gap: 12px; align-items: flex-start; font-size: 14px; line-height: 1.5; color: var(--pp-fg-1); }
    .pp-risk-bullet {
      width: 22px; height: 22px; flex-shrink: 0; border-radius: 50%;
      background: rgba(239,68,68,0.10); color: var(--pp-danger);
      display: inline-flex; align-items: center; justify-content: center; margin-top: 1px; font-size: 13px;
    }

    /* FLOW */
    .pp-flow { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; position: relative; }
    @media (max-width: 720px) { .pp-flow { grid-template-columns: 1fr; gap: 10px; } }
    .pp-flow-step { text-align: center; padding: 14px 12px; border-radius: var(--pp-radius-md); background: ${accent}0a; border: 1px solid ${accent}30; position: relative; }
    .pp-flow-step.idle { background: rgba(11,18,32,0.025); border-color: rgba(11,18,32,0.08); }
    .pp-flow-num {
      width: 34px; height: 34px; margin: 0 auto 8px; border-radius: 50%;
      background: ${accent}; color: #ffffff;
      display: inline-flex; align-items: center; justify-content: center;
      font-size: 13px; font-weight: 700; font-family: ui-monospace, Menlo, monospace;
      box-shadow: 0 0 0 4px ${accent}20;
    }
    .pp-flow-step.idle .pp-flow-num { background: #ffffff; border: 1.5px solid rgba(11,18,32,0.20); color: var(--pp-fg-2); box-shadow: none; }
    .pp-flow-name { font-size: 12.5px; font-weight: 600; color: var(--pp-fg-1); line-height: 1.3; }
    .pp-flow-time { font-size: 10.5px; color: var(--pp-fg-3); margin-top: 4px; font-family: ui-monospace, Menlo, monospace; }

    /* SERVICES — cliente final / cliente_via_contador */
    .pp-services { display: flex; flex-direction: column; gap: 10px; }
    .pp-svc {
      position: relative; border: 1px solid var(--pp-border); border-radius: var(--pp-radius-xl);
      padding: 14px 16px; background: #ffffff; transition: all 0.22s cubic-bezier(0.4,0,0.2,1);
    }
    .pp-svc.req { border-color: ${accent}3d; background: linear-gradient(180deg, ${accent}07, #ffffff); }
    .pp-svc.opt-on { border-color: ${accent}55; background: linear-gradient(180deg, ${accent}0a, #ffffff); box-shadow: 0 4px 16px -8px ${accent}3d; }
    .pp-svc.opt-off { background: rgba(11,18,32,0.012); border-color: var(--pp-border); border-style: dashed; }
    .pp-svc.opt-off .pp-svc-name, .pp-svc.opt-off .pp-svc-desc, .pp-svc.opt-off .pp-svc-price, .pp-svc.opt-off .pp-svc-meta { opacity: 0.55; }
    .pp-svc-row { display: flex; align-items: center; gap: 12px; }
    /* iOS-style switch — bem visível: 44px wide, knob slide, accent quando ON */
    .pp-svc-toggle {
      width: 44px; height: 26px; flex-shrink: 0; border-radius: 999px;
      cursor: pointer; padding: 0; font-family: inherit;
      background: #cbd5e1; border: 1px solid #94a3b8;
      position: relative; transition: background 0.22s, border-color 0.22s, box-shadow 0.22s;
    }
    .pp-svc-toggle::after {
      content: ""; position: absolute; top: 2px; left: 2px;
      width: 20px; height: 20px; border-radius: 50%; background: #ffffff;
      box-shadow: 0 2px 6px rgba(11,18,32,0.30);
      transition: left 0.22s cubic-bezier(0.4,0,0.2,1);
    }
    .pp-svc-toggle:hover { background: #94a3b8; }
    .pp-svc-toggle.on { background: ${accent}; border-color: ${accentDark}; box-shadow: 0 0 0 4px ${accent}25; }
    .pp-svc-toggle.on::after { left: 20px; }
    .pp-svc-toggle.lock {
      background: ${accentDark}; border-color: ${accentDark}; cursor: not-allowed;
      box-shadow: 0 0 0 4px ${accent}25;
    }
    .pp-svc-toggle.lock::after {
      left: 20px; background: #ffffff;
      content: "✓"; color: ${accentDark}; font-weight: 800;
      display: flex; align-items: center; justify-content: center; font-size: 12px;
    }
    .pp-svc-toggle svg { display: none; }
    .pp-svc-num {
      width: 22px; height: 22px; flex-shrink: 0; border-radius: 50%;
      background: ${accent}1f; color: ${accentDark};
      display: inline-flex; align-items: center; justify-content: center;
      font-size: 10.5px; font-weight: 700; font-family: ui-monospace, Menlo, monospace;
    }
    .pp-svc-name { flex: 1; font-size: 14.5px; font-weight: 600; color: var(--pp-fg-1); letter-spacing: -0.005em; min-width: 0; }
    .pp-svc-price { font-size: 16px; font-weight: 700; color: var(--pp-fg-1); font-variant-numeric: tabular-nums; letter-spacing: -0.01em; white-space: nowrap; }
    .pp-svc.opt-on .pp-svc-price { color: ${accentDark}; }
    .pp-svc-desc { font-size: 12.5px; color: var(--pp-fg-2); line-height: 1.5; margin: 8px 0 0; padding-left: 60px; }
    .pp-svc-meta { margin: 8px 0 0; padding-left: 60px; display: flex; flex-wrap: wrap; gap: 8px; }
    .pp-svc-chip {
      display: inline-flex; align-items: center; gap: 4px; font-size: 10.5px; font-weight: 500;
      color: var(--pp-fg-3); background: rgba(11,18,32,0.04); border: 1px solid rgba(11,18,32,0.06);
      padding: 3px 8px; border-radius: 999px; white-space: nowrap;
    }
    .pp-svc-chip svg { width: 11px; height: 11px; }
    .pp-svc-chip.taxas { background: rgba(245,158,11,0.08); color: #b45309; border-color: rgba(245,158,11,0.18); }
    .pp-svc-chip.req { background: ${accent}14; color: ${accentDark}; border-color: ${accent}30; }

    /* OBS / hint visible to client (negociação) */
    .pp-svc-obs {
      margin: 8px 0 0; padding-left: 60px;
      font-size: 12.5px; color: ${accentDark}; font-style: italic; line-height: 1.5;
    }

    /* CONTADOR table */
    .pp-svc-table { width: 100%; border-collapse: collapse; }
    .pp-svc-table th {
      font-size: 10.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em;
      color: var(--pp-fg-4); padding: 0 0 12px; text-align: left;
    }
    .pp-svc-table th:last-child, .pp-svc-table td:last-child { text-align: right; }
    .pp-svc-table tbody tr { border-top: 1px solid var(--pp-border); }
    .pp-svc-table td { padding: 14px 0; vertical-align: top; }
    .pp-svc-table .ck { width: 36px; padding-right: 10px !important; vertical-align: middle !important; }
    .pp-svc-table .col-trevo { min-width: 100px; }
    .pp-svc-table .col-cobra { min-width: 130px; }
    .pp-cobra-input {
      width: 120px; padding: 7px 9px; border: 1px solid var(--pp-border);
      border-radius: 8px; font-size: 13.5px; font-weight: 600; color: var(--pp-fg-1);
      text-align: right; font-family: inherit; outline: none; transition: border-color 0.15s;
      font-variant-numeric: tabular-nums;
    }
    .pp-cobra-input:focus { border-color: ${accent}; box-shadow: 0 0 0 3px ${accent}1f; }
    .pp-cobra-input:disabled { background: #f8fafc; color: var(--pp-fg-4); cursor: not-allowed; }
    .pp-trevo-cell { color: var(--pp-fg-4); font-variant-numeric: tabular-nums; font-weight: 500; }
    @media (max-width: 720px) { .pp-svc-table .col-trevo { display: none; } }

    /* CONTADOR HINT */
    .pp-hint {
      background: ${accent}0a; border: 1px solid ${accent}33; border-radius: var(--pp-radius-xl);
      padding: 14px 18px; font-size: 13px; color: var(--pp-fg-2); line-height: 1.55;
    }
    .pp-hint strong { font-weight: 700; color: ${accentDark}; }

    /* PACOTES (legacy support) */
    .pp-pkg { border: 1px solid var(--pp-border); border-radius: var(--pp-radius-xl); overflow: hidden; }
    .pp-pkg + .pp-pkg { margin-top: 10px; }
    .pp-pkg.feat { border: 2px solid ${accent}; }
    .pp-pkg-hd { padding: 14px 16px; background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); display: flex; justify-content: space-between; align-items: center; }
    .pp-pkg-name { font-size: 14px; font-weight: 700; color: #fafafa; }
    .pp-pkg-disc { font-size: 12px; color: ${accent}; font-weight: 600; background: ${accent}1f; padding: 2px 8px; border-radius: 5px; }
    .pp-pkg-badge { font-size: 10px; font-weight: 700; color: #fafafa; background: rgba(255,255,255,0.15); padding: 3px 8px; border-radius: 4px; letter-spacing: 0.04em; }
    .pp-pkg-items { padding: 12px 16px; border-bottom: 1px solid var(--pp-border); }
    .pp-pkg-svc { font-size: 12.5px; color: var(--pp-fg-2); padding: 3px 0; }
    .pp-pkg-svc::before { content: '✓ '; color: ${accent}; font-weight: 700; }
    .pp-pkg-pricing { padding: 12px 16px; background: #fafbfc; }
    .pp-pkg-old { display: flex; justify-content: space-between; font-size: 12px; color: var(--pp-fg-4); }
    .pp-pkg-old span:last-child { text-decoration: line-through; }
    .pp-pkg-new { display: flex; justify-content: space-between; font-size: 13.5px; font-weight: 700; color: ${accentDark}; margin-top: 3px; }
    .pp-pkg-save { text-align: right; font-size: 11px; color: ${accentDark}; font-weight: 600; margin-top: 3px; }

    /* SUMMARY */
    .pp-summary { border: 1px solid ${accent}40; background: linear-gradient(135deg, ${accent}10 0%, #ffffff 60%); }
    .pp-summary .pp-card-body { padding: 22px; }
    .pp-summary-row { display: flex; align-items: baseline; justify-content: space-between; gap: 16px; margin-bottom: 18px; flex-wrap: wrap; }
    .pp-summary-lbl { font-size: 13px; color: var(--pp-fg-2); }
    .pp-summary-lbl b { color: var(--pp-fg-1); font-weight: 600; }
    .pp-summary-val { font-size: 32px; font-weight: 800; letter-spacing: -0.025em; color: ${accentDark}; font-variant-numeric: tabular-nums; line-height: 1; white-space: nowrap; }
    .pp-summary-detail { display: flex; flex-direction: column; gap: 6px; margin-bottom: 18px; }
    .pp-summary-line { display: flex; justify-content: space-between; font-size: 13px; color: var(--pp-fg-2); padding: 4px 0; }
    .pp-summary-line.red { color: var(--pp-danger); }
    .pp-summary-line.amber { color: #d97706; }
    .pp-summary-actions { display: flex; gap: 10px; flex-wrap: wrap; }
    .pp-btn {
      font-family: inherit; height: 48px; padding: 0 22px; border-radius: var(--pp-radius-md);
      border: 1px solid transparent; font-size: 14.5px; font-weight: 700; letter-spacing: -0.005em;
      cursor: pointer; display: inline-flex; align-items: center; justify-content: center; gap: 8px;
      transition: all 0.18s cubic-bezier(0.4,0,0.2,1);
    }
    .pp-btn svg { width: 16px; height: 16px; }
    .pp-btn-approve {
      flex: 1; min-width: 220px; background: ${accent}; color: #ffffff;
      box-shadow: 0 6px 20px -8px ${accent}88;
      position: relative; overflow: hidden;
      animation: ppApproveBreath 2.4s ease-in-out infinite;
    }
    .pp-btn-approve::before {
      content: ""; position: absolute; inset: 0;
      background: linear-gradient(110deg, transparent 30%, rgba(255,255,255,0.30) 50%, transparent 70%);
      transform: translateX(-100%);
      animation: ppApproveShine 3.2s ease-in-out infinite;
      pointer-events: none;
    }
    .pp-btn-approve > * { position: relative; z-index: 1; }
    .pp-btn-approve:hover { background: ${accentDark}; transform: translateY(-1px) scale(1.005); box-shadow: 0 12px 32px -8px ${accent}cc; animation-play-state: paused; }
    .pp-btn-approve:active { transform: translateY(0); }
    .pp-btn-approve:disabled { opacity: 0.6; cursor: not-allowed; transform: none; animation: none; }
    .pp-btn-approve:disabled::before { display: none; }
    @keyframes ppApproveBreath {
      0%, 100% { box-shadow: 0 6px 20px -8px ${accent}88, 0 0 0 0 ${accent}40; }
      50%      { box-shadow: 0 8px 24px -8px ${accent}aa, 0 0 0 10px transparent; }
    }
    @keyframes ppApproveShine {
      0%, 60% { transform: translateX(-100%); }
      80%, 100% { transform: translateX(100%); }
    }
    .pp-btn-decline { background: #ffffff; color: var(--pp-fg-2); border-color: var(--pp-border-strong); }
    .pp-btn-decline:hover { background: rgba(239,68,68,0.04); color: var(--pp-danger); border-color: rgba(239,68,68,0.30); }
    .pp-btn-secondary { background: #ffffff; color: var(--pp-fg-2); border-color: var(--pp-border-strong); height: 40px; padding: 0 16px; font-size: 13px; }
    .pp-btn-secondary:hover { border-color: ${accent}; color: ${accentDark}; }
    .pp-summary-hint { font-size: 11.5px; color: var(--pp-fg-3); margin: 14px 0 0; text-align: center; }
    .pp-summary-hint svg { width: 11px; height: 11px; display: inline-block; vertical-align: -1px; margin-right: 3px; }

    .pp-dl-bar { display: flex; gap: 8px; margin-top: 14px; flex-wrap: wrap; }

    /* CONDITIONS */
    .pp-cond-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
    @media (max-width: 480px) { .pp-cond-grid { grid-template-columns: 1fr; } }
    .pp-cond-item { background: #fafbfc; border: 1px solid var(--pp-border); border-radius: 10px; padding: 12px 14px; }
    .pp-cond-lbl { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: var(--pp-fg-4); margin-bottom: 5px; }
    .pp-cond-val { font-size: 13.5px; font-weight: 600; color: var(--pp-fg-1); }
    .pp-obs-box { margin-top: 12px; background: #fffbeb; border: 1px solid #fde68a; border-radius: 10px; padding: 12px 14px; font-size: 13px; color: #92400e; line-height: 1.6; }

    /* STICKY MOBILE BAR */
    .pp-sticky {
      position: fixed; bottom: 0; left: 0; right: 0; z-index: 15;
      padding: 14px 16px max(14px, env(safe-area-inset-bottom));
      background: rgba(255,255,255,0.92);
      backdrop-filter: blur(20px) saturate(150%);
      -webkit-backdrop-filter: blur(20px) saturate(150%);
      border-top: 1px solid var(--pp-border);
      display: flex; gap: 10px; align-items: center;
      box-shadow: 0 -4px 20px rgba(0,0,0,0.08);
    }
    .pp-sticky-info { display: flex; flex-direction: column; min-width: 0; }
    .pp-sticky-lbl { font-size: 10px; text-transform: uppercase; letter-spacing: 0.08em; color: var(--pp-fg-3); }
    .pp-sticky-val { font-size: 20px; font-weight: 800; color: ${accentDark}; font-variant-numeric: tabular-nums; }
    .pp-sticky-btn { margin-left: auto; height: 44px; padding: 0 18px; flex: none; min-width: 0; }
    .pp-sticky-reject {
      height: 44px; width: 44px; background: #ffffff; color: var(--pp-danger);
      border: 1px solid #fecaca; border-radius: var(--pp-radius-md); cursor: pointer;
      display: flex; align-items: center; justify-content: center; font-family: inherit; transition: background 0.15s;
    }
    .pp-sticky-reject:hover { background: #fef2f2; }

    /* FOOTER — robusto, com logo grande + contatos completos */
    .pp-foot {
      border-top: 1px solid var(--pp-border);
      padding: 32px 24px;
      background: linear-gradient(180deg, rgba(255,255,255,0.6), #ffffff);
      margin-top: 16px;
    }
    .pp-foot-inner {
      max-width: 920px; margin: 0 auto;
      display: grid; grid-template-columns: auto 1fr; gap: 32px; align-items: center;
    }
    @media (max-width: 720px) { .pp-foot-inner { grid-template-columns: 1fr; gap: 20px; text-align: center; justify-items: center; } }
    .pp-foot-brand { display: inline-flex; align-items: center; gap: 16px; }
    .pp-foot-logo { height: 52px; width: auto; max-width: 180px; object-fit: contain; }
    .pp-foot-dani { height: 44px; width: auto; max-width: 90px; object-fit: contain; opacity: 0.9; }
    .pp-foot-divider { width: 1px; height: 40px; background: var(--pp-border-strong); }
    .pp-foot-info { font-size: 12.5px; color: var(--pp-fg-2); line-height: 1.7; }
    @media (max-width: 720px) { .pp-foot-info { text-align: center; } }
    .pp-foot-name { font-size: 14px; font-weight: 800; color: var(--pp-fg-1); letter-spacing: -0.01em; margin-bottom: 4px; }
    .pp-foot-line { display: flex; flex-wrap: wrap; gap: 6px 16px; color: var(--pp-fg-3); font-size: 12px; }
    @media (max-width: 720px) { .pp-foot-line { justify-content: center; } }
    .pp-foot-line span { white-space: nowrap; display: inline-flex; align-items: center; gap: 5px; }
    .pp-foot-tag {
      display: inline-block; margin-top: 8px;
      font-size: 10.5px; font-weight: 600; color: ${accentDark};
      background: ${accent}14; border: 1px solid ${accent}33;
      padding: 3px 10px; border-radius: 999px; letter-spacing: 0.02em;
    }

    .pp-rascunho { background: #fffbeb; border: 1px solid #fde68a; border-radius: var(--pp-radius-xl); padding: 14px 18px; text-align: center; font-size: 13.5px; color: #92400e; font-weight: 500; }

    /* PULSE on total change */
    .pp-pulse { animation: ppPulseAmt 0.6s cubic-bezier(0.4,0,0.2,1); }
    @keyframes ppPulseAmt { 0% { transform: scale(1); } 35% { transform: scale(1.04); } 100% { transform: scale(1); } }

    /* ===== TELAS AUXILIARES (loading/error/senha/aprovado/recusado) ===== */
    .pp-center { min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 16px; }
    .pp-center-card {
      background: #ffffff; border-radius: var(--pp-radius-3xl);
      border: 1px solid var(--pp-border); padding: 40px 32px; max-width: 440px; width: 100%;
      text-align: center; box-shadow: 0 20px 60px -20px rgba(11,18,32,0.10);
      position: relative; overflow: hidden;
    }
    .pp-center-card.success { border-color: ${accent}40; box-shadow: 0 20px 60px -20px ${accent}33; }
    .pp-center-card.success::before { content: ""; position: absolute; inset: 0; background: radial-gradient(80% 60% at 50% 0%, ${accent}1a, transparent 60%); pointer-events: none; }
    .pp-center-ico {
      width: 64px; height: 64px; border-radius: 50%; margin: 0 auto 18px;
      display: inline-flex; align-items: center; justify-content: center;
      background: ${accent}1a; color: ${accentDark}; position: relative;
    }
    .pp-center-ico.success { animation: ppPop 0.6s cubic-bezier(0.34,1.56,0.64,1); }
    .pp-center-ico.success::after { content: ""; position: absolute; inset: -8px; border-radius: 50%; border: 2px solid ${accent}4d; animation: ppRing 1.5s ease-out infinite; }
    .pp-center-ico.danger { background: rgba(239,68,68,0.12); color: var(--pp-danger); }
    @keyframes ppPop { 0% { transform: scale(0.6); opacity: 0; } 100% { transform: scale(1); opacity: 1; } }
    @keyframes ppRing { 0% { transform: scale(0.95); opacity: 1; } 100% { transform: scale(1.4); opacity: 0; } }
    .pp-center-title { font-size: 22px; font-weight: 800; color: var(--pp-fg-1); margin: 0 0 8px; letter-spacing: -0.02em; position: relative; }
    .pp-center-desc { font-size: 14px; color: var(--pp-fg-2); line-height: 1.6; position: relative; margin-bottom: 4px; }
    .pp-center-box {
      text-align: left; background: #fafbfc; border: 1px solid var(--pp-border);
      border-radius: var(--pp-radius-lg); padding: 16px 18px; margin-top: 22px; position: relative;
    }
    .pp-center-box-ttl { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.10em; color: var(--pp-fg-3); margin-bottom: 12px; }
    .pp-center-row { display: flex; justify-content: space-between; padding: 6px 0; font-size: 13.5px; color: var(--pp-fg-1); gap: 12px; }
    .pp-center-row span:first-child { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .pp-center-row b { font-weight: 600; color: ${accentDark}; font-variant-numeric: tabular-nums; white-space: nowrap; }
    .pp-center-total { margin-top: 12px; padding-top: 12px; border-top: 1px solid var(--pp-border); display: flex; justify-content: space-between; font-size: 16px; font-weight: 700; color: var(--pp-fg-1); }
    .pp-center-total span:last-child { color: ${accentDark}; font-variant-numeric: tabular-nums; }
    .pp-center-actions { display: flex; gap: 10px; margin-top: 22px; position: relative; flex-wrap: wrap; }
    .pp-center-actions .pp-btn { flex: 1; height: 44px; font-size: 13.5px; min-width: 0; }
    .pp-pw-input { width: 100%; padding: 12px 14px; border: 1px solid var(--pp-border); border-radius: var(--pp-radius-md); font-size: 15px; outline: none; color: var(--pp-fg-1); margin-bottom: 10px; font-family: inherit; }
    .pp-pw-input:focus { border-color: ${accent}; box-shadow: 0 0 0 3px ${accent}1f; }
    .pp-pw-err { font-size: 12.5px; color: var(--pp-danger); margin-bottom: 10px; }

    /* MODAL */
    .pp-modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.55); display: flex; align-items: flex-end; justify-content: center; z-index: 60; }
    @media (min-width: 480px) { .pp-modal-overlay { align-items: center; padding: 16px; } }
    .pp-modal { background: #ffffff; width: 100%; max-width: 480px; border-radius: 22px 22px 0 0; padding: 26px 24px 28px; }
    @media (min-width: 480px) { .pp-modal { border-radius: var(--pp-radius-3xl); } }
    .pp-modal-handle { width: 36px; height: 4px; background: var(--pp-border); border-radius: 2px; margin: 0 auto 20px; }
    .pp-modal-title { font-size: 18px; font-weight: 800; color: var(--pp-fg-1); margin-bottom: 6px; letter-spacing: -0.015em; }
    .pp-modal-sub { font-size: 13px; color: var(--pp-fg-2); margin-bottom: 20px; line-height: 1.5; }
    .pp-modal-val-box { background: ${accent}0a; border: 1px solid ${accent}33; border-radius: var(--pp-radius-lg); padding: 16px; text-align: center; margin-bottom: 20px; }
    .pp-modal-val-lbl { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: ${accentDark}; margin-bottom: 4px; }
    .pp-modal-val { font-size: 28px; font-weight: 900; color: ${accentDark}; letter-spacing: -0.02em; font-variant-numeric: tabular-nums; }
    .pp-modal-actions { display: flex; gap: 10px; justify-content: flex-end; }
    .pp-modal-cancel { padding: 10px 18px; border: 1px solid var(--pp-border-strong); border-radius: var(--pp-radius-md); background: #ffffff; color: var(--pp-fg-2); font-size: 14px; font-weight: 500; cursor: pointer; font-family: inherit; }
    .pp-modal-confirm { padding: 10px 20px; border: none; border-radius: var(--pp-radius-md); background: ${accent}; color: #ffffff; font-size: 14px; font-weight: 700; cursor: pointer; display: inline-flex; align-items: center; gap: 7px; font-family: inherit; transition: background 0.15s; }
    .pp-modal-confirm:hover { background: ${accentDark}; }
    .pp-modal-confirm.red { background: var(--pp-danger); }
    .pp-modal-confirm.red:hover { background: #dc2626; }
    .pp-modal-confirm:disabled { opacity: 0.6; cursor: not-allowed; }
    .pp-textarea { width: 100%; padding: 10px 12px; border: 1px solid var(--pp-border); border-radius: var(--pp-radius-md); font-size: 14px; resize: vertical; outline: none; color: var(--pp-fg-1); font-family: inherit; line-height: 1.5; margin-bottom: 16px; }
    .pp-textarea:focus { border-color: ${accent}; box-shadow: 0 0 0 3px ${accent}1f; }
    .pp-form-lbl { font-size: 13px; font-weight: 600; color: var(--pp-fg-2); margin-bottom: 6px; display: block; }
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
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [orc, setOrc] = useState<any>(null);
  const [itens, setItens] = useState<OrcamentoItem[]>([]);

  const [senhaRequerida, setSenhaRequerida] = useState(false);
  const [senhaInput, setSenhaInput] = useState('');
  const [senhaErro, setSenhaErro] = useState(false);
  const [autenticado, setAutenticado] = useState(false);

  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [valoresContador, setValoresContador] = useState<Record<string, number>>({});

  const [showAprovacao, setShowAprovacao] = useState(false);
  const [showRecusa, setShowRecusa] = useState(false);
  const [motivoRecusa, setMotivoRecusa] = useState('');
  const [processando, setProcessando] = useState(false);
  const [statusFinal, setStatusFinal] = useState<'aprovado' | 'recusado' | null>(null);
  const [cobrancaShareToken, setCobrancaShareToken] = useState<string | null>(null);

  // Pulse no total quando muda
  const [pulse, setPulse] = useState(false);

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (saveTimer.current) clearTimeout(saveTimer.current); }, []);

  // Force light theme
  useEffect(() => {
    document.documentElement.classList.remove('dark');
    document.documentElement.classList.add('light');
    return () => { document.documentElement.classList.remove('light'); document.documentElement.classList.add('dark'); };
  }, []);

  // Helper: aplica dados da RPC completa ao estado (extraído pra usar em
  // 2 caminhos — sem senha e após autenticação).
  const aplicarOrcCompleto = (orcData: any) => {
    if (['aguardando_pagamento', 'convertido'].includes(orcData.status)) {
      setStatusFinal('aprovado');
      fetch(`${SUPABASE_URL}/rest/v1/rpc/get_cobranca_token_by_proposta`, {
        method: 'POST', headers: anonHeaders, body: JSON.stringify({ p_proposta_token: token }),
      }).then(r => r.ok ? r.json() : null)
        .then(tok => { if (tok && typeof tok === 'string') setCobrancaShareToken(tok); })
        .catch(() => {});
    } else if (orcData.status === 'recusado') setStatusFinal('recusado');

    setOrc(orcData);
    const rawItens: any[] = Array.isArray(orcData.servicos) ? orcData.servicos : [];
    const normalizados = rawItens.map(normalizeItem);
    setItens(normalizados);

    const itensSelecionados = Array.isArray(orcData.itens_selecionados) ? orcData.itens_selecionados : [];
    const prevSelIds = new Set(itensSelecionados.map((i: any) => i.id));
    const initSel = new Set<string>();
    const initVals: Record<string, number> = {};
    normalizados.forEach(i => {
      if (!i.isOptional || prevSelIds.has(i.id)) initSel.add(i.id);
    });
    itensSelecionados.forEach((i: any) => { if (i.valor_contador != null) initVals[i.id] = Number(i.valor_contador); });
    setSelecionados(initSel);
    setValoresContador(initVals);
  };

  // SEC-033 (25/05/2026): Carga inicial usa RPC MÍNIMA que retorna só
  // {has_password, numero, status, escritorio_nome}. Sem dados financeiros.
  // Só chama RPC completa após autenticação (ou se proposta sem senha).
  // Antes: RPC completa retornava tudo + has_password — atacante via DevTools
  // via dados sem digitar senha.
  useEffect(() => {
    if (!token) { setError('Link inválido'); setLoading(false); return; }
    (async () => {
      try {
        const minRes = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_proposta_publica_minima`, {
          method: 'POST', headers: anonHeaders, body: JSON.stringify({ p_token: token }),
        });
        if (!minRes.ok) { setError('Erro ao carregar proposta.'); setLoading(false); return; }
        const minResults = await minRes.json();
        if (!minResults?.length) { setError('Proposta não encontrada ou link expirado.'); setLoading(false); return; }

        const minData = minResults[0];

        if (minData.validade_dias && minData.created_at) {
          const expira = new Date(new Date(minData.created_at).getTime() + minData.validade_dias * 86400000);
          if (new Date() > expira) { setError('Esta proposta expirou. Entre em contato para solicitar uma nova.'); setLoading(false); return; }
        }

        // Se tem senha, mostra tela de senha; dados completos só após autenticar
        if (minData.has_password) {
          setSenhaRequerida(true);
          setLoading(false);
          return;
        }

        // Sem senha: chama RPC completa direto (sem p_senha)
        const fullRes = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_proposta_por_token`, {
          method: 'POST', headers: anonHeaders, body: JSON.stringify({ p_token: token, p_senha: '' }),
        });
        if (!fullRes.ok) { setError('Erro ao carregar proposta.'); setLoading(false); return; }
        const fullResults = await fullRes.json();
        if (!fullResults?.length) { setError('Proposta não encontrada ou link expirado.'); setLoading(false); return; }

        aplicarOrcCompleto(fullResults[0]);
        setLoading(false);
      } catch (err) {
        console.error('[proposta] load falhou:', err);
        setError('Erro ao carregar proposta.');
        setLoading(false);
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // Save selection silencioso (debounce)
  const salvarSelecaoSilencioso = (sel: Set<string>, vals: Record<string, number>) => {
    if (!orc) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      const payload = itens.filter(i => sel.has(i.id)).map(i => ({
        id: i.id,
        descricao: i.descricao,
        valor_contador: vals[i.id] != null ? vals[i.id] : (i.honorario_minimo_contador || i.honorario || 0),
      }));
      fetch(`${SUPABASE_URL}/rest/v1/rpc/salvar_selecao_proposta`, {
        method: 'POST', headers: anonHeaders,
        body: JSON.stringify({ p_token: token, p_selecionados: payload }),
      }).catch(() => {});
    }, 800);
  };

  const toggleItem = (id: string, isObrig: boolean) => {
    if (isObrig) return;
    setSelecionados(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      salvarSelecaoSilencioso(next, valoresContador);
      return next;
    });
  };

  const atualizarValorContador = (id: string, v: number) => {
    setValoresContador(prev => {
      const next = { ...prev, [id]: v };
      salvarSelecaoSilencioso(selecionados, next);
      return next;
    });
  };

  // SEC-033 (25/05/2026): Verifica senha + carrega RPC completa só se ela bate.
  // Antes: RPC completa já tinha sido chamada no useEffect inicial; senha era
  // só visual. Agora: a RPC completa retorna 0 rows se p_senha não bate, então
  // chamamos diretamente com a senha digitada — se vier resultado, está correta.
  async function verificarSenha() {
    if (!senhaInput.trim() || !token) return;
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_proposta_por_token`, {
        method: 'POST', headers: anonHeaders,
        body: JSON.stringify({ p_token: token, p_senha: senhaInput }),
      });
      if (!res.ok) { setSenhaErro(true); return; }
      const results = await res.json();
      if (!results?.length) {
        setSenhaErro(true);
        return;
      }
      // Senha correta: carrega dados completos + libera renderização
      aplicarOrcCompleto(results[0]);
      setAutenticado(true);
      setSenhaErro(false);
    } catch {
      setSenhaErro(true);
    }
  }

  // ── Derivados
  const modoPDF = orc?.destinatario === 'cliente_direto' ? 'direto' : orc?.destinatario === 'cliente_via_contador' ? 'cliente' : 'contador';
  const isContador = modoPDF === 'contador';
  const isClienteFinal = orc?.destinatario === 'cliente_direto';
  // Brand sempre verde Trevo (independente do tipo de destinatário)
  const accent = '#16a34a';
  const accentDark = '#15803d';
  const escritorioNome = orc?.escritorio_nome || '';
  const nomeDisplay = isContador ? 'Trevo Legaliza' : (escritorioNome || 'Trevo Legaliza');
  const cenarios: CenarioOrcamento[] = Array.isArray(orc?.cenarios) ? orc.cenarios : [];

  const itensFiltrados = useMemo(() => itens.filter(i => i.descricao.trim()), [itens]);

  const { subtotalSel, totalTaxaMinSel, totalTaxaMaxSel, descontoSel, totalSel } = useMemo(() => {
    const sel = itensFiltrados.filter(i => selecionados.has(i.id));
    const sub = isClienteFinal
      ? sel.reduce((s, i) => s + ((i.valorVendaDireto || i.honorario_minimo_contador || i.honorario || 0)) * i.quantidade, 0)
      : sel.reduce((s, i) => s + (i.honorario || 0) * i.quantidade, 0);
    const tMin = sel.reduce((s, i) => s + i.taxa_min, 0);
    const tMax = sel.reduce((s, i) => s + i.taxa_max, 0);
    const desc = sub * ((orc?.desconto_pct || 0) / 100);
    return { subtotalSel: sub, totalTaxaMinSel: tMin, totalTaxaMaxSel: tMax, descontoSel: desc, totalSel: sub - desc };
  }, [itensFiltrados, selecionados, orc, isClienteFinal]);

  const totalContador = useMemo(() => {
    return itensFiltrados
      .filter(i => selecionados.has(i.id))
      .reduce((s, i) => s + ((valoresContador[i.id] != null ? valoresContador[i.id] : (i.honorario_minimo_contador || i.honorario || 0))) * i.quantidade, 0);
  }, [itensFiltrados, selecionados, valoresContador]);

  const totalStr = (totalTaxaMinSel > 0 || totalTaxaMaxSel > 0)
    ? `${fmt(totalSel + totalTaxaMinSel)} a ${fmt(totalSel + totalTaxaMaxSel)}`
    : fmt(totalSel);

  // Pulse no total quando muda
  const prevTotalRef = useRef(totalSel);
  useEffect(() => {
    if (prevTotalRef.current !== totalSel) {
      setPulse(true);
      const t = setTimeout(() => setPulse(false), 600);
      prevTotalRef.current = totalSel;
      return () => clearTimeout(t);
    }
  }, [totalSel]);

  // ── Aprovação
  async function handleAprovar() {
    setProcessando(true);
    try {
      const r1 = await fetch(`${SUPABASE_URL}/rest/v1/rpc/aprovar_orcamento_e_gerar_cobranca`, {
        method: 'POST', headers: anonHeaders, body: JSON.stringify({ p_token: token }),
      });
      if (!r1.ok) {
        const errText = await r1.text().catch(() => '');
        throw new Error(`Aprovação falhou (${r1.status}): ${errText.slice(0, 200)}`);
      }
      const result = await r1.json();
      if (!result?.ok || !result.cobranca_id || !result.cobranca_token) {
        throw new Error('Resposta inesperada da aprovação');
      }
      fetch(`${SUPABASE_URL}/functions/v1/asaas-gerar-cobranca-publico`, {
        method: 'POST', headers: anonHeaders, body: JSON.stringify({ share_token: result.cobranca_token }),
      }).catch(err => console.warn('[proposta] asaas-gerar-publico falhou:', err));
      // SEC-039 (25/05/2026): RPC agora exige share_token (não p_orcamento_id).
      // Whitelist no SQL valida p_tipo. Anon que descobrir UUID de orçamento
      // não pode mais poluir histórico — precisa do token.
      fetch(`${SUPABASE_URL}/rest/v1/rpc/criar_evento_proposta`, {
        method: 'POST', headers: anonHeaders,
        body: JSON.stringify({
          p_token: token, p_tipo: 'aprovou',
          p_dados: { total: totalSel, itens_count: selecionados.size, cobranca_id: result.cobranca_id },
        }),
      }).catch(err => console.warn('[proposta] log aprovou falhou:', err));
      navigate(`/cobranca/${result.cobranca_token}`, { replace: true });
    } catch (err: any) {
      console.error('[proposta] handleAprovar falhou:', err);
      const rawMsg = String(err?.message || '');
      const friendlyMsg =
        rawMsg.includes('401') || rawMsg.toLowerCase().includes('unauthorized')
          ? 'Seu link expirou. Peça um novo pra equipe da Trevo.'
        : rawMsg.includes('429') || rawMsg.toLowerCase().includes('rate')
          ? 'Muitas tentativas em sequência — aguarde 1 minuto e tente de novo.'
        : rawMsg.includes('404')
          ? 'Proposta não encontrada. Peça um novo link à Trevo.'
          : 'Não conseguimos processar agora. Recarregue a página e tente de novo. Se persistir, entre em contato com a Trevo.';
      alert(friendlyMsg);
      setProcessando(false);
    }
  }

  async function handleRecusar() {
    if (!motivoRecusa.trim()) return;
    setProcessando(true);
    try {
      const r1 = await fetch(`${SUPABASE_URL}/rest/v1/rpc/atualizar_proposta_por_token`, {
        method: 'POST', headers: anonHeaders,
        body: JSON.stringify({ p_token: token, p_status: 'recusado', p_motivo: motivoRecusa }),
      });
      if (!r1.ok) throw new Error(`atualizar_proposta retornou ${r1.status}`);
      // SEC-037 (25/05/2026): RPC `criar_notificacao_proposta` foi DROPADA — era órfã
      // com EXECUTE PUBLIC + injeção de texto. Notif master agora vem da trigger SQL
      // que reage à mudança de status em `orcamentos` (status=recusado).
      // SEC-039: criar_evento_proposta agora exige share_token.
      fetch(`${SUPABASE_URL}/rest/v1/rpc/criar_evento_proposta`, {
        method: 'POST', headers: anonHeaders,
        body: JSON.stringify({ p_token: token, p_tipo: 'recusou', p_dados: { motivo: motivoRecusa } }),
      }).catch(err => console.warn('[proposta] log recusou falhou:', err));
      setStatusFinal('recusado');
      setShowRecusa(false);
      alert('Recusa registrada. A Trevo foi notificada e entrará em contato se precisar.');
    } catch (err) {
      console.error('[proposta] handleRecusar falhou:', err);
      alert('Não conseguimos registrar sua recusa. Tente recarregar a página.');
    } finally { setProcessando(false); }
  }

  // Downloads (HTML + PDF)
  function handleDownloadHTML() {
    if (!orc) return;
    const num = String(orc.numero).padStart(3, '0');
    const data = new Date(orc.created_at).toLocaleDateString('pt-BR');
    const nomeEscritorio = escritorioNome || 'Trevo Legaliza';
    const itensSel = itensFiltrados.filter(i => selecionados.has(i.id));
    const itensHtml = itensSel.map((item, idx) => {
      const valorExibido = (valoresContador[item.id] != null ? valoresContador[item.id] : (item.honorario_minimo_contador || item.honorario || 0));
      const valorTotal = valorExibido * item.quantidade;
      return `
        <div style="border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;margin-bottom:10px;">
          <div style="display:flex;justify-content:space-between;align-items:center;padding:12px 14px;background:#f8fafc;">
            <div style="display:flex;align-items:center;gap:8px;">
              <span style="width:20px;height:20px;border-radius:5px;background:${accent}18;color:${accentDark};font-size:10px;font-weight:700;display:inline-flex;align-items:center;justify-content:center;">${idx + 1}</span>
              <span style="font-size:14px;font-weight:600;color:#1e293b;">${item.descricao}</span>
              ${item.isOptional ? '<span style="font-size:11px;font-weight:600;padding:2px 7px;border-radius:5px;background:#fef9c3;color:#ca8a04;margin-left:6px;">Opcional</span>' : ''}
            </div>
            <span style="font-size:14px;font-weight:700;color:#1e293b;">${fmt(valorTotal)}</span>
          </div>
          ${item.detalhes ? `<div style="padding:8px 14px;font-size:12px;color:#475569;border-top:1px solid #f1f5f9;">${DOMPurify.sanitize(item.detalhes)}</div>` : ''}
        </div>`;
    }).join('');
    const totalClienteStr = fmt(totalContador);
    const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><title>Proposta — ${orc.prospect_nome}</title></head><body style="font-family:system-ui,sans-serif;background:#f1f5f9;color:#1e293b;margin:0;padding:0;">
<div style="max-width:680px;margin:40px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 40px rgba(0,0,0,0.10);">
  <div style="padding:30px;border-bottom:1px solid #e2e8f0;">
    <div style="font-size:18px;font-weight:800;color:#0f172a;">${nomeEscritorio}</div>
    <div style="font-size:11px;color:#64748b;margin-top:4px;">Assessoria Empresarial · ${data} · #${num}</div>
  </div>
  <div style="padding:30px;">
    <div style="font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:${accentDark};margin-bottom:8px;">Proposta Comercial</div>
    <div style="font-size:28px;font-weight:900;color:#0f172a;letter-spacing:-0.02em;margin-bottom:24px;">${orc.prospect_nome}</div>
    <div style="display:inline-block;background:${accent}1a;border:1px solid ${accent}55;border-radius:12px;padding:16px 22px;">
      <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:${accentDark};margin-bottom:4px;">Investimento</div>
      <div style="font-size:30px;font-weight:900;color:${accentDark};">${totalClienteStr}</div>
    </div>
  </div>
  <div style="padding:24px 30px;border-top:1px solid #f1f5f9;">
    <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#94a3b8;margin-bottom:14px;">Serviços Incluídos</div>
    ${itensHtml}
  </div>
  ${orc.observacoes ? `<div style="padding:18px 30px;border-top:1px solid #f1f5f9;background:#fffbeb;font-size:13px;color:#92400e;">${DOMPurify.sanitize(orc.observacoes)}</div>` : ''}
  <div style="padding:24px 30px;border-top:1px solid #f1f5f9;text-align:center;font-size:11px;color:#94a3b8;">
    ${nomeEscritorio}${orc.escritorio_cnpj ? ` · CNPJ ${orc.escritorio_cnpj}` : ''}
  </div>
</div></body></html>`;
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const nome = (orc.prospect_nome || 'proposta').replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_').substring(0, 40);
    a.href = url; a.download = `Proposta_${nome}.html`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
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
        headline_cenario: orc.headline_cenario || '', cenarios,
      });
      const nome = (orc.prospect_nome || 'proposta').replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_').substring(0, 40);
      downloadBlob(doc, `Proposta_${nome}_${String(orc.numero).padStart(3, '0')}.pdf`);
    } catch (err: any) { console.error('Erro ao gerar PDF:', err); }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // RENDERS DE ESTADO
  // ─────────────────────────────────────────────────────────────────────────────

  if (loading) return (
    <>
      <style>{fonts}</style>
      <style>{buildStyles(accent, accentDark)}</style>
      <div className="pp-center"><Loader2 style={{ height: 32, width: 32, color: accent }} className="animate-spin" /></div>
    </>
  );

  if (error) return (
    <>
      <style>{fonts}</style>
      <style>{buildStyles(accent, accentDark)}</style>
      <div className="pp-center">
        <div className="pp-center-card">
          <div className="pp-center-ico danger"><XCircle style={{ height: 32, width: 32 }} /></div>
          <h2 className="pp-center-title">Proposta Indisponível</h2>
          <p className="pp-center-desc">{error}</p>
        </div>
      </div>
    </>
  );

  if (senhaRequerida && !autenticado) return (
    <>
      <style>{fonts}</style>
      <style>{buildStyles(accent, accentDark)}</style>
      <div className="pp-center">
        <div className="pp-center-card">
          <div className="pp-center-ico"><LockIcon style={{ height: 28, width: 28 }} /></div>
          <h2 className="pp-center-title">Acesso Protegido</h2>
          <p className="pp-center-desc" style={{ marginBottom: 20 }}>Insira a senha para visualizar esta proposta.</p>
          <input type="password" placeholder="Senha" value={senhaInput}
            onChange={e => { setSenhaInput(e.target.value); setSenhaErro(false); }}
            onKeyDown={e => e.key === 'Enter' && verificarSenha()}
            className="pp-pw-input" autoFocus />
          {senhaErro && <div className="pp-pw-err">Senha incorreta. Tente novamente.</div>}
          <button onClick={verificarSenha} className="pp-btn pp-btn-approve" style={{ width: '100%' }}>Acessar Proposta</button>
        </div>
      </div>
    </>
  );

  if (statusFinal) {
    const itensAprovados = Array.isArray(orc?.itens_selecionados) ? orc.itens_selecionados : [];
    const totalAprovado = itensAprovados.reduce((s: number, i: any) => s + Number(i.valor_contador || 0), 0);
    const pago = orc?.status === 'convertido';
    return (
      <>
        <style>{fonts}</style>
        <style>{buildStyles(accent, accentDark)}</style>
        <div className="pp-center">
          <div className={`pp-center-card ${statusFinal === 'aprovado' ? 'success' : ''}`}>
            {statusFinal === 'aprovado' ? (
              <>
                <div className="pp-center-ico success"><CheckCircle style={{ height: 36, width: 36 }} /></div>
                <h2 className="pp-center-title">{pago ? 'Pagamento Confirmado!' : 'Proposta Aprovada!'}</h2>
                <p className="pp-center-desc">
                  {pago
                    ? 'Recebemos seu pagamento. Nossa equipe iniciará a execução em breve.'
                    : 'Obrigado! Finalize o pagamento para iniciarmos a execução.'}
                </p>
                {itensAprovados.length > 0 && (
                  <div className="pp-center-box">
                    <div className="pp-center-box-ttl">Itens aprovados ({itensAprovados.length})</div>
                    {itensAprovados.map((i: any) => (
                      <div key={i.id} className="pp-center-row">
                        <span>{i.descricao}</span>
                        <b>{Number(i.valor_contador).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</b>
                      </div>
                    ))}
                    <div className="pp-center-total">
                      <span>Total {pago ? 'pago' : 'a pagar'}</span>
                      <span>{totalAprovado.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                    </div>
                  </div>
                )}
                <div className="pp-center-actions">
                  {cobrancaShareToken && (
                    <button className="pp-btn pp-btn-approve" onClick={() => navigate(`/cobranca/${cobrancaShareToken}`)}>
                      <CreditCard /> {pago ? 'Ver comprovante' : 'Ir para pagamento'}
                    </button>
                  )}
                </div>
              </>
            ) : (
              <>
                <div className="pp-center-ico danger"><XCircle style={{ height: 32, width: 32 }} /></div>
                <h2 className="pp-center-title">Proposta Recusada</h2>
                <p className="pp-center-desc">Recebemos sua resposta. Caso mude de ideia, este link ainda estará disponível.</p>
                {orc?.status === 'recusado' && (
                  <div className="pp-center-actions">
                    <button className="pp-btn pp-btn-decline" onClick={() => setStatusFinal(null)}>
                      <ArrowLeft /> Revisar novamente
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </>
    );
  }

  // 25/05/2026 (Terceirização MVP Fase 1): early return pra novo tipo de
  // proposta com layout próprio (espelha o PDF do app.web do Apps Script).
  if (orc && orc.tipo_proposta === 'terceirizacao' && token) {
    return <TerceirizacaoPublicaView orc={orc as any} token={token} />;
  }

  // Guard: se chegou aqui sem orc (RPC retornou vazio ou rascunho filtrado),
  // mostra mensagem amigável em vez de renderizar página zerada com 'PAINEL DO PARCEIRO'.
  if (!orc) return (
    <>
      <style>{fonts}</style>
      <style>{buildStyles(accent, accentDark)}</style>
      <div className="pp-center">
        <div className="pp-center-card">
          <div className="pp-center-ico danger"><XCircle style={{ height: 32, width: 32 }} /></div>
          <h2 className="pp-center-title">Proposta indisponível</h2>
          <p className="pp-center-desc">
            Esta proposta pode estar em rascunho ou ter sido removida. Entre em contato com a Trevo Legaliza para um novo link.
          </p>
        </div>
      </div>
    </>
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // PROPOSTA PRINCIPAL
  // ─────────────────────────────────────────────────────────────────────────────

  const riscos = Array.isArray(orc?.riscos) ? orc.riscos : [];
  const etapasFluxo = Array.isArray(orc?.etapas_fluxo) ? orc.etapas_fluxo : [];
  const pacotes = Array.isArray(orc?.pacotes) ? orc.pacotes.filter((p: any) => p.nome && p.itens_ids?.length > 0) : [];
  const obrigatorios = itensFiltrados.filter(i => !i.isOptional);
  const opcionais = itensFiltrados.filter(i => i.isOptional);
  const opcionaisOn = opcionais.filter(i => selecionados.has(i.id));
  const ctaLabel = isContador
    ? (orc?.status === 'recusado' ? 'Mudei de ideia — Aprovar' : 'Aprovar e fechar negócio')
    : (orc?.status === 'recusado' ? 'Mudei de ideia — Aprovar' : 'Aprovar Proposta');

  return (
    <>
      <style>{fonts}</style>
      <style>{buildStyles(accent, accentDark)}</style>

      <div className="pp-shell">

        {/* TOP BAR */}
        <header className="pp-top">
          <div className="pp-top-inner">
            <div className="pp-brand">
              <img src={logoTrevo} alt={nomeDisplay} className="pp-logo-img" />
              <div className="pp-brand-text">
                <div className="pp-brand-name">{nomeDisplay}</div>
                <div className="pp-brand-sub">{isContador ? 'Painel do Parceiro' : 'Assessoria Empresarial'}</div>
              </div>
            </div>
            <div className="pp-prop-id">
              <span className="dot" /> Proposta #{String(orc?.numero || 0).padStart(3, '0')}
            </div>
          </div>
        </header>

        {/* HERO */}
        <section className="pp-hero">
          <div className="pp-hero-inner">
            <div className="pp-hero-kicker-row">
              <div className="pp-hero-kicker">
                <span className="dot" />
                {isContador ? 'Proposta para o Parceiro · ' : 'Proposta Comercial · '}
                {orc?.created_at ? new Date(orc.created_at).toLocaleDateString('pt-BR') : ''}
              </div>
              <div className="pp-hero-kicker pp-hero-kicker-num">
                <Hash size={11} /> ORC-{String(orc?.numero || 0).padStart(3, '0')}
              </div>
            </div>

            <div className="pp-hero-grid">
              <div>
                <h1 className="pp-hero-title">{orc?.prospect_nome}</h1>
                {orc?.prospect_cnpj && orc.prospect_cnpj !== '0000000000' && orc.prospect_cnpj !== '00000000000000' && (
                  <div className="pp-hero-sub">CNPJ {orc.prospect_cnpj}</div>
                )}
                <div className="pp-hero-meta">
                  <span className="pp-hero-pill"><Package /> <b>{itensFiltrados.length}</b> serviços</span>
                  <span className="pp-hero-pill"><Clock /> Válida por <b>{orc?.validade_dias} dias</b></span>
                  <span className="pp-hero-pill"><ShieldCheck /> Pagamento via <b>Asaas</b></span>
                </div>
              </div>

              <div className="pp-hero-value">
                <div className="pp-hero-value-lbl">{isContador ? 'Você cobra do cliente' : 'Investimento estimado'}</div>
                <div className={`pp-hero-value-amount ${pulse ? 'pp-pulse' : ''}`}>
                  {isContador ? fmt(totalContador) : fmt(totalSel)}
                </div>
                <div className="pp-hero-value-meta">
                  {isContador
                    ? <>Custo Trevo: <b>{fmt(totalSel)}</b> · Sua margem <b>{fmt(totalContador - totalSel)}</b></>
                    : opcionaisOn.length > 0
                      ? <>incluindo <b>{opcionaisOn.length}</b> opcional{opcionaisOn.length > 1 ? 'is' : ''}</>
                      : (opcionais.length > 0 ? 'apenas obrigatórios — você pode adicionar opcionais abaixo' : 'todos os serviços inclusos')}
                </div>
              </div>
            </div>
          </div>

          {/* Stats bar continua dentro do gradient escuro do hero pra
              continuidade visual. Variante dark. */}
          <StatsBarTrevo variant="dark" />
        </section>

        {/* ─── BLOCOS DE AUTORIDADE / CONFIANÇA (refactor 26/05/2026 noite) ──────
            Inserção pré-main pra construir a narrativa de autoridade ANTES do
            cliente cair na proposta concreta + CTA. Cada bloco é full-width
            (fora do container max-w-920px do pp-main) pra ganhar imponência.
            Não aparecem em modo contador — contador parceiro já conhece a Trevo
            e quer eficiência, não pitch institucional. */}
        {!isContador && (
          <>
            <PorqueTrevoBlock />
            <GarantiaSLABlock />
            <ProvaSocialBlock />
            <ComoFuncionaPos />
          </>
        )}

        {/* MAIN */}
        <main className="pp-main">
          <div className="pp-stack pp-fade">

            {/* Countdown destacado de validade — substitui a pílula sumida do
                hero. Só aparece quando a proposta ainda está enviada (não
                rascunho, não aceita, não recusada). */}
            {orc?.status === 'enviado' && orc?.created_at && orc?.validade_dias != null && (
              <ValidadeCountdown
                createdAt={orc.created_at}
                validadeDias={orc.validade_dias}
                numero={orc.numero}
              />
            )}


            {/* DANI intro */}
            {!isContador && (
              <section className="pp-card" style={{ background: `linear-gradient(135deg, ${accent}08 0%, #ffffff 60%)`, borderColor: `${accent}33` }}>
                <div className="pp-card-body" style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
                  <img src={daniAvatar} alt="Dani" style={{ height: 56, width: 'auto', maxWidth: 80, objectFit: 'contain', flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
                      {/* Logo "dani" já contém o texto — não duplica span 'Dani'. */}
                      <span style={{ fontSize: 9.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.10em', padding: '3px 9px', borderRadius: 999, background: `${accent}1a`, color: accentDark, border: `1px solid ${accent}40`, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <Sparkles size={10} /> IA da Trevo Legaliza
                      </span>
                    </div>
                    <p style={{ fontSize: 14, lineHeight: 1.6, color: 'var(--pp-fg-1)', margin: 0 }}>
                      Oi! Preparei essa proposta com base no que conversamos. Os obrigatórios são pra regularização — os opcionais você escolhe. <b style={{ color: accentDark }}>Qualquer dúvida, é só chamar.</b>
                    </p>
                  </div>
                </div>
              </section>
            )}

            {isContador && (
              <div className="pp-hint">
                <strong>Como usar:</strong> Marque os serviços, ajuste a coluna "Você cobra", baixe o PDF do cliente. Quando ele aprovar, volte e clique <strong>Aprovar e fechar negócio</strong>.
              </div>
            )}

            {/* CONTEXTO */}
            {orc?.contexto && (
              <section className="pp-card">
                <div className="pp-card-head">
                  <div className="pp-card-icon"><Lightbulb /></div>
                  <div>
                    <div className="pp-card-title">Contexto e apresentação</div>
                    <div className="pp-card-sub">Por que essa regularização é prioridade agora</div>
                  </div>
                </div>
                <div className="pp-card-body">
                  {orc.headline_cenario && <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--pp-fg-1)', marginBottom: 10 }}>{orc.headline_cenario}</p>}
                  <div style={{ fontSize: 14, lineHeight: 1.65, color: 'var(--pp-fg-1)' }} dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(orc.contexto || '') }} />
                </div>
              </section>
            )}

            {/* RISCOS */}
            {riscos.length > 0 && (
              <section className="pp-card pp-danger">
                <div className="pp-card-head">
                  <div className="pp-card-icon"><AlertTriangle /></div>
                  <div>
                    <div className="pp-card-title">Riscos sem regularização</div>
                    <div className="pp-card-sub">O que pode acontecer se a empresa não regularizar</div>
                  </div>
                </div>
                <div className="pp-card-body">
                  <ul className="pp-risk-list">
                    {riscos.map((r: any) => (
                      <li key={r.id} className="pp-risk-row">
                        <span className="pp-risk-bullet">✕</span>
                        <span><b style={{ color: 'var(--pp-danger)' }}>{r.penalidade}</b>{r.condicao ? `: ${r.condicao}` : ''}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </section>
            )}

            {/* FLUXO */}
            {etapasFluxo.length > 0 && (
              <section className="pp-card">
                <div className="pp-card-head">
                  <div className="pp-card-icon"><GitBranch /></div>
                  <div>
                    <div className="pp-card-title">Fluxo de execução</div>
                    <div className="pp-card-sub">{etapasFluxo.length} etapas do recebimento ao deferimento</div>
                  </div>
                </div>
                <div className="pp-card-body">
                  <div className="pp-flow">
                    {etapasFluxo.map((e: any, i: number) => (
                      <div key={e.id} className={`pp-flow-step ${i > 0 ? 'idle' : ''}`}>
                        <div className="pp-flow-num">{i + 1}</div>
                        <div className="pp-flow-name">{e.nome}</div>
                        {e.prazo && <div className="pp-flow-time">{e.prazo}</div>}
                      </div>
                    ))}
                  </div>
                </div>
              </section>
            )}

            {/* SERVIÇOS — CONTADOR */}
            {isContador && (
              <section className="pp-card">
                <div className="pp-card-head">
                  <div className="pp-card-icon"><ListChecks /></div>
                  <div>
                    <div className="pp-card-title">Selecione os serviços</div>
                    <div className="pp-card-sub">Marque o que vai oferecer e ajuste o valor cobrado do cliente</div>
                  </div>
                </div>
                <div className="pp-card-body" style={{ overflowX: 'auto' }}>
                  <table className="pp-svc-table">
                    <thead>
                      <tr>
                        <th className="ck"></th>
                        <th>Serviço</th>
                        <th className="col-trevo" style={{ textAlign: 'right' }}>Custo Trevo</th>
                        <th className="col-cobra" style={{ textAlign: 'right' }}>Você cobra</th>
                      </tr>
                    </thead>
                    <tbody>
                      {itensFiltrados.map(item => {
                        const isObrig = !item.isOptional;
                        const checked = selecionados.has(item.id);
                        const valorCobra = (valoresContador[item.id] != null ? valoresContador[item.id] : (item.honorario_minimo_contador || item.honorario || 0));
                        return (
                          <tr key={item.id} style={{ opacity: checked ? 1 : 0.45 }}>
                            <td className="ck">
                              <input type="checkbox" checked={checked} disabled={isObrig}
                                onChange={() => toggleItem(item.id, isObrig)}
                                style={{ width: 18, height: 18, accentColor: accent, cursor: isObrig ? 'not-allowed' : 'pointer' }} />
                            </td>
                            <td>
                              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--pp-fg-1)', marginBottom: 4 }}>{item.descricao}</div>
                              {item.detalhes && (
                                <div style={{ fontSize: 12, color: 'var(--pp-fg-2)', lineHeight: 1.5, marginBottom: 6 }}
                                  dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(item.detalhes) }} />
                              )}
                              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                {isObrig
                                  ? <span className="pp-svc-chip req">Obrigatório</span>
                                  : <span className="pp-svc-chip">Opcional</span>}
                                {item.prazo && <span className="pp-svc-chip"><Clock /> {item.prazo}</span>}
                                {(item.taxa_min > 0 || item.taxa_max > 0) && (
                                  <span className="pp-svc-chip taxas">Taxas: {fmt(item.taxa_min)}{item.taxa_max > item.taxa_min ? ` – ${fmt(item.taxa_max)}` : ''}</span>
                                )}
                              </div>
                            </td>
                            <td className="col-trevo" style={{ textAlign: 'right', verticalAlign: 'middle' }}>
                              <div className="pp-trevo-cell">{fmt(item.honorario * item.quantidade)}</div>
                            </td>
                            <td className="col-cobra" style={{ textAlign: 'right', verticalAlign: 'middle' }}>
                              <input type="text" className="pp-cobra-input"
                                value={fmtInput(valorCobra)} disabled={!checked}
                                onChange={e => atualizarValorContador(item.id, parseInput(e.target.value))}
                                onFocus={e => e.target.select()} />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {/* SERVIÇOS — CLIENTE FINAL */}
            {isClienteFinal && (
              <section className="pp-card">
                <div className="pp-card-head">
                  <div className="pp-card-icon"><ListChecks /></div>
                  <div>
                    <div className="pp-card-title">Serviços incluídos</div>
                    <div className="pp-card-sub">
                      <b>{obrigatorios.length}</b> obrigatório{obrigatorios.length === 1 ? '' : 's'}
                      {opcionais.length > 0 && <> · <b>{opcionais.length}</b> opcional{opcionais.length === 1 ? '' : 'is'} — você escolhe</>}
                    </div>
                  </div>
                </div>
                <div className="pp-card-body">
                  <div className="pp-services">
                    {itensFiltrados.map((item, idx) => {
                      const isObrig = !item.isOptional;
                      const checked = selecionados.has(item.id);
                      const isReq = isObrig;
                      const isOptOn = !isObrig && checked;
                      const isOptOff = !isObrig && !checked;
                      const valorExibido = item.valorVendaDireto || item.honorario_minimo_contador || item.honorario || 0;
                      const hasTaxa = item.taxa_min > 0 || item.taxa_max > 0;
                      const cls = ['pp-svc'];
                      if (isReq) cls.push('req'); else if (isOptOn) cls.push('opt-on'); else cls.push('opt-off');
                      if (!isReq) cls.push('clickable');
                      return (
                        <div key={item.id} className={cls.join(' ')}
                          onClick={() => !isReq && toggleItem(item.id, false)}
                          style={!isReq ? { cursor: 'pointer' } : undefined}>
                          <div className="pp-svc-row">
                            {isReq ? (
                              <span className="pp-svc-toggle lock" title="Item obrigatório"></span>
                            ) : (
                              <button type="button" className={`pp-svc-toggle ${checked ? 'on' : ''}`}
                                onClick={e => { e.stopPropagation(); toggleItem(item.id, false); }}
                                aria-pressed={checked}
                                aria-label={checked ? 'Remover item' : 'Adicionar item'} />
                            )}
                            <span className="pp-svc-num">{String(idx + 1).padStart(2, '0')}</span>
                            <span className="pp-svc-name">{item.descricao}</span>
                            <span className="pp-svc-price">{fmt(valorExibido * item.quantidade)}</span>
                          </div>
                          {item.detalhes && (
                            <div className="pp-svc-desc" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(item.detalhes) }} />
                          )}
                          {item.observacoes_financeiro && (
                            <p className="pp-svc-obs">{item.observacoes_financeiro}</p>
                          )}
                          {((isReq || hasTaxa || item.prazo) && !isOptOff) && (
                            <div className="pp-svc-meta">
                              {isReq && <span className="pp-svc-chip req"><LockIcon /> Obrigatório</span>}
                              {item.prazo && <span className="pp-svc-chip"><Clock /> {item.prazo}</span>}
                              {hasTaxa && (
                                <span className="pp-svc-chip taxas">
                                  Taxas: {fmt(item.taxa_min)}{item.taxa_max > item.taxa_min ? ` – ${fmt(item.taxa_max)}` : ''}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </section>
            )}

            {/* SERVIÇOS — MODO PADRÃO (cliente_via_contador, sem seleção) */}
            {!isContador && !isClienteFinal && (
              <section className="pp-card">
                <div className="pp-card-head">
                  <div className="pp-card-icon"><ListChecks /></div>
                  <div>
                    <div className="pp-card-title">Escopo dos serviços</div>
                    <div className="pp-card-sub">{itensFiltrados.length} serviço{itensFiltrados.length === 1 ? '' : 's'} inclusos</div>
                  </div>
                </div>
                <div className="pp-card-body">
                  <div className="pp-services">
                    {itensFiltrados.map((item, idx) => {
                      const valorExibido = item.honorario_minimo_contador || item.honorario;
                      const hasTaxa = item.taxa_min > 0 || item.taxa_max > 0;
                      return (
                        <div key={item.id} className="pp-svc req">
                          <div className="pp-svc-row">
                            <span className="pp-svc-num">{String(idx + 1).padStart(2, '0')}</span>
                            <span className="pp-svc-name">{item.descricao}</span>
                            <span className="pp-svc-price">{fmt(valorExibido * item.quantidade)}</span>
                          </div>
                          {item.detalhes && (
                            <div className="pp-svc-desc" style={{ paddingLeft: 30 }} dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(item.detalhes) }} />
                          )}
                          {(item.prazo || hasTaxa) && (
                            <div className="pp-svc-meta" style={{ paddingLeft: 30 }}>
                              {item.prazo && <span className="pp-svc-chip"><Clock /> {item.prazo}</span>}
                              {hasTaxa && (
                                <span className="pp-svc-chip taxas">
                                  Taxas: {fmt(item.taxa_min)}{item.taxa_max > item.taxa_min ? ` – ${fmt(item.taxa_max)}` : ''}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </section>
            )}

            {/* PACOTES (legacy) */}
            {pacotes.length > 0 && (
              <section className="pp-card">
                <div className="pp-card-head">
                  <div className="pp-card-icon"><Package /></div>
                  <div><div className="pp-card-title">Pacotes Disponíveis</div></div>
                </div>
                <div className="pp-card-body">
                  {pacotes.map((pac: any) => {
                    const selected = itens.filter(i => pac.itens_ids.includes(i.id));
                    const valorKey = isContador ? 'honorario' : 'honorario_minimo_contador';
                    const precoSem = selected.reduce((s: number, i: any) => s + ((i[valorKey] || i.honorario || 0) * i.quantidade), 0);
                    const preco = precoSem * (1 - (pac.desconto_pct || 0) / 100);
                    const featured = pac.nome.toLowerCase().includes('completo');
                    return (
                      <div key={pac.id} className={`pp-pkg${featured ? ' feat' : ''}`}>
                        <div className="pp-pkg-hd">
                          <span className="pp-pkg-name">{pac.nome}</span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            {featured && <span className="pp-pkg-badge">★ RECOMENDADO</span>}
                            <span className="pp-pkg-disc">-{pac.desconto_pct}%</span>
                          </div>
                        </div>
                        <div className="pp-pkg-items">{selected.map((i: any) => <div key={i.id} className="pp-pkg-svc">{i.descricao}</div>)}</div>
                        <div className="pp-pkg-pricing">
                          <div className="pp-pkg-old"><span>Sem desconto</span><span>{fmt(precoSem)}</span></div>
                          <div className="pp-pkg-new"><span>Com -{pac.desconto_pct}%</span><span>{fmt(preco)}</span></div>
                          <div className="pp-pkg-save">↓ Economia de {fmt(precoSem - preco)}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {/* RESUMO + AÇÕES */}
            <section className="pp-card pp-summary">
              <div className="pp-card-body">
                <div className="pp-summary-row">
                  <div>
                    <div className="pp-summary-lbl">
                      Total selecionado · <b>{selecionados.size}</b> de <b>{itensFiltrados.length}</b> itens
                    </div>
                    <div style={{ fontSize: 11.5, color: 'var(--pp-fg-3)', marginTop: 4 }}>
                      Pagamento via PIX ou boleto bancário (Asaas)
                    </div>
                  </div>
                  <div className={`pp-summary-val ${pulse ? 'pp-pulse' : ''}`}>
                    {isContador ? fmt(totalContador) : totalStr}
                  </div>
                </div>

                {!isContador && (descontoSel > 0 || totalTaxaMinSel > 0 || totalTaxaMaxSel > 0) && (
                  <div className="pp-summary-detail">
                    <div className="pp-summary-line"><span>Honorários</span><span>{fmt(subtotalSel)}</span></div>
                    {descontoSel > 0 && <div className="pp-summary-line red"><span>Desconto ({orc.desconto_pct}%)</span><span>- {fmt(descontoSel)}</span></div>}
                    {(totalTaxaMinSel > 0 || totalTaxaMaxSel > 0) && (
                      <div className="pp-summary-line amber"><span>Taxas estimadas</span><span>{fmt(totalTaxaMinSel)} a {fmt(totalTaxaMaxSel)}</span></div>
                    )}
                  </div>
                )}

                {isContador && (
                  <div className="pp-summary-detail">
                    <div className="pp-summary-line"><span>Custo Trevo (seus honorários)</span><span>{totalStr}</span></div>
                    <div className="pp-summary-line" style={{ color: accentDark, borderTop: '1px dashed var(--pp-border)', paddingTop: 8, marginTop: 4 }}>
                      <span><b>Sua margem</b></span>
                      <span><b>{fmt(totalContador - totalSel)}</b> ({totalSel > 0 ? Math.round(((totalContador - totalSel) / totalSel) * 100) : 0}%)</span>
                    </div>
                  </div>
                )}

                {(orc?.status === 'enviado' || orc?.status === 'recusado') && (
                  <div className="pp-summary-actions">
                    <button className="pp-btn pp-btn-approve" onClick={() => setShowAprovacao(true)}>
                      <CheckCircle /> {ctaLabel}
                    </button>
                    {orc?.status === 'enviado' && (
                      <button className="pp-btn pp-btn-decline" onClick={() => setShowRecusa(true)}>
                        <XCircle /> Recusar
                      </button>
                    )}
                  </div>
                )}

                <p className="pp-summary-hint">
                  <Send /> Você poderá revisar os itens uma última vez na tela de pagamento.
                </p>

                {/* Botão downloads: só pra fluxo CONTADOR (gera PDF white-label pro cliente dele).
                    No fluxo cliente final, esconder — cliente não precisa de PDF/HTML, vai
                    direto pra pagamento ao aprovar. */}
                {isContador && (
                  <div className="pp-dl-bar">
                    <button className="pp-btn pp-btn-secondary" onClick={handleDownloadHTML}>
                      <Download /> Gerar PDF pro cliente
                    </button>
                  </div>
                )}
              </div>
            </section>

            {/* CONDIÇÕES */}
            <section className="pp-card">
              <div className="pp-card-head">
                <div className="pp-card-icon"><FileText /></div>
                <div><div className="pp-card-title">Condições</div></div>
              </div>
              <div className="pp-card-body">
                <div className="pp-cond-grid">
                  <div className="pp-cond-item"><div className="pp-cond-lbl">Validade</div><div className="pp-cond-val">{orc?.validade_dias} dias</div></div>
                  <div className="pp-cond-item"><div className="pp-cond-lbl">Pagamento</div><div className="pp-cond-val">{orc?.pagamento || 'A combinar'}</div></div>
                </div>
                {orc?.observacoes && (
                  <div className="pp-obs-box" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(orc.observacoes || '') }} />
                )}
              </div>
            </section>

            {orc?.status === 'rascunho' && (
              <div className="pp-rascunho">Esta proposta ainda está sendo preparada. Você será notificado quando estiver pronta.</div>
            )}

          </div>
        </main>

        {/* STICKY MOBILE BAR (continua DENTRO do pp-shell — position:fixed
            garante visual independente da hierarquia, mas hierarquia limpa
            evita problemas de stacking context futuros) */}
        {(orc?.status === 'enviado' || orc?.status === 'recusado') && (
          <div className="pp-sticky">
            <div className="pp-sticky-info">
              <span className="pp-sticky-lbl">Total</span>
              <span className={`pp-sticky-val ${pulse ? 'pp-pulse' : ''}`}>{isContador ? fmt(totalContador) : fmt(totalSel)}</span>
            </div>
            <button className="pp-btn pp-btn-approve pp-sticky-btn" onClick={() => setShowAprovacao(true)}>
              <CheckCircle /> Aprovar
            </button>
            {orc?.status === 'enviado' && (
              <button className="pp-sticky-reject" onClick={() => setShowRecusa(true)} title="Recusar proposta">
                <XCircle style={{ height: 18, width: 18 }} />
              </button>
            )}
          </div>
        )}

      </div>

      {/* FOOTER institucional reforçado (26/05/2026 noite).
          Substitui o footer pp-foot anterior (era 1-linha simples).
          Agora: 3 colunas (marca + endereço + contatos) + faixa de selos.
          Tailwind puro, FORA do shell pra ficar full-width. */}
      <FooterInstitucional nomeDisplay={isContador ? 'TREVO ASSESSORIA SOCIETÁRIA · Painel do Parceiro' : 'TREVO ASSESSORIA SOCIETÁRIA'} />

      {/* MODAL APROVAÇÃO */}
      {showAprovacao && (
        <div className="pp-modal-overlay" onClick={e => { if (e.target === e.currentTarget) setShowAprovacao(false); }}>
          <div className="pp-modal">
            <div className="pp-modal-handle" />
            <div className="pp-modal-title">{isContador ? 'Confirmar e fechar negócio' : 'Confirmar Aprovação'}</div>
            <div className="pp-modal-sub">
              {isContador
                ? 'Ao aprovar, nossa equipe será notificada e emitirá a cobrança.'
                : 'Ao aprovar, você será direcionado para o pagamento via PIX ou boleto.'}
            </div>
            <div className="pp-modal-val-box">
              <div className="pp-modal-val-lbl">{isContador ? 'Você cobra do cliente' : 'Valor total'}</div>
              <div className="pp-modal-val">{isContador ? fmt(totalContador) : totalStr}</div>
            </div>
            {isContador && (
              <div style={{ background: '#fafbfc', border: '1px solid var(--pp-border)', borderRadius: 'var(--pp-radius-lg)', padding: 12, marginBottom: 18, fontSize: 12.5, color: 'var(--pp-fg-2)' }}>
                Seus honorários (Trevo): <b style={{ color: 'var(--pp-fg-1)' }}>{totalStr}</b> · Margem: <b style={{ color: accentDark }}>{fmt(totalContador - totalSel)}</b>
              </div>
            )}
            <div className="pp-modal-actions">
              <button className="pp-modal-cancel" onClick={() => setShowAprovacao(false)} disabled={processando}>Cancelar</button>
              <button className="pp-modal-confirm" onClick={handleAprovar} disabled={processando}>
                {processando ? <Loader2 style={{ height: 14, width: 14 }} className="animate-spin" /> : <CheckCircle style={{ height: 14, width: 14 }} />}
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL RECUSA */}
      {showRecusa && (
        <div className="pp-modal-overlay" onClick={e => { if (e.target === e.currentTarget) setShowRecusa(false); }}>
          <div className="pp-modal">
            <div className="pp-modal-handle" />
            <div className="pp-modal-title">Recusar Proposta</div>
            <div className="pp-modal-sub">Informe o motivo para que possamos melhorar.</div>
            <label className="pp-form-lbl">Motivo da recusa *</label>
            <textarea value={motivoRecusa} onChange={e => setMotivoRecusa(e.target.value)}
              placeholder="Ex: Valor acima do orçamento, optamos por outro fornecedor…"
              rows={3} className="pp-textarea" />
            <div className="pp-modal-actions">
              <button className="pp-modal-cancel" onClick={() => setShowRecusa(false)} disabled={processando}>Cancelar</button>
              <button className="pp-modal-confirm red" onClick={handleRecusar} disabled={processando || !motivoRecusa.trim()}>
                {processando ? <Loader2 style={{ height: 14, width: 14 }} className="animate-spin" /> : <XCircle style={{ height: 14, width: 14 }} />}
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
