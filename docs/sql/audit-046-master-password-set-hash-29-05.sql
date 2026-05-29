-- =============================================
-- AUDIT-046 (29/05/2026) — Remover MASTER_PASSWORD env fallback
-- =============================================
-- Estado atual: master_password_config tem 1 linha mas password_hash IS NULL.
-- Significa que sistema HOJE depende 100% do env MASTER_PASSWORD plaintext.
-- Não dá pra remover fallback sem antes migrar pra hash.
--
-- PASSO 1: Setar hash da senha atual (Thales executa via verify-master-password
--          edge function chamando RPC set_master_password_hash com a senha em
--          texto plano — UMA VEZ SÓ, manualmente).
--
-- PASSO 2: Confirmar que login funciona via hash (não pelo fallback).
--
-- PASSO 3: Remover fallback do código (verify-master-password-FULL.ts).
-- =============================================

-- Confirma existência da RPC (deveria estar em sec-038-039 ou similar)
SELECT proname, pronargs
FROM pg_proc
WHERE proname IN ('set_master_password_hash', 'verify_master_password_hash');

-- Após setar hash, verificar:
-- SELECT id, password_hash IS NOT NULL as tem_hash, updated_at, updated_by
-- FROM master_password_config;

-- ────────────────────────────────────────────────
-- PROCEDIMENTO PRO THALES:
-- ────────────────────────────────────────────────
-- 1. Vai em qualquer página do ERP que pede master password
--    (ex: deletar cliente arquivado, alterar saldo prepago)
-- 2. Quando aparecer prompt, abre DevTools Console (F12)
-- 3. Cola:
--
-- await fetch('https://aahhauquuicvtwtrxyan.supabase.co/functions/v1/verify-master-password', {
--   method: 'POST',
--   headers: { 'Authorization': 'Bearer ' + JSON.parse(localStorage.getItem(Object.keys(localStorage).find(k => k.endsWith('-auth-token')))).access_token,
--              'Content-Type': 'application/json' },
--   body: JSON.stringify({ password: 'COLE_AQUI_A_SENHA_ATUAL', set_hash: true })
-- }).then(r => r.json()).then(console.log);
--
-- (set_hash:true sinaliza pra edge function gravar hash em master_password_config)
--
-- NOTA: a edge function verify-master-password atual NÃO TEM esse modo set_hash:true.
-- Precisa ser adicionado num próximo deploy ANTES de remover o fallback.
-- ────────────────────────────────────────────────

-- ────────────────────────────────────────────────
-- ALTERNATIVA PRO THALES (mais simples e segura):
-- ────────────────────────────────────────────────
-- 1. Pega o hash bcrypt da senha atual via psql/SQL Editor:
--    SELECT crypt('SUA_SENHA_ATUAL', gen_salt('bf', 10));
-- 2. Cola o resultado em master_password_config:
--    UPDATE master_password_config SET password_hash = '$2a$10$...';
-- 3. Testa login normal — deve continuar funcionando via hash agora.
-- 4. Remove MASTER_PASSWORD do env Supabase.
-- 5. Testa de novo — se ainda funciona, fallback nunca foi necessário.

-- Exemplo (não rodar com a senha real aqui, é só ilustração):
-- INSERT INTO master_password_config (password_hash, updated_by)
-- VALUES (crypt('senha_atual_aqui', gen_salt('bf', 10)), auth.uid())
-- ON CONFLICT (id) DO UPDATE SET
--   password_hash = EXCLUDED.password_hash,
--   updated_at = NOW(),
--   updated_by = EXCLUDED.updated_by;
