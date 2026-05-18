-- =============================================
-- RLS cartoes/cartao_compras/cartao_faturas — apertar INSERT (18/05/2026)
-- =============================================
-- Agent 2 reportou PERM-008 ("RLS permissivo"). Estado REAL validado:
-- - SELECT/UPDATE já filtram por `empresa_id = get_empresa_id()` ✅
-- - DELETE já é master-only (CODE-009 da onda anterior) ✅
-- - INSERT NÃO TEM with_check — authed pode tentar INSERT com empresa_id
--   de outra empresa. Hoje não explode (1 empresa), mas é prep multi-tenant.
--
-- Fix: adicionar WITH CHECK (empresa_id = get_empresa_id()) nos 3 INSERTs.
-- =============================================

-- cartoes
DROP POLICY IF EXISTS cartoes_insert ON public.cartoes;
CREATE POLICY cartoes_insert ON public.cartoes
  FOR INSERT TO authenticated
  WITH CHECK (empresa_id = get_empresa_id());

-- cartao_compras
DROP POLICY IF EXISTS cartao_compras_insert ON public.cartao_compras;
CREATE POLICY cartao_compras_insert ON public.cartao_compras
  FOR INSERT TO authenticated
  WITH CHECK (empresa_id = get_empresa_id());

-- cartao_faturas
DROP POLICY IF EXISTS cartao_faturas_insert ON public.cartao_faturas;
CREATE POLICY cartao_faturas_insert ON public.cartao_faturas
  FOR INSERT TO authenticated
  WITH CHECK (empresa_id = get_empresa_id());

-- Confirma — INSERTs agora têm qual
SELECT tablename, policyname, cmd, with_check
FROM pg_policies
WHERE tablename IN ('cartoes', 'cartao_compras', 'cartao_faturas')
  AND schemaname = 'public'
  AND cmd = 'INSERT'
ORDER BY tablename;
