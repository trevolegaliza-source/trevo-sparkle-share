import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowLeft, DollarSign, TrendingUp, CreditCard } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useFinanceiroDashboard, useLancamentos } from '@/hooks/useFinanceiro';
import { STATUS_LABELS, STATUS_STYLES } from '@/types/financial';
import type { StatusFinanceiro } from '@/types/financial';
import { Skeleton } from '@/components/ui/skeleton';

export default function FaturamentoDetalhe() {
  const { data: dashData, isLoading: loadingDash } = useFinanceiroDashboard();
  const { data: lancamentos, isLoading: loadingLanc } = useLancamentos('receber');

  const isLoading = loadingDash || loadingLanc;

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const thisMonthLancamentos = (lancamentos || []).filter(l => new Date(l.data_vencimento) >= startOfMonth);

  const pendentes = thisMonthLancamentos.filter(l => l.status === 'pendente');
  const pagos = thisMonthLancamentos.filter(l => l.status === 'pago');
  const atrasados = thisMonthLancamentos.filter(l => l.status === 'atrasado');

  const sum = (items: typeof thisMonthLancamentos) => items.reduce((s, l) => s + Number(l.valor), 0);
  const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  const kpis = [
    { label: 'Receita Prevista', value: dashData?.receitaPrevistaMes ?? 0, icon: TrendingUp, bgClass: 'bg-primary/10', iconClass: 'text-primary' },
    { label: 'Pendente', value: sum(pendentes), icon: CreditCard, bgClass: 'bg-warning/10', iconClass: 'text-warning' },
    { label: 'Recebido', value: sum(pagos), icon: DollarSign, bgClass: 'bg-success/10', iconClass: 'text-success' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
          <Link to="/"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Faturamento Mensal</h1>
          <p className="text-sm text-muted-foreground">Detalhamento de receitas, pendências e previsões do mês</p>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-3">
        {kpis.map((stat) => (
          <Card key={stat.label} className="border-border/60">
            <CardContent className="p-5">
              <div className={`rounded-lg ${stat.bgClass} p-2 w-fit`}>
                <stat.icon className={`h-4.5 w-4.5 ${stat.iconClass}`} />
              </div>
              <div className="mt-3">
                {isLoading ? <Skeleton className="h-7 w-24" /> : <p className="text-2xl font-bold">{fmt(stat.value)}</p>}
                <p className="text-xs text-muted-foreground">{stat.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Atrasados */}
      {atrasados.length > 0 && (
        <Card className="border-destructive/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-base text-destructive">Valores Atrasados ({atrasados.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {atrasados.map((l) => (
              <div key={l.id} className="flex items-center justify-between rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{l.descricao}</p>
                  <p className="text-xs text-muted-foreground">{(l as any).cliente?.nome || '-'}</p>
                </div>
                <span className="text-sm font-medium text-destructive">{fmt(Number(l.valor))}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Pendentes */}
      <Card className="border-border/60">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Pendências do Mês ({pendentes.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-20 w-full" />
          ) : pendentes.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Nenhuma pendência</p>
          ) : (
            <div className="space-y-2">
              {pendentes.map((l) => (
                <div key={l.id} className="flex items-center justify-between rounded-lg border border-border/40 bg-muted/30 px-4 py-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{l.descricao}</p>
                    <p className="text-xs text-muted-foreground">
                      Vencimento: {new Date(l.data_vencimento).toLocaleDateString('pt-BR')}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className={`${STATUS_STYLES[l.status as StatusFinanceiro]} border-0 text-[10px]`}>
                      {STATUS_LABELS[l.status as StatusFinanceiro]}
                    </Badge>
                    <span className="text-sm font-medium">{fmt(Number(l.valor))}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
