-- =============================================
-- FEATURE 29/05/2026 — Link manual processo↔card Trello
-- =============================================
-- Backfill automático (trello-setup-boards link_cards) deixou 26 ambíguos
-- + 4 sem_match dos 150 processos. Esta RPC permite que master/gerente
-- linke manualmente via UI /admin/trello-cards-pendentes.
--
-- Também: RPC que retorna processos pendentes (sem trello_card_id) cujo
-- cliente tem trello_board_id (board linkado, mas card específico não).
-- =============================================

-- ────────────────────────────────────────────────
-- 1) RPC: lista processos pendentes (sem trello_card_id) com board linkado
-- ────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.trello_processos_pendentes()
RETURNS TABLE (
  processo_id uuid,
  processo_tipo text,
  processo_razao_social text,
  processo_etapa text,
  processo_created_at timestamptz,
  processo_data_deferimento date,
  cliente_id uuid,
  cliente_nome text,
  cliente_apelido text,
  trello_board_id text,
  trello_board_url text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Auth: só master/gerente
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND role IN ('master', 'gerente')
      AND ativo = true
  ) THEN
    RAISE EXCEPTION 'sem permissão';
  END IF;

  RETURN QUERY
  SELECT
    p.id AS processo_id,
    p.tipo::text AS processo_tipo,
    p.razao_social AS processo_razao_social,
    p.etapa AS processo_etapa,
    p.created_at AS processo_created_at,
    p.data_deferimento AS processo_data_deferimento,
    c.id AS cliente_id,
    c.nome AS cliente_nome,
    c.apelido AS cliente_apelido,
    c.trello_board_id,
    c.trello_board_url
  FROM public.processos p
  JOIN public.clientes c ON c.id = p.cliente_id
  WHERE p.trello_card_id IS NULL
    AND c.trello_board_id IS NOT NULL
    AND COALESCE(p.is_archived, false) = false
    AND COALESCE(c.is_archived, false) = false
  ORDER BY c.nome, p.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.trello_processos_pendentes() TO authenticated;

-- ────────────────────────────────────────────────
-- 2) RPC: linkar manual processo↔card
-- ────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.trello_linkar_card_manual(
  p_processo_id uuid,
  p_card_id text,
  p_card_url text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_proc RECORD;
  v_card_existente uuid;
BEGIN
  -- Auth
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND role IN ('master', 'gerente')
      AND ativo = true
  ) THEN
    RAISE EXCEPTION 'sem permissão';
  END IF;

  -- Valida input
  IF p_processo_id IS NULL OR p_card_id IS NULL OR p_card_id = '' THEN
    RAISE EXCEPTION 'processo_id e card_id obrigatórios';
  END IF;

  -- Confere processo existe e está sem link
  SELECT id, trello_card_id, cliente_id
  INTO v_proc
  FROM public.processos
  WHERE id = p_processo_id;

  IF v_proc.id IS NULL THEN
    RAISE EXCEPTION 'Processo não encontrado';
  END IF;

  IF v_proc.trello_card_id IS NOT NULL AND v_proc.trello_card_id <> p_card_id THEN
    RAISE EXCEPTION 'Processo já está linkado a outro card (%). Desfaça o link antes.', v_proc.trello_card_id;
  END IF;

  -- Confere se o card já está linkado a OUTRO processo (UNIQUE constraint avisa,
  -- mas damos msg mais clara)
  SELECT id INTO v_card_existente
  FROM public.processos
  WHERE trello_card_id = p_card_id
    AND id <> p_processo_id;

  IF v_card_existente IS NOT NULL THEN
    RAISE EXCEPTION 'Esse card já está linkado a outro processo (%). Desfaça o link antes.', v_card_existente;
  END IF;

  -- Aplica link
  UPDATE public.processos
     SET trello_card_id = p_card_id,
         trello_card_url = p_card_url,
         trello_card_linked_em = NOW(),
         updated_at = NOW()
   WHERE id = p_processo_id;

  RETURN jsonb_build_object(
    'ok', true,
    'processo_id', p_processo_id,
    'card_id', p_card_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.trello_linkar_card_manual(uuid, text, text) TO authenticated;

-- ────────────────────────────────────────────────
-- 3) RPC: desfazer link (caso precise corrigir)
-- ────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.trello_desfazer_link_card(
  p_processo_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND role IN ('master', 'gerente')
      AND ativo = true
  ) THEN
    RAISE EXCEPTION 'sem permissão';
  END IF;

  UPDATE public.processos
     SET trello_card_id = NULL,
         trello_card_url = NULL,
         trello_card_linked_em = NULL,
         updated_at = NOW()
   WHERE id = p_processo_id;

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.trello_desfazer_link_card(uuid) TO authenticated;
