-- =============================================
-- created_by em processos + fix orcamentos.created_by (18/05/2026)
-- =============================================
-- Thales: "quando o usuário logado registrar processo, eu depois poder
-- saber quem registrou".
--
-- Estado antes:
-- - processos: NÃO TINHA created_by. Só `responsavel` (texto livre digitado
--   no form). Sem rastreabilidade real.
-- - orcamentos: TEM created_by (text), mas TODOS estão NULL (front passa
--   null no payload). Mesma classe de bug.
--
-- Fix nas 2 tabelas com TRIGGER (não depende de front lembrar de preencher):
-- =============================================

-- 1) ADD COLUMN processos.created_by
ALTER TABLE public.processos
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_processos_created_by ON public.processos(created_by);

COMMENT ON COLUMN public.processos.created_by IS
'UUID do user que criou o processo (auth.uid() no momento do INSERT). Preenchido automaticamente via trigger. NULL pra processos pré-18/05/2026.';

-- 2) Trigger BEFORE INSERT em processos — preenche se NULL
CREATE OR REPLACE FUNCTION public.tg_set_processo_created_by()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.created_by IS NULL THEN
    NEW.created_by := auth.uid();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_processo_created_by ON public.processos;
CREATE TRIGGER trg_set_processo_created_by
BEFORE INSERT ON public.processos
FOR EACH ROW EXECUTE FUNCTION public.tg_set_processo_created_by();

-- 3) Trigger BEFORE INSERT em orcamentos — mesma lógica, resolve bug existente.
-- orcamentos.created_by é text (não uuid) — armazena uuid como string.
CREATE OR REPLACE FUNCTION public.tg_set_orcamento_created_by()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.created_by IS NULL THEN
    NEW.created_by := auth.uid()::text;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_orcamento_created_by ON public.orcamentos;
CREATE TRIGGER trg_set_orcamento_created_by
BEFORE INSERT ON public.orcamentos
FOR EACH ROW EXECUTE FUNCTION public.tg_set_orcamento_created_by();

-- 4) Atualizar RPC criar_processo_com_lancamento pra incluir created_by
-- (idempotente, CREATE OR REPLACE — restante da função inalterado)
CREATE OR REPLACE FUNCTION public.criar_processo_com_lancamento(
  p_cliente_id uuid, p_razao_social text, p_tipo text,
  p_prioridade text DEFAULT 'normal'::text,
  p_responsavel text DEFAULT NULL::text,
  p_valor numeric DEFAULT 0, p_notas text DEFAULT NULL::text,
  p_created_at timestamp with time zone DEFAULT now(),
  p_dentro_do_plano boolean DEFAULT NULL::boolean,
  p_valor_avulso numeric DEFAULT 0,
  p_justificativa_avulso text DEFAULT NULL::text,
  p_etiquetas text[] DEFAULT '{}'::text[],
  p_criar_lancamento boolean DEFAULT true,
  p_descricao_lancamento text DEFAULT ''::text,
  p_ja_pago boolean DEFAULT false,
  p_data_vencimento date DEFAULT NULL::date,
  p_data_lancamento date DEFAULT NULL::date,
  p_criar_avulso_extra boolean DEFAULT false,
  p_valor_avulso_extra numeric DEFAULT 0,
  p_descricao_avulso_extra text DEFAULT ''::text,
  p_via_analise text DEFAULT NULL::text
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
  v_user_id UUID := auth.uid();
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

  -- created_by setado aqui — trigger backup também preenche se NULL
  INSERT INTO public.processos (
    cliente_id, razao_social, tipo, prioridade, responsavel, valor, notas,
    created_at, dentro_do_plano, valor_avulso, justificativa_avulso, etiquetas,
    empresa_id, etapa, created_by
  )
  VALUES (
    p_cliente_id, p_razao_social, p_tipo::public.tipo_processo, p_prioridade,
    p_responsavel, p_valor, p_notas, p_created_at, p_dentro_do_plano,
    p_valor_avulso, p_justificativa_avulso, p_etiquetas, v_empresa_id,
    CASE WHEN p_ja_pago THEN 'finalizado' ELSE 'ativo' END,
    v_user_id
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

-- Confirma instalação
SELECT
  (SELECT count(*) FROM information_schema.columns WHERE table_schema='public' AND table_name='processos' AND column_name='created_by') AS col_processos,
  (SELECT count(*) FROM pg_trigger WHERE tgname IN ('trg_set_processo_created_by', 'trg_set_orcamento_created_by')) AS triggers_ativos;
