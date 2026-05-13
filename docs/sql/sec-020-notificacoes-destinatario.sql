-- =============================================
-- SEC-020 (13/05/2026): destinatario_id em notificacoes (per-user)
-- =============================================
-- Resolve a raiz do SEC-019: hoje notificacoes tem so empresa_id, entao
-- RLS + filtro realtime entregam o payload pra todo authenticated da
-- empresa. Filtro client-side (canSeeNotificacao) eh so cosmetico.
--
-- Com destinatario_id:
--   - NULL = broadcast pra toda a empresa (mantem compat — uso atual)
--   - X    = notif direta soh pro user X
--
-- canSeeNotificacao client respeita destinatario_id quando nao-NULL.
-- Insert points (login_novo, aprovacao novo usuario, etc) passam a
-- preencher destinatario_id apontando pro master ativo da empresa.
-- =============================================

-- Coluna nova: NULLABLE pra manter compat com notifs existentes.
ALTER TABLE public.notificacoes
  ADD COLUMN IF NOT EXISTS destinatario_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_notificacoes_destinatario_id
  ON public.notificacoes(destinatario_id) WHERE destinatario_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_notificacoes_empresa_recent
  ON public.notificacoes(empresa_id, created_at DESC);

-- Helper: pega o user_id do master ATIVO da empresa. Usado em inserts
-- de notificacao direcionada (login_novo, aprovacao usuario, etc).
CREATE OR REPLACE FUNCTION public.get_empresa_master_id(p_empresa_id uuid)
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $function$
  SELECT id FROM public.profiles
   WHERE empresa_id = p_empresa_id
     AND role = 'master'
     AND ativo = true
   ORDER BY created_at ASC
   LIMIT 1;
$function$;

REVOKE EXECUTE ON FUNCTION public.get_empresa_master_id(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_empresa_master_id(uuid) TO authenticated, service_role;

-- =============================================
-- PARTE 2: RLS update (defesa em profundidade)
-- =============================================
-- A policy SELECT existente filtra so por empresa_id. Vamos APERTAR:
-- se a notif tem destinatario_id NAO NULL, soh o destinatario ve.
-- Quando NULL, segue como broadcast (qualquer da empresa ve — mas o
-- filtro client-side canSeeNotificacao decide se aparece).

DROP POLICY IF EXISTS notificacoes_select ON public.notificacoes;
CREATE POLICY notificacoes_select ON public.notificacoes
  FOR SELECT USING (
    empresa_id = public.get_empresa_id()
    AND (destinatario_id IS NULL OR destinatario_id = auth.uid())
  );

DROP POLICY IF EXISTS notificacoes_update ON public.notificacoes;
CREATE POLICY notificacoes_update ON public.notificacoes
  FOR UPDATE USING (
    empresa_id = public.get_empresa_id()
    AND (destinatario_id IS NULL OR destinatario_id = auth.uid())
  );

-- Insert e Delete mantem comportamento anterior

-- =============================================
-- PARTE 3: backfill — direcionar notificacoes existentes que eram "soh master"
-- =============================================
-- Pra "Novo usuário aguardando aprovacao" (tipo='aprovacao' sem orcamento_id)
-- e login_novo (tipo='login_novo') — direcionamos pro master da empresa.

UPDATE public.notificacoes n
   SET destinatario_id = public.get_empresa_master_id(n.empresa_id)
 WHERE destinatario_id IS NULL
   AND (
     (n.tipo = 'aprovacao' AND n.orcamento_id IS NULL)
     OR n.tipo = 'login_novo'
   )
   AND n.empresa_id IS NOT NULL;
