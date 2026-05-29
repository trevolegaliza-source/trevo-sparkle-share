-- =============================================
-- AUDIT-034 (29/05/2026) — Consolidar policies múltiplas
-- =============================================
-- Postgres avalia múltiplas policies do mesmo comando (SELECT/UPDATE/etc)
-- com OR — mas executa cada uma. Consolidar em 1 reduz overhead.
--
-- Tabelas afetadas (advisor):
-- - empresas_config (SELECT): empresas_config_master_write (ALL) + empresas_config_select (SELECT)
-- - financeiro_auditoria (SELECT): auditoria_master_read + auditoria_self_read
-- - profiles (UPDATE): profiles_update_master + profiles_update_self_safe
--
-- DECISÃO:
-- - empresas_config: consolidar SELECT (master ALL já inclui SELECT)
-- - financeiro_auditoria: consolidar SELECT (master vê tudo, self é subset)
-- - profiles: MANTER 2 policies (casos de uso distintos legítimos:
--   master atualiza profile de outros / user atualiza próprio profile.
--   Consolidar quebraria semântica)
-- =============================================

BEGIN;

-- ────────────────────────────────────────────────
-- empresas_config: consolida SELECT
-- ────────────────────────────────────────────────
-- master_write (ALL) já cobre SELECT pra master.
-- Mas SELECT pra non-master também precisa funcionar (visualizar config).
-- Solução: deixar só empresas_config_select pra SELECT, master_write fica
-- só pra INSERT/UPDATE/DELETE.

DROP POLICY IF EXISTS empresas_config_master_write ON public.empresas_config;

-- Recria como INSERT/UPDATE/DELETE (sem SELECT)
CREATE POLICY empresas_config_master_insert ON public.empresas_config
  FOR INSERT TO authenticated
  WITH CHECK (
    empresa_id = get_empresa_id() AND
    get_user_role() = 'master'
  );

CREATE POLICY empresas_config_master_update ON public.empresas_config
  FOR UPDATE TO authenticated
  USING (empresa_id = get_empresa_id() AND get_user_role() = 'master')
  WITH CHECK (empresa_id = get_empresa_id() AND get_user_role() = 'master');

CREATE POLICY empresas_config_master_delete ON public.empresas_config
  FOR DELETE TO authenticated
  USING (empresa_id = get_empresa_id() AND get_user_role() = 'master');

-- empresas_config_select continua igual (SELECT pra qualquer authenticated
-- da mesma empresa). Mantém.

-- ────────────────────────────────────────────────
-- financeiro_auditoria: consolida SELECT
-- ────────────────────────────────────────────────
-- auditoria_master_read: master/gerente da empresa lê tudo
-- auditoria_self_read: usuário lê só onde foi ator
-- → master/gerente já é superset do self
-- → operacional/visualizador só vê próprios

DROP POLICY IF EXISTS auditoria_master_read ON public.financeiro_auditoria;
DROP POLICY IF EXISTS auditoria_self_read ON public.financeiro_auditoria;

CREATE POLICY auditoria_select_consolidado ON public.financeiro_auditoria
  FOR SELECT TO authenticated
  USING (
    empresa_id = get_empresa_id() AND (
      get_user_role() = ANY (ARRAY['master', 'gerente'])
      OR ator_id = (SELECT auth.uid())
    )
  );

COMMIT;

-- =============================================
-- DONE
-- profiles UPDATE: 2 policies preservadas (decisão consciente).
-- empresas_config: master_write virou 3 policies separadas (clean responsibility).
-- financeiro_auditoria: 2 SELECT policies viraram 1 (master_role OR self).
-- =============================================
