-- =============================================
-- Auditoria de mudanças de permissão (18/05/2026) — feature E
-- =============================================
-- Toda vez que master:
--   - muda role de um usuário (profiles.role)
--   - dá/tira permissão granular (user_permissions INSERT/UPDATE/DELETE)
-- ... grava 1 linha em permissoes_audit pra rastreabilidade.
--
-- Visível na nova aba "Auditoria" de /configuracoes (só master vê).
-- =============================================

-- 1) Tabela de log
CREATE TABLE IF NOT EXISTS public.permissoes_audit (
  id bigserial PRIMARY KEY,
  empresa_id uuid NOT NULL,
  ator_id uuid,                -- quem fez a mudança (auth.uid() do master)
  ator_nome text,              -- snapshot do nome (pra não quebrar se profile sumir)
  alvo_user_id uuid,           -- usuário afetado
  alvo_nome text,              -- snapshot
  acao text NOT NULL,          -- 'role_changed', 'modulo_added', 'modulo_removed', 'perm_updated'
  detalhes jsonb,              -- { modulo, perm_antiga, perm_nova, role_antigo, role_novo, etc }
  created_at timestamptz DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_permissoes_audit_empresa_time
  ON public.permissoes_audit (empresa_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_permissoes_audit_alvo
  ON public.permissoes_audit (alvo_user_id, created_at DESC);

-- 2) RLS: só master vê
ALTER TABLE public.permissoes_audit ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS permissoes_audit_select ON public.permissoes_audit;
CREATE POLICY permissoes_audit_select ON public.permissoes_audit
  FOR SELECT TO authenticated
  USING (empresa_id = get_empresa_id() AND get_user_role() = 'master');

-- INSERT só via trigger (security definer) — usuários não inserem direto
DROP POLICY IF EXISTS permissoes_audit_insert ON public.permissoes_audit;
CREATE POLICY permissoes_audit_insert ON public.permissoes_audit
  FOR INSERT TO authenticated WITH CHECK (false);

-- Master pode limpar log antigo se quiser
DROP POLICY IF EXISTS permissoes_audit_delete ON public.permissoes_audit;
CREATE POLICY permissoes_audit_delete ON public.permissoes_audit
  FOR DELETE TO authenticated
  USING (empresa_id = get_empresa_id() AND get_user_role() = 'master');

-- 3) Helper: pega nome do user a partir do uuid (snapshot)
CREATE OR REPLACE FUNCTION public._audit_nome_user(p_user_id uuid)
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT nome FROM public.profiles WHERE id = p_user_id LIMIT 1;
$$;

-- 4) Trigger em profiles.role — loga mudança de role
CREATE OR REPLACE FUNCTION public.tg_log_role_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ator_id uuid := auth.uid();
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role THEN
    INSERT INTO public.permissoes_audit (
      empresa_id, ator_id, ator_nome, alvo_user_id, alvo_nome, acao, detalhes
    ) VALUES (
      COALESCE(NEW.empresa_id, OLD.empresa_id),
      v_ator_id,
      public._audit_nome_user(v_ator_id),
      NEW.id,
      COALESCE(NEW.nome, OLD.nome),
      'role_changed',
      jsonb_build_object('role_antigo', OLD.role, 'role_novo', NEW.role)
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_role_change ON public.profiles;
CREATE TRIGGER trg_log_role_change
AFTER UPDATE OF role ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.tg_log_role_change();

-- 5) Trigger em user_permissions — loga INSERT/UPDATE/DELETE
CREATE OR REPLACE FUNCTION public.tg_log_user_permissions_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ator_id uuid := auth.uid();
  v_alvo_id uuid;
  v_alvo_empresa uuid;
  v_acao text;
  v_detalhes jsonb;
BEGIN
  v_alvo_id := COALESCE(NEW.user_id, OLD.user_id);

  SELECT empresa_id INTO v_alvo_empresa FROM public.profiles WHERE id = v_alvo_id;

  IF TG_OP = 'INSERT' THEN
    v_acao := 'modulo_added';
    v_detalhes := jsonb_build_object(
      'modulo', NEW.modulo,
      'pode_ver', NEW.pode_ver,
      'pode_criar', NEW.pode_criar,
      'pode_editar', NEW.pode_editar,
      'pode_excluir', NEW.pode_excluir,
      'pode_aprovar', NEW.pode_aprovar
    );
  ELSIF TG_OP = 'UPDATE' THEN
    v_acao := 'perm_updated';
    v_detalhes := jsonb_build_object(
      'modulo', NEW.modulo,
      'pode_ver', jsonb_build_object('antes', OLD.pode_ver, 'depois', NEW.pode_ver),
      'pode_criar', jsonb_build_object('antes', OLD.pode_criar, 'depois', NEW.pode_criar),
      'pode_editar', jsonb_build_object('antes', OLD.pode_editar, 'depois', NEW.pode_editar),
      'pode_excluir', jsonb_build_object('antes', OLD.pode_excluir, 'depois', NEW.pode_excluir),
      'pode_aprovar', jsonb_build_object('antes', OLD.pode_aprovar, 'depois', NEW.pode_aprovar)
    );
  ELSIF TG_OP = 'DELETE' THEN
    v_acao := 'modulo_removed';
    v_detalhes := jsonb_build_object('modulo', OLD.modulo);
  END IF;

  INSERT INTO public.permissoes_audit (
    empresa_id, ator_id, ator_nome, alvo_user_id, alvo_nome, acao, detalhes
  ) VALUES (
    v_alvo_empresa,
    v_ator_id,
    public._audit_nome_user(v_ator_id),
    v_alvo_id,
    public._audit_nome_user(v_alvo_id),
    v_acao,
    v_detalhes
  );

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_log_user_permissions_change ON public.user_permissions;
CREATE TRIGGER trg_log_user_permissions_change
AFTER INSERT OR UPDATE OR DELETE ON public.user_permissions
FOR EACH ROW EXECUTE FUNCTION public.tg_log_user_permissions_change();

-- 6) RPC pra UI listar histórico (ordenado, com paginação simples)
CREATE OR REPLACE FUNCTION public.listar_permissoes_audit(p_limit int DEFAULT 50)
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
  IF v_empresa_id IS NULL OR public.get_user_role() <> 'master' THEN
    RAISE EXCEPTION 'Apenas master pode consultar auditoria de permissões';
  END IF;

  SELECT jsonb_agg(
    jsonb_build_object(
      'id', id,
      'created_at', created_at,
      'ator_nome', COALESCE(ator_nome, 'Sistema'),
      'alvo_nome', COALESCE(alvo_nome, '(usuário removido)'),
      'acao', acao,
      'detalhes', detalhes
    ) ORDER BY created_at DESC
  ) INTO v_resultado
  FROM (
    SELECT * FROM public.permissoes_audit
    WHERE empresa_id = v_empresa_id
    ORDER BY created_at DESC
    LIMIT p_limit
  ) sub;

  RETURN COALESCE(v_resultado, '[]'::jsonb);
END;
$$;

REVOKE ALL ON FUNCTION public.listar_permissoes_audit(int) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.listar_permissoes_audit(int) TO authenticated;

-- Smoke test
SELECT public.listar_permissoes_audit(5);
