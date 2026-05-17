-- =============================================
-- SEC-030 (17/05/2026): portfolio_share_token aleatório em vez de empresa_id
-- =============================================
-- Auditoria 17/05 mapeou: `/portfolio/:token` usa `empresa_id` direto como
-- "token" — qualquer pessoa que adivinhar (ou tiver tido) o UUID v4 da
-- empresa acessa o catálogo pra sempre. Embora UUID v4 tenha 122 bits de
-- entropia (inviável bruteforce), o problema conceitual permanece:
--   - Ex-funcionário com URL antiga acessa pra sempre
--   - Não há como revogar/rotacionar
--   - Mesmo "token" usado em outros lugares = leak transitivo
--
-- Fix: adicionar coluna `portfolio_share_token text UNIQUE` em
-- empresas_config com default `gen_random_bytes(24)` hex (48 chars).
-- Token é independente de empresa_id e pode ser rotacionado.
--
-- Backfill: gera token pra empresas existentes.
-- Idempotente: IF NOT EXISTS + COALESCE no UPDATE.
-- =============================================

-- PASSO 1: Adicionar coluna (idempotente)
ALTER TABLE public.empresas_config
  ADD COLUMN IF NOT EXISTS portfolio_share_token text
  DEFAULT encode(extensions.gen_random_bytes(24), 'hex');

-- PASSO 2: Backfill — preencher tokens em rows existentes (caso default não
-- tenha rodado por já existirem)
UPDATE public.empresas_config
SET portfolio_share_token = encode(extensions.gen_random_bytes(24), 'hex')
WHERE portfolio_share_token IS NULL;

-- PASSO 3: UNIQUE constraint (impede colisão acidental)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'empresas_config_portfolio_share_token_key'
  ) THEN
    ALTER TABLE public.empresas_config
      ADD CONSTRAINT empresas_config_portfolio_share_token_key
      UNIQUE (portfolio_share_token);
  END IF;
END $$;

-- PASSO 4: Confirma — lista tokens gerados (deve mostrar 1 ou N rows com
-- token de 48 chars, sem NULL)
SELECT empresa_id, razao_social,
  CASE WHEN portfolio_share_token IS NULL THEN 'NULL'
       ELSE substring(portfolio_share_token, 1, 8) || '... (' || length(portfolio_share_token) || ' chars)'
  END AS token_preview
FROM public.empresas_config;

-- =============================================
-- IMPORTANTE: rodar este SQL ANTES de fazer Publish do frontend.
-- Frontend novo busca portfolio_share_token; se coluna não existir
-- o link público não é gerado (toast.error).
-- Edge function `portfolio-publico` aceita tanto empresa_id quanto o
-- novo token durante migração (deploy depois pra fechar o vetor antigo).
-- =============================================
