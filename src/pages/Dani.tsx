/**
 * Página dedicada da dani.ai — landing pública independente.
 * Rota: /dani (sem auth, sem token).
 *
 * 27/05/2026 (noite, autônomo) — feature #14 da auditoria.
 *
 * Objetivo: vender a IA Dani como diferencial comercial autônomo. Asset
 * compartilhável (link do WhatsApp), separado da proposta personalizada.
 */
import { useEffect, useMemo, useState } from 'react';
import {
  Sparkles, Bot, Zap, Eye, Clock, MessageCircle, Check,
  Building2, Landmark, FileSearch, Bell, ArrowRight, Shield,
} from 'lucide-react';
import logoTrevo from '@/assets/logo-trevo.png';
import logoDaniLight from '@/assets/dani-light.png';
import logoDaniDark from '@/assets/dani-dark.png';

export default function Dani() {
  // SEO dinâmico: title + og tags pra /dani (SPA não tem SSR — setamos no client)
  useEffect(() => {
    const prev = {
      title: document.title,
      ogTitle: document.querySelector('meta[property="og:title"]')?.getAttribute('content'),
      ogDesc: document.querySelector('meta[property="og:description"]')?.getAttribute('content'),
    };
    document.title = 'dani.ai — IA que monitora processos societários · Trevo Legaliza';
    const setMeta = (sel: string, val: string) => {
      const el = document.querySelector(sel);
      if (el) el.setAttribute('content', val);
    };
    setMeta('meta[property="og:title"]', 'dani.ai — IA que monitora processos societários');
    setMeta('meta[name="twitter:title"]', 'dani.ai — IA que monitora processos societários');
    setMeta('meta[property="og:description"]',
      'A IA proprietária da Trevo Legaliza consulta Juntas, Receita Federal, Prefeituras e demais órgãos competentes em tempo real — e reporta ao contador a cada movimentação.');
    setMeta('meta[name="twitter:description"]',
      'A IA proprietária da Trevo Legaliza consulta Juntas, Receita Federal, Prefeituras e demais órgãos competentes em tempo real — e reporta ao contador a cada movimentação.');
    setMeta('meta[name="description"]',
      'A IA proprietária da Trevo Legaliza consulta Juntas, Receita Federal, Prefeituras e demais órgãos competentes em tempo real — e reporta ao contador a cada movimentação.');
    return () => {
      if (prev.title) document.title = prev.title;
      if (prev.ogTitle) setMeta('meta[property="og:title"]', prev.ogTitle);
      if (prev.ogDesc) setMeta('meta[property="og:description"]', prev.ogDesc);
    };
  }, []);

  // Anima o chat simulado em loop (mesmo padrão da landing principal)
  const [chatStep, setChatStep] = useState(0);
  useEffect(() => {
    const seq = [1800, 3500, 1500, 3500, 1500, 3500];
    const timer = setTimeout(() => setChatStep((s) => (s + 1) % seq.length), seq[chatStep]);
    return () => clearTimeout(timer);
  }, [chatStep]);

  const orgaos = useMemo(() => [
    { icon: Building2, nome: 'Juntas Comerciais', cobertura: '27 estados + DF' },
    { icon: Landmark, nome: 'Receita Federal', cobertura: 'CNPJ, DBE, eSocial' },
    { icon: FileSearch, nome: 'Prefeituras', cobertura: 'IM, alvará, regularização' },
    { icon: Shield, nome: 'Sefaz e órgãos estaduais', cobertura: 'IE, regularidade fiscal' },
  ], []);

  return (
    <div className="min-h-screen bg-slate-50 font-sans">
      <style>{`
        @keyframes ts-fade-up { from { transform: translateY(8px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        .d-fade-up { animation: ts-fade-up .6s ease-out both; }
        @keyframes d-pulse-dot { 0%,100% { transform: scale(1); opacity: .9; } 50% { transform: scale(1.4); opacity: .5; } }
        .d-pulse-dot { animation: d-pulse-dot 2s ease-in-out infinite; }
        @keyframes d-dot-typing { 0%, 60%, 100% { transform: translateY(0); opacity: .4; } 30% { transform: translateY(-4px); opacity: 1; } }
        .d-dot-1 { animation: d-dot-typing 1.4s ease-in-out infinite; }
        .d-dot-2 { animation: d-dot-typing 1.4s ease-in-out 0.2s infinite; }
        .d-dot-3 { animation: d-dot-typing 1.4s ease-in-out 0.4s infinite; }
        .d-grain { background-image: radial-gradient(rgba(255,255,255,0.03) 1px, transparent 1px); background-size: 4px 4px; }
        @media (prefers-reduced-motion: reduce) {
          .d-fade-up, .d-pulse-dot, .d-dot-1, .d-dot-2, .d-dot-3 { animation: none !important; }
        }
      `}</style>

      {/* ─── HERO ─── */}
      <section className="relative bg-gradient-to-br from-emerald-950 via-emerald-900 to-slate-900 text-white overflow-hidden">
        <div className="absolute inset-0 d-grain pointer-events-none" />
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-emerald-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 pointer-events-none" />

        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 pt-6 sm:pt-8 flex items-center justify-between gap-3">
          <a href="/" className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
            <img src={logoTrevo} alt="Trevo Legaliza" className="h-12 w-12 sm:h-16 sm:w-16 object-contain drop-shadow-2xl shrink-0" />
            <div className="min-w-0">
              <p className="text-xs sm:text-sm font-bold tracking-tight truncate">TREVO LEGALIZA</p>
              <p className="text-[10px] sm:text-[11px] text-emerald-200/80 truncate">12 anos cuidando do societário</p>
            </div>
          </a>
        </div>

        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 py-16 md:py-20">
          <div className="grid md:grid-cols-[1fr_320px] gap-10 items-center">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 mb-6 d-fade-up">
                <Sparkles className="h-3.5 w-3.5 text-emerald-300" />
                <p className="text-[11px] uppercase tracking-[0.2em] text-emerald-200 font-semibold">Inteligência Artificial Proprietária Trevo</p>
              </div>

              <h1 className="text-3xl sm:text-4xl md:text-6xl font-bold leading-[1.05] tracking-tight d-fade-up" style={{ animationDelay: '0.1s' }}>
                Conheça a{' '}
                <img src={logoDaniLight} alt="dani.ai" className="inline-block h-10 sm:h-12 md:h-16 object-contain -mb-1 sm:-mb-2 md:-mb-3 mx-1" />
              </h1>

              <p className="text-base sm:text-lg md:text-xl text-emerald-100/90 leading-relaxed mt-6 d-fade-up" style={{ animationDelay: '0.2s' }}>
                A IA que <strong className="text-white">consulta órgãos públicos em tempo real</strong> e <strong className="text-white">reporta ao contador</strong> a cada movimentação — sem você precisar abrir nada.
              </p>

              <p className="text-sm text-emerald-200/80 mt-4 leading-relaxed d-fade-up" style={{ animationDelay: '0.3s' }}>
                Desenvolvida internamente pela Trevo. Disponível só pra escritórios contábeis parceiros.
              </p>

              <div className="mt-10 flex flex-col sm:flex-row gap-3 items-start sm:items-center d-fade-up" style={{ animationDelay: '0.4s' }}>
                <a
                  href="https://wa.me/5511934927001?text=Ol%C3%A1!%20Vi%20a%20p%C3%A1gina%20da%20dani.ai%20e%20quero%20saber%20como%20ter%20isso%20no%20meu%20escrit%C3%B3rio."
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-6 py-3.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-emerald-950 text-base font-bold inline-flex items-center justify-center gap-2 transition-all shadow-xl min-h-[44px]"
                >
                  <MessageCircle className="h-5 w-5" />
                  Quero a dani no meu escritório
                  <ArrowRight className="h-4 w-4" />
                </a>
                <a
                  href="#como-funciona"
                  className="px-5 py-3 text-sm font-semibold text-emerald-200 hover:text-white transition-colors min-h-[44px] inline-flex items-center"
                >
                  Ver como funciona ↓
                </a>
              </div>
            </div>

            {/* Chat simulado lateral */}
            <div className="hidden md:block">
              <ChatLive step={chatStep} />
            </div>
          </div>
        </div>

        {/* Stats bar */}
        <div className="relative border-t border-emerald-800/60 bg-emerald-950/40 backdrop-blur">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 grid grid-cols-2 md:grid-cols-4 gap-6">
            <Stat icon={Bot} value="24/7" label="Monitoramento contínuo" />
            <Stat icon={Zap} value="<30s" label="Tempo médio de resposta" />
            <Stat icon={Eye} value="27+1" label="Estados + DF cobertos" />
            <Stat icon={Bell} value="100%" label="Notificações automáticas" />
          </div>
        </div>
      </section>

      {/* ─── COMO FUNCIONA ─── */}
      <section id="como-funciona" className="py-16 md:py-20 bg-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="max-w-2xl mb-12">
            <p className="text-[11px] uppercase tracking-[0.2em] text-emerald-700 font-bold mb-2">Como funciona</p>
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-slate-900 leading-tight">
              A dani trabalha enquanto você dorme.
            </h2>
            <p className="text-slate-600 mt-4 leading-relaxed">
              Nada de planilha. Nada de ligação pra Junta. Nada de "deixa eu checar".
              A dani monitora os portais oficiais e te avisa quando algo muda — em tempo real.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <PassoCard
              numero="01"
              icone={Eye}
              titulo="Monitora"
              texto="A dani roda buscas programadas nos portais das Juntas, Receita Federal, prefeituras e demais órgãos competentes — 24/7, sem pausa, sem falha humana."
            />
            <PassoCard
              numero="02"
              icone={FileSearch}
              titulo="Detecta"
              texto="Cada movimentação no processo (deferimento, exigência, alteração, mudança de status) é capturada e classificada por relevância pelo modelo de IA proprietário."
            />
            <PassoCard
              numero="03"
              icone={Bell}
              titulo="Reporta"
              texto="Notificação push imediata no app Trevo + e-mail/WhatsApp pro contador. O cliente final do contador nem precisa perguntar — você já sabe antes."
            />
          </div>
        </div>
      </section>

      {/* ─── ÓRGÃOS MONITORADOS ─── */}
      <section className="py-16 md:py-20 bg-gradient-to-br from-emerald-50 via-white to-emerald-50/40">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="max-w-2xl mb-10">
            <p className="text-[11px] uppercase tracking-[0.2em] text-emerald-700 font-bold mb-2">Cobertura</p>
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-slate-900 leading-tight">
              Quais órgãos a dani monitora.
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {orgaos.map((o) => (
              <div key={o.nome} className="flex items-start gap-4 p-5 rounded-xl border border-slate-200 bg-white hover:border-emerald-300 hover:shadow-md transition-all">
                <div className="h-11 w-11 rounded-lg bg-emerald-50 inline-flex items-center justify-center shrink-0">
                  <o.icon className="h-5 w-5 text-emerald-700" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">{o.nome}</h3>
                  <p className="text-sm text-slate-600 mt-1">{o.cobertura}</p>
                </div>
              </div>
            ))}
          </div>

          <p className="text-xs text-slate-500 mt-6 leading-relaxed">
            Estamos adicionando novos órgãos continuamente. Se seu processo depende de algum específico, a Trevo
            avalia inclusão sob demanda — fale com a gente.
          </p>
        </div>
      </section>

      {/* ─── O QUE MUDA NO DIA-A-DIA ─── */}
      <section className="py-16 md:py-20 bg-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="max-w-2xl mb-10">
            <p className="text-[11px] uppercase tracking-[0.2em] text-emerald-700 font-bold mb-2">O que muda</p>
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-slate-900 leading-tight">
              Do "deixa eu checar" pro <span className="text-emerald-700">"já te avisei"</span>.
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="rounded-2xl border-2 border-slate-200 bg-slate-50/50 p-6">
              <p className="text-xs uppercase tracking-wider text-slate-600 font-bold mb-4">Sem a dani</p>
              <ul className="space-y-2.5 text-sm text-slate-700">
                <li className="flex items-start gap-2"><span className="text-slate-400 mt-0.5">●</span><span>Cliente liga 3-4x/semana querendo status</span></li>
                <li className="flex items-start gap-2"><span className="text-slate-400 mt-0.5">●</span><span>Você gasta ~12h/mês ligando pra Junta</span></li>
                <li className="flex items-start gap-2"><span className="text-slate-400 mt-0.5">●</span><span>Exigência só descoberta no F5 da Junta</span></li>
                <li className="flex items-start gap-2"><span className="text-slate-400 mt-0.5">●</span><span>Cliente reclama de "não ter notícia"</span></li>
              </ul>
            </div>
            <div className="rounded-2xl border-2 border-emerald-300 bg-gradient-to-br from-emerald-50 to-white p-6 shadow-md">
              <p className="text-xs uppercase tracking-wider text-emerald-700 font-bold mb-4">Com a dani</p>
              <ul className="space-y-2.5 text-sm text-slate-800">
                <li className="flex items-start gap-2"><Check className="h-4 w-4 text-emerald-600 mt-0.5 shrink-0" strokeWidth={3} /><span>Zero ligação de cliente buscando posição</span></li>
                <li className="flex items-start gap-2"><Check className="h-4 w-4 text-emerald-600 mt-0.5 shrink-0" strokeWidth={3} /><span>12h/mês liberadas pra contabilidade</span></li>
                <li className="flex items-start gap-2"><Check className="h-4 w-4 text-emerald-600 mt-0.5 shrink-0" strokeWidth={3} /><span>Exigência chega ao contador em &lt;30s</span></li>
                <li className="flex items-start gap-2"><Check className="h-4 w-4 text-emerald-600 mt-0.5 shrink-0" strokeWidth={3} /><span>Cliente impressionado: "vocês são proativos"</span></li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ─── B2B EXCLUSIVO ─── */}
      <section className="py-16 md:py-20 bg-emerald-950 text-white relative overflow-hidden">
        <div className="absolute inset-0 d-grain pointer-events-none" />
        <div className="relative max-w-3xl mx-auto px-4 sm:px-6 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 mb-6">
            <Shield className="h-3.5 w-3.5 text-emerald-300" />
            <p className="text-[11px] uppercase tracking-[0.2em] text-emerald-200 font-semibold">Acesso exclusivo</p>
          </div>
          <h2 className="text-2xl sm:text-3xl md:text-5xl font-bold leading-tight mb-6">
            A dani é <span className="text-emerald-300">só pra escritórios contábeis</span>.
          </h2>
          <p className="text-emerald-100/80 leading-relaxed mb-2">
            A Trevo não atende cliente final direto. A dani é parte do pacote de terceirização societária
            entregue exclusivamente a escritórios parceiros. <strong className="text-white">Sua marca, nossa infraestrutura.</strong>
          </p>
          <p className="text-sm text-emerald-200/80 leading-relaxed mb-10">
            +3.800 escritórios contábeis no Brasil já operam com a dani.
          </p>

          <a
            href="https://wa.me/5511934927001?text=Ol%C3%A1!%20Vi%20a%20p%C3%A1gina%20da%20dani.ai%20e%20quero%20conversar."
            target="_blank"
            rel="noopener noreferrer"
            className="px-8 py-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-emerald-950 text-base font-bold inline-flex items-center justify-center gap-2 transition-all shadow-xl hover:shadow-2xl hover:-translate-y-0.5 min-h-[44px]"
          >
            <MessageCircle className="h-5 w-5" />
            Falar com a Trevo no WhatsApp
            <ArrowRight className="h-4 w-4" />
          </a>

          <p className="text-[11px] text-emerald-200/70 mt-8 flex items-center justify-center gap-1.5">
            <Clock className="h-3 w-3" />
            Resposta humana em até 1h útil
          </p>
        </div>
      </section>

      {/* ─── FOOTER ─── */}
      <footer className="bg-slate-100 border-t border-slate-200">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 flex flex-col md:flex-row gap-6 items-center justify-between text-xs text-slate-500">
          <div className="flex items-center gap-4">
            <img src={logoTrevo} alt="Trevo Legaliza" className="h-12 w-12 sm:h-14 sm:w-14 object-contain opacity-90" />
            <div>
              <p className="font-bold text-slate-700">TREVO ASSESSORIA SOCIETÁRIA LTDA</p>
              <p>CNPJ 39.969.412/0001-70 · São Bernardo do Campo / SP</p>
              <p className="mt-1 text-[10px]">© Trevo Legaliza · 12 anos cuidando do societário</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <img src={logoDaniDark} alt="dani.ai" className="h-8 object-contain" />
            <span className="text-[10px] text-slate-400 font-semibold" aria-label="marca registrada">®</span>
            <div className="leading-tight border-l border-slate-300 pl-3">
              <p className="text-[9px] uppercase tracking-wider text-slate-400 font-bold">Powered by</p>
              <p className="text-xs font-bold text-slate-700">Trevo Legaliza</p>
            </div>
          </div>
        </div>
      </footer>
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
        <p className="text-2xl sm:text-3xl md:text-4xl font-bold leading-none tracking-tight text-white">{value}</p>
        <p className="text-[11px] text-emerald-200/80 mt-1.5 leading-tight font-medium">{label}</p>
      </div>
    </div>
  );
}

