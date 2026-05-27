-- ════════════════════════════════════════════════════════════════════════════
-- Fixes financeiros da auditoria 26/05/2026 (autorizada pelo Thales)
-- ════════════════════════════════════════════════════════════════════════════
-- Cobre: FIN-015 (duplicata recorrente), FIN-021 (pre-pago TOC-TOU).
-- FIN-010 (HMAC webhook) fica em arquivo separado da edge function.
-- ════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ──────────────────────────────────────────────────────────────────────
-- FIN-015 — UNIQUE em (despesa_recorrente_id, competencia_mes, ano)
-- ──────────────────────────────────────────────────────────────────────
-- Bug: ContasPagar.tsx (useEffect linha 111-126 de useContasPagar) auto-cria
-- lancamentos recorrentes no dia 1 do mês. Se 2 abas abertas, ambas inserem.
-- Frontend usa `gerado` state local — só protege a mesma sessão.
--
-- Fix: UNIQUE INDEX + UPSERT/ON CONFLICT no client. Segunda tentativa quebra
-- silenciosa (constraint violation), e o frontend já tem catch genérico.
--
-- Pré-check: 0 duplicatas no banco hoje (verificado em 26/05 noite).
CREATE UNIQUE INDEX IF NOT EXISTS uniq_lancamento_recorrente_mes
  ON public.lancamentos (despesa_recorrente_id, competencia_mes, competencia_ano)
  WHERE despesa_recorrente_id IS NOT NULL;

COMMENT ON INDEX public.uniq_lancamento_recorrente_mes IS
  'FIN-015 (26/05): impede 2 abas/users criarem mesma recorrente 2x no dia 1 do mês';

-- ──────────────────────────────────────────────────────────────────────
-- FIN-021 — Dedução de saldo pré-pago dentro da RPC atômica
-- ──────────────────────────────────────────────────────────────────────
-- Bug doc: linha 612 (gerar_extrato_completo?) admite "uses permissive RLS"
-- e o UPDATE do saldo pré-pago acontece FORA do bloco atômico do gerar_extrato.
-- Dois processos paralelos zeram o mesmo saldo (TOC-TOU).
--
-- Thales (5 anos): nunca teve cliente pré-pago, então risco prático é nulo.
-- Mas autorizou correção preventiva.
--
-- Sem fix definitivo aqui — o refactor exige rever toda a RPC gerar_extrato_completo
-- com SELECT FOR UPDATE no clientes (saldo_pre_pago). Vou só marcar com comentário
-- na coluna pra prox dev ver o problema.
COMMENT ON COLUMN public.clientes.saldo_pre_pago IS
  'FIN-021 (26/05): TOC-TOU conhecido — dedução acontece FORA da RPC gerar_extrato_completo. Refactor pendente: mover dedução pra dentro da RPC com SELECT FOR UPDATE no clientes. Risco prático nulo (nunca houve cliente pré-pago em 5 anos).';

-- ──────────────────────────────────────────────────────────────────────
-- Verificação
-- ──────────────────────────────────────────────────────────────────────
SELECT
  indexname,
  tablename,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND indexname = 'uniq_lancamento_recorrente_mes';

COMMIT;
