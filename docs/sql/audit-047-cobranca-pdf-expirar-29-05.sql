-- =============================================
-- AUDIT-047 (29/05/2026) — cobranca-pdf expira após 30d de pagamento
-- =============================================
-- Bug: link de cobranca-pdf nunca expira mesmo após pagamento.
-- Cliente recebe link, paga, esquece email aberto. 6 meses depois, alguém
-- com acesso ao email vê extrato completo (CPF, valores, descrição).
--
-- Fix: rejeitar GET se cobrança status='paga' E asaas_pago_em > 30 dias.
--
-- Como `cobranca-pdf` é uma edge function pública (sem code no repo),
-- a aplicação real do fix exige modificar a edge. Esta SQL apenas cria
-- view auxiliar pra detectar links expirados, podendo ser usada no JS
-- da edge ou monitoramento.
-- =============================================

CREATE OR REPLACE VIEW public.v_cobrancas_pdf_expiradas
WITH (security_invoker = on)
AS
SELECT
  c.id,
  c.share_token,
  c.cliente_id,
  c.status,
  c.asaas_pago_em,
  c.empresa_id,
  c.total_geral,
  NOW() - c.asaas_pago_em AS tempo_desde_pago
FROM public.cobrancas c
WHERE c.status = 'paga'
  AND c.asaas_pago_em IS NOT NULL
  AND c.asaas_pago_em < NOW() - INTERVAL '30 days';

GRANT SELECT ON public.v_cobrancas_pdf_expiradas TO authenticated;

-- ────────────────────────────────────────────────
-- RPC: cobranca-pdf pode validar via esta função antes de servir
-- ────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.cobranca_pdf_token_valido(p_token text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path TO 'public'
AS $$
DECLARE
  v_status text;
  v_pago_em timestamptz;
BEGIN
  SELECT status, asaas_pago_em INTO v_status, v_pago_em
  FROM public.cobrancas
  WHERE share_token = p_token;

  IF v_status IS NULL THEN RETURN false; END IF;  -- cobrança não existe

  -- Cobranças ativas/vencidas sempre acessíveis (precisam pagar)
  IF v_status IN ('ativa', 'vencida') THEN RETURN true; END IF;

  -- Cobranças pagas: válido até 30 dias após pagamento
  IF v_status = 'paga' AND v_pago_em IS NOT NULL THEN
    RETURN (NOW() - v_pago_em) <= INTERVAL '30 days';
  END IF;

  -- Cancelada ou pago > 30 dias = expirado
  RETURN false;
END;
$$;

GRANT EXECUTE ON FUNCTION public.cobranca_pdf_token_valido(text) TO anon;
GRANT EXECUTE ON FUNCTION public.cobranca_pdf_token_valido(text) TO authenticated;

-- =============================================
-- DONE
-- Próximo passo: modificar edge function cobranca-pdf pra chamar
-- cobranca_pdf_token_valido(token) e devolver 410 Gone se inválido.
-- =============================================
