-- =============================================
-- Backfill orcamento #33 (PRATATEXTIL)
-- =============================================
-- Bug encontrado 14/05/2026:
--   Thales mudou status manualmente pra 'aguardando_pagamento' via dropdown
--   no OrcamentoNovo.tsx, achando que isso disparava o fluxo. Mas a RPC
--   aprovar_orcamento_e_gerar_cobranca NAO rodou — status virou label mas
--   processo/lancamento/cobranca nao foram criados.
--
-- Fix do bug: dropdown nao permite mais escolher 'aguardando_pagamento'
-- manualmente (commit + handleChangeStatus reject).
--
-- Este SQL: corrige o estado do #33 voltando pra 'enviado' pra Thales
-- poder testar o fluxo correto (aprovar pelo link publico).
-- =============================================

UPDATE orcamentos
SET status = 'enviado',
    aprovado_em = NULL,
    updated_at = now()
WHERE numero = 33
  AND status = 'aguardando_pagamento'
  AND processo_id IS NULL
  AND lancamento_id IS NULL;

-- Verificar:
-- SELECT numero, status, processo_id, lancamento_id, aprovado_em
-- FROM orcamentos WHERE numero = 33;
-- esperado: status='enviado', aprovado_em=NULL
