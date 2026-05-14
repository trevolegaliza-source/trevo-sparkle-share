-- =============================================
-- Fix pode_avancar_cobranca: aceita "pago pelo cliente"
-- =============================================
-- Bug 14/05/2026: cliente Regional/Método Trevo bloqueado de gerar extrato
-- mesmo quando o cliente paga a taxa direto (Trevo nunca adiantou nem tem
-- comprovante). Erro: 'Via "Regional" exige Taxa de Balcão registrada em
-- Valores Adicionais com comprovante de pagamento antes de avançar pra
-- cobrança.'
--
-- Causa: função exigia reembolsavel=TRUE + comprovante_url IS NOT NULL.
-- Mas quando cliente paga direto: reembolsavel=FALSE e sem comprovante
-- (Trevo nunca pagou).
--
-- Fix: aceita 2 cenários como satisfação:
--   A) Trevo pagou e tem comprovante (reembolsável): comprovante_url + reembolsavel=TRUE
--   B) Cliente paga direto: reembolsavel=FALSE (não exige comprovante nem valor>0)
--
-- Mesmo fix aplicado pra Método Trevo (honorário trevo pode ter sido cobrado
-- direto do cliente em alguns fluxos).
-- =============================================

CREATE OR REPLACE FUNCTION public.pode_avancar_cobranca(p_processo_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_via via_analise;
  v_tem_balcao BOOLEAN := FALSE;
  v_tem_trevo BOOLEAN := FALSE;
  v_faltando TEXT[] := ARRAY[]::TEXT[];
BEGIN
  SELECT via_analise INTO v_via FROM public.processos WHERE id = p_processo_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('pode', false, 'motivo', 'Processo não encontrado', 'faltando', ARRAY[]::TEXT[]);
  END IF;

  IF v_via = 'matriz' THEN
    RETURN jsonb_build_object('pode', true, 'faltando', ARRAY[]::TEXT[]);
  END IF;

  -- Regional e Método Trevo exigem taxa_balcao registrada — em 1 de 2 cenários:
  --   (A) Trevo adiantou e tem comprovante (reembolsavel=TRUE)
  --   (B) Cliente paga direto (reembolsavel=FALSE — comprovante opcional)
  SELECT EXISTS (
    SELECT 1 FROM public.valores_adicionais
     WHERE processo_id = p_processo_id
       AND categoria = 'taxa_balcao'
       AND (
         -- Cenário A: reembolsável com comprovante
         (reembolsavel = TRUE AND valor > 0 AND comprovante_url IS NOT NULL)
         OR
         -- Cenário B: pago pelo cliente (não exige comprovante)
         (reembolsavel = FALSE)
       )
  ) INTO v_tem_balcao;

  IF NOT v_tem_balcao THEN
    v_faltando := array_append(v_faltando, 'taxa_balcao');
  END IF;

  IF v_via = 'metodo_trevo' THEN
    SELECT EXISTS (
      SELECT 1 FROM public.valores_adicionais
       WHERE processo_id = p_processo_id
         AND categoria = 'honorario_metodo_trevo'
         AND (
           (reembolsavel = TRUE AND valor > 0)
           OR
           (reembolsavel = FALSE)
         )
    ) INTO v_tem_trevo;

    IF NOT v_tem_trevo THEN
      v_faltando := array_append(v_faltando, 'honorario_metodo_trevo');
    END IF;
  END IF;

  IF array_length(v_faltando, 1) IS NULL THEN
    RETURN jsonb_build_object('pode', true, 'faltando', ARRAY[]::TEXT[]);
  END IF;

  RETURN jsonb_build_object(
    'pode', false,
    'motivo', CASE v_via
      WHEN 'regional' THEN 'Via "Regional" exige Taxa de Balcão registrada em Valores Adicionais (com comprovante OU marcada como "Pago pelo cliente") antes de avançar pra cobrança.'
      WHEN 'metodo_trevo' THEN 'Via "Método Trevo" exige Taxa de Balcão + Honorário Método Trevo registrados em Valores Adicionais.'
      ELSE 'Via desconhecida'
    END,
    'faltando', v_faltando,
    'via', v_via::TEXT
  );
END;
$function$;

-- =============================================
-- Backfill: registros antigos sem categoria precisam ser corrigidos
-- =============================================
-- Inferir categoria pela descrição em registros existentes (categoria NULL).
-- Importante: rodar ANTES de tentar gerar extratos de processos antigos.

UPDATE valores_adicionais
SET categoria = CASE
  WHEN descricao ILIKE '%junta comercial%' THEN 'taxa_junta_comercial'
  WHEN descricao ILIKE '%escritório regional%' OR descricao ILIKE '%escritorio regional%' THEN 'taxa_balcao'
  WHEN descricao ILIKE '%motoboy%' THEN 'motoboy'
  WHEN descricao ILIKE '%método trevo%' OR descricao ILIKE '%metodo trevo%' THEN 'honorario_metodo_trevo'
  ELSE categoria
END
WHERE categoria IS NULL;
