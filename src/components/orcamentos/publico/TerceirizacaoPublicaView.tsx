/**
 * Proposta pública de Terceirização — LANDING PAGE DE CONVERSÃO.
 * Refactor visual completo 26/05/2026.
 *
 * Objetivo: o cliente fechar entendendo que NÃO QUER a Trevo, ele PRECISA.
 *
 * Estrutura:
 *  1. Hero impactante (proposta personalizada + valor em destaque)
 *  2. Por que a Trevo (autoridade + stats + diferenciais)
 *  3. Escopo customizado (visual claro do que está/não está incluso)
 *  4. Condições financeiras (valor base + abertura + tabela comparativa)
 *  5. Como funciona (plataforma Trello + esteira + SLA)
 *  6. Cláusulas e observações
 *  7. CTA final (aceitar + WhatsApp)
 *  8. Rodapé com validade
 *
 * Refactor estrutural 29/05: sub-componentes extraídos pra ./terceirizacao/.
 * Sem mudança de comportamento ou estilo — só movimentação de código.
 */
import { useEffect, useMemo, useState } from 'react';
import {
  Loader2, Check, ShieldCheck, MessageCircle, FileText, Building2,
  Clock, Zap, Users, Award, Target, Layers, ArrowRight, ArrowLeft, Sparkles, ChevronDown,
  Lock, Calendar, AlertCircle, CheckCircle2, X, Download,
} from 'lucide-react';
import { SUPABASE_URL } from '@/integrations/supabase/client';
import {
  PLANOS, REGRAS_RAPIDAS_CATALOGO, TIPO_PROCESSO_PRECO_LABELS,
  fmtBRL,
} from '@/lib/terceirizacao-engine';
import logoTrevo from '@/assets/logo-trevo.png';
import logoDaniDark from '@/assets/dani-dark.png';
import { anonHeaders, CONFETTI_CORES } from './terceirizacao/constants';
import type { OrcTerc } from './terceirizacao/types';
import { parseVideoUrl } from './terceirizacao/videoUtils';
import { Stat, Diferencial, CardEscopo, ComoFunciona } from './terceirizacao/atoms';
import { VencimentoBadge, VencimentoLinha } from './terceirizacao/Vencimento';
import { CardDaniAi } from './terceirizacao/CardDaniAi';
import { MapaBrasilAnimado } from './terceirizacao/MapaBrasilAnimado';
import { BlocoAntesDepois } from './terceirizacao/BlocoAntesDepois';
import { BlocoCalculadoraROI } from './terceirizacao/BlocoCalculadoraROI';
import { BlocoDepoimentos } from './terceirizacao/BlocoDepoimentos';
import { ModalUpsellMensal } from './terceirizacao/ModalUpsellMensal';
import { ModalRecusar } from './terceirizacao/ModalRecusar';

interface Props {
  orc: OrcTerc;
  token: string;
}

