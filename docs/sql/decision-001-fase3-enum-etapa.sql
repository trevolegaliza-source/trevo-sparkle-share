-- ============================================================================
-- DECISION-001 Fase 3 — enum etapa BINÁRIO no banco        (13/05/2026 noite)
-- ============================================================================
-- ⚠️ AVISO PÓS-EXECUÇÃO (13/05 noite): este SQL rodou com sucesso mas
-- a ordem das ops causou um efeito colateral — a trigger sync_deferimento
-- (dropada apenas no passo 5) rodou DURANTE o UPDATE em massa do passo 2
-- e apagou data_deferimento de ~37 processos (interpretou 'ativo'/'finalizado'
-- como "saiu do pós-deferimento"). Hotfix restaurando os valores via
-- heurística em decision-001-fase3-HOTFIX-data-deferimento.sql.
--
-- Lição: em futuras migrations que mudam enum, dropar triggers DEPENDENTES
-- ANTES do UPDATE em massa. Aqui a ordem correta seria 5 → 1 → 2 → 3 → 4 → 6 → 7.
-- ============================================================================
-- Antes: text livre, 4 valores em uso (recebidos 119, registro 23,
--        finalizados 12, concluido 2) de um espaço de 18 etapas históricas.
-- Depois: text com CHECK aceitando só ('ativo','finalizado').
--
-- O que muda:
--   1. Backfill data_deferimento pros 10 órfãos pré-deferimento sem data.
--   2. UPDATE em massa normalizando dados:
--        recebidos    -> ativo       (119)
--        registro     -> ativo       (23, deferido via data_deferimento)
--        finalizados  -> finalizado  (12)
--        concluido    -> finalizado  (2 zumbis DATA-005)
--   3. ALTER COLUMN default 'ativo'.
--   4. CHECK constraint.
--   5. DROP trigger sync_deferimento_on_etapa_change (redundante com a RPC
--      marcar_deferimento que já seta data_deferimento direto).
--   6. View processos_zombies atualizada.
--   7. Reescrita de 5 RPCs que escreviam etapa literal:
--        criar_processo_com_lancamento, converter_orcamento_em_processo,
--        marcar_processo_pago, marcar_pago_em_lote, desfazer_marcar_pago.
--
-- Frontend já está tolerante: lê ambos formatos via helpers em
-- src/types/process.ts (getEtapaSimplificada, isProcessoFinalizado).
--
-- ROLLBACK (caso precise): restaurar via Supabase Dashboard → Database →
-- Backups; OU manualmente reverter UPDATE + DROP CONSTRAINT + recriar trigger.
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Backfill data_deferimento (antes do UPDATE em massa pra etapa)
-- ---------------------------------------------------------------------------
-- 10 processos têm etapa pós-deferimento mas data_deferimento NULL.
-- Pós-migração, etapa binária não distingue deferimento; data_deferimento
-- vira fonte de verdade. Backfill com updated_at (mais provável que
-- created_at — esses processos passaram por updates depois de criados).
UPDATE public.processos
   SET data_deferimento = COALESCE(updated_at::date, created_at::date)
 WHERE etapa IN ('registro', 'finalizados', 'concluido')
   AND data_deferimento IS NULL;

-- ---------------------------------------------------------------------------
-- 2. Normalização em massa de etapa
-- ---------------------------------------------------------------------------
UPDATE public.processos
   SET etapa = CASE
     WHEN etapa IN ('finalizado', 'finalizados', 'arquivo', 'concluido') THEN 'finalizado'
     ELSE 'ativo'
   END;

-- ---------------------------------------------------------------------------
-- 3. Default da coluna
-- ---------------------------------------------------------------------------
ALTER TABLE public.processos
  ALTER COLUMN etapa SET DEFAULT 'ativo';

-- ---------------------------------------------------------------------------
-- 4. CHECK constraint
-- ---------------------------------------------------------------------------
-- Aplica DEPOIS do UPDATE em massa, senão falha em valores legados.
ALTER TABLE public.processos
  ADD CONSTRAINT processos_etapa_check
  CHECK (etapa IN ('ativo', 'finalizado'));

-- ---------------------------------------------------------------------------
-- 5. DROP trigger sync_deferimento (redundante)
-- ---------------------------------------------------------------------------
-- A trigger sincronizava data_deferimento com etapa pós-deferimento. Hoje
-- a RPC marcar_deferimento(processo_id, data) seta data_deferimento direto
-- e a etapa não distingue mais "deferido" (binária).
DROP TRIGGER IF EXISTS trg_sync_deferimento ON public.processos;
DROP FUNCTION IF EXISTS public.sync_deferimento_on_etapa_change();

