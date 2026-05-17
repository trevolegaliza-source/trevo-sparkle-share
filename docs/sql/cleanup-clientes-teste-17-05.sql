-- =============================================
-- CLEANUP CLIENTES TESTE (17/05/2026 — pré-viagem Thales)
-- =============================================
-- Decisão Thales 17/05: limpar TODOS clientes teste do banco antes da
-- viagem (19/05) pra Letícia/secretária não confundirem com clientes reais.
--
-- ALVOS:
--   - CAROLINA GUIRADO TESTE LTDA (fbc1b728-5ee5-4b44-b3b3-a24cee5fa1d0)
--     7 processos · 6 lançamentos · 7 cobranças · 4 extratos
--   - THALES TESTE (c762e210-a5f9-4597-8bbc-3537b2aab15c)
--     3 processos · 3 lançamentos · 4 cobranças · 4 extratos
--
-- Total cleanup: 2 clientes + 10 processos + 9 lancamentos + 11 cobranças +
-- 8 extratos + valores_adicionais + documentos + orçamentos vinculados +
-- CASCADE auto (precos_por_tipo, prepago_mov, service_negotiations,
-- cobrancas_lancamentos, contratos, notificacoes, orcamento_pdfs,
-- proposta_eventos).
--
-- Ordem topológica (RESTRICT/NO ACTION FKs):
--   1. valores_adicionais (RESTRICT em processos)
--   2. documentos          (RESTRICT em processos)
--   3. cobrancas           (RESTRICT em clientes)
--   4. lancamentos         (NO ACTION em clientes)
--   5. extratos            (NO ACTION em clientes)
--   6. orcamentos          (NO ACTION em clientes — CASCADE filhos)
--   7. processos           (RESTRICT em clientes)
--   8. clientes            (CASCADE em 3 filhas)
--
-- Tudo em BEGIN/COMMIT — se qualquer DELETE falhar, rollback total.
-- IRREVERSÍVEL após COMMIT. Backup recomendado se houver dúvida.
-- =============================================

BEGIN;

-- IDs alvo (hard-coded pra evitar deletar cliente real com 'teste' no nome
-- adicionado depois)
WITH alvos AS (
  SELECT unnest(ARRAY[
    'fbc1b728-5ee5-4b44-b3b3-a24cee5fa1d0'::uuid,  -- CAROLINA GUIRADO TESTE LTDA
    'c762e210-a5f9-4597-8bbc-3537b2aab15c'::uuid   -- THALES TESTE
  ]) AS cliente_id
)
SELECT count(*) FROM alvos;  -- esperado: 2

-- 1. valores_adicionais (filha de processos — RESTRICT)
DELETE FROM public.valores_adicionais
WHERE processo_id IN (
  SELECT id FROM public.processos
  WHERE cliente_id IN (
    'fbc1b728-5ee5-4b44-b3b3-a24cee5fa1d0'::uuid,
    'c762e210-a5f9-4597-8bbc-3537b2aab15c'::uuid
  )
);

-- 2. documentos (filha de processos — RESTRICT)
DELETE FROM public.documentos
WHERE processo_id IN (
  SELECT id FROM public.processos
  WHERE cliente_id IN (
    'fbc1b728-5ee5-4b44-b3b3-a24cee5fa1d0'::uuid,
    'c762e210-a5f9-4597-8bbc-3537b2aab15c'::uuid
  )
);

-- 3. cobrancas (RESTRICT em clientes; CASCADE em cobrancas_lancamentos +
-- SET NULL em asaas_webhook_events)
DELETE FROM public.cobrancas
WHERE cliente_id IN (
  'fbc1b728-5ee5-4b44-b3b3-a24cee5fa1d0'::uuid,
  'c762e210-a5f9-4597-8bbc-3537b2aab15c'::uuid
);

-- 4. lancamentos (NO ACTION em clientes; CASCADE em cobrancas_lancamentos
-- já tratada acima; SET NULL em orcamentos.lancamento_id)
DELETE FROM public.lancamentos
WHERE cliente_id IN (
  'fbc1b728-5ee5-4b44-b3b3-a24cee5fa1d0'::uuid,
  'c762e210-a5f9-4597-8bbc-3537b2aab15c'::uuid
);

-- 5. extratos (NO ACTION em clientes; SET NULL em cobrancas.extrato_id já
-- tratada no passo 3)
DELETE FROM public.extratos
WHERE cliente_id IN (
  'fbc1b728-5ee5-4b44-b3b3-a24cee5fa1d0'::uuid,
  'c762e210-a5f9-4597-8bbc-3537b2aab15c'::uuid
);

-- 6. orcamentos (NO ACTION em clientes; CASCADE em contratos, notificacoes,
-- orcamento_pdfs, proposta_eventos)
DELETE FROM public.orcamentos
WHERE cliente_id IN (
  'fbc1b728-5ee5-4b44-b3b3-a24cee5fa1d0'::uuid,
  'c762e210-a5f9-4597-8bbc-3537b2aab15c'::uuid
);

-- 7. processos (RESTRICT em clientes)
DELETE FROM public.processos
WHERE cliente_id IN (
  'fbc1b728-5ee5-4b44-b3b3-a24cee5fa1d0'::uuid,
  'c762e210-a5f9-4597-8bbc-3537b2aab15c'::uuid
);

-- 8. clientes (CASCADE em cliente_precos_por_tipo, prepago_movimentacoes,
-- service_negotiations)
DELETE FROM public.clientes
WHERE id IN (
  'fbc1b728-5ee5-4b44-b3b3-a24cee5fa1d0'::uuid,
  'c762e210-a5f9-4597-8bbc-3537b2aab15c'::uuid
);

-- Confirma: deve voltar 0 rows
SELECT count(*) AS clientes_teste_restantes
FROM public.clientes
WHERE id IN (
  'fbc1b728-5ee5-4b44-b3b3-a24cee5fa1d0'::uuid,
  'c762e210-a5f9-4597-8bbc-3537b2aab15c'::uuid
);

COMMIT;
