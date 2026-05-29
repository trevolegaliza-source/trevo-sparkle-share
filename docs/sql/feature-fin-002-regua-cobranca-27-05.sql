-- ════════════════════════════════════════════════════════════════════════════
-- FIN-002 · Régua de cobrança automática D-3 / D+1 / D+5 / D+10 — 27/05/2026
-- ════════════════════════════════════════════════════════════════════════════
-- Hoje Letícia precisa LEMBRAR de cobrar cada cliente atrasado. Com 11 clientes
-- em risco identificados pelo FIN-004, isso vira insustentável.
--
-- Solução conservadora (sem envio automático no WhatsApp pra não disparar
-- mensagem errada): cron diário CRIA NOTIF MASTER pra cada cobrança que bate
-- o gatilho. Letícia abre a tarefa, clica "Enviar agora" e o sistema monta
-- o link wa.me com mensagem pronta. 1 clique em vez de 10 minutos.
--
-- Gatilhos:
--   D-3  (vencimento em 3 dias)     → "vence dia X, prepare-se"
--   D+1  (vencido ontem)            → "identificamos vencimento ontem"
--   D+5  (vencido há 5 dias)        → "aberto há 5 dias, suspensão em D+10"
--   D+10 (vencido há 10 dias)       → "última chamada antes de suspender"
--
-- Cada gatilho é uma notif única por cobrança — idempotente via NOT EXISTS.
-- ════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────
-- 1. Coluna nova em cobrancas: regua_ativa (default true)
-- ─────────────────────────────────────────────────────────────────────────
ALTER TABLE public.cobrancas
  ADD COLUMN IF NOT EXISTS regua_ativa boolean DEFAULT true NOT NULL;

COMMENT ON COLUMN public.cobrancas.regua_ativa IS
  'FIN-002 (27/05): se false, cron de régua de cobrança não cria notif pra essa cobrança. Letícia desliga em casos especiais.';

