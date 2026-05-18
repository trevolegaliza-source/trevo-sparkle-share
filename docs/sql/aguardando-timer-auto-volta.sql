-- =============================================
-- Aguardando — Timer com auto-volta (17/05/2026 noite)
-- =============================================
-- Complementa a feature "Aguardando algo" — quando user marca pendência,
-- pode definir prazo. Quando bater o prazo, lançamento volta sozinho
-- pra fila ativa de auditoria.
--
-- Coluna nova:
--   - pendencia_expira_em (timestamptz, NULL = sem prazo / fica até resolver manual)
--
-- Filtro de "volta automático" é client-side (compara expira_em < NOW()).
-- Front considera lançamentos expirados como sem pendência → aparecem na
-- fila ativa de novo.
--
-- Bônus: limpeza formal via SQL cleanup (rodar 1x se quiser remover motivo
-- de pendências expiradas há mais de 7 dias). Comentado por padrão.
-- =============================================

ALTER TABLE public.lancamentos
  ADD COLUMN IF NOT EXISTS pendencia_expira_em timestamptz;

COMMENT ON COLUMN public.lancamentos.pendencia_expira_em IS
'Quando a pendência expira. NULL = sem prazo (fica até resolver manual). Quando < NOW(), o front considera como sem pendência (volta pra fila ativa).';

-- Índice parcial pros que têm timer (otimiza filtro futuro)
CREATE INDEX IF NOT EXISTS idx_lancamentos_pendencia_expira
  ON public.lancamentos (pendencia_expira_em)
  WHERE pendencia_motivo IS NOT NULL AND pendencia_expira_em IS NOT NULL;

-- Cleanup opcional (descomentar pra rodar): limpa pendências expiradas há >7d
-- UPDATE public.lancamentos
-- SET pendencia_motivo = NULL,
--     pendencia_marcada_em = NULL,
--     pendencia_marcada_por = NULL,
--     pendencia_expira_em = NULL
-- WHERE pendencia_motivo IS NOT NULL
--   AND pendencia_expira_em IS NOT NULL
--   AND pendencia_expira_em < NOW() - INTERVAL '7 days';

-- Confirma
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'lancamentos'
  AND column_name LIKE 'pendencia%'
ORDER BY column_name;
