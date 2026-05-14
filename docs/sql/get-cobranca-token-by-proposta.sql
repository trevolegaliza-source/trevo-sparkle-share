-- =============================================
-- RPC pública: get_cobranca_token_by_proposta
-- =============================================
-- Permite que o cliente na tela /proposta/:token clique em "Ver pagamento"
-- para reabrir /cobranca/{share_token} e revisitar o recibo Asaas.
--
-- Antes: a tela "Proposta Aprovada" só mostrava texto. Cliente que voltava
-- ao link depois de pagar não tinha como reacessar o comprovante.
--
-- Lookup: orcamento.share_token → orcamento.lancamento_id → cobrancas via
-- lancamento_ids @> ARRAY[lancamento_id]. Retorna NULL se não há cobrança
-- vinculada (status do orcamento ainda 'enviado'/'rascunho') — caller trata.
--
-- SECURITY DEFINER bypassa RLS — o share_token da proposta é a credencial.
-- =============================================

CREATE OR REPLACE FUNCTION public.get_cobranca_token_by_proposta(p_proposta_token text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_lancamento_id uuid;
  v_cobranca_token text;
BEGIN
  SELECT lancamento_id INTO v_lancamento_id
  FROM orcamentos
  WHERE share_token = p_proposta_token
  LIMIT 1;

  IF v_lancamento_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT share_token INTO v_cobranca_token
  FROM cobrancas
  WHERE lancamento_ids @> ARRAY[v_lancamento_id]
  LIMIT 1;

  RETURN v_cobranca_token;
END;
$function$;

COMMENT ON FUNCTION public.get_cobranca_token_by_proposta(text) IS
'Retorna share_token da cobrança vinculada à proposta pública. Usado pela tela /proposta/:token aprovada pra oferecer link "Ver detalhes do pagamento".';
