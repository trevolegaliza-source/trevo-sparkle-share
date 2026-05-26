-- ════════════════════════════════════════════════════════════════════════════
-- Feature Terceirização — valor específico de abertura + dia de pagamento
-- ════════════════════════════════════════════════════════════════════════════
-- 26/05/2026: Thales pediu:
--   - Campo específico pra abertura de empresa (valor diferente do padrão)
--   - Campo pra dia do mês de cobrança (recorrência)
-- ════════════════════════════════════════════════════════════════════════════

BEGIN;

ALTER TABLE public.orcamentos
  ADD COLUMN IF NOT EXISTS terc_valor_abertura numeric,
  ADD COLUMN IF NOT EXISTS terc_dia_pagamento integer;

COMMENT ON COLUMN public.orcamentos.terc_valor_abertura IS
  'Valor específico pra processos de abertura. Se NULL, usa valor padrão da modalidade. Caso real: abertura R$ 580 vs alteração R$ 480.';
COMMENT ON COLUMN public.orcamentos.terc_dia_pagamento IS
  'Dia do mês pra cobrança recorrente (1-31). Aplicável em planos mensais.';

-- Atualizar get_proposta_por_token pra retornar os novos
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
  tipo_proposta text,
  terc_modalidade text,
  terc_servicos jsonb,
  terc_naturezas jsonb,
  terc_inclusos jsonb,
  terc_valor_base numeric,
  terc_valor_pro numeric,
  terc_valor_enterprise numeric,
  terc_clicksign_status text,
  terc_pdf_url text,
  terc_observacoes_publicas text,
  terc_valor_final_override numeric,
  terc_precos_por_tipo jsonb,
  terc_regras_rapidas_ativas jsonb,
  terc_valor_abertura numeric,
  terc_dia_pagamento integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_senha_real text;
BEGIN
  PERFORM public._log_acesso_publico('proposta', p_token);

  SELECT o.senha_link INTO v_senha_real
    FROM public.orcamentos o
   WHERE o.share_token = p_token
     AND o.status IN ('enviado', 'aguardando_pagamento', 'convertido', 'aceito')
     AND (o.data_expiracao IS NULL OR o.data_expiracao > NOW())
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
    o.terc_pdf_url,
    o.terc_observacoes_publicas,
    o.terc_valor_final_override,
    o.terc_precos_por_tipo,
    o.terc_regras_rapidas_ativas,
    o.terc_valor_abertura,
    o.terc_dia_pagamento
  FROM public.orcamentos o
  WHERE o.share_token = p_token
    AND o.status IN ('enviado', 'aguardando_pagamento', 'convertido', 'aceito')
    AND (o.data_expiracao IS NULL OR o.data_expiracao > NOW());
END;
$function$;

GRANT EXECUTE ON FUNCTION public.get_proposta_por_token(text, text) TO anon, authenticated;

-- Verificação
SELECT column_name FROM information_schema.columns
 WHERE table_schema='public' AND table_name='orcamentos'
   AND column_name IN ('terc_valor_abertura','terc_dia_pagamento')
 ORDER BY column_name;

COMMIT;