export function TerceirizacaoPublicaView({ orc, token }: Props) {
  const [aceitando, setAceitando] = useState(false);
  const [statusLocal, setStatusLocal] = useState(orc.status);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [recusarOpen, setRecusarOpen] = useState(false);
  // 27/05 noite: upsell modal (só se modalidade=avulso)
  const [upsellOpen, setUpsellOpen] = useState(false);
  // 27/05: quando true, mostra a landing em modo "celebração" (mesmo após aceito)
  // em vez da tela de sucesso. Usado quando cliente clica em "Voltar à proposta".
  const [voltouAposAceite, setVoltouAposAceite] = useState(false);
  const [confettiAtivo, setConfettiAtivo] = useState(false);
  // ITEM-024 fix: state local pra terc_pdf_url + polling automático quando
  // aceito e PDF ainda não está disponível (geração leva 15-25s assíncrona).
  const [pdfUrl, setPdfUrl] = useState<string | null>(orc.terc_pdf_url || null);

  const modalidadeCfg = PLANOS[orc.terc_modalidade as keyof typeof PLANOS];
  const expiracao = useMemo(() => {
    const d = new Date(orc.created_at);
    d.setDate(d.getDate() + (orc.validade_dias || 15));
    return d;
  }, [orc.created_at, orc.validade_dias]);

  const diasParaExpirar = useMemo(() => {
    const ms = expiracao.getTime() - Date.now();
    return Math.max(0, Math.ceil(ms / 86400000));
  }, [expiracao]);

  // 27/05: configuração de confete movida pra ANTES dos early returns
  // (React #310 — hooks devem ser chamados na MESMA ordem todo render)
  const confetes = useMemo(() => Array.from({ length: 60 }, (_, i) => ({
    left: (i * 1.7 + Math.sin(i) * 5) % 100,
    delay: (i * 0.08) % 2.5,
    duration: 2.8 + (i % 5) * 0.3,
    cor: CONFETTI_CORES[i % CONFETTI_CORES.length],
    rotate: (i * 47) % 360,
    shape: i % 3,
  })), []);

  const servicos = Array.isArray(orc.terc_servicos) ? orc.terc_servicos : [];
  const naturezas = Array.isArray(orc.terc_naturezas) ? orc.terc_naturezas : [];
  const inclusos = Array.isArray(orc.terc_inclusos) ? orc.terc_inclusos : [];
  const regrasAtivas = Array.isArray(orc.terc_regras_rapidas_ativas) ? orc.terc_regras_rapidas_ativas : [];
  const regrasObjetos = REGRAS_RAPIDAS_CATALOGO.filter((r) => regrasAtivas.includes(r.id));
  const precosPorTipo = orc.terc_precos_por_tipo || {};
  const video = parseVideoUrl(orc.terc_video_url || '');

  const valorPrincipal = (() => {
    if (orc.terc_valor_final_override && orc.terc_valor_final_override > 0) return orc.terc_valor_final_override;
    if (orc.terc_modalidade === 'pro_5') return orc.terc_valor_pro * 5;
    return orc.terc_valor_base;
  })();

  const isPlanoMensal = orc.terc_modalidade === 'pro_5';
  const isPrecoPorTipo = orc.terc_modalidade === 'preco_por_tipo';

  const handleAceitar = async () => {
    setAceitando(true);
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/aceitar_proposta_terceirizacao`, {
        method: 'POST', headers: anonHeaders,
        body: JSON.stringify({ p_token: token }),
      });
      if (!res.ok) throw new Error(`erro ${res.status}`);
      setStatusLocal('aceito');
      setConfirmOpen(false);

      // ITEM-04 (27/05 noite): com pré-gera-PDF, o PDF pode já estar pronto
      // ANTES do aceite. Em vez de esperar polling de 5s, faz fetch imediato.
      try {
        const pdfRes = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_proposta_pdf_url`, {
          method: 'POST', headers: anonHeaders,
          body: JSON.stringify({ p_token: token }),
        });
        if (pdfRes.ok) {
          const data = await pdfRes.json();
          if (data?.found && data?.pdf_url) setPdfUrl(data.pdf_url);
        }
      } catch { /* ok, cai no polling abaixo */ }
    } catch {
      alert('Não conseguimos registrar seu aceite agora. Tente recarregar a página.');
    } finally {
      setAceitando(false);
    }
  };

  // ITEM-024 fix: polling automático do PDF quando aceito e ainda não disponível.
  // PDF leva ~15-25s pra gerar (Docs API + PDFShift + merge), então a primeira
  // tela de sucesso quase nunca tem PDF pronto. Sem polling, cliente precisa
  // dar F5 várias vezes. Com polling, atualiza sozinho ao detectar URL.
  // ITEM-01 (27/05 noite): RPC dedicada get_proposta_pdf_url (não exige senha
  // já que cliente passou pelo gate antes do aceite).
  useEffect(() => {
    if (statusLocal !== 'aceito') return;
    if (pdfUrl) return;
    let tentativas = 0;
    const MAX_TENTATIVAS = 24; // 24 × 5s = 2 minutos no máximo
    const interval = setInterval(async () => {
      tentativas++;
      if (tentativas > MAX_TENTATIVAS) {
        clearInterval(interval);
        return;
      }
      try {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_proposta_pdf_url`, {
          method: 'POST', headers: anonHeaders,
          body: JSON.stringify({ p_token: token }),
        });
        if (!res.ok) return;
        const data = await res.json();
        if (data?.found && data?.pdf_url) {
          setPdfUrl(data.pdf_url);
          clearInterval(interval);
        }
      } catch { /* silencioso — tenta de novo */ }
    }, 5000);
    return () => clearInterval(interval);
  }, [statusLocal, pdfUrl, token]);

  // ─── Tela "Recusado" ────────────────────────────────────────────────────
  if (statusLocal === 'recusado') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
        <div className="max-w-md text-center space-y-5">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-slate-200">
            <X className="h-10 w-10 text-slate-500" strokeWidth={2.5} />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Recusa registrada</h1>
          <p className="text-slate-600 leading-relaxed">
            Obrigado pelo retorno. Sua resposta foi anotada e ajuda a Trevo a
            evoluir. Se mudar de ideia ou quiser revisar o escopo, fale com a
            gente pelo WhatsApp.
          </p>
          <a
            href="https://wa.me/5511934927001"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-5 py-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold transition-all"
          >
            <MessageCircle className="h-4 w-4" />
            Falar com a Trevo
          </a>
        </div>
      </div>
    );
  }

  // ─── Tela de sucesso (já aceito + ainda não voltou pra landing) ─────────
  if (statusLocal === 'aceito' && !voltouAposAceite) {
    // 60 partículas de confete com cores/posições/delays aleatórios mas estáveis
    const confettiCores = ['#10b981', '#059669', '#34d399', '#fbbf24', '#f59e0b', '#3b82f6', '#a78bfa'];
    const confetes = Array.from({ length: 60 }, (_, i) => ({
      left: (i * 1.7 + Math.sin(i) * 5) % 100,
      delay: (i * 0.08) % 2.5,
      duration: 2.8 + (i % 5) * 0.3,
      cor: confettiCores[i % confettiCores.length],
      rotate: (i * 47) % 360,
      shape: i % 3,
    }));
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-emerald-50/60 flex items-center justify-center p-4 relative overflow-hidden">
        <style>{`
          @keyframes confetti-fall { 0% { transform: translateY(-10vh) rotate(0deg); opacity: 1; } 100% { transform: translateY(110vh) rotate(720deg); opacity: 0; } }
          .ts-confetti { position: absolute; top: 0; pointer-events: none; animation: confetti-fall linear forwards; }
          @keyframes check-pop { 0% { transform: scale(0); opacity: 0; } 60% { transform: scale(1.2); opacity: 1; } 100% { transform: scale(1); opacity: 1; } }
          .ts-check-pop { animation: check-pop 0.6s cubic-bezier(.34,1.56,.64,1) both; }
          @keyframes ring-expand { 0% { transform: scale(1); opacity: 0.6; } 100% { transform: scale(2.5); opacity: 0; } }
          .ts-ring-expand { animation: ring-expand 1.8s ease-out infinite; }
          @keyframes fade-up { 0% { transform: translateY(10px); opacity: 0; } 100% { transform: translateY(0); opacity: 1; } }
          .ts-fade-up { animation: fade-up 0.6s ease-out 0.3s both; }
          .ts-fade-up-2 { animation: fade-up 0.6s ease-out 0.5s both; }
          .ts-fade-up-3 { animation: fade-up 0.6s ease-out 0.7s both; }
        `}</style>

        {/* Confete */}
        {confetes.map((c, i) => (
          <div
            key={i}
            className="ts-confetti"
            style={{
              left: `${c.left}%`,
              width: c.shape === 0 ? '8px' : c.shape === 1 ? '10px' : '6px',
              height: c.shape === 0 ? '12px' : c.shape === 1 ? '10px' : '14px',
              background: c.cor,
              borderRadius: c.shape === 1 ? '50%' : '2px',
              animationDelay: `${c.delay}s`,
              animationDuration: `${c.duration}s`,
              transform: `rotate(${c.rotate}deg)`,
            }}
          />
        ))}

        <div className="max-w-md text-center space-y-5 relative z-10">
          <div className="relative inline-flex items-center justify-center w-24 h-24 rounded-full bg-emerald-100 ring-8 ring-emerald-50 ts-check-pop">
            <span className="absolute inset-0 rounded-full bg-emerald-400/40 ts-ring-expand" />
            <span className="absolute inset-0 rounded-full bg-emerald-400/30 ts-ring-expand" style={{ animationDelay: '0.6s' }} />
            <Check className="h-12 w-12 text-emerald-600 relative" strokeWidth={3} />
          </div>
          <h1 className="text-3xl font-bold text-slate-900 ts-fade-up">Proposta aceita! 🍀</h1>
          <p className="text-slate-600 leading-relaxed ts-fade-up-2">
            Excelente decisão. A equipe Trevo recebeu seu aceite e o contrato
            está sendo enviado pela <strong className="text-emerald-700">ClickSign</strong> automaticamente
            para sua assinatura digital. Você também receberá contato pelo WhatsApp em até 1h útil para iniciar o onboarding.
          </p>
          <div className="bg-white rounded-lg border p-4 text-left space-y-2 ts-fade-up-3">
            <p className="text-xs font-mono text-muted-foreground">PROP-{String(orc.numero).padStart(4, '0')}</p>
            <p className="text-sm font-semibold text-slate-900">{orc.prospect_nome}</p>
          </div>
          {pdfUrl ? (
            <a
              href={pdfUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="ts-fade-up-3 inline-flex items-center gap-2 px-6 py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold shadow-lg hover:shadow-xl transition-all"
            >
              <Download className="h-4 w-4" strokeWidth={2.5} />
              Baixar Proposta + Contrato (PDF)
            </a>
          ) : (
            <div className="ts-fade-up-3 w-full">
              <div className="inline-flex flex-col items-center gap-2 px-6 py-3.5 rounded-xl bg-emerald-50 border-2 border-emerald-200 w-full">
                <div className="flex items-center gap-2.5 text-emerald-700">
                  <Loader2 className="h-5 w-5 animate-spin" strokeWidth={2.5} />
                  <span className="text-sm font-bold">Gerando Proposta + Contrato</span>
                </div>
                {/* Progress bar fake — animação visual de 25s */}
                <div className="w-full h-1.5 bg-emerald-100 rounded-full overflow-hidden mt-1">
                  <div className="h-full bg-gradient-to-r from-emerald-500 to-emerald-600 rounded-full ts-progress-fake" />
                </div>
                <p className="text-[11px] text-emerald-700/80 mt-1 leading-snug">
                  Pode levar até <strong>30 segundos</strong>. <strong>Não feche essa aba</strong> — o botão aparece automaticamente quando pronto.
                </p>
              </div>
              <style>{`
                @keyframes ts-progress-fake {
                  0% { width: 0%; }
                  20% { width: 25%; }
                  50% { width: 55%; }
                  75% { width: 78%; }
                  95% { width: 92%; }
                  100% { width: 95%; }
                }
                .ts-progress-fake {
                  animation: ts-progress-fake 25s cubic-bezier(.3,.7,.4,1) forwards;
                }
              `}</style>
            </div>
          )}

          <div className="ts-fade-up-3 pt-1">
            <button
              onClick={() => {
                setVoltouAposAceite(true);
                setConfettiAtivo(true);
                window.setTimeout(() => setConfettiAtivo(false), 4500);
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:text-emerald-700 hover:bg-slate-50 rounded-lg transition-colors min-h-[44px]"
            >
              <ArrowLeft className="h-4 w-4" />
              Voltar e visualizar proposta
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─── HERO ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-50 font-sans relative">
      <style>{`
        html { scroll-behavior: smooth; }
        #proposta-detalhes { scroll-margin-top: 24px; }
        @keyframes float-pulse { 0%,100% { transform: translateY(0); opacity: .4; } 50% { transform: translateY(-8px); opacity: .8; } }
        .float-pulse { animation: float-pulse 3s ease-in-out infinite; }
        .grain { background-image: radial-gradient(rgba(255,255,255,0.03) 1px, transparent 1px); background-size: 4px 4px; }
        @keyframes pulse-dot { 0%,100% { transform: scale(1); opacity: .9; } 50% { transform: scale(1.4); opacity: .5; } }
        .pulse-dot { animation: pulse-dot 2s ease-in-out infinite; }
        @keyframes dani-typing { 0%, 60%, 100% { transform: translateY(0); opacity: .4; } 30% { transform: translateY(-4px); opacity: 1; } }
        .dani-dot-1 { animation: dani-typing 1.4s ease-in-out infinite; }
        .dani-dot-2 { animation: dani-typing 1.4s ease-in-out 0.2s infinite; }
        .dani-dot-3 { animation: dani-typing 1.4s ease-in-out 0.4s infinite; }
        @keyframes confetti-fall { 0% { transform: translateY(-100vh) rotate(0deg); opacity: 1; } 100% { transform: translateY(100vh) rotate(720deg); opacity: 0; } }
        .confetti { position: fixed; top: -20px; width: 10px; height: 10px; pointer-events: none; animation: confetti-fall 3.5s cubic-bezier(.18,.79,.65,.84) forwards; }
        @keyframes brasil-glow { 0%, 100% { filter: drop-shadow(0 0 8px rgba(16,185,129,0.4)); } 50% { filter: drop-shadow(0 0 20px rgba(16,185,129,0.8)); } }
        .brasil-svg { animation: brasil-glow 4s ease-in-out infinite; }
        @keyframes scan-line { 0% { transform: translateY(-100%); } 100% { transform: translateY(100%); } }
        .scan-line { animation: scan-line 3s ease-in-out infinite; }
        @keyframes fade-up { 0% { transform: translateY(8px); opacity: 0; } 100% { transform: translateY(0); opacity: 1; } }
        @keyframes ring-expand { 0% { transform: scale(1); opacity: 0.9; } 100% { transform: scale(4); opacity: 0; } }
        @keyframes scan-sweep { 0% { transform: translateY(-10%); } 100% { transform: translateY(110%); } }
        /* DSG-07 (27/05 noite): respeita prefers-reduced-motion */
        @media (prefers-reduced-motion: reduce) {
          .ts-confetti, .float-pulse, .pulse-dot, .brasil-svg, .dani-dot-1, .dani-dot-2, .dani-dot-3, .ts-ring-expand, .scan-line {
            animation: none !important;
          }
          .ts-confetti { display: none !important; }
        }
      `}</style>

      {/* Confete overlay (apenas no modo "voltou após aceite") */}
      {confettiAtivo && (
        <div className="fixed inset-0 pointer-events-none z-[60] overflow-hidden">
          {confetes.map((c, i) => (
            <div
              key={i}
              className="ts-confetti"
              style={{
                left: `${c.left}%`,
                width: c.shape === 0 ? '8px' : c.shape === 1 ? '10px' : '6px',
                height: c.shape === 0 ? '12px' : c.shape === 1 ? '10px' : '14px',
                background: c.cor,
                borderRadius: c.shape === 1 ? '50%' : '2px',
                animationDelay: `${c.delay}s`,
                animationDuration: `${c.duration}s`,
                transform: `rotate(${c.rotate}deg)`,
              }}
            />
          ))}
          <style>{`@keyframes confetti-fall { 0% { transform: translateY(-10vh) rotate(0deg); opacity: 1; } 100% { transform: translateY(110vh) rotate(720deg); opacity: 0; } }
            .ts-confetti { position: absolute; top: 0; pointer-events: none; animation: confetti-fall linear forwards; }`}</style>
        </div>
      )}

      {/* Banner "Proposta aceita" sticky topo (apenas em modo aceito) */}
      {statusLocal === 'aceito' && (
        <div className="sticky top-0 z-50 bg-gradient-to-r from-emerald-600 to-emerald-500 text-white shadow-lg">
          <div className="max-w-5xl mx-auto px-6 py-2.5 flex items-center justify-between gap-4">
            <div className="flex items-center gap-2.5">
              <div className="h-7 w-7 rounded-full bg-white/20 inline-flex items-center justify-center shrink-0">
                <Check className="h-4 w-4 text-white" strokeWidth={3} />
              </div>
              <p className="text-sm font-bold leading-tight">
                Proposta aceita <span className="text-emerald-100/90 font-normal hidden sm:inline">· contrato indo pra ClickSign</span>
              </p>
            </div>
            {pdfUrl && (
              <a
                href={pdfUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white text-emerald-700 text-xs font-bold hover:bg-emerald-50 transition-all shrink-0"
              >
                <Download className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Baixar PDF</span>
                <span className="sm:hidden">PDF</span>
              </a>
            )}
          </div>
        </div>
      )}

      <section className="relative bg-gradient-to-br from-emerald-950 via-emerald-900 to-slate-900 text-white overflow-hidden">
        <div className="absolute inset-0 grain pointer-events-none" />
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-emerald-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 pointer-events-none" />

        {/* Header — DSG-01 (27/05 noite): mobile-safe layout */}
        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 pt-6 sm:pt-8 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
            <img src={logoTrevo} alt="Trevo Legaliza" className="h-16 w-16 sm:h-24 sm:w-24 md:h-36 md:w-36 object-contain drop-shadow-2xl shrink-0" />
            <div className="min-w-0">
              <p className="text-sm sm:text-base md:text-lg font-bold tracking-tight truncate">TREVO ASSESSORIA SOCIETÁRIA</p>
              <p className="text-[11px] sm:text-xs text-emerald-200/80 tabular-nums truncate">CNPJ 39.969.412/0001-70 · Atuação Nacional</p>
            </div>
          </div>
          <div className="hidden md:flex items-center gap-2 text-xs text-emerald-200/70">
            <Clock className="h-3.5 w-3.5" />
            <span>Validade: <strong className="text-white">{diasParaExpirar} dias</strong></span>
          </div>
        </div>

        {/* Hero core */}
        <div className="relative max-w-5xl mx-auto px-6 py-16 md:py-20">
          <div className="grid md:grid-cols-[1fr_400px] gap-10 items-center">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 mb-6">
                <Sparkles className="h-3.5 w-3.5 text-emerald-300" />
                <p className="text-[11px] uppercase tracking-[0.2em] text-emerald-200 font-semibold">
                  Proposta preparada exclusivamente para
                </p>
              </div>

              <h1 className="text-3xl sm:text-4xl md:text-6xl font-bold leading-[1.05] tracking-tight break-words">
                {orc.prospect_nome}
              </h1>
              {orc.prospect_cnpj && (
                <p className="text-emerald-200/80 mt-3 text-sm tabular-nums">{orc.prospect_cnpj}</p>
              )}

              <div className="mt-10 max-w-2xl">
                <p className="text-lg md:text-xl text-emerald-100/90 leading-relaxed">
                  Seu escritório contábil parou de crescer porque o departamento
                  societário virou o gargalo? <strong className="text-white">A gente resolve isso.</strong>
                </p>
                <p className="text-sm text-emerald-200/80 mt-4 leading-relaxed">
                  Somos o BPO societário em que escritórios de alto volume confiam:
                  SLA formalizado, rastreabilidade integral, plataforma própria e
                  operação 100% B2B. Do processo mais simples ao mais complexo.
                </p>
              </div>

              {/* CTA inline + valor */}
              <div className="mt-10 flex flex-col sm:flex-row gap-5 items-start sm:items-center">
                <div className="bg-emerald-500/10 backdrop-blur border border-emerald-400/30 rounded-xl px-5 py-3">
                  <p className="text-[10px] uppercase tracking-wider text-emerald-300/80 font-semibold">
                    {isPrecoPorTipo ? 'Preço variável por tipo' : isPlanoMensal ? 'Investimento mensal' : 'Investimento por processo'}
                  </p>
                  <p className="text-3xl md:text-4xl font-bold tabular-nums mt-0.5">
                    {isPrecoPorTipo ? '—' : fmtBRL(valorPrincipal)}
                    {isPlanoMensal && <span className="text-base font-normal text-emerald-200">/mês</span>}
                  </p>
                </div>
                <a
                  href="#proposta-detalhes"
                  className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-200 hover:text-white group"
                >
                  Ver detalhes da proposta
                  <ChevronDown className="h-4 w-4 group-hover:translate-y-0.5 transition-transform" />
                </a>
              </div>
            </div>

            {/* Mapa do Brasil animado — coluna direita */}
            <div className="hidden md:flex flex-col items-center justify-center">
              <MapaBrasilAnimado />
            </div>
          </div>
        </div>

        {/* Stats bar */}
        <div className="relative border-t border-emerald-800/60 bg-emerald-950/40 backdrop-blur">
          <div className="max-w-5xl mx-auto px-6 py-6 grid grid-cols-2 md:grid-cols-4 gap-6">
            <Stat icon={Users} value="3.800+" label="Escritórios contábeis atendidos" />
            <Stat icon={Layers} value="47k+" label="Processos protocolados" />
            <Stat icon={Target} value="27+1" label="Estados + DF de atuação" />
            <Stat icon={ShieldCheck} value="B2B" label="Exclusivo pra contadores" />
          </div>
        </div>
      </section>

      {/* ─── VÍDEO / PODCAST (se houver) ─── */}
      {video && (
        <section className="py-16 md:py-20 bg-gradient-to-b from-emerald-950 to-slate-50">
          <div className="max-w-4xl mx-auto px-6">
            <div className="text-center mb-8">
              <p className="text-[10px] uppercase tracking-[0.2em] text-emerald-700 font-bold mb-2">
                {video.type === 'spotify' || video.type === 'anchor' ? 'Conheça nosso CEO no podcast' : 'Conheça a Trevo em 2 minutos'}
              </p>
              <h2 className="text-2xl md:text-3xl font-bold text-slate-900 leading-tight">
                {video.type === 'spotify' || video.type === 'anchor'
                  ? 'Como pensamos a operação societária do Brasil.'
                  : 'Quem é, como atende, por que confiar.'}
              </h2>
            </div>
            <div className={`relative rounded-2xl overflow-hidden shadow-2xl bg-black ${video.type === 'spotify' || video.type === 'anchor' ? '' : 'aspect-video'}`}>
              {video.type === 'mp4' && (
                <video
                  src={video.embed}
                  controls
                  className="w-full h-full"
                  playsInline
                  preload="metadata"
                >
                  Seu navegador não suporta vídeo HTML5.
                </video>
              )}
              {(video.type === 'youtube' || video.type === 'vimeo' || video.type === 'iframe') && (
                <iframe
                  src={video.embed}
                  title="Trevo Legaliza — vídeo institucional"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                  className="w-full h-full"
                />
              )}
              {(video.type === 'spotify' || video.type === 'anchor') && (
                <iframe
                  src={video.embed}
                  title="Trevo Legaliza — podcast"
                  allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                  loading="lazy"
                  className="w-full"
                  style={{ height: '232px', border: 0 }}
                />
              )}
            </div>
          </div>
        </section>
      )}

      {/* ─── DIFERENCIAIS ─── */}
      <section className="py-20 bg-white">
        <div className="max-w-5xl mx-auto px-6">
          <div className="max-w-2xl mb-12">
            <p className="text-[10px] uppercase tracking-[0.2em] text-emerald-700 font-bold mb-2">Por que a Trevo Legaliza</p>
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900 leading-tight">
              Não somos só mais um. Somos a infraestrutura.
            </h2>
            <p className="text-slate-600 mt-4 leading-relaxed">
              Há 12 anos só fazemos isso. E só atendemos quem faz o que você faz.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Diferencial
              icon={Users}
              titulo="Você para de perder tempo"
              texto="Não gerencie processos societários sem controle. Nós assumimos, executamos e entregamos dentro do SLA — você foca no seu cliente."
            />
            <Diferencial
              icon={Target}
              titulo="Qualquer estado, mesmo padrão"
              texto="Atendemos 26 estados. Seu cliente em São Paulo ou no Pará recebe o mesmo nível de execução, acompanhamento e rastreabilidade."
            />
            <Diferencial
              icon={FileText}
              titulo="Zero surpresa financeira"
              texto="Taxas, emolumentos e custos extras são informados antes da execução. Sem cobrança surpresa para você, sem atrito com seu cliente final."
            />
            <Diferencial
              icon={Zap}
              titulo="Estruturado pra escalar"
              texto="Modelo desenhado pra acompanhar o crescimento do seu escritório — sem precisar contratar um departamento societário interno nem treinar uma equipe do zero."
            />
          </div>

          {/* Card destaque Dani.ai (full-width) */}
          <div className="mt-6">
            <CardDaniAi />
          </div>
        </div>
      </section>

      {/* ─── ANTES vs DEPOIS TREVO ─── */}
      <BlocoAntesDepois />

      {/* ─── CALCULADORA ROI ─── */}
      <BlocoCalculadoraROI valorProcesso={valorPrincipal} />

      {/* ─── ESCOPO CUSTOMIZADO ─── */}
      <section id="proposta-detalhes" className="py-20 bg-slate-50">
        <div className="max-w-5xl mx-auto px-6">
          <div className="max-w-2xl mb-12">
            <p className="text-[10px] uppercase tracking-[0.2em] text-emerald-700 font-bold mb-2">Anexo I — Escopo</p>
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900 leading-tight">
              O que vamos executar para você
            </h2>
            <p className="text-slate-600 mt-4 leading-relaxed">
              Escopo definido em conjunto na nossa reunião. Itens marcados são
              entregues dentro do contrato. Itens riscados são fora de escopo —
              se precisar, orçamos à parte.
            </p>
          </div>

          {/* Serviços + Naturezas em 2 colunas */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <CardEscopo titulo="Serviços Societários" itens={servicos} corChip="bg-slate-900 text-white border-slate-900" labelInativos="Fora de escopo" />
            <CardEscopo titulo="Natureza Jurídica Atendida" itens={naturezas} corChip="bg-emerald-600 text-white border-emerald-600" labelInativos="Demais naturezas geram orçamento condicional" />
          </div>

          {/* O que está incluso */}
          <div className="bg-white rounded-2xl border p-6 md:p-8">
            <div className="flex items-center justify-between mb-6">
              <div>
                <p className="text-[10px] uppercase tracking-[0.2em] text-emerald-700 font-bold">O que está incluso</p>
                <h3 className="text-xl font-bold text-slate-900 mt-1">Cada processo entregue inclui</h3>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {/* Itens institucionais sempre presentes (não vêm do banco) */}
              <div className="flex items-start gap-3 p-3 rounded-lg border-2 border-emerald-300 bg-gradient-to-br from-emerald-50 to-emerald-100/40 md:col-span-2">
                <div className="shrink-0 h-5 w-5 rounded-full bg-emerald-600 inline-flex items-center justify-center">
                  <Check className="h-3 w-3 text-white" strokeWidth={4} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-slate-900">Plataforma Trevo Engine + Aplicativo Mobile</p>
                  <p className="text-[11px] mt-0.5 leading-relaxed text-slate-600">
                    Acesso completo à plataforma proprietária via web e app mobile (iOS/Android). Cartão dedicado por processo com timeline, documentos, notificações push e comunicação centralizada.
                  </p>
                </div>
              </div>
              {/* COM-08 (27/05 noite): item dani.ai removido daqui — já aparece como
                  card destaque no bloco diferenciais (CardDaniAi) + step 04 "Como
                  funciona". Tripla menção virava ruído. */}

              {inclusos
                .filter((it) => !/plataforma\s+trevo/i.test(it.label) && !/dani\.?ai/i.test(it.label))
                .map((it) => (
                <div
                  key={it.id}
                  className={
                    it.ativo
                      ? 'flex items-start gap-3 p-3 rounded-lg border border-emerald-200 bg-emerald-50/30'
                      : 'flex items-start gap-3 p-3 rounded-lg border border-slate-200 bg-slate-50/30 opacity-50'
                  }
                >
                  <div className={
                    it.ativo
                      ? 'shrink-0 h-5 w-5 rounded-full bg-emerald-600 inline-flex items-center justify-center'
                      : 'shrink-0 h-5 w-5 rounded-full bg-slate-300 inline-flex items-center justify-center'
                  }>
                    {it.ativo
                      ? <Check className="h-3 w-3 text-white" strokeWidth={4} />
                      : <X className="h-3 w-3 text-white" strokeWidth={4} />
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-semibold ${it.ativo ? 'text-slate-900' : 'text-slate-400 line-through'}`}>
                      {it.label}
                    </p>
                    {it.descricao && (
                      <p className={`text-[11px] mt-0.5 leading-relaxed ${it.ativo ? 'text-slate-600' : 'text-slate-400'}`}>
                        {it.descricao}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ─── CONDIÇÕES FINANCEIRAS ─── */}
      <section className="py-20 bg-emerald-950 text-white relative overflow-hidden">
        <div className="absolute top-0 left-0 w-[500px] h-[500px] bg-emerald-500/10 rounded-full blur-3xl -translate-x-1/3 pointer-events-none" />
        <div className="relative max-w-5xl mx-auto px-6">
          <div className="max-w-2xl mb-12">
            <p className="text-[10px] uppercase tracking-[0.2em] text-emerald-300 font-bold mb-2">Anexo II — Condições financeiras</p>
            <h2 className="text-3xl md:text-4xl font-bold leading-tight">
              Investimento previsível, sem surpresa
            </h2>
            <p className="text-emerald-100/80 mt-4 leading-relaxed">
              Modalidade <strong className="text-white">{modalidadeCfg?.label || (isPrecoPorTipo ? 'Preço por tipo de processo' : 'Customizada')}</strong>.
              Valor já considerando o escopo combinado.
            </p>
          </div>

          {/* Card principal de valor */}
          {!isPrecoPorTipo && (
            <div className="bg-white text-slate-900 rounded-2xl p-8 md:p-10 shadow-2xl mb-6">
              <div className="flex flex-col md:flex-row items-start md:items-end justify-between gap-6">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.2em] text-emerald-700 font-bold mb-2">
                    {isPlanoMensal ? 'Investimento mensal' : 'Por processo / operação societária'}
                  </p>
                  <p className="text-3xl sm:text-4xl md:text-6xl lg:text-7xl font-bold tabular-nums tracking-tight text-emerald-700 leading-none">
                    <span className="whitespace-nowrap">{fmtBRL(valorPrincipal)}</span>
                    {isPlanoMensal && <span className="block sm:inline text-lg sm:text-xl md:text-2xl font-normal text-slate-500 sm:ml-1 mt-1 sm:mt-0">/mês</span>}
                  </p>
                  {isPlanoMensal && (
                    <p className="text-sm text-slate-500 mt-2">
                      5 processos inclusos por mês · 15% de desconto por processo
                    </p>
                  )}
                </div>
                <VencimentoBadge
                  tipo={orc.terc_vencimento_tipo}
                  dia={orc.terc_dia_pagamento}
                  texto={orc.terc_vencimento_outros_texto}
                />
              </div>

              {orc.terc_valor_abertura && orc.terc_valor_abertura > 0 && orc.terc_valor_abertura !== valorPrincipal && (
                <div className="mt-6 pt-6 border-t border-slate-200">
                  <div className="relative rounded-xl bg-gradient-to-br from-emerald-50 via-emerald-100/50 to-emerald-50 border-2 border-emerald-400 p-5">
                    <div className="absolute -top-3 left-5 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-600 text-white text-[10px] font-bold uppercase tracking-wider shadow-md">
                      <Sparkles className="h-3 w-3" />
                      Diferencial Trevo
                    </div>
                    <div className="mt-1">
                      <p className="text-[10px] uppercase tracking-wider text-emerald-700 font-bold mb-1">Abertura de empresa</p>
                      <p className="text-3xl font-bold tabular-nums text-emerald-700">{fmtBRL(orc.terc_valor_abertura)}</p>
                      <p className="text-[11px] text-emerald-700/70 mt-1">
                        <strong className="text-emerald-800">{Math.round((1 - orc.terc_valor_abertura / valorPrincipal) * 100)}% mais barato</strong> que os demais processos
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Preço por tipo */}
          {isPrecoPorTipo && (
            <div className="bg-white text-slate-900 rounded-2xl p-8 md:p-10 shadow-2xl mb-6">
              <p className="text-[10px] uppercase tracking-[0.2em] text-emerald-700 font-bold mb-6">
                Tabela de honorários por tipo de processo
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {Object.entries(precosPorTipo).map(([tipo, valor]) =>
                  valor && valor > 0 ? (
                    <div key={tipo} className="flex items-center justify-between p-4 rounded-lg bg-emerald-50/50 border border-emerald-200">
                      <span className="text-sm font-semibold text-slate-900">
                        {TIPO_PROCESSO_PRECO_LABELS[tipo as keyof typeof TIPO_PROCESSO_PRECO_LABELS] || tipo}
                      </span>
                      <span className="text-xl font-bold tabular-nums text-emerald-700">{fmtBRL(valor)}</span>
                    </div>
                  ) : null
                )}
              </div>
              <VencimentoLinha
                tipo={orc.terc_vencimento_tipo}
                dia={orc.terc_dia_pagamento}
                texto={orc.terc_vencimento_outros_texto}
              />
            </div>
          )}

          {/* Validade highlight — COM-10 (27/05 noite): urgência ancorada (5º processo cortesia) */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-6 py-4 rounded-xl bg-amber-500/10 border border-amber-500/30">
            <div className="flex items-start sm:items-center gap-3">
              <AlertCircle className="h-5 w-5 text-amber-300 shrink-0 mt-0.5 sm:mt-0" />
              <div className="text-sm">
                <p>
                  Validade até{' '}
                  <strong className="text-amber-200">
                    {expiracao.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}
                  </strong>
                  {diasParaExpirar <= 5 && (
                    <span className="ml-2 text-amber-300 font-bold">
                      ({diasParaExpirar} {diasParaExpirar === 1 ? 'dia restante' : 'dias restantes'})
                    </span>
                  )}
                </p>
                <p className="text-[11px] text-amber-100/70 mt-0.5">
                  Aceitando até essa data, seu <strong className="text-amber-200">5º processo é cortesia</strong> (vide cláusulas).
                </p>
              </div>
            </div>
            <span className="hidden md:inline text-[10px] font-mono text-emerald-200/80">
              PROP-{String(orc.numero).padStart(4, '0')}
            </span>
          </div>
        </div>
      </section>

      {/* ─── COMO FUNCIONA ─── */}
      <section className="py-20 bg-white">
        <div className="max-w-5xl mx-auto px-6">
          <div className="max-w-2xl mb-12">
            <p className="text-[10px] uppercase tracking-[0.2em] text-emerald-700 font-bold mb-2">Operação</p>
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900 leading-tight">
              Você vê tudo. Em tempo real.
            </h2>
            <p className="text-slate-600 mt-4 leading-relaxed">
              Sem ligação pra saber onde está o processo. Sem &ldquo;deixa eu checar
              com o pessoal&rdquo;. Você abre o aplicativo e vê.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            <ComoFunciona
              numero="01"
              titulo="Plataforma própria"
              texto="Acesso à plataforma Trevo via app ou web. Cada processo tem cartão dedicado com timeline, documentos anexados e comunicação centralizada."
            />
            <ComoFunciona
              numero="02"
              titulo="Esteira de especialistas"
              texto="Equipes dedicadas por etapa: viabilidade, DBE, contrato, junta comercial, inscrições. Cada processo passa pelo especialista certo da etapa certa."
            />
            <ComoFunciona
              numero="03"
              titulo="SLA formalizado"
              texto="Tempo de início garantido após documentação completa. Comunicação proativa em exigências. Acompanhamento até o deferimento final."
            />
            <div className="relative p-6 rounded-2xl border-2 border-emerald-200 bg-gradient-to-br from-emerald-50 to-white hover:border-emerald-400 transition-colors">
              <p className="text-5xl font-bold text-emerald-200 leading-none mb-4">04</p>
              <div className="flex items-center gap-2 mb-2">
                <img src={logoDaniDark} alt="dani.ai" loading="lazy" decoding="async" className="h-4 object-contain" />
                <span className="px-1.5 py-0.5 rounded bg-emerald-600 text-white text-[9px] font-bold uppercase tracking-wider">24/7</span>
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-2">Monitoramento por IA</h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                Nossa IA própria varre Juntas, Receita, Prefeituras e órgãos competentes em tempo real e <strong className="text-slate-900">avisa o contador</strong> a cada movimentação — sem espera, sem ligação.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ─── CLÁUSULAS + OBSERVAÇÕES ─── */}
      {(regrasObjetos.length > 0 || (orc.terc_observacoes_publicas && orc.terc_observacoes_publicas.trim())) && (
        <section className="py-16 bg-slate-50">
          <div className="max-w-5xl mx-auto px-6">
            <div className="max-w-2xl mb-10">
              <p className="text-[10px] uppercase tracking-[0.2em] text-emerald-700 font-bold mb-2">Condições operacionais</p>
              <h2 className="text-2xl md:text-3xl font-bold text-slate-900 leading-tight">
                Regras claras desde o início
              </h2>
            </div>

            {regrasObjetos.length > 0 && (
              <div className="bg-white rounded-2xl border p-6 md:p-8 mb-4">
                <div className="space-y-4">
                  {regrasObjetos.map((r) => (
                    <div key={r.id} className="flex items-start gap-3">
                      <div className="shrink-0 h-6 w-6 rounded-full bg-emerald-100 text-emerald-700 inline-flex items-center justify-center text-[10px] font-bold">
                        <ShieldCheck className="h-3.5 w-3.5" />
                      </div>
                      <p className="text-sm text-slate-700 leading-relaxed flex-1">{r.texto}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {orc.terc_observacoes_publicas && orc.terc_observacoes_publicas.trim() && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-5">
                <p className="text-[10px] uppercase tracking-wider font-bold text-amber-700 mb-2">
                  Observações específicas desta proposta
                </p>
                <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">
                  {orc.terc_observacoes_publicas.trim()}
                </p>
              </div>
            )}
          </div>
        </section>
      )}

      {/* ─── DEPOIMENTOS ─── */}
      <BlocoDepoimentos />

      {/* ─── VINCULAÇÃO + CTA FINAL ─── */}
      <section className="py-20 bg-gradient-to-br from-slate-900 via-emerald-950 to-slate-900 text-white relative overflow-hidden">
        <div className="absolute inset-0 grain pointer-events-none" />
        <div className="relative max-w-3xl mx-auto px-6 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 mb-6">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-300" />
            <p className="text-[11px] uppercase tracking-[0.2em] text-emerald-200 font-semibold">
              Documento vinculante
            </p>
          </div>

          <h2 className="text-3xl md:text-5xl font-bold leading-tight mb-6">
            Vamos começar?
          </h2>
          <p className="text-emerald-100/80 leading-relaxed mb-3">
            Esta proposta é parte integrante do <strong className="text-white">Contrato Mestre de
            Prestação de Serviços (MSA)</strong> entre as partes. O aceite implica
            concordância integral com os termos.
          </p>
          <p className="text-sm text-emerald-200/80 leading-relaxed mb-10">
            Após o aceite, você recebe acesso à plataforma em até 2 dias úteis
            e a equipe Trevo entra em contato pra iniciar o onboarding.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            {statusLocal === 'aceito' ? (
              // Modo "aceito" — CTA vira download PDF
              pdfUrl ? (
                <a
                  href={pdfUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-8 py-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-emerald-950 text-base font-bold inline-flex items-center justify-center gap-2 transition-all shadow-xl hover:shadow-2xl hover:-translate-y-0.5"
                >
                  <Download className="h-5 w-5" strokeWidth={2.5} />
                  Baixar Proposta + Contrato (PDF)
                </a>
              ) : (
                <div className="px-8 py-4 rounded-xl bg-emerald-500/30 text-emerald-100 text-base font-bold inline-flex items-center justify-center gap-2 cursor-wait">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Gerando PDF — quase pronto
                </div>
              )
            ) : (
              <button
                onClick={() => {
                  // 27/05 noite: se modalidade=avulso, abre upsell primeiro
                  if (orc.terc_modalidade === 'avulso') {
                    setUpsellOpen(true);
                  } else {
                    setConfirmOpen(true);
                  }
                }}
                disabled={aceitando}
                className="px-8 py-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-emerald-950 text-base font-bold inline-flex items-center justify-center gap-2 transition-all shadow-xl hover:shadow-2xl hover:-translate-y-0.5 disabled:opacity-50"
              >
                <Check className="h-5 w-5" strokeWidth={3} />
                Aceitar proposta
                <ArrowRight className="h-4 w-4" />
              </button>
            )}
            <a
              href="https://wa.me/5511934927001?text=Olá!%20Tenho%20uma%20dúvida%20sobre%20a%20proposta%20comercial."
              target="_blank"
              rel="noopener noreferrer"
              className="px-6 py-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/20 text-white text-base font-semibold inline-flex items-center justify-center gap-2 transition-all"
            >
              <MessageCircle className="h-4 w-4" />
              {statusLocal === 'aceito' ? 'Falar com a Trevo' : 'Tirar dúvidas no WhatsApp'}
            </a>
          </div>

          {statusLocal !== 'aceito' && (
            <div className="mt-4">
              <button
                onClick={() => setRecusarOpen(true)}
                className="px-4 py-2 text-xs text-emerald-200/70 hover:text-emerald-100 hover:bg-white/5 rounded-md transition-colors min-h-[40px] inline-flex items-center"
              >
                Não tenho interesse — recusar com motivo
              </button>
            </div>
          )}

          {orc.terc_pdf_url && (
            <div className="mt-6">
              <a
                href={orc.terc_pdf_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-emerald-200/80 hover:text-white underline inline-flex items-center gap-1.5"
              >
                <FileText className="h-3 w-3" />
                Pré-visualizar proposta + contrato em PDF
              </a>
            </div>
          )}

          <p className="text-[11px] text-emerald-200/70 mt-12 flex items-center justify-center gap-1.5">
            <Lock className="h-3 w-3" />
            Documento gerado pela plataforma Trevo Engine ·  PROP-{String(orc.numero).padStart(4, '0')}
          </p>
        </div>
      </section>

      {/* ─── FOOTER ─── */}
      <footer className="bg-slate-100 border-t border-slate-200">
        <div className="max-w-5xl mx-auto px-6 py-8 flex flex-col md:flex-row gap-6 items-center justify-between text-xs text-slate-500">
          <div className="flex items-center gap-4">
            <img src={logoTrevo} alt="Trevo Legaliza" loading="lazy" decoding="async" className="h-16 w-16 object-contain opacity-90" />
            <div>
              <p className="font-bold text-slate-700">TREVO ASSESSORIA SOCIETÁRIA LTDA</p>
              <p>CNPJ 39.969.412/0001-70 · São Bernardo do Campo / SP</p>
              <p className="mt-1 text-[10px]">© Trevo Legaliza · 12 anos cuidando do societário</p>
            </div>
          </div>
          <div className="flex items-center gap-3 pl-0 md:pl-4 md:border-l border-slate-300">
            <div className="flex items-baseline">
              <img src={logoDaniDark} alt="dani.ai" loading="lazy" decoding="async" className="h-10 object-contain" />
              <span className="text-[10px] text-slate-400 font-semibold ml-0.5" aria-label="marca registrada">®</span>
            </div>
            <div className="leading-tight">
              <p className="text-[9px] uppercase tracking-wider text-slate-400 font-bold">Powered by</p>
              <p className="text-xs font-bold text-slate-700">Trevo Legaliza</p>
            </div>
          </div>
        </div>
      </footer>

      {/* ─── MODAL CONFIRMAR ACEITE ─── */}
      {confirmOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-8 shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-12 w-12 rounded-full bg-emerald-100 inline-flex items-center justify-center">
                <CheckCircle2 className="h-6 w-6 text-emerald-600" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">Confirmar aceite</h3>
                <p className="text-xs text-slate-500">PROP-{String(orc.numero).padStart(4, '0')}</p>
              </div>
            </div>
            <p className="text-sm text-slate-600 leading-relaxed mb-4">
              Ao confirmar, o Contrato Mestre (MSA) será enviado automaticamente pela
              ClickSign pra sua assinatura digital. O aceite verbal já tem validade
              legal (art. 107 CC + Lei 14.063/2020).
            </p>
            {/* COM-05 (27/05 noite): bullets de reversibilidade pra reduzir fricção */}
            <ul className="text-xs text-slate-700 space-y-2 mb-6 bg-emerald-50/60 border border-emerald-100 rounded-lg p-4">
              <li className="flex items-start gap-2">
                <Check className="h-3.5 w-3.5 text-emerald-600 mt-0.5 shrink-0" strokeWidth={3} />
                <span>Sem cobrança até o primeiro processo iniciar</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="h-3.5 w-3.5 text-emerald-600 mt-0.5 shrink-0" strokeWidth={3} />
                <span>Assinatura formal acontece depois — você ainda confere o MSA na ClickSign</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="h-3.5 w-3.5 text-emerald-600 mt-0.5 shrink-0" strokeWidth={3} />
                <span>Onboarding humano em até 1h útil pra tirar qualquer dúvida</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="h-3.5 w-3.5 text-emerald-600 mt-0.5 shrink-0" strokeWidth={3} />
                <span>Rescisão por qualquer motivo com aviso de 30 dias (cláusula 17)</span>
              </li>
            </ul>
            <div className="flex gap-2">
              <button
                onClick={() => setConfirmOpen(false)}
                disabled={aceitando}
                className="flex-1 px-4 py-2.5 rounded-lg border border-slate-200 text-slate-700 text-sm font-semibold hover:bg-slate-50 disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleAceitar}
                disabled={aceitando}
                className="flex-1 px-4 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold inline-flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {aceitando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                Aceitar e iniciar onboarding
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL RECUSAR COM MOTIVO ─── */}
      {recusarOpen && (
        <ModalRecusar
          token={token}
          numero={orc.numero}
          onClose={() => setRecusarOpen(false)}
          onRecusado={() => {
            setRecusarOpen(false);
            setStatusLocal('recusado');
          }}
        />
      )}

      {/* ─── MODAL UPSELL MENSAL (só modalidade=avulso) ─── */}
      {upsellOpen && (
        <ModalUpsellMensal
          token={token}
          numero={orc.numero}
          valorAvulso={orc.terc_valor_base}
          valorPro={orc.terc_valor_pro}
          onClose={() => setUpsellOpen(false)}
          onContinuar={(quisMensal: boolean) => {
            setUpsellOpen(false);
            // Se marcou interesse, RPC já foi chamada. Independente, segue pra
            // modal de confirmação do aceite.
            setConfirmOpen(true);
            // AUDIT-020 (29/05): console.log removido (página pública não deve logar)
          }}
        />
      )}
    </div>
  );
}
