-- ════════════════════════════════════════════════════════════════════════════
-- rls-delete-user-permissions.sql
-- Frente 2 do backlog pós-viagem (25/05/2026).
--
-- Hoje: 22 policies DELETE tier-tenant usam apenas `empresa_id = get_empresa_id()`
-- — qualquer usuário ativo da empresa pode deletar. Permissão configurada na
-- UI de Gestão de Usuários (`user_permissions.pode_excluir`) é IGNORADA pelo
-- banco. Frontend respeita (botão fica disabled), mas curl direto via RLS
-- aceita. Desacoplamento problemático.
--
-- Esta migration:
--   1. Cria função `tem_permissao_excluir(modulo)` que replica a lógica do
--      hook `usePermissions.podeExcluir`: master sempre, senão olha user_permissions
--      (sem fallback pra template — frontend é conservador, replica aqui).
--   2. Atualiza policies DELETE das 22 tabelas operacionais pra exigir
--      `tem_permissao_excluir('<modulo>')` além do tenant match.
--
-- Tabelas master-only (9) NÃO são tocadas: profiles, user_permissions, role_templates,
-- entidade_audit, permissoes_audit, cron_execution_log, webhook_configs,
-- contatos_estado, notificacoes (parcial OR mantida).
--
-- Pré-flight checado em 25/05/2026:
--   - 2 usuários não-master ativos (Letícia, Michele) — ambos têm registros
--     em user_permissions. Não vai quebrar o operacional.
--   - Master continua deletando tudo (função retorna true direto).
--
-- ROLLBACK: ver bloco no fim do arquivo.
-- ════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────
-- 1. Função tem_permissao_excluir
-- ─────────────────────────────────────────────────────────────────────────
-- SECURITY DEFINER: lê profiles + user_permissions usando privilégios do
-- owner da função (postgres), sem disparar RLS recursivo.
-- STABLE: cacheable dentro de uma query — o auth.uid() não muda durante a
-- execução de um único statement, então o resultado é estável.
-- SET search_path: evita injeção via search_path mutável.

