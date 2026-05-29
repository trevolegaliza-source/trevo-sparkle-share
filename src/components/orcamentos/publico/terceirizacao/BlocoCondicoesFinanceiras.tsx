/**
 * Bloco Condições Financeiras (Anexo II).
 * 3 modos: !isPrecoPorTipo (card de valor + opcional abertura), isPrecoPorTipo
 * (tabela de honorários), e o highlight de validade ancorando 5º processo cortesia.
 *
 * Extraído do arquivo monolítico em 29/05 — só movimentação.
 */
import { AlertCircle, Sparkles } from 'lucide-react';
import { fmtBRL, TIPO_PROCESSO_PRECO_LABELS } from '@/lib/terceirizacao-engine';
import type { PrecosPorTipo } from '@/lib/terceirizacao-engine';
import { VencimentoBadge, VencimentoLinha } from './Vencimento';
import type { VencProps } from './types';

export function BlocoCondicoesFinanceiras({
  modalidadeLabel,
  isPrecoPorTipo,
  isPlanoMensal,
  valorPrincipal,
  valorAbertura,
  precosPorTipo,
  vencimento,
  expiracao,
  diasParaExpirar,
  numero,
}: {
  modalidadeLabel: string;
  isPrecoPorTipo: boolean;
  isPlanoMensal: boolean;
  valorPrincipal: number;
  valorAbertura: number | null | undefined;
  precosPorTipo: PrecosPorTipo;
  vencimento: VencProps;
  expiracao: Date;
  diasParaExpirar: number;
  numero: number;
}) {
  return (
    <section className="py-20 bg-emerald-950 text-white relative overflow-hidden">
      <div className="absolute top-0 left-0 w-[500px] h-[500px] bg-emerald-500/10 rounded-full blur-3xl -translate-x-1/3 pointer-events-none" />
      <div className="relative max-w-5xl mx-auto px-6">
        <div className="max-w-2xl mb-12">
          <p className="text-[10px] uppercase tracking-[0.2em] text-emerald-300 font-bold mb-2">Anexo II — Condições financeiras</p>
          <h2 className="text-3xl md:text-4xl font-bold leading-tight">
            Investimento previsível, sem surpresa
          </h2>
          <p className="text-emerald-100/80 mt-4 leading-relaxed">
            Modalidade <strong className="text-white">{modalidadeLabel}</strong>.
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
                tipo={vencimento.tipo}
                dia={vencimento.dia}
                texto={vencimento.texto}
              />
            </div>

            {valorAbertura && valorAbertura > 0 && valorAbertura !== valorPrincipal && (
              <div className="mt-6 pt-6 border-t border-slate-200">
                <div className="relative rounded-xl bg-gradient-to-br from-emerald-50 via-emerald-100/50 to-emerald-50 border-2 border-emerald-400 p-5">
                  <div className="absolute -top-3 left-5 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-600 text-white text-[10px] font-bold uppercase tracking-wider shadow-md">
                    <Sparkles className="h-3 w-3" />
                    Diferencial Trevo
                  </div>
                  <div className="mt-1">
                    <p className="text-[10px] uppercase tracking-wider text-emerald-700 font-bold mb-1">Abertura de empresa</p>
                    <p className="text-3xl font-bold tabular-nums text-emerald-700">{fmtBRL(valorAbertura)}</p>
                    <p className="text-[11px] text-emerald-700/70 mt-1">
                      <strong className="text-emerald-800">{Math.round((1 - valorAbertura / valorPrincipal) * 100)}% mais barato</strong> que os demais processos
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
              tipo={vencimento.tipo}
              dia={vencimento.dia}
              texto={vencimento.texto}
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
            PROP-{String(numero).padStart(4, '0')}
          </span>
        </div>
      </div>
    </section>
  );
}
