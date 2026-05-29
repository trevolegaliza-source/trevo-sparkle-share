-- ════════════════════════════════════════════════════════════════════════════
-- FIN-004 · Score de pagamento por cliente — 27/05/2026 (noite)
-- ════════════════════════════════════════════════════════════════════════════
-- Hoje você não sabe quem paga em dia e quem atrasa estruturalmente.
-- Esse score sai de pure lógica: média de atraso (dias) nos pagamentos
-- dos últimos 6 meses transformada em score 0-100 (100=excelente).
--
-- Score recomputado:
--   - Trigger AFTER UPDATE em lancamentos quando status muda pra 'pago'
--   - Função recalcular_score_pagamento_cliente(uuid) chamável manual
--   - Backfill imediato dos clientes existentes
--
-- Fórmula:
--   atraso_medio = média(data_pagamento - data_vencimento) nos últimos 6m
--   score = max(0, min(100, 100 - atraso_medio * 5))
--
--   Exemplo: cliente paga em dia (atraso=0) → score 100
--            cliente atrasa 3 dias em média → score 85
--            cliente atrasa 10 dias em média → score 50
--            cliente atrasa 20+ dias → score 0
--
-- Threshold (UI usa pra cor do badge):
--   🟢 score >= 80    = "Paga em dia"
--   🟡 50 <= score < 80 = "Atrasa pouco"
--   🔴 score < 50      = "Risco — atrasos frequentes"
-- ════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────
-- 1. Colunas novas em clientes
-- ─────────────────────────────────────────────────────────────────────────
ALTER TABLE public.clientes
  ADD COLUMN IF NOT EXISTS score_pagamento integer
    CHECK (score_pagamento IS NULL OR (score_pagamento >= 0 AND score_pagamento <= 100)),
  ADD COLUMN IF NOT EXISTS atraso_medio_dias numeric(5,1),
  ADD COLUMN IF NOT EXISTS score_atualizado_em timestamp with time zone;

COMMENT ON COLUMN public.clientes.score_pagamento IS
  'FIN-004 (27/05): score 0-100 de pontualidade. 100=paga sempre em dia. Recalculado por trigger após cada pagamento. Janela: últimos 6 meses.';
COMMENT ON COLUMN public.clientes.atraso_medio_dias IS
  'FIN-004 (27/05): média (em dias) entre data_vencimento e data_pagamento dos lançamentos pagos nos últimos 6 meses. NULL se nunca pagou.';
COMMENT ON COLUMN public.clientes.score_atualizado_em IS
  'FIN-004 (27/05): timestamp do último recálculo do score (debugging).';

-- ─────────────────────────────────────────────────────────────────────────
-- 2. Função que recalcula score de UM cliente
-- ─────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.recalcular_score_pagamento_cliente(p_cliente_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_atraso_medio numeric;
  v_score integer;
  v_qtd integer;
BEGIN
  -- Calcula média de atraso nos últimos 6 meses
  SELECT
    AVG(GREATEST(0, EXTRACT(EPOCH FROM (data_pagamento::timestamp - data_vencimento::timestamp)) / 86400)),
    COUNT(*)
  INTO v_atraso_medio, v_qtd
  FROM public.lancamentos
  WHERE cliente_id = p_cliente_id
    AND tipo = 'receber'
    AND status = 'pago'
    AND data_pagamento IS NOT NULL
    AND data_vencimento IS NOT NULL
    AND data_pagamento >= (CURRENT_DATE - INTERVAL '6 months');

  -- Sem pagamentos suficientes na janela → NULL (UI esconde badge)
  IF v_qtd IS NULL OR v_qtd = 0 THEN
    UPDATE public.clientes
       SET score_pagamento = NULL,
           atraso_medio_dias = NULL,
           score_atualizado_em = NOW()
     WHERE id = p_cliente_id;
    RETURN jsonb_build_object('ok', true, 'score', null, 'qtd_lancamentos', 0);
  END IF;

  -- Fórmula: 100 - atraso * 5, clamped 0-100
  v_score := GREATEST(0, LEAST(100, ROUND(100 - COALESCE(v_atraso_medio, 0) * 5)::integer));

  UPDATE public.clientes
     SET score_pagamento = v_score,
         atraso_medio_dias = ROUND(COALESCE(v_atraso_medio, 0)::numeric, 1),
         score_atualizado_em = NOW()
   WHERE id = p_cliente_id;

  RETURN jsonb_build_object(
    'ok', true,
    'score', v_score,
    'atraso_medio_dias', ROUND(COALESCE(v_atraso_medio, 0)::numeric, 1),
    'qtd_lancamentos', v_qtd
  );
END;
$function$;

COMMENT ON FUNCTION public.recalcular_score_pagamento_cliente(uuid) IS
  'FIN-004 (27/05): recalcula score_pagamento do cliente baseado em lancamentos pagos nos últimos 6 meses.';

-- ─────────────────────────────────────────────────────────────────────────
-- 3. Trigger: quando lancamento vira pago, recalcula score do cliente
-- ─────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.trg_atualizar_score_pagamento()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Só dispara em transições pra 'pago' (não em outras mudanças de status)
  IF NEW.tipo <> 'receber' THEN RETURN NEW; END IF;
  IF NEW.status <> 'pago' THEN RETURN NEW; END IF;
  IF OLD.status = 'pago' AND OLD.data_pagamento IS NOT DISTINCT FROM NEW.data_pagamento THEN
    RETURN NEW; -- nada relevante mudou
  END IF;
  IF NEW.cliente_id IS NULL THEN RETURN NEW; END IF;

  -- Fail-soft: erro no recálculo não bloqueia o UPDATE original
  BEGIN
    PERFORM public.recalcular_score_pagamento_cliente(NEW.cliente_id);
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'trg_atualizar_score_pagamento falhou pra cliente %: %', NEW.cliente_id, SQLERRM;
  END;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_atualizar_score_pagamento_aft ON public.lancamentos;
CREATE TRIGGER trg_atualizar_score_pagamento_aft
  AFTER UPDATE ON public.lancamentos
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_atualizar_score_pagamento();

-- ─────────────────────────────────────────────────────────────────────────
-- 4. Backfill imediato — recalcula score de todos os clientes ativos
-- ─────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  c RECORD;
  v_count integer := 0;
BEGIN
  FOR c IN
    SELECT DISTINCT cliente_id
    FROM public.lancamentos
    WHERE tipo = 'receber'
      AND status = 'pago'
      AND cliente_id IS NOT NULL
  LOOP
    PERFORM public.recalcular_score_pagamento_cliente(c.cliente_id);
    v_count := v_count + 1;
  END LOOP;
  RAISE NOTICE 'FIN-004 backfill: % clientes recalculados', v_count;
END $$;

COMMIT;

-- ─────────────────────────────────────────────────────────────────────────
-- Verificação
-- ─────────────────────────────────────────────────────────────────────────
SELECT
  CASE
    WHEN score_pagamento IS NULL THEN '⚪ Sem histórico'
    WHEN score_pagamento >= 80 THEN '🟢 Paga em dia'
    WHEN score_pagamento >= 50 THEN '🟡 Atrasa pouco'
    ELSE '🔴 Risco'
  END as faixa,
  COUNT(*) as total_clientes,
  ROUND(AVG(score_pagamento)::numeric, 1) as score_medio,
  ROUND(AVG(atraso_medio_dias)::numeric, 1) as atraso_medio
FROM public.clientes
GROUP BY 1
ORDER BY MIN(score_pagamento) DESC NULLS LAST;
