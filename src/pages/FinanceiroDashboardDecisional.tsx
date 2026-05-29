/**
 * FIN-005 (27/05/2026 noite): Dashboard financeiro decisional.
 *
 * Métricas que o CFO/master precisa pra decisão:
 * - DSO (Days Sales Outstanding) — média de dias até receber
 * - Churn mensal — clientes que pararam de pagar
 * - Forecast 30/60/90 dias — receita esperada baseado em cobranças em aberto
 * - Top 10 clientes — concentração de risco
 *
 * Todas via views v_financeiro_* criadas em
 * docs/sql/feature-fin-005-dashboard-decisional-27-05.sql.
 */
import { useEffect, useState } from 'react';
import { Loader2, TrendingUp, AlertTriangle, Users, Clock } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { Badge } from '@/components/ui/badge';

const fmtBRL = (v: number | null | undefined) =>
  Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

interface DsoData { dso_dias: number; amostra_cobrancas: number; }
interface ChurnData { ativos_ultimo_mes: number; churn_1_3_meses: number; churn_3_plus_meses: number; churn_rate_pct: number; total_clientes_periodo: number; }
interface ForecastData { receita_30d: number; receita_60d: number; receita_90d: number; receita_vencida: number; qtd_cobrancas_vencidas: number; receita_total_aberta: number; }
interface TopClienteData { cliente_id: string; cliente_nome: string; cliente_apelido: string | null; receita_12m: number; qtd_lancamentos: number; score_pagamento: number | null; rank: number; }

