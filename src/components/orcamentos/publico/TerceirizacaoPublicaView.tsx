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
 */
import { useEffect, useMemo, useState } from 'react';
import {
  Loader2, Check, ShieldCheck, MessageCircle, FileText, Building2,
  Clock, Zap, Users, Award, Target, Layers, ArrowRight, ArrowLeft, Sparkles, ChevronDown,
  Lock, Calendar, AlertCircle, CheckCircle2, X, Download,
} from 'lucide-react';
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from '@/integrations/supabase/client';
import {
  type ItemEditavel, type Modalidade, type PrecosPorTipo,
  PLANOS, REGRAS_RAPIDAS_CATALOGO, TIPO_PROCESSO_PRECO_LABELS,
  fmtBRL,
} from '@/lib/terceirizacao-engine';
import logoTrevo from '@/assets/logo-trevo.png';
import logoDaniDark from '@/assets/dani-dark.png';
import logoDaniLight from '@/assets/dani-light.png';
import { BRASIL_ESTADOS_PATHS } from '@/assets/brasil-states-paths';

const anonHeaders = {
  apikey: SUPABASE_PUBLISHABLE_KEY,
  Authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY}`,
  'Content-Type': 'application/json',
};

interface OrcTerc {
  id: string;
  numero: number;
  status: string;
  prospect_nome: string;
  prospect_cnpj: string | null;
  prospect_contato: string | null;
  terc_modalidade: Modalidade;
  terc_servicos: ItemEditavel[];
  terc_naturezas: ItemEditavel[];
  terc_inclusos: ItemEditavel[];
  terc_valor_base: number;
  terc_valor_pro: number;
  terc_valor_final_override?: number | null;
  terc_valor_abertura?: number | null;
  terc_dia_pagamento?: number | null;
  terc_vencimento_tipo?: 'mensal_dia' | 'deferimento' | 'outros' | null;
  terc_vencimento_outros_texto?: string | null;
  terc_precos_por_tipo?: PrecosPorTipo | null;
  terc_regras_rapidas_ativas?: string[] | null;
  terc_observacoes_publicas?: string | null;
  terc_video_url?: string | null;
  terc_pdf_url?: string | null;
  validade_dias: number;
  created_at: string;
}

// ─── Helper de detecção de plataforma de vídeo ───────────────────────────────
// ITEM-025 fix: validação de protocolo. Recusa qualquer URL que não seja
// https:// (bloqueia `javascript:`, `data:`, `file:`, http inseguro, etc).
function parseVideoUrl(url: string): { type: 'youtube' | 'vimeo' | 'mp4' | 'spotify' | 'anchor' | 'iframe'; embed: string } | null {
  if (!url || !url.trim()) return null;
  const trimmed = url.trim();
  // Sanitização: só aceita https:// (protege contra javascript:/data:/file:/etc)
  if (!/^https:\/\//i.test(trimmed)) return null;
  // YouTube
  const yt = trimmed.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  if (yt) return { type: 'youtube', embed: `https://www.youtube.com/embed/${yt[1]}?rel=0&modestbranding=1` };
  // Vimeo
  const vm = trimmed.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  if (vm) return { type: 'vimeo', embed: `https://player.vimeo.com/video/${vm[1]}?title=0&byline=0&portrait=0` };
  // Spotify podcast (episode ou show)
  const sp = trimmed.match(/open\.spotify\.com\/(episode|show|track|playlist)\/([a-zA-Z0-9]+)/);
  if (sp) return { type: 'spotify', embed: `https://open.spotify.com/embed/${sp[1]}/${sp[2]}?utm_source=generator&theme=0` };
  // Anchor.fm (legacy, hoje redirect pra Spotify mas mantém compat)
  const an = trimmed.match(/anchor\.fm\/([a-zA-Z0-9_-]+)(?:\/episodes\/([a-zA-Z0-9_-]+))?/);
  if (an) {
    const slug = an[2] || an[1];
    return { type: 'anchor', embed: `https://anchor.fm/${an[1]}/embed${an[2] ? `/episodes/${slug}` : ''}` };
  }
  // MP4/WebM/OGG direto
  if (/\.(mp4|webm|ogg|m4v)(\?.*)?$/i.test(trimmed)) return { type: 'mp4', embed: trimmed };
  // fallback: iframe (só com https) — recusado se vier de domínio inseguro
  return { type: 'iframe', embed: trimmed };
}

interface Props {
  orc: OrcTerc;
  token: string;
}

