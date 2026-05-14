-- =============================================
-- Trigger: sincroniza orcamento.status quando lancamento vira pago
-- =============================================
-- Bug encontrado 14/05/2026 — smoke teste #32:
--   Cliente aprovou e pagou via Asaas. Webhook marcou cobranca='paga' e
--   lancamento='pago', mas orcamento ficou preso em 'aguardando_pagamento'.
--   Operador teria que clicar manualmente "Marcar como pago (convertido)"
--   em /orcamentos pra mover pra aba Convertidos.
--
-- Fix: trigger detecta status='pago' no lancamento e cascateia pro orcamento
-- associado (via orcamentos.lancamento_id). Funciona pra TODOS caminhos
-- de pagamento: Asaas webhook, marcar manual no Financeiro, ajuste DB direto.
--
-- Idempotente: só atualiza orcamentos que ainda estão em 'aguardando_pagamento'.
-- Não regride status de orçamentos já convertidos.
-- =============================================

CREATE OR REPLACE FUNCTION sync_orcamento_on_lancamento_pago()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Só age quando lancamento transiciona PRA 'pago' (não em UPDATEs idênticos
  -- nem em outros campos sendo atualizados)
  IF NEW.status = 'pago' AND (OLD.status IS DISTINCT FROM 'pago') THEN
    UPDATE orcamentos
    SET
      status = 'convertido',
      pago_em = COALESCE(NEW.data_pagamento::timestamptz, NOW()),
      convertido_em = COALESCE(convertido_em, NOW())
    WHERE lancamento_id = NEW.id
      AND status = 'aguardando_pagamento';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_orcamento_on_lancamento_pago ON lancamentos;

CREATE TRIGGER trg_sync_orcamento_on_lancamento_pago
AFTER UPDATE OF status ON lancamentos
FOR EACH ROW
EXECUTE FUNCTION sync_orcamento_on_lancamento_pago();

COMMENT ON FUNCTION sync_orcamento_on_lancamento_pago() IS
'Quando lancamento vira pago (Asaas webhook ou manual), cascateia pro orcamento associado: status=convertido, pago_em=data_pagamento. Sem isso, orcamento ficava preso em aguardando_pagamento.';

-- =============================================
-- BACKFILL — corrigir orcamentos historicamente "presos"
-- =============================================
-- Aplica retroativamente a lógica do trigger pra orçamentos que JÁ tem
-- lancamento pago mas continuaram em 'aguardando_pagamento' (incluindo
-- o smoke teste #32 do dia 14/05/2026 que motivou esse fix).
-- =============================================

UPDATE orcamentos o
SET
  status = 'convertido',
  pago_em = COALESCE(l.data_pagamento::timestamptz, NOW()),
  convertido_em = COALESCE(o.convertido_em, NOW())
FROM lancamentos l
WHERE o.lancamento_id = l.id
  AND l.status = 'pago'
  AND o.status = 'aguardando_pagamento';
