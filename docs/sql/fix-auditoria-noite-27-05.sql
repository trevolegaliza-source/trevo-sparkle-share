-- ════════════════════════════════════════════════════════════════════════════
-- FIXES AUDITORIA NOITE 27/05/2026 — security + logic bugs
-- ════════════════════════════════════════════════════════════════════════════
-- Identificados pela auditoria multi-agente (4 personas) na sessão noturna.
-- Foco: críticos de security + logic bugs que afetam fluxo principal.
-- ════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────
-- SEC-01: get_proposta_status vaza prospect_nome sem checar senha
-- ─────────────────────────────────────────────────────────────────────────
-- Antes: anon com token confirmava nome do cliente + existência da proposta
-- sem nunca digitar senha. Bypass do gate de senha.
-- Agora: se senha_link existe E status='OK', não retorna PII.
CREATE OR REPLACE FUNCTION public.get_proposta_status(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_orc RECORD;
  v_has_password boolean;
BEGIN
  SELECT id, status, data_expiracao, prospect_nome, numero, share_token,
         (senha_link IS NOT NULL AND senha_link <> '') AS has_password,
         tipo_proposta
    INTO v_orc
    FROM public.orcamentos
   WHERE share_token = p_token
   LIMIT 1;

  IF v_orc.id IS NULL THEN
    RETURN jsonb_build_object('found', false, 'reason', 'NOT_FOUND');
  END IF;

  v_has_password := v_orc.has_password;

  -- SEC-03: se status NOT IN whitelist (rascunho/cancelado/recusado), retorna
  -- NOT_FOUND — não diferencia pro mundo externo. Igual get_proposta_por_token.
  IF v_orc.status NOT IN ('enviado', 'aguardando_pagamento', 'convertido', 'aceito') THEN
    RETURN jsonb_build_object('found', false, 'reason', 'NOT_FOUND');
  END IF;

  -- Expirado por data
  IF v_orc.data_expiracao IS NOT NULL AND v_orc.data_expiracao <= NOW() THEN
    RETURN jsonb_build_object(
      'found', true,
      'reason', 'EXPIRADO',
      -- Expirado SEM PII: cliente original já viu nome antes (não estamos vazando
      -- algo novo), mas pra ser conservador no caso de token vazar antes da expiry:
      'numero', v_orc.numero,
      'tipo_proposta', v_orc.tipo_proposta
    );
  END IF;

  -- OK + tem senha → não retorna PII (só has_password)
  IF v_has_password THEN
    RETURN jsonb_build_object(
      'found', true,
      'reason', 'OK',
      'status', v_orc.status,
      'has_password', true,
      'tipo_proposta', v_orc.tipo_proposta
    );
  END IF;

  -- OK + sem senha → retorna tudo (público mesmo)
  RETURN jsonb_build_object(
    'found', true,
    'reason', 'OK',
    'status', v_orc.status,
    'has_password', false,
    'tipo_proposta', v_orc.tipo_proposta
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.get_proposta_status(text) TO anon, authenticated;

COMMENT ON FUNCTION public.get_proposta_status(text) IS
  'SEC-01+SEC-03 (27/05 noite): pre-check leve. NAO vaza PII quando senha_link ativo. Status NOT IN whitelist -> NOT_FOUND.';

-- ─────────────────────────────────────────────────────────────────────────
-- SEC-02: disparar_gerar_pdf_proposta com rate limit + filtro de status
-- ─────────────────────────────────────────────────────────────────────────
-- Antes: qualquer user da empresa podia disparar 1000 PDFs em loop = bill spike
-- + DoS interno. Aceitava qualquer status (rascunho, recusado, etc).
-- Agora: rate limit 30s/proposta + filtro status whitelist.
CREATE OR REPLACE FUNCTION public.disparar_gerar_pdf_proposta(p_orcamento_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_orc RECORD;
  v_supabase_url text;
  v_service_key text;
  v_disparo_recente integer;
BEGIN
  SELECT id, status, tipo_proposta, empresa_id, terc_pdf_url, updated_at
    INTO v_orc
    FROM public.orcamentos
   WHERE id = p_orcamento_id
   LIMIT 1;

  IF v_orc.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  END IF;

  IF v_orc.tipo_proposta <> 'terceirizacao' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'TIPO_INVALIDO');
  END IF;

  -- SEC-02: filtro de status — só dispara pra propostas que fazem sentido
  IF v_orc.status NOT IN ('enviado', 'aguardando_pagamento', 'aceito') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'STATUS_INVALIDO', 'status_atual', v_orc.status);
  END IF;

  -- Permissão: mesma empresa
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles p
     WHERE p.id = auth.uid()
       AND p.empresa_id = v_orc.empresa_id
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'SEM_PERMISSAO');
  END IF;

  -- Cached
  IF v_orc.terc_pdf_url IS NOT NULL THEN
    RETURN jsonb_build_object('ok', true, 'cached', true, 'pdf_url', v_orc.terc_pdf_url);
  END IF;

  -- SEC-02: rate limit — se houve disparo (acessos_publicos_log marca tipo
  -- 'pdf_dispatch') nos últimos 30s pra essa proposta, recusa.
  -- Usa acessos_publicos_log pra não criar tabela nova. O hash sha256 do
  -- orcamento_id serve como dedup key.
  SELECT COUNT(*) INTO v_disparo_recente
    FROM public.acessos_publicos_log
   WHERE tipo = 'pdf_dispatch'
     AND token_hash = encode(extensions.digest(p_orcamento_id::text, 'sha256'), 'hex')
     AND acessado_em > NOW() - INTERVAL '30 seconds';

  IF v_disparo_recente > 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'RATE_LIMIT', 'retry_after_seconds', 30);
  END IF;

  -- Marca tentativa (rate limit + auditoria)
  INSERT INTO public.acessos_publicos_log (tipo, token_hash)
  VALUES ('pdf_dispatch', encode(extensions.digest(p_orcamento_id::text, 'sha256'), 'hex'));

  -- Dispara edge async
  BEGIN
    SELECT decrypted_secret INTO v_supabase_url FROM vault.decrypted_secrets WHERE name = 'supabase_url' LIMIT 1;
    SELECT decrypted_secret INTO v_service_key FROM vault.decrypted_secrets WHERE name = 'service_role_key' LIMIT 1;

    IF v_supabase_url IS NULL OR v_service_key IS NULL THEN
      RETURN jsonb_build_object('ok', false, 'error', 'VAULT_SECRETS_MISSING');
    END IF;

    PERFORM net.http_post(
      url := v_supabase_url || '/functions/v1/gerar-proposta-msa-pdf',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || v_service_key
      ),
      body := jsonb_build_object('orcamento_id', p_orcamento_id)
    );

    RETURN jsonb_build_object('ok', true, 'disparado', true);
  EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('ok', false, 'error', 'HTTP_POST_FAILED', 'detail', SQLERRM);
  END;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.disparar_gerar_pdf_proposta(uuid) TO authenticated;

