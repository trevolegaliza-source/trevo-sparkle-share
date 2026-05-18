-- dispatch-push-on-notif.sql
-- Trigger AFTER INSERT em notificacoes que chama a edge function enviar-push
-- via pg_net, async (nao bloqueia o INSERT da notif).
--
-- PRE-REQUISITO: criar 2 secrets no Vault do Supabase (uma vez):
--   Dashboard → Project Settings → Vault → Add new secret
--     Name: supabase_url
--     Secret: https://aahhauquuicvtwtrxyan.supabase.co
--   Dashboard → Project Settings → Vault → Add new secret
--     Name: service_role_key
--     Secret: <COLE_O_SERVICE_ROLE_KEY>
--
-- Vault armazena criptografado. Funcoes SECURITY DEFINER conseguem ler
-- via vault.decrypted_secrets.

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
  -- Le secrets do vault
  SELECT decrypted_secret INTO v_url FROM vault.decrypted_secrets WHERE name = 'supabase_url' LIMIT 1;
  SELECT decrypted_secret INTO v_key FROM vault.decrypted_secrets WHERE name = 'service_role_key' LIMIT 1;

  IF v_url IS NULL OR v_key IS NULL THEN
    RAISE WARNING 'dispatch_push_notif: secrets supabase_url/service_role_key nao configurados no Vault';
    RETURN;
  END IF;

  SELECT id, tipo, titulo, mensagem, orcamento_id, destinatario_id, empresa_id
    INTO v_notif
    FROM public.notificacoes
   WHERE id = p_notif_id;

  IF NOT FOUND THEN RETURN; END IF;

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

REVOKE EXECUTE ON FUNCTION public.dispatch_push_notif(uuid) FROM PUBLIC, anon, authenticated;

COMMENT ON FUNCTION public.dispatch_push_notif(uuid) IS 'Dispara web push via edge function enviar-push. Le secrets do vault. Async (pg_net).';
