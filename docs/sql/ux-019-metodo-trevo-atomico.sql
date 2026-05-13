-- =============================================
-- UX-019 (13/05/2026): set_metodo_trevo (atômica)
-- =============================================
-- Substitui handleAtivarTrevo + handleDesativarTrevo de
-- `ClientesAuditoria.tsx:515-631`. Antes:
--   - 2-3 awaits encadeados (fetch etiquetas → update processo → update
--     lancamento se pendente). Sem rollback.
--   - Se o 3º falha, processo tem nova etiqueta + valor, mas lancamento
--     fica com valor antigo → inconsistência (PDF do extrato vai mostrar
--     valor errado).
--
-- Agora: 1 RPC com transação Postgres. Tudo ou nada.
--
-- Decisões:
--  - 1 RPC `set_metodo_trevo` com flag `p_ativar` consolidada
--  - Pra ativar: requer p_novo_valor
--  - Pra desativar: ignora p_novo_valor; banco calcula valor restaurado
--    (valor_original do lancamento OU valor_base do cliente)
--  - Anti-rebaixamento: se lancamento status='pago', NÃO mexe nele
--    (só ajusta processo). Padrão DERMAE 07/05/2026.
-- =============================================

CREATE OR REPLACE FUNCTION public.set_metodo_trevo(
  p_processo_id uuid,
  p_lancamento_id uuid,
  p_ativar boolean,
  p_novo_valor numeric DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_empresa_id uuid;
  v_processo RECORD;
  v_lancamento RECORD;
  v_etiquetas text[];
  v_valor_a_setar numeric;
  v_valor_base numeric;
  v_now timestamptz := NOW();
BEGIN
  v_empresa_id := public.get_empresa_id();
  IF v_empresa_id IS NULL THEN
    RAISE EXCEPTION 'Usuário sem empresa associada';
  END IF;

  -- Carrega processo + tenant check
  SELECT id, empresa_id, cliente_id, etiquetas, valor
    INTO v_processo
    FROM public.processos
   WHERE id = p_processo_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Processo não encontrado';
  END IF;
  IF v_processo.empresa_id <> v_empresa_id THEN
    RAISE EXCEPTION 'Processo não pertence à sua empresa';
  END IF;

  -- Carrega lancamento (pode não ter — processos avulsos sem cobrança)
  SELECT id, empresa_id, status, valor, valor_original
    INTO v_lancamento
    FROM public.lancamentos
   WHERE id = p_lancamento_id;
  IF v_lancamento.id IS NOT NULL AND v_lancamento.empresa_id <> v_empresa_id THEN
    RAISE EXCEPTION 'Lançamento não pertence à sua empresa';
  END IF;

  v_etiquetas := COALESCE(v_processo.etiquetas, ARRAY[]::text[]);

  IF p_ativar THEN
    -- ATIVAR
    IF p_novo_valor IS NULL OR p_novo_valor <= 0 THEN
      RAISE EXCEPTION 'Novo valor obrigatório e > 0 pra ativar Método Trevo';
    END IF;

    IF NOT ('metodo_trevo' = ANY(v_etiquetas)) THEN
      v_etiquetas := v_etiquetas || 'metodo_trevo';
    END IF;
    v_valor_a_setar := p_novo_valor;

    UPDATE public.processos
       SET etiquetas = v_etiquetas,
           valor = v_valor_a_setar,
           updated_at = v_now
     WHERE id = p_processo_id;

    -- Lançamento: só mexe se existir E não estiver pago (anti-rebaixamento)
    IF v_lancamento.id IS NOT NULL AND v_lancamento.status <> 'pago' THEN
      UPDATE public.lancamentos
         SET valor = v_valor_a_setar,
             valor_original = COALESCE(v_lancamento.valor_original, v_lancamento.valor),
             valor_alterado_por = auth.uid(),
             valor_alterado_em = v_now,
             updated_at = v_now
       WHERE id = p_lancamento_id;
    END IF;

    RETURN jsonb_build_object(
      'ok', true,
      'acao', 'ativado',
      'novo_valor', v_valor_a_setar
    );
  ELSE
    -- DESATIVAR
    v_etiquetas := array_remove(v_etiquetas, 'metodo_trevo');

    -- Calcula valor restaurado: prioridade valor_original do lancamento,
    -- fallback pra valor_base do cliente
    SELECT valor_base INTO v_valor_base
      FROM public.clientes
     WHERE id = v_processo.cliente_id;

    v_valor_a_setar := CASE
      WHEN v_lancamento.valor_original IS NOT NULL AND v_lancamento.valor_original > 0
        THEN v_lancamento.valor_original
      WHEN v_valor_base IS NOT NULL AND v_valor_base > 0
        THEN v_valor_base
      ELSE NULL  -- sem fonte de valor — só remove etiqueta, mantém valor atual
    END;

    UPDATE public.processos
       SET etiquetas = v_etiquetas,
           valor = COALESCE(v_valor_a_setar, valor),
           updated_at = v_now
     WHERE id = p_processo_id;

    IF v_valor_a_setar IS NOT NULL
       AND v_lancamento.id IS NOT NULL
       AND v_lancamento.status <> 'pago' THEN
      UPDATE public.lancamentos
         SET valor = v_valor_a_setar,
             valor_alterado_por = auth.uid(),
             valor_alterado_em = v_now,
             updated_at = v_now
       WHERE id = p_lancamento_id;
    END IF;

    RETURN jsonb_build_object(
      'ok', true,
      'acao', 'desativado',
      'valor_restaurado', v_valor_a_setar
    );
  END IF;
END;
$function$;

COMMENT ON FUNCTION public.set_metodo_trevo(uuid, uuid, boolean, numeric) IS
  'UX-019 (13/05/2026): ativa/desativa Método Trevo atomicamente. Substitui handleAtivarTrevo/handleDesativarTrevo de ClientesAuditoria. Anti-rebaixamento de lancamentos pagos.';

REVOKE EXECUTE ON FUNCTION public.set_metodo_trevo(uuid, uuid, boolean, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_metodo_trevo(uuid, uuid, boolean, numeric) TO authenticated;
