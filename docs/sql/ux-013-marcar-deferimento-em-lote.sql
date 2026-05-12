-- =============================================
-- UX-013 (13/05/2026 madrugada): marcar_deferimento_em_lote (atômica)
-- =============================================
-- Substitui o for-loop de DeferimentoModal.handleConfirm. Antes:
--   for (const p of deferidos) {
--     await supabase.from('processos').update({ data_deferimento: data }).eq('id', p.processo_id);
--     await select processo; await gerarFaturamentoDeferimento(proc);
--   }
-- Se 3º falha, 2 primeiros já têm data_deferimento mas toast mostra erro
-- como se nada tivesse mudado.
--
-- Agora: 1 RPC com loop interno PL/pgSQL chamando marcar_deferimento.
-- marcar_deferimento já existe e está sendo arrumado em SEC-028 (NULL
-- bypass). Esta wrapper depende do fix do SEC-028 — rodar SEC-028 antes.
-- =============================================

CREATE OR REPLACE FUNCTION public.marcar_deferimento_em_lote(
  p_processos jsonb  -- array [{processo_id: uuid, data_deferimento: date}]
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_empresa_id uuid;
  v_item jsonb;
  v_resultados jsonb[] := ARRAY[]::jsonb[];
  v_processados int := 0;
BEGIN
  v_empresa_id := public.get_empresa_id();
  IF v_empresa_id IS NULL THEN
    RAISE EXCEPTION 'Usuário sem empresa associada';
  END IF;

  -- Loop dentro de uma transação. Se UMA falhar (ex: processo não
  -- pertence à empresa, processo não existe, etc), Postgres rolla back
  -- TUDO. Cliente recebe a mensagem de erro da função interna.
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_processos) LOOP
    v_resultados := v_resultados || public.marcar_deferimento(
      (v_item->>'processo_id')::uuid,
      (v_item->>'data_deferimento')::date
    );
    v_processados := v_processados + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'ok', true,
    'processados', v_processados,
    'resultados', v_resultados
  );
END;
$function$;

COMMENT ON FUNCTION public.marcar_deferimento_em_lote(jsonb) IS
  'UX-013 (13/05/2026): wrapper transacional sobre marcar_deferimento. Se 1 processo do lote falhar, transação rolla TUDO. Substitui for-loop do DeferimentoModal sem rollback.';

REVOKE EXECUTE ON FUNCTION public.marcar_deferimento_em_lote(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.marcar_deferimento_em_lote(jsonb) TO authenticated;
