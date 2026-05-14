-- =============================================
-- Fix FK cobrancas_lancamentos.lancamento_id ON DELETE CASCADE
-- =============================================
-- Bug 14/05/2026: ao tentar excluir processo, erro:
--   "update or delete on table 'lancamentos' violates foreign key constraint
--    'cobrancas_lancamentos_lancamento_id_fkey' on table 'cobrancas_lancamentos'"
--
-- Causa: a tabela junction cobrancas_lancamentos tem FK pra lancamentos
-- com ON DELETE RESTRICT. Quando processo eh deletado, CASCADE tenta apagar
-- lancamentos do processo, mas o RESTRICT bloqueia porque existem registros
-- em cobrancas_lancamentos referenciando esses lancamentos.
--
-- Fix: trocar pra ON DELETE CASCADE. Quando lancamento eh deletado, o link
-- na tabela junction some junto. A cobranca em si nao eh deletada (continua
-- existindo mesmo que tenha perdido seus lancamentos vinculados).
--
-- Observacao: a tabela cobrancas tem coluna lancamento_ids[] (array) que
-- coexiste com a tabela junction. A junction parece ser a fonte de verdade
-- pra FK. O array eh atualizado em paralelo pela aplicacao.
-- =============================================

ALTER TABLE public.cobrancas_lancamentos
  DROP CONSTRAINT IF EXISTS cobrancas_lancamentos_lancamento_id_fkey;

ALTER TABLE public.cobrancas_lancamentos
  ADD CONSTRAINT cobrancas_lancamentos_lancamento_id_fkey
  FOREIGN KEY (lancamento_id)
  REFERENCES public.lancamentos(id)
  ON DELETE CASCADE;

-- Verificar:
-- SELECT conname, pg_get_constraintdef(oid)
-- FROM pg_constraint
-- WHERE conname = 'cobrancas_lancamentos_lancamento_id_fkey';
-- esperado: FOREIGN KEY ... ON DELETE CASCADE
