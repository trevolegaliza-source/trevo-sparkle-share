-- =============================================
-- Recurring Billing: mensalistas D-5 automatico
-- =============================================
-- Doc 06 feature #3 — auditoria 14/05/2026.
--
-- Problema atual: mensalistas pagam mensal mas Thales/Carolina geram fatura
-- manualmente todo mes (botao "Gerar Fatura Mensal" no ClienteDetalhe).
-- Decisao Thales 14/05: gerar D-5 do vencimento (cliente tem 5 dias pra
-- pagar), SO lancamento (Asaas manual depois), notificacao in-app + email.
--
-- Esta migration:
--   1. Cria funcao processar_mensalidades_recorrentes() PL/pgSQL
--   2. Agenda via pg_cron pra rodar 1x/dia as 9h UTC (6h BRT)
--
-- Idempotente: checa existencia de lancamento com competencia_mes+ano
-- antes de criar. Re-rodar a funcao no mesmo dia nao duplica.
--
-- Email: SQL apenas cria lancamentos + notif in-app. Edge function
-- `enviar-email-mensalidade` (separada) sera invocada depois quando
-- Thales configurar RESEND_API_KEY nos secrets.
-- =============================================

-- Habilita pg_cron (idempotente — se ja estiver habilitado, NO-OP)
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;

