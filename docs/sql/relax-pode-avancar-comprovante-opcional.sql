-- 15/05/2026: relaxa pode_avancar_cobranca pra comprovante de taxa_balcao
-- virar OPCIONAL.
--
-- Bug reportado por Thales (cliente ADVANCE BPM, processo LUANNA):
--   "Erro: Via Método Trevo exige Taxa de Balcão + Honorário Método Trevo
--    registrados em Valores Adicionais"
--   Mas os valores estavam registrados. O bloqueio era porque a taxa_balcao
--   estava marcada reembolsavel=TRUE sem comprovante_url — caía no limbo
--   entre cenário A (precisa comprovante) e cenário B (precisa reemb=false).
--
-- Causa raiz da regra original (ux-019-metodo-trevo-atomico.sql, 14/05):
--   Forcar disciplina — se Trevo adiantou, exige prova de pagamento pra
--   evitar reembolsos "esquecidos".
--
-- Problema na pratica: Thales paga taxa presencial na Junta Comercial e
--   nem sempre tem recibo digital. A regra estrita estava bloqueando casos
--   legitimos.
--
-- Fix: comprovante vira audit-trail, nao gate. Regra nova:
--   taxa_balcao com valor > 0 (qualquer reembolsavel, qualquer comprovante).
--
-- Visibilidade preservada: UI continua mostrando clip vazio na coluna
-- COMPROV. quando falta comprovante. Thales ve a falta sem ser bloqueado.

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

  -- Regional e Método Trevo exigem taxa_balcao registrada com valor > 0.
  -- Comprovante e reembolsavel sao livres (auditoria so).
  SELECT EXISTS (
    SELECT 1 FROM public.valores_adicionais
     WHERE processo_id = p_processo_id
       AND categoria = 'taxa_balcao'
       AND valor > 0
  ) INTO v_tem_balcao;

  IF NOT v_tem_balcao THEN
    v_faltando := array_append(v_faltando, 'taxa_balcao');
  END IF;

  IF v_via = 'metodo_trevo' THEN
    SELECT EXISTS (
      SELECT 1 FROM public.valores_adicionais
       WHERE processo_id = p_processo_id
         AND categoria = 'honorario_metodo_trevo'
         AND valor > 0
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
      WHEN 'regional' THEN 'Via "Regional" exige Taxa de Balcão registrada em Valores Adicionais antes de avançar pra cobrança.'
      WHEN 'metodo_trevo' THEN 'Via "Método Trevo" exige Taxa de Balcão + Honorário Método Trevo registrados em Valores Adicionais (com valor > 0).'
      ELSE 'Via desconhecida'
    END,
    'faltando', v_faltando,
    'via', v_via::TEXT
  );
END;
$function$;
