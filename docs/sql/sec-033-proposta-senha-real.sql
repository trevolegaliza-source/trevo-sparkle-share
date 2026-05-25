-- ════════════════════════════════════════════════════════════════════════════
-- SEC-033 — Senha de proposta vira proteção real (não só visual)
-- ════════════════════════════════════════════════════════════════════════════
-- Antes: `get_proposta_por_token(token)` retornava 40+ campos (valor_final,
-- prospect_cnpj, servicos, etc) + boolean `has_password`. Frontend só pulava
-- pra tela de senha SE has_password=true, mas os dados já estavam em
-- memória do navegador. Atacante via DevTools/curl com share_token público
-- (compartilhado por WhatsApp) acessava TUDO sem digitar senha.
--
-- Agora:
--   1. Nova RPC `get_proposta_publica_minima(p_token)` retorna SÓ
--      `has_password + numero + escritorio_nome + status`. Sem dados
--      sensíveis. Usada pra decidir "mostrar tela de senha ou seguir direto".
--   2. `get_proposta_por_token` aceita parâmetro `p_senha` (default ''):
--      se proposta tem senha cadastrada e p_senha não bate, retorna 0 rows.
--      Senão (sem senha ou senha correta) retorna tudo como antes.
--   3. Frontend chama minima primeiro; se has_password=true, exige senha
--      antes de chamar a completa.
--
-- Compatibilidade: chamadas existentes a `get_proposta_por_token(p_token)`
-- continuam funcionando — apenas retornam 0 rows pra propostas COM senha.
-- ════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── 1. RPC mínima ──────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.get_proposta_publica_minima(text);

CREATE OR REPLACE FUNCTION public.get_proposta_publica_minima(p_token text)
RETURNS TABLE(
  numero integer,
  status text,
  has_password boolean,
  escritorio_nome text,
  validade_dias integer,
  created_at timestamp with time zone,
  data_expiracao timestamp with time zone
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
         o.data_expiracao
    FROM public.orcamentos o
    LEFT JOIN public.empresas_config ec ON ec.empresa_id = o.empresa_id
   WHERE o.share_token = p_token
     AND o.status IN ('enviado', 'aguardando_pagamento', 'convertido')
     AND (o.data_expiracao IS NULL OR o.data_expiracao > NOW());
END;
$function$;

COMMENT ON FUNCTION public.get_proposta_publica_minima(text) IS
  'SEC-033: retorna info mínima da proposta pra decidir se mostra tela de senha. '
  'Sem dados financeiros ou de prospect.';

-- ── 2. RPC completa com gate de senha ──────────────────────────────────
-- DROP + CREATE pra trocar assinatura (adiciona p_senha)
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
  has_password boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_senha_real text;
BEGIN
  PERFORM public._log_acesso_publico('proposta', p_token);

  -- Resolve senha cadastrada (se houver)
  SELECT senha_link INTO v_senha_real
    FROM public.orcamentos
   WHERE share_token = p_token
     AND status IN ('enviado', 'aguardando_pagamento', 'convertido')
     AND (data_expiracao IS NULL OR data_expiracao > NOW())
   LIMIT 1;

  -- Se proposta tem senha e a passada não bate, retorna 0 rows.
  -- Garante que apenas chamadas autenticadas (senha correta) recebem os dados.
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
    (o.senha_link IS NOT NULL AND o.senha_link <> '') AS has_password
  FROM public.orcamentos o
  WHERE o.share_token = p_token
    AND o.status IN ('enviado', 'aguardando_pagamento', 'convertido')
    AND (o.data_expiracao IS NULL OR o.data_expiracao > NOW());
END;
$function$;

COMMENT ON FUNCTION public.get_proposta_por_token(text, text) IS
  'SEC-033: aceita senha opcional. Se proposta tem senha cadastrada e a '
  'passada não bate, retorna 0 rows (proteção real, não só visual).';

-- ── 3. Verificação ─────────────────────────────────────────────────────
-- Espera-se: get_proposta_por_token agora exige 2 args (com default no 2º).
SELECT proname, pg_get_function_arguments(oid) AS args
  FROM pg_proc
 WHERE pronamespace = 'public'::regnamespace
   AND proname IN ('get_proposta_por_token', 'get_proposta_publica_minima');

COMMIT;

-- ════════════════════════════════════════════════════════════════════════════
-- ROLLBACK (apenas se algo der errado):
-- ════════════════════════════════════════════════════════════════════════════
-- BEGIN;
-- -- Volta versão antiga (sem proteção):
-- DROP FUNCTION IF EXISTS public.get_proposta_por_token(text, text);
-- DROP FUNCTION IF EXISTS public.get_proposta_publica_minima(text);
-- -- (rodar versão de get-proposta-por-token-permite-convertido.sql original)
-- COMMIT;
