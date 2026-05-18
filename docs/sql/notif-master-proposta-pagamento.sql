-- notif-master-proposta-pagamento.sql
-- Notificações pro MASTER em 4 momentos importantes:
--   1. Cliente paga uma cobrança (já existia trigger só notificando o cliente)
--   2. Cliente aprova uma proposta
--   3. Cliente recusa uma proposta
--   4. Cliente paga uma proposta (status='convertido')
--   5. Cliente ABRE o link da proposta pela primeira vez
--
-- As notificações criadas em `notificacoes` disparam push automaticamente via
-- trigger `notif_dispatch_push` (deployado em 18/05 manhã).

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. COBRANÇA PAGA — notif pro master (paralela à notif do cliente que já existe)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public._trg_notify_master_cobranca_paga()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_cliente_nome text;
BEGIN
  IF NEW.asaas_pago_em IS NOT NULL AND OLD.asaas_pago_em IS NULL THEN
    SELECT nome INTO v_cliente_nome FROM public.clientes WHERE id = NEW.cliente_id;
    INSERT INTO public.notificacoes (empresa_id, tipo, titulo, mensagem, destinatario_id)
    SELECT NEW.empresa_id, 'pagamento',
           '💰 Pagamento recebido',
           COALESCE(v_cliente_nome, 'Cliente') || ' pagou ' ||
             to_char(NEW.total_geral, 'FM"R$" 999G999G990D00'),
           p.id
    FROM public.profiles p
    WHERE p.empresa_id = NEW.empresa_id AND p.role = 'master';
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING '_trg_notify_master_cobranca_paga falhou: %', SQLERRM;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS notify_master_cobranca_paga ON public.cobrancas;
CREATE TRIGGER notify_master_cobranca_paga
  AFTER UPDATE OF asaas_pago_em ON public.cobrancas
  FOR EACH ROW EXECUTE FUNCTION public._trg_notify_master_cobranca_paga();

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. ORÇAMENTO MUDA DE STATUS — aprovado / recusado / pago
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public._trg_notify_master_orcamento_status()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_numero_fmt text;
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    v_numero_fmt := 'ORC-' || lpad(COALESCE(NEW.numero, 0)::text, 3, '0');

    IF NEW.status = 'aguardando_pagamento' AND OLD.status = 'enviado' THEN
      INSERT INTO public.notificacoes (empresa_id, tipo, titulo, mensagem, destinatario_id, orcamento_id)
      SELECT NEW.empresa_id, 'aprovacao',
             '✅ Proposta aprovada',
             COALESCE(NEW.prospect_nome, 'Cliente') || ' aprovou ' || v_numero_fmt,
             p.id, NEW.id
      FROM public.profiles p
      WHERE p.empresa_id = NEW.empresa_id AND p.role = 'master';

    ELSIF NEW.status = 'recusado' AND OLD.status IN ('enviado','aguardando_pagamento') THEN
      INSERT INTO public.notificacoes (empresa_id, tipo, titulo, mensagem, destinatario_id, orcamento_id)
      SELECT NEW.empresa_id, 'recusa',
             '❌ Proposta recusada',
             COALESCE(NEW.prospect_nome, 'Cliente') || ' recusou ' || v_numero_fmt ||
               COALESCE('. Motivo: ' || NEW.observacoes_recusa, ''),
             p.id, NEW.id
      FROM public.profiles p
      WHERE p.empresa_id = NEW.empresa_id AND p.role = 'master';

    ELSIF NEW.status = 'convertido' THEN
      INSERT INTO public.notificacoes (empresa_id, tipo, titulo, mensagem, destinatario_id, orcamento_id)
      SELECT NEW.empresa_id, 'pagamento',
             '💰 Proposta paga',
             COALESCE(NEW.prospect_nome, 'Cliente') || ' pagou ' || v_numero_fmt,
             p.id, NEW.id
      FROM public.profiles p
      WHERE p.empresa_id = NEW.empresa_id AND p.role = 'master';
    END IF;
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING '_trg_notify_master_orcamento_status falhou: %', SQLERRM;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS notify_master_orcamento_status ON public.orcamentos;
CREATE TRIGGER notify_master_orcamento_status
  AFTER UPDATE OF status ON public.orcamentos
  FOR EACH ROW EXECUTE FUNCTION public._trg_notify_master_orcamento_status();

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. PROPOSTA ABERTA — notif master na PRIMEIRA vez que cliente acessa o link
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.orcamentos ADD COLUMN IF NOT EXISTS notif_acesso_enviada_em timestamptz;