CREATE OR REPLACE FUNCTION public.tem_permissao_excluir(p_modulo text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH usr AS (
    SELECT id, role, ativo
      FROM public.profiles
     WHERE id = auth.uid()
     LIMIT 1
  )
  SELECT CASE
    -- Sem profile ou inativo: nega
    WHEN NOT EXISTS (SELECT 1 FROM usr WHERE ativo IS NOT FALSE) THEN false
    -- Master: sempre pode
    WHEN (SELECT role FROM usr) = 'master' THEN true
    -- Visualizador: nunca pode (replica regra do frontend)
    WHEN (SELECT role FROM usr) = 'visualizador' THEN false
    -- Demais roles: lê user_permissions. Conservador: sem registro = false.
    ELSE COALESCE(
      (SELECT pode_excluir
         FROM public.user_permissions
        WHERE user_id = (SELECT id FROM usr)
          AND modulo = p_modulo
        LIMIT 1),
      false
    )
  END;
$$;

COMMENT ON FUNCTION public.tem_permissao_excluir(text) IS
  'RLS DELETE check: replica usePermissions.podeExcluir do frontend. '
  'Master sempre true, visualizador sempre false, demais consultam user_permissions. '
  'Sem registro = false (conservador). Adicionado 25/05/2026 (Frente 2 pós-viagem).';

-- ─────────────────────────────────────────────────────────────────────────
-- 2. Recriar policies DELETE das 22 tabelas operacionais
-- ─────────────────────────────────────────────────────────────────────────
-- Mapeamento tabela → módulo definido pelo backlog:
--   processos                                                  → processos
--   clientes, contratos, documentos, cliente_precos_por_tipo   → clientes
--   orcamentos, orcamento_pdfs                                 → orcamentos
--   cobrancas, cobrancas_lancamentos, lancamentos,
--     valores_adicionais, extratos, plano_contas,
--     prepago_movimentacoes                                    → financeiro
--   cartoes, cartao_compras, cartao_faturas                    → cartao
--   colaboradores, colaborador_avaliacoes                      → colaboradores
--   despesas_recorrentes                                       → contas_pagar
--   catalogo_servicos, catalogo_precos_uf,
--     service_negotiations                                     → catalogo

-- ── processos
DROP POLICY IF EXISTS processos_delete ON public.processos;
CREATE POLICY processos_delete ON public.processos FOR DELETE
  USING (empresa_id = get_empresa_id() AND tem_permissao_excluir('processos'));

-- ── clientes (módulo "clientes")
DROP POLICY IF EXISTS clientes_delete ON public.clientes;
CREATE POLICY clientes_delete ON public.clientes FOR DELETE
  USING (empresa_id = get_empresa_id() AND tem_permissao_excluir('clientes'));

DROP POLICY IF EXISTS contratos_delete ON public.contratos;
CREATE POLICY contratos_delete ON public.contratos FOR DELETE
  USING (empresa_id = get_empresa_id() AND tem_permissao_excluir('clientes'));

DROP POLICY IF EXISTS documentos_delete ON public.documentos;
CREATE POLICY documentos_delete ON public.documentos FOR DELETE
  USING (empresa_id = get_empresa_id() AND tem_permissao_excluir('clientes'));

DROP POLICY IF EXISTS cliente_precos_delete ON public.cliente_precos_por_tipo;
CREATE POLICY cliente_precos_delete ON public.cliente_precos_por_tipo FOR DELETE
  USING (cliente_pertence_empresa(cliente_id) AND tem_permissao_excluir('clientes'));

-- ── orcamentos
DROP POLICY IF EXISTS orcamentos_delete ON public.orcamentos;
CREATE POLICY orcamentos_delete ON public.orcamentos FOR DELETE
  USING (empresa_id = get_empresa_id() AND tem_permissao_excluir('orcamentos'));

DROP POLICY IF EXISTS orcamento_pdfs_delete ON public.orcamento_pdfs;
CREATE POLICY orcamento_pdfs_delete ON public.orcamento_pdfs FOR DELETE
  USING (empresa_id = get_empresa_id() AND tem_permissao_excluir('orcamentos'));

-- ── financeiro (cobrancas, lancamentos, extratos, etc)
DROP POLICY IF EXISTS cobrancas_delete ON public.cobrancas;
CREATE POLICY cobrancas_delete ON public.cobrancas FOR DELETE
  USING (empresa_id = get_empresa_id() AND tem_permissao_excluir('financeiro'));

DROP POLICY IF EXISTS cobrancas_lancamentos_delete ON public.cobrancas_lancamentos;
CREATE POLICY cobrancas_lancamentos_delete ON public.cobrancas_lancamentos FOR DELETE
  USING (empresa_id = get_empresa_id() AND tem_permissao_excluir('financeiro'));

DROP POLICY IF EXISTS lancamentos_delete ON public.lancamentos;
CREATE POLICY lancamentos_delete ON public.lancamentos FOR DELETE
  USING (empresa_id = get_empresa_id() AND tem_permissao_excluir('financeiro'));

DROP POLICY IF EXISTS valores_adicionais_delete ON public.valores_adicionais;
CREATE POLICY valores_adicionais_delete ON public.valores_adicionais FOR DELETE
  USING (empresa_id = get_empresa_id() AND tem_permissao_excluir('financeiro'));

DROP POLICY IF EXISTS extratos_delete ON public.extratos;
CREATE POLICY extratos_delete ON public.extratos FOR DELETE
  USING (empresa_id = get_empresa_id() AND tem_permissao_excluir('financeiro'));

DROP POLICY IF EXISTS plano_contas_delete ON public.plano_contas;
CREATE POLICY plano_contas_delete ON public.plano_contas FOR DELETE
  USING (empresa_id = get_empresa_id() AND tem_permissao_excluir('financeiro'));

DROP POLICY IF EXISTS prepago_movimentacoes_delete ON public.prepago_movimentacoes;
CREATE POLICY prepago_movimentacoes_delete ON public.prepago_movimentacoes FOR DELETE
  USING (empresa_id = get_empresa_id() AND tem_permissao_excluir('financeiro'));

-- ── cartao
DROP POLICY IF EXISTS cartoes_delete ON public.cartoes;
CREATE POLICY cartoes_delete ON public.cartoes FOR DELETE
  USING (empresa_id = get_empresa_id() AND tem_permissao_excluir('cartao'));

DROP POLICY IF EXISTS cartao_compras_delete ON public.cartao_compras;
CREATE POLICY cartao_compras_delete ON public.cartao_compras FOR DELETE
  USING (empresa_id = get_empresa_id() AND tem_permissao_excluir('cartao'));

DROP POLICY IF EXISTS cartao_faturas_delete ON public.cartao_faturas;
CREATE POLICY cartao_faturas_delete ON public.cartao_faturas FOR DELETE
  USING (empresa_id = get_empresa_id() AND tem_permissao_excluir('cartao'));

-- ── colaboradores
DROP POLICY IF EXISTS colaboradores_delete ON public.colaboradores;
CREATE POLICY colaboradores_delete ON public.colaboradores FOR DELETE
  USING (empresa_id = get_empresa_id() AND tem_permissao_excluir('colaboradores'));

DROP POLICY IF EXISTS colaborador_avaliacoes_delete ON public.colaborador_avaliacoes;
CREATE POLICY colaborador_avaliacoes_delete ON public.colaborador_avaliacoes FOR DELETE
  USING (empresa_id = get_empresa_id() AND tem_permissao_excluir('colaboradores'));

-- ── contas_pagar
DROP POLICY IF EXISTS despesas_recorrentes_delete ON public.despesas_recorrentes;
CREATE POLICY despesas_recorrentes_delete ON public.despesas_recorrentes FOR DELETE
  USING (empresa_id = get_empresa_id() AND tem_permissao_excluir('contas_pagar'));

-- ── catalogo
DROP POLICY IF EXISTS catalogo_servicos_delete ON public.catalogo_servicos;
CREATE POLICY catalogo_servicos_delete ON public.catalogo_servicos FOR DELETE
  USING (empresa_id = get_empresa_id() AND tem_permissao_excluir('catalogo'));

DROP POLICY IF EXISTS catalogo_precos_uf_delete ON public.catalogo_precos_uf;
CREATE POLICY catalogo_precos_uf_delete ON public.catalogo_precos_uf FOR DELETE
  USING (empresa_id = get_empresa_id() AND tem_permissao_excluir('catalogo'));

DROP POLICY IF EXISTS service_negotiations_delete ON public.service_negotiations;
CREATE POLICY service_negotiations_delete ON public.service_negotiations FOR DELETE
  USING (empresa_id = get_empresa_id() AND tem_permissao_excluir('catalogo'));

-- ─────────────────────────────────────────────────────────────────────────
-- 3. Verificação
-- ─────────────────────────────────────────────────────────────────────────
-- Conta policies atualizadas (22 esperadas):
SELECT COUNT(*) AS policies_atualizadas
  FROM pg_policies
 WHERE schemaname = 'public'
   AND cmd = 'DELETE'
   AND qual::text ILIKE '%tem_permissao_excluir%';

-- Sanity check: as 9 master-only NÃO devem aparecer no resultado acima:
SELECT tablename, policyname
  FROM pg_policies
 WHERE schemaname = 'public'
   AND cmd = 'DELETE'
   AND qual::text ILIKE '%master%'
 ORDER BY tablename;

COMMIT;

-- ════════════════════════════════════════════════════════════════════════════
-- ROLLBACK (em caso de problema; rodar manualmente)
-- ════════════════════════════════════════════════════════════════════════════
-- BEGIN;
-- -- Restaura policies originais (somente empresa_id check):
-- DROP POLICY IF EXISTS processos_delete ON public.processos;
-- CREATE POLICY processos_delete ON public.processos FOR DELETE
--   USING (empresa_id = get_empresa_id());
-- -- ... repete pra cada tabela das 22, removendo o `AND tem_permissao_excluir(...)`
-- DROP FUNCTION IF EXISTS public.tem_permissao_excluir(text);
-- COMMIT;
