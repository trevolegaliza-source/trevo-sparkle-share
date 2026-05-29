-- ════════════════════════════════════════════════════════════════════════════
-- FIN-005 · Dashboard financeiro decisional — 27/05/2026
-- ════════════════════════════════════════════════════════════════════════════
-- 4 views novas que respondem perguntas que o CFO/master da Trevo precisa:
--
--   1. v_financeiro_dso             — Days Sales Outstanding (média de dias até receber)
--   2. v_financeiro_churn_mensal    — clientes que pararam de pagar nos últimos 90d
--   3. v_financeiro_forecast        — receita esperada 30/60/90 dias (cobrança em aberto)
--   4. v_financeiro_top10_clientes  — concentração de risco (top 10 por receita)
--
-- Todas SECURITY INVOKER + filtram por empresa via RLS (usa supabase auth).
-- ════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────
-- 1. DSO (Days Sales Outstanding)
-- ─────────────────────────────────────────────────────────────────────────
-- Quantos dias em média entre emissão da cobrança e recebimento? Mede
-- "velocidade de cash" — quanto menor, melhor.
CREATE OR REPLACE VIEW public.v_financeiro_dso
WITH (security_invoker = on) AS
SELECT
  c.empresa_id,
  ROUND(AVG(EXTRACT(EPOCH FROM (c.asaas_pago_em - c.created_at)) / 86400)::numeric, 1) AS dso_dias,
  COUNT(*) AS amostra_cobrancas,
  MIN(c.created_at) AS desde
FROM public.cobrancas c
WHERE c.asaas_pago_em IS NOT NULL
  AND c.created_at >= (NOW() - INTERVAL '6 months')
GROUP BY c.empresa_id;

COMMENT ON VIEW public.v_financeiro_dso IS
  'FIN-005 (27/05): DSO médio dos últimos 6 meses. Velocidade de cash.';

-- ─────────────────────────────────────────────────────────────────────────
-- 2. Churn mensal (clientes que pararam de pagar)
-- ─────────────────────────────────────────────────────────────────────────
-- Cliente que pagou em algum mês dos últimos 6 mas NÃO pagou no último mês
-- conta como churn. Detalhe: considera só clientes que JÁ TIVERAM pagamento
-- (excluindo prospects sem histórico).
CREATE OR REPLACE VIEW public.v_financeiro_churn_mensal
WITH (security_invoker = on) AS
WITH clientes_ativos_recentes AS (
  SELECT
    l.cliente_id,
    c.empresa_id,
    MAX(l.data_pagamento) AS ultimo_pagamento
  FROM public.lancamentos l
  JOIN public.clientes c ON c.id = l.cliente_id
  WHERE l.tipo = 'receber'
    AND l.status = 'pago'
    AND l.data_pagamento >= (CURRENT_DATE - INTERVAL '6 months')
  GROUP BY l.cliente_id, c.empresa_id
)
SELECT
  empresa_id,
  COUNT(*) FILTER (WHERE ultimo_pagamento >= (CURRENT_DATE - INTERVAL '30 days')) AS ativos_ultimo_mes,
  COUNT(*) FILTER (WHERE ultimo_pagamento < (CURRENT_DATE - INTERVAL '30 days')
                      AND ultimo_pagamento >= (CURRENT_DATE - INTERVAL '90 days')) AS churn_1_3_meses,
  COUNT(*) FILTER (WHERE ultimo_pagamento < (CURRENT_DATE - INTERVAL '90 days')) AS churn_3_plus_meses,
  ROUND(
    100.0 * COUNT(*) FILTER (WHERE ultimo_pagamento < (CURRENT_DATE - INTERVAL '30 days'))
    / NULLIF(COUNT(*), 0), 1
  ) AS churn_rate_pct,
  COUNT(*) AS total_clientes_periodo
FROM clientes_ativos_recentes
GROUP BY empresa_id;

COMMENT ON VIEW public.v_financeiro_churn_mensal IS
  'FIN-005 (27/05): churn = clientes que pagaram nos últimos 6m mas não no último mês. Taxa em %.';