function PassoCard({ numero, icone: Icone, titulo, texto }: {
  numero: string;
  icone: React.ComponentType<{ className?: string }>;
  titulo: string;
  texto: string;
}) {
  return (
    <div className="relative p-6 rounded-2xl border-2 border-slate-100 hover:border-emerald-200 transition-colors bg-white">
      <div className="flex items-center justify-between mb-4">
        <p className="text-5xl font-bold text-emerald-100 leading-none">{numero}</p>
        <div className="h-10 w-10 rounded-lg bg-emerald-50 inline-flex items-center justify-center">
          <Icone className="h-5 w-5 text-emerald-700" />
        </div>
      </div>
      <h3 className="text-lg font-bold text-slate-900 mb-2">{titulo}</h3>
      <p className="text-sm text-slate-600 leading-relaxed">{texto}</p>
    </div>
  );
}

// Chat simulado ao vivo (mesmo da landing principal, adaptado)
function ChatLive({ step }: { step: number }) {
  const showTyping = step === 0 || step === 2 || step === 4;
  const showMsg1 = step >= 1;
  const showMsg2 = step >= 3;
  const showMsg3 = step >= 5;

  return (
    <div className="bg-white rounded-2xl border border-emerald-100 shadow-2xl p-4 space-y-2.5 min-h-[260px]">
      <div className="flex items-center gap-2.5 pb-2 border-b border-slate-100">
        <div className="relative shrink-0">
          <div className="h-10 w-10 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-700 inline-flex items-center justify-center shadow-sm overflow-hidden p-1.5">
            <img src={logoDaniLight} alt="dani.ai" className="h-full w-full object-contain" />
          </div>
          <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-500 border-2 border-white" />
        </div>
        <p className="text-[11px] text-emerald-700 font-semibold">online · monitorando</p>
      </div>

      {showMsg1 && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg rounded-tl-none p-2.5 text-[11px] text-slate-700 leading-snug d-fade-up">
          <p>📋 <strong>Alteração #4521</strong> avançou para análise na JUCESP.</p>
          <p className="text-[9px] text-slate-400 mt-1">há 12 segundos</p>
        </div>
      )}

      {showMsg2 && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg rounded-tl-none p-2.5 text-[11px] text-slate-700 leading-snug d-fade-up">
          <p>✅ <strong>Abertura #4498</strong> deferida. CNPJ disponível.</p>
          <p className="text-[9px] text-slate-400 mt-1">há 8 segundos</p>
        </div>
      )}

      {showMsg3 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg rounded-tl-none p-2.5 text-[11px] text-slate-700 leading-snug d-fade-up">
          <p>⚠️ <strong>Processo #4502</strong> com exigência: falta procuração.</p>
          <p className="text-[9px] text-slate-400 mt-1">há 3 segundos</p>
        </div>
      )}

      {showTyping && (
        <div className="inline-flex items-center gap-1 px-3 py-2 bg-slate-100 rounded-full">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-600 d-dot-1" />
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-600 d-dot-2" />
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-600 d-dot-3" />
        </div>
      )}
    </div>
  );
}
