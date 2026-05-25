-- ════════════════════════════════════════════════════════════════════════════
-- SEC-034 + SEC-035 — push notification: privacidade + unread por user
-- ════════════════════════════════════════════════════════════════════════════
-- SEC-034 (privacidade no lockscreen):
--   Antes: dispatch_push_notif enviava `body = v_notif.mensagem` LITERAL.
--   Mensagens como "Letícia cadastrou processo Padaria do João (R$ 2.500)"
--   apareciam no lockscreen do iPhone — exposição em ambiente físico
--   (telefone na mesa numa reunião). Agora: body genérico por tipo. O texto
--   completo continua na tabela notificacoes.mensagem (acessível após login).
--
-- SEC-035 (badge unread inflado em multi-master):
--   Antes: quando destinatario_id IS NULL, dispatch enviava `unread_count`
--   total de "todos os masters" pra todos os devices. Cada master via no
--   badge a soma de não-lidas dos OUTROS masters também — inflado.
--   Agora: loop por user, cada chamada com unread específico daquele user
--   e subscriptions só daquele user.
--
-- Side effect bom: cada user recebe push customizado, o que prepara o terreno
-- pra futuras melhorias (nome do destinatário, preferências por device).
-- ════════════════════════════════════════════════════════════════════════════

BEGIN;

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
  v_user_id uuid;
  v_subs jsonb;
  v_unread int;
  v_body_safe text;
  v_title_safe text;
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

  -- SEC-034: body GENÉRICO por tipo. Mensagem completa fica na tabela,
  -- acessível só após login. Lockscreen não vaza nome/valor.
  v_title_safe := 'Trevo ERP';
  v_body_safe := CASE
    WHEN v_notif.tipo = 'pagamento' THEN '💰 Pagamento recebido. Toque para ver.'
    WHEN v_notif.tipo = 'cobranca' THEN '📋 Atualização de cobrança. Toque para ver.'
    WHEN v_notif.tipo = 'proposta' OR v_notif.orcamento_id IS NOT NULL THEN '📄 Atualização de proposta. Toque para ver.'
    WHEN v_notif.tipo = 'login_novo' THEN '🔐 Novo login detectado.'
    WHEN v_notif.tipo = 'processo' THEN '⚙️ Novo processo cadastrado.'
    WHEN v_notif.tipo = 'webhook_config_missing' THEN '⚠️ Atenção: configuração crítica do sistema.'
    ELSE '🔔 Nova atividade no ERP.'
  END;

  v_url_destino := CASE
    WHEN v_notif.orcamento_id IS NOT NULL THEN '/orcamentos/' || v_notif.orcamento_id
    WHEN v_notif.tipo = 'cobranca' THEN '/financeiro'
    WHEN v_notif.tipo = 'pagamento' THEN '/financeiro'
    WHEN v_notif.tipo = 'login_novo' THEN '/configuracoes'
    ELSE '/'
  END;

  -- SEC-035: loop por destinatario. Cada user recebe push com unread_count
  -- DELE — não soma global. Tb manda só subs DELE no payload.
  FOREACH v_user_id IN ARRAY v_user_ids LOOP
    -- Subscriptions DESTE user
    SELECT jsonb_agg(jsonb_build_object(
      'id', id, 'endpoint', endpoint, 'p256dh', keys_p256dh, 'auth', keys_auth
    ))
      INTO v_subs
      FROM public.push_subscriptions
     WHERE user_id = v_user_id;

    IF v_subs IS NULL OR jsonb_array_length(v_subs) = 0 THEN
      CONTINUE; -- user sem dispositivo, pula
    END IF;

    -- Conta não-lidas DESTE user
    SELECT COUNT(*) INTO v_unread
      FROM public.notificacoes
     WHERE destinatario_id = v_user_id
       AND COALESCE(lida, false) = false;

    PERFORM net.http_post(
      url := v_url || '/functions/v1/enviar-push',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || v_key
      ),
      body := jsonb_build_object(
        'title', v_title_safe,
        'body', v_body_safe,
        'url', v_url_destino,
        'tag', 'notif-' || v_notif.id::text || '-' || v_user_id::text,
        'unread_count', v_unread,
        'subscriptions', v_subs
      )
    );
  END LOOP;

EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'dispatch_push_notif falhou: %', SQLERRM;
END;
$$;

COMMENT ON FUNCTION public.dispatch_push_notif(uuid) IS
  'SEC-034/035 (25/05/2026): body genérico por tipo (lockscreen seguro) + '
  'loop por destinatario com unread_count específico (badge correto).';

REVOKE EXECUTE ON FUNCTION public.dispatch_push_notif(uuid) FROM PUBLIC, anon, authenticated;

COMMIT;

-- ════════════════════════════════════════════════════════════════════════════
-- ROLLBACK (se algo der errado, restaurar versão antiga):
-- ════════════════════════════════════════════════════════════════════════════
-- Rodar manualmente: a versão antiga está em docs/sql/dispatch-push-on-notif.sql
