-- fix-marcar-deferimento-idempotente.sql
-- BUG raiz: marcar_deferimento cria lancamento "(Deferido)" duplicado quando
-- o processo ja tem lancamento em estado avancado (cobranca_gerada, paga, etc).
--
-- Cenario: processo criado, lancamento promovido manualmente, auditado, cobranca
-- gerada. DEPOIS Thales marca deferimento. A funcao busca lancamento em
-- 'aguardando_deferimento' (nao acha pq ja foi promovido), e cai no branch
-- ELSE que INSERTA um novo lancamento "(Deferido)" em 'solicitacao_criada'.
-- Resultado: processo aparece em 2 lugares na UI (A FAZER + AGUARDANDO PAGAMENTO).
--
-- Fix: antes de criar novo lancamento, verifica se ja existe QUALQUER
-- lancamento receber pro processo. Se ja existe, nao cria duplicata — so
-- registra que ja existia.

CREATE OR REPLACE FUNCTION public.marcar_deferimento(p_processo_id uuid, p_data_deferimento date)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_empresa_caller uuid;
  v_processo RECORD;
  v_lanc_id uuid;
  v_vencimento date;
BEGIN
  v_empresa_caller := public.get_empresa_id();
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

  -- Tentativa 1: promove lancamento que estava 'aguardando_deferimento' (fluxo normal)
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

  -- Tentativa 2 (FIX 18/05/2026): se nao tem em aguardando_deferimento, verifica
  -- se ja existe QUALQUER lancamento receber pro processo (em estado avancado).
  -- Se sim, NAO cria duplicata — so confirma que ja existia.
  SELECT id INTO v_lanc_id
    FROM public.lancamentos
   WHERE processo_id = p_processo_id
     AND tipo = 'receber'
   ORDER BY created_at
   LIMIT 1
   FOR UPDATE;

  IF v_lanc_id IS NOT NULL THEN
    RETURN jsonb_build_object('ok', true, 'acao', 'ja_existia', 'lancamento_id', v_lanc_id);
  END IF;

  -- Tentativa 3 (raro): nao tem nenhum lancamento. Cria. Caso esperado: data
  -- import sem lancamento, ou processo criado fora do fluxo normal.
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

-- Limpeza: deleta as 7 duplicatas criadas hoje pelo bug
-- (lancamentos solicitacao_criada + auditado=false + sem extrato + descricao com '(Deferido)',
-- enquanto o mesmo processo ja tem outro lancamento em estado avancado).
DELETE FROM public.lancamentos
 WHERE id IN (
   'ecb69db1-bb4b-48ee-904e-eb1906ef626c', -- RCB AGROPECUARIA
   'a197ff1b-0fd9-490e-9d29-04ee57250941', -- ARMAZEM DA CRIACAO
   '93e5ba87-bd21-493d-b2d4-b5a1e7e5c205', -- SCARPETTA
   '657d942d-6a94-495b-85fd-15480cc20486', -- LUANNA
   'd45d073a-d68b-427b-8997-fdf5e3ca383d', -- PARRA DESIGN
   '7ce58fe4-08d7-47e1-8c33-03c6cc10b86c', -- MBM TECNOLOGIA (VITAE)
   '72658fe3-706e-439a-9ac8-490c86fc5b0f'  -- RAFAELA CORREIA (VITAE)
 );

-- Verificacao: nao deve restar duplicata
SELECT
  l.id, c.nome AS cliente, p.razao_social, l.descricao, l.etapa_financeiro
FROM lancamentos l
JOIN processos p ON p.id = l.processo_id
JOIN clientes c ON c.id = p.cliente_id
WHERE l.tipo='receber'
  AND l.etapa_financeiro='solicitacao_criada'
  AND l.auditado=false
  AND l.extrato_id IS NULL
  AND l.descricao ILIKE '%(Deferido)%'
  AND EXISTS (
    SELECT 1 FROM lancamentos l2
     WHERE l2.processo_id = l.processo_id AND l2.tipo='receber' AND l2.id <> l.id
       AND l2.etapa_financeiro IN ('cobranca_gerada','cobranca_enviada','honorario_pago','aguardando_pagamento')
  );
