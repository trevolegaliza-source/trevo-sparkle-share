/**
 * Card destaque Dani.ai (full-width no bloco diferenciais).
 * Inclui simulação animada de chat com typing indicator.
 *
 * Extraído do arquivo monolítico em 29/05 — só movimentação.
 *
 * Animações dependem de keyframes globais (`dani-dot-1/2/3`, `fade-up`)
 * que continuam definidas inline na TerceirizacaoPublicaView.
 */
import { useEffect, useState } from 'react';
import { Sparkles } from 'lucide-react';
import logoDaniDark from '@/assets/dani-dark.png';
import logoDaniLight from '@/assets/dani-light.png';

export function CardDaniAi() {
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
            <img src={logoDaniDark} alt="dani.ai" loading="lazy" decoding="async" className="h-7 md:h-8 object-contain inline-block translate-y-1" />
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
                <img src={logoDaniLight} alt="dani.ai" loading="lazy" decoding="async" className="h-full w-full object-contain" />
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
