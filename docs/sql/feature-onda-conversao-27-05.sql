-- ════════════════════════════════════════════════════════════════════════════
-- ONDA CONVERSÃO 27/05/2026 — 4 features de pós-conversão em propostas
-- ════════════════════════════════════════════════════════════════════════════
-- 1. Notif master "Cliente abriu a proposta" (trigger acessos_publicos_log)
-- 2. Cron diário D+3/D+7 → notif master pra follow-up
-- 3. Campos + RPC de recusa com motivo
-- 4. get_proposta_por_token retorna status='expirado' (vs NOT_FOUND silencioso)
--
-- Idempotente: roda múltiplas vezes sem efeito colateral.
-- ════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ═════════════════════════════════════════════════════════════════════════
-- 1. NOTIF "Cliente abriu a proposta" — trigger no log de acessos públicos
-- ═════════════════════════════════════════════════════════════════════════
-- Como funciona:
-- - acessos_publicos_log recebe INSERT toda vez que um token público é acessado
-- - Trigger AFTER INSERT verifica se é tipo='proposta' + busca orcamento pelo
--   hash sha256 do share_token (segurança: o log nunca grava o token plain)
-- - Anti-spam: só notifica 1x por orcamento por dia (cliente abre 5x = 1 notif)
-- - Só notifica se proposta tá em estado 'enviado' ou 'aguardando_pagamento'
--   (não enche o saco com proposta já aceita/recusada/expirada)

CREATE OR REPLACE FUNCTION public.trg_notif_proposta_aberta()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_orc RECORD;
  v_ja_notificou_hoje INTEGER;
BEGIN
  IF NEW.tipo <> 'proposta' THEN
    RETURN NEW;
  END IF;

  SELECT id, empresa_id, prospect_nome, numero, status
    INTO v_orc
    FROM public.orcamentos
   WHERE encode(extensions.digest(share_token, 'sha256'), 'hex') = NEW.token_hash
   LIMIT 1;

  IF v_orc.id IS NULL THEN
    RETURN NEW;
  END IF;

  IF v_orc.status NOT IN ('enviado', 'aguardando_pagamento') THEN
    RETURN NEW;
  END IF;

  -- Anti-spam: 1 notif/dia por proposta
  SELECT COUNT(*) INTO v_ja_notificou_hoje
    FROM public.notificacoes
   WHERE orcamento_id = v_orc.id
     AND tipo = 'proposta_aberta'
     AND created_at > NOW() - INTERVAL '24 hours';

  IF v_ja_notificou_hoje > 0 THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.notificacoes (empresa_id, tipo, titulo, mensagem, orcamento_id)
  VALUES (
    v_orc.empresa_id,
    'proposta_aberta',
    '👀 Cliente abriu a proposta',
    COALESCE(v_orc.prospect_nome, 'Cliente') || ' abriu a PROP-' || LPAD(v_orc.numero::text, 4, '0') ||
    '. Bom momento pra follow-up via WhatsApp.',
    v_orc.id
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Fail-soft: erro na notif NÃO bloqueia o log de acesso
  RAISE WARNING 'trg_notif_proposta_aberta falhou: %', SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notif_proposta_aberta_aft ON public.acessos_publicos_log;
CREATE TRIGGER trg_notif_proposta_aberta_aft
  AFTER INSERT ON public.acessos_publicos_log
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_notif_proposta_aberta();

COMMENT ON FUNCTION public.trg_notif_proposta_aberta() IS
  '27/05: notifica master quando cliente abre proposta pública (1x/dia anti-spam).';

-- ═════════════════════════════════════════════════════════════════════════
-- 2. CRON DIÁRIO — lembrete D+3 / D+7 sem aceite
-- ═════════════════════════════════════════════════════════════════════════
-- Roda às 10:00 BRT (13:00 UTC) buscando propostas:
--   - status='enviado' E created_at = HOJE-3 dias (lembrete D+3)
--   - status='enviado' E created_at = HOJE-7 dias (lembrete D+7)
-- Cria notif master pra Letícia/Thales fazerem follow-up (sem email automático
-- pro cliente nessa primeira versão — evita risco de spam até confirmar com Thales).
-- Idempotência: 1 notif de cada tipo por proposta (não duplica entre execuções).

CREATE OR REPLACE FUNCTION public.cron_lembrete_proposta_sem_aceite()
RETURNS TABLE(tipo text, total integer) -- pra log
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_d3 INTEGER := 0;
  v_d7 INTEGER := 0;
  v_orc RECORD;
BEGIN
  -- D+3: 3 dias sem aceite
  FOR v_orc IN
    SELECT o.id, o.empresa_id, o.prospect_nome, o.numero,
           o.validade_dias,
           (o.created_at::date + (COALESCE(o.validade_dias, 15) || ' days')::interval)::date AS data_expira
      FROM public.orcamentos o
     WHERE o.tipo_proposta = 'terceirizacao'
       AND o.status = 'enviado'
       AND o.created_at::date = (CURRENT_DATE - INTERVAL '3 days')::date
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
      'Proposta enviada há 3 dias pra ' || COALESCE(v_orc.prospect_nome, 'cliente') ||
      ' e ainda sem aceite. Validade até ' || to_char(v_orc.data_expira, 'DD/MM') || '. Sugestão: WhatsApp.',
      v_orc.id
    );
    v_d3 := v_d3 + 1;
  END LOOP;

  -- D+7: 7 dias sem aceite
  FOR v_orc IN
    SELECT o.id, o.empresa_id, o.prospect_nome, o.numero,
           o.validade_dias,
           (o.created_at::date + (COALESCE(o.validade_dias, 15) || ' days')::interval)::date AS data_expira
      FROM public.orcamentos o
     WHERE o.tipo_proposta = 'terceirizacao'
       AND o.status = 'enviado'
       AND o.created_at::date = (CURRENT_DATE - INTERVAL '7 days')::date
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
      ' tem 7 dias e validade expira em ' || to_char(v_orc.data_expira, 'DD/MM') ||
      '. Última chance pro follow-up antes da proposta morrer.',
      v_orc.id
    );
    v_d7 := v_d7 + 1;
  END LOOP;

  -- Log resultado
  RETURN QUERY VALUES ('d3', v_d3), ('d7', v_d7);