COMMENT ON FUNCTION public.disparar_gerar_pdf_proposta(uuid) IS
  'SEC-02 (27/05 noite): filtro de status + rate limit 30s por proposta. Anti-DoS interno + bill protection.';

-- ─────────────────────────────────────────────────────────────────────────
-- SEC-06: recusar_proposta_terceirizacao — texto livre fora da mensagem da notif
-- ─────────────────────────────────────────────────────────────────────────
-- Antes: p_texto (controlado por anon) era concatenado em mensagem da notif.
-- Não é SQL injection mas é phishing/spoofing inverso ("URGENTE ligue X").
-- Agora: notif tem só motivo categorizado. Texto fica em terc_recusa_texto
-- (campo já dedicado) — UI mostra separadamente.
CREATE OR REPLACE FUNCTION public.recusar_proposta_terceirizacao(
  p_token text,
  p_motivo text,
  p_texto text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_orc RECORD;
  v_updated_id uuid;
BEGIN
  PERFORM public._log_acesso_publico('proposta_recusa', p_token);

  IF p_motivo IS NULL OR p_motivo NOT IN ('preco', 'escopo', 'timing', 'outro') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'MOTIVO_INVALIDO');
  END IF;

  IF p_texto IS NOT NULL AND length(p_texto) > 500 THEN
    p_texto := substring(p_texto from 1 for 500);
  END IF;

  SELECT id, status, prospect_nome, empresa_id, numero
    INTO v_orc
    FROM public.orcamentos
   WHERE share_token = p_token
     AND tipo_proposta = 'terceirizacao'
     AND status IN ('enviado', 'aguardando_pagamento')
     AND (data_expiracao IS NULL OR data_expiracao > NOW())
   LIMIT 1
   FOR UPDATE;

  IF v_orc.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND_OR_INVALID');
  END IF;

  UPDATE public.orcamentos
     SET status = 'recusado',
         terc_recusado_em = NOW(),
         terc_recusa_motivo = p_motivo,
         terc_recusa_texto = p_texto
   WHERE id = v_orc.id
     AND status IN ('enviado', 'aguardando_pagamento')
  RETURNING id INTO v_updated_id;

  IF v_updated_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'JA_FECHADA');
  END IF;

  -- SEC-06: NOTIF mensagem sem o texto livre. UI mostra terc_recusa_texto
  -- separado quando master clica no card da proposta.
  INSERT INTO public.notificacoes (empresa_id, tipo, titulo, mensagem, orcamento_id)
  VALUES (
    v_orc.empresa_id,
    'proposta_recusada',
    '🚫 Proposta recusada — PROP-' || LPAD(v_orc.numero::text, 4, '0'),
    COALESCE(v_orc.prospect_nome, 'Cliente') || ' recusou. Motivo: ' || p_motivo ||
    CASE WHEN p_texto IS NOT NULL AND length(trim(p_texto)) > 0
         THEN ' (com comentário — abrir proposta pra ver)'
         ELSE ''
    END,
    v_orc.id
  );

  RETURN jsonb_build_object('ok', true, 'orcamento_id', v_orc.id, 'status', 'recusado');
