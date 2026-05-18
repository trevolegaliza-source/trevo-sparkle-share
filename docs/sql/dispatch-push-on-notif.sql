-- dispatch-push-on-notif.sql
-- Trigger AFTER INSERT em notificacoes. Faz tudo no banco (busca subs prontas)
-- e manda payload completo pra edge function — ela so dispara web push.
-- Evita problema de auth da edge function PostgREST com keys novas.

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
  v_user_ids uuid[];
  v_subs jsonb;
  v_unread int;
BEGIN
  SELECT decrypted_secret INTO v_url FROM vault.decrypted_secrets WHERE name = 'supabase_url' LIMIT 1;
  SELECT decrypted_secret INTO v_key FROM vault.decrypted_secrets WHERE name = 'service_role_key' LIMIT 1;

  IF v_url IS NULL OR v_key IS NULL THEN
    RAISE WARNING 'dispatch_push_notif: secrets nao configurados no Vault';
    RETURN;
  END IF;

  SELECT id, tipo, titulo, mensagem, orcamento_id, destinatario_id, empresa_id
    INTO v_notif
    FROM public.notificacoes
   WHERE id = p_notif_id;

  IF NOT FOUND THEN RETURN; END IF;

  -- Resolve destinatarios: se destinatario_id presente, so ele. Senao, todos
  -- os masters da empresa
  IF v_notif.destinatario_id IS NOT NULL THEN
    v_user_ids := ARRAY[v_notif.destinatario_id];
  ELSE
    SELECT array_agg(id) INTO v_user_ids
      FROM public.profiles
     WHERE empresa_id = v_notif.empresa_id AND role = 'master';
  END IF;

  IF v_user_ids IS NULL OR array_length(v_user_ids, 1) IS NULL THEN
    RETURN;
  END IF;

  -- Busca subscriptions ativas e monta jsonb pra mandar pronto pra edge function
  SELECT jsonb_agg(jsonb_build_object(
    'id', id, 'endpoint', endpoint, 'p256dh', keys_p256dh, 'auth', keys_auth
  ))
    INTO v_subs
    FROM public.push_subscriptions
   WHERE user_id = ANY(v_user_ids);

  IF v_subs IS NULL OR jsonb_array_length(v_subs) = 0 THEN
    RETURN; -- sem dispositivos cadastrados, nada a enviar
  END IF;

  -- Conta nao-lidas pro destinatario (badge no icone do app)
  SELECT COUNT(*) INTO v_unread
    FROM public.notificacoes
   WHERE destinatario_id = ANY(v_user_ids)
     AND COALESCE(lida, false) = false;

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
      'title', v_notif.titulo,
      'body', v_notif.mensagem,
      'url', v_url_destino,
      'tag', 'notif-' || v_notif.id::text,
      'unread_count', v_unread,
      'subscriptions', v_subs
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
