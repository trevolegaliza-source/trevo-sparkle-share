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
-- ║ PARTE 1 — FIX CRÍTICO: NULL bypass em 4 funções                ║
-- ╚══════════════════════════════════════════════════════════════╝
-- 1a) set_master_password_hash — atacante anon trocava senha master

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

-- 1b) marcar_deferimento — mesma classe de bug
-- `v_processo.empresa_id <> v_empresa_caller` com caller=NULL = NULL = IF FALSE.
-- Anon com processo_id válido em mão (vazado por outro caminho) marcava
-- deferimento de processo de empresa alheia.

CREATE OR REPLACE FUNCTION public.marcar_deferimento(p_processo_id uuid, p_data_deferimento date)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_empresa_caller uuid;
  v_processo RECORD;
  v_lanc_id uuid;
  v_vencimento date;
BEGIN
  v_empresa_caller := public.get_empresa_id();
  -- Sem empresa = anon ou user sem profile. Não deveria poder mexer.
  IF v_empresa_caller IS NULL THEN
    RAISE EXCEPTION 'Usuário sem empresa associada';
  END IF;

  SELECT id, cliente_id, razao_social, tipo, valor, empresa_id, data_deferimento
    INTO v_processo
    FROM public.processos
   WHERE id = p_processo_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Processo não encontrado';
  END IF;
  IF v_processo.empresa_id <> v_empresa_caller THEN
    RAISE EXCEPTION 'Processo não pertence à sua empresa';
  END IF;

  UPDATE public.processos
     SET data_deferimento = p_data_deferimento,
         updated_at = NOW()
   WHERE id = p_processo_id;

  v_vencimento := public.calcular_vencimento(v_processo.cliente_id);

  SELECT id INTO v_lanc_id
    FROM public.lancamentos
   WHERE processo_id = p_processo_id
     AND tipo = 'receber'
     AND etapa_financeiro = 'aguardando_deferimento'
   ORDER BY created_at
   LIMIT 1
   FOR UPDATE;

  IF v_lanc_id IS NOT NULL THEN
    UPDATE public.lancamentos
       SET etapa_financeiro = 'solicitacao_criada',
           data_vencimento  = v_vencimento,
           updated_at       = NOW()
     WHERE id = v_lanc_id;
    RETURN jsonb_build_object('ok', true, 'acao', 'promovido', 'lancamento_id', v_lanc_id);
  END IF;

  INSERT INTO public.lancamentos (
    tipo, cliente_id, processo_id, descricao, valor, status,
    data_vencimento, created_at, etapa_financeiro, empresa_id
  )
  VALUES (
    'receber'::public.tipo_lancamento,
    v_processo.cliente_id,
    p_processo_id,
    INITCAP(v_processo.tipo::text) || ' - ' || v_processo.razao_social || ' (Deferido)',
    COALESCE(v_processo.valor, 0),
    'pendente'::public.status_financeiro,
    v_vencimento,
    NOW(),
    'solicitacao_criada',
    v_processo.empresa_id
  )
  RETURNING id INTO v_lanc_id;

  RETURN jsonb_build_object('ok', true, 'acao', 'criado', 'lancamento_id', v_lanc_id);
END;
$function$;

-- 1c) desfazer_deferimento — mesma classe

