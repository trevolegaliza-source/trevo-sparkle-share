-- =============================================
-- FIN-004 (17/05/2026): log estruturado + alerta de falha pra pg_cron mensalistas
-- =============================================
-- Auditoria 17/05 mapeou: cron job `processar-mensalidades-recorrentes`
-- (diário 09:00 UTC) chama RPC sem TRY/CATCH externo. Se Postgres falha
-- (constraint violada, deadlock, etc), erro só é registrado em
-- `cron.job_run_details` que ninguém olha. Mensalista perde 24h de cobrança
-- silenciosamente até next day cron rodar.
--
-- Fix em 3 partes:
--   1) Tabela `cron_execution_log` (sucesso + falha de cada run)
--   2) Função wrapper que captura exception e loga
--   3) Após 3 falhas em 24h, cria notif in-app pra cada master ativo
--      (throttle: 1 alerta por master por 24h)
--
-- pg_cron passa a chamar o wrapper. Original `processar_mensalidades_recorrentes`
-- continua intacta — quem chamar manual pra debug continua vendo TABLE.
-- =============================================

-- PASSO 1: Tabela de log
CREATE TABLE IF NOT EXISTS public.cron_execution_log (
  id bigserial PRIMARY KEY,
  job_name text NOT NULL,
  success boolean NOT NULL,
  error_message text,
  details jsonb,
  executed_at timestamptz DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cron_log_job_time
  ON public.cron_execution_log(job_name, executed_at DESC);

-- RLS: só master lê (audit interno)
ALTER TABLE public.cron_execution_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS cron_log_select ON public.cron_execution_log;
CREATE POLICY cron_log_select ON public.cron_execution_log
  FOR SELECT TO authenticated
  USING (get_user_role() = 'master');

-- Master pode limpar histórico antigo se quiser
DROP POLICY IF EXISTS cron_log_delete ON public.cron_execution_log;
CREATE POLICY cron_log_delete ON public.cron_execution_log
  FOR DELETE TO authenticated
  USING (get_user_role() = 'master');

-- PASSO 2: Wrapper com TRY/CATCH
CREATE OR REPLACE FUNCTION public.cron_processar_mensalidades_wrapper()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count int;
  v_failures int;
  v_err_msg text;
BEGIN
  -- Executa a original e conta rows retornadas
  SELECT count(*) INTO v_count
  FROM public.processar_mensalidades_recorrentes();

  -- Log sucesso
  INSERT INTO public.cron_execution_log(job_name, success, details)
  VALUES (
    'processar-mensalidades-recorrentes',
    true,
    jsonb_build_object('rows_returned', v_count)
  );
EXCEPTION WHEN OTHERS THEN
  v_err_msg := SQLERRM;

  -- Log falha
  INSERT INTO public.cron_execution_log(job_name, success, error_message)
  VALUES ('processar-mensalidades-recorrentes', false, v_err_msg);

  -- Conta falhas nas últimas 24h
  SELECT count(*) INTO v_failures
  FROM public.cron_execution_log
  WHERE job_name = 'processar-mensalidades-recorrentes'
    AND success = false
    AND executed_at > NOW() - INTERVAL '24 hours';

  -- Após 3 falhas em 24h: alerta cada master ativo (throttle 1 por 24h)
  IF v_failures >= 3 THEN
    INSERT INTO public.notificacoes (empresa_id, destinatario_id, tipo, titulo, mensagem)
    SELECT
      p.empresa_id,
      p.id,
      'cron_failure',
      'Cron mensalidades falhou ' || v_failures || 'x em 24h',
      'Erro: ' || v_err_msg ||
      '. Veja cron_execution_log pra detalhes. Mensalistas podem não ter cobrança gerada.'
    FROM public.profiles p
    WHERE p.role = 'master'
      AND p.ativo = true
      AND NOT EXISTS (
        SELECT 1 FROM public.notificacoes n
        WHERE n.destinatario_id = p.id
          AND n.tipo = 'cron_failure'
          AND n.created_at > NOW() - INTERVAL '24 hours'
      );
  END IF;
  -- NÃO re-RAISE — quer que próximo cron rode mesmo após falha de hoje
END;
$$;

-- PASSO 3: Atualizar pg_cron pra chamar o wrapper
-- Mantém schedule (diário 09:00 UTC) — só troca o command
DO $$
DECLARE
  v_jobid bigint;
BEGIN
  SELECT jobid INTO v_jobid FROM cron.job
  WHERE jobname = 'processar-mensalidades-recorrentes';

  IF v_jobid IS NOT NULL THEN
    PERFORM cron.unschedule(v_jobid);
  END IF;

  PERFORM cron.schedule(
    'processar-mensalidades-recorrentes',
    '0 9 * * *',
    'SELECT public.cron_processar_mensalidades_wrapper();'
  );
END $$;

-- PASSO 4: Confirma — deve mostrar o job apontando pro wrapper
SELECT jobname, schedule, command, active
FROM cron.job
WHERE jobname = 'processar-mensalidades-recorrentes';
