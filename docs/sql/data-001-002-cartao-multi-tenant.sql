-- =============================================
-- DATA-001 + DATA-002 (13/05/2026): cartoes multi-tenant + indices FK
-- =============================================
-- ATENCAO: contem fix critico. Rodar com prioridade alta no SQL Editor.
--
-- PERM-008 estava em backlog ha tempo — RLS de cartoes/cartao_compras/
-- cartao_faturas com `qual='true'` (libera tudo pra qualquer authenticated).
-- Hoje com 1 empresa o risco é zero, mas se entrar uma 2ª empresa, vazamento
-- total de dados financeiros sobre cartões.
--
-- Investigação via MCP read-only (13/05):
--   - 1 cartão com empresa_id NULL (de 1 total)
--   - 49 compras com empresa_id NULL (de 49 total)
--   - 0 faturas
--   - Única empresa master: 2fa6a9bc-86f9-4831-9e76-c1fcd03f966d
--
-- Plano:
--   1. BACKFILL: preencher empresa_id NULL com a empresa master única
--   2. DEFAULT: adicionar default `get_empresa_id()` pra novos INSERTs
--   3. RLS: trocar policies `qual='true'` por tenant-aware
--   4. ÍNDICES: criar idx em FK cartao_id (DATA-001)
-- =============================================

-- ╔══════════════════════════════════════════════════════════════╗
-- ║ PARTE 1 — BACKFILL empresa_id NULL                            ║
-- ╚══════════════════════════════════════════════════════════════╝

-- Backfill com a única empresa existente. Se um dia entrar 2ª empresa
-- ANTES de rodar este SQL, esse UPDATE seria incorreto — mas hoje só
-- existe uma master.
UPDATE public.cartoes
   SET empresa_id = (SELECT empresa_id FROM public.profiles WHERE role = 'master' LIMIT 1)
 WHERE empresa_id IS NULL;

UPDATE public.cartao_compras
   SET empresa_id = (SELECT empresa_id FROM public.profiles WHERE role = 'master' LIMIT 1)
 WHERE empresa_id IS NULL;

UPDATE public.cartao_faturas
   SET empresa_id = (SELECT empresa_id FROM public.profiles WHERE role = 'master' LIMIT 1)
 WHERE empresa_id IS NULL;

-- ╔══════════════════════════════════════════════════════════════╗
-- ║ PARTE 2 — empresa_id NOT NULL + DEFAULT                       ║
-- ╚══════════════════════════════════════════════════════════════╝

ALTER TABLE public.cartoes
  ALTER COLUMN empresa_id SET NOT NULL,
  ALTER COLUMN empresa_id SET DEFAULT public.get_empresa_id();

ALTER TABLE public.cartao_compras
  ALTER COLUMN empresa_id SET NOT NULL,
  ALTER COLUMN empresa_id SET DEFAULT public.get_empresa_id();

ALTER TABLE public.cartao_faturas
  ALTER COLUMN empresa_id SET NOT NULL,
  ALTER COLUMN empresa_id SET DEFAULT public.get_empresa_id();

-- ╔══════════════════════════════════════════════════════════════╗
-- ║ PARTE 3 — RLS policies multi-tenant (substitui qual='true')   ║
-- ╚══════════════════════════════════════════════════════════════╝

-- cartoes
DROP POLICY IF EXISTS cartoes_authenticated_all ON public.cartoes;
CREATE POLICY cartoes_select ON public.cartoes
  FOR SELECT USING (empresa_id = public.get_empresa_id());
CREATE POLICY cartoes_insert ON public.cartoes
  FOR INSERT WITH CHECK (empresa_id = public.get_empresa_id());
CREATE POLICY cartoes_update ON public.cartoes
  FOR UPDATE USING (empresa_id = public.get_empresa_id())
  WITH CHECK (empresa_id = public.get_empresa_id());
CREATE POLICY cartoes_delete ON public.cartoes
  FOR DELETE USING (empresa_id = public.get_empresa_id() AND public.get_user_role() = 'master');

-- cartao_compras
DROP POLICY IF EXISTS cartao_compras_authenticated_all ON public.cartao_compras;
CREATE POLICY cartao_compras_select ON public.cartao_compras
  FOR SELECT USING (empresa_id = public.get_empresa_id());
CREATE POLICY cartao_compras_insert ON public.cartao_compras
  FOR INSERT WITH CHECK (empresa_id = public.get_empresa_id());
CREATE POLICY cartao_compras_update ON public.cartao_compras
  FOR UPDATE USING (empresa_id = public.get_empresa_id())
  WITH CHECK (empresa_id = public.get_empresa_id());
CREATE POLICY cartao_compras_delete ON public.cartao_compras
  FOR DELETE USING (empresa_id = public.get_empresa_id() AND public.get_user_role() = 'master');

-- cartao_faturas
DROP POLICY IF EXISTS cartao_faturas_authenticated_all ON public.cartao_faturas;
CREATE POLICY cartao_faturas_select ON public.cartao_faturas
  FOR SELECT USING (empresa_id = public.get_empresa_id());
CREATE POLICY cartao_faturas_insert ON public.cartao_faturas
  FOR INSERT WITH CHECK (empresa_id = public.get_empresa_id());
CREATE POLICY cartao_faturas_update ON public.cartao_faturas
  FOR UPDATE USING (empresa_id = public.get_empresa_id())
  WITH CHECK (empresa_id = public.get_empresa_id());
CREATE POLICY cartao_faturas_delete ON public.cartao_faturas
  FOR DELETE USING (empresa_id = public.get_empresa_id() AND public.get_user_role() = 'master');

-- ╔══════════════════════════════════════════════════════════════╗
-- ║ PARTE 4 — Índices em FK cartao_id (DATA-001)                  ║
-- ╚══════════════════════════════════════════════════════════════╝

CREATE INDEX IF NOT EXISTS idx_cartao_compras_cartao_id
  ON public.cartao_compras(cartao_id);

CREATE INDEX IF NOT EXISTS idx_cartao_faturas_cartao_id
  ON public.cartao_faturas(cartao_id);

CREATE INDEX IF NOT EXISTS idx_cartao_compras_fatura_id
  ON public.cartao_compras(cartao_fatura_id) WHERE cartao_fatura_id IS NOT NULL;

-- ╔══════════════════════════════════════════════════════════════╗
-- ║ Validação pós-rodada                                          ║
-- ╚══════════════════════════════════════════════════════════════╝
-- Esperado: nenhum registro com empresa_id NULL, todas as 3 policies
-- novas no lugar das antigas:
--
-- SELECT 'cartoes' as tbl, count(*) FROM public.cartoes WHERE empresa_id IS NULL
--  UNION ALL SELECT 'compras', count(*) FROM public.cartao_compras WHERE empresa_id IS NULL
--  UNION ALL SELECT 'faturas', count(*) FROM public.cartao_faturas WHERE empresa_id IS NULL;
-- (esperado 0, 0, 0)
