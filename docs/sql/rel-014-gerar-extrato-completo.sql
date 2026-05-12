-- =============================================
-- REL-014 (13/05/2026 madrugada): gerar_extrato_completo (atômica)
-- =============================================
-- Substitui os 5 awaits sequenciais sem rollback de
-- ClienteAccordionFinanceiro.executarGeracaoExtrato. Atualmente o front:
--   1) Upload PDF pro Storage
--   2) INSERT extrato
--   3) for-loop UPDATE lancamentos (linka extrato + promove etapa)
--   4) INSERT cobranca
-- Se (4) falha, extrato + lancamentos atualizados existem sem cobrança e
-- toast.success engana o usuário.
--
-- Esta RPC consolida 2-4 numa transação. O upload do PDF continua no
-- client (Postgres não faz upload). O client agora chama 1 RPC após o
-- upload. Se a RPC falha, client deleta o PDF órfão.
--
-- Refinado com schemas reais do banco:
--   - extratos.empresa_id é NULLABLE com default get_empresa_id() (OK)
--   - cobrancas.share_token tem default gen_random_bytes(24) hex
--   - cobrancas.empresa_id é NOT NULL com default get_empresa_id()
--   - cobrancas tem triggers _sync_cobranca_lancamentos_junction +
--     _validate_cobranca_lancamento_ids — RPC só faz INSERT, junction
--     se atualiza sozinha
--   - lancamentos.trg_bloqueia_cobranca_sem_reembolso bloqueia avanço de
--     aguardando_deferimento → cobranca_gerada (proteção interna mantida)
-- =============================================

CREATE OR REPLACE FUNCTION public.gerar_extrato_completo(
  p_cliente_id uuid,
  p_processo_ids uuid[],
  p_lancamento_ids uuid[],
  p_pdf_url text,
  p_filename text,
  p_total_honorarios numeric,
  p_total_taxas numeric,
  p_total_geral numeric,
  p_qtd_processos int,
  p_competencia_mes int,
  p_competencia_ano int,
  p_data_vencimento_cobranca date DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_empresa_id uuid;
  v_extrato_id uuid;
  v_cobranca_id uuid;
  v_share_token text;
  v_lanc_atualizados int;
  v_cliente_check uuid;
BEGIN
  v_empresa_id := public.get_empresa_id();
  IF v_empresa_id IS NULL THEN
    RAISE EXCEPTION 'Usuário sem empresa associada';
  END IF;

  -- Tenant check do cliente
  SELECT empresa_id INTO v_cliente_check FROM public.clientes WHERE id = p_cliente_id;
  IF v_cliente_check IS NULL THEN
    RAISE EXCEPTION 'Cliente não encontrado';
  END IF;
  IF v_cliente_check <> v_empresa_id THEN
    RAISE EXCEPTION 'Cliente não pertence à sua empresa';
  END IF;

  -- Defesa: todos os lancamento_ids devem ser da empresa e do cliente
  -- (a junction validator também checa, mas adiantamos pra mensagem clara)
  IF EXISTS (
    SELECT 1 FROM public.lancamentos
    WHERE id = ANY(p_lancamento_ids)
      AND (empresa_id <> v_empresa_id OR cliente_id <> p_cliente_id)
  ) THEN
    RAISE EXCEPTION 'Algum lançamento não pertence à sua empresa ou cliente';
  END IF;

  -- 1) INSERT extrato
  INSERT INTO public.extratos (
    cliente_id, pdf_url, filename,
    total_honorarios, total_taxas, total_geral,
    qtd_processos, processo_ids,
    competencia_mes, competencia_ano,
    status, empresa_id, created_by
  )
  VALUES (
    p_cliente_id, p_pdf_url, p_filename,
    p_total_honorarios, p_total_taxas, p_total_geral,
    p_qtd_processos, p_processo_ids,
    p_competencia_mes, p_competencia_ano,
    'ativo', v_empresa_id, auth.uid()
  )
  RETURNING id INTO v_extrato_id;

  -- 2) Linka lancamentos ao extrato + promove etapa pra cobranca_gerada
  --    (com guard anti-rebaixamento de honorario_pago/cobranca_enviada).
  --    O trigger _bloqueia_cobranca_sem_reembolso valida via_analise; se
  --    bloquear, transação rolla back (ok — mensagem retorna pro client).
  WITH atualizaveis AS (
    UPDATE public.lancamentos
       SET extrato_id = v_extrato_id,
           etapa_financeiro = CASE
             WHEN etapa_financeiro IN ('honorario_pago', 'cobranca_enviada')
               THEN etapa_financeiro
             ELSE 'cobranca_gerada'
           END,
           updated_at = NOW()
     WHERE id = ANY(p_lancamento_ids)
       AND tipo = 'receber'
       AND empresa_id = v_empresa_id
       AND cliente_id = p_cliente_id
    RETURNING id
  )
  SELECT count(*) INTO v_lanc_atualizados FROM atualizaveis;

  -- 3) INSERT cobranca (share_token gerado automaticamente pelo default)
  INSERT INTO public.cobrancas (
    cliente_id, extrato_id, lancamento_ids,
    total_honorarios, total_taxas, total_geral,
    data_vencimento, status, empresa_id, created_by
  )
  VALUES (
    p_cliente_id, v_extrato_id, p_lancamento_ids,
    p_total_honorarios, p_total_taxas, p_total_geral,
    p_data_vencimento_cobranca, 'ativa', v_empresa_id, auth.uid()
  )
  RETURNING id, share_token INTO v_cobranca_id, v_share_token;

  RETURN jsonb_build_object(
    'ok', true,
    'extrato_id', v_extrato_id,
    'cobranca_id', v_cobranca_id,
    'share_token', v_share_token,
    'lancamentos_atualizados', v_lanc_atualizados
  );
END;
$function$;

COMMENT ON FUNCTION public.gerar_extrato_completo(uuid, uuid[], uuid[], text, text, numeric, numeric, numeric, int, int, int, date) IS
  'REL-014 (13/05/2026): substitui 5 awaits sequenciais sem rollback de executarGeracaoExtrato. Tudo em transação Postgres com guard anti-rebaixamento. Upload do PDF continua no client; se RPC falha, client deleta PDF órfão.';

-- GRANTs (anon NÃO pode chamar — só authenticated com tenant válido)
REVOKE EXECUTE ON FUNCTION public.gerar_extrato_completo(uuid, uuid[], uuid[], text, text, numeric, numeric, numeric, int, int, int, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gerar_extrato_completo(uuid, uuid[], uuid[], text, text, numeric, numeric, numeric, int, int, int, date) TO authenticated;
