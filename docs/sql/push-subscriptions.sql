-- push-subscriptions.sql
-- Tabela de subscriptions Web Push (1 row por dispositivo conectado).
-- iOS 16.4+ suporta push em PWA instalado via "Adicionar à Tela de Início" no Safari.

CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  endpoint text NOT NULL,
  keys_p256dh text NOT NULL,
  keys_auth text NOT NULL,
  device_label text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  last_used_at timestamptz NOT NULL DEFAULT NOW(),
  last_error_at timestamptz,
  error_count int NOT NULL DEFAULT 0,
  CONSTRAINT push_subscriptions_endpoint_unique UNIQUE (endpoint)
);

CREATE INDEX IF NOT EXISTS idx_push_sub_user ON public.push_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_push_sub_empresa ON public.push_subscriptions(empresa_id);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

-- User só vê/edita as próprias subscriptions
DROP POLICY IF EXISTS push_sub_select_own ON public.push_subscriptions;
CREATE POLICY push_sub_select_own ON public.push_subscriptions
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS push_sub_insert_own ON public.push_subscriptions;
CREATE POLICY push_sub_insert_own ON public.push_subscriptions
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND empresa_id = public.get_empresa_id());

DROP POLICY IF EXISTS push_sub_delete_own ON public.push_subscriptions;
CREATE POLICY push_sub_delete_own ON public.push_subscriptions
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- service_role (edge function) precisa SELECT+UPDATE+DELETE pra disparar push e limpar expirados
DROP POLICY IF EXISTS push_sub_service ON public.push_subscriptions;
CREATE POLICY push_sub_service ON public.push_subscriptions
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

COMMENT ON TABLE public.push_subscriptions IS 'Web Push subscriptions (1 por dispositivo). VAPID-encrypted.';
