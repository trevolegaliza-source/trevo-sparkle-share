/**
 * Badge/Linha de vencimento (3 tipos: mensal_dia, deferimento, outros).
 * VencimentoBadge — variante card destacado pro hero financeiro.
 * VencimentoLinha — variante inline pro card "preço por tipo".
 *
 * Extraído do arquivo monolítico em 29/05 — só movimentação.
 */
import { Calendar } from 'lucide-react';
import type { VencProps } from './types';

export function VencimentoBadge({ tipo, dia, texto }: VencProps) {
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

export function VencimentoLinha({ tipo, dia, texto }: VencProps) {
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
