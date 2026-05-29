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
  Check, ShieldCheck,
  Clock, Users, Target, Layers, Sparkles, ChevronDown,
  Download,
} from 'lucide-react';
import { SUPABASE_URL } from '@/integrations/supabase/client';
import {
  PLANOS, REGRAS_RAPIDAS_CATALOGO,
  fmtBRL,
} from '@/lib/terceirizacao-engine';
import logoTrevo from '@/assets/logo-trevo.png';
import { anonHeaders, CONFETTI_CORES } from './terceirizacao/constants';
import type { OrcTerc } from './terceirizacao/types';
import { parseVideoUrl } from './terceirizacao/videoUtils';
import { Stat } from './terceirizacao/atoms';
import { MapaBrasilAnimado } from './terceirizacao/MapaBrasilAnimado';
import { BlocoAntesDepois } from './terceirizacao/BlocoAntesDepois';
import { BlocoCalculadoraROI } from './terceirizacao/BlocoCalculadoraROI';
import { BlocoDepoimentos } from './terceirizacao/BlocoDepoimentos';
import { ModalUpsellMensal } from './terceirizacao/ModalUpsellMensal';
import { ModalRecusar } from './terceirizacao/ModalRecusar';
import { ModalConfirmarAceite } from './terceirizacao/ModalConfirmarAceite';
import { TelaRecusado } from './terceirizacao/TelaRecusado';
import { TelaSucesso } from './terceirizacao/TelaSucesso';
import { BlocoVideoPodcast } from './terceirizacao/BlocoVideoPodcast';
import { BlocoDiferenciais } from './terceirizacao/BlocoDiferenciais';
import { BlocoComoFunciona } from './terceirizacao/BlocoComoFunciona';
import { BlocoClausulasObservacoes } from './terceirizacao/BlocoClausulasObservacoes';
import { BlocoEscopo } from './terceirizacao/BlocoEscopo';
import { BlocoCondicoesFinanceiras } from './terceirizacao/BlocoCondicoesFinanceiras';
import { CtaFinal } from './terceirizacao/CtaFinal';
import { FooterLanding } from './terceirizacao/FooterLanding';

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
    return <TelaRecusado />;
  }

  // ─── Tela de sucesso (já aceito + ainda não voltou pra landing) ─────────
  if (statusLocal === 'aceito' && !voltouAposAceite) {
    return (
      <TelaSucesso
        numero={orc.numero}
        prospectNome={orc.prospect_nome}
        pdfUrl={pdfUrl}
        onVoltarParaLanding={() => {
          setVoltouAposAceite(true);
          setConfettiAtivo(true);
          window.setTimeout(() => setConfettiAtivo(false), 4500);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
      />
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
      {video && <BlocoVideoPodcast video={video} />}

      {/* ─── DIFERENCIAIS ─── */}
      <BlocoDiferenciais />

      {/* ─── ANTES vs DEPOIS TREVO ─── */}
      <BlocoAntesDepois />

      {/* ─── CALCULADORA ROI ─── */}
      <BlocoCalculadoraROI valorProcesso={valorPrincipal} />

      {/* ─── ESCOPO CUSTOMIZADO ─── */}
      <BlocoEscopo servicos={servicos} naturezas={naturezas} inclusos={inclusos} />

      {/* ─── CONDIÇÕES FINANCEIRAS ─── */}
      <BlocoCondicoesFinanceiras
        modalidadeLabel={modalidadeCfg?.label || (isPrecoPorTipo ? 'Preço por tipo de processo' : 'Customizada')}
        isPrecoPorTipo={isPrecoPorTipo}
        isPlanoMensal={isPlanoMensal}
        valorPrincipal={valorPrincipal}
        valorAbertura={orc.terc_valor_abertura}
        precosPorTipo={precosPorTipo}
        vencimento={{
          tipo: orc.terc_vencimento_tipo,
          dia: orc.terc_dia_pagamento,
          texto: orc.terc_vencimento_outros_texto,
        }}
        expiracao={expiracao}
        diasParaExpirar={diasParaExpirar}
        numero={orc.numero}
      />

      {/* ─── COMO FUNCIONA ─── */}
      <BlocoComoFunciona />

      {/* ─── CLÁUSULAS + OBSERVAÇÕES ─── */}
      <BlocoClausulasObservacoes regras={regrasObjetos} observacoes={orc.terc_observacoes_publicas} />

      {/* ─── DEPOIMENTOS ─── */}
      <BlocoDepoimentos />

      {/* ─── VINCULAÇÃO + CTA FINAL ─── */}
      <CtaFinal
        numero={orc.numero}
        statusLocal={statusLocal}
        aceitando={aceitando}
        pdfUrl={pdfUrl}
        preExistingPdfUrl={orc.terc_pdf_url}
        onSolicitarAceite={() => {
          // 27/05 noite: se modalidade=avulso, abre upsell primeiro
          if (orc.terc_modalidade === 'avulso') {
            setUpsellOpen(true);
          } else {
            setConfirmOpen(true);
          }
        }}
        onAbrirRecusa={() => setRecusarOpen(true)}
      />

      {/* ─── FOOTER ─── */}
      <FooterLanding />

      {/* ─── MODAL CONFIRMAR ACEITE ─── */}
      {confirmOpen && (
        <ModalConfirmarAceite
          numero={orc.numero}
          aceitando={aceitando}
          onCancelar={() => setConfirmOpen(false)}
          onConfirmar={handleAceitar}
        />
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