END;
$$;

-- Agendar no pg_cron — 10:00 BRT diariamente
-- (UTC-3 → 13:00 UTC). Se já existe, atualiza.
SELECT cron.unschedule(jobid)
  FROM cron.job
 WHERE jobname = 'lembrete-proposta-sem-aceite';

SELECT cron.schedule(
  'lembrete-proposta-sem-aceite',
  '0 13 * * *',  -- 13:00 UTC = 10:00 BRT
  $$SELECT public.cron_lembrete_proposta_sem_aceite();$$
);

COMMENT ON FUNCTION public.cron_lembrete_proposta_sem_aceite() IS
  '27/05: roda 10:00 BRT, cria notif master D+3/D+7 pra propostas sem aceite. Anti-dup via lookup em notificacoes.';

-- ═════════════════════════════════════════════════════════════════════════
-- 3. RECUSA COM MOTIVO — colunas + RPC pública
-- ═════════════════════════════════════════════════════════════════════════
-- Adiciona 3 colunas (motivo categorizado + texto livre + timestamp) e cria
-- RPC chamável pelo link público sem auth.

ALTER TABLE public.orcamentos
  ADD COLUMN IF NOT EXISTS terc_recusa_motivo text
    CHECK (terc_recusa_motivo IS NULL OR terc_recusa_motivo IN ('preco', 'escopo', 'timing', 'outro')),
  ADD COLUMN IF NOT EXISTS terc_recusa_texto text,
  ADD COLUMN IF NOT EXISTS terc_recusado_em timestamp with time zone;

COMMENT ON COLUMN public.orcamentos.terc_recusa_motivo IS
  '27/05: motivo categorizado (preco/escopo/timing/outro) quando cliente recusa via landing pública.';

