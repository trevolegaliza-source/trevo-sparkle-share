/**
 * Calculadora de ROI interativa.
 *
 * Refatorada 27/05: a lógica antiga comparava custo interno (salário/colaborador)
 * com preço de venda da Trevo (com margem). Comparação invalida — Trevo sempre
 * saía "mais cara". O argumento real é REVENUE SHIFT: as horas que o contador
 * gasta em societário poderiam estar faturando em contabilidade pra outros
 * clientes. Custo Trevo é < receita potencial = ganho real.
 *
 * Extraído do arquivo monolítico em 29/05 — só movimentação.
 */
import { useState } from 'react';
import { fmtBRL } from '@/lib/terceirizacao-engine';

export function BlocoCalculadoraROI({ valorProcesso }: { valorProcesso: number }) {
  const [processosMes, setProcessosMes] = useState(8);
  const [horasPorProcesso, setHorasPorProcesso] = useState(4);
  const [horaFaturada, setHoraFaturada] = useState(250); // R$/h que o contador COBRA do cliente contábil

  // Cálculos honestos
  const horasEmSocietario = processosMes * horasPorProcesso;
  const faturamentoPotencialPerdido = horasEmSocietario * horaFaturada;
  const custoComTrevo = processosMes * valorProcesso;
  const ganhoReal = faturamentoPotencialPerdido - custoComTrevo;
  const novosClientesAtendiveis = Math.floor(horasEmSocietario / 8); // 8h/mês por cliente contábil

  return (
    <section className="py-20 bg-gradient-to-br from-emerald-50 via-white to-emerald-50/30">
      <div className="max-w-5xl mx-auto px-6">
        <div className="max-w-2xl mb-10">
          <p className="text-[10px] uppercase tracking-[0.2em] text-emerald-700 font-bold mb-2">Calculadora interativa</p>
          <h2 className="text-3xl md:text-4xl font-bold text-slate-900 leading-tight">
            Quanto você <span className="text-emerald-700">deixa de faturar</span> fazendo societário?
          </h2>
          <p className="text-slate-600 mt-3 leading-relaxed">
            Cada hora em processo societário é uma hora a menos pra atender contabilidade —
            seu serviço de maior margem. Veja o impacto real.
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
                <label className="text-sm font-semibold text-slate-700">Valor da sua hora faturada (contabilidade)</label>
                <span className="text-2xl font-bold text-emerald-700 tabular-nums">R$ {horaFaturada}</span>
              </div>
              <input
                type="range" min={100} max={600} step={10} value={horaFaturada}
                onChange={(e) => setHoraFaturada(Number(e.target.value))}
                className="w-full accent-emerald-600 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-slate-400 mt-1">
                <span>R$ 100</span><span>R$ 600</span>
              </div>
              <p className="text-[10px] text-slate-500 mt-1.5 italic">
                Quanto você cobra do seu cliente contábil por hora de trabalho contábil (não o custo do seu colaborador).
              </p>
            </div>
          </div>

          {/* Outputs */}
          <div className="bg-gradient-to-br from-emerald-700 to-emerald-900 text-white rounded-2xl p-6 shadow-2xl">
            <p className="text-[10px] uppercase tracking-[0.2em] text-emerald-200 font-bold mb-4">Seu retorno com a Trevo</p>

            <div className="space-y-4">
              <div className="flex items-baseline justify-between gap-3 pb-3 border-b border-emerald-600/40 flex-wrap">
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] uppercase tracking-wider text-emerald-200/80 font-bold">Faturamento que você deixa de ganhar</p>
                  <p className="text-[10px] text-emerald-200/80 mt-0.5">{horasEmSocietario}h × R$ {horaFaturada}/h faturada</p>
                </div>
                <p className="text-xl sm:text-2xl font-bold tabular-nums text-white whitespace-nowrap">{fmtBRL(faturamentoPotencialPerdido)}</p>
              </div>

              <div className="flex items-baseline justify-between gap-3 pb-3 border-b border-emerald-600/40 flex-wrap">
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] uppercase tracking-wider text-emerald-200/80 font-bold">Investimento na Trevo</p>
                  <p className="text-[10px] text-emerald-200/80 mt-0.5">{processosMes} × {fmtBRL(valorProcesso)}/processo</p>
                </div>
                <p className="text-xl sm:text-2xl font-bold tabular-nums text-white whitespace-nowrap">{fmtBRL(custoComTrevo)}</p>
              </div>

              {ganhoReal > 0 ? (
                <div className="rounded-xl p-4 ring-1 bg-emerald-500/20 ring-emerald-400/40">
                  <p className="text-[10px] uppercase tracking-[0.18em] text-emerald-200 font-bold mb-1">
                    Ganho real terceirizando
                  </p>
                  <p className="text-3xl sm:text-4xl font-bold tabular-nums text-emerald-100">
                    +{fmtBRL(ganhoReal)}
                  </p>
                  <p className="text-[10px] text-emerald-200/80 mt-1 leading-relaxed">
                    Faturamento liberado − investimento Trevo
                  </p>
                </div>
              ) : (
                /* COM-03 (27/05 noite): quando ganho negativo, NÃO mostra mea-culpa.
                   Reposiciona como "neutralidade financeira" + ganho em dimensões
                   qualitativas (sem "ainda assim", sem "qualidade de vida"). */
                <div className="rounded-xl p-4 ring-1 bg-emerald-500/15 ring-emerald-400/30">
                  <p className="text-[10px] uppercase tracking-[0.18em] text-emerald-200 font-bold mb-2">
                    Equivalência financeira · ganho qualitativo
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-lg bg-white/5 p-2.5">
                      <p className="text-[10px] uppercase tracking-wider text-emerald-200/70 font-bold">SLA contratual</p>
                      <p className="text-sm font-bold text-white mt-0.5">Garantido</p>
                    </div>
                    <div className="rounded-lg bg-white/5 p-2.5">
                      <p className="text-[10px] uppercase tracking-wider text-emerald-200/70 font-bold">Retrabalho</p>
                      <p className="text-sm font-bold text-white mt-0.5">Eliminado</p>
                    </div>
                    <div className="rounded-lg bg-white/5 p-2.5">
                      <p className="text-[10px] uppercase tracking-wider text-emerald-200/70 font-bold">Risco operacional</p>
                      <p className="text-sm font-bold text-white mt-0.5">Transferido</p>
                    </div>
                    <div className="rounded-lg bg-white/5 p-2.5">
                      <p className="text-[10px] uppercase tracking-wider text-emerald-200/70 font-bold">Tempo livre</p>
                      <p className="text-sm font-bold text-white mt-0.5">{horasEmSocietario}h/mês</p>
                    </div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3 pt-2">
                <div className="rounded-lg bg-white/10 px-3 py-2">
                  <p className="text-2xl font-bold tabular-nums">{horasEmSocietario}h</p>
                  <p className="text-[10px] text-emerald-200/80 leading-tight mt-0.5">liberadas no mês</p>
                </div>
                <div className="rounded-lg bg-white/10 px-3 py-2">
                  <p className="text-2xl font-bold tabular-nums">+{novosClientesAtendiveis}</p>
                  <p className="text-[10px] text-emerald-200/80 leading-tight mt-0.5">clientes contábeis novos</p>
                </div>
              </div>
            </div>

            <p className="text-[10px] text-emerald-200/50 italic mt-4 leading-relaxed">
              Estimativa simplificada. Premissa: as horas liberadas seriam aplicadas em serviços contábeis pra outros clientes
              ao valor de hora faturada informado. Não inclui taxas governamentais (passam em ambos os modelos).
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
