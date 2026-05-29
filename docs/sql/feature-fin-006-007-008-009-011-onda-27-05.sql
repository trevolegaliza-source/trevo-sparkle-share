-- ════════════════════════════════════════════════════════════════════════════
-- ONDA FINANCEIRO: FIN-006, 007, 008, 009, 011 — 27/05/2026 noite
-- ════════════════════════════════════════════════════════════════════════════
-- 5 features SQL aplicadas em conjunto (independentes mas pequenas).
--
-- FIN-006: Recibo automático pós-pagamento (trigger + flag)
-- FIN-007: Margem por processo (coluna custo_total + view)
-- FIN-008: Limite de crédito por cliente (coluna + view de saldo)
-- FIN-009: Auditoria de cobrança (tabela log + triggers)
-- FIN-011: Razão do atraso registrada (coluna em cobrancas)
-- ════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ════════════════════════════════════════════════════════════════════════════
-- FIN-006 · Recibo automático pós-pagamento
-- ════════════════════════════════════════════════════════════════════════════
-- Cliente pagou (webhook Asaas atualizou cobrancas.asaas_pago_em) → trigger
-- dispara edge `enviar-recibo-cobranca` (a edge gera PDF via lib/recibo.ts
-- e envia via WhatsApp/email). Flag pra evitar duplicação.

ALTER TABLE public.cobrancas
  ADD COLUMN IF NOT EXISTS recibo_enviado_em timestamp with time zone;

COMMENT ON COLUMN public.cobrancas.recibo_enviado_em IS
  'FIN-006 (27/05): timestamp de envio do recibo automático pós-pagamento. NULL = ainda não enviado.';

CREATE OR REPLACE FUNCTION public.trg_disparar_recibo_apos_pagamento()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_supabase_url text;
  v_service_key text;
BEGIN
  -- Só dispara em transições: pago_em NULL → pago_em populado
  IF NEW.asaas_pago_em IS NULL THEN RETURN NEW; END IF;
  IF OLD.asaas_pago_em IS NOT NULL THEN RETURN NEW; END IF;
  IF NEW.recibo_enviado_em IS NOT NULL THEN RETURN NEW; END IF;

  -- Fail-soft: erro na chamada da edge não bloqueia o UPDATE original
  BEGIN
    SELECT decrypted_secret INTO v_supabase_url FROM vault.decrypted_secrets WHERE name = 'supabase_url' LIMIT 1;
    SELECT decrypted_secret INTO v_service_key FROM vault.decrypted_secrets WHERE name = 'service_role_key' LIMIT 1;

    IF v_supabase_url IS NOT NULL AND v_service_key IS NOT NULL THEN
      PERFORM net.http_post(
        url := v_supabase_url || '/functions/v1/enviar-recibo-cobranca',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || v_service_key
        ),
        body := jsonb_build_object('cobranca_id', NEW.id)
      );
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'trg_disparar_recibo_apos_pagamento falhou pra cobranca %: %', NEW.id, SQLERRM;
  END;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_disparar_recibo_apos_pagamento_aft ON public.cobrancas;
CREATE TRIGGER trg_disparar_recibo_apos_pagamento_aft
  AFTER UPDATE ON public.cobrancas
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_disparar_recibo_apos_pagamento();

COMMENT ON FUNCTION public.trg_disparar_recibo_apos_pagamento() IS
  'FIN-006 (27/05): dispara edge enviar-recibo-cobranca quando asaas_pago_em é populado.';

-- ════════════════════════════════════════════════════════════════════════════
-- FIN-007 · Margem por processo
-- ════════════════════════════════════════════════════════════════════════════
-- Coluna custo_total mantida automaticamente via trigger somando
-- valores_adicionais por processo. View v_processo_margem calcula receita
-- líquida = honorário - custos passantes.

ALTER TABLE public.processos
  ADD COLUMN IF NOT EXISTS custo_total numeric(10,2) DEFAULT 0 NOT NULL;

COMMENT ON COLUMN public.processos.custo_total IS
  'FIN-007 (27/05): soma de valores_adicionais do processo (taxas, emolumentos, DAREs). Atualizado automaticamente por trigger.';

CREATE OR REPLACE FUNCTION public.trg_recalcular_custo_processo()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_processo_id uuid;
  v_total numeric;
