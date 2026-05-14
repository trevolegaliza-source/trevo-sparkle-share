-- =============================================
-- Notificações automáticas pro cliente em eventos chave
-- =============================================
-- Doc 06 feature #5 — auditoria 14/05/2026.
--
-- Triggers Postgres detectam 3 eventos e chamam edge function
-- `notify-cliente-evento` via pg_net pra enviar email pro cliente:
--
--   1. processos.data_deferimento muda NULL -> valor    (processo deferiu)
--   2. INSERT em cobrancas                              (cobrança gerada)
--   3. cobrancas.asaas_pago_em muda NULL -> valor       (pagamento confirmado)
--
-- Setup:
--   - Adiciona colunas notif_*_enviado_em pra idempotência (1 email por evento)
--   - Habilita pg_net (já vem com Supabase)
--   - Define funcao gatilho compartilhada
--   - Cria 3 triggers
--
-- Fail-soft: se edge function falhar (Resend não configurado, rede off, etc),
-- trigger não bloqueia a transação que disparou. Email simplesmente não envia.
-- =============================================

-- pg_net já vem habilitado no Supabase, mas garantimos:
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- =============================================
-- 1. Colunas de idempotência
-- =============================================
ALTER TABLE processos
  ADD COLUMN IF NOT EXISTS notif_deferimento_enviado_em timestamptz;

ALTER TABLE cobrancas
  ADD COLUMN IF NOT EXISTS notif_geracao_enviado_em timestamptz,
  ADD COLUMN IF NOT EXISTS notif_pagamento_enviado_em timestamptz;

-- =============================================
-- 2. Função compartilhada que dispara a edge
-- =============================================
-- Usa pg_net.http_post (async — não bloqueia trigger). Falha silenciosa.
-- =============================================
CREATE OR REPLACE FUNCTION public._notify_cliente_dispatch(
  p_tipo text,
  p_cliente_id uuid,
  p_processo_id uuid DEFAULT NULL,
  p_cobranca_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_supabase_url text;
  v_anon_key text;
  v_payload jsonb;
BEGIN
  -- Pega URL do projeto via env (vault).
  -- Em Supabase hosted, current_setting('app.settings.supabase_url') pode existir.
  -- Como fallback, deixamos hardcoded pelo project_ref (seguro: trigger SECURITY DEFINER).
  v_supabase_url := 'https://aahhauquuicvtwtrxyan.supabase.co';

  v_payload := jsonb_build_object(
    'tipo', p_tipo,
    'cliente_id', p_cliente_id,
    'processo_id', p_processo_id,
    'cobranca_id', p_cobranca_id
  );

  -- Async fire-and-forget via pg_net. Não esperamos resposta.
  -- Sem headers de auth porque edge é deployada com --no-verify-jwt
  -- e valida internamente via service role no admin client.
  PERFORM extensions.http_post(
    url := v_supabase_url || '/functions/v1/notify-cliente-evento',
    body := v_payload,
    timeout_milliseconds := 5000
  );
EXCEPTION WHEN OTHERS THEN
  -- Logs mas não propaga — não pode bloquear a transação original
  RAISE WARNING '[_notify_cliente_dispatch] falha ao chamar edge: % %', SQLSTATE, SQLERRM;
END;
$function$;

COMMENT ON FUNCTION public._notify_cliente_dispatch IS
'Dispara notify-cliente-evento via pg_net. Async, fail-safe. Chamado pelos 3 triggers.';

-- =============================================
-- 3. Trigger: processo deferiu
-- =============================================
CREATE OR REPLACE FUNCTION public._trg_notify_cliente_deferimento()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Só age quando data_deferimento muda NULL -> valor (deferiu)
  IF NEW.data_deferimento IS NOT NULL
     AND (OLD.data_deferimento IS NULL OR OLD.data_deferimento IS DISTINCT FROM NEW.data_deferimento)
     AND NEW.cliente_id IS NOT NULL
     AND NEW.notif_deferimento_enviado_em IS NULL THEN
    PERFORM public._notify_cliente_dispatch('deferimento', NEW.cliente_id, NEW.id, NULL);
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_notify_cliente_deferimento ON processos;

CREATE TRIGGER trg_notify_cliente_deferimento
AFTER UPDATE OF data_deferimento ON processos
FOR EACH ROW
EXECUTE FUNCTION public._trg_notify_cliente_deferimento();

-- =============================================
-- 4. Trigger: cobrança gerada (INSERT)
-- =============================================
CREATE OR REPLACE FUNCTION public._trg_notify_cliente_cobranca_gerada()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.cliente_id IS NOT NULL AND NEW.status = 'ativa' THEN
    PERFORM public._notify_cliente_dispatch('cobranca_gerada', NEW.cliente_id, NULL, NEW.id);
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_notify_cliente_cobranca_gerada ON cobrancas;

CREATE TRIGGER trg_notify_cliente_cobranca_gerada
AFTER INSERT ON cobrancas
FOR EACH ROW
EXECUTE FUNCTION public._trg_notify_cliente_cobranca_gerada();

-- =============================================
-- 5. Trigger: pagamento confirmado
-- =============================================
CREATE OR REPLACE FUNCTION public._trg_notify_cliente_pagamento()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Só age quando asaas_pago_em muda NULL -> valor
  IF NEW.asaas_pago_em IS NOT NULL
     AND OLD.asaas_pago_em IS NULL
     AND NEW.cliente_id IS NOT NULL
     AND NEW.notif_pagamento_enviado_em IS NULL THEN
    PERFORM public._notify_cliente_dispatch('pagamento', NEW.cliente_id, NULL, NEW.id);
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_notify_cliente_pagamento ON cobrancas;

CREATE TRIGGER trg_notify_cliente_pagamento
AFTER UPDATE OF asaas_pago_em ON cobrancas
FOR EACH ROW
EXECUTE FUNCTION public._trg_notify_cliente_pagamento();

-- =============================================
-- Como inspecionar
-- =============================================
-- Ver triggers ativos:
-- SELECT trigger_name, event_object_table FROM information_schema.triggers
--  WHERE trigger_name LIKE 'trg_notify_cliente%';
--
-- Ver logs pg_net (Supabase Studio > Logs > Edge Functions):
-- ou consultar extensions.http_response onde tem o histórico.
--
-- Como TESTAR manualmente:
-- 1. Update um processo: UPDATE processos SET data_deferimento = now() WHERE id = '...';
--    → trigger dispara → edge function chamada → email enviado se Resend OK.
-- 2. Após sucesso, processos.notif_deferimento_enviado_em fica preenchido.
--
-- Como DESABILITAR temporariamente (sem dropar):
-- ALTER TABLE processos DISABLE TRIGGER trg_notify_cliente_deferimento;
-- ALTER TABLE cobrancas DISABLE TRIGGER trg_notify_cliente_cobranca_gerada;
-- ALTER TABLE cobrancas DISABLE TRIGGER trg_notify_cliente_pagamento;