export default function FinanceiroDashboardDecisional() {
  const [loading, setLoading] = useState(true);
  const [dso, setDso] = useState<DsoData | null>(null);
  const [churn, setChurn] = useState<ChurnData | null>(null);
  const [forecast, setForecast] = useState<ForecastData | null>(null);
  const [top10, setTop10] = useState<TopClienteData[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const [dsoRes, churnRes, forecastRes, topRes] = await Promise.all([
          supabase.from('v_financeiro_dso' as any).select('*').maybeSingle(),
          supabase.from('v_financeiro_churn_mensal' as any).select('*').maybeSingle(),
          supabase.from('v_financeiro_forecast' as any).select('*').maybeSingle(),
          supabase.from('v_financeiro_top10_clientes' as any).select('*').order('rank', { ascending: true }).limit(10),
        ]);
        setDso((dsoRes.data as any) || null);
        setChurn((churnRes.data as any) || null);
        setForecast((forecastRes.data as any) || null);
        setTop10((topRes.data as any[]) || []);
      } catch (e) {
        console.error('[dashboard decisional] erro:', e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Concentração de risco: % do top1 sobre receita total dos top10
  const receitaTotalTop10 = top10.reduce((s, c) => s + Number(c.receita_12m), 0);
  const concentracaoTop1 = top10[0] && receitaTotalTop10 > 0
    ? Math.round((Number(top10[0].receita_12m) / receitaTotalTop10) * 100)
    : 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="📊 Dashboard Decisional"
        subtitle="DSO, churn, forecast e concentração de risco — decisões financeiras com dado, não feeling."
      />

      {/* ─── KPIs principais ─── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs text-muted-foreground uppercase tracking-wider">DSO</p>
              <Clock className="h-4 w-4 text-emerald-600 opacity-60" />
            </div>
            <p className="text-3xl font-bold text-emerald-600">
              {dso?.dso_dias ?? '—'}
              <span className="text-base font-normal text-muted-foreground ml-1">dias</span>
            </p>
            <p className="text-[10px] text-muted-foreground mt-1">
              Dias médios até receber {dso ? `(${dso.amostra_cobrancas} cobr.)` : ''}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Churn rate</p>
              <AlertTriangle className="h-4 w-4 text-amber-600 opacity-60" />
            </div>
            <p className={`text-3xl font-bold ${(churn?.churn_rate_pct ?? 0) > 10 ? 'text-rose-600' : (churn?.churn_rate_pct ?? 0) > 5 ? 'text-amber-600' : 'text-emerald-600'}`}>
              {churn?.churn_rate_pct?.toFixed(1) ?? '—'}<span className="text-base font-normal ml-0.5">%</span>
            </p>
            <p className="text-[10px] text-muted-foreground mt-1">
              {churn?.ativos_ultimo_mes ?? 0} ativos · {(churn?.churn_1_3_meses ?? 0) + (churn?.churn_3_plus_meses ?? 0)} pararam
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Receita 30d</p>
              <TrendingUp className="h-4 w-4 text-blue-600 opacity-60" />
            </div>
            <p className="text-3xl font-bold text-blue-600 tabular-nums">{fmtBRL(forecast?.receita_30d)}</p>
            <p className="text-[10px] text-muted-foreground mt-1">
              Forecast cobrança em aberto até 30 dias
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Vencido em aberto</p>
              <AlertTriangle className="h-4 w-4 text-rose-600 opacity-60" />
            </div>
            <p className="text-3xl font-bold text-rose-600 tabular-nums">{fmtBRL(forecast?.receita_vencida)}</p>
            <p className="text-[10px] text-muted-foreground mt-1">
              {forecast?.qtd_cobrancas_vencidas ?? 0} cobranças vencidas sem pagamento
            </p>
          </CardContent>
        </Card>
      </div>

      {/* ─── Forecast 30/60/90 ─── */}
      <Card>
        <CardContent className="p-6">
          <p className="text-sm font-semibold mb-4 flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-emerald-600" />
            Forecast acumulado 30 / 60 / 90 dias
          </p>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Próx. 30 dias</p>
              <p className="text-2xl font-bold tabular-nums">{fmtBRL(forecast?.receita_30d)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Próx. 60 dias</p>
              <p className="text-2xl font-bold tabular-nums">{fmtBRL(forecast?.receita_60d)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Próx. 90 dias</p>
              <p className="text-2xl font-bold tabular-nums">{fmtBRL(forecast?.receita_90d)}</p>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-4 italic">
            Total cobrança em aberto: <strong>{fmtBRL(forecast?.receita_total_aberta)}</strong>.
            Assume que tudo é pago no vencimento (sem desconto pra atraso).
          </p>
        </CardContent>
      </Card>

      {/* ─── Top 10 clientes por receita 12m ─── */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-semibold flex items-center gap-2">
              <Users className="h-4 w-4 text-emerald-600" />
              Top 10 clientes (receita últimos 12 meses)
            </p>
            {concentracaoTop1 > 0 && (
              <Badge variant="outline" className={
                concentracaoTop1 > 40 ? 'bg-rose-50 text-rose-700 border-rose-300' :
                concentracaoTop1 > 25 ? 'bg-amber-50 text-amber-700 border-amber-300' :
                                        'bg-emerald-50 text-emerald-700 border-emerald-300'
              }>
                Top 1 = {concentracaoTop1}% da receita Top10 {concentracaoTop1 > 40 ? '· concentração alta' : ''}
              </Badge>
            )}
          </div>

          {top10.length === 0 ? (
            <p className="text-sm text-muted-foreground italic">Nenhum cliente com receita realizada nos últimos 12 meses.</p>
          ) : (
            <div className="space-y-2">
              {top10.map((c) => (
                <div key={c.cliente_id} className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/30 transition-colors">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-sm font-mono text-muted-foreground w-6">{c.rank}º</span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{c.cliente_apelido || c.cliente_nome}</p>
                      <p className="text-[11px] text-muted-foreground">{c.qtd_lancamentos} lançamentos</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {c.score_pagamento != null && (
                      <Badge variant="outline" className={
                        c.score_pagamento >= 80 ? 'bg-emerald-50 text-emerald-700 border-emerald-300' :
                        c.score_pagamento >= 50 ? 'bg-amber-50 text-amber-700 border-amber-300' :
                                                  'bg-rose-50 text-rose-700 border-rose-300'
                      }>
                        Score {c.score_pagamento}
                      </Badge>
                    )}
                    <p className="text-sm font-bold tabular-nums w-28 text-right">{fmtBRL(Number(c.receita_12m))}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <p className="text-[10px] text-muted-foreground text-center">
        Dashboard gerado em tempo real via views v_financeiro_*. Refresh: F5.
      </p>
    </div>
  );
}
