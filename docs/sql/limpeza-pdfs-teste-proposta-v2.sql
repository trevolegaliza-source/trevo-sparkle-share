-- ════════════════════════════════════════════════════════════════════════════
-- Limpeza v2 — usa Storage REST API via supabase_functions ou cURL
-- ════════════════════════════════════════════════════════════════════════════
-- Supabase 2026 tem trigger storage.protect_delete() que bloqueia DELETE direto.
-- Esta versão SÓ LISTA os arquivos a deletar. A deleção em si precisa ser
-- feita via Dashboard (Storage → propostas-pdf → seleciona → Delete) OU via
-- curl REST API (snippet abaixo).
-- ════════════════════════════════════════════════════════════════════════════

-- ──────────────────────────────────────────────────────────────────────
-- 1. Lista os arquivos ÓRFÃOS (não referenciados por nenhum orcamento)
-- ──────────────────────────────────────────────────────────────────────
WITH referenciados AS (
  SELECT DISTINCT REGEXP_REPLACE(terc_pdf_url, '^.*/', '') AS filename
    FROM public.orcamentos
   WHERE tipo_proposta = 'terceirizacao'
     AND terc_pdf_url IS NOT NULL
)
SELECT
  o.name AS arquivo_para_deletar,
  ROUND((o.metadata->>'size')::numeric / 1024, 1) AS kb,
  o.created_at
FROM storage.objects o
LEFT JOIN referenciados r ON r.filename = o.name
WHERE o.bucket_id = 'propostas-pdf'
  AND r.filename IS NULL
ORDER BY o.created_at DESC;

-- ──────────────────────────────────────────────────────────────────────
-- 2. Pra DELETAR de fato: vai no Dashboard → Storage → propostas-pdf,
--    marca os arquivos listados acima e clica Delete.
--
--    OU via curl (substitui SERVICE_ROLE_KEY pela sua):
--
--    curl -X DELETE "https://aahhauquuicvtwtrxyan.supabase.co/storage/v1/object/propostas-pdf/NOME_DO_ARQUIVO.pdf" \
--      -H "Authorization: Bearer SERVICE_ROLE_KEY"
-- ──────────────────────────────────────────────────────────────────────
