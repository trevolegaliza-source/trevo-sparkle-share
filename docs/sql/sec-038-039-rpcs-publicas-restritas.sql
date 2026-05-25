-- ════════════════════════════════════════════════════════════════════════════
-- SEC-038 + SEC-039 — Restringir RPCs públicas com risco similar ao SEC-037
-- ════════════════════════════════════════════════════════════════════════════
-- Descobertos na varredura pós-SEC-037 (25/05/2026): mais 2 RPCs com
-- perfil de risco perigoso. Padrão repetido = preocupante.
--
-- SEC-038 — `_notif_master_func_criou(empresa_id, ator_id, tipo, titulo, mensagem)`
--   - SECURITY DEFINER + EXECUTE PUBLIC
--   - INSERT direto em `notificacoes(titulo, mensagem, tipo)` sem sanitização
--   - Atacante com qualquer UUID de profile (ator_id) bypassa a checagem
--     `IF v_ator_role = 'master' THEN RETURN` passando um UUID não-master
--   - Pode forjar notif na bandeja do master com texto controlado (phishing)
--   - **Callers reais:** 2 triggers internos. Anon não precisa do grant.
--   - **Fix:** REVOKE EXECUTE FROM PUBLIC, anon
--
-- SEC-039 — `criar_evento_proposta(p_orcamento_id, p_tipo, p_dados)`
--   - SECURITY DEFINER + EXECUTE PUBLIC
--   - Aceita UUID de orçamento direto (sem share_token gatekeeper)
--   - Anon que descobre/adivinha UUID polui `proposta_eventos` com `tipo` e
--     `dados` jsonb arbitrários — pode esconder ação maliciosa em meio a noise
--     ou induzir alertas falsos
--   - **Callers reais:** `PropostaPublica.tsx:746,787` (fluxo público aprovar/recusar)
--   - **Fix:** refatorar pra exigir share_token + whitelist de p_tipo
--   - Frontend é atualizado em commit separado (passa p_token em vez de p_orcamento_id)
-- ════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ──────────────────────────────────────────────────────────────────────
-- SEC-038: REVOKE EXECUTE em _notif_master_func_criou
-- ──────────────────────────────────────────────────────────────────────
-- Triggers SECURITY DEFINER que chamam essa função NÃO precisam de grant
-- explícito (o owner da função tem privilégio inerente). REVOKE só remove
-- a porta aberta pra anon/authenticated chamar via REST.
REVOKE EXECUTE ON FUNCTION public._notif_master_func_criou(uuid, uuid, text, text, text)
  FROM PUBLIC, anon, authenticated;

-- ──────────────────────────────────────────────────────────────────────
-- SEC-039: Refatorar criar_evento_proposta pra usar share_token
-- ──────────────────────────────────────────────────────────────────────
-- Mudança de assinatura: p_orcamento_id (uuid) → p_token (text).
-- Whitelist de p_tipo previne injeção de eventos arbitrários.
-- Limita LENGTH de jsonb pra evitar abuse.

DROP FUNCTION IF EXISTS public.criar_evento_proposta(uuid, text, jsonb);

