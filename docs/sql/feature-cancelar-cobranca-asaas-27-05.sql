-- ════════════════════════════════════════════════════════════════════════════
-- FEATURE: cancelar cobrança Asaas pelo ERP — 27/05/2026
-- ════════════════════════════════════════════════════════════════════════════
-- Caso de uso (Thales): cobrança gerada vai errada (valor, vencimento, etc).
-- Hoje volta processo pra "auditoria" no ERP, mas a cobrança Asaas continua
-- ativa — cliente recebe lembretes/cobrança da cobrança morta. Precisamos
-- cancelar TAMBÉM no Asaas, pelo ERP.
--
-- Solução: coluna nova `asaas_cancelada_em` (timestamp) + edge function
-- nova `asaas-cancelar-cobranca` (DELETE /v3/payments/:id) que atualiza
-- asaas_status='DELETED' e marca timestamp.
-- ════════════════════════════════════════════════════════════════════════════

BEGIN;

ALTER TABLE public.cobrancas
  ADD COLUMN IF NOT EXISTS asaas_cancelada_em timestamp with time zone;

COMMENT ON COLUMN public.cobrancas.asaas_cancelada_em IS
  '27/05 noite: timestamp do cancelamento da cobrança no Asaas via edge function asaas-cancelar-cobranca.';

COMMIT;

-- Verificação
SELECT column_name, data_type
  FROM information_schema.columns
 WHERE table_schema = 'public'
   AND table_name = 'cobrancas'
   AND column_name = 'asaas_cancelada_em';
