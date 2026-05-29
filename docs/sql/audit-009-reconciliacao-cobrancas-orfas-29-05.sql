-- =============================================
-- AUDIT-009 (29/05/2026) — Reconciliação 11 cobranças com lancamento_id órfão
-- =============================================
-- Análise: 11 cobranças apontam pra lancamento_ids que não existem mais.
-- Causa provável: cleanup ADVANCE BPM 17/05 + cascade de processos deletados.
--
-- Padrão observado:
-- - 5 cobranças do WR CONTABILIDADE (Welderson) compartilham MESMO lancamento_id
--   ebe5062e (3 ativas + 1 vencida + 1 vencida). Cliente foi cobrado 5x pelo
--   mesmo lançamento? Provavelmente bug histórico — lançamento original deletado.
-- - 3 cobranças do MIL CONTAS (1 paga, 1 vencida, 1 cancelada)
-- - 2 do VITAE (vencidas)
-- - 1 do EXPANSIVA (ativa)
-- - 1 do VITAE valor R$1080 tem 2 lancamento_ids: 1 órfão + 1 válido
--
-- ESTRATÉGIA CONSERVADORA (não destrutiva):
--
-- 1) Pras cobranças com ALGUNS lancamento_ids válidos restantes (VITAE 1080):
--    Remover só os órfãos, manter os válidos.
--
-- 2) Pras cobranças com ZERO lancamento_ids válidos:
--    Marcar coluna `lancamento_ids` como ARRAY vazio + atualizar `status='cancelada'`
--    + adicionar nota em campo apropriado.
--
-- 3) NÃO deletar registros - audit/histórico preservado.
-- =============================================

-- Lista pra validação (DRY RUN — só lê)
SELECT
  c.id, c.status, c.total_geral, c.data_vencimento,
  cl.apelido as cliente,
  c.lancamento_ids as ids_atuais,
  c.asaas_payment_id,
  (SELECT ARRAY_AGG(unnest_id)
   FROM unnest(c.lancamento_ids) unnest_id
   WHERE unnest_id IN (SELECT id FROM lancamentos)
  ) as ids_validos,
  (SELECT ARRAY_AGG(unnest_id)
   FROM unnest(c.lancamento_ids) unnest_id
   WHERE unnest_id NOT IN (SELECT id FROM lancamentos)
  ) as ids_orfaos
FROM cobrancas c
LEFT JOIN clientes cl ON cl.id = c.cliente_id
WHERE EXISTS (
  SELECT 1 FROM unnest(c.lancamento_ids) AS unnest_id
  WHERE unnest_id NOT IN (SELECT id FROM lancamentos)
)
ORDER BY c.created_at DESC;

-- ────────────────────────────────────────────────
-- AÇÃO PARTE 1: Remove só órfãos, mantém válidos
-- (afeta 1 cobrança — VITAE 1080 que tem 1 órfão + 1 válido)
-- ────────────────────────────────────────────────
BEGIN;

UPDATE public.cobrancas
SET lancamento_ids = (
  SELECT ARRAY_AGG(unnest_id ORDER BY unnest_id)
  FROM unnest(lancamento_ids) unnest_id
  WHERE unnest_id IN (SELECT id FROM lancamentos)
)
WHERE id = '0c341309-36b6-482d-a3ee-8de3e133e3bd'; -- VITAE R$1080

-- Verifica que não zerou
SELECT id, lancamento_ids FROM cobrancas WHERE id = '0c341309-36b6-482d-a3ee-8de3e133e3bd';

COMMIT;

-- ────────────────────────────────────────────────
-- AÇÃO PARTE 2: 10 cobranças com 100% órfãos
-- Decisão: cancelar (status='cancelada') + zerar ids
-- Asaas payment_id pode estar pago - preservar pra rastreabilidade
-- ────────────────────────────────────────────────
BEGIN;

UPDATE public.cobrancas
SET
  lancamento_ids = ARRAY[]::uuid[],
  status = CASE
    WHEN status = 'paga' THEN 'paga'  -- não mexer em pagas
    WHEN status = 'cancelada' THEN 'cancelada'
    ELSE 'cancelada'  -- ativas/vencidas viram cancelada
  END,
  updated_at = NOW()
WHERE id IN (
  '46629bfc-b1d6-4080-b970-b5e0a4c57c16',  -- EXPANSIVA ativa
  'b5b7f055-3fd4-406a-8e9d-baff1bcaa81f',  -- VITAE vencida R$680
  '04237aa5-a123-48f2-b236-08bae94e0604',  -- MIL CONTAS paga (preserva status)
  '10105f26-32cb-4c18-8153-0959b264a786',  -- MIL CONTAS vencida
  'b78c6617-a011-4093-85d2-5a28d630dca0',  -- MIL CONTAS cancelada (já)
  '2d4a94e0-0924-4302-af12-5725ed401034',  -- WR vencida
  '778373e2-905d-4f3b-ac18-44983de022bc',  -- WR ativa
  'c8e5cbd6-58b5-4f5e-8571-c454bf415c6d',  -- WR ativa
  'bba68673-1e2c-4e41-b40c-ba0925b0ec78',  -- WR ativa
  '7e17f478-8e70-4a7f-a7cf-d82c048233b0'   -- WR ativa
);

-- Verifica resultado
SELECT id, status, lancamento_ids, asaas_payment_id
FROM cobrancas
WHERE id IN (
  '46629bfc-b1d6-4080-b970-b5e0a4c57c16', 'b5b7f055-3fd4-406a-8e9d-baff1bcaa81f',
  '04237aa5-a123-48f2-b236-08bae94e0604', '10105f26-32cb-4c18-8153-0959b264a786',
  'b78c6617-a011-4093-85d2-5a28d630dca0', '2d4a94e0-0924-4302-af12-5725ed401034',
  '778373e2-905d-4f3b-ac18-44983de022bc', 'c8e5cbd6-58b5-4f5e-8571-c454bf415c6d',
  'bba68673-1e2c-4e41-b40c-ba0925b0ec78', '7e17f478-8e70-4a7f-a7cf-d82c048233b0'
);

-- SE OK: COMMIT
-- SE NAO: ROLLBACK
-- COMMIT;

-- ────────────────────────────────────────────────
-- ATENÇÃO MIL CONTAS R$350 (paga):
-- Cobrança 04237aa5 está paga - asaas_payment_id pay_wab7ueze5p5jv8j0
-- Receita já foi reconhecida mas lancamento não existe = recibo gerado sem
-- detalhe do que foi cobrado. Apenas zerar lancamento_ids mantém status.
-- Considerar: criar lancamento_tipo='retroativo' apontando pra essa cobranca?
-- (Optei por NÃO fazer — Thales valida primeiro.)
-- ────────────────────────────────────────────────

-- ────────────────────────────────────────────────
-- ATENÇÃO WR CONTABILIDADE 5x R$1131:
-- Mesma lancamento_id ebe5062e em 5 cobranças = bug histórico (provavelmente
-- recriaram cobrança várias vezes). 4 estão ativas/vencidas, 1 vencida velha.
-- ALL ASAAS: 2 das 5 têm asaas_payment_id (pode ter sido cobrado de verdade).
-- Avaliar com Welderson se foi cobrado em duplicidade.
-- ────────────────────────────────────────────────
