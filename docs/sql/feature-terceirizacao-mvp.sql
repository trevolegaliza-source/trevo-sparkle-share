-- ════════════════════════════════════════════════════════════════════════════
-- Feature: Orçamento de Terceirização (MVP — Fase 1)
-- ════════════════════════════════════════════════════════════════════════════
-- Reusa a tabela `orcamentos` adicionando um campo `tipo_proposta` que
-- diferencia o orçamento clássico de serviço pontual (atual) do novo fluxo
-- de TERCEIRIZAÇÃO do departamento societário (proposta comercial inicial).
--
-- Substitui o app.web do Apps Script (com PDFShift + Drive) por um fluxo
-- nativo do ERP: configurador interativo → link público HTML → cliente
-- aprova → (fase 2) PDF gerado → (fase 3) ClickSign.
--
-- Por que estender `orcamentos` em vez de criar tabela nova:
-- - Reusa share_token, senha_link, status, data_expiracao, log_acesso_publico
-- - Reusa todo o sistema de notif (proposta enviada/aberta/aprovada)
-- - Reusa RPCs públicas (get_proposta_por_token, etc) com filtro por tipo
-- - Reduz superfície de bug e duplicação
--
-- Campos com prefixo `terc_` são exclusivos do tipo='terceirizacao'.
-- Quando tipo='servico_pontual' (default), todos esses campos ficam NULL.
-- ════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ──────────────────────────────────────────────────────────────────────
-- 1. Discriminator: tipo_proposta
-- ──────────────────────────────────────────────────────────────────────
ALTER TABLE public.orcamentos
  ADD COLUMN IF NOT EXISTS tipo_proposta text
    NOT NULL DEFAULT 'servico_pontual'
    CHECK (tipo_proposta IN ('servico_pontual', 'terceirizacao'));

CREATE INDEX IF NOT EXISTS orcamentos_tipo_proposta_idx
  ON public.orcamentos (tipo_proposta)
  WHERE tipo_proposta = 'terceirizacao';

COMMENT ON COLUMN public.orcamentos.tipo_proposta IS
  'servico_pontual = orçamento clássico de processo único (abertura, alteração, etc). '
  'terceirizacao = proposta comercial de departamento societário terceirizado (MVP 25/05/2026).';

-- ──────────────────────────────────────────────────────────────────────
-- 2. Campos específicos de Terceirização
-- ──────────────────────────────────────────────────────────────────────
ALTER TABLE public.orcamentos
  -- Modalidade comercial
  ADD COLUMN IF NOT EXISTS terc_modalidade text
    CHECK (terc_modalidade IN ('avulso', 'pro_5', 'enterprise_10', 'custom')),

  -- Escopo (chips on/off na UI)
  ADD COLUMN IF NOT EXISTS terc_servicos jsonb,   -- ['abertura','alteracao','baixa','transformacao','cisao','fusao','incorporacao','marcas_patentes']
  ADD COLUMN IF NOT EXISTS terc_naturezas jsonb,  -- ['ltda','slu','mei','ei','sa','fundacao','osc','consorcio']
  ADD COLUMN IF NOT EXISTS terc_inclusos jsonb,   -- ['plataforma','peticionamento','minuta_padrao','minuta_propria','acompanhamento','viabilidade','dbe','registro','mat','inscricao_mun_est','alvaras','conselho_classe']

  -- Preços calculados (snapshot no momento do envio — não recalcula depois)
  ADD COLUMN IF NOT EXISTS terc_valor_base numeric,         -- R$ por processo avulso (ex 580)
  ADD COLUMN IF NOT EXISTS terc_valor_pro numeric,          -- R$/un no plano PRO (ex 493)
  ADD COLUMN IF NOT EXISTS terc_valor_enterprise numeric,   -- R$/un no plano ENTERPRISE (ex 464)

  -- Volume customizado (se modalidade='custom')
  ADD COLUMN IF NOT EXISTS terc_volume_custom int,
  ADD COLUMN IF NOT EXISTS terc_desconto_custom numeric,

  -- Vinculação contratual (ClickSign — preenche na Fase 3)
  ADD COLUMN IF NOT EXISTS terc_clicksign_status text
    CHECK (terc_clicksign_status IN ('nao_enviado','enviado','assinado','recusado','cancelado')),
  ADD COLUMN IF NOT EXISTS terc_clicksign_signed_url text,
  ADD COLUMN IF NOT EXISTS terc_pdf_url text,               -- URL do PDF gerado (Fase 2)

  -- Conversão pós-aceite (Fase 4)
  ADD COLUMN IF NOT EXISTS terc_cliente_id_convertido uuid REFERENCES public.clientes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS terc_aceito_em timestamptz;

