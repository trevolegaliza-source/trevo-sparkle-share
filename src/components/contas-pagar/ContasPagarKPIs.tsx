import { Card, CardContent } from '@/components/ui/card';
import { DollarSign, CheckCircle, Clock, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

type KpiFilter = 'total' | 'pago' | 'pendente' | 'vencido';

interface KPIProps {
  totalPrevisto: number;
  totalPago: number;
  totalPendente: number;
  totalVencido: number;
  activeFilter?: KpiFilter;
  onFilterChange?: (filter: KpiFilter) => void;
}

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export type { KpiFilter };

export default function ContasPagarKPIs({ totalPrevisto, totalPago, totalPendente, totalVencido, activeFilter, onFilterChange }: KPIProps) {
  const pctPago = totalPrevisto > 0 ? Math.round((totalPago / totalPrevisto) * 100) : 0;

  const cards: { key: KpiFilter; label: string; value: number; Icon: any; color: string; showBar?: boolean }[] = [
    { key: 'total', label: 'Total do Mês', value: totalPrevisto, Icon: DollarSign, color: 'text-foreground' },
    { key: 'pago', label: 'Pago', value: totalPago, Icon: CheckCircle, color: 'text-primary', showBar: true },
    { key: 'pendente', label: 'A Pagar', value: totalPendente, Icon: Clock, color: 'text-warning' },
    { key: 'vencido', label: 'Vencido', value: totalVencido, Icon: AlertTriangle, color: 'text-destructive' },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map(c => (
        <Card
          key={c.key}
          className={cn(
            'cursor-pointer transition-all hover:shadow-md hover:-translate-y-0.5',
            activeFilter === c.key && 'ring-2 ring-primary ring-offset-2 ring-offset-background'
          )}
          onClick={() => onFilterChange?.(activeFilter === c.key ? 'total' : c.key)}
        >
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground uppercase tracking-wider">{c.label}</span>
              <div className={`h-8 w-8 rounded-lg bg-background flex items-center justify-center ${c.color}`}>
                <c.Icon className="h-4 w-4" />
              </div>
            </div>
            <p className={`text-2xl font-extrabold ${c.color}`}>{fmt(c.value)}</p>
            {c.showBar && (
              <div className="mt-2">
                <div className="w-full bg-muted rounded-full h-1.5">
                  <div className="bg-primary h-1.5 rounded-full transition-all duration-500" style={{ width: `${pctPago}%` }} />
                </div>
                <p className="text-[10px] text-muted-foreground mt-1">{pctPago}% do total</p>
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
