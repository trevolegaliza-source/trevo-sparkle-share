-- =============================================
-- updated_by em processos + orcamentos (18/05/2026 — Bloco 3 pre-viagem)
-- =============================================
-- Complementa created_by (commit 674efe4). Agora sabe não só quem CRIOU
-- mas também quem EDITOU por último, e QUANDO. Útil quando Letícia mexe
-- em processo do master ou vice-versa.
--
-- Escopo enxuto: só metadata `updated_by` + `updated_at`. Histórico
-- detalhado de campo-por-campo fica pra outra sessão (tabela
-- entidade_audit).
-- =============================================

-- 1) ADD COLUMN updated_by em processos (updated_at já existe)
ALTER TABLE public.processos
  ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_processos_updated_by ON public.processos(updated_by);

-- 2) Trigger BEFORE UPDATE em processos — preenche updated_by + updated_at
CREATE OR REPLACE FUNCTION public.tg_set_processo_updated_meta()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_by := auth.uid();
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_processo_updated_meta ON public.processos;
CREATE TRIGGER trg_set_processo_updated_meta
BEFORE UPDATE ON public.processos
FOR EACH ROW EXECUTE FUNCTION public.tg_set_processo_updated_meta();

-- 3) ADD COLUMN updated_by + updated_at em orcamentos (se não existe)
ALTER TABLE public.orcamentos
  ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- updated_at já existe em orcamentos
CREATE INDEX IF NOT EXISTS idx_orcamentos_updated_by ON public.orcamentos(updated_by);

-- 4) Trigger BEFORE UPDATE em orcamentos
CREATE OR REPLACE FUNCTION public.tg_set_orcamento_updated_meta()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_by := auth.uid();
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_orcamento_updated_meta ON public.orcamentos;
CREATE TRIGGER trg_set_orcamento_updated_meta
BEFORE UPDATE ON public.orcamentos
FOR EACH ROW EXECUTE FUNCTION public.tg_set_orcamento_updated_meta();

-- Confirma
SELECT
  (SELECT count(*) FROM information_schema.columns WHERE table_schema='public' AND table_name='processos' AND column_name='updated_by') AS processos_col,
  (SELECT count(*) FROM information_schema.columns WHERE table_schema='public' AND table_name='orcamentos' AND column_name='updated_by') AS orcamentos_col,
  (SELECT count(*) FROM pg_trigger WHERE tgname IN ('trg_set_processo_updated_meta', 'trg_set_orcamento_updated_meta')) AS triggers_ativos;
