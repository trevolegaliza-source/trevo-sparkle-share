-- =============================================
-- SEC-028 (13/05/2026): cleanup de grants em funções + fix NULL bypass
-- =============================================
-- ⚠️ CONTÉM FIX CRÍTICO. Rodar com prioridade alta no SQL Editor.
--
-- O que descobri (madrugada 13/05 via mcp__supabase__execute_sql):
--
-- 1) ATAQUE REAL CONFIRMADO em `set_master_password_hash`:
--    - Função SECURITY DEFINER acessível por anon
--    - Check `IF get_user_role() <> 'master'` falha por NULL bypass
--    - Pra anon: get_user_role() retorna NULL
--    - NULL <> 'master' = NULL (não TRUE)
--    - IF NULL THEN ... em PL/pgSQL = FALSE (não dispara RAISE)
--    - Resultado: anon faz UPDATE direto no master_password_config
--    - Atacante via REST API pode trocar a senha master do Thales
--
-- 2) verify_master_password_hash acessível por anon = oracle de
--    brute-force (sem rate limit interno; cliente decide chamar
--    register_master_password_attempt). Atacante chama 1000x sem
--    deixar log.
--
-- 3) register_master_password_attempt acessível por anon =
--    permite atacante INSERT tentativas falsas com IP do Thales,
--    bloqueando-o por rate limit.
--
-- 4) Diversas RPCs de mutação autenticada (criar_processo, marcar_pago,
--    etc) acessíveis por anon. Defesa em profundidade — na prática
--    `get_empresa_id()` retorna NULL pra anon e RAISE EXCEPTION
--    bloqueia, mas a porta NÃO devia estar aberta.
--
-- 5) Funções TRIGGER (_audit_*, _sync_*, etc) acessíveis por anon
--    via REST. Sem motivo — são chamadas internamente pelo PG.
--
-- 6) 3 funções com `search_path` mutable (advisor warning) — risco
--    de hijacking via schema malicioso.
-- =============================================

-- ╔══════════════════════════════════════════════════════════════╗
-- ║ PARTE 1 — FIX CRÍTICO: NULL bypass em set_master_password_hash ║
-- ╚══════════════════════════════════════════════════════════════╝

CREATE OR REPLACE FUNCTION public.set_master_password_hash(p_hash text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
BEGIN
  -- COALESCE pra evitar NULL bypass. Antes: get_user_role() retornava
  -- NULL pra anon, NULL <> 'master' = NULL, IF NULL = FALSE → UPDATE
  -- rodava sem auth. Agora: NULL vira '' que é diferente de 'master'.
  IF COALESCE(public.get_user_role(), '') <> 'master' THEN
    RAISE EXCEPTION 'apenas master pode alterar senha master';
  END IF;
  IF p_hash IS NULL OR length(p_hash) < 30 THEN
    RAISE EXCEPTION 'hash inválido';
  END IF;

  UPDATE public.master_password_config
     SET password_hash = p_hash,
         updated_at = NOW(),
         updated_by = auth.uid()
   WHERE id = 1;
END;
$function$;

-- ╔══════════════════════════════════════════════════════════════╗
-- ║ PARTE 2 — REVOKE EXECUTE pra anon em funções sensíveis        ║
-- ╚══════════════════════════════════════════════════════════════╝

-- Master password (CRÍTICO: tirar anon urgente)
REVOKE EXECUTE ON FUNCTION public.set_master_password_hash(text)            FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.verify_master_password_hash(text)         FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.register_master_password_attempt(uuid, text, boolean) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.hash_master_password(text)                FROM anon, public;

-- Mutação autenticada (defesa em profundidade)
REVOKE EXECUTE ON FUNCTION public.alterar_valor_lancamento(uuid, numeric, numeric)               FROM anon;
REVOKE EXECUTE ON FUNCTION public.arquivar_cliente(uuid)                                         FROM anon;
REVOKE EXECUTE ON FUNCTION public.desarquivar_cliente(uuid)                                      FROM anon;
REVOKE EXECUTE ON FUNCTION public.converter_orcamento_em_processo(uuid)                          FROM anon;
REVOKE EXECUTE ON FUNCTION public.desfazer_deferimento(uuid)                                     FROM anon;
REVOKE EXECUTE ON FUNCTION public.marcar_deferimento(uuid, date)                                 FROM anon;
REVOKE EXECUTE ON FUNCTION public.marcar_processo_pago(uuid, date)                               FROM anon;
REVOKE EXECUTE ON FUNCTION public.promover_lancamento_ao_deferir(uuid)                           FROM anon;
REVOKE EXECUTE ON FUNCTION public.rotacionar_cobranca_token(uuid)                                FROM anon;
REVOKE EXECUTE ON FUNCTION public.tentar_aplicar_boas_vindas(uuid)                               FROM anon;
REVOKE EXECUTE ON FUNCTION public.reverter_boas_vindas(uuid)                                     FROM anon;

-- criar_processo_com_lancamento tem 21 argumentos — usa regclass
DO $$
DECLARE
  v_proc oid;
BEGIN
  SELECT oid INTO v_proc FROM pg_proc
   WHERE proname = 'criar_processo_com_lancamento'
     AND pronamespace = 'public'::regnamespace
   LIMIT 1;
  IF v_proc IS NOT NULL THEN
    EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%I(%s) FROM anon',
                   'criar_processo_com_lancamento',
                   pg_get_function_identity_arguments(v_proc));
  END IF;
