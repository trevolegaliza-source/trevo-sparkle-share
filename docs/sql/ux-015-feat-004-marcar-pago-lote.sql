-- =============================================
-- UX-015 + FEAT-004 (13/05/2026): marcar_pago_em_lote + desfazer_marcar_pago
-- =============================================
-- Consolida os 3 caminhos divergentes de "marcar pago" identificados na
-- auditoria:
--   (a) MarcarPagoProcessoModal — modal com data, via RPC marcar_processo_pago.
--       Atomico, com tenant check. (única já correta)
--   (b) ContasReceberLista.handleMarcarLote — bulk, data=hoje hardcoded,
--       sem confirmação, via supabase.from('lancamentos').update direto.
--       Sem tenant check.
--   (c) FinanceiroList.handleDesfazerPagamento — UPDATE bruto via
--       supabase, sem RPC, sem tenant check.
--
-- Novas RPCs:
--   - `marcar_pago_em_lote(p_lancamento_ids uuid[], p_data_pagamento date)`
--     Substitui (b). Tenant check + anti-rebaixamento + atomicidade.
--   - `desfazer_marcar_pago(p_processo_id uuid)`
--     Substitui (c). Tenant check + bloqueio se etapa pós-pago.
--
-- (a) já está correta e usa RPC existente — sem mudança.
-- =============================================

CREATE OR REPLACE FUNCTION public.marcar_pago_em_lote(
  p_lancamento_ids uuid[],
  p_data_pagamento date
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_empresa_id uuid;
  v_count_lanc int;
  v_count_proc int;
BEGIN
  v_empresa_id := public.get_empresa_id();
  IF v_empresa_id IS NULL THEN
    RAISE EXCEPTION 'Usuário sem empresa associada';
  END IF;
  IF p_lancamento_ids IS NULL OR array_length(p_lancamento_ids, 1) IS NULL THEN
    RAISE EXCEPTION 'Lista de lançamentos vazia';
  END IF;
  IF p_data_pagamento IS NULL THEN
    RAISE EXCEPTION 'Data de pagamento é obrigatória';
  END IF;

  -- Defesa: todos os lancamento_ids devem ser da empresa
  IF EXISTS (
    SELECT 1 FROM public.lancamentos
    WHERE id = ANY(p_lancamento_ids)
      AND empresa_id <> v_empresa_id
  ) THEN
    RAISE EXCEPTION 'Algum lançamento não pertence à sua empresa';
  END IF;

  -- Marca pagos (só lancamentos receber pendentes — anti-rebaixamento)
  UPDATE public.lancamentos
     SET status = 'pago'::public.status_financeiro,
         etapa_financeiro = 'honorario_pago',
         data_pagamento = p_data_pagamento,
         confirmado_recebimento = true,
         updated_at = NOW()
   WHERE id = ANY(p_lancamento_ids)
     AND tipo = 'receber'
     AND empresa_id = v_empresa_id
     AND status <> 'pago';
  GET DIAGNOSTICS v_count_lanc = ROW_COUNT;

  -- Promove processos vinculados pra 'finalizados'
  UPDATE public.processos
     SET etapa = 'finalizados',
         updated_at = NOW()
   WHERE id IN (
     SELECT DISTINCT processo_id
       FROM public.lancamentos
      WHERE id = ANY(p_lancamento_ids)
        AND processo_id IS NOT NULL
   )
     AND empresa_id = v_empresa_id
     AND etapa <> 'finalizados';
  GET DIAGNOSTICS v_count_proc = ROW_COUNT;

  RETURN jsonb_build_object(
    'ok', true,
    'lancamentos_pagos', v_count_lanc,
    'processos_finalizados', v_count_proc
  );
END;
$function$;

COMMENT ON FUNCTION public.marcar_pago_em_lote(uuid[], date) IS
  'UX-015 + FEAT-004 (13/05/2026): substitui ContasReceberLista.handleMarcarLote (bulk sem tenant check + data hardcoded). Atomico, com tenant check e anti-rebaixamento.';

REVOKE EXECUTE ON FUNCTION public.marcar_pago_em_lote(uuid[], date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.marcar_pago_em_lote(uuid[], date) TO authenticated;


-- ╔══════════════════════════════════════════════════════════════╗
-- ║ desfazer_marcar_pago — substitui FinanceiroList.handleDesfazerPagamento ║
-- ╚══════════════════════════════════════════════════════════════╝

CREATE OR REPLACE FUNCTION public.desfazer_marcar_pago(
  p_processo_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_empresa_id uuid;
  v_processo_empresa uuid;
  v_count int;
BEGIN
  v_empresa_id := public.get_empresa_id();
  IF v_empresa_id IS NULL THEN
    RAISE EXCEPTION 'Usuário sem empresa associada';
  END IF;

  SELECT empresa_id INTO v_processo_empresa
    FROM public.processos
   WHERE id = p_processo_id;
  IF v_processo_empresa IS NULL THEN
    RAISE EXCEPTION 'Processo não encontrado';
  END IF;
  IF v_processo_empresa <> v_empresa_id THEN
    RAISE EXCEPTION 'Processo não pertence à sua empresa';
  END IF;

  -- Bloqueio: não desfaz se algum lancamento desse processo já teve
  -- extrato gerado (cobranca_enviada). Senão o cliente já viu cobrança
  -- "paga" e mudaria pra "pendente" — confunde.
  IF EXISTS (
    SELECT 1 FROM public.lancamentos
    WHERE processo_id = p_processo_id
      AND status = 'pago'
      AND etapa_financeiro = 'cobranca_enviada'
  ) THEN
    RAISE EXCEPTION 'Cobrança já foi enviada ao cliente. Não dá pra desfazer pagamento sem antes anular a cobrança.';
  END IF;

  UPDATE public.lancamentos
     SET status = 'pendente'::public.status_financeiro,
         etapa_financeiro = 'solicitacao_criada',
         data_pagamento = NULL,
         confirmado_recebimento = false,
         updated_at = NOW()
   WHERE processo_id = p_processo_id
     AND status = 'pago'
     AND empresa_id = v_empresa_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;

  -- Processo volta pra etapa anterior (cliente vê de novo em "A Cobrar")
  UPDATE public.processos
     SET etapa = 'recebidos',
         updated_at = NOW()
   WHERE id = p_processo_id
     AND empresa_id = v_empresa_id;

  RETURN jsonb_build_object(
    'ok', true,
    'lancamentos_revertidos', v_count
  );
END;
$function$;

COMMENT ON FUNCTION public.desfazer_marcar_pago(uuid) IS
  'UX-015 + FEAT-004 (13/05/2026): substitui FinanceiroList.handleDesfazerPagamento (UPDATE sem tenant check). Bloqueia se cobrança já foi enviada.';

REVOKE EXECUTE ON FUNCTION public.desfazer_marcar_pago(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.desfazer_marcar_pago(uuid) TO authenticated;
