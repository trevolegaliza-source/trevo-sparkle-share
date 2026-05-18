-- =============================================
-- Histórico campo-por-campo de edições (18/05/2026)
-- =============================================
-- Complementa updated_by (que diz QUEM e QUANDO). Agora também sabe O QUÊ
-- mudou — valor antigo vs valor novo de cada campo crítico.
--
-- Útil quando:
-- - Letícia altera valor de processo, Thales pergunta "por que mudou?"
-- - Cliente reclama "esse valor não era esse" — vê histórico
-- - Auditoria interna de qualquer mudança suspeita
--
-- Tabela genérica `entidade_audit` (1 row por campo mudado por evento).
-- Triggers em processos e orcamentos pra campos críticos pré-selecionados.
-- =============================================

-- 1) Tabela de histórico
CREATE TABLE IF NOT EXISTS public.entidade_audit (
  id bigserial PRIMARY KEY,
  empresa_id uuid NOT NULL,
  ator_id uuid,
  ator_nome text,
  entidade_tipo text NOT NULL,    -- 'processo' | 'orcamento'
  entidade_id uuid NOT NULL,
  entidade_label text,             -- snapshot legível (ex: razao_social do processo)
  campo text NOT NULL,             -- 'valor', 'etapa', 'status', etc
  valor_antigo jsonb,
  valor_novo jsonb,
  created_at timestamptz DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_entidade_audit_lookup
  ON public.entidade_audit (entidade_tipo, entidade_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_entidade_audit_empresa
  ON public.entidade_audit (empresa_id, created_at DESC);

-- 2) RLS — só authed da empresa vê
ALTER TABLE public.entidade_audit ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS entidade_audit_select ON public.entidade_audit;
CREATE POLICY entidade_audit_select ON public.entidade_audit
  FOR SELECT TO authenticated
  USING (empresa_id = get_empresa_id());

-- INSERT só via trigger SECURITY DEFINER
DROP POLICY IF EXISTS entidade_audit_insert ON public.entidade_audit;
CREATE POLICY entidade_audit_insert ON public.entidade_audit
  FOR INSERT TO authenticated WITH CHECK (false);

-- Master pode limpar histórico
DROP POLICY IF EXISTS entidade_audit_delete ON public.entidade_audit;
CREATE POLICY entidade_audit_delete ON public.entidade_audit
  FOR DELETE TO authenticated
  USING (empresa_id = get_empresa_id() AND get_user_role() = 'master');

-- 3) Helper: pega nome de profile (snapshot)
-- (já existe _audit_nome_user — vou reusar)

-- 4) Trigger genérico — itera campos monitorados e insere 1 linha por mudança
CREATE OR REPLACE FUNCTION public.tg_audit_processo_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ator_id uuid := auth.uid();
  v_ator_nome text;
  v_campos_monitorar text[] := ARRAY[
    'valor', 'etapa', 'data_deferimento', 'responsavel',
    'tipo', 'razao_social', 'prioridade', 'is_archived',
    'dentro_do_plano', 'valor_avulso', 'notas'
  ];
  v_campo text;
  v_old_val jsonb;
  v_new_val jsonb;
BEGIN
  v_ator_nome := public._audit_nome_user(v_ator_id);

  FOREACH v_campo IN ARRAY v_campos_monitorar LOOP
    v_old_val := to_jsonb(OLD) -> v_campo;
    v_new_val := to_jsonb(NEW) -> v_campo;

    -- Só registra se mudou
    IF v_old_val IS DISTINCT FROM v_new_val THEN
      INSERT INTO public.entidade_audit (
        empresa_id, ator_id, ator_nome,
        entidade_tipo, entidade_id, entidade_label,
        campo, valor_antigo, valor_novo
      ) VALUES (
        NEW.empresa_id, v_ator_id, v_ator_nome,
        'processo', NEW.id, COALESCE(NEW.razao_social, OLD.razao_social),
        v_campo, v_old_val, v_new_val
      );
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_processo_changes ON public.processos;
CREATE TRIGGER trg_audit_processo_changes
AFTER UPDATE ON public.processos
FOR EACH ROW EXECUTE FUNCTION public.tg_audit_processo_changes();

-- 5) Trigger em orcamentos
CREATE OR REPLACE FUNCTION public.tg_audit_orcamento_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ator_id uuid := auth.uid();
  v_ator_nome text;
  v_campos_monitorar text[] := ARRAY[
    'status', 'valor_final', 'prospect_nome', 'prospect_cnpj',
    'validade_dias', 'desconto_pct', 'data_expiracao'
  ];
  v_campo text;
  v_old_val jsonb;
  v_new_val jsonb;
BEGIN
  v_ator_nome := public._audit_nome_user(v_ator_id);

  FOREACH v_campo IN ARRAY v_campos_monitorar LOOP
    v_old_val := to_jsonb(OLD) -> v_campo;
    v_new_val := to_jsonb(NEW) -> v_campo;

    IF v_old_val IS DISTINCT FROM v_new_val THEN
      INSERT INTO public.entidade_audit (
        empresa_id, ator_id, ator_nome,
        entidade_tipo, entidade_id, entidade_label,
        campo, valor_antigo, valor_novo
      ) VALUES (
        NEW.empresa_id, v_ator_id, v_ator_nome,
        'orcamento', NEW.id, COALESCE(NEW.prospect_nome, OLD.prospect_nome),
        v_campo, v_old_val, v_new_val
      );
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_orcamento_changes ON public.orcamentos;
CREATE TRIGGER trg_audit_orcamento_changes
AFTER UPDATE ON public.orcamentos
FOR EACH ROW EXECUTE FUNCTION public.tg_audit_orcamento_changes();

-- 6) RPC pra UI: listar histórico de 1 entidade
CREATE OR REPLACE FUNCTION public.listar_historico_entidade(
  p_entidade_tipo text,
  p_entidade_id uuid,
  p_limit int DEFAULT 50
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_empresa_id uuid;
  v_resultado jsonb;
BEGIN
  v_empresa_id := public.get_empresa_id();
  IF v_empresa_id IS NULL THEN
    RAISE EXCEPTION 'Usuário sem empresa associada';
  END IF;

  SELECT jsonb_agg(
    jsonb_build_object(
      'id', id,
      'created_at', created_at,
      'ator_nome', COALESCE(ator_nome, 'Sistema'),
      'campo', campo,
      'valor_antigo', valor_antigo,
      'valor_novo', valor_novo
    ) ORDER BY created_at DESC
  ) INTO v_resultado
  FROM (
    SELECT * FROM public.entidade_audit
    WHERE empresa_id = v_empresa_id
      AND entidade_tipo = p_entidade_tipo
      AND entidade_id = p_entidade_id
    ORDER BY created_at DESC
    LIMIT p_limit
  ) sub;

  RETURN COALESCE(v_resultado, '[]'::jsonb);
END;
$$;

REVOKE ALL ON FUNCTION public.listar_historico_entidade(text, uuid, int) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.listar_historico_entidade(text, uuid, int) TO authenticated;

-- Confirma
SELECT
  (SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_name='entidade_audit') AS tabela,
  (SELECT count(*) FROM pg_trigger WHERE tgname IN ('trg_audit_processo_changes', 'trg_audit_orcamento_changes')) AS triggers,
  (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON p.pronamespace=n.oid WHERE n.nspname='public' AND p.proname='listar_historico_entidade') AS rpc;