-- ---------------------------------------------------------------------------
-- 6. View processos_zombies (sentinela MON-001 atualizada)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.processos_zombies AS
SELECT
  p.id AS processo_id,
  p.razao_social,
  p.etapa,
  p.cliente_id,
  c.nome AS cliente_nome,
  p.valor,
  p.created_at,
  p.empresa_id
FROM public.processos p
LEFT JOIN public.clientes c ON c.id = p.cliente_id
WHERE p.etapa = 'finalizado'
  AND COALESCE(p.is_archived, false) = false
  AND NOT EXISTS (
    SELECT 1 FROM public.lancamentos l WHERE l.processo_id = p.id
  );

-- ---------------------------------------------------------------------------
-- 7. RPCs reescritas
-- ---------------------------------------------------------------------------
-- 7.1 criar_processo_com_lancamento — etapa inicial 'finalizado' (se ja_pago) ou 'ativo'.
CREATE OR REPLACE FUNCTION public.criar_processo_com_lancamento(
  p_cliente_id uuid,
  p_razao_social text,
  p_tipo text,
  p_prioridade text DEFAULT 'normal',
  p_responsavel text DEFAULT NULL,
  p_valor numeric DEFAULT 0,
  p_notas text DEFAULT NULL,
  p_created_at timestamptz DEFAULT now(),
  p_dentro_do_plano boolean DEFAULT NULL,
  p_valor_avulso numeric DEFAULT 0,
  p_justificativa_avulso text DEFAULT NULL,
  p_etiquetas text[] DEFAULT '{}'::text[],
  p_criar_lancamento boolean DEFAULT true,
  p_descricao_lancamento text DEFAULT '',
  p_ja_pago boolean DEFAULT false,
  p_data_vencimento date DEFAULT NULL,
  p_data_lancamento date DEFAULT NULL,
  p_criar_avulso_extra boolean DEFAULT false,
  p_valor_avulso_extra numeric DEFAULT 0,
  p_descricao_avulso_extra text DEFAULT '',
  p_via_analise text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_processo_id UUID;
  v_empresa_id UUID;
  v_cliente_empresa UUID;
  v_lanc_date DATE;
  v_momento_faturamento TEXT;
  v_etapa_lanc TEXT;
  v_venc_lanc DATE;
BEGIN
  v_empresa_id := public.get_empresa_id();
  IF v_empresa_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não possui empresa associada';
  END IF;

  SELECT empresa_id, COALESCE(momento_faturamento, 'na_solicitacao')
    INTO v_cliente_empresa, v_momento_faturamento
    FROM public.clientes
   WHERE id = p_cliente_id;

  IF v_cliente_empresa IS NULL THEN
    RAISE EXCEPTION 'Cliente não encontrado';
  END IF;
  IF v_cliente_empresa != v_empresa_id THEN
    RAISE EXCEPTION 'Cliente não pertence à sua empresa';
  END IF;

  INSERT INTO public.processos (
    cliente_id, razao_social, tipo, prioridade, responsavel, valor, notas,
    created_at, dentro_do_plano, valor_avulso, justificativa_avulso, etiquetas,
    empresa_id, etapa
  )
  VALUES (
    p_cliente_id, p_razao_social, p_tipo::public.tipo_processo, p_prioridade,
    p_responsavel, p_valor, p_notas, p_created_at, p_dentro_do_plano,
    p_valor_avulso, p_justificativa_avulso, p_etiquetas, v_empresa_id,
    CASE WHEN p_ja_pago THEN 'finalizado' ELSE 'ativo' END  -- DECISION-001 Fase 3
  )
  RETURNING id INTO v_processo_id;

  IF p_via_analise IS NOT NULL AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'processos' AND column_name = 'via_analise'
  ) THEN
    EXECUTE format('UPDATE public.processos SET via_analise = %L WHERE id = %L', p_via_analise, v_processo_id);
  END IF;

  IF p_criar_lancamento THEN
    v_lanc_date := COALESCE(p_data_lancamento, CURRENT_DATE);
    IF p_ja_pago THEN
      v_etapa_lanc := 'honorario_pago';
      v_venc_lanc := v_lanc_date;
    ELSIF v_momento_faturamento = 'no_deferimento' THEN
      v_etapa_lanc := 'aguardando_deferimento';
      v_venc_lanc := '2099-12-31'::date;
    ELSE
      v_etapa_lanc := 'solicitacao_criada';
      v_venc_lanc := COALESCE(p_data_vencimento, public.calcular_vencimento(p_cliente_id));
    END IF;

    INSERT INTO public.lancamentos (
      tipo, cliente_id, processo_id, descricao, valor, status,
      data_vencimento, data_pagamento, created_at, etapa_financeiro, empresa_id,
      confirmado_recebimento
    )
    VALUES (
      'receber'::public.tipo_lancamento, p_cliente_id, v_processo_id,
      p_descricao_lancamento, p_valor,
      CASE WHEN p_ja_pago THEN 'pago'::public.status_financeiro ELSE 'pendente'::public.status_financeiro END,
      v_venc_lanc,
      CASE WHEN p_ja_pago THEN v_lanc_date ELSE NULL END,
      p_created_at,
      v_etapa_lanc,
      v_empresa_id,
      p_ja_pago
    );
  END IF;

  IF p_criar_avulso_extra AND p_valor_avulso_extra > 0 THEN
    IF v_momento_faturamento = 'no_deferimento' THEN
      v_etapa_lanc := 'aguardando_deferimento';
      v_venc_lanc := '2099-12-31'::date;
    ELSE
      v_etapa_lanc := 'solicitacao_criada';
      v_venc_lanc := COALESCE(p_data_vencimento, public.calcular_vencimento(p_cliente_id));
    END IF;

    INSERT INTO public.lancamentos (
      tipo, cliente_id, processo_id, descricao, valor, status,
      data_vencimento, created_at, etapa_financeiro, empresa_id
    )
    VALUES (
      'receber'::public.tipo_lancamento, p_cliente_id, v_processo_id,
      p_descricao_avulso_extra, p_valor_avulso_extra,
      'pendente'::public.status_financeiro,
      v_venc_lanc, p_created_at, v_etapa_lanc, v_empresa_id
    );
  END IF;

  RETURN v_processo_id;