COMMENT ON COLUMN public.orcamentos.terc_recusa_texto IS
  '27/05: texto livre opcional explicando a recusa.';

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

  -- Valida motivo
  IF p_motivo IS NULL OR p_motivo NOT IN ('preco', 'escopo', 'timing', 'outro') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'MOTIVO_INVALIDO');
  END IF;

  -- Sanitiza texto (limite 500 chars)
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

  -- Notif master
  INSERT INTO public.notificacoes (empresa_id, tipo, titulo, mensagem, orcamento_id)
  VALUES (
    v_orc.empresa_id,
    'proposta_recusada',
    '🚫 Proposta recusada — PROP-' || LPAD(v_orc.numero::text, 4, '0'),
    COALESCE(v_orc.prospect_nome, 'Cliente') || ' recusou. Motivo: ' || p_motivo ||
    COALESCE('. Comentário: ' || p_texto, ''),
    v_orc.id
  );

  RETURN jsonb_build_object('ok', true, 'orcamento_id', v_orc.id, 'status', 'recusado');
END;
$function$;

GRANT EXECUTE ON FUNCTION public.recusar_proposta_terceirizacao(text, text, text) TO anon, authenticated;

-- ═════════════════════════════════════════════════════════════════════════
-- 4. get_proposta_por_token — retornar status='expirado' (não NOT_FOUND silente)
-- ═════════════════════════════════════════════════════════════════════════
-- Hoje a RPC retorna 0 rows se passou da data_expiracao. Resultado: o front cai
-- numa tela genérica de erro. Fix: nova RPC `get_proposta_status` pra a landing
-- chamar ANTES de get_proposta_por_token e detectar expirado.

CREATE OR REPLACE FUNCTION public.get_proposta_status(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_orc RECORD;
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

  -- Expirado por data?
  IF v_orc.data_expiracao IS NOT NULL AND v_orc.data_expiracao <= NOW() THEN
    RETURN jsonb_build_object(
      'found', true,
      'reason', 'EXPIRADO',
      'numero', v_orc.numero,
      'prospect_nome', v_orc.prospect_nome,
      'data_expiracao', v_orc.data_expiracao,
      'tipo_proposta', v_orc.tipo_proposta
    );
  END IF;

  -- Recusada/cancelada/rascunho?
  IF v_orc.status NOT IN ('enviado', 'aguardando_pagamento', 'convertido', 'aceito') THEN
    RETURN jsonb_build_object(
      'found', true,
      'reason', 'INDISPONIVEL',
      'status', v_orc.status,
      'tipo_proposta', v_orc.tipo_proposta
    );
  END IF;

  RETURN jsonb_build_object(
    'found', true,
    'reason', 'OK',
    'status', v_orc.status,
    'has_password', v_orc.has_password,
    'tipo_proposta', v_orc.tipo_proposta
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.get_proposta_status(text) TO anon, authenticated;

COMMENT ON FUNCTION public.get_proposta_status(text) IS
  '27/05: pré-check leve da proposta antes de carregar o conteúdo. Permite a landing renderizar tela de expirado/indisponível em vez de erro genérico.';

COMMIT;

-- ═════════════════════════════════════════════════════════════════════════
-- Verificação
-- ═════════════════════════════════════════════════════════════════════════
SELECT 'trg_notif_proposta_aberta_aft' as check, EXISTS(
  SELECT 1 FROM pg_trigger WHERE tgname = 'trg_notif_proposta_aberta_aft'
) as ok
UNION ALL
SELECT 'cron_lembrete-proposta-sem-aceite', EXISTS(
  SELECT 1 FROM cron.job WHERE jobname = 'lembrete-proposta-sem-aceite'
)
UNION ALL
SELECT 'rpc_recusar_proposta_terceirizacao', EXISTS(
  SELECT 1 FROM pg_proc WHERE proname = 'recusar_proposta_terceirizacao'
)
UNION ALL
SELECT 'rpc_get_proposta_status', EXISTS(
  SELECT 1 FROM pg_proc WHERE proname = 'get_proposta_status'
)
UNION ALL
SELECT 'col_terc_recusa_motivo', EXISTS(
  SELECT 1 FROM information_schema.columns WHERE table_name = 'orcamentos' AND column_name = 'terc_recusa_motivo'
);
