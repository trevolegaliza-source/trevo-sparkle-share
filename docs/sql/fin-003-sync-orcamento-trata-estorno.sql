-- =============================================
-- FIN-003 (17/05/2026): trigger sync_orcamento_on_lancamento_pago detecta estorno
-- =============================================
-- Auditoria 17/05/2026 mapeou: o trigger atual sincroniza orcamento.status
-- pra 'convertido' quando lancamento.status vira 'pago'. Mas NÃO trata o
-- caminho reverso:
--
--   1) Cobrança paga (lancamento.status='pago', orcamento.status='convertido')
--   2) Cliente pede reembolso, Asaas dispara PAYMENT_REFUNDED
--   3) Webhook marca lancamento.status='pendente' (estorno)
--   4) Trigger NÃO dispara pra reverter orcamento (usa OLD.status IS DISTINCT
--      FROM 'pago', mas só age na entrada de 'pago', não na saída)
--   5) Orçamento continua 'convertido' errado — operador acha que houve
--      conversão mas o dinheiro voltou pro cliente.
--
-- Fix: expandir o trigger pra detectar AMBAS as transições:
--   - entrada em 'pago' → orcamento vira 'convertido'
--   - saída de 'pago' → orcamento volta pra 'aguardando_pagamento'
--     (só se ainda estiver em 'convertido' — não regride se for outro estado
--      manualmente movido)
--
-- Idempotente: CREATE OR REPLACE; mantém o trigger existente.
-- =============================================

CREATE OR REPLACE FUNCTION sync_orcamento_on_lancamento_pago()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Caso 1 (original): lançamento virou pago → marca orçamento como convertido
  IF NEW.status = 'pago' AND (OLD.status IS DISTINCT FROM 'pago') THEN
    UPDATE orcamentos
    SET
      status = 'convertido',
      pago_em = COALESCE(NEW.data_pagamento::timestamptz, NOW()),
      convertido_em = COALESCE(convertido_em, NOW())
    WHERE lancamento_id = NEW.id
      AND status = 'aguardando_pagamento';
  END IF;

  -- Caso 2 (FIN-003 17/05): lançamento DEIXOU de ser pago (estorno via Asaas
  -- PAYMENT_REFUNDED ou ajuste manual) → reverte orçamento pra aguardando.
  -- Guard: só reverte se ainda estiver 'convertido' — não regride se operador
  -- moveu manualmente pra outro estado entre os 2 eventos.
  IF OLD.status = 'pago' AND NEW.status IS DISTINCT FROM 'pago' THEN
    UPDATE orcamentos
    SET
      status = 'aguardando_pagamento',
      pago_em = NULL
    WHERE lancamento_id = NEW.id
      AND status = 'convertido';
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION sync_orcamento_on_lancamento_pago() IS
'Sincroniza orcamento.status com lancamento.status nas DUAS direções: (1) virou pago→convertido, (2) saiu de pago→aguardando_pagamento (estorno).';

-- Trigger continua igual — só a função foi atualizada
-- (CREATE OR REPLACE substitui a definição da função sem mexer no trigger)

-- =============================================
-- Audit query (opcional) — listar orçamentos hoje em estado "convertido"
-- com lancamento NÃO mais pago (caso de estorno passado sem trigger reverter)
-- =============================================
-- SELECT o.id AS orcamento_id, o.status AS orcamento_status,
--        l.id AS lancamento_id, l.status AS lancamento_status,
--        l.data_pagamento
-- FROM orcamentos o
-- JOIN lancamentos l ON l.id = o.lancamento_id
-- WHERE o.status = 'convertido'
--   AND l.status <> 'pago'
-- ORDER BY o.updated_at DESC;
