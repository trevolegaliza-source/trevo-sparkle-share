-- =============================================
-- Backfill lancamento INSTITUTO SADALA (WR CONTABILIDADE)
-- =============================================
-- Bug 14/05/2026: processo SADALA aparece em CLIENTES > PROCESSOS mas nao
-- em FINANCEIRO. Causa: lancamento foi deletado em algum momento
-- (provavelmente quando Thales tentou excluir outro processo via Financeiro
-- e o cache stale fez a tela parecer que excluiu o errado).
--
-- Estado atual:
--   processo 05412f72-16e1-4fa3-b83d-7c3052ea67ac (SADALA) — valor R$ 580
--   lancamento — DELETADO (nao existe registro)
--
-- Cliente eh AVULSO_4D, momento_faturamento='na_solicitacao'.
-- Lancamento backfilled com:
--   etapa_financeiro = 'solicitacao_criada' (padrao na_solicitacao)
--   status = 'pendente'
--   data_vencimento calculada via calcular_vencimento (D+4)
-- =============================================

INSERT INTO lancamentos (
  tipo, cliente_id, processo_id, descricao, valor, status,
  data_vencimento, etapa_financeiro, empresa_id, confirmado_recebimento,
  created_at
)
SELECT
  'receber'::public.tipo_lancamento,
  p.cliente_id,
  p.id,
  'Transformacao - ' || p.razao_social || ' (backfill 14/05)',
  p.valor,
  'pendente'::public.status_financeiro,
  COALESCE(public.calcular_vencimento(p.cliente_id), CURRENT_DATE + interval '4 days')::date,
  'solicitacao_criada',
  p.empresa_id,
  false,
  p.created_at
FROM processos p
WHERE p.id = '05412f72-16e1-4fa3-b83d-7c3052ea67ac'
  AND NOT EXISTS (
    SELECT 1 FROM lancamentos l WHERE l.processo_id = p.id
  );

-- Verificar:
-- SELECT p.razao_social, l.id as lanc_id, l.valor, l.status, l.etapa_financeiro
-- FROM processos p
-- LEFT JOIN lancamentos l ON l.processo_id = p.id
-- WHERE p.id = '05412f72-16e1-4fa3-b83d-7c3052ea67ac';
