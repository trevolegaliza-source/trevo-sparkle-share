-- =============================================
-- Atualizar role_templates pra incluir 'cartao' e 'mrr' (18/05/2026)
-- =============================================
-- Auditoria empírica de /configuracoes mapeou:
-- - Rota /cartao usava modulo='contas_pagar' (acesso a cartões obrigava
--   dar acesso a folha de pagamento). AGORA tem módulo 'cartao' próprio.
-- - Rota /mrr usava modulo='financeiro'. AGORA tem módulo 'mrr' próprio.
--
-- Pra usuários atuais com role gerente/financeiro NÃO PERDEREM acesso
-- a cartões/MRR ao deployar o novo front, atualiza os templates:
-- - master: ganha 'cartao' + 'mrr' (tinha tudo de financeiro)
-- - gerente: ganha 'cartao' + 'mrr' (Letícia continua vendo o que via)
-- - financeiro: ganha 'cartao' + 'mrr'
-- - operacional: NÃO ganha (não tinha contas_pagar nem financeiro antes)
-- - visualizador: NÃO ganha (só processos/clientes)
-- =============================================

-- Master
UPDATE public.role_templates
SET modulos_padrao = array(SELECT DISTINCT unnest(modulos_padrao || ARRAY['cartao', 'mrr']))
WHERE role = 'master';

-- Gerente
UPDATE public.role_templates
SET modulos_padrao = array(SELECT DISTINCT unnest(modulos_padrao || ARRAY['cartao', 'mrr']))
WHERE role = 'gerente';

-- Financeiro
UPDATE public.role_templates
SET modulos_padrao = array(SELECT DISTINCT unnest(modulos_padrao || ARRAY['cartao', 'mrr']))
WHERE role = 'financeiro';

-- IMPORTANTE: atualizar CHECK constraint em user_permissions.modulo
-- pra aceitar 'cartao' e 'mrr' como valores válidos. Sem isso, INSERT
-- granular via UI dá violation.
ALTER TABLE public.user_permissions
  DROP CONSTRAINT IF EXISTS user_permissions_modulo_check;

ALTER TABLE public.user_permissions
  ADD CONSTRAINT user_permissions_modulo_check
  CHECK (modulo = ANY (ARRAY[
    'dashboard', 'cadastro_rapido', 'processos', 'clientes',
    'orcamentos', 'catalogo',
    'financeiro', 'contas_pagar', 'cartao', 'mrr',
    'relatorios_dre', 'fluxo_caixa',
    'colaboradores', 'documentos', 'intel_geografica',
    'configuracoes'
  ]));

-- Confirma — deve mostrar cartao + mrr em master/gerente/financeiro
SELECT role, modulos_padrao
FROM public.role_templates
ORDER BY ordem;
