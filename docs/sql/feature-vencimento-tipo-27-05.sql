-- ════════════════════════════════════════════════════════════════════════════
-- Feature 27/05/2026 — Tipo de vencimento na Proposta de Terceirização
-- ════════════════════════════════════════════════════════════════════════════
-- Bug auditoria: "Vencimento mensal dia X" aparecia mesmo em modalidade AVULSO,
-- onde o pagamento é POR PROCESSO (sem recorrência mensal).
--
-- Solução: campo explícito `terc_vencimento_tipo` com 3 valores:
--   - 'mensal_dia'   → fica mostrando "Vencimento mensal · dia X" (atual)
--   - 'deferimento'  → "Vencimento no deferimento do processo"
--   - 'outros'       → texto livre em `terc_vencimento_outros_texto`
--
-- terc_dia_pagamento (legado) continua válido SÓ quando tipo='mensal_dia'.
-- ════════════════════════════════════════════════════════════════════════════

BEGIN;

ALTER TABLE public.orcamentos
  ADD COLUMN IF NOT EXISTS terc_vencimento_tipo text
    CHECK (terc_vencimento_tipo IS NULL OR terc_vencimento_tipo IN ('mensal_dia','deferimento','outros')),
  ADD COLUMN IF NOT EXISTS terc_vencimento_outros_texto text;

COMMENT ON COLUMN public.orcamentos.terc_vencimento_tipo IS
  'Tipo de vencimento da proposta: mensal_dia | deferimento | outros. NULL = legado (interpreta como mensal_dia se terc_dia_pagamento preenchido).';

COMMENT ON COLUMN public.orcamentos.terc_vencimento_outros_texto IS
  'Texto livre exibido quando terc_vencimento_tipo=outros. Ex: "30 dias após emissão da NF".';

-- Backfill: propostas existentes com terc_dia_pagamento preenchido viram mensal_dia
UPDATE public.orcamentos
   SET terc_vencimento_tipo = 'mensal_dia'
 WHERE terc_dia_pagamento IS NOT NULL
   AND terc_vencimento_tipo IS NULL;

-- Verificação
SELECT
  terc_vencimento_tipo,
  COUNT(*) as total,
  COUNT(terc_dia_pagamento) as com_dia
FROM public.orcamentos
WHERE tipo_proposta = 'terceirizacao'
GROUP BY terc_vencimento_tipo
ORDER BY total DESC;

COMMIT;
