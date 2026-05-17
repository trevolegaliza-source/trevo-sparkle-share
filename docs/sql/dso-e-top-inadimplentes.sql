-- =============================================
-- DSO + Top Inadimplentes (17/05/2026 — Onda 8 pré-viagem)
-- =============================================
-- Pra Letícia ter visibilidade sólida de inadimplência enquanto Thales
-- viaja, sem precisar puxar relatório manual. 2 RPCs SECURITY DEFINER
-- filtrando por empresa_id automaticamente, alimentam 2 KPICards no
-- Dashboard.
--
-- 1) calcular_dso(p_dias_lookback int) — Days Sales Outstanding
--    DSO = média de dias entre data_vencimento e data_pagamento (lançamentos
--    pagos no período). Pra lançamentos ainda pendentes, conta até HOJE.
--    Retorna jsonb com 3 valores: geral, só pagos, só em aberto.
--
-- 2) top_inadimplentes(p_limit int) — ranking dos piores pagadores
--    Lista clientes com lançamentos vencidos não pagos, ordenado por
--    valor em atraso. Retorna jsonb array.
--
-- Idempotente: CREATE OR REPLACE. Não cria tabelas — só funções.
-- =============================================

-- =============================================
-- RPC 1: calcular_dso
-- =============================================
CREATE OR REPLACE FUNCTION public.calcular_dso(
  p_dias_lookback int DEFAULT 90
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_empresa_id uuid;
  v_dso_geral numeric;
  v_dso_pagos numeric;
  v_dso_em_aberto numeric;
  v_total_lancs int;
  v_data_corte date;
BEGIN
  v_empresa_id := public.get_empresa_id();
  IF v_empresa_id IS NULL THEN
    RAISE EXCEPTION 'Usuário sem empresa associada';
  END IF;

  v_data_corte := CURRENT_DATE - (p_dias_lookback || ' days')::interval;

  -- DSO geral: todos lançamentos receber com vencimento >= data_corte
  --   pagos → dias entre vencimento e pagamento
  --   em aberto → dias entre vencimento e HOJE (negativo se ainda no prazo)
  SELECT
    ROUND(AVG(
      CASE
        WHEN status = 'pago' AND data_pagamento IS NOT NULL
          THEN (data_pagamento - data_vencimento)::numeric
        ELSE (CURRENT_DATE - data_vencimento)::numeric
      END
    )::numeric, 1),
    ROUND(AVG(
      CASE WHEN status = 'pago' AND data_pagamento IS NOT NULL
        THEN (data_pagamento - data_vencimento)::numeric
      END
    )::numeric, 1),
    ROUND(AVG(
      CASE WHEN status <> 'pago' AND data_vencimento < CURRENT_DATE
        THEN (CURRENT_DATE - data_vencimento)::numeric
      END
    )::numeric, 1),
    count(*)
  INTO v_dso_geral, v_dso_pagos, v_dso_em_aberto, v_total_lancs
  FROM public.lancamentos
  WHERE empresa_id = v_empresa_id
    AND tipo = 'receber'
    AND data_vencimento >= v_data_corte;

  RETURN jsonb_build_object(
    'dso_geral', COALESCE(v_dso_geral, 0),
    'dso_pagos', COALESCE(v_dso_pagos, 0),
    'dso_em_aberto', COALESCE(v_dso_em_aberto, 0),
    'total_lancamentos', COALESCE(v_total_lancs, 0),
    'dias_lookback', p_dias_lookback
  );
END;
$$;

COMMENT ON FUNCTION public.calcular_dso IS
'DSO (Days Sales Outstanding) — média de dias entre vencimento e pagamento. Pra lancamentos em aberto, conta até hoje. Filtra por empresa do caller (SECURITY DEFINER).';

-- Permissão: gerente + financeiro + master executam
REVOKE ALL ON FUNCTION public.calcular_dso(int) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.calcular_dso(int) TO authenticated;

-- =============================================
-- RPC 2: top_inadimplentes
-- =============================================
CREATE OR REPLACE FUNCTION public.top_inadimplentes(
  p_limit int DEFAULT 5
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_empresa_id uuid;
  v_resultado jsonb;
BEGIN
  v_empresa_id := public.get_empresa_id();
  IF v_empresa_id IS NULL THEN
    RAISE EXCEPTION 'Usuário sem empresa associada';
  END IF;

  WITH ranking AS (
    SELECT
      l.cliente_id,
      c.nome AS cliente_nome,
      c.apelido AS cliente_apelido,
      count(*) AS qtd_lancs_atraso,
      SUM(l.valor) AS valor_total,
      MAX(CURRENT_DATE - l.data_vencimento) AS dias_max_atraso
    FROM public.lancamentos l
    JOIN public.clientes c ON c.id = l.cliente_id
    WHERE l.empresa_id = v_empresa_id
      AND l.tipo = 'receber'
      AND l.status <> 'pago'
      AND l.data_vencimento < CURRENT_DATE
      AND c.is_archived = false
    GROUP BY l.cliente_id, c.nome, c.apelido
    ORDER BY valor_total DESC
    LIMIT p_limit
  )
  SELECT jsonb_agg(jsonb_build_object(
    'cliente_id', cliente_id,
    'cliente_nome', cliente_nome,
    'cliente_apelido', cliente_apelido,
    'qtd_lancs_atraso', qtd_lancs_atraso,
    'valor_total', valor_total,
    'dias_max_atraso', dias_max_atraso
  ) ORDER BY valor_total DESC)
  INTO v_resultado
  FROM ranking;

  RETURN COALESCE(v_resultado, '[]'::jsonb);
END;
$$;

COMMENT ON FUNCTION public.top_inadimplentes IS
'Top N clientes com lançamentos vencidos não pagos, ordenado por valor em atraso. Filtra por empresa do caller (SECURITY DEFINER) + ignora clientes arquivados.';

REVOKE ALL ON FUNCTION public.top_inadimplentes(int) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.top_inadimplentes(int) TO authenticated;

-- =============================================
-- Smoke test (opcional)
-- Roda como master/gerente pra ver dados reais
-- =============================================
-- SELECT public.calcular_dso(90);
-- SELECT public.top_inadimplentes(5);