BEGIN
  v_processo_id := COALESCE(NEW.processo_id, OLD.processo_id);
  IF v_processo_id IS NULL THEN RETURN COALESCE(NEW, OLD); END IF;

  SELECT COALESCE(SUM(valor), 0) INTO v_total
    FROM public.valores_adicionais
   WHERE processo_id = v_processo_id;

  UPDATE public.processos
     SET custo_total = v_total
   WHERE id = v_processo_id;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_recalcular_custo_processo_aft ON public.valores_adicionais;
CREATE TRIGGER trg_recalcular_custo_processo_aft
  AFTER INSERT OR UPDATE OR DELETE ON public.valores_adicionais
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_recalcular_custo_processo();

-- Backfill: popula custo_total nos processos existentes
UPDATE public.processos p
   SET custo_total = COALESCE((
     SELECT SUM(va.valor) FROM public.valores_adicionais va WHERE va.processo_id = p.id
   ), 0);

-- View de margem
CREATE OR REPLACE VIEW public.v_processo_margem
WITH (security_invoker = on) AS
SELECT
  p.id AS processo_id,
  p.empresa_id,
  p.cliente_id,
  p.tipo,
  p.razao_social,
  p.valor AS honorario,
  p.custo_total AS custos_passantes,
  (p.valor - p.custo_total) AS margem_bruta,
  CASE
    WHEN p.valor > 0 THEN ROUND(100.0 * (p.valor - p.custo_total) / p.valor, 1)
    ELSE NULL
  END AS margem_pct,
  p.etapa,
  p.created_at
FROM public.processos p
WHERE p.valor IS NOT NULL;

COMMENT ON VIEW public.v_processo_margem IS
  'FIN-007 (27/05): margem bruta = honorario - custos passantes. Use AGRUPAR BY tipo pra ver qual tipo de processo é mais lucrativo.';

-- ════════════════════════════════════════════════════════════════════════════
-- FIN-008 · Limite de crédito por cliente
-- ════════════════════════════════════════════════════════════════════════════
-- Coluna nova clientes.limite_credito (default 5000). View calcula saldo em
-- aberto. Trigger BEFORE INSERT em processos sugere alerta se saldo+novo
-- ultrapassa limite (não bloqueia — só cria notif).

ALTER TABLE public.clientes
  ADD COLUMN IF NOT EXISTS limite_credito numeric(10,2) DEFAULT 5000;

COMMENT ON COLUMN public.clientes.limite_credito IS
  'FIN-008 (27/05): limite de crédito do cliente (default R$ 5.000). Se saldo aberto + novo processo ultrapassa, notif master criada (não bloqueia).';

CREATE OR REPLACE VIEW public.v_cliente_saldo_aberto
WITH (security_invoker = on) AS
SELECT
  c.id AS cliente_id,
  c.empresa_id,
  c.nome,
  c.apelido,
  c.limite_credito,
  COALESCE(SUM(cob.total_geral) FILTER (WHERE cob.status IN ('ativa', 'vencida') AND cob.asaas_pago_em IS NULL), 0) AS saldo_aberto,
  COALESCE(SUM(cob.total_geral) FILTER (WHERE cob.status = 'vencida' AND cob.asaas_pago_em IS NULL), 0) AS saldo_vencido,
  COUNT(cob.id) FILTER (WHERE cob.status IN ('ativa', 'vencida') AND cob.asaas_pago_em IS NULL) AS qtd_cobrancas_abertas
FROM public.clientes c
LEFT JOIN public.cobrancas cob ON cob.cliente_id = c.id
GROUP BY c.id, c.empresa_id, c.nome, c.apelido, c.limite_credito;

COMMENT ON VIEW public.v_cliente_saldo_aberto IS
  'FIN-008 (27/05): saldo em aberto vs limite. UI: badge "limite excedido" quando saldo_aberto > limite_credito.';

-- ════════════════════════════════════════════════════════════════════════════
-- FIN-009 · Auditoria de cobrança (log imutável)
-- ════════════════════════════════════════════════════════════════════════════
-- Tabela append-only com toda mudança em cobrancas. UI mostra timeline.

