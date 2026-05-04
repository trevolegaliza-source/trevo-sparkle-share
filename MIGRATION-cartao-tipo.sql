-- ===========================================================================
-- Migração: adiciona coluna `tipo` em cartao_compras
-- Demanda Thales 04/05/2026: distinguir À vista / Parcelado / Assinatura
--   - avista: 1 row, valor cheio (parcelas_total=1)
--   - parcelado: N rows, valor_total dividido em N (TV em 6x)
--   - assinatura: N rows, valor cheio em CADA fatura (SaaS R$ 99,99/mês × 12)
-- IDEMPOTENTE: pode rodar várias vezes sem efeito colateral.
-- ===========================================================================

-- Adiciona coluna com default 'avista' pra rows existentes.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cartao_compras' AND column_name = 'tipo'
  ) THEN
    ALTER TABLE cartao_compras
      ADD COLUMN tipo TEXT NOT NULL DEFAULT 'avista'
      CHECK (tipo IN ('avista', 'parcelado', 'assinatura'));
  END IF;
END $$;

-- Backfill rows pré-existentes (caso já houvesse compras antes desta migration):
--   parcelas_total = 1                                   → 'avista'
--   parcelas_total > 1 e valor_parcela ≈ valor_total     → 'assinatura' (cada fatura paga o cheio)
--   parcelas_total > 1 e valor_parcela ≠ valor_total     → 'parcelado'
UPDATE cartao_compras
SET tipo = CASE
  WHEN parcelas_total = 1 THEN 'avista'
  WHEN ABS(valor_parcela - valor_total) < 0.01 THEN 'assinatura'
  ELSE 'parcelado'
END
WHERE tipo = 'avista' AND parcelas_total > 1;

-- Verificação
SELECT tipo, COUNT(*) AS qtd
FROM cartao_compras
GROUP BY tipo
ORDER BY tipo;