-- ─────────────────────────────────────────────────────────────────────────
-- 3. Forecast 30/60/90 (receita esperada)
-- ─────────────────────────────────────────────────────────────────────────
-- Cobrança em aberto agrupada por janela de vencimento — projeção de cash
-- assumindo que tudo é pago no vencimento (sem desconto pra atraso).
CREATE OR REPLACE VIEW public.v_financeiro_forecast
WITH (security_invoker = on) AS
SELECT
  c.empresa_id,
  COALESCE(SUM(c.total_geral) FILTER (WHERE c.data_vencimento <= (CURRENT_DATE + INTERVAL '30 days')), 0) AS receita_30d,
  COALESCE(SUM(c.total_geral) FILTER (WHERE c.data_vencimento <= (CURRENT_DATE + INTERVAL '60 days')), 0) AS receita_60d,
  COALESCE(SUM(c.total_geral) FILTER (WHERE c.data_vencimento <= (CURRENT_DATE + INTERVAL '90 days')), 0) AS receita_90d,
  COALESCE(SUM(c.total_geral) FILTER (WHERE c.data_vencimento < CURRENT_DATE), 0) AS receita_vencida,
  COUNT(*) FILTER (WHERE c.data_vencimento < CURRENT_DATE) AS qtd_cobrancas_vencidas,
  COALESCE(SUM(c.total_geral), 0) AS receita_total_aberta
FROM public.cobrancas c
WHERE c.status IN ('ativa', 'vencida')
  AND c.asaas_pago_em IS NULL
GROUP BY c.empresa_id;

COMMENT ON VIEW public.v_financeiro_forecast IS
  'FIN-005 (27/05): forecast 30/60/90d de receita baseado em cobrancas em aberto. Inclui valor vencido (atrasado).';

-- ─────────────────────────────────────────────────────────────────────────
-- 4. Top 10 clientes (concentração de risco)
-- ─────────────────────────────────────────────────────────────────────────
-- Soma receita realizada (paga) dos últimos 12 meses por cliente. Top 10
-- mostra concentração — se 1 cliente é 40% da receita, risco enorme.
CREATE OR REPLACE VIEW public.v_financeiro_top10_clientes
WITH (security_invoker = on) AS
SELECT
  c.empresa_id,
  c.id AS cliente_id,
  c.nome AS cliente_nome,
  c.apelido AS cliente_apelido,
  COALESCE(SUM(l.valor), 0) AS receita_12m,
  COUNT(l.id) AS qtd_lancamentos,
  c.score_pagamento,
  RANK() OVER (PARTITION BY c.empresa_id ORDER BY COALESCE(SUM(l.valor), 0) DESC) AS rank
FROM public.clientes c
LEFT JOIN public.lancamentos l
  ON l.cliente_id = c.id
 AND l.tipo = 'receber'
 AND l.status = 'pago'
 AND l.data_pagamento >= (CURRENT_DATE - INTERVAL '12 months')
GROUP BY c.empresa_id, c.id, c.nome, c.apelido, c.score_pagamento
HAVING COALESCE(SUM(l.valor), 0) > 0;

COMMENT ON VIEW public.v_financeiro_top10_clientes IS
  'FIN-005 (27/05): ranking por receita 12m. Usar com LIMIT 10 + WHERE empresa_id = X. Identifica concentração de risco.';

COMMIT;

-- ─────────────────────────────────────────────────────────────────────────
-- Verificação (rodar como usuário autenticado)
-- ─────────────────────────────────────────────────────────────────────────
SELECT 'v_financeiro_dso' as view, EXISTS(SELECT 1 FROM pg_views WHERE schemaname='public' AND viewname='v_financeiro_dso') as ok
UNION ALL
SELECT 'v_financeiro_churn_mensal', EXISTS(SELECT 1 FROM pg_views WHERE schemaname='public' AND viewname='v_financeiro_churn_mensal')
UNION ALL
SELECT 'v_financeiro_forecast', EXISTS(SELECT 1 FROM pg_views WHERE schemaname='public' AND viewname='v_financeiro_forecast')
UNION ALL
SELECT 'v_financeiro_top10_clientes', EXISTS(SELECT 1 FROM pg_views WHERE schemaname='public' AND viewname='v_financeiro_top10_clientes');
