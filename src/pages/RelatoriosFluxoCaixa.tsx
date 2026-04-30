import { useState } from 'react';
import { useFluxoCaixa } from '@/hooks/useFluxoCaixa';
import { GlassCard } from '@/components/ui/glass-card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { TrendingUp, TrendingDown, DollarSign, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';
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

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <GlassCard className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-500/20">
              <TrendingUp className="h-5 w-5 text-emerald-500" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Entradas Projetadas</p>
              <p className="text-xl font-bold text-emerald-500">{fmt(data?.totalEntradas || 0)}</p>
            </div>
          </div>
        </GlassCard>
        <GlassCard className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-red-500/20">
              <TrendingDown className="h-5 w-5 text-red-500" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Saídas Projetadas</p>
              <p className="text-xl font-bold text-red-500">{fmt(data?.totalSaidas || 0)}</p>
            </div>
          </div>
        </GlassCard>
        <GlassCard className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg" style={{
              backgroundColor: (data?.saldoFinal || 0) >= 0 ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'
            }}>
              <DollarSign className="h-5 w-5" style={{
                color: (data?.saldoFinal || 0) >= 0 ? '#10b981' : '#ef4444'
              }} />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Saldo Projetado</p>
              <p className="text-xl font-bold" style={{
                color: (data?.saldoFinal || 0) >= 0 ? '#10b981' : '#ef4444'
              }}>
                {fmt(data?.saldoFinal || 0)}
              </p>
            </div>
          </div>
        </GlassCard>
      </div>

      {/* Chart */}
      <GlassCard className="p-4">
        <h2 className="text-sm font-semibold mb-4">Evolução Acumulada</h2>
        {isLoading ? (
          <div className="h-[300px] flex items-center justify-center text-muted-foreground text-sm">
            Carregando...
          </div>
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
              <Area
                type="monotone"
                dataKey="saldo"
                name="Saldo"
                stroke="#6366f1"
                fill="#6366f1"
                fillOpacity={0.1}
                strokeWidth={2}
                strokeDasharray="4 2"
              />
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
