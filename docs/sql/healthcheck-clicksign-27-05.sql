-- ════════════════════════════════════════════════════════════════════════════
-- HEALTHCHECK ClickSign — 27/05/2026
-- ════════════════════════════════════════════════════════════════════════════
-- Risco identificado: cliente aceita a proposta, RPC dispara geração de PDF +
-- envio pra ClickSign assíncrono. Se a integração falhar silenciosamente
-- (token expirado, API down, edge crash), ninguém é avisado. Cliente acha que
-- "tá tudo certo, vou esperar contrato", mas o ClickSign nunca chegou no email.
--
-- Solução: cron a cada 10min que detecta:
--   - status='aceito' há > 8min (margem pro async normal terminar)
--   - terc_clicksign_status = 'nao_enviado' (ainda não confirmou envio)
--   - sem notif master "clicksign_atrasado" criada nas últimas 6h (anti-spam)
--
-- Cria notif pra Letícia/Thales agirem manualmente (reenviar ClickSign no
-- ERP ou debugar a edge).
-- ════════════════════════════════════════════════════════════════════════════

BEGIN;

CREATE OR REPLACE FUNCTION public.cron_healthcheck_clicksign()
RETURNS TABLE(orcamento_id uuid, numero integer, prospect_nome text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_orc RECORD;
BEGIN
  FOR v_orc IN
    SELECT o.id, o.empresa_id, o.numero, o.prospect_nome,
           o.terc_aceito_em,
           EXTRACT(EPOCH FROM (NOW() - o.terc_aceito_em)) / 60 AS minutos_aceito
      FROM public.orcamentos o
     WHERE o.tipo_proposta = 'terceirizacao'
       AND o.status = 'aceito'
       AND o.terc_aceito_em IS NOT NULL
       AND o.terc_aceito_em < NOW() - INTERVAL '8 minutes'
       -- ClickSign não confirmou envio
       AND (o.terc_clicksign_status IS NULL OR o.terc_clicksign_status = 'nao_enviado')
       -- Anti-spam: nenhuma notif desse tipo nas últimas 6h
       AND NOT EXISTS (
         SELECT 1 FROM public.notificacoes n
          WHERE n.orcamento_id = o.id
            AND n.tipo = 'clicksign_atrasado'
            AND n.created_at > NOW() - INTERVAL '6 hours'
       )
  LOOP
    INSERT INTO public.notificacoes (empresa_id, tipo, titulo, mensagem, orcamento_id)
    VALUES (
      v_orc.empresa_id,
      'clicksign_atrasado',
      '⚠️ ClickSign não enviado — PROP-' || LPAD(v_orc.numero::text, 4, '0'),
      'Proposta de ' || COALESCE(v_orc.prospect_nome, 'cliente') ||
      ' foi aceita há ' || ROUND(v_orc.minutos_aceito) || ' min mas o ClickSign ainda não confirmou envio. ' ||
      'Verificar logs da edge function ou reenviar manualmente pelo ERP.',
      v_orc.id
    );

    orcamento_id := v_orc.id;
    numero := v_orc.numero;
    prospect_nome := v_orc.prospect_nome;
    RETURN NEXT;
  END LOOP;
END;
$$;

COMMENT ON FUNCTION public.cron_healthcheck_clicksign() IS
  '27/05: detecta propostas aceitas há > 8min sem ClickSign confirmado. Cria notif master pra ação manual. Anti-spam 6h.';

-- Agendar a cada 10min
SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'healthcheck-clicksign';

SELECT cron.schedule(
  'healthcheck-clicksign',
  '*/10 * * * *',  -- a cada 10 minutos
  $$SELECT public.cron_healthcheck_clicksign();$$
);

-- Verificação
SELECT 'cron_healthcheck_clicksign' as check, EXISTS(
  SELECT 1 FROM pg_proc WHERE proname = 'cron_healthcheck_clicksign'
) as ok
UNION ALL
SELECT 'job_healthcheck-clicksign', EXISTS(
  SELECT 1 FROM cron.job WHERE jobname = 'healthcheck-clicksign'
);

COMMIT;