-- ──────────────────────────────────────────────────────────────────────
-- 3. Atualizar RPCs públicas pra aceitar status novos da terceirização
-- ──────────────────────────────────────────────────────────────────────
-- O status existente em orcamentos passa a comportar:
--   - 'enviado', 'aceito', 'recusado', 'expirado' (já existia pra serviço pontual)
--   - 'aguardando_assinatura' (NOVO — Fase 3 ClickSign)
--   - 'assinado' (NOVO — Fase 3)
-- Mas pra Fase 1 (MVP), só status existentes bastam.

-- ──────────────────────────────────────────────────────────────────────
-- 4. RLS: não muda (orcamentos já tem RLS por empresa)
-- ──────────────────────────────────────────────────────────────────────

-- ──────────────────────────────────────────────────────────────────────
-- 5. RPC pública de aceite (chamada pelo cliente final via link público)
-- ──────────────────────────────────────────────────────────────────────
-- Gatekeeper: share_token (mesmo padrão SEC-039). Tipo='terceirizacao'.
-- Status muda pra 'aceito' + trigger notifica master.
-- Pra Fase 2+3: este RPC vai disparar geração de PDF + envio ClickSign.

CREATE OR REPLACE FUNCTION public.aceitar_proposta_terceirizacao(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_orc RECORD;
BEGIN
  PERFORM public._log_acesso_publico('proposta_aceite', p_token);

  -- Resolve por share_token + tipo correto + status ainda 'enviado'
  SELECT id, status, tipo_proposta, prospect_nome, empresa_id
    INTO v_orc
    FROM public.orcamentos
   WHERE share_token = p_token
     AND tipo_proposta = 'terceirizacao'
     AND status IN ('enviado', 'aguardando_pagamento')
     AND (data_expiracao IS NULL OR data_expiracao > NOW())
   LIMIT 1;

  IF v_orc.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND_OR_INVALID');
  END IF;

  -- Atualiza status + timestamp de aceite
  UPDATE public.orcamentos
     SET status = 'aceito',
         terc_aceito_em = NOW()
   WHERE id = v_orc.id;

  -- Notif master (proposta de terceirização aceita)
  INSERT INTO public.notificacoes (empresa_id, tipo, titulo, mensagem, orcamento_id)
  VALUES (
    v_orc.empresa_id,
    'proposta',
    '🍀 Proposta de Terceirização ACEITA',
    COALESCE(v_orc.prospect_nome, 'Cliente') || ' aceitou a proposta. Próximo passo: enviar contrato pra assinatura.',
    v_orc.id
  );

  RETURN jsonb_build_object('ok', true, 'orcamento_id', v_orc.id, 'status', 'aceito');
END;
$function$;

GRANT EXECUTE ON FUNCTION public.aceitar_proposta_terceirizacao(text) TO anon, authenticated;

COMMENT ON FUNCTION public.aceitar_proposta_terceirizacao(text) IS
  'MVP Terceirização: cliente aceita via link público. Muda status + notifica master. '
  'Fase 2+3: disparará geração de PDF + envio ClickSign automaticamente.';

-- ──────────────────────────────────────────────────────────────────────
-- 6. Atualizar get_proposta_por_token pra retornar campos terc_*
-- ──────────────────────────────────────────────────────────────────────
-- Adicionar tipo_proposta + 9 campos terc_* à assinatura da RPC.
-- Mantém compatibilidade com fluxo clássico (campos novos = NULL pra serviço pontual).

DROP FUNCTION IF EXISTS public.get_proposta_por_token(text);
DROP FUNCTION IF EXISTS public.get_proposta_por_token(text, text);

CREATE OR REPLACE FUNCTION public.get_proposta_por_token(p_token text, p_senha text DEFAULT '')
RETURNS TABLE(
  id uuid, numero integer, prospect_nome text, prospect_cnpj text, prospect_email text,
  prospect_telefone text, prospect_contato text, tipo_contrato text, servicos jsonb,
  naturezas jsonb, escopo jsonb, valor_base numeric, valor_final numeric, desconto_pct numeric,
  qtd_processos integer, status text, share_token text, created_at timestamp with time zone,
  updated_at timestamp with time zone, pdf_url text, observacoes text, validade_dias integer,
  pagamento text, sla text, prazo_execucao text, ordem_execucao text, contexto text,
  destinatario text, secoes jsonb, pacotes jsonb, etapas_fluxo jsonb, riscos jsonb,
  cenarios jsonb, cenario_selecionado text, headline_cenario text, beneficios_capa jsonb,
  desconto_progressivo_ativo boolean, desconto_progressivo_pct numeric,
  desconto_progressivo_limite numeric, aprovado_em timestamp with time zone,
  enviado_em timestamp with time zone, recusado_em timestamp with time zone,
  observacoes_recusa text, convertido_em timestamp with time zone,
  pago_em timestamp with time zone, contrato_assinado_url text,
  clicksign_document_key text, itens_selecionados jsonb,
  prazo_pagamento_dias integer, empresa_id uuid, cliente_id uuid, created_by text,
  has_password boolean,
  -- NOVOS — Terceirização
  tipo_proposta text,
  terc_modalidade text,
  terc_servicos jsonb,
  terc_naturezas jsonb,
  terc_inclusos jsonb,
  terc_valor_base numeric,
  terc_valor_pro numeric,
  terc_valor_enterprise numeric,
  terc_clicksign_status text,
  terc_pdf_url text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_senha_real text;
BEGIN
  PERFORM public._log_acesso_publico('proposta', p_token);

  SELECT senha_link INTO v_senha_real
    FROM public.orcamentos
   WHERE share_token = p_token
     AND status IN ('enviado', 'aguardando_pagamento', 'convertido', 'aceito')
     AND (data_expiracao IS NULL OR data_expiracao > NOW())
   LIMIT 1;

  IF v_senha_real IS NOT NULL AND v_senha_real <> '' AND v_senha_real <> COALESCE(p_senha, '') THEN
    RETURN;
  END IF;

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
    (o.senha_link IS NOT NULL AND o.senha_link <> '') AS has_password,
    o.tipo_proposta,
    o.terc_modalidade,
    o.terc_servicos,
    o.terc_naturezas,
    o.terc_inclusos,
    o.terc_valor_base,
    o.terc_valor_pro,
    o.terc_valor_enterprise,
    o.terc_clicksign_status,
    o.terc_pdf_url
  FROM public.orcamentos o
  WHERE o.share_token = p_token
    AND o.status IN ('enviado', 'aguardando_pagamento', 'convertido', 'aceito')
    AND (o.data_expiracao IS NULL OR o.data_expiracao > NOW());
END;
$function$;

GRANT EXECUTE ON FUNCTION public.get_proposta_por_token(text, text) TO anon, authenticated;

-- Atualizar minima pra retornar tipo_proposta (frontend decide o layout antes mesmo da senha)
DROP FUNCTION IF EXISTS public.get_proposta_publica_minima(text);

CREATE OR REPLACE FUNCTION public.get_proposta_publica_minima(p_token text)
RETURNS TABLE(
  numero integer,
  status text,
  has_password boolean,
  escritorio_nome text,
  validade_dias integer,
  created_at timestamp with time zone,
  data_expiracao timestamp with time zone,
  tipo_proposta text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  PERFORM public._log_acesso_publico('proposta_min', p_token);

  RETURN QUERY
  SELECT o.numero,
         o.status,
         (o.senha_link IS NOT NULL AND o.senha_link <> '') AS has_password,
         COALESCE(ec.nome_fantasia, ec.razao_social, 'Trevo Legaliza') AS escritorio_nome,
         o.validade_dias,
         o.created_at,
         o.data_expiracao,
         o.tipo_proposta
    FROM public.orcamentos o
    LEFT JOIN public.empresas_config ec ON ec.empresa_id = o.empresa_id
   WHERE o.share_token = p_token
     AND o.status IN ('enviado', 'aguardando_pagamento', 'convertido', 'aceito')
     AND (o.data_expiracao IS NULL OR o.data_expiracao > NOW());
END;
$function$;

GRANT EXECUTE ON FUNCTION public.get_proposta_publica_minima(text) TO anon, authenticated;

-- ──────────────────────────────────────────────────────────────────────
-- 7. Verificação
-- ──────────────────────────────────────────────────────────────────────
SELECT column_name, data_type, is_nullable
  FROM information_schema.columns
 WHERE table_schema='public' AND table_name='orcamentos'
   AND (column_name LIKE 'terc_%' OR column_name='tipo_proposta')
 ORDER BY column_name;

-- ──────────────────────────────────────────────────────────────────────
-- 8. Tarefa-mãe na lista de tarefas (rastreio do MVP)
-- ──────────────────────────────────────────────────────────────────────
INSERT INTO public.tarefas (empresa_id, titulo, descricao, categoria, prioridade, origem, arquivo_md, achado_id)
SELECT empresa_id,
  '🍀 Feature Terceirização — testar MVP Fase 1',
  'Implementado em 25/05/2026. Fluxo: criar orçamento → toggle "Terceirização" → configurar escopo (chips ON/OFF + recálculo ao vivo) → enviar → cliente vê link público → aceita.

TESTES:
1. Criar nova proposta, escolher "Terceirização" no toggle
2. Preencher dados + selecionar serviços/naturezas/inclusos
3. Verificar recálculo de valor em tempo real (3 preview cards)
4. Salvar como rascunho (autosave 5s)
5. Enviar proposta — pega share_token automaticamente
6. Abrir link público — deve renderizar layout custom (3 seções: capa, anexos, condições)
7. Clicar "Aceitar proposta" — status muda pra aceito, master recebe notif

PRÓXIMAS FASES:
- Fase 2 (~2h): gerar PDF unificado (MSA + Anexo I) no aceite
- Fase 3 (~3h): integração ClickSign automática
- Fase 4 (~2h): conversão auto pós-aceite (cria cliente + cobrança)',
  'teste', 'alta', 'claude',
  'docs/sql/feature-terceirizacao-mvp.sql', 'TERC-MVP-F1'
FROM public.empresas_config LIMIT 1;

COMMIT;

-- ════════════════════════════════════════════════════════════════════════════
-- ROLLBACK (caso precise reverter):
-- ════════════════════════════════════════════════════════════════════════════
-- BEGIN;
-- ALTER TABLE public.orcamentos
--   DROP COLUMN IF EXISTS terc_modalidade,
--   DROP COLUMN IF EXISTS terc_servicos,
--   DROP COLUMN IF EXISTS terc_naturezas,
--   DROP COLUMN IF EXISTS terc_inclusos,
--   DROP COLUMN IF EXISTS terc_valor_base,
--   DROP COLUMN IF EXISTS terc_valor_pro,
--   DROP COLUMN IF EXISTS terc_valor_enterprise,
--   DROP COLUMN IF EXISTS terc_volume_custom,
--   DROP COLUMN IF EXISTS terc_desconto_custom,
--   DROP COLUMN IF EXISTS terc_clicksign_status,
--   DROP COLUMN IF EXISTS terc_clicksign_signed_url,
--   DROP COLUMN IF EXISTS terc_pdf_url,
--   DROP COLUMN IF EXISTS terc_cliente_id_convertido,
--   DROP COLUMN IF EXISTS terc_aceito_em,
--   DROP COLUMN IF EXISTS tipo_proposta;
-- DROP INDEX IF EXISTS orcamentos_tipo_proposta_idx;
-- COMMIT;
