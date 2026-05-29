import { Badge } from '@/components/ui/badge';

// FIN-004 (27/05 noite): badge de score de pagamento. Mostra apenas se o
// cliente tem score calculado (clientes sem histórico = NULL = esconde).
export function ScorePagamentoBadge({ score, atrasoMedio }: { score: number | null; atrasoMedio: number | null }) {
  if (score == null) return null;
  const cor =
    score >= 80 ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30' :
    score >= 50 ? 'bg-amber-500/10 text-amber-600 border-amber-500/30' :
                  'bg-rose-500/10 text-rose-600 border-rose-500/30';
  const icone = score >= 80 ? '🟢' : score >= 50 ? '🟡' : '🔴';
  const label =
    score >= 80 ? 'em dia' :
    score >= 50 ? `atraso ~${atrasoMedio ?? 0}d` :
                  `risco ~${atrasoMedio ?? 0}d`;
  const tooltip = atrasoMedio != null
    ? `Score ${score}/100 · atraso médio ${atrasoMedio} dias (últimos 6 meses)`
    : `Score ${score}/100`;
  return (
    <Badge
      variant="outline"
      className={`text-[10px] sm:text-xs whitespace-nowrap ${cor}`}
      title={tooltip}
    >
      {icone} {label}
    </Badge>
  );
}
