-- =============================================
-- FEATURE: Trello → ERP automação de deferimento (29/05/2026)
-- =============================================
-- Objetivo: quando card de processo (abertura, alteração, transformação,
-- encerramento, baixa) chega na lista "🍀 INSCRIÇÃO MUNICIPAL E ESTADUAL"
-- no board Trello do cliente, ERP marca processos.data_deferimento = NOW().
--
-- Hoje a operacional (Letícia) move o card no Trello E precisa lembrar
-- de marcar deferimento no ERP. Bug clássico de "esqueceu de marcar".
-- Com webhook do Trello → edge function → UPDATE no ERP, vira automático.
--
-- ARQUITETURA:
-- 1. Trello webhook → edge `trello-cards-events`
-- 2. Edge valida HMAC com TRELLO_SECRET
-- 3. Resolve card → processo via processos.trello_card_id
-- 4. Se evento = updateCard + listAfter.name = TARGET + tipo válido,
--    atualiza processos.data_deferimento (se ainda NULL — idempotente)
-- 5. Audit em trello_card_events
--
-- DEPENDÊNCIAS:
-- - clientes.trello_board_id já existe (mas tá tudo NULL — precisa rodar
--   edge `trello-setup-boards` 1x pra linkar)
-- - processos.trello_card_id criado aqui (também precisa backfill via setup)
-- =============================================

-- ────────────────────────────────────────────────
-- 1) Linkagem processo ↔ card Trello
-- ────────────────────────────────────────────────
ALTER TABLE public.processos
  ADD COLUMN IF NOT EXISTS trello_card_id text,
  ADD COLUMN IF NOT EXISTS trello_card_url text,
  ADD COLUMN IF NOT EXISTS trello_card_linked_em timestamptz;

-- UNIQUE parcial — múltiplos NULL OK, mas mesmo card não pode estar em 2 processos
CREATE UNIQUE INDEX IF NOT EXISTS uq_processos_trello_card_id
  ON public.processos(trello_card_id)
  WHERE trello_card_id IS NOT NULL;

-- Lookup rápido pelo webhook
CREATE INDEX IF NOT EXISTS idx_processos_trello_card_lookup
  ON public.processos(trello_card_id)
  WHERE trello_card_id IS NOT NULL;

COMMENT ON COLUMN public.processos.trello_card_id IS
  'ID do card Trello correspondente (link 1:1). Populado por trello-setup-boards no backfill ou por trello-cards-events ao detectar card novo. Usado pelo webhook de deferimento.';

-- ────────────────────────────────────────────────
-- 2) Audit log + idempotência de eventos Trello
-- ────────────────────────────────────────────────
-- Cada action do Trello tem ID único (action.id no payload). UNIQUE garante
-- que webhook duplicado (Trello retry após 5xx) não dispara ação 2x.
CREATE TABLE IF NOT EXISTS public.trello_card_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action_id text NOT NULL UNIQUE,
  action_type text NOT NULL,
  card_id text NOT NULL,
  card_name text,
  board_id text,
  list_before_id text,
  list_before_name text,
  list_after_id text,
  list_after_name text,
  member_username text,
  raw_action jsonb NOT NULL,
  processo_id uuid REFERENCES public.processos(id) ON DELETE SET NULL,
  acao_aplicada text,
  -- Valores possíveis em acao_aplicada:
  --  'deferimento_setado'      → data_deferimento atualizado de NULL pra NOW()
  --  'deferimento_ja_setado'   → já tinha data_deferimento, ignorado (idempotente)
  --  'card_sem_processo'       → trello_card_id não bate com nenhum processo
  --  'tipo_incompativel'       → processo encontrado mas tipo ∉ {abertura, alteracao, ...}
  --  'lista_irrelevante'       → listAfter não é o target — log mas não age
  --  'nao_updateCard'          → outro tipo de action (createCard, etc) — log mas não age
  --  'erro'                    → exception durante processamento
  acao_detalhe text,
  processed_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_trello_card_events_card
  ON public.trello_card_events(card_id);
CREATE INDEX IF NOT EXISTS idx_trello_card_events_processo
  ON public.trello_card_events(processo_id);
CREATE INDEX IF NOT EXISTS idx_trello_card_events_processed
  ON public.trello_card_events(processed_at DESC);
CREATE INDEX IF NOT EXISTS idx_trello_card_events_acao
  ON public.trello_card_events(acao_aplicada);

-- ────────────────────────────────────────────────
-- 3) RLS — apenas master/gerente vê audit (PII Trello)
-- ────────────────────────────────────────────────
ALTER TABLE public.trello_card_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS trello_card_events_select_admin ON public.trello_card_events;
CREATE POLICY trello_card_events_select_admin ON public.trello_card_events
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND role IN ('master', 'gerente')
        AND ativo = true
    )
  );

-- INSERT/UPDATE bloqueado via RLS pra users — só edge function (service role) escreve.
-- Service role bypassa RLS por default; nenhuma policy precisa ser criada.

-- ────────────────────────────────────────────────
-- 4) Helper RPC: estatística pra dashboard futuro
-- ────────────────────────────────────────────────
-- Quantos deferimentos foram automatizados nos últimos N dias
CREATE OR REPLACE FUNCTION public.trello_deferimentos_stats(p_days int DEFAULT 30)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_result jsonb;
BEGIN
  -- Só master/gerente pode chamar
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND role IN ('master', 'gerente')
      AND ativo = true
  ) THEN
    RAISE EXCEPTION 'sem permissão';
  END IF;

  SELECT jsonb_build_object(
    'periodo_dias', p_days,
    'total_eventos', COUNT(*),
    'deferimentos_setados', COUNT(*) FILTER (WHERE acao_aplicada = 'deferimento_setado'),
    'cards_sem_processo', COUNT(*) FILTER (WHERE acao_aplicada = 'card_sem_processo'),
    'erros', COUNT(*) FILTER (WHERE acao_aplicada = 'erro')
  )
  INTO v_result
  FROM public.trello_card_events
  WHERE processed_at >= NOW() - (p_days || ' days')::interval;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.trello_deferimentos_stats(int) TO authenticated;

-- ────────────────────────────────────────────────
-- DONE
-- ────────────────────────────────────────────────
-- Próximo passo: deploy das 2 edges (trello-cards-events + trello-setup-boards).
-- Depois rodar trello-setup-boards em modo ?dry_run=true pra ver match
-- proposto de boards↔clientes ANTES de commitar com ?commit=true.
