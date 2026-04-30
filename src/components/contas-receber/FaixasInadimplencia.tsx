import { Badge } from '@/components/ui/badge';
import type { LancamentoReceber } from '@/hooks/useContasReceber';
import { diasAtraso } from '@/hooks/useContasReceber';

interface Props {
  vencidos: LancamentoReceber[];
  faixaSelecionada: string | null;
  onSelectFaixa: (faixa: string | null) => void;
}

const FAIXAS = [
  { key: '1-7', label: '1-7 dias', min: 1, max: 7, color: 'bg-warning/20 text-warning border-warning/30' },
  { key: '8-15', label: '8-15 dias', min: 8, max: 15, color: 'bg-orange-500/20 text-orange-400 border-orange-500/30' },
  { key: '16-30', label: '16-30 dias', min: 16, max: 30, color: 'bg-destructive/20 text-destructive border-destructive/30' },
  { key: '30+', label: '30+ dias', min: 31, max: 99999, color: 'bg-red-900/30 text-red-400 border-red-900/40' },
];

export function getFaixa(dias: number) {
  return FAIXAS.find(f => dias >= f.min && dias <= f.max);
}

export default function FaixasInadimplencia({ vencidos, faixaSelecionada, onSelectFaixa }: Props) {
  const totalGeral = vencidos.reduce((s, l) => s + Number(l.valor), 0);
  const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  return (
    <div className="rounded-lg border border-border/60 bg-card p-4 space-y-3">
      <h3 className="text-sm font-semibold">Faixas de Inadimplência</h3>
      <div className="grid gap-2 sm:grid-cols-4">
        {FAIXAS.map(f => {
          const items = vencidos.filter(l => {
            const d = diasAtraso(l.data_vencimento, l.status);
            return d >= f.min && d <= f.max;
          });
          const total = items.reduce((s, l) => s + Number(l.valor), 0);
          const isSelected = faixaSelecionada === f.key;
          return (
            <button
              key={f.key}
              onClick={() => onSelectFaixa(isSelected ? null : f.key)}
              className={`rounded-lg border p-3 text-left transition-all hover:ring-1 hover:ring-ring ${isSelected ? 'ring-2 ring-primary' : ''} ${f.color}`}
            >
              <p className="text-xs font-medium">{f.label}</p>
              <p className="text-lg font-bold">{items.length}</p>
              <p className="text-xs opacity-80">{fmt(total)}</p>
            </button>
          );
        })}
      </div>
      <p className="text-xs text-muted-foreground">Total em atraso: <span className="font-semibold text-destructive">{fmt(totalGeral)}</span></p>
    </div>
  );
}