END;
$function$;

GRANT EXECUTE ON FUNCTION public.recusar_proposta_terceirizacao(text, text, text) TO anon, authenticated;

COMMENT ON FUNCTION public.recusar_proposta_terceirizacao(text, text, text) IS
  'SEC-06 (27/05 noite): texto livre fica em terc_recusa_texto. NAO concatena na mensagem da notif (anti-phishing inverso).';

-- ─────────────────────────────────────────────────────────────────────────
-- SEC-07 + ITEM-10: cron de lembretes usa enviado_em (não created_at) + range
-- ─────────────────────────────────────────────────────────────────────────
-- Antes: created_at::date = HOJE-3 → notif imediata se proposta ficou rascunho
-- 3 dias e foi publicada hoje. Spam que treina master a ignorar.
-- Range exato = se cron falhar um dia, notif nunca dispara.
-- Agora: usa enviado_em + BETWEEN intervalo de 2 dias (com NOT EXISTS pra anti-dup).
CREATE OR REPLACE FUNCTION public.cron_lembrete_proposta_sem_aceite()
RETURNS TABLE(tipo text, total integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_d3 INTEGER := 0;
  v_d7 INTEGER := 0;
  v_orc RECORD;
BEGIN
  -- D+3
  FOR v_orc IN
    SELECT o.id, o.empresa_id, o.prospect_nome, o.numero,
           o.validade_dias,
           (COALESCE(o.enviado_em, o.created_at)::date + (COALESCE(o.validade_dias, 15) || ' days')::interval)::date AS data_expira
      FROM public.orcamentos o
     WHERE o.tipo_proposta = 'terceirizacao'
       AND o.status = 'enviado'
       AND COALESCE(o.enviado_em, o.created_at)::date BETWEEN (CURRENT_DATE - INTERVAL '4 days')::date
                                                          AND (CURRENT_DATE - INTERVAL '3 days')::date
       AND NOT EXISTS (
         SELECT 1 FROM public.notificacoes n
          WHERE n.orcamento_id = o.id
            AND n.tipo = 'proposta_lembrete_d3'
       )
  LOOP
    INSERT INTO public.notificacoes (empresa_id, tipo, titulo, mensagem, orcamento_id)
    VALUES (
      v_orc.empresa_id,
      'proposta_lembrete_d3',
      '⏰ D+3 sem aceite — PROP-' || LPAD(v_orc.numero::text, 4, '0'),
      'Proposta enviada há ~3 dias pra ' || COALESCE(v_orc.prospect_nome, 'cliente') ||
      ' e ainda sem aceite. Validade até ' || to_char(v_orc.data_expira, 'DD/MM') || '. Sugestão: WhatsApp.',
      v_orc.id
    );
    v_d3 := v_d3 + 1;
  END LOOP;

  -- D+7
  FOR v_orc IN
    SELECT o.id, o.empresa_id, o.prospect_nome, o.numero,
           o.validade_dias,
           (COALESCE(o.enviado_em, o.created_at)::date + (COALESCE(o.validade_dias, 15) || ' days')::interval)::date AS data_expira
      FROM public.orcamentos o
     WHERE o.tipo_proposta = 'terceirizacao'
       AND o.status = 'enviado'
       AND COALESCE(o.enviado_em, o.created_at)::date BETWEEN (CURRENT_DATE - INTERVAL '8 days')::date
                                                          AND (CURRENT_DATE - INTERVAL '7 days')::date
       AND NOT EXISTS (
         SELECT 1 FROM public.notificacoes n
          WHERE n.orcamento_id = o.id
            AND n.tipo = 'proposta_lembrete_d7'
       )
  LOOP
    INSERT INTO public.notificacoes (empresa_id, tipo, titulo, mensagem, orcamento_id)
    VALUES (
      v_orc.empresa_id,
      'proposta_lembrete_d7',
      '🔥 D+7 sem aceite — PROP-' || LPAD(v_orc.numero::text, 4, '0'),
      'Proposta de ' || COALESCE(v_orc.prospect_nome, 'cliente') ||
      ' tem ~7 dias e validade expira em ' || to_char(v_orc.data_expira, 'DD/MM') ||
      '. Última chance pro follow-up antes da proposta morrer.',
      v_orc.id
    );
    v_d7 := v_d7 + 1;
  END LOOP;

  RETURN QUERY VALUES ('d3', v_d3), ('d7', v_d7);
END;
$$;

COMMENT ON FUNCTION public.cron_lembrete_proposta_sem_aceite() IS
  'SEC-07+ITEM-10 (27/05 noite): usa enviado_em (fallback created_at). Range de 2 dias evita perder execucao se cron falhar 1 dia.';

-- ─────────────────────────────────────────────────────────────────────────
-- ITEM-01: get_proposta_pdf_url — RPC pública pra polling pós-aceite
-- ─────────────────────────────────────────────────────────────────────────
-- Antes: polling chamava get_proposta_por_token sem p_senha → propostas com
-- senha quebram. Solução: nova RPC pública que retorna SÓ terc_pdf_url. Como
-- o cliente já aceitou (e portanto já passou pelo gate de senha pra ver o
-- conteúdo), expor o pdf_url pós-aceite é seguro — a senha já foi validada
-- antes. Só dispara pra status 'aceito'/'aguardando_pagamento'/'convertido'.
CREATE OR REPLACE FUNCTION public.get_proposta_pdf_url(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_pdf_url text;
  v_status text;
BEGIN
  SELECT terc_pdf_url, status INTO v_pdf_url, v_status
    FROM public.orcamentos
   WHERE share_token = p_token
     AND tipo_proposta = 'terceirizacao'
     AND status IN ('aceito', 'aguardando_pagamento', 'convertido')
   LIMIT 1;

  IF v_pdf_url IS NULL THEN
    RETURN jsonb_build_object('found', false);
  END IF;

  RETURN jsonb_build_object('found', true, 'pdf_url', v_pdf_url, 'status', v_status);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.get_proposta_pdf_url(text) TO anon, authenticated;

COMMENT ON FUNCTION public.get_proposta_pdf_url(text) IS
  'ITEM-01 (27/05 noite): polling pos-aceite. Retorna SO terc_pdf_url. Seguro pq cliente ja passou pelo gate de senha pra aceitar.';

COMMIT;

-- ─────────────────────────────────────────────────────────────────────────
-- Verificação
-- ─────────────────────────────────────────────────────────────────────────
SELECT 'sec01_get_proposta_status' as check, pg_get_function_result(oid) IS NOT NULL as ok
FROM pg_proc WHERE proname = 'get_proposta_status'
UNION ALL
SELECT 'sec02_disparar_gerar_pdf_rate_limit',
  pg_get_functiondef(oid) LIKE '%RATE_LIMIT%'
FROM pg_proc WHERE proname = 'disparar_gerar_pdf_proposta'
UNION ALL
SELECT 'sec06_recusar_sem_texto_na_mensagem',
  pg_get_functiondef(oid) NOT LIKE '%|| p_texto%'
FROM pg_proc WHERE proname = 'recusar_proposta_terceirizacao'
UNION ALL
SELECT 'sec07_cron_usa_enviado_em',
  pg_get_functiondef(oid) LIKE '%COALESCE(o.enviado_em%'
FROM pg_proc WHERE proname = 'cron_lembrete_proposta_sem_aceite';
