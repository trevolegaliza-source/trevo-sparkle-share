import { useState } from 'react';
import { useFluxoCaixa } from '@/hooks/useFluxoCaixa';
import { GlassCard } from '@/components/ui/glass-card';
import { KPICard } from '@/components/ui/kpi-card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { TrendingUp, TrendingDown, DollarSign, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';
import { SkeletonKPIs } from '@/components/ui/skeleton-patterns';
import { ptBR } from 'date-fns/locale';

const fmt = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0, maximumFractionDigits: 0 });

export default function RelatoriosFluxoCaixa() {
  const [horizonte, setHorizonte] = useState(30);
  const [incluirRecorrentes, setIncluirRecorrentes] = useState(true);
  const { data, isLoading } = useFluxoCaixa(horizonte, incluirRecorrentes);

  const chartData = (data?.dailyData || []).map(d => ({
    ...d,
    label: format(new Date(d.date + 'T12:00:00'), 'dd/MM', { locale: ptBR }),
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Fluxo de Caixa Projetado</h1>
          <p className="text-sm text-muted-foreground">
            Projeção de entradas e saídas nos próximos {horizonte} dias
          </p>
        </div>

        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex gap-1 rounded-lg border p-1">
            {[30, 60, 90].map(d => (
              <Button
                key={d}
                size="sm"
                variant={horizonte === d ? 'default' : 'ghost'}
                onClick={() => setHorizonte(d)}
                className="text-xs"
              >
                {d} dias
              </Button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <Switch
              id="recorrentes"
              checked={incluirRecorrentes}
              onCheckedChange={setIncluirRecorrentes}
            />
            <Label htmlFor="recorrentes" className="text-xs">Incluir recorrentes</Label>
          </div>
        </div>
      </div>

      {/* KPI Cards — Onda 6 (18/05/2026): KPICard padrão com variants automáticos */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KPICard
          variant="success"
          icon={TrendingUp}
          label="Entradas Projetadas"
          value={fmt(data?.totalEntradas || 0)}
        />
        <KPICard
          variant="danger"
          icon={TrendingDown}
          label="Saídas Projetadas"
          value={fmt(data?.totalSaidas || 0)}
        />
        <KPICard
          variant={(data?.saldoFinal || 0) >= 0 ? 'hero' : 'danger'}
          icon={DollarSign}
          label="Saldo Projetado"
          value={fmt(data?.saldoFinal || 0)}
        />
      </div>

      {/* Chart */}
      <GlassCard className="p-4">
        <h2 className="text-sm font-semibold mb-4">Evolução Acumulada</h2>
        {isLoading ? (
          <Skeleton className="h-[300px] w-full rounded-md" />
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                interval={Math.max(0, Math.floor(chartData.length / 10))}
              />
              <YAxis
                tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}k`}
              />
              <Tooltip
                formatter={(value: number) => fmt(value)}
                labelFormatter={(l: string) => `Dia ${l}`}
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: 8,
                  fontSize: 12,
                }}
              />
              <Area
                type="monotone"
                dataKey="entradas"
                name="Entradas"
                stroke="#10b981"
                fill="#10b981"
                fillOpacity={0.15}
                strokeWidth={2}
              />
              <Area
                type="monotone"
                dataKey="saidas"
                name="Saídas"
                stroke="#ef4444"
                fill="#ef4444"
                fillOpacity={0.1}
                strokeWidth={2}
              />
              {/* Série "Saldo" removida em 13/05/2026 (auditoria) — era redundante
                  (saldo = entradas - saídas), apenas poluía o gráfico. */}
            </AreaChart>
          </ResponsiveContainer>
        )}
      </GlassCard>

      {/* Weekly Table */}
      <GlassCard className="p-4">
        <h2 className="text-sm font-semibold mb-4">Projeção por Semana</h2>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Semana</TableHead>
                <TableHead className="text-right">Entradas</TableHead>
                <TableHead className="text-right">Saídas</TableHead>
                <TableHead className="text-right">Saldo Projetado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(data?.semanas || []).map((s, i) => {
                const negativo = s.saldoProjetado < 0;
                return (
                  <TableRow key={i} className={negativo ? 'bg-red-500/10' : ''}>
                    <TableCell className="font-medium text-sm">{s.label}</TableCell>
                    <TableCell className="text-right text-emerald-500 text-sm">{fmt(s.entradas)}</TableCell>
                    <TableCell className="text-right text-red-500 text-sm">{fmt(s.saidas)}</TableCell>
                    <TableCell className="text-right text-sm">
                      <span className={`inline-flex items-center gap-1 font-semibold ${negativo ? 'text-red-500' : 'text-emerald-500'}`}>
                        {negativo && <AlertTriangle className="h-3.5 w-3.5" />}
                        {fmt(s.saldoProjetado)}
                      </span>
                    </TableCell>
                  </TableRow>
                );
              })}
              {(data?.semanas || []).length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                    Nenhum dado para o período selecionado
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </GlassCard>
    </div>
  );
}
