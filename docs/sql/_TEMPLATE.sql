-- =============================================
-- AUDIT-029 (29/05/2026) — Template para novos SQLs
-- =============================================
-- Padrão pra evitar inconsistência quando algo falha no meio.
-- Use sempre que mexer em mais de 1 artefato (CREATE FUNCTION + GRANT +
-- INSERT, ALTER TABLE + UPDATE, etc).
--
-- COMO USAR:
-- 1. Copie esse template
-- 2. Renomeie pra feature-X-YY-MM.sql ou fix-X-YY-MM.sql
-- 3. Preencha header + corpo
-- 4. Antes de rodar em prod, sempre teste em staging primeiro (ou
--    rode com BEGIN; ... ROLLBACK; pra ver resultado sem comitar)
-- =============================================

-- ────────────────────────────────────────────────
-- HEADER (obrigatório)
-- ────────────────────────────────────────────────
-- Data: DD/MM/YYYY
-- Autor: (nome ou claude)
-- Issue/Achado: AUDIT-XXX, FIN-YYY, ZZ-NNN
-- Objetivo (1 frase):
-- Risco (alto/médio/baixo):
-- Rollback strategy: ROLLBACK automático em caso de erro dentro da transação.
--                    Se commit feito e precisar reverter, criar SQL inverso.
-- ────────────────────────────────────────────────

BEGIN;

-- ────────────────────────────────────────────────
-- Validações pré (opcional mas recomendado)
-- ────────────────────────────────────────────────
-- Exemplo: garantir que não vai sobrescrever dados existentes
-- DO $$
-- BEGIN
--   IF EXISTS (SELECT 1 FROM ... WHERE ...) THEN
--     RAISE EXCEPTION 'Pré-condição falhou: ...';
--   END IF;
-- END $$;

-- ────────────────────────────────────────────────
-- ALTERAÇÕES
-- ────────────────────────────────────────────────

-- Seu código aqui:
-- ALTER TABLE ...
-- CREATE FUNCTION ...
-- INSERT INTO ...
-- UPDATE ...

-- ────────────────────────────────────────────────
-- Validações pós (opcional)
-- ────────────────────────────────────────────────
-- Exemplo: confirmar que o INSERT/UPDATE afetou o número esperado de linhas
-- DO $$
-- DECLARE v_count int;
-- BEGIN
--   SELECT count(*) INTO v_count FROM ... WHERE ...;
--   IF v_count != EXPECTED THEN
--     RAISE EXCEPTION 'Validação pós falhou: esperado X, encontrou %', v_count;
--   END IF;
-- END $$;

-- ────────────────────────────────────────────────
-- COMMIT ou ROLLBACK
-- ────────────────────────────────────────────────
-- DESCOMENTE COMMIT quando estiver confiante. Pra testar:
-- 1. Rode SELECT/verificações finais ANTES do commit pra inspecionar
-- 2. Se OK: substitua ROLLBACK por COMMIT
-- 3. Se não: rode ROLLBACK e ajuste

ROLLBACK;  -- ← muda pra COMMIT quando confiante
-- COMMIT;

-- =============================================
-- DONE
-- =============================================