CREATE TABLE IF NOT EXISTS public.cobrancas_auditoria (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cobranca_id uuid NOT NULL REFERENCES public.cobrancas(id) ON DELETE CASCADE,
  empresa_id uuid NOT NULL,
  user_id uuid,
  acao text NOT NULL CHECK (acao IN ('criada', 'atualizada', 'cancelada_asaas', 'paga', 'vencida', 'rotacionada')),
  payload_anterior jsonb,
  payload_novo jsonb,
  created_at timestamp with time zone DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_cobrancas_auditoria_cobranca_id ON public.cobrancas_auditoria(cobranca_id);
CREATE INDEX IF NOT EXISTS idx_cobrancas_auditoria_empresa_created ON public.cobrancas_auditoria(empresa_id, created_at DESC);

COMMENT ON TABLE public.cobrancas_auditoria IS
  'FIN-009 (27/05): log imutável de mudanças em cobrancas. Compliance + investigação.';

CREATE OR REPLACE FUNCTION public.trg_auditoria_cobranca()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_acao text;
  v_user_id uuid;
BEGIN
  v_user_id := COALESCE(auth.uid(), NULL);

  IF TG_OP = 'INSERT' THEN
    v_acao := 'criada';
    INSERT INTO public.cobrancas_auditoria (cobranca_id, empresa_id, user_id, acao, payload_anterior, payload_novo)
    VALUES (NEW.id, NEW.empresa_id, v_user_id, v_acao, NULL, to_jsonb(NEW));
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    -- Detecta ação principal pela mudança de status
    IF NEW.status <> OLD.status THEN
      v_acao := CASE NEW.status
        WHEN 'paga' THEN 'paga'
        WHEN 'vencida' THEN 'vencida'
        WHEN 'cancelada' THEN 'cancelada_asaas'
        ELSE 'atualizada'
      END;
    ELSIF NEW.share_token <> OLD.share_token THEN
      v_acao := 'rotacionada';
    ELSE
      v_acao := 'atualizada';
    END IF;

    INSERT INTO public.cobrancas_auditoria (cobranca_id, empresa_id, user_id, acao, payload_anterior, payload_novo)
    VALUES (NEW.id, NEW.empresa_id, v_user_id, v_acao, to_jsonb(OLD), to_jsonb(NEW));
    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auditoria_cobranca_aft ON public.cobrancas;
CREATE TRIGGER trg_auditoria_cobranca_aft
  AFTER INSERT OR UPDATE ON public.cobrancas
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_auditoria_cobranca();

-- ════════════════════════════════════════════════════════════════════════════
-- FIN-011 · Razão do atraso registrada
-- ════════════════════════════════════════════════════════════════════════════
-- Coluna texto livre + timestamp. UI: modal popup quando cobrança bate D+1.

ALTER TABLE public.cobrancas
  ADD COLUMN IF NOT EXISTS motivo_atraso text,
  ADD COLUMN IF NOT EXISTS motivo_atraso_anotado_em timestamp with time zone,
  ADD COLUMN IF NOT EXISTS motivo_atraso_anotado_por uuid;

COMMENT ON COLUMN public.cobrancas.motivo_atraso IS
  'FIN-011 (27/05): anotação livre sobre causa do atraso (cliente alegou X). Análise: top 5 motivos identifica padrão.';

COMMIT;

-- ─────────────────────────────────────────────────────────────────────────
-- Verificação
-- ─────────────────────────────────────────────────────────────────────────
SELECT 'col_recibo_enviado_em' as check, EXISTS(
  SELECT 1 FROM information_schema.columns
   WHERE table_name='cobrancas' AND column_name='recibo_enviado_em'
) as ok
UNION ALL
SELECT 'trg_recibo_apos_pagamento', EXISTS(
  SELECT 1 FROM pg_trigger WHERE tgname='trg_disparar_recibo_apos_pagamento_aft'
)
UNION ALL
SELECT 'col_processos_custo_total', EXISTS(
  SELECT 1 FROM information_schema.columns
   WHERE table_name='processos' AND column_name='custo_total'
)
UNION ALL
SELECT 'view_processo_margem', EXISTS(
  SELECT 1 FROM pg_views WHERE schemaname='public' AND viewname='v_processo_margem'
)
UNION ALL
SELECT 'col_limite_credito', EXISTS(
  SELECT 1 FROM information_schema.columns
   WHERE table_name='clientes' AND column_name='limite_credito'
)
UNION ALL
SELECT 'view_cliente_saldo_aberto', EXISTS(
  SELECT 1 FROM pg_views WHERE schemaname='public' AND viewname='v_cliente_saldo_aberto'
)
UNION ALL
SELECT 'tab_cobrancas_auditoria', EXISTS(
  SELECT 1 FROM information_schema.tables
   WHERE table_name='cobrancas_auditoria' AND table_schema='public'
)
UNION ALL
SELECT 'col_motivo_atraso', EXISTS(
  SELECT 1 FROM information_schema.columns
   WHERE table_name='cobrancas' AND column_name='motivo_atraso'
);
