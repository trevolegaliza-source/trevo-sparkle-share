-- =============================================
-- Feature "Aguardando algo" (17/05/2026 — pré-viagem)
-- =============================================
-- Estado intermediário entre "não conferi" e "auditado":
-- usuário conferiu mas viu que NÃO pode auditar agora (falta doc,
-- valor errado, cliente pediu desconto, etc).
--
-- 3 colunas novas em `lancamentos`:
--   - pendencia_motivo (text)         — texto do motivo (preset ou livre)
--   - pendencia_marcada_em (timestamptz) — quando marcou
--   - pendencia_marcada_por (uuid)    — quem marcou (auth.uid())
--
-- NULL = sem pendência (estado padrão).
-- Preenchido = lançamento sai da fila principal de auditoria, vai
-- pra sub-seção "Aguardando algo".
--
-- Idempotente: ADD COLUMN IF NOT EXISTS.
-- =============================================

ALTER TABLE public.lancamentos
  ADD COLUMN IF NOT EXISTS pendencia_motivo text,
  ADD COLUMN IF NOT EXISTS pendencia_marcada_em timestamptz,
  ADD COLUMN IF NOT EXISTS pendencia_marcada_por uuid;

COMMENT ON COLUMN public.lancamentos.pendencia_motivo IS
'Motivo pelo qual auditoria está pausada. NULL = sem pendência. Preenchido = sai da fila ativa, vai pra sub-seção "Aguardando algo".';

-- Índice parcial só pros com pendência (boa pra query "quantos pendentes")
CREATE INDEX IF NOT EXISTS idx_lancamentos_pendencia
  ON public.lancamentos (pendencia_marcada_em DESC)
  WHERE pendencia_motivo IS NOT NULL;

-- Confirma
SELECT
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'lancamentos'
  AND column_name LIKE 'pendencia%'
ORDER BY column_name;
