/**
 * Bloco "Antes vs Depois Trevo" — comparação visual de duas listas.
 * Strings hardcoded (copy fixa da landing).
 *
 * Extraído do arquivo monolítico em 29/05 — só movimentação.
 */
import { Check, X } from 'lucide-react';

export function BlocoAntesDepois() {
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
