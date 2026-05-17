-- =============================================
-- FIN-002 (17/05/2026): gerar_extrato_completo rejeita array de lançamentos vazio
-- =============================================
-- Auditoria 17/05/2026 (doc auditoria-2026-05-17/00-RESUMO.md) mapeou:
-- Front pode chamar `gerar_extrato_completo` com `p_lancamento_ids=[]` quando
-- usuário clica "Gerar Extrato" sem ter selecionado nada (race / dupla-click /
-- estado de filtro vazio). Resultado hoje: extrato é criado + cobrança nasce
-- vinculada a 0 lançamentos. Front mostra "✅ Extrato gerado!" mas o estado
-- ficou inconsistente.
--
-- Fix: validação no topo da função pra rejeitar com mensagem clara antes de
-- qualquer INSERT. Front continua igual; quem fizer call vazio recebe erro
-- amigável em vez de cobrança órfã.
--
-- Idempotente: CREATE OR REPLACE reaplica sem destruir nada.
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

  -- FIN-002 (17/05/2026): rejeita array vazio antes de qualquer INSERT
  IF p_lancamento_ids IS NULL OR array_length(p_lancamento_ids, 1) IS NULL THEN
    RAISE EXCEPTION 'Nenhum lançamento selecionado para o extrato';
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

  -- Defesa extra: se nenhum lançamento foi efetivamente atualizado (todos já
  -- linkados a outro extrato ou ids inválidos), rolla back. Sem isso, cobrança
  -- ainda seria criada vinculada a lançamentos que não foram tocados.
  IF v_lanc_atualizados = 0 THEN
    RAISE EXCEPTION 'Nenhum lançamento elegível foi atualizado (todos já vinculados a outro extrato?)';
  END IF;

  -- 3) INSERT cobranca
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
