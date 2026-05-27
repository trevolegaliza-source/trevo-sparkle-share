-- ════════════════════════════════════════════════════════════════════════════
-- Limpeza de PDFs de teste do bucket propostas-pdf — 26/05/2026 noite
-- ════════════════════════════════════════════════════════════════════════════
-- Acumularam 6 PDFs de teste durante o desenvolvimento da feature de PDF
-- unificado (Proposta + MSA). Apenas 1 (PROP-0044) está vivo apontado por
-- orcamento.terc_pdf_url. Resto é lixo.
--
-- Estratégia: deletar TUDO no bucket que NÃO está referenciado por nenhum
-- orcamento.terc_pdf_url. Idempotente e seguro.
-- ════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ──────────────────────────────────────────────────────────────────────
-- 1. Preview antes de deletar
-- ──────────────────────────────────────────────────────────────────────
WITH referenciados AS (
  SELECT DISTINCT REGEXP_REPLACE(terc_pdf_url, '^.*/', '') AS filename
    FROM public.orcamentos
   WHERE tipo_proposta = 'terceirizacao'
     AND terc_pdf_url IS NOT NULL
)
SELECT
  o.name AS arquivo,
  o.created_at,
  ROUND((o.metadata->>'size')::numeric / 1024, 1) AS kb,
  CASE WHEN r.filename IS NOT NULL THEN '🔒 manter' ELSE '🗑️  deletar' END AS acao
FROM storage.objects o
LEFT JOIN referenciados r ON r.filename = o.name
WHERE o.bucket_id = 'propostas-pdf'
ORDER BY o.created_at DESC;

-- ──────────────────────────────────────────────────────────────────────
-- 2. Delete dos órfãos (não referenciados)
-- ──────────────────────────────────────────────────────────────────────
DELETE FROM storage.objects
 WHERE bucket_id = 'propostas-pdf'
   AND name NOT IN (
     SELECT REGEXP_REPLACE(terc_pdf_url, '^.*/', '')
       FROM public.orcamentos
      WHERE tipo_proposta = 'terceirizacao'
        AND terc_pdf_url IS NOT NULL
   );

-- ──────────────────────────────────────────────────────────────────────
-- 3. Confirma quantos sobraram
-- ──────────────────────────────────────────────────────────────────────
SELECT
  COUNT(*) AS pdfs_restantes,
  STRING_AGG(name, E'\n') AS arquivos
FROM storage.objects
WHERE bucket_id = 'propostas-pdf';

COMMIT;
