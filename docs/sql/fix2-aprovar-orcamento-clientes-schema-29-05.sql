-- =============================================
-- FIX 2 — 29/05/2026 — caso Nicolle ainda travado
-- =============================================
-- Fix anterior (fix-aprovar-orcamento-auto-cliente) tentava INSERT em
-- clientes com coluna `status` ('ativo'), mas tabela não tem essa coluna.
-- Postgres devolvia: ERROR 42703 'column "status" of relation "clientes"
-- does not exist'. RPC abortava, frontend mostrava msg genérica.
--
-- Confirmação via postgres logs: erro registrado às timestamps
-- 1780077752693000 e 1780077613149000 (tentativas Nicolle pós fix).
--
-- Fix-2:
--  - Remove `status` do INSERT (não existe na tabela)
--  - Adiciona `codigo_identificador` (NOT NULL sem default) — gera string
--    XXX.XXX 6 dígitos aleatórios (mesmo padrão visual usado pelo
--    CadastroRapido). Em prod, conflito é raríssimo (chance ~1/1M);
--    mesmo se acontecer, UNIQUE constraint avisa e Thales pode regerar.
-- =============================================
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
  v_valor_selecionado numeric;
  v_qtd_selecionados int;
  v_qtd_total int;
  v_doc_digits text;
  v_tipo_pessoa text;
  v_cliente_existente uuid;
  v_novo_cliente_id uuid;
  v_codigo_id text;