END $$;

-- Triggers (não devem ser callable via REST — anon, authenticated, public)
REVOKE EXECUTE ON FUNCTION public._audit_cobrancas_trigger()                          FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public._audit_lancamentos_trigger()                        FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public._bloqueia_avanco_aguardando_deferimento()           FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public._bloqueia_cobranca_sem_reembolso()                  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public._cliente_precos_touch_updated()                     FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public._cobranca_preenche_expiracao()                      FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public._empresas_config_touch_updated_at()                 FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public._orcamento_preenche_expiracao()                     FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public._sync_cobranca_lancamentos_junction()               FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public._validate_cobranca_lancamento_ids()                 FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_updated_at()                                    FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_deferimento_on_etapa_change()                  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user()                                   FROM PUBLIC, anon, authenticated;

-- Auditoria interna
REVOKE EXECUTE ON FUNCTION public._auditoria_gravar(uuid, text, uuid, text, jsonb, jsonb) FROM PUBLIC, anon, authenticated;

-- ╔══════════════════════════════════════════════════════════════╗
-- ║ PARTE 3 — Fix function_search_path_mutable (advisor warning)  ║
-- ╚══════════════════════════════════════════════════════════════╝

ALTER FUNCTION public.set_updated_at()                       SET search_path = public, pg_temp;
ALTER FUNCTION public._cobranca_preenche_expiracao()         SET search_path = public, pg_temp;
ALTER FUNCTION public._cliente_precos_touch_updated()        SET search_path = public, pg_temp;

-- ╔══════════════════════════════════════════════════════════════╗
-- ║ PARTE 4 — Hardening da view processos_zombies (não urgente)   ║
-- ╚══════════════════════════════════════════════════════════════╝
-- View hoje é SECURITY DEFINER por padrão (PG 15+). Sem grants
-- explícitos pra anon/authenticated → na prática só super-user lê.
-- Mesmo assim, marcar como invoker pra reduzir surface:

ALTER VIEW public.processos_zombies SET (security_invoker = true);

-- ╔══════════════════════════════════════════════════════════════╗
-- ║ PARTE 5 — Pós-validação (rodar depois pra confirmar fix)      ║
-- ╚══════════════════════════════════════════════════════════════╝
-- Deve retornar 0 rows pras 4 master_password e a maioria das demais:
--
-- SELECT p.proname, has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_pode
--   FROM pg_proc p
--   JOIN pg_namespace n ON n.oid = p.pronamespace
--  WHERE n.nspname = 'public'
--    AND p.proname IN (
--      'set_master_password_hash','verify_master_password_hash',
--      'register_master_password_attempt','hash_master_password',
--      'marcar_processo_pago','marcar_deferimento'
--    )
--    AND has_function_privilege('anon', p.oid, 'EXECUTE');
-- (esperado: 0 rows)
