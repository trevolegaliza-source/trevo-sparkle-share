/**
 * Átomos visuais pequenos da landing de Terceirização.
 * Stat / Diferencial / CardEscopo / ComoFunciona.
 *
 * Extraído do arquivo monolítico em 29/05 — só movimentação, sem mudança
 * de comportamento ou estilo.
 */
import type { ItemEditavel } from '@/lib/terceirizacao-engine';

export function Stat({
  icon: Icon,
  value,
  label,
}: {
  icon: React.ComponentType<{ className?: string }>;
  value: string;
  label: string;
}) {
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

export function Diferencial({
  icon: Icon,
  titulo,
  texto,
}: {
  icon: React.ComponentType<{ className?: string }>;
  titulo: string;
  texto: string;
}) {
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

export function CardEscopo({
  titulo,
  itens,
  corChip,
  labelInativos = 'Fora de escopo',
}: {
  titulo: string;
  itens: ItemEditavel[];
  corChip: string;
  labelInativos?: string;
}) {
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

export function ComoFunciona({ numero, titulo, texto }: { numero: string; titulo: string; texto: string }) {
  return (
    <div className="relative p-6 rounded-2xl border-2 border-slate-100 hover:border-emerald-200 transition-colors">
      <p className="text-5xl font-bold text-emerald-100 leading-none mb-4">{numero}</p>
      <h3 className="text-lg font-bold text-slate-900 mb-2">{titulo}</h3>
      <p className="text-sm text-slate-600 leading-relaxed">{texto}</p>
    </div>
  );
}
