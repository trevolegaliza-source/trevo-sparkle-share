-- =============================================
-- CODE-009 + SEC-EXTRA (17/05/2026): RLS DELETE restritivo (master-only)
-- =============================================
-- Auditoria 17/05/2026 mapeou: botão "Deletar Cliente" no front é escondido
-- por `{permIsMaster && ...}`. Vetor de ataque: operacional/visualizador
-- abre DevTools e roda `supabase.from('clientes').delete().eq('id', X)`.
-- Se o cliente não tem FK (sem lancamentos/processos), DELETE passa.
--
-- Investigando, achado é mais amplo: 17 tabelas têm `cmd=DELETE` permissiva
-- pra `authenticated` filtrando SÓ por tenant (`empresa_id = get_empresa_id()`).
-- Qualquer role da empresa (incluindo `operacional`/`visualizador`) pode DELETE
-- via API direta — frontend só esconde botões.
--
-- Fix: trocar 17 policies pra exigir `get_user_role() = 'master'`. Mantém
-- tenant check. Demais roles continuam fazendo SELECT/INSERT/UPDATE conforme
-- as policies existentes.
--
-- Caso especial: `notificacoes` — qualquer user pode dismissar a própria
-- notificação. Mantém abertura, só restringe DELETE de outros.
--
-- Quem mexe em dados de verdade hoje (Letícia gerente, secretária operacional)
-- usa fluxos RPC (`arquivar_cliente`, `marcar_pago`, etc) — DELETE direto não
-- estava no fluxo nominal. Apertar isso fecha o vetor sem quebrar UX.
--
-- COMO RODAR:
--   1) Roda o PASSO 1 (audit) — mostra estado atual antes do change
--   2) Roda o PASSO 2 (drop + recreate em bloco DO)
--   3) Roda o PASSO 3 (verifica que sobrou só master nas policies)
-- =============================================

-- PASSO 1: Audit — estado antes
SELECT tablename, policyname, qual
FROM pg_policies
WHERE schemaname = 'public'
  AND cmd = 'DELETE'
  AND 'authenticated' = ANY(roles)
ORDER BY tablename;

-- PASSO 2: Apertar 16 tabelas pra master only + 1 caso especial (notificacoes)
DO $$
DECLARE
  v_tabela text;
  v_tabelas_master_only text[] := ARRAY[
    'catalogo_precos_uf',
    'catalogo_servicos',
    'clientes',
    'colaborador_avaliacoes',
    'contratos',
    'despesas_recorrentes',
    'documentos',
    'extratos',
    'orcamento_pdfs',
    'orcamentos',
    'plano_contas',
    'prepago_movimentacoes',
    'processos',
    'service_negotiations',
    'valores_adicionais',
    'webhook_configs'
  ];
BEGIN
  -- 16 tabelas: DELETE só master
  FOREACH v_tabela IN ARRAY v_tabelas_master_only LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I_delete ON public.%I', v_tabela, v_tabela);
    EXECUTE format(
      'CREATE POLICY %I_delete ON public.%I FOR DELETE TO authenticated USING (empresa_id = get_empresa_id() AND get_user_role() = ''master'')',
      v_tabela, v_tabela
    );
  END LOOP;

  -- Caso especial: notificacoes — user pode deletar a propria notif
  DROP POLICY IF EXISTS notificacoes_delete ON public.notificacoes;
  CREATE POLICY notificacoes_delete ON public.notificacoes FOR DELETE TO authenticated
    USING (
      empresa_id = get_empresa_id()
      AND (destinatario_id = auth.uid() OR get_user_role() = 'master')
    );
END $$;

-- PASSO 3: Confirma — 16 tabelas devem mostrar role check; notificacoes mostra OR
SELECT tablename, qual
FROM pg_policies
WHERE schemaname = 'public'
  AND cmd = 'DELETE'
  AND 'authenticated' = ANY(roles)
  AND policyname LIKE '%_delete'
ORDER BY tablename;
