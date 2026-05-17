-- =============================================
-- BUG-006 (17/05/2026): UNIQUE constraint impede fatura mensal duplicada
-- =============================================
-- Causa raiz: botões "Gerar Fatura Mensal" em ClienteDetalhe.tsx + Cliente
-- AccordionFinanceiro.tsx fazem INSERT em `lancamentos`. ADVANCE BPM teve
-- 12 órfãos em 3 batches porque double-click disparava 2 INSERTs antes do
-- `loadAll` atualizar o state local — o pre-check em React não pegava.
--
-- Front foi corrigido em commit `fix(bug-006)` da sessão 17/05:
--   1) disable no botão durante mutation
--   2) pre-check no banco antes do INSERT
--
-- Este SQL é a DEFESA FINAL: UNIQUE INDEX condicional que torna impossível
-- ter 2 "Fatura mensal — X" pro mesmo cliente em estado inicial
-- (solicitacao_criada + pendente). Se algum outro caminho (RPC, API, script)
-- tentar criar duplicata, o banco rejeita com erro claro.
--
-- COMO RODAR (em ordem):
--   1) Rode o bloco SELECT abaixo PRIMEIRO pra ver se existem duplicatas
--      em produção. Se aparecer linha, NÃO rode o CREATE INDEX antes de
--      limpar (cleanup ad-hoc — mesmo padrão do ADVANCE BPM).
--   2) Rode o CREATE UNIQUE INDEX.
-- =============================================

-- PASSO 1: Auditoria — listar duplicatas existentes (deveria voltar 0 linhas)
SELECT
  cliente_id,
  descricao,
  count(*) AS qtd_duplicatas,
  array_agg(id ORDER BY created_at) AS lancamento_ids,
  array_agg(created_at ORDER BY created_at) AS criados_em
FROM public.lancamentos
WHERE tipo = 'receber'
  AND status = 'pendente'
  AND etapa_financeiro = 'solicitacao_criada'
  AND descricao LIKE 'Fatura mensal —%'
GROUP BY cliente_id, descricao
HAVING count(*) > 1
ORDER BY count(*) DESC;

-- PASSO 2: Se PASSO 1 não retornou nada, rode este CREATE INDEX
-- (CONCURRENTLY é mais seguro em prod — não bloqueia writes durante a criação)
CREATE UNIQUE INDEX IF NOT EXISTS uniq_fatura_mensal_pendente
  ON public.lancamentos (cliente_id, descricao)
  WHERE tipo = 'receber'
    AND status = 'pendente'
    AND etapa_financeiro = 'solicitacao_criada'
    AND descricao LIKE 'Fatura mensal —%';

-- PASSO 3 (opcional): conferir que o índice foi criado
-- SELECT indexname, indexdef FROM pg_indexes
-- WHERE tablename = 'lancamentos' AND indexname = 'uniq_fatura_mensal_pendente';