-- ─────────────────────────────────────────────────────────────────────────
-- 2. Função que processa a régua — chamada pelo cron
-- ─────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.cron_processar_regua_cobranca()
RETURNS TABLE(gatilho text, total integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_d3 integer := 0;
  v_d1 integer := 0;
  v_d5 integer := 0;
  v_d10 integer := 0;
  v_cob RECORD;
BEGIN
  -- D-3: vence em 3 dias, ativa, não paga
  FOR v_cob IN
    SELECT c.id, c.empresa_id, c.data_vencimento, c.total_geral, cli.apelido, cli.nome, c.share_token
      FROM public.cobrancas c
      JOIN public.clientes cli ON cli.id = c.cliente_id
     WHERE c.status = 'ativa'
       AND c.regua_ativa = true
       AND c.asaas_pago_em IS NULL
       AND c.data_vencimento::date = (CURRENT_DATE + INTERVAL '3 days')::date
       AND NOT EXISTS (
         SELECT 1 FROM public.notificacoes n
          WHERE n.tipo = 'regua_d_menos_3'
            AND n.mensagem LIKE '%' || c.id::text || '%'
       )
  LOOP
    INSERT INTO public.notificacoes (empresa_id, tipo, titulo, mensagem)
    VALUES (
      v_cob.empresa_id,
      'regua_d_menos_3',
      '📅 D-3 · Lembrete pré-vencimento — ' || COALESCE(v_cob.apelido, v_cob.nome),
      'Cobrança ' || v_cob.id::text || ' de ' || COALESCE(v_cob.apelido, v_cob.nome) || ' vence em 3 dias (' ||
      to_char(v_cob.data_vencimento, 'DD/MM') || '). Valor: R$ ' || to_char(v_cob.total_geral, 'FM999G999D00') ||
      '. Sugestão: lembrete amigável via WhatsApp.'
    );
    v_d3 := v_d3 + 1;
  END LOOP;

  -- D+1: vencido ontem
  FOR v_cob IN
    SELECT c.id, c.empresa_id, c.data_vencimento, c.total_geral, cli.apelido, cli.nome
      FROM public.cobrancas c
      JOIN public.clientes cli ON cli.id = c.cliente_id
     WHERE c.status IN ('ativa', 'vencida')
       AND c.regua_ativa = true
       AND c.asaas_pago_em IS NULL
       AND c.data_vencimento::date = (CURRENT_DATE - INTERVAL '1 day')::date
       AND NOT EXISTS (
         SELECT 1 FROM public.notificacoes n
          WHERE n.tipo = 'regua_d_mais_1'
            AND n.mensagem LIKE '%' || c.id::text || '%'
       )
  LOOP
    INSERT INTO public.notificacoes (empresa_id, tipo, titulo, mensagem)
    VALUES (
      v_cob.empresa_id,
      'regua_d_mais_1',
      '⏰ D+1 · Vencido ontem — ' || COALESCE(v_cob.apelido, v_cob.nome),
      'Cobrança ' || v_cob.id::text || ' venceu ontem (' || to_char(v_cob.data_vencimento, 'DD/MM') ||
      '). Valor: R$ ' || to_char(v_cob.total_geral, 'FM999G999D00') ||
      '. Sugestão: contato amigável "identificamos vencimento ontem, podemos te ajudar?"'
    );
    v_d1 := v_d1 + 1;
  END LOOP;

  -- D+5: vencido há 5 dias
  FOR v_cob IN
    SELECT c.id, c.empresa_id, c.data_vencimento, c.total_geral, cli.apelido, cli.nome
      FROM public.cobrancas c
      JOIN public.clientes cli ON cli.id = c.cliente_id
     WHERE c.status IN ('ativa', 'vencida')
       AND c.regua_ativa = true
       AND c.asaas_pago_em IS NULL
       AND c.data_vencimento::date = (CURRENT_DATE - INTERVAL '5 days')::date
       AND NOT EXISTS (
         SELECT 1 FROM public.notificacoes n
          WHERE n.tipo = 'regua_d_mais_5'
            AND n.mensagem LIKE '%' || c.id::text || '%'
       )
  LOOP
    INSERT INTO public.notificacoes (empresa_id, tipo, titulo, mensagem)
    VALUES (
      v_cob.empresa_id,
      'regua_d_mais_5',
      '🔥 D+5 · Aberto há 5 dias — ' || COALESCE(v_cob.apelido, v_cob.nome),
      'Cobrança ' || v_cob.id::text || ' venceu há 5 dias (' || to_char(v_cob.data_vencimento, 'DD/MM') ||
      '). Valor: R$ ' || to_char(v_cob.total_geral, 'FM999G999D00') ||
      '. Sugestão: alerta firme "aberto há 5 dias, suspensão automática em D+10".'
    );
    v_d5 := v_d5 + 1;
  END LOOP;

  -- D+10: última chamada antes de suspender
  FOR v_cob IN
    SELECT c.id, c.empresa_id, c.data_vencimento, c.total_geral, cli.apelido, cli.nome
      FROM public.cobrancas c
      JOIN public.clientes cli ON cli.id = c.cliente_id
     WHERE c.status IN ('ativa', 'vencida')
       AND c.regua_ativa = true
       AND c.asaas_pago_em IS NULL
       AND c.data_vencimento::date = (CURRENT_DATE - INTERVAL '10 days')::date
       AND NOT EXISTS (
         SELECT 1 FROM public.notificacoes n
          WHERE n.tipo = 'regua_d_mais_10'
            AND n.mensagem LIKE '%' || c.id::text || '%'
       )
  LOOP
    INSERT INTO public.notificacoes (empresa_id, tipo, titulo, mensagem)
    VALUES (
      v_cob.empresa_id,
      'regua_d_mais_10',
      '🚨 D+10 · ÚLTIMA CHAMADA — ' || COALESCE(v_cob.apelido, v_cob.nome),
      'Cobrança ' || v_cob.id::text || ' venceu há 10 dias. Valor: R$ ' || to_char(v_cob.total_geral, 'FM999G999D00') ||
      '. AÇÃO: avaliar suspensão de acesso à plataforma + protocolização de novos processos (cláusula §06 do MSA).'
    );
    v_d10 := v_d10 + 1;
  END LOOP;

  RETURN QUERY VALUES
    ('d_menos_3', v_d3),
    ('d_mais_1', v_d1),
    ('d_mais_5', v_d5),
    ('d_mais_10', v_d10);
END;
$$;

COMMENT ON FUNCTION public.cron_processar_regua_cobranca() IS
  'FIN-002 (27/05): cron diário processa régua de cobrança em 4 gatilhos. Cria notif master pra Letícia agir manualmente (sem envio automático WhatsApp — risco de mensagem errada).';

-- ─────────────────────────────────────────────────────────────────────────
-- 3. Agendar pg_cron diário 10:00 BRT (13:00 UTC)
-- ─────────────────────────────────────────────────────────────────────────
SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'regua-cobranca-diaria';

SELECT cron.schedule(
  'regua-cobranca-diaria',
  '0 13 * * *',
  $$SELECT public.cron_processar_regua_cobranca();$$
);

COMMIT;

-- Verificação
SELECT 'rpc_cron_processar_regua' as check, EXISTS(
  SELECT 1 FROM pg_proc WHERE proname = 'cron_processar_regua_cobranca'
) as ok
UNION ALL
SELECT 'job_regua-cobranca-diaria', EXISTS(
  SELECT 1 FROM cron.job WHERE jobname = 'regua-cobranca-diaria'
)
UNION ALL
SELECT 'col_regua_ativa', EXISTS(
  SELECT 1 FROM information_schema.columns
   WHERE table_name = 'cobrancas' AND column_name = 'regua_ativa'
);
