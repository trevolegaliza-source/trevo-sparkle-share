-- ════════════════════════════════════════════════════════════════════════════
-- Fixes críticos da auditoria 26/05/2026 noite
-- Resolve: ITEM-001, ITEM-002, ITEM-020, ITEM-027, ITEM-028 check
-- ════════════════════════════════════════════════════════════════════════════
-- Aplicar APÓS o feature-campos-representante-proposta.sql.
-- Idempotente: pode rodar várias vezes sem efeito colateral.
-- ════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ──────────────────────────────────────────────────────────────────────
-- ITEM-001 — CHECK constraint inclui modalidade `preco_por_tipo`
-- Bug original: feature de preços por tipo (26/05) adicionou a modalidade
-- mas esqueceu de atualizar o CHECK, bloqueando INSERT da modalidade nova.
-- ──────────────────────────────────────────────────────────────────────
ALTER TABLE public.orcamentos
  DROP CONSTRAINT IF EXISTS orcamentos_terc_modalidade_check;

ALTER TABLE public.orcamentos
  ADD CONSTRAINT orcamentos_terc_modalidade_check
  CHECK (
    terc_modalidade IS NULL
    OR terc_modalidade IN ('avulso', 'pro_5', 'enterprise_10', 'custom', 'preco_por_tipo')
  );

-- ──────────────────────────────────────────────────────────────────────
-- ITEM-020 — terc_clicksign_status NOT NULL com default + backfill
-- ──────────────────────────────────────────────────────────────────────
UPDATE public.orcamentos
   SET terc_clicksign_status = 'nao_enviado'
 WHERE terc_clicksign_status IS NULL
   AND tipo_proposta = 'terceirizacao';

ALTER TABLE public.orcamentos
  ALTER COLUMN terc_clicksign_status SET DEFAULT 'nao_enviado';

-- (não vou forçar NOT NULL pra não quebrar orçamentos legados de outro tipo)

-- ──────────────────────────────────────────────────────────────────────
-- ITEM-002 + ITEM-003 — Race condition no aceite + janela idempotência PDF
-- Fix: UPDATE com guard de status retorna NÃO ENCONTRADO se já foi aceito.
-- Mata a corrida: só 1 UPDATE faz sucesso, 2º retorna JA_ACEITO.
-- ITEM-027 — também aceita re-aceite a partir de status 'recusado'
-- (cliente mudou de ideia).
-- ──────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.aceitar_proposta_terceirizacao(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_orc RECORD;
  v_updated_id uuid;
  v_supabase_url text;
  v_service_key text;
BEGIN
  PERFORM public._log_acesso_publico('proposta_aceite', p_token);

  -- 1. Resolve por share_token + tipo correto + status válido (inclui 'recusado'
  --    pra permitir cliente mudar de ideia — ITEM-027).
  --    Usa FOR UPDATE pra lockar a linha e evitar leitura concorrente.
  SELECT id, status, tipo_proposta, prospect_nome, empresa_id
    INTO v_orc
    FROM public.orcamentos
   WHERE share_token = p_token
     AND tipo_proposta = 'terceirizacao'
     AND status IN ('enviado', 'aguardando_pagamento', 'recusado')
     AND (data_expiracao IS NULL OR data_expiracao > NOW())
   LIMIT 1
   FOR UPDATE;

  IF v_orc.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND_OR_INVALID');
  END IF;

  -- 2. UPDATE com guard explícito: se outro processo já mudou status pra 'aceito',
  --    este UPDATE retorna 0 rows e abortamos sem disparar PDF duplicado.
  --    (ITEM-002 fix da race condition)
  UPDATE public.orcamentos
     SET status = 'aceito',
         terc_aceito_em = NOW()
   WHERE id = v_orc.id
     AND status IN ('enviado', 'aguardando_pagamento', 'recusado')
  RETURNING id INTO v_updated_id;

  IF v_updated_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'JA_ACEITO_OU_INVALIDO');
  END IF;

  -- 3. Notif master (única — só 1 UPDATE passou, então 1 INSERT aqui)
  INSERT INTO public.notificacoes (empresa_id, tipo, titulo, mensagem, orcamento_id)
  VALUES (
    v_orc.empresa_id,
    'proposta',
    '🍀 Proposta de Terceirização ACEITA',
    COALESCE(v_orc.prospect_nome, 'Cliente') || ' aceitou a proposta. PDF sendo gerado, contrato indo pra assinatura.',
    v_orc.id
  );

  -- 4. Dispara edge function gerar-proposta-msa-pdf (async, não bloqueia)
  --    Se falhar, log mas não interrompe aceite.
  BEGIN
    SELECT decrypted_secret INTO v_supabase_url FROM vault.decrypted_secrets WHERE name = 'supabase_url' LIMIT 1;
    SELECT decrypted_secret INTO v_service_key FROM vault.decrypted_secrets WHERE name = 'service_role_key' LIMIT 1;

    IF v_supabase_url IS NOT NULL AND v_service_key IS NOT NULL THEN
      PERFORM net.http_post(
        url := v_supabase_url || '/functions/v1/gerar-proposta-msa-pdf',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || v_service_key
        ),
        body := jsonb_build_object('orcamento_id', v_orc.id)
      );
    ELSE
      RAISE WARNING 'aceitar_proposta_terceirizacao: secrets vault não configurados, PDF não gerado automaticamente';
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'aceitar_proposta_terceirizacao: disparo edge PDF falhou: %', SQLERRM;
  END;

  RETURN jsonb_build_object('ok', true, 'orcamento_id', v_orc.id, 'status', 'aceito');
END;
$function$;

GRANT EXECUTE ON FUNCTION public.aceitar_proposta_terceirizacao(text) TO anon, authenticated;

-- ──────────────────────────────────────────────────────────────────────
-- ITEM-028 — Confirma que bucket propostas-pdf não tem policy LIST pública
-- ──────────────────────────────────────────────────────────────────────
SELECT
  policyname,
  cmd,
  qual,
  CASE
    WHEN cmd = 'SELECT' THEN '✓ leitura OK (pública, sem listagem)'
    WHEN cmd LIKE '%LIST%' THEN '⚠️ ALERTA: policy de listagem encontrada'
    ELSE 'verificar manualmente'
  END as analise
FROM pg_policies
WHERE schemaname = 'storage'
  AND tablename = 'objects'
  AND qual LIKE '%propostas-pdf%';

-- ──────────────────────────────────────────────────────────────────────
-- Verificação final: lista as constraints e RPC pra confirmar fix
-- ──────────────────────────────────────────────────────────────────────
SELECT
  conname AS constraint_name,
  pg_get_constraintdef(c.oid) AS definicao
FROM pg_constraint c
JOIN pg_class t ON t.oid = c.conrelid
WHERE t.relname = 'orcamentos'
  AND conname = 'orcamentos_terc_modalidade_check';

COMMIT;
