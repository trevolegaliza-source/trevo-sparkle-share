/**
 * PrecosPorTipoProcesso — modalidade nova onde cada tipo de processo (abertura,
 * alteração, baixa, transformação, encerramento) tem preço próprio.
 * Caso real: Thales cobra R$ 580 abertura mas R$ 480 alteração/transformação.
 */
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { fmtBRL, type PrecosPorTipo, TIPO_PROCESSO_PRECO_LABELS } from '@/lib/terceirizacao-engine';

interface Props {
  value: PrecosPorTipo;
  onChange: (next: PrecosPorTipo) => void;
}

export function PrecosPorTipoProcesso({ value, onChange }: Props) {
  const set = (key: keyof PrecosPorTipo, v: number | null) => {
    onChange({ ...value, [key]: v === null ? undefined : v });
  };

  const tipos = Object.keys(TIPO_PROCESSO_PRECO_LABELS) as (keyof PrecosPorTipo)[];

  return (
    <div className="rounded-md bg-amber-50/40 border border-amber-200 p-4 space-y-3">
      <div>
        <p className="text-[10px] uppercase tracking-wider font-bold text-amber-700">
          Preço por tipo de processo
        </p>
        <p className="text-[11px] text-muted-foreground mt-0.5">
          Define um valor diferente pra cada categoria. Deixe em branco pra usar o valor base padrão.
        </p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {tipos.map((t) => (
          <div key={t} className="space-y-1.5">
            <Label className="text-xs">{TIPO_PROCESSO_PRECO_LABELS[t]}</Label>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={value[t] ?? ''}
              onChange={(e) => set(t, e.target.value ? Number(e.target.value) : null)}
              placeholder="R$ 0,00"
              className="tabular-nums h-9"
            />
          </div>
        ))}
      </div>
      {/* Resumo */}
      <div className="pt-2 border-t border-amber-200">
        <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-1">Preços definidos</p>
        <div className="flex flex-wrap gap-2 text-[11px]">
          {tipos.map((t) =>
            value[t] && value[t]! > 0 ? (
              <span key={t} className="px-2 py-0.5 rounded-full bg-amber-100 border border-amber-300 text-amber-900">
                {TIPO_PROCESSO_PRECO_LABELS[t]}: <strong>{fmtBRL(value[t]!)}</strong>
              </span>
            ) : null
          )}
          {tipos.every((t) => !value[t] || value[t] === 0) && (
            <span className="text-muted-foreground italic">Nenhum preço por tipo definido ainda.</span>
          )}
        </div>
      </div>
    </div>
  );
}