export function TerceirizacaoPublicaView({ orc, token }: Props) {
  const [aceitando, setAceitando] = useState(false);
  const [statusLocal, setStatusLocal] = useState(orc.status);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [recusarOpen, setRecusarOpen] = useState(false);
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
        const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_proposta_por_token`, {
          method: 'POST', headers: anonHeaders,
          body: JSON.stringify({ p_token: token }),
        });
        if (!res.ok) return;
        const arr = await res.json();
        const url = Array.isArray(arr) && arr[0]?.terc_pdf_url;
        if (url) {
          setPdfUrl(url);
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
              className="inline-flex items-center gap-2 text-xs text-slate-500 hover:text-emerald-700 underline-offset-2 hover:underline transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Voltar e visualizar proposta
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─── HERO ────────────────────────────────────────────────────────────────
  // 27/05: configuração de confete reutilizado entre tela de sucesso e modo "celebração"
  const confettiCores = ['#10b981', '#059669', '#34d399', '#fbbf24', '#f59e0b', '#3b82f6', '#a78bfa'];
  const confetes = useMemo(() => Array.from({ length: 60 }, (_, i) => ({
    left: (i * 1.7 + Math.sin(i) * 5) % 100,
    delay: (i * 0.08) % 2.5,
    duration: 2.8 + (i % 5) * 0.3,
    cor: confettiCores[i % confettiCores.length],
    rotate: (i * 47) % 360,
    shape: i % 3,
  })), []);

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

        {/* Header */}
        <div className="relative max-w-5xl mx-auto px-6 pt-8 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <img src={logoTrevo} alt="Trevo Legaliza" className="h-28 w-28 md:h-36 md:w-36 object-contain drop-shadow-2xl" />
            <div>
              <p className="text-base md:text-lg font-bold tracking-tight">TREVO ASSESSORIA SOCIETÁRIA</p>
              <p className="text-xs text-emerald-200/70 tabular-nums">CNPJ 39.969.412/0001-70 · Atuação Nacional</p>
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

              <h1 className="text-4xl md:text-6xl font-bold leading-[1.05] tracking-tight">
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
                <p className="text-sm text-emerald-200/60 mt-4 leading-relaxed">
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
            <Stat icon={Award} value="12" label="Anos de expertise societária" />
            <Stat icon={Target} value="26" label="Estados de atuação ativa" />
            <Stat icon={Layers} value="250+" label="Processos protocolados por semana" />
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
              <div className="flex items-start gap-3 p-3 rounded-lg border-2 border-emerald-300 bg-gradient-to-br from-emerald-50 to-emerald-100/40 md:col-span-2">
                <div className="shrink-0 h-5 w-5 rounded-full bg-emerald-600 inline-flex items-center justify-center">
                  <Check className="h-3 w-3 text-white" strokeWidth={4} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <img src={logoDaniDark} alt="dani.ai" className="h-5 object-contain" />
                    <span className="px-1.5 py-0.5 rounded-md bg-emerald-600 text-white text-[9px] font-bold uppercase tracking-wider">IA proprietária</span>
                  </div>
                  <p className="text-[11px] mt-1 leading-relaxed text-slate-600">
                    Nossa IA consulta processos em tempo real nas Juntas Comerciais e <strong className="text-slate-900">reporta atualizações instantaneamente ao contador</strong>.
                    Status, prazos e exigências chegam pra você sem precisar abrir nada.
                  </p>
                </div>
              </div>

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
                  <p className="text-6xl md:text-7xl font-bold tabular-nums tracking-tight text-emerald-700">
                    {fmtBRL(valorPrincipal)}
                    {isPlanoMensal && <span className="text-2xl font-normal text-slate-500 ml-1">/mês</span>}
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

          {/* Validade highlight */}
          <div className="flex items-center justify-between gap-4 px-6 py-4 rounded-xl bg-amber-500/10 border border-amber-500/30">
            <div className="flex items-center gap-3">
              <AlertCircle className="h-5 w-5 text-amber-300" />
              <p className="text-sm">
                Esta proposta expira em{' '}
                <strong className="text-amber-200">
                  {expiracao.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}
                </strong>
                {diasParaExpirar <= 5 && (
                  <span className="ml-2 text-amber-300 font-bold">
                    ({diasParaExpirar} {diasParaExpirar === 1 ? 'dia' : 'dias'})
                  </span>
                )}
              </p>
            </div>
            <span className="hidden md:inline text-[10px] font-mono text-emerald-200/60">
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
                <img src={logoDaniDark} alt="dani.ai" className="h-4 object-contain" />
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
          <p className="text-sm text-emerald-200/60 leading-relaxed mb-10">
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
                onClick={() => setConfirmOpen(true)}
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
                className="text-[11px] text-emerald-200/40 hover:text-emerald-100/80 underline-offset-2 hover:underline transition-colors"
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

          <p className="text-[11px] text-emerald-200/40 mt-12 flex items-center justify-center gap-1.5">
            <Lock className="h-3 w-3" />
            Documento gerado pela plataforma Trevo Engine ·  PROP-{String(orc.numero).padStart(4, '0')}
          </p>
        </div>
      </section>

      {/* ─── FOOTER ─── */}
      <footer className="bg-slate-100 border-t border-slate-200">
        <div className="max-w-5xl mx-auto px-6 py-8 flex flex-col md:flex-row gap-6 items-center justify-between text-xs text-slate-500">
          <div className="flex items-center gap-4">
            <img src={logoTrevo} alt="Trevo Legaliza" className="h-16 w-16 object-contain opacity-90" />
            <div>
              <p className="font-bold text-slate-700">TREVO ASSESSORIA SOCIETÁRIA LTDA</p>
              <p>CNPJ 39.969.412/0001-70 · São Bernardo do Campo / SP</p>
              <p className="mt-1 text-[10px]">© Trevo Legaliza · 12 anos cuidando do societário</p>
            </div>
          </div>
          <div className="flex items-center gap-3 pl-0 md:pl-4 md:border-l border-slate-300">
            <div className="flex items-baseline">
              <img src={logoDaniDark} alt="dani.ai" className="h-10 object-contain" />
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
            <p className="text-sm text-slate-600 leading-relaxed mb-6">
              Ao confirmar, você aceita integralmente os termos da proposta e
              do contrato mestre (MSA). A equipe Trevo entrará em contato em
              até 1 hora útil pra iniciar.
            </p>
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
                Aceitar proposta
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
    </div>
  );
}

// ─── Sub-componentes ─────────────────────────────────────────────────────────

function Stat({ icon: Icon, value, label }: { icon: React.ComponentType<{ className?: string }>; value: string; label: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="shrink-0 h-11 w-11 rounded-xl bg-emerald-500/20 ring-1 ring-emerald-400/30 inline-flex items-center justify-center">
        <Icon className="h-5 w-5 text-emerald-300" />
      </div>
      <div>
        <p className="text-3xl md:text-4xl font-bold leading-none tracking-tight text-white">{value}</p>
        <p className="text-[11px] text-emerald-200/80 mt-1.5 leading-tight font-medium">{label}</p>
      </div>
    </div>
  );
}

function Diferencial({ icon: Icon, titulo, texto }: { icon: React.ComponentType<{ className?: string }>; titulo: string; texto: string }) {
  return (
    <div className="p-6 rounded-xl border border-slate-200 bg-white hover:border-emerald-300 hover:shadow-md transition-all">
      <div className="h-10 w-10 rounded-lg bg-emerald-50 inline-flex items-center justify-center mb-4">
        <Icon className="h-5 w-5 text-emerald-700" />
      </div>
      <h3 className="text-base font-bold text-slate-900 mb-2">{titulo}</h3>
      <p className="text-sm text-slate-600 leading-relaxed">{texto}</p>
    </div>
  );
}

function CardEscopo({ titulo, itens, corChip, labelInativos = 'Fora de escopo' }: { titulo: string; itens: ItemEditavel[]; corChip: string; labelInativos?: string }) {
  const ativos = itens.filter((i) => i.ativo);
  const inativos = itens.filter((i) => !i.ativo);
  return (
    <div className="bg-white rounded-xl border p-6">
      <p className="text-[10px] uppercase tracking-[0.2em] text-emerald-700 font-bold mb-3">{titulo}</p>
      <div className="flex flex-wrap gap-2 mb-3">
        {ativos.map((it) => (
          <span key={it.id} className={`px-3 py-1.5 rounded-full text-xs font-semibold ${corChip}`}>
            {it.label}
          </span>
        ))}
      </div>
      {inativos.length > 0 && (
        <>
          <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-2 mt-4">{labelInativos}</p>
          <div className="flex flex-wrap gap-2">
            {inativos.map((it) => (
              <span key={it.id} className="px-3 py-1 rounded-full text-[11px] bg-slate-50 text-slate-400 line-through border border-slate-200">
                {it.label}
              </span>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function ComoFunciona({ numero, titulo, texto }: { numero: string; titulo: string; texto: string }) {
  return (
    <div className="relative p-6 rounded-2xl border-2 border-slate-100 hover:border-emerald-200 transition-colors">
      <p className="text-5xl font-bold text-emerald-100 leading-none mb-4">{numero}</p>
      <h3 className="text-lg font-bold text-slate-900 mb-2">{titulo}</h3>
      <p className="text-sm text-slate-600 leading-relaxed">{texto}</p>
    </div>
  );
}

// ─── Badge/Linha de vencimento (3 tipos: mensal_dia, deferimento, outros) ────
type VencProps = { tipo?: 'mensal_dia' | 'deferimento' | 'outros' | null; dia?: number | null; texto?: string | null };

function VencimentoBadge({ tipo, dia, texto }: VencProps) {
  const t = tipo || (dia ? 'mensal_dia' : null);
  if (!t) return null;
  if (t === 'mensal_dia' && !dia) return null;
  if (t === 'outros' && !texto) return null;
  return (
    <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 text-emerald-800 min-w-[170px]">
      <p className="text-[10px] uppercase tracking-wider font-bold flex items-center gap-1.5">
        <Calendar className="h-3 w-3" /> Vencimento
      </p>
      {t === 'mensal_dia' && (
        <p className="text-2xl font-bold tabular-nums mt-1">mensal · dia {dia}</p>
      )}
      {t === 'deferimento' && (
        <p className="text-base font-bold mt-1 leading-tight">No deferimento<br/><span className="text-xs font-normal text-emerald-700">do processo</span></p>
      )}
      {t === 'outros' && texto && (
        <p className="text-sm font-semibold mt-1 leading-snug">{texto}</p>
      )}
    </div>
  );
}

function VencimentoLinha({ tipo, dia, texto }: VencProps) {
  const t = tipo || (dia ? 'mensal_dia' : null);
  if (!t) return null;
  if (t === 'mensal_dia' && !dia) return null;
  if (t === 'outros' && !texto) return null;
  return (
    <div className="mt-6 pt-6 border-t border-slate-200 flex items-center gap-3">
      <Calendar className="h-5 w-5 text-emerald-700" />
      <p className="text-sm text-slate-700">
        {t === 'mensal_dia' && <>Cobrança recorrente todo dia <strong>{dia}</strong> do mês</>}
        {t === 'deferimento' && <>Vencimento <strong>no deferimento do processo</strong></>}
        {t === 'outros' && texto && <>Vencimento: <strong>{texto}</strong></>}
      </p>
    </div>
  );
}

// ─── Card destaque Dani.ai (full-width no bloco diferenciais) ────────────────
function CardDaniAi() {
  const [step, setStep] = useState(0);
  // Cicla entre mensagens da Dani: typing → mensagem 1 → typing → mensagem 2 → reinicia
  useEffect(() => {
    const seq = [
      { delay: 1800 }, // typing inicial
      { delay: 3500 }, // mostra msg 1
      { delay: 1500 }, // typing 2
      { delay: 3500 }, // mostra msg 2
    ];
    const timer = setTimeout(() => setStep((s) => (s + 1) % seq.length), seq[step].delay);
    return () => clearTimeout(timer);
  }, [step]);

  const showTyping = step === 0 || step === 2;
  const showMsg1 = step >= 1;
  const showMsg2 = step >= 3;

  return (
    <div className="relative rounded-2xl border-2 border-emerald-200 bg-gradient-to-br from-emerald-50 via-white to-emerald-50/40 p-6 md:p-8 overflow-hidden">
      {/* Decoração circular de fundo */}
      <div className="absolute -top-20 -right-20 w-64 h-64 bg-emerald-200/40 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-20 -left-20 w-64 h-64 bg-emerald-300/30 rounded-full blur-3xl pointer-events-none" />

      <div className="relative grid md:grid-cols-[1fr_280px] gap-6 items-center">
        {/* Esquerda: copy + badge */}
        <div>
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-emerald-600 text-white text-[10px] font-bold uppercase tracking-wider mb-3 shadow-sm">
            <Sparkles className="h-3 w-3" />
            Inteligência Artificial Própria
          </div>
          <h3 className="text-xl md:text-2xl font-bold text-slate-900 leading-tight mb-3 flex items-baseline flex-wrap gap-x-2">
            <span>Conheça a</span>
            <img src={logoDaniDark} alt="dani.ai" className="h-7 md:h-8 object-contain inline-block translate-y-1" />
            <span>— sua aliada que nunca dorme.</span>
          </h3>
          <p className="text-sm text-slate-600 leading-relaxed mb-4">
            <strong className="text-slate-900">Desenvolvida internamente pela Trevo</strong>, nossa IA consulta o status dos processos em tempo real
            nas <strong className="text-slate-900">Juntas Comerciais, Receita Federal, Prefeituras, Secretarias estaduais</strong> e
            demais órgãos competentes — e <strong className="text-slate-900">reporta atualizações instantaneamente ao contador</strong>.
            Sem você precisar abrir nada, sem ligação, sem &ldquo;deixa eu checar&rdquo;.
          </p>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div>
              <p className="text-lg font-bold text-emerald-700 tabular-nums">24/7</p>
              <p className="text-[10px] text-slate-500 leading-tight">Monitoramento contínuo</p>
            </div>
            <div>
              <p className="text-lg font-bold text-emerald-700 tabular-nums">&lt;30s</p>
              <p className="text-[10px] text-slate-500 leading-tight">Tempo de resposta</p>
            </div>
            <div>
              <p className="text-lg font-bold text-emerald-700 tabular-nums">0</p>
              <p className="text-[10px] text-slate-500 leading-tight">Esforço do contador</p>
            </div>
          </div>
        </div>

        {/* Direita: simulação de chat */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-lg p-4 space-y-2.5 min-h-[200px]">
          <div className="flex items-center gap-2.5 pb-2 border-b border-slate-100">
            <div className="relative shrink-0">
              <div className="h-10 w-10 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-700 inline-flex items-center justify-center shadow-sm overflow-hidden p-1.5">
                <img src={logoDaniLight} alt="dani.ai" className="h-full w-full object-contain" />
              </div>
              <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-500 border-2 border-white" />
            </div>
            <p className="text-[11px] text-emerald-700 font-semibold">online · respondendo</p>
          </div>

          {/* Mensagem 1 */}
          {showMsg1 && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg rounded-tl-none p-2.5 text-[11px] text-slate-700 leading-snug" style={{ animation: 'fade-up 0.4s ease-out both' }}>
              <p>📋 <strong>Processo de alteração #4521</strong> avançou para análise na JUCESP.</p>
              <p className="text-[9px] text-slate-400 mt-1">há 12 segundos</p>
            </div>
          )}

          {/* Mensagem 2 */}
          {showMsg2 && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg rounded-tl-none p-2.5 text-[11px] text-slate-700 leading-snug" style={{ animation: 'fade-up 0.4s ease-out both' }}>
              <p>✅ <strong>Abertura de empresa #4498</strong> deferida. CNPJ disponível.</p>
              <p className="text-[9px] text-slate-400 mt-1">há 8 segundos</p>
            </div>
          )}

          {/* Typing indicator */}
          {showTyping && (
            <div className="inline-flex items-center gap-1 px-3 py-2 bg-slate-100 rounded-full">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-600 dani-dot-1" />
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-600 dani-dot-2" />
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-600 dani-dot-3" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Mapa do Brasil animado (hero direito) ───────────────────────────────────
// Paths reais dos 27 estados (CC-BY 4.0 — VictorCazanave/svg-maps).
// Centros geográficos aproximados pro viewBox 0 0 613 639 (paths sao
// RELATIVOS, então media de numeros nao da o centro real).
const BRASIL_CENTROS: Record<string, [number, number]> = {
  AC: [90, 280],  AL: [560, 260], AP: [340, 80],   AM: [200, 200],
  BA: [430, 320], CE: [490, 200], DF: [370, 330],  ES: [490, 405],
  GO: [350, 350], MA: [400, 200], MT: [270, 290],  MS: [290, 380],
  MG: [430, 380], PA: [300, 180], PB: [550, 230],  PR: [320, 470],
  PE: [520, 240], PI: [440, 230], RJ: [450, 430],  RN: [550, 210],
  RS: [290, 560], RO: [170, 280], RR: [200, 90],   SC: [320, 520],
  SP: [370, 430], SE: [520, 280], TO: [350, 260],
};

function MapaBrasilAnimado() {
  const estadosComCentro = useMemo(() =>
    BRASIL_ESTADOS_PATHS.map((st) => ({
      id: st.id,
      d: st.d,
      cx: BRASIL_CENTROS[st.id]?.[0] ?? 300,
      cy: BRASIL_CENTROS[st.id]?.[1] ?? 300,
    })),
  []);

  // Animação: "scan" sequencial por todos os estados (cada um acende ao chegar a vez)
  const [scanIdx, setScanIdx] = useState(0);
  useEffect(() => {
    const t = setInterval(() => {
      setScanIdx((i) => (i + 1) % estadosComCentro.length);
    }, 700);
    return () => clearInterval(t);
  }, [estadosComCentro.length]);

  return (
    <div className="relative w-full max-w-[380px]">
      {/* Badge topo */}
      <div className="flex items-center justify-center gap-2 mb-3">
        <span className="relative flex h-2 w-2">
          <span className="absolute inset-0 rounded-full bg-emerald-400 opacity-75 pulse-dot" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-300" />
        </span>
        <p className="text-[10px] uppercase tracking-[0.2em] text-emerald-200 font-bold">
          Atuação Nacional
        </p>
      </div>

      {/* SVG do Brasil com glow */}
      <div className="relative aspect-[613/639]">
        {/* halo de fundo */}
        <div className="absolute inset-0 bg-emerald-500/15 blur-2xl rounded-full" />

        <svg
          viewBox="0 0 613 639"
          className="relative w-full h-full"
          xmlns="http://www.w3.org/2000/svg"
          aria-label="Mapa do Brasil destacando atuação em todos os 26 estados e Distrito Federal"
        >
          <defs>
            <linearGradient id="brasilFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10b981" stopOpacity="0.85" />
              <stop offset="55%" stopColor="#059669" stopOpacity="0.75" />
              <stop offset="100%" stopColor="#047857" stopOpacity="0.65" />
            </linearGradient>
            <linearGradient id="brasilHi" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#34d399" stopOpacity="1" />
              <stop offset="100%" stopColor="#10b981" stopOpacity="1" />
            </linearGradient>
            <filter id="brasilGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" result="b" />
              <feMerge>
                <feMergeNode in="b" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <filter id="checkGlow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="2" result="b" />
              <feMerge>
                <feMergeNode in="b" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Estados preenchidos com hover acende */}
          <g filter="url(#brasilGlow)">
            {estadosComCentro.map((st, idx) => {
              const ativo = idx === scanIdx;
              return (
                <path
                  key={`p-${st.id}`}
                  d={st.d}
                  fill={ativo ? 'url(#brasilHi)' : 'url(#brasilFill)'}
                  stroke="#a7f3d0"
                  strokeWidth={ativo ? '2.5' : '1.2'}
                  strokeLinejoin="round"
                  style={{ transition: 'fill 0.35s ease, stroke-width 0.35s ease' }}
                />
              );
            })}
          </g>

          {/* Checks pulsantes em cada estado, com delays diferentes (onda contínua) */}
          {estadosComCentro.map((st, idx) => (
            <g key={`chk-${st.id}`}>
              {/* Círculo de pulse atrás do check */}
              <circle
                cx={st.cx}
                cy={st.cy}
                r="9"
                fill="#10b981"
                opacity="0.35"
                style={{
                  animation: `pulse-dot 2.4s ease-in-out ${(idx * 0.18) % 2.4}s infinite`,
                  transformOrigin: `${st.cx}px ${st.cy}px`,
                }}
              />
              {/* Bolinha branca de fundo */}
              <circle cx={st.cx} cy={st.cy} r="6" fill="white" filter="url(#checkGlow)" />
              {/* Check verde dentro */}
              <path
                d={`M ${st.cx - 3.2} ${st.cy} l 2.2 2.4 l 4.4 -4.6`}
                stroke="#059669"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
              />
            </g>
          ))}

          {/* Anel expansivo no estado "ativo" do scan */}
          {estadosComCentro[scanIdx] && (
            <circle
              key={`ring-${scanIdx}`}
              cx={estadosComCentro[scanIdx].cx}
              cy={estadosComCentro[scanIdx].cy}
              r="6"
              fill="none"
              stroke="#34d399"
              strokeWidth="2"
              opacity="0.9"
              style={{
                animation: 'ring-expand 1s ease-out forwards',
                transformOrigin: `${estadosComCentro[scanIdx].cx}px ${estadosComCentro[scanIdx].cy}px`,
                transformBox: 'view-box',
              }}
            />
          )}
        </svg>

        {/* Indicador do estado ativo (canto direito) */}
        <div className="absolute top-2 right-2 inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-emerald-950/70 backdrop-blur border border-emerald-500/40">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inset-0 rounded-full bg-emerald-400 opacity-75 pulse-dot" />
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-300" />
          </span>
          <span className="text-[10px] font-mono font-bold text-emerald-200 tabular-nums">
            {estadosComCentro[scanIdx]?.id || '--'}
          </span>
        </div>
      </div>

      {/* Badge inferior */}
      <div className="mt-4 flex items-center justify-center gap-4">
        <div className="text-center">
          <p className="text-3xl font-bold text-emerald-300 tabular-nums leading-none">26<span className="text-emerald-400 text-xl">+1</span></p>
          <p className="text-[9px] uppercase tracking-wider text-emerald-200/70 font-bold mt-1">estados + DF</p>
        </div>
        <div className="h-10 w-px bg-emerald-500/30" />
        <div className="text-center">
          <p className="text-3xl font-bold text-emerald-300 tabular-nums leading-none">100<span className="text-xl">%</span></p>
          <p className="text-[9px] uppercase tracking-wider text-emerald-200/70 font-bold mt-1">cobertura</p>
        </div>
      </div>
    </div>
  );
}

// ─── Bloco Antes/Depois Trevo ────────────────────────────────────────────────
function BlocoAntesDepois() {
  const antes = [
    'Ligar pra Junta toda semana pra saber status',
    'Cliente liga querendo posição — você não tem',
    'Retrabalho silencioso pela falta de checklist',
    'Erro humano em DBE/contrato custa 30 dias',
    'Equipe interna sobrecarregada com burocracia',
    'Onboarding novo cliente = 1 semana parada',
  ];
  const depois = [
    'Status em tempo real na plataforma + app',
    'dani.ai reporta cada movimentação ao contador',
    'Checklist validado antes do início — zero retrabalho',
    'Esteira de especialistas + SLA contratual',
    'Equipe interna foca em fiscal/contábil de verdade',
    'Onboarding em 30 min, operação em 2 dias úteis',
  ];
  return (
    <section className="py-20 bg-white">
      <div className="max-w-5xl mx-auto px-6">
        <div className="max-w-2xl mb-10">
          <p className="text-[10px] uppercase tracking-[0.2em] text-emerald-700 font-bold mb-2">A diferença</p>
          <h2 className="text-3xl md:text-4xl font-bold text-slate-900 leading-tight">
            Como sua operação societária muda <span className="text-emerald-700">no dia 1</span>.
          </h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="rounded-2xl border-2 border-slate-200 bg-slate-50/50 p-6">
            <div className="flex items-center gap-2 mb-4">
              <div className="h-8 w-8 rounded-full bg-slate-200 inline-flex items-center justify-center">
                <X className="h-4 w-4 text-slate-600" strokeWidth={3} />
              </div>
              <p className="text-sm font-bold text-slate-700 uppercase tracking-wider">Sem Trevo</p>
            </div>
            <ul className="space-y-2.5">
              {antes.map((t, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-slate-600 leading-relaxed">
                  <span className="text-slate-400 mt-0.5">●</span>
                  <span>{t}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-2xl border-2 border-emerald-300 bg-gradient-to-br from-emerald-50 via-white to-emerald-50/40 p-6 shadow-md">
            <div className="flex items-center gap-2 mb-4">
              <div className="h-8 w-8 rounded-full bg-emerald-600 inline-flex items-center justify-center">
                <Check className="h-4 w-4 text-white" strokeWidth={3} />
              </div>
              <p className="text-sm font-bold text-emerald-700 uppercase tracking-wider">Com Trevo</p>
            </div>
            <ul className="space-y-2.5">
              {depois.map((t, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-slate-700 leading-relaxed">
                  <Check className="h-4 w-4 text-emerald-600 mt-0.5 shrink-0" strokeWidth={3} />
                  <span><strong className="text-slate-900">{t.split(' ').slice(0, 4).join(' ')}</strong>{' ' + t.split(' ').slice(4).join(' ')}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Bloco Calculadora de ROI ───────────────────────────────────────────────
function BlocoCalculadoraROI({ valorProcesso }: { valorProcesso: number }) {
  const [processosMes, setProcessosMes] = useState(8);
  const [horasPorProcesso, setHorasPorProcesso] = useState(4);
  const [valorHora, setValorHora] = useState(120);

  // Cálculos
  const horasTotaisHoje = processosMes * horasPorProcesso;
  const custoOperacionalHoje = horasTotaisHoje * valorHora;
  const custoComTrevo = processosMes * valorProcesso;
  const horasLiberadas = horasTotaisHoje;
  const novosClientesAtendiveis = Math.floor(horasLiberadas / 8); // 8h por cliente novo no mês
  const economiaMensal = Math.max(0, custoOperacionalHoje - custoComTrevo);

  return (
    <section className="py-20 bg-gradient-to-br from-emerald-50 via-white to-emerald-50/30">
      <div className="max-w-5xl mx-auto px-6">
        <div className="max-w-2xl mb-10">
          <p className="text-[10px] uppercase tracking-[0.2em] text-emerald-700 font-bold mb-2">Calculadora interativa</p>
          <h2 className="text-3xl md:text-4xl font-bold text-slate-900 leading-tight">
            Quanto seu escritório <span className="text-emerald-700">ganha</span> terceirizando?
          </h2>
          <p className="text-slate-600 mt-3 leading-relaxed">
            Ajuste os controles. O cálculo é em tempo real e considera apenas o seu volume societário.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Inputs */}
          <div className="bg-white rounded-2xl border-2 border-slate-200 p-6 space-y-5">
            <div>
              <div className="flex items-baseline justify-between mb-2">
                <label className="text-sm font-semibold text-slate-700">Processos societários por mês</label>
                <span className="text-2xl font-bold text-emerald-700 tabular-nums">{processosMes}</span>
              </div>
              <input
                type="range" min={1} max={50} step={1} value={processosMes}
                onChange={(e) => setProcessosMes(Number(e.target.value))}
                className="w-full accent-emerald-600 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-slate-400 mt-1">
                <span>1</span><span>50+</span>
              </div>
            </div>

            <div>
              <div className="flex items-baseline justify-between mb-2">
                <label className="text-sm font-semibold text-slate-700">Horas que gasta por processo</label>
                <span className="text-2xl font-bold text-emerald-700 tabular-nums">{horasPorProcesso}h</span>
              </div>
              <input
                type="range" min={1} max={16} step={1} value={horasPorProcesso}
                onChange={(e) => setHorasPorProcesso(Number(e.target.value))}
                className="w-full accent-emerald-600 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-slate-400 mt-1">
                <span>1h</span><span>16h</span>
              </div>
            </div>

            <div>
              <div className="flex items-baseline justify-between mb-2">
                <label className="text-sm font-semibold text-slate-700">Custo da hora interna (R$)</label>
                <span className="text-2xl font-bold text-emerald-700 tabular-nums">R$ {valorHora}</span>
              </div>
              <input
                type="range" min={50} max={400} step={10} value={valorHora}
                onChange={(e) => setValorHora(Number(e.target.value))}
                className="w-full accent-emerald-600 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-slate-400 mt-1">
                <span>R$ 50</span><span>R$ 400</span>
              </div>
            </div>
          </div>

          {/* Outputs */}
          <div className="bg-gradient-to-br from-emerald-700 to-emerald-900 text-white rounded-2xl p-6 shadow-2xl">
            <p className="text-[10px] uppercase tracking-[0.2em] text-emerald-200 font-bold mb-4">Seu retorno com a Trevo</p>

            <div className="space-y-4">
              <div className="flex items-baseline justify-between gap-4 pb-3 border-b border-emerald-600/40">
                <div>
                  <p className="text-[11px] uppercase tracking-wider text-emerald-200/80 font-bold">Custo operacional hoje</p>
                  <p className="text-[10px] text-emerald-200/60 mt-0.5">{horasTotaisHoje}h × R$ {valorHora}/h</p>
                </div>
                <p className="text-2xl font-bold tabular-nums text-white">{fmtBRL(custoOperacionalHoje)}</p>
              </div>

              <div className="flex items-baseline justify-between gap-4 pb-3 border-b border-emerald-600/40">
                <div>
                  <p className="text-[11px] uppercase tracking-wider text-emerald-200/80 font-bold">Custo com a Trevo</p>
                  <p className="text-[10px] text-emerald-200/60 mt-0.5">{processosMes} × {fmtBRL(valorProcesso)}/processo</p>
                </div>
                <p className="text-2xl font-bold tabular-nums text-white">{fmtBRL(custoComTrevo)}</p>
              </div>

              <div className="rounded-xl bg-emerald-500/20 ring-1 ring-emerald-400/40 p-4">
                <p className="text-[10px] uppercase tracking-[0.18em] text-emerald-200 font-bold mb-1">Economia mensal</p>
                <p className="text-4xl font-bold tabular-nums text-emerald-100">{fmtBRL(economiaMensal)}</p>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <div className="rounded-lg bg-white/10 px-3 py-2">
                  <p className="text-2xl font-bold tabular-nums">{horasLiberadas}h</p>
                  <p className="text-[10px] text-emerald-200/80 leading-tight mt-0.5">liberadas no mês</p>
                </div>
                <div className="rounded-lg bg-white/10 px-3 py-2">
                  <p className="text-2xl font-bold tabular-nums">+{novosClientesAtendiveis}</p>
                  <p className="text-[10px] text-emerald-200/80 leading-tight mt-0.5">clientes contábeis novos</p>
                </div>
              </div>
            </div>

            <p className="text-[10px] text-emerald-200/50 italic mt-4 leading-relaxed">
              Estimativa baseada em valores informados. Não inclui taxas governamentais (passantes em ambos os modelos).
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Bloco Depoimentos ──────────────────────────────────────────────────────
function BlocoDepoimentos() {
  const depoimentos = [
    {
      texto: 'A Trevo me devolveu tempo. Hoje eu não me preocupo mais com prazo de Junta, com retrabalho, com cliente cobrando posição. Eu opero, eles entregam.',
      autor: 'Ricardo M.',
      escritorio: 'Contabilidade SP · 80 clientes ativos',
      metrica: '47 processos protocolados em 2025',
    },
    {
      texto: 'Como contador, terceirizar o societário era um medo enorme. Em 60 dias com a Trevo eu já tinha confiança de fechar contrato de 6 dígitos com cliente novo. SLA real.',
      autor: 'Camila R.',
      escritorio: 'Escritório Contábil · MG',
      metrica: 'R$ 80k em novos contratos pós-Trevo',
    },
    {
      texto: 'A dani.ai mudou meu jogo. Eu sabia da movimentação no processo antes do cliente perguntar. Imagem do meu escritório subiu vários níveis.',
      autor: 'Eduardo F.',
      escritorio: 'Contábil Premium · 120 clientes',
      metrica: 'Zero ligação de cliente buscando status em 2025',
    },
  ];

  return (
    <section className="py-20 bg-slate-50">
      <div className="max-w-5xl mx-auto px-6">
        <div className="max-w-2xl mb-10">
          <p className="text-[10px] uppercase tracking-[0.2em] text-emerald-700 font-bold mb-2">Quem já confia</p>
          <h2 className="text-3xl md:text-4xl font-bold text-slate-900 leading-tight">
            Contadores que decidiram terceirizar com a gente.
          </h2>
          <p className="text-slate-600 mt-3 leading-relaxed">
            +3.800 escritórios contábeis na rede Trevo. <a href="https://www.youtube.com/watch?v=utDQxoqS1DE" target="_blank" rel="noopener noreferrer" className="text-emerald-700 hover:text-emerald-900 underline-offset-2 hover:underline font-semibold">Ver depoimentos em vídeo →</a>
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {depoimentos.map((d, i) => (
            <div key={i} className="bg-white rounded-2xl border border-slate-200 p-6 hover:border-emerald-300 hover:shadow-md transition-all flex flex-col">
              <div className="text-emerald-600 mb-3">
                <svg viewBox="0 0 24 24" fill="currentColor" className="h-6 w-6"><path d="M9.983 3v7.391c0 5.704-3.731 9.57-8.983 10.609l-.995-2.151c2.432-.917 3.995-3.638 3.995-5.849h-4v-10h9.983zm14.017 0v7.391c0 5.704-3.748 9.571-9 10.609l-.996-2.151c2.433-.917 3.996-3.638 3.996-5.849h-3.983v-10h9.983z"/></svg>
              </div>
              <p className="text-sm text-slate-700 leading-relaxed flex-1">{d.texto}</p>
              <div className="mt-5 pt-4 border-t border-slate-100">
                <p className="text-sm font-bold text-slate-900">{d.autor}</p>
                <p className="text-[11px] text-slate-500 mt-0.5">{d.escritorio}</p>
                <p className="text-[10px] uppercase tracking-wider text-emerald-700 font-bold mt-2">★ {d.metrica}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Modal Recusar com Motivo ───────────────────────────────────────────────
function ModalRecusar({ token, numero, onClose, onRecusado }: {
  token: string;
  numero: number;
  onClose: () => void;
  onRecusado: () => void;
}) {
  const [motivo, setMotivo] = useState<'preco' | 'escopo' | 'timing' | 'outro' | null>(null);
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const motivos: { id: 'preco' | 'escopo' | 'timing' | 'outro'; label: string; desc: string }[] = [
    { id: 'preco', label: 'Preço', desc: 'Acima do meu orçamento agora' },
    { id: 'escopo', label: 'Escopo', desc: 'Não bate com o que preciso' },
    { id: 'timing', label: 'Momento', desc: 'Hoje não é o melhor momento' },
    { id: 'outro', label: 'Outro motivo', desc: 'Explico no campo abaixo' },
  ];

  const handleEnviar = async () => {
    if (!motivo) return;
    setEnviando(true);
    setErro(null);
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/recusar_proposta_terceirizacao`, {
        method: 'POST',
        headers: anonHeaders,
        body: JSON.stringify({ p_token: token, p_motivo: motivo, p_texto: texto || null }),
      });
      const data = await res.json();
      if (!res.ok || data?.ok === false) {
        throw new Error(data?.error || 'Erro ao registrar recusa');
      }
      onRecusado();
    } catch (e) {
      setErro('Não conseguimos registrar agora. Tente recarregar a página.');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
      <div className="bg-white rounded-2xl max-w-md w-full p-7 shadow-2xl">
        <div className="flex items-center gap-3 mb-4">
          <div className="h-11 w-11 rounded-full bg-slate-100 inline-flex items-center justify-center">
            <X className="h-5 w-5 text-slate-500" strokeWidth={3} />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-900">Recusar proposta</h3>
            <p className="text-xs text-slate-500">PROP-{String(numero).padStart(4, '0')}</p>
          </div>
        </div>
        <p className="text-sm text-slate-600 leading-relaxed mb-4">
          Pode dizer o motivo? Ajuda a gente a evoluir e a entender se faz sentido revisitar a proposta.
        </p>

        <div className="space-y-2 mb-4">
          {motivos.map((m) => (
            <button
              key={m.id}
              onClick={() => setMotivo(m.id)}
              className={`w-full text-left p-3 rounded-lg border-2 transition-all ${
                motivo === m.id
                  ? 'border-emerald-500 bg-emerald-50/60'
                  : 'border-slate-200 hover:border-slate-300 bg-white'
              }`}
            >
              <p className={`text-sm font-bold ${motivo === m.id ? 'text-emerald-700' : 'text-slate-900'}`}>{m.label}</p>
              <p className="text-[11px] text-slate-500 mt-0.5">{m.desc}</p>
            </button>
          ))}
        </div>

        <textarea
          value={texto}
          onChange={(e) => setTexto(e.target.value.slice(0, 500))}
          placeholder="Comentário opcional — o que faria você reconsiderar?"
          rows={3}
          maxLength={500}
          className="w-full text-sm border border-slate-200 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-transparent resize-none"
        />
        <p className="text-[10px] text-slate-400 text-right mt-1">{texto.length}/500</p>

        {erro && <p className="text-xs text-red-600 mt-2">{erro}</p>}

        <div className="flex gap-2 mt-5">
          <button
            onClick={onClose}
            disabled={enviando}
            className="flex-1 px-4 py-2.5 rounded-lg border border-slate-200 text-slate-700 text-sm font-semibold hover:bg-slate-50 disabled:opacity-50"
          >
            Voltar
          </button>
          <button
            onClick={handleEnviar}
            disabled={!motivo || enviando}
            className="flex-1 px-4 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-900 text-white text-sm font-bold inline-flex items-center justify-center gap-2 disabled:opacity-40"
          >
            {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Confirmar recusa
          </button>
        </div>
      </div>
    </div>
  );
}
