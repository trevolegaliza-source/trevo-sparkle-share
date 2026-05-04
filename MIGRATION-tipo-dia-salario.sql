-- ===========================================================================
-- Migration: tipo_dia_salario na tabela colaboradores
-- Demanda Thales 04/05/2026: salário deve respeitar 5º DIA ÚTIL (CLT),
-- não dia 5 do calendário. Dois modos:
--   'calendario' = dia X do mês (legado, default seguro)
--   'util'       = N-ésimo dia útil (CLT, recomendado)
-- ===========================================================================

-- 1) Cria a coluna com default seguro (não quebra colaboradores existentes)
ALTER TABLE colaboradores
ADD COLUMN IF NOT EXISTS tipo_dia_salario text NOT NULL DEFAULT 'calendario'
CHECK (tipo_dia_salario IN ('calendario', 'util'));

COMMENT ON COLUMN colaboradores.tipo_dia_salario IS
  'Modo de cálculo do dia_salario: calendario (dia X do mês) ou util (N-ésimo dia útil — CLT)';

-- 2) (OPCIONAL — recomendado) Marcar todos os colaboradores ativos pra usar
--    "5º dia útil" automaticamente. Se você prefere converter um a um pelo
--    formulário, pula este UPDATE.
--    Atenção: rode SÓ DEPOIS de validar 1 colaborador via formulário.
--
-- UPDATE colaboradores
-- SET tipo_dia_salario = 'util'
-- WHERE status = 'ativo';

-- 3) Verificação
SELECT id, nome, dia_salario, tipo_dia_salario
FROM colaboradores
ORDER BY nome;