END;
$function$;

-- 7.2 converter_orcamento_em_processo — etapa 'finalizado' (orçamento já vira processo pago)
CREATE OR REPLACE FUNCTION public.converter_orcamento_em_processo(p_orcamento_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_empresa_caller uuid;
  v_orc RECORD;
  v_processo_id uuid;
  v_lanc_id uuid;
  v_descricao text;
BEGIN
  v_empresa_caller := public.get_empresa_id();
  IF v_empresa_caller IS NULL THEN
    RAISE EXCEPTION 'Usuário não possui empresa associada';
  END IF;

  SELECT id, empresa_id, cliente_id, prospect_nome, valor_final, processo_id, lancamento_id, tipo_contrato
    INTO v_orc
    FROM public.orcamentos
   WHERE id = p_orcamento_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Orçamento não encontrado';
  END IF;
  IF v_orc.empresa_id <> v_empresa_caller THEN
    RAISE EXCEPTION 'Orçamento não pertence à sua empresa';
  END IF;

  IF v_orc.processo_id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'ok', true,
      'ja_convertido', true,
      'processo_id', v_orc.processo_id,
      'lancamento_id', v_orc.lancamento_id
    );
  END IF;

  IF v_orc.cliente_id IS NULL THEN
    RAISE EXCEPTION 'Vincule o prospect a um cliente antes de converter';
  END IF;

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
    'finalizado',  -- DECISION-001 Fase 3
    v_empresa_caller,
    'Originado do orçamento ' || p_orcamento_id || ' (' || v_descricao || ')'
  )
  RETURNING id INTO v_processo_id;

  INSERT INTO public.lancamentos (
    tipo, cliente_id, processo_id, descricao, valor, status,
    data_vencimento, data_pagamento, etapa_financeiro, empresa_id,
    confirmado_recebimento
  )
  VALUES (
    'receber'::public.tipo_lancamento,
    v_orc.cliente_id,
    v_processo_id,
    v_descricao,
    v_orc.valor_final,
    'pago'::public.status_financeiro,
    CURRENT_DATE,
    CURRENT_DATE,
    'honorario_pago',
    v_empresa_caller,
    true
  )
  RETURNING id INTO v_lanc_id;

  UPDATE public.orcamentos
     SET processo_id = v_processo_id,
         lancamento_id = v_lanc_id,
         status = 'convertido',
         convertido_em = COALESCE(convertido_em, NOW()),
         pago_em = COALESCE(pago_em, NOW()),
         updated_at = NOW()
   WHERE id = p_orcamento_id;

  RETURN jsonb_build_object(
    'ok', true,
    'ja_convertido', false,
    'processo_id', v_processo_id,
    'lancamento_id', v_lanc_id
  );
END;
$function$;

-- 7.3 marcar_processo_pago — etapa final 'finalizado'
CREATE OR REPLACE FUNCTION public.marcar_processo_pago(p_processo_id uuid, p_data_pagamento date)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_empresa_id uuid;
  v_proc_empresa uuid;
  v_proc_cliente uuid;
  v_proc_valor numeric;
  v_proc_tipo text;
  v_proc_razao text;
  v_lanc_id uuid;