-- =============================================
-- Funcao principal
-- =============================================
CREATE OR REPLACE FUNCTION public.processar_mensalidades_recorrentes()
RETURNS TABLE(
  cliente_id uuid,
  cliente_nome text,
  lancamento_id uuid,
  valor numeric,
  data_vencimento date,
  status text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_cliente RECORD;
  v_data_vencimento date;
  v_competencia_mes integer;
  v_competencia_ano integer;
  v_lancamento_id uuid;
  v_existe_lancamento boolean;
  v_descricao text;
  v_total_criados integer := 0;
  v_total_valor numeric := 0;
  v_empresa_id_notif uuid;
BEGIN
  -- Itera mensalistas ativos com mensalidade definida e dia de vencimento
  FOR v_cliente IN
    SELECT c.id, c.nome, c.apelido, c.mensalidade, c.dia_vencimento_mensal, c.empresa_id, c.email
    FROM clientes c
    WHERE c.is_archived = false
      AND c.tipo = 'MENSALISTA'
      AND c.mensalidade IS NOT NULL
      AND c.mensalidade > 0
      AND c.dia_vencimento_mensal IS NOT NULL
      AND c.dia_vencimento_mensal BETWEEN 1 AND 31
  LOOP
    -- Calcula data_vencimento do MES ATUAL (ou proximo se ja passou)
    -- Regra D-5: gera SE hoje + 5 dias == data_vencimento_do_mes
    v_data_vencimento := make_date(
      EXTRACT(YEAR FROM CURRENT_DATE)::integer,
      EXTRACT(MONTH FROM CURRENT_DATE)::integer,
      LEAST(v_cliente.dia_vencimento_mensal, EXTRACT(DAY FROM (date_trunc('month', CURRENT_DATE) + interval '1 month - 1 day'))::integer)
    );

    -- Se o vencimento desse mes ja passou (dia atual > dia_vencimento),
    -- pula — proximo cron pegara no mes que vem.
    IF v_data_vencimento < CURRENT_DATE THEN
      CONTINUE;
    END IF;

    -- Trigger principal: SO age se hoje for exatamente D-5 do vencimento
    IF v_data_vencimento - CURRENT_DATE <> 5 THEN
      CONTINUE;
    END IF;

    v_competencia_mes := EXTRACT(MONTH FROM v_data_vencimento)::integer;
    v_competencia_ano := EXTRACT(YEAR FROM v_data_vencimento)::integer;

    -- Idempotencia: checa se ja existe lancamento desse cliente nesse mes
    SELECT EXISTS (
      SELECT 1 FROM lancamentos l
      WHERE l.cliente_id = v_cliente.id
        AND l.tipo = 'receber'
        AND l.competencia_mes = v_competencia_mes
        AND l.competencia_ano = v_competencia_ano
        AND l.descricao ILIKE 'Mensalidade%'
    ) INTO v_existe_lancamento;

    IF v_existe_lancamento THEN
      RETURN QUERY SELECT
        v_cliente.id, COALESCE(v_cliente.apelido, v_cliente.nome),
        NULL::uuid, v_cliente.mensalidade, v_data_vencimento,
        'ja_existe'::text;
      CONTINUE;
    END IF;

    -- Cria lancamento
    v_descricao := 'Mensalidade ' || lpad(v_competencia_mes::text, 2, '0') || '/' || v_competencia_ano::text;

    INSERT INTO lancamentos (
      tipo, cliente_id, descricao, valor,
      status, etapa_financeiro,
      data_vencimento, competencia_mes, competencia_ano,
      empresa_id, categoria, notas_cobranca
    ) VALUES (
      'receber', v_cliente.id, v_descricao, v_cliente.mensalidade,
      'pendente', 'cobranca_enviada',
      v_data_vencimento, v_competencia_mes, v_competencia_ano,
      v_cliente.empresa_id, 'mensalidade_recorrente',
      'Auto-gerado por cron mensalista (D-5) em ' || to_char(CURRENT_DATE, 'DD/MM/YYYY')
    )
    RETURNING id INTO v_lancamento_id;

    v_total_criados := v_total_criados + 1;
    v_total_valor := v_total_valor + v_cliente.mensalidade;
    v_empresa_id_notif := v_cliente.empresa_id;

    RETURN QUERY SELECT
      v_cliente.id, COALESCE(v_cliente.apelido, v_cliente.nome),
      v_lancamento_id, v_cliente.mensalidade, v_data_vencimento,
      'criado'::text;
  END LOOP;

  -- Notificacao in-app se criou alguma
  IF v_total_criados > 0 AND v_empresa_id_notif IS NOT NULL THEN
    INSERT INTO notificacoes (empresa_id, tipo, titulo, mensagem, lida)
    VALUES (
      v_empresa_id_notif,
      'recorrente_auto',
      '🔄 ' || v_total_criados || ' mensalidade' || CASE WHEN v_total_criados <> 1 THEN 's' ELSE '' END || ' gerada' || CASE WHEN v_total_criados <> 1 THEN 's' ELSE '' END,
      'Auto-gerado pelo sistema. Total: ' ||
      to_char(v_total_valor, 'FM"R$" 999G999G990D00') ||
      '. Acesse /financeiro pra revisar.',
      false
    );
  END IF;
END;
$function$;

COMMENT ON FUNCTION public.processar_mensalidades_recorrentes() IS
'Roda 1x/dia (pg_cron 9h UTC). Cria lancamentos de mensalidade D-5 do vencimento pra mensalistas ativos. Idempotente via check de competencia_mes+ano. Notifica empresa via sininho in-app. Email pro cliente sera enviado por edge separada (futuro).';

-- =============================================
-- Agendamento pg_cron
-- =============================================
-- Remove job anterior se existe (re-rodar este SQL nao duplica)
SELECT cron.unschedule('processar-mensalidades-recorrentes')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'processar-mensalidades-recorrentes');

-- Agenda: 9h UTC = 6h BRT (-3). Roda diariamente.
SELECT cron.schedule(
  'processar-mensalidades-recorrentes',
  '0 9 * * *', -- minuto hora dia-do-mes mes dia-da-semana
  $$SELECT public.processar_mensalidades_recorrentes();$$
);

-- =============================================
-- Smoke test manual (descomentar pra rodar)
-- =============================================
-- SELECT * FROM public.processar_mensalidades_recorrentes();

-- =============================================
-- Como inspecionar jobs do cron
-- =============================================
-- SELECT * FROM cron.job;
-- SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 10;
