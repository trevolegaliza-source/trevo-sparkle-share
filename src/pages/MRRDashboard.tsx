import { useNavigate } from 'react-router-dom';
import { useMRRData } from '@/hooks/useMRRData';
import { KPICard } from '@/components/ui/kpi-card';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/ui/page-header';
import { SkeletonKPIs, SkeletonList } from '@/components/ui/skeleton-patterns';
import {
  DollarSign, TrendingUp, TrendingDown, Repeat, Target,
  AlertTriangle, Users, Calendar, ArrowRight, Sparkles, CheckCircle2, Clock,
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { cn } from '@/lib/utils';

const fmt = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const fmtCompact = (v: number) =>
  v >= 1000 ? `R$ ${(v / 1000).toFixed(1)}k` : fmt(v);

export default function MRRDashboard() {
  const navigate = useNavigate();
  const { data, isLoading } = useMRRData();

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="heading-1">MRR Dashboard</h1>
          <p className="caption">Receita recorrente, pipeline e crescimento</p>
        </div>
        <SkeletonKPIs count={4} />
        <SkeletonList rows={3} />
      </div>
    );
  }

  if (!data) {
    return (
      <EmptyState
        icon={Sparkles}
        title="Sem dados pra calcular MRR"
        description="Cadastre seu primeiro cliente mensalista pra começar."
        action={<Button onClick={() => navigate('/clientes')}>+ Novo Cliente</Button>}
      />
    );
  }

  const arr_atual = data.mrr_atual * 12; // ARR = annualized
  const projecaoFim = data.receita_mes_atual + data.pipeline_valor * (data.taxa_conversao / 100);

  return (
    <div className="space-y-6">
      <PageHeader
        title="MRR Dashboard"
        subtitle="Receita recorrente, pipeline e crescimento — atualizado em tempo real"
        badge={
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-bold uppercase tracking-wide">
            Beta
          </span>
        }
        actions={
          <Button variant="outline" size="sm" onClick={() => navigate('/financeiro')}>
            Ver Financeiro <ArrowRight className="h-4 w-4 ml-1" />
          </Button>
        }
      />

      {/* KPIs principais */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          variant="hero"
          icon={Repeat}
          label="MRR atual"
          value={fmt(data.mrr_atual)}
          hint={`${data.qtd_mensalistas} mensalista${data.qtd_mensalistas !== 1 ? 's' : ''} · média ${fmt(data.mensalidade_media)}`}
        />
        <KPICard
          variant="success"
          icon={Calendar}
          label="ARR projetado"
          value={fmtCompact(arr_atual)}
          hint="MRR × 12 meses"
        />
        <KPICard
          variant="default"
          icon={Target}
          label="Pipeline aberto"
          value={fmt(data.pipeline_valor)}
          hint={`${data.pipeline_qtd} orçamento${data.pipeline_qtd !== 1 ? 's' : ''} enviado${data.pipeline_qtd !== 1 ? 's' : ''}`}
          onClick={() => navigate('/orcamentos')}
        />
        <KPICard
          variant={data.variacao_pct >= 0 ? 'success' : 'danger'}
          icon={data.variacao_pct >= 0 ? TrendingUp : TrendingDown}
          label="Crescimento receita"
          value={`${data.variacao_pct >= 0 ? '+' : ''}${data.variacao_pct.toFixed(1)}%`}
          trend={{ value: data.variacao_pct, label: 'vs mês anterior' }}
        />
      </div>

      {/* Insights — projeção + alerta */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="p-5 lg:col-span-2 bg-gradient-to-br from-primary/5 via-primary/[0.03] to-transparent border-primary/20">
          <div className="flex items-start gap-3 mb-3">
            <div className="h-10 w-10 rounded-lg bg-primary/15 text-primary flex items-center justify-center shrink-0">
              <Sparkles className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <h3 className="heading-2">Projeção fim de mês</h3>
              <p className="caption">
                Receita atual + pipeline × taxa de conversão histórica ({data.taxa_conversao.toFixed(0)}%)
              </p>
            </div>
            <div className="text-right">
              <div className="display-2 text-primary">{fmt(projecaoFim)}</div>
              <div className="caption">cenário realista</div>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3 mt-4 pt-4 border-t border-border/50">
            <div>
              <div className="caption">Pessimista (50% do pipeline)</div>
              <div className="text-lg font-bold tabular-nums text-foreground">
                {fmt(data.receita_mes_atual + data.pipeline_valor * 0.5)}
              </div>
            </div>
            <div>
              <div className="caption">Realista ({data.taxa_conversao.toFixed(0)}% do pipeline)</div>
              <div className="text-lg font-bold tabular-nums text-primary">{fmt(projecaoFim)}</div>
            </div>
            <div>
              <div className="caption">Otimista (100% do pipeline)</div>
              <div className="text-lg font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                {fmt(data.receita_mes_atual + data.pipeline_valor)}
              </div>
            </div>
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="label-uppercase">Taxa de conversão</span>
            <Target className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="display-2 text-foreground">{data.taxa_conversao.toFixed(0)}%</div>
          <p className="caption mt-2">orçamentos enviados → fechados (últimos 6 meses)</p>
          <div className="mt-4 h-2 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-primary/60 to-primary transition-all"
              style={{ width: `${Math.min(data.taxa_conversao, 100)}%` }}
            />
          </div>
        </Card>
      </div>

      {/* Gráfico receita 6 meses */}
      <Card className="p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="heading-2">Receita últimos 6 meses</h3>
            <p className="caption">Lançamentos efetivamente pagos</p>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={data.receita_6m}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis dataKey="mes_label" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `R$ ${(v / 1000).toFixed(0)}k`} />
            <Tooltip
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null;
                const valor = payload[0]?.value as number;
                return (
                  <div className="bg-popover border border-border rounded-lg p-3 shadow-lg">
                    <div className="text-xs text-muted-foreground">{label}</div>
                    <div className="text-base font-bold tabular-nums">{fmt(valor)}</div>
                  </div>
                );
              }}
              cursor={{ fill: 'hsl(var(--muted))' }}
            />
            <Bar dataKey="receita" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Card>

      {/* Próximas mensalidades (Recurring Billing D-5) */}
      {data.proximas_mensalidades.length > 0 && (
        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="heading-2 flex items-center gap-2">
                <Repeat className="h-5 w-5 text-primary" />
                Próximas mensalidades
              </h3>
              <p className="caption">Recurring billing — gera D-5 do vencimento automaticamente</p>
            </div>
          </div>
          <div className="space-y-1.5">
            {data.proximas_mensalidades.map(m => {
              const isD5 = m.dias_ate_vencimento === 5;
              const proximoD5 = m.dias_ate_vencimento > 5;
              return (
                <button
                  key={m.id}
                  onClick={() => navigate(`/clientes/${m.id}`)}
                  className="w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-md hover:bg-muted/50 transition-colors text-left"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={cn(
                      "h-8 w-8 rounded-full flex items-center justify-center shrink-0",
                      m.ja_gerada_no_mes ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                      : isD5 ? "bg-primary/15 text-primary"
                      : "bg-muted text-muted-foreground"
                    )}>
                      {m.ja_gerada_no_mes ? <CheckCircle2 className="h-4 w-4" /> : <Clock className="h-4 w-4" />}
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">{m.apelido || m.nome}</div>
                      <div className="caption">
                        Vence dia {m.dia_vencimento}
                        {' · '}
                        {m.ja_gerada_no_mes ? 'Já gerada este mês' :
                          isD5 ? 'Gera hoje' :
                          proximoD5 ? `Gera em ${m.dias_ate_vencimento - 5}d` :
                          `Em ${m.dias_ate_vencimento}d`}
                      </div>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-sm font-semibold tabular-nums text-primary">
                      {fmt(m.mensalidade)}
                    </div>
                    {m.ja_gerada_no_mes && (
                      <div className="caption text-emerald-600 dark:text-emerald-400 font-medium">✓ ok</div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </Card>
      )}

      {/* Listas: Top mensalistas + Clientes em risco */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="heading-2 flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                Top Mensalistas
              </h3>
              <p className="caption">Maiores contribuintes do MRR</p>
            </div>
          </div>
          {data.top_mensalistas.length === 0 ? (
            <EmptyState
              variant="inline"
              icon={Repeat}
              title="Nenhum mensalista ainda"
              description="Cadastre clientes tipo Mensalista pra ver aqui."
            />
          ) : (
            <div className="space-y-2">
              {data.top_mensalistas.map((c, idx) => (
                <button
                  key={c.id}
                  onClick={() => navigate(`/clientes/${c.id}`)}
                  className="w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-md hover:bg-muted/60 transition-colors text-left"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-7 w-7 rounded-full bg-primary/15 text-primary flex items-center justify-center text-xs font-bold shrink-0">
                      {idx + 1}
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">{c.apelido || c.nome}</div>
                      {c.dia_vencimento && (
                        <div className="caption">Vence dia {c.dia_vencimento}</div>
                      )}
                    </div>
                  </div>
                  <div className="text-sm font-semibold tabular-nums text-primary shrink-0">
                    {fmt(c.mensalidade)}
                  </div>
                </button>
              ))}
            </div>
          )}
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="heading-2 flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-destructive" />
                Clientes em risco
              </h3>
              <p className="caption">Com lançamentos vencidos</p>
            </div>
          </div>
          {data.clientes_risco.length === 0 ? (
            <EmptyState
              variant="inline"
              icon={DollarSign}
              title="Tudo em dia!"
              description="Nenhum cliente com vencidos no momento."
            />
          ) : (
            <div className="space-y-2">
              {data.clientes_risco.map(c => (
                <button
                  key={c.id}
                  onClick={() => navigate(`/clientes/${c.id}`)}
                  className="w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-md hover:bg-destructive/5 transition-colors text-left"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-7 w-7 rounded-full bg-destructive/15 text-destructive flex items-center justify-center text-xs font-bold shrink-0">
                      !
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">{c.apelido || c.nome}</div>
                      <div className="caption">
                        {c.qtd_lancamentos} pendência{c.qtd_lancamentos !== 1 ? 's' : ''} · atraso máx {c.dias_atraso_max}d
                      </div>
                    </div>
                  </div>
                  <div className={cn('text-sm font-semibold tabular-nums shrink-0', c.dias_atraso_max > 30 ? 'text-destructive' : 'text-amber-600 dark:text-amber-400')}>
                    {fmt(c.total_vencido)}
                  </div>
                </button>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
