-- dispatch-push-on-notif.sql
-- Trigger AFTER INSERT em notificacoes que chama a edge function enviar-push
-- via pg_net, async (nao bloqueia o INSERT da notif).
--
-- PRE-REQUISITO (rodar UMA VEZ no SQL editor antes desse arquivo):
--   ALTER DATABASE postgres SET app.service_role_key = 'COLE_AQUI_O_SERVICE_ROLE_KEY';
--   ALTER DATABASE postgres SET app.supabase_url = 'https://aahhauquuicvtwtrxyan.supabase.co';
--
-- Depois precisa fazer reconnect ao banco (rodar `SELECT pg_reload_conf();` OU
-- desligar/ligar a sessao do SQL editor) pra GUC ser lida.

CREATE EXTENSION IF NOT EXISTS pg_net;

CREATE OR REPLACE FUNCTION public.dispatch_push_notif(p_notif_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_url text;
  v_key text;
  v_notif RECORD;
  v_url_destino text;
BEGIN
  -- Le GUCs configurados via ALTER DATABASE
  v_url := current_setting('app.supabase_url', true);
  v_key := current_setting('app.service_role_key', true);

  IF v_url IS NULL OR v_key IS NULL THEN
    RAISE WARNING 'dispatch_push_notif: app.supabase_url / app.service_role_key nao configurados';
    RETURN;
  END IF;

  SELECT id, tipo, titulo, mensagem, orcamento_id, destinatario_id, empresa_id
    INTO v_notif
    FROM public.notificacoes
   WHERE id = p_notif_id;

  IF NOT FOUND THEN RETURN; END IF;

  -- URL de destino baseada no tipo da notif
  v_url_destino := CASE
    WHEN v_notif.orcamento_id IS NOT NULL THEN '/orcamentos/' || v_notif.orcamento_id
    WHEN v_notif.tipo = 'cobranca' THEN '/financeiro'
    WHEN v_notif.tipo = 'pagamento' THEN '/financeiro'
    WHEN v_notif.tipo = 'login_novo' THEN '/configuracoes'
    ELSE '/'
  END;

  PERFORM net.http_post(
    url := v_url || '/functions/v1/enviar-push',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_key
    ),
    body := jsonb_build_object(
      'notif_id', v_notif.id,
      'destinatario_id', v_notif.destinatario_id,
      'title', v_notif.titulo,
      'body', v_notif.mensagem,
      'url', v_url_destino,
      'tag', 'notif-' || v_notif.id::text
    )
  );
EXCEPTION WHEN OTHERS THEN
  -- Push e best-effort: erro nao pode propagar e abortar o INSERT da notif
  RAISE WARNING 'dispatch_push_notif falhou: %', SQLERRM;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_dispatch_push_on_notif()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM public.dispatch_push_notif(NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notif_dispatch_push ON public.notificacoes;
CREATE TRIGGER notif_dispatch_push
  AFTER INSERT ON public.notificacoes
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_dispatch_push_on_notif();

COMMENT ON FUNCTION public.dispatch_push_notif(uuid) IS 'Dispara web push via edge function enviar-push. Async (pg_net), nao bloqueia.';