CREATE OR REPLACE FUNCTION public._notify_master_proposta_aberta(p_token text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_orc RECORD;
BEGIN
  SELECT id, numero, prospect_nome, empresa_id, notif_acesso_enviada_em
    INTO v_orc
    FROM public.orcamentos
   WHERE share_token = p_token;

  IF NOT FOUND OR v_orc.notif_acesso_enviada_em IS NOT NULL THEN
    RETURN;
  END IF;

  INSERT INTO public.notificacoes (empresa_id, tipo, titulo, mensagem, destinatario_id, orcamento_id)
  SELECT v_orc.empresa_id, 'assinatura',
         '👀 Proposta visualizada',
         COALESCE(v_orc.prospect_nome, 'Cliente') || ' abriu o link da ORC-' ||
           lpad(COALESCE(v_orc.numero, 0)::text, 3, '0'),
         p.id, v_orc.id
  FROM public.profiles p
  WHERE p.empresa_id = v_orc.empresa_id AND p.role = 'master';

  UPDATE public.orcamentos SET notif_acesso_enviada_em = NOW() WHERE id = v_orc.id;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING '_notify_master_proposta_aberta falhou: %', SQLERRM;
END $$;

-- Modifica get_proposta_por_token pra chamar a função de notif na 1a abertura
-- (mantém TODA a lógica original, só adiciona a linha do PERFORM)
CREATE OR REPLACE FUNCTION public.get_proposta_por_token(p_token text)
RETURNS TABLE(id uuid, numero integer, prospect_nome text, prospect_cnpj text, prospect_email text, prospect_telefone text, prospect_contato text, tipo_contrato text, servicos jsonb, naturezas jsonb, escopo jsonb, valor_base numeric, valor_final numeric, desconto_pct numeric, qtd_processos integer, status text, share_token text, created_at timestamp with time zone, updated_at timestamp with time zone, pdf_url text, observacoes text, validade_dias integer, pagamento text, sla text, prazo_execucao text, ordem_execucao text, contexto text, destinatario text, secoes jsonb, pacotes jsonb, etapas_fluxo jsonb, riscos jsonb, cenarios jsonb, cenario_selecionado text, headline_cenario text, beneficios_capa jsonb, desconto_progressivo_ativo boolean, desconto_progressivo_pct numeric, desconto_progressivo_limite numeric, aprovado_em timestamp with time zone, enviado_em timestamp with time zone, recusado_em timestamp with time zone, observacoes_recusa text, convertido_em timestamp with time zone, pago_em timestamp with time zone, contrato_assinado_url text, clicksign_document_key text, itens_selecionados jsonb, prazo_pagamento_dias integer, empresa_id uuid, cliente_id uuid, created_by text, has_password boolean)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  PERFORM public._log_acesso_publico('proposta', p_token);
  PERFORM public._notify_master_proposta_aberta(p_token);

  RETURN QUERY
  SELECT o.id, o.numero, o.prospect_nome, o.prospect_cnpj, o.prospect_email,
    o.prospect_telefone, o.prospect_contato, o.tipo_contrato, o.servicos,
    o.naturezas, o.escopo, o.valor_base, o.valor_final, o.desconto_pct,
    o.qtd_processos, o.status, o.share_token, o.created_at,
    o.updated_at, o.pdf_url, o.observacoes, o.validade_dias,
    o.pagamento, o.sla, o.prazo_execucao, o.ordem_execucao, o.contexto,
    o.destinatario, o.secoes, o.pacotes, o.etapas_fluxo, o.riscos,
    o.cenarios, o.cenario_selecionado, o.headline_cenario, o.beneficios_capa,
    o.desconto_progressivo_ativo, o.desconto_progressivo_pct,
    o.desconto_progressivo_limite, o.aprovado_em, o.enviado_em,
    o.recusado_em, o.observacoes_recusa, o.convertido_em,
    o.pago_em, o.contrato_assinado_url,
    o.clicksign_document_key, o.itens_selecionados,
    o.prazo_pagamento_dias, o.empresa_id, o.cliente_id, o.created_by,
    (o.senha_link IS NOT NULL AND o.senha_link <> '') AS has_password
  FROM public.orcamentos o
  WHERE o.share_token = p_token
    AND o.status IN ('enviado', 'aguardando_pagamento', 'convertido')
    AND (o.data_expiracao IS NULL OR o.data_expiracao > NOW());
END;
$function$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. BACKFILL — notif pra Thales sobre a cobrança da Sheila que rolou hoje
--    (trigger foi criada AGORA, então o pagamento de mais cedo não disparou)
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO public.notificacoes (empresa_id, tipo, titulo, mensagem, destinatario_id)
SELECT cb.empresa_id, 'pagamento',
       '💰 Pagamento recebido',
       'SHEILA GUIRADO DOS SANTOS pagou ' || to_char(cb.total_geral, 'FM"R$" 999G999G990D00') || ' (backfill)',
       p.id
FROM public.cobrancas cb
JOIN public.profiles p ON p.empresa_id = cb.empresa_id AND p.role = 'master'
WHERE cb.id = 'a55ff5b3-7fe8-42f7-a8f8-ba184055814b';