BEGIN
  SELECT
    id, cliente_id, empresa_id, prospect_nome, valor_final, numero,
    processo_id, lancamento_id, status, validade_dias, tipo_contrato,
    desconto_pct, servicos, itens_selecionados,
    prospect_cnpj, prospect_email, prospect_telefone
  INTO v_orc
  FROM public.orcamentos
  WHERE share_token = p_token;

  IF v_orc.id IS NULL THEN
    RAISE EXCEPTION 'Orçamento não encontrado.';
  END IF;

  -- AUTO-CRIAR CLIENTE se prospect sem cliente_id
  IF v_orc.cliente_id IS NULL THEN
    v_doc_digits := regexp_replace(COALESCE(v_orc.prospect_cnpj, ''), '\D', '', 'g');

    IF v_doc_digits = '' THEN
      RAISE EXCEPTION 'Orçamento sem CPF/CNPJ do prospect — não dá pra criar cliente. Adicione o documento no orçamento ou cadastre o cliente manualmente.';
    END IF;

    IF length(v_doc_digits) = 11 THEN
      v_tipo_pessoa := 'PF';
    ELSIF length(v_doc_digits) = 14 THEN
      v_tipo_pessoa := 'PJ';
    ELSE
      RAISE EXCEPTION 'CPF/CNPJ do prospect inválido (% dígitos). Esperado 11 (CPF) ou 14 (CNPJ).', length(v_doc_digits);
    END IF;

    -- Reusa cliente existente se já tem com mesmo documento NA MESMA EMPRESA
    IF v_tipo_pessoa = 'PF' THEN
      SELECT id INTO v_cliente_existente
      FROM public.clientes
      WHERE empresa_id = v_orc.empresa_id
        AND regexp_replace(COALESCE(cpf, ''), '\D', '', 'g') = v_doc_digits
        AND COALESCE(is_archived, false) = false
      LIMIT 1;
    ELSE
      SELECT id INTO v_cliente_existente
      FROM public.clientes
      WHERE empresa_id = v_orc.empresa_id
        AND regexp_replace(COALESCE(cnpj, ''), '\D', '', 'g') = v_doc_digits
        AND COALESCE(is_archived, false) = false
      LIMIT 1;
    END IF;

    IF v_cliente_existente IS NOT NULL THEN
      v_novo_cliente_id := v_cliente_existente;
    ELSE
      -- Gera codigo_identificador no padrão XXX.XXX (6 dígitos)
      -- Mesmo formato usado pelo CadastroRapido. Colisão é improvável
      -- (1/1M); se ocorrer, UNIQUE constraint avisa e Thales regenera.
      v_codigo_id :=
        to_char(floor(random() * 1000)::int, 'FM000') || '.' ||
        to_char(floor(random() * 1000)::int, 'FM000');

      INSERT INTO public.clientes (
        empresa_id, codigo_identificador, nome, apelido, tipo_pessoa,
        cpf, cnpj, email, telefone
      )
      VALUES (
        v_orc.empresa_id,
        v_codigo_id,
        v_orc.prospect_nome,
        v_orc.prospect_nome,
        v_tipo_pessoa,
        CASE WHEN v_tipo_pessoa = 'PF' THEN v_doc_digits ELSE NULL END,
        CASE WHEN v_tipo_pessoa = 'PJ' THEN v_doc_digits ELSE NULL END,
        v_orc.prospect_email,
        v_orc.prospect_telefone
      )
      RETURNING id INTO v_novo_cliente_id;
    END IF;

    UPDATE public.orcamentos
       SET cliente_id = v_novo_cliente_id, updated_at = NOW()
     WHERE id = v_orc.id;

    v_orc.cliente_id := v_novo_cliente_id;
  END IF;

  -- Idempotência: já processado, retorna cobrança existente
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

  -- Calcular valor real respeitando seleção do cliente
  v_qtd_total := COALESCE(jsonb_array_length(v_orc.servicos), 0);

  IF v_orc.itens_selecionados IS NULL OR jsonb_array_length(v_orc.itens_selecionados) = 0 THEN
    v_valor_selecionado := v_orc.valor_final;
    v_qtd_selecionados := v_qtd_total;
  ELSE
    SELECT
      COALESCE(SUM((s->>'honorario')::numeric * COALESCE((s->>'quantidade')::numeric, 1)), 0),
      COUNT(*)
    INTO v_valor_selecionado, v_qtd_selecionados
    FROM jsonb_array_elements(v_orc.servicos) AS s
    WHERE s->>'id' IN (
      SELECT i->>'id' FROM jsonb_array_elements(v_orc.itens_selecionados) AS i
    );

    IF v_orc.desconto_pct IS NOT NULL AND v_orc.desconto_pct > 0 THEN
      v_valor_selecionado := round((v_valor_selecionado * (1 - v_orc.desconto_pct / 100))::numeric, 2);
    END IF;
  END IF;

  IF v_valor_selecionado <= 0 THEN
    RAISE EXCEPTION 'Valor selecionado inválido (zero ou negativo).';
  END IF;

  v_descricao := COALESCE(v_orc.tipo_contrato, 'Serviço') || ' - ' || v_orc.prospect_nome;
  IF v_qtd_selecionados < v_qtd_total THEN
    v_descricao := v_descricao || ' (' || v_qtd_selecionados || ' de ' || v_qtd_total || ' itens)';
  END IF;

  v_data_vencimento := CURRENT_DATE + COALESCE(v_orc.validade_dias, 7);

  -- Criar processo
  INSERT INTO public.processos (
    cliente_id, razao_social, tipo, prioridade, valor, etapa, empresa_id, notas
  )
  VALUES (
    v_orc.cliente_id,
    v_orc.prospect_nome,
    'avulso'::public.tipo_processo,
    'normal',
    v_valor_selecionado,
    'ativo',
    v_orc.empresa_id,
    'Originado do orçamento ' || v_orc.id || ' (aprovado pelo cliente via link público — ' ||
      v_qtd_selecionados || ' de ' || v_qtd_total || ' itens)'
  )
  RETURNING id INTO v_processo_id;

  -- Criar lançamento
  INSERT INTO public.lancamentos (
    tipo, cliente_id, processo_id, descricao, valor, status,
    data_vencimento, etapa_financeiro, empresa_id, confirmado_recebimento
  )
  VALUES (
    'receber'::public.tipo_lancamento,
    v_orc.cliente_id,
    v_processo_id,
    v_descricao,
    v_valor_selecionado,
    'pendente'::public.status_financeiro,
    v_data_vencimento,
    'cobranca_gerada',
    v_orc.empresa_id,
    false
  )
  RETURNING id INTO v_lancamento_id;

  -- Criar cobrança
  INSERT INTO public.cobrancas (
    cliente_id, lancamento_ids,
    total_honorarios, total_taxas, total_geral,
    data_vencimento, status, empresa_id
  )
  VALUES (
    v_orc.cliente_id,
    ARRAY[v_lancamento_id],
    v_valor_selecionado,
    0,
    v_valor_selecionado,
    v_data_vencimento,
    'ativa',
    v_orc.empresa_id
  )
  RETURNING id, share_token INTO v_cobranca_id, v_cobranca_token;

  -- Atualizar orçamento
  UPDATE public.orcamentos
  SET status = 'aguardando_pagamento',
      processo_id = v_processo_id,
      lancamento_id = v_lancamento_id,
      valor_final = v_valor_selecionado,
      convertido_em = COALESCE(convertido_em, NOW()),
      aprovado_em = COALESCE(aprovado_em, NOW()),
      updated_at = NOW()
  WHERE id = v_orc.id;

  -- Notificação pro master
  v_master_id := public.get_empresa_master_id(v_orc.empresa_id);

  INSERT INTO public.notificacoes (
    empresa_id, destinatario_id, tipo, titulo, mensagem, orcamento_id
  )
  VALUES (
    v_orc.empresa_id,
    v_master_id,
    'aprovacao',
    'Proposta #' || lpad(v_orc.numero::text, 3, '0') || ' aprovada — cobrança gerada',
    v_orc.prospect_nome || ' aprovou ' || v_qtd_selecionados || ' de ' || v_qtd_total ||
      ' itens (R$ ' || replace(to_char(v_valor_selecionado, 'FM999G999G999D00'), '.', ',') ||
      '). Cobrança pública: /cobranca/' || v_cobranca_token,
    v_orc.id
  );

  RETURN jsonb_build_object(
    'ok', true,
    'reused', false,
    'processo_id', v_processo_id,
    'lancamento_id', v_lancamento_id,
    'cobranca_id', v_cobranca_id,
    'cobranca_token', v_cobranca_token,
    'valor_cobrado', v_valor_selecionado,
    'itens_aprovados', v_qtd_selecionados,
    'itens_total', v_qtd_total
  );
END;
$function$;
