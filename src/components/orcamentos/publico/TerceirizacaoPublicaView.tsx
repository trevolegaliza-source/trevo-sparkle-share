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
import { useMemo, useState } from 'react';
import {
  Loader2, Check, ShieldCheck, MessageCircle, FileText, Building2,
  Clock, Zap, Users, Award, Target, Layers, ArrowRight, Sparkles, ChevronDown,
  Lock, Calendar, AlertCircle, CheckCircle2, X,
} from 'lucide-react';
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from '@/integrations/supabase/client';
import {
  type ItemEditavel, type Modalidade, type PrecosPorTipo,
  PLANOS, REGRAS_RAPIDAS_CATALOGO, TIPO_PROCESSO_PRECO_LABELS,
  fmtBRL,
} from '@/lib/terceirizacao-engine';
import logoTrevo from '@/assets/logo-trevo.png';

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
  terc_precos_por_tipo?: PrecosPorTipo | null;
  terc_regras_rapidas_ativas?: string[] | null;
  terc_observacoes_publicas?: string | null;
  terc_video_url?: string | null;
  terc_pdf_url?: string | null;
  validade_dias: number;
  created_at: string;
}

// ─── Helper de detecção de plataforma de vídeo ───────────────────────────────
function parseVideoUrl(url: string): { type: 'youtube' | 'vimeo' | 'mp4' | 'iframe'; embed: string } | null {
  if (!url || !url.trim()) return null;
  const trimmed = url.trim();
  // YouTube
  const yt = trimmed.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  if (yt) return { type: 'youtube', embed: `https://www.youtube.com/embed/${yt[1]}?rel=0&modestbranding=1` };
  // Vimeo
  const vm = trimmed.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  if (vm) return { type: 'vimeo', embed: `https://player.vimeo.com/video/${vm[1]}?title=0&byline=0&portrait=0` };
  // MP4/WebM/OGG direto
  if (/\.(mp4|webm|ogg|m4v)(\?.*)?$/i.test(trimmed)) return { type: 'mp4', embed: trimmed };
  // fallback: iframe genérico
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

  // ─── Tela de sucesso (já aceito) ─────────────────────────────────────────
  if (statusLocal === 'aceito') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-emerald-50/60 flex items-center justify-center p-4">
        <div className="max-w-md text-center space-y-5">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-emerald-100 ring-8 ring-emerald-50">
            <Check className="h-10 w-10 text-emerald-600" strokeWidth={3} />
          </div>
          <h1 className="text-3xl font-bold text-slate-900">Proposta aceita!</h1>
          <p className="text-slate-600 leading-relaxed">
            Excelente decisão. A equipe Trevo recebeu seu aceite e entrará em
            contato pelo WhatsApp em até 1 hora útil para iniciar o onboarding
            e dar acesso à plataforma.
          </p>
          <div className="bg-white rounded-lg border p-4 text-left space-y-2">
            <p className="text-xs font-mono text-muted-foreground">PROP-{String(orc.numero).padStart(4, '0')}</p>
            <p className="text-sm font-semibold text-slate-900">{orc.prospect_nome}</p>
          </div>
          {orc.terc_pdf_url ? (
            <a
              href={orc.terc_pdf_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-5 py-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold shadow-lg hover:shadow-xl transition-all"
            >
              <FileText className="h-4 w-4" />
              Baixar Proposta + Contrato (PDF)
            </a>
          ) : (
            <p className="text-xs text-muted-foreground italic">
              O PDF da proposta + contrato está sendo gerado e ficará disponível em alguns segundos.
              Atualize a página em ~30s.
            </p>
          )}
        </div>
      </div>
    );
  }

  // ─── HERO ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-50 font-sans">
      <style>{`
        @keyframes float-pulse { 0%,100% { transform: translateY(0); opacity: .4; } 50% { transform: translateY(-8px); opacity: .8; } }
        .float-pulse { animation: float-pulse 3s ease-in-out infinite; }
        .grain { background-image: radial-gradient(rgba(255,255,255,0.03) 1px, transparent 1px); background-size: 4px 4px; }
      `}</style>

      <section className="relative bg-gradient-to-br from-emerald-950 via-emerald-900 to-slate-900 text-white overflow-hidden">
        <div className="absolute inset-0 grain pointer-events-none" />
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-emerald-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 pointer-events-none" />

        {/* Header */}
        <div className="relative max-w-5xl mx-auto px-6 pt-8 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <img src={logoTrevo} alt="Trevo Legaliza" className="h-20 w-20 md:h-24 md:w-24 object-contain drop-shadow-2xl" />
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

      {/* ─── VÍDEO (se houver) ─── */}
      {video && (
        <section className="py-16 md:py-20 bg-gradient-to-b from-emerald-950 to-slate-50">
          <div className="max-w-4xl mx-auto px-6">
            <div className="text-center mb-8">
              <p className="text-[10px] uppercase tracking-[0.2em] text-emerald-700 font-bold mb-2">
                Conheça a Trevo em 2 minutos
              </p>
              <h2 className="text-2xl md:text-3xl font-bold text-slate-900 leading-tight">
                Quem é, como atende, por que confiar.
              </h2>
            </div>
            <div className="relative rounded-2xl overflow-hidden shadow-2xl bg-black aspect-video">
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
            </div>
          </div>
        </section>
      )}

      {/* ─── DIFERENCIAIS ─── */}
      <section className="py-20 bg-white">
        <div className="max-w-5xl mx-auto px-6">
          <div className="max-w-2xl mb-12">
            <p className="text-[10px] uppercase tracking-[0.2em] text-emerald-700 font-bold mb-2">Por que a Trevo</p>
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
              texto="Do plano básico ao enterprise, o modelo acompanha o crescimento do seu escritório sem precisar contratar um departamento societário interno."
            />
          </div>
        </div>
      </section>

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
            <CardEscopo titulo="Serviços Societários" itens={servicos} corChip="bg-slate-900 text-white border-slate-900" />
            <CardEscopo titulo="Natureza Jurídica Atendida" itens={naturezas} corChip="bg-emerald-600 text-white border-emerald-600" />
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
              {inclusos.map((it) => (
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
                {orc.terc_dia_pagamento && (
                  <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 text-emerald-800">
                    <p className="text-[10px] uppercase tracking-wider font-bold flex items-center gap-1.5">
                      <Calendar className="h-3 w-3" /> Vencimento mensal
                    </p>
                    <p className="text-2xl font-bold tabular-nums mt-1">dia {orc.terc_dia_pagamento}</p>
                  </div>
                )}
              </div>

              {orc.terc_valor_abertura && orc.terc_valor_abertura > 0 && (
                <div className="mt-6 pt-6 border-t border-slate-200 grid grid-cols-2 gap-6">
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold mb-1">Abertura de empresa</p>
                    <p className="text-2xl font-bold tabular-nums text-slate-900">{fmtBRL(orc.terc_valor_abertura)}</p>
                    <p className="text-[11px] text-slate-500">por processo</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold mb-1">Demais processos</p>
                    <p className="text-2xl font-bold tabular-nums text-slate-900">{fmtBRL(valorPrincipal)}</p>
                    <p className="text-[11px] text-slate-500">alteração / baixa / transformação</p>
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
              {orc.terc_dia_pagamento && (
                <div className="mt-6 pt-6 border-t border-slate-200 flex items-center gap-3">
                  <Calendar className="h-5 w-5 text-emerald-700" />
                  <p className="text-sm text-slate-700">
                    Cobrança recorrente todo dia <strong>{orc.terc_dia_pagamento}</strong> do mês
                  </p>
                </div>
              )}
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

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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
          </div>
        </div>
      </section>

      {/* ─── CLÁUSULAS + OBSERVAÇÕES ─── */}
      {(regrasObjetos.length > 0 || orc.terc_observacoes_publicas) && (
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

            {orc.terc_observacoes_publicas && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-5">
                <p className="text-[10px] uppercase tracking-wider font-bold text-amber-700 mb-2">
                  Observações específicas desta proposta
                </p>
                <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">
                  {orc.terc_observacoes_publicas}
                </p>
              </div>
            )}
          </div>
        </section>
      )}

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
            <button
              onClick={() => setConfirmOpen(true)}
              disabled={aceitando}
              className="px-8 py-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-emerald-950 text-base font-bold inline-flex items-center justify-center gap-2 transition-all shadow-xl hover:shadow-2xl hover:-translate-y-0.5 disabled:opacity-50"
            >
              <Check className="h-5 w-5" strokeWidth={3} />
              Aceitar proposta
              <ArrowRight className="h-4 w-4" />
            </button>
            <a
              href="https://wa.me/5511934927001?text=Olá!%20Tenho%20uma%20dúvida%20sobre%20a%20proposta%20comercial."
              target="_blank"
              rel="noopener noreferrer"
              className="px-6 py-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/20 text-white text-base font-semibold inline-flex items-center justify-center gap-2 transition-all"
            >
              <MessageCircle className="h-4 w-4" />
              Tirar dúvidas no WhatsApp
            </a>
          </div>

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
        <div className="max-w-5xl mx-auto px-6 py-8 flex flex-col md:flex-row gap-4 items-center justify-between text-xs text-slate-500">
          <div className="flex items-center gap-4">
            <img src={logoTrevo} alt="Trevo" className="h-14 w-14 object-contain opacity-80" />
            <div>
              <p className="font-bold text-slate-700">TREVO ASSESSORIA SOCIETÁRIA LTDA</p>
              <p>CNPJ 39.969.412/0001-70 · São Bernardo do Campo / SP</p>
            </div>
          </div>
          <p className="text-[10px]">© Trevo Legaliza · 12 anos cuidando do societário</p>
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
    </div>
  );
}

// ─── Sub-componentes ─────────────────────────────────────────────────────────

function Stat({ icon: Icon, value, label }: { icon: React.ComponentType<{ className?: string }>; value: string; label: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className="shrink-0 h-9 w-9 rounded-lg bg-emerald-500/20 inline-flex items-center justify-center">
        <Icon className="h-4.5 w-4.5 text-emerald-300" />
      </div>
      <div>
        <p className="text-2xl md:text-3xl font-bold leading-none tracking-tight">{value}</p>
        <p className="text-[10px] text-emerald-200/70 mt-1 leading-tight">{label}</p>
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

function CardEscopo({ titulo, itens, corChip }: { titulo: string; itens: ItemEditavel[]; corChip: string }) {
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
          <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-2 mt-4">Fora de escopo</p>
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
