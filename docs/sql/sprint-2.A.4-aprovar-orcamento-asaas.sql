-- ============================================================================
-- Sprint 2.A.4 (13/05/2026 noite): RPC aprovar_orcamento_e_gerar_cobranca
-- ============================================================================
-- Fluxo automático que Thales pediu:
--   Cliente abre /proposta/:token → marca itens → clica "Aprovar"
--   → RPC roda em UMA transação atômica:
--      1. UPDATE orcamento.status = 'aguardando_pagamento'
--      2. INSERT processo (etapa='ativo', vinculado ao cliente do orçamento)
--      3. INSERT lancamento (receber, pendente, etapa_financeiro='cobranca_gerada')
--      4. INSERT cobranca (gera share_token único, status='ativa')
--      5. UPDATE orcamento.processo_id + lancamento_id + convertido_em
--      6. INSERT notificacao destinada ao master da empresa
--   → Retorna {cobranca_id, cobranca_token, processo_id, lancamento_id}
--   → Frontend chama edge function asaas-gerar-cobranca(cobranca_id) em sequência
--   → Frontend faz redirect pra /cobranca/{cobranca_token}
--
-- IDEMPOTÊNCIA: se o orçamento já foi processado (tem processo_id+lancamento_id),
-- a RPC pula a criação e retorna a cobrança existente. Re-aprovação por
-- engano não duplica nada.
--
-- SEGURANÇA: anon-accessible (cliente público) mas só consegue mexer no
-- orçamento que tem o share_token correto. SECURITY DEFINER usa privilégios
-- do owner pra contornar RLS — tenant check é feito pelo próprio share_token.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.aprovar_orcamento_e_gerar_cobranca(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_orc RECORD;
  v_processo_id uuid;
  v_lancamento_id uuid;
  v_cobranca_id uuid;
  v_cobranca_token text;
  v_descricao text;
  v_data_vencimento date;
  v_master_id uuid;
BEGIN
  -- 1. Carregar orçamento pelo share_token
  SELECT
    id, cliente_id, empresa_id, prospect_nome, valor_final, numero,
    processo_id, lancamento_id, status, validade_dias, tipo_contrato
  INTO v_orc
  FROM public.orcamentos
  WHERE share_token = p_token;

  IF v_orc.id IS NULL THEN
    RAISE EXCEPTION 'Orçamento não encontrado.';
  END IF;

  IF v_orc.cliente_id IS NULL THEN
    RAISE EXCEPTION 'Orçamento sem cliente vinculado — peça pro Trevo vincular.';
  END IF;

  -- 2. Idempotência: se já tem processo+lançamento, busca cobrança existente
  IF v_orc.processo_id IS NOT NULL AND v_orc.lancamento_id IS NOT NULL THEN
    SELECT id, share_token
    INTO v_cobranca_id, v_cobranca_token
    FROM public.cobrancas
    WHERE v_orc.lancamento_id = ANY(lancamento_ids)
      AND status = 'ativa'
    ORDER BY created_at DESC
    LIMIT 1;

    IF v_cobranca_id IS NOT NULL THEN
      RETURN jsonb_build_object(
        'ok', true,
        'reused', true,
        'processo_id', v_orc.processo_id,
        'lancamento_id', v_orc.lancamento_id,
        'cobranca_id', v_cobranca_id,
        'cobranca_token', v_cobranca_token
      );
    END IF;
  END IF;

  -- 3. Criar processo (etapa binária DECISION-001 Fase 3)
  v_descricao := COALESCE(v_orc.tipo_contrato, 'Serviço') || ' - ' || v_orc.prospect_nome;

  INSERT INTO public.processos (
    cliente_id, razao_social, tipo, prioridade, valor, etapa, empresa_id, notas
  )
  VALUES (
    v_orc.cliente_id,
    v_orc.prospect_nome,
    'avulso'::public.tipo_processo,
    'normal',
    v_orc.valor_final,
    'ativo',
    v_orc.empresa_id,
    'Originado do orçamento ' || v_orc.id || ' (aprovado pelo cliente via link público)'
  )
  RETURNING id INTO v_processo_id;

  -- 4. Criar lançamento pendente — cliente vai pagar via Asaas
  v_data_vencimento := CURRENT_DATE + COALESCE(v_orc.validade_dias, 7);

  INSERT INTO public.lancamentos (
    tipo, cliente_id, processo_id, descricao, valor, status,
    data_vencimento, etapa_financeiro, empresa_id, confirmado_recebimento
  )
  VALUES (
    'receber'::public.tipo_lancamento,
    v_orc.cliente_id,
    v_processo_id,
    v_descricao,
    v_orc.valor_final,
    'pendente'::public.status_financeiro,
    v_data_vencimento,
    'cobranca_gerada',
    v_orc.empresa_id,
    false
  )
  RETURNING id INTO v_lancamento_id;

  -- 5. Criar cobrança (share_token gerado pelo default da tabela)
  INSERT INTO public.cobrancas (
    cliente_id, lancamento_ids,
    total_honorarios, total_taxas, total_geral,
    data_vencimento, status, empresa_id
  )
  VALUES (
    v_orc.cliente_id,
    ARRAY[v_lancamento_id],
    v_orc.valor_final,
    0,
    v_orc.valor_final,
    v_data_vencimento,
    'ativa',
    v_orc.empresa_id
  )
  RETURNING id, share_token INTO v_cobranca_id, v_cobranca_token;

  -- 6. Atualizar orçamento (status + refs)
  UPDATE public.orcamentos
  SET status = 'aguardando_pagamento',
      processo_id = v_processo_id,
      lancamento_id = v_lancamento_id,
      convertido_em = COALESCE(convertido_em, NOW()),
      aprovado_em = COALESCE(aprovado_em, NOW()),
      updated_at = NOW()
  WHERE id = v_orc.id;

  -- 7. Notificação pro master da empresa
  v_master_id := public.get_empresa_master_id(v_orc.empresa_id);

  INSERT INTO public.notificacoes (
    empresa_id, destinatario_id, tipo, titulo, mensagem, orcamento_id
  )
  VALUES (
    v_orc.empresa_id,
    v_master_id,
    'aprovacao',
    'Proposta #' || lpad(v_orc.numero::text, 3, '0') || ' aprovada — cobrança gerada',
    v_orc.prospect_nome || ' aprovou a proposta no valor de R$ ' ||
      replace(to_char(v_orc.valor_final, 'FM999G999G999D00'), '.', ',') ||
      '. Cobrança pública: /cobranca/' || v_cobranca_token,
    v_orc.id
  );

  RETURN jsonb_build_object(
    'ok', true,
    'reused', false,
    'processo_id', v_processo_id,
    'lancamento_id', v_lancamento_id,
    'cobranca_id', v_cobranca_id,
    'cobranca_token', v_cobranca_token
  );
END;
$function$;

-- Anon precisa acessar (cliente público chama via PostgREST)
GRANT EXECUTE ON FUNCTION public.aprovar_orcamento_e_gerar_cobranca(text) TO anon, authenticated;

-- ============================================================================
-- VERIFICAÇÃO (rodar após)
-- ============================================================================
-- SELECT proname FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
--  WHERE n.nspname='public' AND p.proname='aprovar_orcamento_e_gerar_cobranca';
--   Esperado: 1 linha
--
-- Test (em orçamento de teste!):
-- SELECT public.aprovar_orcamento_e_gerar_cobranca('SHARE_TOKEN_DO_ORC_TESTE');
--   Esperado: { ok: true, reused: false, processo_id, lancamento_id, cobranca_id, cobranca_token }
--
-- Re-chamar com mesmo token:
--   Esperado: { ok: true, reused: true, ...mesmos IDs }
