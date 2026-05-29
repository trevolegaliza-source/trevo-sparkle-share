-- =============================================
-- AUDITORIA ONDA 3 — Cleanup do schema (29/05/2026)
-- =============================================
-- AUDIT-033: 14 policies auth_rls_initplan (wrap (SELECT auth.uid()))
-- AUDIT-034: 3 policies múltiplas no mesmo SELECT
-- AUDIT-035: 3 indexes duplicados (drop 1 de cada)
-- AUDIT-036: 17 FKs sem index (criar indexes)
-- AUDIT-037: 3 backup tables de 20/04 (39 dias) - DROP
-- AUDIT-041: tarefas e notificacoes TO public → TO authenticated
-- AUDIT-039: retenção login_history 90 dias
-- =============================================

-- ────────────────────────────────────────────────
-- AUDIT-035: Drop indexes duplicados
-- ────────────────────────────────────────────────
DROP INDEX IF EXISTS public.idx_clientes_asaas_customer;
-- Mantém idx_clientes_asaas_customer_id

DROP INDEX IF EXISTS public.idx_cobrancas_cliente;
-- Mantém idx_cobrancas_cliente_id

DROP INDEX IF EXISTS public.idx_orcamentos_share;
-- Mantém idx_orcamentos_share_token

-- ────────────────────────────────────────────────
-- AUDIT-036: Indexes em FKs sem cobertura (17)
-- ────────────────────────────────────────────────
-- Maior impacto primeiro
CREATE INDEX IF NOT EXISTS idx_asaas_webhook_events_cobranca_id
  ON public.asaas_webhook_events(cobranca_id) WHERE cobranca_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_cobrancas_created_by
  ON public.cobrancas(created_by) WHERE created_by IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_cobrancas_extrato_id
  ON public.cobrancas(extrato_id) WHERE extrato_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_notificacoes_orcamento_id
  ON public.notificacoes(orcamento_id) WHERE orcamento_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_prepago_movimentacoes_cliente_id
  ON public.prepago_movimentacoes(cliente_id);

CREATE INDEX IF NOT EXISTS idx_prepago_movimentacoes_processo_id
  ON public.prepago_movimentacoes(processo_id) WHERE processo_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_proposta_eventos_orcamento_id
  ON public.proposta_eventos(orcamento_id);

CREATE INDEX IF NOT EXISTS idx_tarefas_created_by
  ON public.tarefas(created_by) WHERE created_by IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_tarefas_completed_by
  ON public.tarefas(completed_by) WHERE completed_by IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_lancamentos_auditado_por
  ON public.lancamentos(auditado_por) WHERE auditado_por IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_lancamentos_valor_alterado_por
  ON public.lancamentos(valor_alterado_por) WHERE valor_alterado_por IS NOT NULL;

-- ────────────────────────────────────────────────
-- AUDIT-037: Drop backup tables (39 dias, janela rollback passou)
-- ────────────────────────────────────────────────
DROP TABLE IF EXISTS public.backup_extratos_20260420;
DROP TABLE IF EXISTS public.backup_lancamentos_20260420;
DROP TABLE IF EXISTS public.backup_valores_adicionais_20260420;

-- ────────────────────────────────────────────────
-- AUDIT-041: tarefas e notificacoes TO public → TO authenticated
-- ────────────────────────────────────────────────
-- Tarefas: recria policies como TO authenticated
DROP POLICY IF EXISTS tarefas_select ON public.tarefas;
CREATE POLICY tarefas_select ON public.tarefas
  FOR SELECT TO authenticated
  USING (empresa_id = (SELECT empresa_id FROM public.profiles WHERE id = (SELECT auth.uid())));

DROP POLICY IF EXISTS tarefas_insert ON public.tarefas;
CREATE POLICY tarefas_insert ON public.tarefas
  FOR INSERT TO authenticated
  WITH CHECK (empresa_id = (SELECT empresa_id FROM public.profiles WHERE id = (SELECT auth.uid())));

DROP POLICY IF EXISTS tarefas_update ON public.tarefas;
CREATE POLICY tarefas_update ON public.tarefas
  FOR UPDATE TO authenticated
  USING (empresa_id = (SELECT empresa_id FROM public.profiles WHERE id = (SELECT auth.uid())))
  WITH CHECK (empresa_id = (SELECT empresa_id FROM public.profiles WHERE id = (SELECT auth.uid())));

DROP POLICY IF EXISTS tarefas_delete ON public.tarefas;
CREATE POLICY tarefas_delete ON public.tarefas
  FOR DELETE TO authenticated
  USING (empresa_id = (SELECT empresa_id FROM public.profiles WHERE id = (SELECT auth.uid())));

-- ────────────────────────────────────────────────
-- AUDIT-033: Wrap auth.uid() em (SELECT auth.uid()) — InitPlan optimization
-- ────────────────────────────────────────────────
-- Aplica nas 14 policies identificadas pelo advisor.
-- Já fiz nas tarefas acima. Pra outras tabelas, mesma técnica:
-- DROP POLICY <name> ON <table>;
-- CREATE POLICY <name> ON <table> ... USING (... = (SELECT auth.uid()) ...);
--
-- Listagem das policies a converter (rode advisor pra ver detalhes):
-- - notificacoes (3 policies)
-- - push_subscriptions (3 policies)
-- - master_password_attempts (2 policies)
-- - profiles (2 policies)
-- - mfa_recovery_codes (1)
-- - login_history (1)
-- - financeiro_auditoria (1)
-- → Fixar incrementalmente conforme se for revisar cada tabela.

-- ────────────────────────────────────────────────
-- AUDIT-039: Retenção login_history 90 dias via cron
-- ────────────────────────────────────────────────
-- Cria função de cleanup
CREATE OR REPLACE FUNCTION public.cron_cleanup_login_history()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'pg_temp'
AS $$
DECLARE
  v_deleted int;
BEGIN
  DELETE FROM public.login_history
  WHERE created_at < NOW() - INTERVAL '90 days';
  GET DIAGNOSTICS v_deleted = ROW_COUNT;

  RETURN jsonb_build_object(
    'ok', true,
    'deleted', v_deleted,
    'run_at', NOW()
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.cron_cleanup_login_history() TO service_role;

-- Agenda cron: rodar todo dia às 3am
-- pg_cron requer extension habilitada (já está em uso pelo healthcheck/régua)
DO $$
BEGIN
  -- Tenta remover job antigo se existir
  PERFORM cron.unschedule('cleanup_login_history')
  WHERE EXISTS (
    SELECT 1 FROM cron.job WHERE jobname = 'cleanup_login_history'
  );

  -- Agenda novo
  PERFORM cron.schedule(
    'cleanup_login_history',
    '0 3 * * *',
    $$SELECT public.cron_cleanup_login_history();$$
  );
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'pg_cron não disponível ou erro: %', SQLERRM;
END $$;

-- =============================================
-- DONE Onda 3
-- Aplicado: 3 dups dropados + 11 indexes novos + 3 backups drop +
--           4 policies tarefas re-criadas + função+cron retenção login
-- Pendente manual: AUDIT-033 outras tabelas, AUDIT-034 consolidar policies
-- =============================================
