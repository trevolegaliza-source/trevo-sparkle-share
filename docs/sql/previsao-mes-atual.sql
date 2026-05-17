-- =============================================
-- Previsão do Mês Atual (17/05/2026 — Onda 9 pré-viagem)
-- =============================================
-- Card no Dashboard que responde "vamos bater o mês?":
--   - quanto já recebemos
--   - quanto ainda tá pendente (vai cair se cliente pagar)
--   - quanto seria o total previsto se TUDO pendente virar pago
--   - meta histórica = média dos últimos 3 meses fechados
--   - % atingido vs meta
--   - dias restantes no mês
--   - veredito: "vai bater", "no limite", "abaixo"
--
-- Sem precisar configurar meta na UI — usa média histórica natural.
-- Quando virar config, é trocar a CTE `meta_calc` por SELECT da empresa.
--
-- SECURITY DEFINER + filtro por empresa_id automático.
-- =============================================

CREATE OR REPLACE FUNCTION public.prever_mes_atual()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_empresa_id uuid;
  v_inicio_mes date;
  v_fim_mes date;
  v_inicio_lookback date;
  v_recebido numeric;
  v_pendente numeric;
  v_previsto numeric;
  v_meta numeric;
  v_pct numeric;
  v_dias_restantes int;
  v_veredito text;
BEGIN
  v_empresa_id := public.get_empresa_id();
  IF v_empresa_id IS NULL THEN
    RAISE EXCEPTION 'Usuário sem empresa associada';
  END IF;

  v_inicio_mes := date_trunc('month', CURRENT_DATE)::date;
  v_fim_mes := (date_trunc('month', CURRENT_DATE) + INTERVAL '1 month - 1 day')::date;
  v_inicio_lookback := (date_trunc('month', CURRENT_DATE) - INTERVAL '3 months')::date;
  v_dias_restantes := GREATEST((v_fim_mes - CURRENT_DATE)::int, 0);

  -- Recebido no mês: lançamentos pagos com data_pagamento no mês atual
  SELECT COALESCE(SUM(valor), 0)::numeric INTO v_recebido
  FROM public.lancamentos
  WHERE empresa_id = v_empresa_id
    AND tipo = 'receber'
    AND status = 'pago'
    AND data_pagamento >= v_inicio_mes
    AND data_pagamento <= v_fim_mes;

  -- Pendente do mês: lançamentos NÃO pagos com data_vencimento no mês atual
  SELECT COALESCE(SUM(valor), 0)::numeric INTO v_pendente
  FROM public.lancamentos
  WHERE empresa_id = v_empresa_id
    AND tipo = 'receber'
    AND status <> 'pago'
    AND data_vencimento >= v_inicio_mes
    AND data_vencimento <= v_fim_mes;

  v_previsto := v_recebido + v_pendente;

  -- Meta histórica: média dos últimos 3 meses fechados (não inclui mês atual)
  SELECT COALESCE(AVG(total_mes), 0)::numeric INTO v_meta
  FROM (
    SELECT
      date_trunc('month', data_pagamento) AS mes,
      SUM(valor) AS total_mes
    FROM public.lancamentos
    WHERE empresa_id = v_empresa_id
      AND tipo = 'receber'
      AND status = 'pago'
      AND data_pagamento >= v_inicio_lookback
      AND data_pagamento < v_inicio_mes
    GROUP BY date_trunc('month', data_pagamento)
  ) hist;

  -- % atingido vs meta (sobre PREVISTO, não só recebido — mostra cenário otimista)
  IF v_meta > 0 THEN
    v_pct := ROUND((v_previsto / v_meta * 100)::numeric, 1);
  ELSE
    v_pct := 0;
  END IF;

  -- Veredito
  v_veredito := CASE
    WHEN v_meta = 0 THEN 'sem_historico'
    WHEN v_previsto >= v_meta * 1.05 THEN 'vai_bater_folgado'   -- 5%+ acima da meta
    WHEN v_previsto >= v_meta THEN 'vai_bater'                  -- bate exato ou pouco acima
    WHEN v_previsto >= v_meta * 0.90 THEN 'no_limite'           -- até 10% abaixo
    ELSE 'abaixo'                                                -- mais de 10% abaixo
  END;

  RETURN jsonb_build_object(
    'recebido_mes', v_recebido,
    'pendente_mes', v_pendente,
    'previsto_total', v_previsto,
    'meta_historica', v_meta,
    'pct_atingido', v_pct,
    'dias_restantes_mes', v_dias_restantes,
    'veredito', v_veredito
  );
END;
$$;

COMMENT ON FUNCTION public.prever_mes_atual IS
'Previsão "vai bater o mês?" — soma recebido + pendente do mês corrente, compara com média dos 3 meses fechados anteriores. Retorna jsonb com vereditos. SECURITY DEFINER filtra empresa do caller.';

REVOKE ALL ON FUNCTION public.prever_mes_atual() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.prever_mes_atual() TO authenticated;

-- Smoke (opcional, descomenta como master/gerente pra ver dados reais)
-- SELECT public.prever_mes_atual();
