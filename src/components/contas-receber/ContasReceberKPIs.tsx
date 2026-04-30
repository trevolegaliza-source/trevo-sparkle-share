import { Card, CardContent } from '@/components/ui/card';
import { DollarSign, TrendingUp, Clock, AlertTriangle, BarChart3 } from 'lucide-react';
import type { LancamentoReceber } from '@/hooks/useContasReceber';

interface Props {
  lancamentos: LancamentoReceber[];
}

export default function ContasReceberKPIs({ lancamentos }: Props) {
  const hoje = new Date().toISOString().split('T')[0];
  const faturado = lancamentos.reduce((s, l) => s + Number(l.valor), 0);
  const recebido = lancamentos.filter(l => l.status === 'pago').reduce((s, l) => s + Number(l.valor), 0);
  const pendente = lancamentos.filter(l => l.status === 'pendente' && l.data_vencimento >= hoje).reduce((s, l) => s + Number(l.valor), 0);
  const vencido = lancamentos.filter(l => l.status === 'pendente' && l.data_vencimento < hoje).reduce((s, l) => s + Number(l.valor), 0);
  const taxa = faturado > 0 ? Math.round((recebido / faturado) * 100) : 0;

  const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  const kpis = [
    { label: 'Faturado no Período', value: fmt(faturado), icon: DollarSign, color: 'text-primary' },
    { label: 'Recebido', value: fmt(recebido), icon: TrendingUp, color: 'text-success' },
    { label: 'Pendente', value: fmt(pendente), icon: Clock, color: 'text-warning' },
    { label: 'Vencido', value: fmt(vencido), icon: AlertTriangle, color: 'text-destructive' },
  ];

  const progressColor = taxa >= 80 ? 'bg-success' : taxa >= 50 ? 'bg-warning' : 'bg-destructive';

  return (
    <div className="grid gap-3 sm:grid-cols-5">
      {kpis.map(k => (
        <Card key={k.label} className="border-border/60">
          <CardContent className="p-4">
            <k.icon className={`h-4 w-4 ${k.color} mb-2`} />
            <p className="text-xl font-extrabold">{k.value}</p>
            <p className="text-[11px] text-muted-foreground">{k.label}</p>
          </CardContent>
        </Card>
      ))}
      <Card className="border-border/60">
        <CardContent className="p-4">
          <BarChart3 className="h-4 w-4 text-info mb-2" />
          <p className="text-xl font-extrabold">{taxa}%</p>
          <p className="text-[11px] text-muted-foreground mb-2">Taxa de Recebimento</p>
          <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
            <div className={`h-full rounded-full ${progressColor} transition-all`} style={{ width: `${taxa}%` }} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
