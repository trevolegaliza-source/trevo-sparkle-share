-- ════════════════════════════════════════════════════════════════════════════
-- Feature Fase 2 — Geração de PDF unificado (Proposta + MSA)
-- ════════════════════════════════════════════════════════════════════════════
-- 26/05/2026: Quando cliente aceita proposta de terceirização, dispara edge
-- function `gerar-proposta-msa-pdf` que renderiza HTML → PDF (via PDFShift)
-- → salva no Storage → atualiza terc_pdf_url.
--
-- O que este SQL faz:
--   1. Cria bucket Storage `propostas-pdf` (public, sem RLS — Thales pode
--      compartilhar URL direta com cliente; PDFs têm nomes random)
--   2. Atualiza RPC aceitar_proposta_terceirizacao pra disparar a edge async
--      via pg_net (sem bloquear o aceite — PDF gera em segundo plano)
-- ════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ──────────────────────────────────────────────────────────────────────
-- 1. Bucket Storage
-- ──────────────────────────────────────────────────────────────────────
-- Inserts em storage.buckets via INSERT direto (Supabase Storage API)
INSERT INTO storage.buckets (id, name, public)
VALUES ('propostas-pdf', 'propostas-pdf', true)
ON CONFLICT (id) DO NOTHING;

-- Policy: leitura pública (qualquer um com URL acessa). Sem listagem.
-- Como cliente recebe link e está numa proposta privada com share_token,
-- vazamento real do PDF exige descobrir o nome do arquivo (random + timestamp).
DROP POLICY IF EXISTS "Propostas PDF leitura pública" ON storage.objects;
CREATE POLICY "Propostas PDF leitura pública"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'propostas-pdf');

-- Service role faz upload (edge function usa service_role) — bypass de RLS
-- automático pelo postgres ao usar service_role_key.

-- ──────────────────────────────────────────────────────────────────────
-- 2. RPC aceitar_proposta_terceirizacao: dispara edge async
-- ──────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.aceitar_proposta_terceirizacao(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_orc RECORD;
  v_supabase_url text;
  v_service_key text;
BEGIN
  PERFORM public._log_acesso_publico('proposta_aceite', p_token);

  -- Resolve por share_token + tipo correto + status ainda 'enviado'
  SELECT id, status, tipo_proposta, prospect_nome, empresa_id
    INTO v_orc
    FROM public.orcamentos
   WHERE share_token = p_token
     AND tipo_proposta = 'terceirizacao'
     AND status IN ('enviado', 'aguardando_pagamento')
     AND (data_expiracao IS NULL OR data_expiracao > NOW())
   LIMIT 1;

  IF v_orc.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND_OR_INVALID');
  END IF;

  -- Atualiza status + timestamp de aceite
  UPDATE public.orcamentos
     SET status = 'aceito',
         terc_aceito_em = NOW()
   WHERE id = v_orc.id;

  -- Notif master
  INSERT INTO public.notificacoes (empresa_id, tipo, titulo, mensagem, orcamento_id)
  VALUES (
    v_orc.empresa_id,
    'proposta',
    '🍀 Proposta de Terceirização ACEITA',
    COALESCE(v_orc.prospect_nome, 'Cliente') || ' aceitou a proposta. PDF sendo gerado, contrato indo pra assinatura.',
    v_orc.id
  );

  -- Dispara edge function gerar-proposta-msa-pdf (async, não bloqueia)
  -- Se falhar, log mas não interrompe aceite.
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
-- 3. Verificação
-- ──────────────────────────────────────────────────────────────────────
SELECT id, name, public FROM storage.buckets WHERE id = 'propostas-pdf';

COMMIT;
