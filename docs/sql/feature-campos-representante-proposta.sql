-- ════════════════════════════════════════════════════════════════════════════
-- Feature 26/05/2026 noite — Campos do Representante na Proposta Comercial
-- ════════════════════════════════════════════════════════════════════════════
-- Contexto: o template MSA (Master Service Agreement no Google Docs) tem 7
-- placeholders que hoje saem em branco no PDF gerado, porque o banco não tem
-- esses campos. Esta migration adiciona as colunas e permite preenchimento
-- opcional na UI da Proposta Comercial Nova.
--
-- Placeholders MSA → colunas:
--   {{ENDERECO_EMPRESA}} → prospect_endereco
--   {{REP_RG}}           → prospect_rep_rg
--   {{REP_CPF}}          → prospect_rep_cpf
--   {{REP_NAC}}          → prospect_rep_nacionalidade (default "Brasileira")
--   {{REP_EST_CIVIL}}    → prospect_rep_estado_civil
--   {{REP_PROF}}         → prospect_rep_profissao
--   {{REP_END}}          → prospect_rep_endereco
--   {{REP_NOME}}         → prospect_contato (JÁ EXISTE)
--
-- Todos NULLABLE. Quando NULL, edge function preenche com "________________"
-- (linha tracejada pro cliente preencher manualmente).
-- ════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ──────────────────────────────────────────────────────────────────────
-- 1. Adicionar colunas
-- ──────────────────────────────────────────────────────────────────────
ALTER TABLE public.orcamentos
  ADD COLUMN IF NOT EXISTS prospect_endereco            text,
  ADD COLUMN IF NOT EXISTS prospect_rep_rg              text,
  ADD COLUMN IF NOT EXISTS prospect_rep_cpf             text,
  ADD COLUMN IF NOT EXISTS prospect_rep_nacionalidade   text DEFAULT 'Brasileira',
  ADD COLUMN IF NOT EXISTS prospect_rep_estado_civil    text,
  ADD COLUMN IF NOT EXISTS prospect_rep_profissao       text,
  ADD COLUMN IF NOT EXISTS prospect_rep_endereco        text;

-- ──────────────────────────────────────────────────────────────────────
-- 2. Comentários (autodocumentação)
-- ──────────────────────────────────────────────────────────────────────
COMMENT ON COLUMN public.orcamentos.prospect_endereco          IS 'Endereço completo da empresa contratante (usado no MSA placeholder {{ENDERECO_EMPRESA}})';
COMMENT ON COLUMN public.orcamentos.prospect_rep_rg            IS 'RG do representante legal — MSA {{REP_RG}}';
COMMENT ON COLUMN public.orcamentos.prospect_rep_cpf           IS 'CPF do representante legal — MSA {{REP_CPF}}';
COMMENT ON COLUMN public.orcamentos.prospect_rep_nacionalidade IS 'Nacionalidade do representante — MSA {{REP_NAC}}. Default: Brasileira';
COMMENT ON COLUMN public.orcamentos.prospect_rep_estado_civil  IS 'Estado civil do representante — MSA {{REP_EST_CIVIL}}';
COMMENT ON COLUMN public.orcamentos.prospect_rep_profissao     IS 'Profissão do representante — MSA {{REP_PROF}}';
COMMENT ON COLUMN public.orcamentos.prospect_rep_endereco      IS 'Endereço residencial do representante — MSA {{REP_END}}';

-- ──────────────────────────────────────────────────────────────────────
-- 3. Verificação
-- ──────────────────────────────────────────────────────────────────────
SELECT column_name, data_type, column_default, is_nullable
  FROM information_schema.columns
 WHERE table_name = 'orcamentos'
   AND (column_name LIKE 'prospect_endereco' OR column_name LIKE 'prospect_rep_%')
 ORDER BY column_name;

COMMIT;
