-- rls-delete-libera-operacional.sql
-- Reverte CODE-009 (master-only em 21+ tabelas) pra modelo permissivo
-- por tenant nas tabelas de fluxo operacional. Thales: "ela pode deletar
-- o que quiser, eu vou avisando".
--
-- Mantem master-only apenas em:
--   - logs de auditoria (entidade_audit, permissoes_audit, cron_execution_log)
--   - controle de usuarios/permissoes (profiles, user_permissions, role_templates)
--   - configuracao de integracao (webhook_configs, contatos_estado)
--   - notificacoes mantem a regra com OR (destinatario_id = auth.uid())

-- Pattern reutilizado: USING (empresa_id = get_empresa_id())
-- Significado: qualquer usuario authenticated da mesma empresa pode DELETE.

DO $$
DECLARE
  t text;
  tabelas text[] := ARRAY[
    'processos','orcamentos','lancamentos','extratos',
    'cobrancas','cobrancas_lancamentos',
    'clientes','documentos','valores_adicionais',
    'catalogo_servicos','catalogo_precos_uf','service_negotiations',
    'cartoes','cartao_compras','cartao_faturas',
    'colaboradores','colaborador_avaliacoes',
    'despesas_recorrentes','plano_contas','prepago_movimentacoes',
    'contratos','orcamento_pdfs'
  ];
BEGIN
  FOREACH t IN ARRAY tabelas LOOP
    -- DROP policy antiga (nome varia: foo_delete, foo_delete_role, etc)
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_delete', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_delete_role', t);
    -- CREATE nova policy permissiva por tenant
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR DELETE TO authenticated USING (empresa_id = public.get_empresa_id())',
      t || '_delete', t
    );
    RAISE NOTICE 'Liberada: %', t;
  END LOOP;
END $$;

-- cliente_precos_por_tipo usa cliente_pertence_empresa() — caso especial
DROP POLICY IF EXISTS cliente_precos_delete ON public.cliente_precos_por_tipo;
CREATE POLICY cliente_precos_delete ON public.cliente_precos_por_tipo
  FOR DELETE TO authenticated
  USING (public.cliente_pertence_empresa(cliente_id));

-- Verificacao final: lista as tabelas que continuam master-only (esperado)
SELECT c.relname AS tabela_ainda_master_only
FROM pg_policy pol
JOIN pg_class c ON c.oid = pol.polrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname='public' AND pol.polcmd='d'
  AND pg_get_expr(pol.polqual, pol.polrelid) ILIKE '%master%'
ORDER BY c.relname;