BEGIN
  v_empresa_id := public.get_empresa_id();
  IF v_empresa_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não possui empresa associada';
  END IF;

  SELECT empresa_id, cliente_id, valor, tipo::text, razao_social
    INTO v_proc_empresa, v_proc_cliente, v_proc_valor, v_proc_tipo, v_proc_razao
    FROM public.processos
   WHERE id = p_processo_id;

  IF v_proc_empresa IS NULL THEN
    RAISE EXCEPTION 'Processo não encontrado';
  END IF;
  IF v_proc_empresa != v_empresa_id THEN
    RAISE EXCEPTION 'Processo não pertence à sua empresa';
  END IF;

  SELECT id INTO v_lanc_id
    FROM public.lancamentos
   WHERE processo_id = p_processo_id AND tipo = 'receber'
   ORDER BY created_at ASC
   LIMIT 1;

  IF v_lanc_id IS NOT NULL THEN
    UPDATE public.lancamentos
       SET status = 'pago'::public.status_financeiro,
           etapa_financeiro = 'honorario_pago',
           confirmado_recebimento = true,
           data_pagamento = p_data_pagamento,
           updated_at = NOW()
     WHERE id = v_lanc_id;
  ELSE
    INSERT INTO public.lancamentos (
      tipo, cliente_id, processo_id, descricao, valor, status,
      data_vencimento, data_pagamento, etapa_financeiro, empresa_id,
      confirmado_recebimento
    )
    VALUES (
      'receber'::public.tipo_lancamento,
      v_proc_cliente,
      p_processo_id,
      INITCAP(v_proc_tipo) || ' - ' || v_proc_razao,
      COALESCE(v_proc_valor, 0),
      'pago'::public.status_financeiro,
      p_data_pagamento,
      p_data_pagamento,
      'honorario_pago',
      v_empresa_id,
      true
    )
    RETURNING id INTO v_lanc_id;
  END IF;

  UPDATE public.processos
     SET etapa = 'finalizado',  -- DECISION-001 Fase 3
         updated_at = NOW()
   WHERE id = p_processo_id;

  RETURN v_lanc_id;
END;
$function$;

-- 7.4 marcar_pago_em_lote — promove processos pra 'finalizado'
CREATE OR REPLACE FUNCTION public.marcar_pago_em_lote(p_lancamento_ids uuid[], p_data_pagamento date)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
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

  IF EXISTS (
    SELECT 1 FROM public.lancamentos
    WHERE id = ANY(p_lancamento_ids)
      AND empresa_id <> v_empresa_id
  ) THEN
    RAISE EXCEPTION 'Algum lançamento não pertence à sua empresa';
  END IF;

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

  UPDATE public.processos
     SET etapa = 'finalizado',  -- DECISION-001 Fase 3
         updated_at = NOW()
   WHERE id IN (
     SELECT DISTINCT processo_id
       FROM public.lancamentos
      WHERE id = ANY(p_lancamento_ids)
        AND processo_id IS NOT NULL
   )
     AND empresa_id = v_empresa_id
     AND etapa <> 'finalizado';  -- DECISION-001 Fase 3
  GET DIAGNOSTICS v_count_proc = ROW_COUNT;

  RETURN jsonb_build_object(
    'ok', true,
    'lancamentos_pagos', v_count_lanc,
    'processos_finalizados', v_count_proc
  );
END;
$function$;

-- 7.5 desfazer_marcar_pago — processo volta pra 'ativo'
CREATE OR REPLACE FUNCTION public.desfazer_marcar_pago(p_processo_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
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

  UPDATE public.processos
     SET etapa = 'ativo',  -- DECISION-001 Fase 3
         updated_at = NOW()
   WHERE id = p_processo_id
     AND empresa_id = v_empresa_id;

  RETURN jsonb_build_object(
    'ok', true,
    'lancamentos_revertidos', v_count
  );
END;
$function$;

COMMIT;

-- ============================================================================
-- VERIFICAÇÃO (rodar separado depois de COMMIT)
-- ============================================================================
-- SELECT etapa, COUNT(*) FROM public.processos GROUP BY etapa;
--   Esperado: ativo ~142, finalizado ~14
--
-- SELECT etapa, COUNT(*) FILTER (WHERE data_deferimento IS NOT NULL) AS com_data_def
--   FROM public.processos GROUP BY etapa;
--   Esperado: ativo com_data_def = 23 (era registro); finalizado com_data_def = 14
--
-- SELECT proname FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
--  WHERE n.nspname = 'public' AND p.proname = 'sync_deferimento_on_etapa_change';
--   Esperado: 0 linhas (função foi dropada)
--
-- SELECT COUNT(*) FROM public.processos_zombies;
--   Esperado: idealmente 0