CREATE OR REPLACE FUNCTION public.criar_evento_proposta(
  p_token text,
  p_tipo text,
  p_dados jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_orc_id uuid;
  v_empresa_id uuid;
BEGIN
  -- Gatekeeper: exige share_token válido + proposta dentro do prazo
  SELECT id, empresa_id INTO v_orc_id, v_empresa_id
    FROM public.orcamentos
   WHERE share_token = p_token
     AND (data_expiracao IS NULL OR data_expiracao > NOW())
   LIMIT 1;

  IF v_orc_id IS NULL THEN
    -- Token inválido/expirado: silencioso (não revela existência)
    RETURN;
  END IF;

  -- Whitelist de tipos. Evita injeção de eventos arbitrários no histórico.
  IF p_tipo NOT IN ('aprovou', 'recusou', 'visualizou', 'selecionou', 'baixou_pdf') THEN
    RAISE EXCEPTION 'tipo inválido: %', p_tipo
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  -- Limite de tamanho do jsonb pra evitar abuse (1MB seria absurdo)
  IF length(p_dados::text) > 4000 THEN
    RAISE EXCEPTION 'dados muito grandes'
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  INSERT INTO public.proposta_eventos (orcamento_id, tipo, dados, empresa_id)
  VALUES (v_orc_id, p_tipo, p_dados, v_empresa_id);
END;
$function$;

COMMENT ON FUNCTION public.criar_evento_proposta(text, text, jsonb) IS
  'SEC-039 (25/05/2026): exige share_token + whitelist de tipos. '
  'Antes aceitava p_orcamento_id direto (anon podia adivinhar/descobrir UUID).';

-- Mantém EXECUTE PUBLIC: anon precisa chamar via fluxo público de aprovar/recusar
-- proposta. Defesa é o share_token gatekeeper + whitelist.
GRANT EXECUTE ON FUNCTION public.criar_evento_proposta(text, text, jsonb) TO anon, authenticated;

-- ──────────────────────────────────────────────────────────────────────
-- Notif master quando proposta vira 'recusado' (substitui chamada morta)
-- ──────────────────────────────────────────────────────────────────────
-- Antes de SEC-037, `PropostaPublica.handleRecusar` chamava
-- `criar_notificacao_proposta(...)` que era dropada hoje. Agora trigger
-- automática faz o INSERT em notificacoes quando status vira 'recusado'.
-- Vantagem: source of truth confiável (não depende do frontend chamar).

CREATE OR REPLACE FUNCTION public.tg_notif_master_proposta_recusada()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_motivo_short text;
BEGIN
  -- Só dispara quando vira 'recusado' (transição, não estado)
  IF NEW.status = 'recusado' AND (OLD.status IS NULL OR OLD.status <> 'recusado') THEN
    -- Limita motivo pra evitar payload absurdo na notif
    v_motivo_short := substring(COALESCE(NEW.observacoes_recusa, '(sem motivo informado)') from 1 for 200);

    INSERT INTO public.notificacoes (empresa_id, tipo, titulo, mensagem, orcamento_id)
    VALUES (
      NEW.empresa_id,
      'proposta',
      '🔴 Proposta recusada',
      COALESCE(NEW.prospect_nome, 'Cliente') || ' recusou a proposta #' ||
        LPAD(NEW.numero::text, 3, '0') || '. Motivo: ' || v_motivo_short,
      NEW.id
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notif_proposta_recusada ON public.orcamentos;
CREATE TRIGGER notif_proposta_recusada
  AFTER UPDATE OF status ON public.orcamentos
  FOR EACH ROW
  EXECUTE FUNCTION public.tg_notif_master_proposta_recusada();

-- ──────────────────────────────────────────────────────────────────────
-- Verificação
-- ──────────────────────────────────────────────────────────────────────
-- SEC-038: deve estar SEM grant pra PUBLIC/anon/authenticated
SELECT routine_name, grantee, privilege_type
  FROM information_schema.routine_privileges
 WHERE routine_schema = 'public'
   AND routine_name = '_notif_master_func_criou';

-- SEC-039: deve ter a nova assinatura (text, text, jsonb) — não mais uuid
SELECT proname, pg_get_function_arguments(oid) AS args
  FROM pg_proc
 WHERE pronamespace = 'public'::regnamespace
   AND proname = 'criar_evento_proposta';

COMMIT;

-- ════════════════════════════════════════════════════════════════════════════
-- ROLLBACK (se algo der errado):
-- ════════════════════════════════════════════════════════════════════════════
-- BEGIN;
-- -- SEC-038: re-grant (volta vulnerável)
-- GRANT EXECUTE ON FUNCTION public._notif_master_func_criou(uuid,uuid,text,text,text) TO PUBLIC;
-- -- SEC-039: volta versão antiga (sem share_token gatekeeper)
-- DROP FUNCTION public.criar_evento_proposta(text, text, jsonb);
-- CREATE OR REPLACE FUNCTION public.criar_evento_proposta(p_orcamento_id uuid, p_tipo text, p_dados jsonb DEFAULT '{}'::jsonb)
--   RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
-- DECLARE v_empresa_id uuid;
-- BEGIN
--   SELECT empresa_id INTO v_empresa_id FROM public.orcamentos WHERE id = p_orcamento_id;
--   IF v_empresa_id IS NULL THEN RETURN; END IF;
--   INSERT INTO public.proposta_eventos (orcamento_id, tipo, dados, empresa_id)
--   VALUES (p_orcamento_id, p_tipo, p_dados, v_empresa_id);
-- END $$;
-- COMMIT;
