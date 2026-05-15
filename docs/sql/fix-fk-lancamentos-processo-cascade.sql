-- 15/05/2026: operacional nao consegue deletar processo porque
-- useDeleteProcesso faz DELETE em lancamentos primeiro e a RLS
-- lancamentos_delete_role so permite master. Resultado: FK violation
-- no DELETE de processos porque lancamentos ficavam.
--
-- Bug reportado por Thales (administrativo@trevolegaliza.com.br, role=operacional):
--   "Erro ao excluir: update or delete on table 'processos' violates
--    foreign key constraint 'lancamentos_processo_id_fkey' on table 'lancamentos'"
--
-- Fix: trocar FK lancamentos.processo_id pra ON DELETE CASCADE.
-- Cascade roda no engine do Postgres e bypassa RLS, entao basta o
-- usuario ter permissao pra deletar o PROCESSO (processos_delete e
-- aberto pra empresa toda) e os lancamentos sao removidos junto.
--
-- Seguranca: lancamento sem processo_id (lancamentos manuais) NAO
-- sao afetados — cascade so dispara quando o processo pai e deletado.
-- RLS lancamentos_delete_role continua restrita a master pra DELETE
-- direto na tabela (operacional nao pode deletar lancamento solto,
-- so cascateia quando o processo dele e deletado).
--
-- Combina com mudanca em src/hooks/useProcessos.ts:useDeleteProcesso
-- que remove o DELETE manual de lancamentos (cascade resolve).

ALTER TABLE public.lancamentos
  DROP CONSTRAINT IF EXISTS lancamentos_processo_id_fkey;

ALTER TABLE public.lancamentos
  ADD CONSTRAINT lancamentos_processo_id_fkey
  FOREIGN KEY (processo_id)
  REFERENCES public.processos(id)
  ON DELETE CASCADE;
