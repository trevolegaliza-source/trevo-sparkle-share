-- =============================================
-- Notif Sino — Pendência antiga >7d (17/05/2026 noite)
-- =============================================
-- Completa o ciclo da feature Aguardando: pendências sem timer (ou com
-- timer ainda no futuro) que ficam >7 dias paradas geram notificação
-- in-app pra master + responsável da empresa.
--
-- Sem isso, lancamento marcado como "aguardando comprovante" e esquecido
-- pode ficar lá pra sempre (timer não foi setado, ninguém olhou).
--
-- Cron diário às 10:00 UTC (depois do processar-mensalidades que roda às 09).
--
-- Throttle: notif só é criada se NÃO houver notif do mesmo tipo+cobranca
-- desse lancamento criada nas últimas 72h. Evita flood diário do mesmo
-- problema.
-- =============================================

-- 1) Função que processa pendências antigas
CREATE OR REPLACE FUNCTION public.processar_pendencias_antigas()
RETURNS TABLE(
  lancamento_id uuid,
  cliente_nome text,
  motivo text,
  dias_parado int,
  notif_criada boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_lanc RECORD;
  v_master_id uuid;
  v_existe_notif boolean;
  v_dias int;
  v_cliente_nome text;
BEGIN
  -- Itera lancamentos com pendência ATIVA marcada há >7d
  FOR v_lanc IN
    SELECT
      l.id,
      l.empresa_id,
      l.cliente_id,
      l.pendencia_motivo,
      l.pendencia_marcada_em,
      l.pendencia_expira_em,
      c.nome AS cliente_nome,
      c.apelido AS cliente_apelido,
      EXTRACT(DAY FROM (NOW() - l.pendencia_marcada_em))::int AS dias
    FROM public.lancamentos l
    JOIN public.clientes c ON c.id = l.cliente_id
    WHERE l.pendencia_motivo IS NOT NULL
      AND l.pendencia_marcada_em < NOW() - INTERVAL '7 days'
      -- Se tem timer, só notifica se ainda não expirou (expirado já volta sozinho)
      AND (l.pendencia_expira_em IS NULL OR l.pendencia_expira_em > NOW())
      AND l.status <> 'pago'
      AND NOT l.auditado
  LOOP
    v_dias := v_lanc.dias;
    v_cliente_nome := COALESCE(v_lanc.cliente_apelido, v_lanc.cliente_nome);

    -- Throttle: já avisou nas últimas 72h sobre essa pendência específica?
    SELECT EXISTS (
      SELECT 1 FROM public.notificacoes n
      WHERE n.empresa_id = v_lanc.empresa_id
        AND n.tipo = 'pendencia_antiga'
        AND n.mensagem LIKE '%' || v_lanc.id::text || '%'
        AND n.created_at > NOW() - INTERVAL '72 hours'
    ) INTO v_existe_notif;

    IF v_existe_notif THEN
      -- Já notificou recentemente, skip
      RETURN QUERY SELECT v_lanc.id, v_cliente_nome, v_lanc.pendencia_motivo, v_dias, false;
      CONTINUE;
    END IF;

    -- Pega master da empresa
    v_master_id := public.get_empresa_master_id(v_lanc.empresa_id);

    IF v_master_id IS NULL THEN
      RETURN QUERY SELECT v_lanc.id, v_cliente_nome, v_lanc.pendencia_motivo, v_dias, false;
      CONTINUE;
    END IF;

    -- Cria notif pro master
    INSERT INTO public.notificacoes (
      empresa_id, destinatario_id, tipo, titulo, mensagem, lida
    ) VALUES (
      v_lanc.empresa_id,
      v_master_id,
      'pendencia_antiga',
      '⏰ Pendência antiga: ' || v_cliente_nome,
      v_cliente_nome || ' está com pendência "' || v_lanc.pendencia_motivo ||
      '" há ' || v_dias || ' dias (lanç. ' || v_lanc.id::text || '). ' ||
      'Considere cobrar o cliente ou desistir de auditar.',
      false
    );

    RETURN QUERY SELECT v_lanc.id, v_cliente_nome, v_lanc.pendencia_motivo, v_dias, true;
  END LOOP;
END;
$$;

COMMENT ON FUNCTION public.processar_pendencias_antigas IS
'Cron diário pra notificar master sobre pendências da feature Aguardando que ficaram >7d sem resolução. Throttle 72h por lancamento pra não floodar.';

-- 2) Wrapper com TRY/CATCH (mesmo padrão FIN-004)
CREATE OR REPLACE FUNCTION public.cron_processar_pendencias_antigas_wrapper()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count int;
  v_notif_count int;
  v_err_msg text;
BEGIN
  SELECT count(*), count(*) FILTER (WHERE notif_criada)
  INTO v_count, v_notif_count
  FROM public.processar_pendencias_antigas();

  INSERT INTO public.cron_execution_log(job_name, success, details)
  VALUES (
    'processar-pendencias-antigas',
    true,
    jsonb_build_object('rows_processed', v_count, 'notifs_criadas', v_notif_count)
  );
EXCEPTION WHEN OTHERS THEN
  v_err_msg := SQLERRM;
  INSERT INTO public.cron_execution_log(job_name, success, error_message)
  VALUES ('processar-pendencias-antigas', false, v_err_msg);
  -- Não re-RAISE — cron continua amanhã
END;
$$;

-- 3) Agenda no pg_cron (diário 10:00 UTC = 7:00 BRT, depois das mensalidades 9:00 UTC)
DO $$
DECLARE
  v_jobid bigint;
BEGIN
  SELECT jobid INTO v_jobid FROM cron.job
  WHERE jobname = 'processar-pendencias-antigas';

  IF v_jobid IS NOT NULL THEN
    PERFORM cron.unschedule(v_jobid);
  END IF;

  PERFORM cron.schedule(
    'processar-pendencias-antigas',
    '0 10 * * *',
    'SELECT public.cron_processar_pendencias_antigas_wrapper();'
  );
END $$;

-- 4) Smoke test imediato — roda 1x agora pra ver se funciona
SELECT public.cron_processar_pendencias_antigas_wrapper();

-- 5) Confirma — cron schedulado + último log
SELECT jobname, schedule, command, active
FROM cron.job
WHERE jobname = 'processar-pendencias-antigas';

SELECT job_name, success, error_message, details, executed_at
FROM public.cron_execution_log
WHERE job_name = 'processar-pendencias-antigas'
ORDER BY executed_at DESC
LIMIT 3;
