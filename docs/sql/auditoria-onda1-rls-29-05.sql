-- =============================================
-- AUDITORIA ONDA 1 — Fixes RLS críticos (29/05/2026)
-- =============================================
-- AUDIT-007: RLS desabilitada em cobrancas_auditoria
-- AUDIT-008: View processos_zombies sem security_invoker
-- AUDIT-009 / 040: 11 cobranças com lancamento_id órfão (investigação manual)
-- =============================================

-- ────────────────────────────────────────────────
-- AUDIT-007: Habilita RLS em cobrancas_auditoria
-- ────────────────────────────────────────────────
ALTER TABLE public.cobrancas_auditoria ENABLE ROW LEVEL SECURITY;

-- Policy SELECT: usuário só vê auditoria da sua empresa
DROP POLICY IF EXISTS cobrancas_auditoria_select_tenant ON public.cobrancas_auditoria;
CREATE POLICY cobrancas_auditoria_select_tenant
  ON public.cobrancas_auditoria
  FOR SELECT
  TO authenticated
  USING (
    empresa_id = (
      SELECT empresa_id FROM public.profiles
      WHERE id = auth.uid()
        AND ativo = true
    )
  );

-- INSERT/UPDATE/DELETE: bloqueado pra users (só service role escreve via trigger)
-- Service role bypassa RLS, então nenhuma policy adicional necessária.
-- Confirmar GRANTs:
GRANT SELECT ON public.cobrancas_auditoria TO authenticated;
GRANT ALL ON public.cobrancas_auditoria TO service_role;
GRANT ALL ON public.cobrancas_auditoria TO postgres;

-- ────────────────────────────────────────────────
-- AUDIT-008: View processos_zombies usa security_invoker
-- ────────────────────────────────────────────────
-- Sem isso, view bypassa RLS porque foi criada por superuser.
-- Com security_invoker=on, view roda com permissões do user que está acessando.
ALTER VIEW public.processos_zombies SET (security_invoker = on);

-- ────────────────────────────────────────────────
-- AUDIT-009 / AUDIT-040: Investigação 11 cobranças com lancamento_id órfão
-- ────────────────────────────────────────────────
-- Não aplica fix automático — exige decisão. Apenas LISTA pra você revisar.
-- Rode esta consulta separadamente, decida caso a caso.

-- Quais cobranças têm lancamento_ids inválidos?
-- SELECT
--   c.id, c.status, c.total_geral, c.data_vencimento,
--   c.created_at, c.cliente_id, cl.nome as cliente,
--   c.lancamento_ids,
--   (SELECT ARRAY_AGG(unnest_id)
--    FROM unnest(c.lancamento_ids) unnest_id
--    WHERE unnest_id NOT IN (SELECT id FROM lancamentos)
--   ) as ids_invalidos
-- FROM cobrancas c
-- LEFT JOIN clientes cl ON cl.id = c.cliente_id
-- WHERE EXISTS (
--   SELECT 1 FROM unnest(c.lancamento_ids) AS unnest_id
--   WHERE unnest_id NOT IN (SELECT id FROM lancamentos)
-- );

-- Opção 1 (mais conservadora): atualiza lancamento_ids removendo os órfãos
-- Opção 2: deleta cobranças canceladas/vencidas órfãs (perde histórico)
-- Opção 3: investiga 1 a 1 e decide
-- Recomendo Opção 1 — mantém histórico:
--
-- UPDATE cobrancas
-- SET lancamento_ids = ARRAY(
--   SELECT unnest_id FROM unnest(lancamento_ids) unnest_id
--   WHERE unnest_id IN (SELECT id FROM lancamentos)
-- )
-- WHERE EXISTS (
--   SELECT 1 FROM unnest(lancamento_ids) AS unnest_id
--   WHERE unnest_id NOT IN (SELECT id FROM lancamentos)
-- );

-- =============================================
-- DONE: 2 fixes aplicados (AUDIT-007, AUDIT-008)
-- 1 pendente de decisão manual (AUDIT-009)
-- =============================================
