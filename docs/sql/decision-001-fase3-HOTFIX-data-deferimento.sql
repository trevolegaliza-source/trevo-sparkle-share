-- ============================================================================
-- DECISION-001 Fase 3 — HOTFIX restaurar data_deferimento  (13/05/2026 noite)
-- ============================================================================
-- BUG: durante o UPDATE em massa do enum etapa no SQL principal, a trigger
-- sync_deferimento_on_etapa_change (que ainda existia naquele momento)
-- interpretou a mudança pra 'ativo'/'finalizado' como "saiu do pós-deferimento"
-- e setou data_deferimento := NULL em ~37 processos.
--
-- A ordem correta era: dropar a trigger ANTES do UPDATE em massa. O SQL
-- principal dropava no passo 5, depois do passo 2 (UPDATE). Erro meu.
--
-- A trigger já está dropada agora, então este hotfix é seguro — não vai
-- voltar a apagar.
--
-- HEURÍSTICA DE RESTAURAÇÃO:
--   Fix 1: etapa='finalizado' → claramente foi deferido pra chegar lá.
--          Restaura data_deferimento = COALESCE(updated_at, created_at)::date.
--   Fix 2: etapa='ativo' + cliente.momento_faturamento='no_deferimento' +
--          algum lancamento_receber JÁ FORA de 'aguardando_deferimento'
--          → significa que a RPC marcar_deferimento promoveu o lancamento,
--          o que só acontece quando data_deferimento é setada. Restaura.
--
-- Esperado depois deste hotfix:
--   ativo:      ~27 com data_deferimento, ~115 sem (clientes na_solicitacao
--               + ativos no_deferimento ainda não deferidos)
--   finalizado: 14 com data_deferimento, 0 sem
-- ============================================================================

BEGIN;

-- Fix 1: finalizados — todos foram deferidos
UPDATE public.processos
   SET data_deferimento = COALESCE(updated_at::date, created_at::date),
       updated_at = NOW()
 WHERE etapa = 'finalizado'
   AND data_deferimento IS NULL;

-- Fix 2: ativos no_deferimento com lancamento já promovido
UPDATE public.processos p
   SET data_deferimento = COALESCE(p.updated_at::date, p.created_at::date),
       updated_at = NOW()
 WHERE p.etapa = 'ativo'
   AND p.data_deferimento IS NULL
   AND EXISTS (
     SELECT 1 FROM public.lancamentos l
     JOIN public.clientes c ON c.id = p.cliente_id
     WHERE l.processo_id = p.id
       AND l.tipo = 'receber'
       AND l.etapa_financeiro NOT IN ('aguardando_deferimento')
       AND c.momento_faturamento = 'no_deferimento'
   );

COMMIT;

-- ============================================================================
-- VERIFICAÇÃO (rodar separado)
-- ============================================================================
-- SELECT etapa,
--   COUNT(*) AS total,
--   COUNT(*) FILTER (WHERE data_deferimento IS NOT NULL) AS com_data_def,
--   COUNT(*) FILTER (WHERE data_deferimento IS NULL) AS sem_data_def
-- FROM public.processos GROUP BY etapa ORDER BY etapa;
--   Esperado:
--     ativo:      total 142, com_data_def ~27, sem_data_def ~115
--     finalizado: total  14, com_data_def 14,  sem_data_def 0
