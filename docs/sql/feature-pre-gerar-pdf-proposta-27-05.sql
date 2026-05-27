-- ════════════════════════════════════════════════════════════════════════════
-- PRÉ-GERAR PDF da proposta no MOMENTO DO ENVIO — 27/05/2026
-- ════════════════════════════════════════════════════════════════════════════
-- Hoje: cliente aceita → RPC dispara edge → gera PDF (15-25s) → cliente vê loader.
-- Risco: cliente fecha aba achando que o aceite não funcionou.
--
-- Solução: ERP dispara geração JÁ no momento do "Enviar proposta". Quando o
-- cliente abre o link público, o PDF já está pronto. Quando aceita, ClickSign
-- dispara instantâneo (edge function detecta terc_pdf_url existente, pula
-- geração e só envia pra ClickSign — JÁ É IDEMPOTENTE).
--
-- Tem 2 partes:
--   1. RPC `disparar_gerar_pdf_proposta(orcamento_id)` que o ERP chama
--   2. Limpeza automática de terc_pdf_url quando admin re-edita proposta enviada
--      (forçar regen, senão PDF fica desatualizado)
-- ════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────
-- 1. RPC pra disparar geração de PDF (chamada pelo ERP no save 'enviado')
-- ─────────────────────────────────────────────────────────────────────────
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
BEGIN
  -- Valida que o orçamento existe e é do tipo correto
  SELECT id, status, tipo_proposta, empresa_id, terc_pdf_url
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

  -- Permissão: usuário tem que pertencer à mesma empresa do orcamento
  -- (autoria já validada pelo trigger de update no orcamentos, mas reforço aqui)
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles p
     WHERE p.id = auth.uid()
       AND p.empresa_id = v_orc.empresa_id
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'SEM_PERMISSAO');
  END IF;

  -- Se PDF já existe, retorna cached (edge function também pula sozinha)
  IF v_orc.terc_pdf_url IS NOT NULL THEN
    RETURN jsonb_build_object('ok', true, 'cached', true, 'pdf_url', v_orc.terc_pdf_url);
  END IF;

  -- Dispara edge async (não bloqueia)
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
  '27/05: ERP chama no save status=enviado pra pre-gerar PDF antes do aceite. Edge function e idempotente — se terc_pdf_url ja existe, pula.';

-- ─────────────────────────────────────────────────────────────────────────
-- 2. Trigger: limpar terc_pdf_url quando admin re-edita campos críticos
-- ─────────────────────────────────────────────────────────────────────────
-- Se admin muda valor, modalidade, escopo, etc. após PDF gerado, o PDF fica
-- desatualizado. Auto-invalida pra forçar regen no próximo "Enviar".
CREATE OR REPLACE FUNCTION public.trg_invalidar_pdf_proposta()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Só invalida pra propostas de terceirização que JÁ TÊM PDF gerado
  IF NEW.tipo_proposta <> 'terceirizacao' THEN RETURN NEW; END IF;
  IF OLD.terc_pdf_url IS NULL THEN RETURN NEW; END IF;

  -- Detecta mudança em campos críticos (qualquer um quebra o PDF atual)
  IF
    NEW.prospect_nome      IS DISTINCT FROM OLD.prospect_nome OR
    NEW.prospect_cnpj      IS DISTINCT FROM OLD.prospect_cnpj OR
    NEW.terc_modalidade    IS DISTINCT FROM OLD.terc_modalidade OR
    NEW.terc_valor_base    IS DISTINCT FROM OLD.terc_valor_base OR
    NEW.terc_valor_pro     IS DISTINCT FROM OLD.terc_valor_pro OR
    NEW.terc_valor_final_override IS DISTINCT FROM OLD.terc_valor_final_override OR
    NEW.terc_valor_abertura       IS DISTINCT FROM OLD.terc_valor_abertura OR
    NEW.terc_dia_pagamento        IS DISTINCT FROM OLD.terc_dia_pagamento OR
    NEW.terc_vencimento_tipo      IS DISTINCT FROM OLD.terc_vencimento_tipo OR
    NEW.terc_vencimento_outros_texto IS DISTINCT FROM OLD.terc_vencimento_outros_texto OR
    NEW.terc_servicos      IS DISTINCT FROM OLD.terc_servicos OR
    NEW.terc_naturezas     IS DISTINCT FROM OLD.terc_naturezas OR
    NEW.terc_inclusos      IS DISTINCT FROM OLD.terc_inclusos OR
    NEW.terc_regras_rapidas_ativas IS DISTINCT FROM OLD.terc_regras_rapidas_ativas OR
    NEW.terc_observacoes_publicas  IS DISTINCT FROM OLD.terc_observacoes_publicas OR
    NEW.terc_precos_por_tipo IS DISTINCT FROM OLD.terc_precos_por_tipo OR
    NEW.validade_dias       IS DISTINCT FROM OLD.validade_dias
  THEN
    NEW.terc_pdf_url := NULL;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_invalidar_pdf_proposta_bef ON public.orcamentos;
CREATE TRIGGER trg_invalidar_pdf_proposta_bef
  BEFORE UPDATE ON public.orcamentos
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_invalidar_pdf_proposta();

COMMENT ON FUNCTION public.trg_invalidar_pdf_proposta() IS
  '27/05: limpa terc_pdf_url quando campos criticos mudam. Forca regen no proximo Enviar — evita PDF desatualizado.';

COMMIT;

-- ─────────────────────────────────────────────────────────────────────────
-- Verificação
-- ─────────────────────────────────────────────────────────────────────────
SELECT 'rpc_disparar_gerar_pdf' as check, EXISTS(
  SELECT 1 FROM pg_proc WHERE proname = 'disparar_gerar_pdf_proposta'
) as ok
UNION ALL
SELECT 'trg_invalidar_pdf_proposta', EXISTS(
  SELECT 1 FROM pg_trigger WHERE tgname = 'trg_invalidar_pdf_proposta_bef'
);
