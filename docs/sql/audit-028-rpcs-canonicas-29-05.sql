-- =============================================
-- AUDIT-028 (29/05/2026) — RPCs órfãs versionadas no repo
-- =============================================
-- 3 RPCs estavam em produção mas sem SQL correspondente em docs/sql/.
-- Risco: refactor poderia deletá-las silenciosamente.
-- Este arquivo é a fonte oficial — capturado do estado em prod 29/05.
-- =============================================

-- ────────────────────────────────────────────────
-- 1) calcular_vencimento(p_cliente_id uuid) RETURNS date
-- ────────────────────────────────────────────────
-- Calcula próxima data de vencimento de cobrança baseado em:
-- - MENSALISTA: dia_vencimento_mensal ou vencimento configurado
-- - AVULSO: created_at + dia_cobranca (default 3 dias)
-- Usado em: asaas-webhook-index.ts:778 (sync de vencimentos)
CREATE OR REPLACE FUNCTION public.calcular_vencimento(p_cliente_id uuid)
 RETURNS date
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'public'
AS $function$
DECLARE
  v_cliente         RECORD;
  v_dia             INTEGER;
  v_inicio_mes      DATE;
  v_inicio_prox_mes DATE;
  v_ultimo_dia_mes  INTEGER;
  v_ultimo_dia_prox INTEGER;
  v_dia_efetivo     INTEGER;
BEGIN
  SELECT * INTO v_cliente FROM public.clientes WHERE id = p_cliente_id;
  IF NOT FOUND THEN
    RETURN CURRENT_DATE + 4;
  END IF;

  IF v_cliente.tipo = 'MENSALISTA' THEN
    v_dia := COALESCE(v_cliente.vencimento, v_cliente.dia_vencimento_mensal, 10);

    -- Clampa ao intervalo válido antes de qualquer cálculo
    IF v_dia < 1 THEN v_dia := 1; END IF;
    IF v_dia > 31 THEN v_dia := 31; END IF;

    v_inicio_mes      := DATE_TRUNC('month', CURRENT_DATE)::DATE;
    v_inicio_prox_mes := (v_inicio_mes + INTERVAL '1 month')::DATE;

    -- Último dia do mês corrente e do próximo
    v_ultimo_dia_mes  := EXTRACT(DAY FROM (v_inicio_prox_mes - INTERVAL '1 day'))::INTEGER;
    v_ultimo_dia_prox := EXTRACT(DAY FROM (v_inicio_prox_mes + INTERVAL '1 month' - INTERVAL '1 day'))::INTEGER;

    IF EXTRACT(DAY FROM CURRENT_DATE) < v_dia THEN
      -- Mês corrente: clampa dia ao último do mês (ex.: dia 31 em fev → dia 28/29)
      v_dia_efetivo := LEAST(v_dia, v_ultimo_dia_mes);
      RETURN (v_inicio_mes + (v_dia_efetivo - 1) * INTERVAL '1 day')::DATE;
    ELSE
      -- Próximo mês: mesma lógica
      v_dia_efetivo := LEAST(v_dia, v_ultimo_dia_prox);
      RETURN (v_inicio_prox_mes + (v_dia_efetivo - 1) * INTERVAL '1 day')::DATE;
    END IF;
  END IF;

  RETURN CURRENT_DATE + COALESCE(v_cliente.dia_cobranca, 3);
END;
$function$;

-- ────────────────────────────────────────────────
-- 2) mark_cobranca_visualizada(p_token text) RETURNS void
-- ────────────────────────────────────────────────
-- Marca cobrança como visualizada via link público (idempotente).
-- Usado em: asaas-webhook-index.ts:241, CobrancaPublica.tsx (autorefresh)
CREATE OR REPLACE FUNCTION public.mark_cobranca_visualizada(p_token text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE public.cobrancas c
  SET visualizada_em = COALESCE(c.visualizada_em, NOW())
  WHERE c.share_token = p_token AND c.status IN ('ativa', 'vencida');
END;
$function$;

GRANT EXECUTE ON FUNCTION public.mark_cobranca_visualizada(text) TO anon;
GRANT EXECUTE ON FUNCTION public.mark_cobranca_visualizada(text) TO authenticated;

-- ────────────────────────────────────────────────
-- 3) reverter_boas_vindas(p_cliente_id uuid) RETURNS void
-- ────────────────────────────────────────────────
-- Reverte flag desconto_boas_vindas_aplicado de cliente.
-- Usado em: ClienteDetalhe.tsx (botão "Reverter boas-vindas")
CREATE OR REPLACE FUNCTION public.reverter_boas_vindas(p_cliente_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE public.clientes
     SET desconto_boas_vindas_aplicado = false,
         updated_at = NOW()
   WHERE id = p_cliente_id
     AND empresa_id = public.get_empresa_id();
END;
$function$;

GRANT EXECUTE ON FUNCTION public.reverter_boas_vindas(uuid) TO authenticated;

-- =============================================
-- Done. Agora estão versionadas — refactor não deleta acidentalmente.
-- =============================================
