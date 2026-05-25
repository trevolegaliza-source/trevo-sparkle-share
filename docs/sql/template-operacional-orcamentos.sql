-- template-operacional-orcamentos.sql
-- Bug reportado por Thales 25/05/2026 (volta da viagem): Letícia e Michele
-- não conseguiram fazer NENHUM orçamento durante a semana — dava "Acesso Restrito".
--
-- Investigação: perms individuais delas em user_permissions estão certas
-- (pode_ver=true pra orcamentos). MAS o template do role 'operacional' NÃO
-- inclui 'orcamentos'. Há race condition no hook usePermissions: se perms
-- ainda não carregou quando RequirePermission monta, cai no fallback de
-- templateModulos.includes() — pro operacional, isso é FALSE.
--
-- Fix imediato: adicionar 'orcamentos' ao template do operacional. Assim
-- mesmo no fallback de loading, operacional tem acesso (consistente com
-- perms individuais que ja configurei).

UPDATE public.role_templates
   SET modulos_padrao = array_append(modulos_padrao, 'orcamentos')
 WHERE role = 'operacional'
   AND NOT ('orcamentos' = ANY(modulos_padrao));

-- Verificação
SELECT role, modulos_padrao FROM public.role_templates WHERE role = 'operacional';