CREATE OR REPLACE FUNCTION public.desfazer_deferimento(p_processo_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_empresa_caller uuid;
  v_processo_empresa uuid;
  v_lanc_id uuid;
  v_lanc_etapa text;
BEGIN
  v_empresa_caller := public.get_empresa_id();
  IF v_empresa_caller IS NULL THEN
    RAISE EXCEPTION 'Usuário sem empresa associada';
  END IF;

  SELECT empresa_id INTO v_processo_empresa
    FROM public.processos
   WHERE id = p_processo_id;

  IF v_processo_empresa IS NULL THEN
    RAISE EXCEPTION 'Processo não encontrado';
  END IF;
  IF v_processo_empresa <> v_empresa_caller THEN
    RAISE EXCEPTION 'Processo não pertence à sua empresa';
  END IF;

  SELECT id, etapa_financeiro::text
    INTO v_lanc_id, v_lanc_etapa
    FROM public.lancamentos
   WHERE processo_id = p_processo_id
     AND tipo = 'receber'
   ORDER BY created_at
   LIMIT 1
   FOR UPDATE;

  IF v_lanc_id IS NULL THEN
    RAISE EXCEPTION 'Processo sem lançamento de receber';
  END IF;
  IF v_lanc_etapa IN ('cobranca_enviada', 'honorario_pago') THEN
    RAISE EXCEPTION 'Lançamento já foi enviado/pago — não pode rebaixar (etapa: %)', v_lanc_etapa;
  END IF;

  UPDATE public.processos
     SET data_deferimento = NULL,
         updated_at       = NOW()
   WHERE id = p_processo_id;

  UPDATE public.lancamentos
     SET etapa_financeiro = 'aguardando_deferimento',
         data_vencimento  = '2099-12-31'::date,
         updated_at       = NOW()
   WHERE id = v_lanc_id;

  RETURN jsonb_build_object('ok', true, 'lancamento_id', v_lanc_id);
END;
$function$;

-- 1d) promover_lancamento_ao_deferir — mesma classe

CREATE OR REPLACE FUNCTION public.promover_lancamento_ao_deferir(p_processo_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_lanc_id UUID;
  v_processo RECORD;
  v_vencimento DATE;
  v_empresa_caller UUID;
BEGIN
  v_empresa_caller := public.get_empresa_id();
  IF v_empresa_caller IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'motivo', 'sem_empresa');
  END IF;

  SELECT p.id, p.cliente_id, p.razao_social, p.tipo, p.valor, p.empresa_id
    INTO v_processo
    FROM public.processos p
   WHERE p.id = p_processo_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'motivo', 'processo_nao_encontrado');
  END IF;
  IF v_processo.empresa_id <> v_empresa_caller THEN
    RETURN jsonb_build_object('ok', false, 'motivo', 'processo_outra_empresa');
  END IF;

  SELECT id INTO v_lanc_id
    FROM public.lancamentos
   WHERE processo_id = p_processo_id
     AND tipo = 'receber'
     AND etapa_financeiro = 'aguardando_deferimento'
   ORDER BY created_at
   LIMIT 1
   FOR UPDATE;

  v_vencimento := public.calcular_vencimento(v_processo.cliente_id);

  IF v_lanc_id IS NOT NULL THEN
    UPDATE public.lancamentos
       SET etapa_financeiro = 'solicitacao_criada',
           data_vencimento = v_vencimento,
           updated_at = NOW()
     WHERE id = v_lanc_id;
    RETURN jsonb_build_object('ok', true, 'acao', 'promovido', 'lancamento_id', v_lanc_id);
  END IF;

  INSERT INTO public.lancamentos (
    tipo, cliente_id, processo_id, descricao, valor, status,
    data_vencimento, created_at, etapa_financeiro, empresa_id
  )
  VALUES (
    'receber'::public.tipo_lancamento,
    v_processo.cliente_id,
    p_processo_id,
    INITCAP(v_processo.tipo::text) || ' - ' || v_processo.razao_social || ' (Deferido)',
    COALESCE(v_processo.valor, 0),
    'pendente'::public.status_financeiro,
    v_vencimento,
    NOW(),
    'solicitacao_criada',
    v_processo.empresa_id
  )
  RETURNING id INTO v_lanc_id;

  RETURN jsonb_build_object('ok', true, 'acao', 'criado', 'lancamento_id', v_lanc_id);
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
REVOKE EXECUTE ON FUNCTION public.alterar_valor_lancamento(uuid, numeric, numeric)               FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.arquivar_cliente(uuid)                                         FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.desarquivar_cliente(uuid)                                      FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.converter_orcamento_em_processo(uuid)                          FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.desfazer_deferimento(uuid)                                     FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.marcar_deferimento(uuid, date)                                 FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.marcar_processo_pago(uuid, date)                               FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.promover_lancamento_ao_deferir(uuid)                           FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.rotacionar_cobranca_token(uuid)                                FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.tentar_aplicar_boas_vindas(uuid)                               FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.reverter_boas_vindas(uuid)                                     FROM PUBLIC, anon;

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
