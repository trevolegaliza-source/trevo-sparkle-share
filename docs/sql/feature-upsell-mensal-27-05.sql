-- ════════════════════════════════════════════════════════════════════════════
-- FEATURE Upsell Pacote Mensal — 27/05/2026 (noite)
-- ════════════════════════════════════════════════════════════════════════════
-- Hoje a proposta padrão é avulso (1 processo por vez). Trevo perde MRR
-- potencial: cliente que faz 5+ processos/mês deveria estar no pacote mensal
-- (pro_5) com 15% desconto = receita previsível.
--
-- Mecanismo: modal de upsell ANTES da confirmação do aceite, quando modalidade
-- atual='avulso'. Cliente pode escolher:
--   - "Quero mensal com 15% off"  → registra interesse + segue pro aceite
--   - "Manter avulso por enquanto" → segue pro aceite direto
--
-- Implementação minimalista: não mexe em valor/modalidade no banco (Letícia
-- conduz a conversão pra mensal manualmente depois). Só registra INTERESSE
-- + cria notif master pra Letícia conduzir o upgrade.
-- ════════════════════════════════════════════════════════════════════════════

BEGIN;

ALTER TABLE public.orcamentos
  ADD COLUMN IF NOT EXISTS terc_interesse_mensal boolean DEFAULT false;

COMMENT ON COLUMN public.orcamentos.terc_interesse_mensal IS
  '27/05 noite: cliente marcou interesse em upgrade pra pacote mensal (Pro_5) no aceite. Letícia conduz a conversão manualmente.';

-- RPC pra registrar interesse (anon-callable)
CREATE OR REPLACE FUNCTION public.registrar_interesse_mensal_proposta(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_orc RECORD;
BEGIN
  PERFORM public._log_acesso_publico('interesse_mensal', p_token);

  SELECT id, empresa_id, prospect_nome, numero, terc_modalidade, status
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

  -- Só faz sentido em modalidade=avulso (mensal já é mensal)
  IF v_orc.terc_modalidade <> 'avulso' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'JA_E_MENSAL');
  END IF;

  -- Marca interesse (idempotente — se já marcado, OK)
  UPDATE public.orcamentos
     SET terc_interesse_mensal = true
   WHERE id = v_orc.id;

  -- Notif master pra Letícia agir (anti-spam: só se já não existe nas últimas 24h)
  IF NOT EXISTS (
    SELECT 1 FROM public.notificacoes n
     WHERE n.orcamento_id = v_orc.id
       AND n.tipo = 'interesse_mensal'
       AND n.created_at > NOW() - INTERVAL '24 hours'
  ) THEN
    INSERT INTO public.notificacoes (empresa_id, tipo, titulo, mensagem, orcamento_id)
    VALUES (
      v_orc.empresa_id,
      'interesse_mensal',
      '💰 Upsell mensal — PROP-' || LPAD(v_orc.numero::text, 4, '0'),
      COALESCE(v_orc.prospect_nome, 'Cliente') ||
      ' marcou interesse em pacote mensal com 15% off. Conduzir conversão pra Pro_5 antes de bater o aceite.',
      v_orc.id
    );
  END IF;

  RETURN jsonb_build_object('ok', true);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.registrar_interesse_mensal_proposta(text) TO anon, authenticated;

COMMENT ON FUNCTION public.registrar_interesse_mensal_proposta(text) IS
  '27/05 noite: marca interesse em upgrade pra mensal. Cria notif master 1x/dia.';

COMMIT;

-- Verificação
SELECT 'col_terc_interesse_mensal' as check, EXISTS(
  SELECT 1 FROM information_schema.columns
  WHERE table_name='orcamentos' AND column_name='terc_interesse_mensal'
) as ok
UNION ALL
SELECT 'rpc_registrar_interesse_mensal_proposta',
  EXISTS(SELECT 1 FROM pg_proc WHERE proname='registrar_interesse_mensal_proposta');
