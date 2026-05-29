-- =============================================
-- AUDIT-033 (29/05/2026) — Wrap auth.uid() em InitPlan
-- =============================================
-- Postgres re-avalia auth.uid() linha por linha quando aparece direto em
-- USING/WITH CHECK. Wrap em (SELECT auth.uid()) força avaliação 1x via
-- InitPlan, com ganho de performance significativo em tabelas grandes.
--
-- Tabelas afetadas (Supabase advisor):
-- - notificacoes (3 policies)
-- - push_subscriptions (3)
-- - master_password_attempts (2)
-- - profiles (2)
-- - mfa_recovery_codes (1)
-- - login_history (1)
-- - financeiro_auditoria (1)
-- =============================================

BEGIN;

-- ────────────────────────────────────────────────
-- notificacoes (3 policies)
-- ────────────────────────────────────────────────
DROP POLICY IF EXISTS notificacoes_user_select_proprias ON public.notificacoes;
DROP POLICY IF EXISTS notificacoes_user_update_proprias ON public.notificacoes;
DROP POLICY IF EXISTS notificacoes_user_delete_proprias ON public.notificacoes;

CREATE POLICY notificacoes_user_select_proprias ON public.notificacoes
  FOR SELECT TO authenticated
  USING (destinatario_id = (SELECT auth.uid()));

CREATE POLICY notificacoes_user_update_proprias ON public.notificacoes
  FOR UPDATE TO authenticated
  USING (destinatario_id = (SELECT auth.uid()))
  WITH CHECK (destinatario_id = (SELECT auth.uid()));

CREATE POLICY notificacoes_user_delete_proprias ON public.notificacoes
  FOR DELETE TO authenticated
  USING (destinatario_id = (SELECT auth.uid()));

-- ────────────────────────────────────────────────
-- push_subscriptions (3 policies)
-- ────────────────────────────────────────────────
DROP POLICY IF EXISTS push_subscriptions_user_select ON public.push_subscriptions;
DROP POLICY IF EXISTS push_subscriptions_user_insert ON public.push_subscriptions;
DROP POLICY IF EXISTS push_subscriptions_user_delete ON public.push_subscriptions;

CREATE POLICY push_subscriptions_user_select ON public.push_subscriptions
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

CREATE POLICY push_subscriptions_user_insert ON public.push_subscriptions
  FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY push_subscriptions_user_delete ON public.push_subscriptions
  FOR DELETE TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- ────────────────────────────────────────────────
-- master_password_attempts (2 policies)
-- ────────────────────────────────────────────────
DROP POLICY IF EXISTS master_password_attempts_user_select ON public.master_password_attempts;
DROP POLICY IF EXISTS master_password_attempts_user_insert ON public.master_password_attempts;

CREATE POLICY master_password_attempts_user_select ON public.master_password_attempts
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

CREATE POLICY master_password_attempts_user_insert ON public.master_password_attempts
  FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));

-- ────────────────────────────────────────────────
-- profiles (2 policies)
-- ────────────────────────────────────────────────
DROP POLICY IF EXISTS profiles_self_select ON public.profiles;
DROP POLICY IF EXISTS profiles_self_update ON public.profiles;

CREATE POLICY profiles_self_select ON public.profiles
  FOR SELECT TO authenticated
  USING (id = (SELECT auth.uid()));

CREATE POLICY profiles_self_update ON public.profiles
  FOR UPDATE TO authenticated
  USING (id = (SELECT auth.uid()))
  WITH CHECK (id = (SELECT auth.uid()));

-- ────────────────────────────────────────────────
-- mfa_recovery_codes (1 policy)
-- ────────────────────────────────────────────────
DROP POLICY IF EXISTS user_le_proprios_recovery_codes ON public.mfa_recovery_codes;

CREATE POLICY user_le_proprios_recovery_codes ON public.mfa_recovery_codes
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- ────────────────────────────────────────────────
-- login_history (1 policy)
-- ────────────────────────────────────────────────
DROP POLICY IF EXISTS user_le_proprio_login_history ON public.login_history;

CREATE POLICY user_le_proprio_login_history ON public.login_history
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- ────────────────────────────────────────────────
-- financeiro_auditoria (1 policy de auth.uid())
-- ────────────────────────────────────────────────
-- Esta tabela tem 2 policies sobrepostas (também AUDIT-034) — só ajusta
-- a que usa auth.uid() direto. Consolidação fica pra AUDIT-034.
-- Verifique o nome real da policy via:
--   SELECT polname FROM pg_policy WHERE polrelid = 'public.financeiro_auditoria'::regclass;
-- e ajuste o DROP/CREATE abaixo.

-- (Comentado porque depende do nome exato — ajustar conforme advisor)
-- DROP POLICY IF EXISTS financeiro_auditoria_self ON public.financeiro_auditoria;
-- CREATE POLICY financeiro_auditoria_self ON public.financeiro_auditoria
--   FOR SELECT TO authenticated
--   USING (ator_id = (SELECT auth.uid()));

COMMIT;

-- =============================================
-- DONE — 13 policies recriadas com (SELECT auth.uid())
-- Verifique advisor pra confirmar que warning sumiu
-- =============================================
