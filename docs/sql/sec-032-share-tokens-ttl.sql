-- =============================================
-- SEC-032 (17/05/2026): Share tokens com TTL garantido (backfill + trigger)
-- =============================================
-- Auditoria 17/05 mapeou: share tokens (proposta/cobrança) sem TTL nem rate
-- limit. Investigando, descobri que está PARCIALMENTE implementado:
--
-- ✅ `cobrancas` + `orcamentos` JÁ TÊM coluna `data_expiracao timestamptz`
-- ✅ `get_proposta_por_token` JÁ valida `data_expiracao > NOW()`
-- ✅ `get_cobranca_por_token` JÁ valida `data_expiracao > NOW()`
-- ✅ Cobrancas tem 0 rows com `data_expiracao` NULL (algo já popula)
-- ❌ Orcamentos tem 14 rows com `data_expiracao` NULL → token nunca expira
-- ❌ Sem trigger preventivo — INSERT novo com NULL passa
-- ❌ `get_cobranca_token_by_proposta` (helper que retorna token de cobrança a
--    partir de token de proposta) NÃO valida expiração da cobrança
--
-- Esse SQL fecha as 3 lacunas. Rate limit fica fora — requer tabela
-- `share_token_attempts` + lógica em cada chamada (escopo de sessão
-- dedicada, ver SEC-032 v2 no roadmap).
--
-- COMO RODAR (em ordem):
--   1) PASSO 1 (audit) — confirma estado atual (deve mostrar 14 órfãos)
--   2) PASSO 2 (backfill) — popula `data_expiracao` nos 14 órfãos
--   3) PASSO 3 (triggers) — preventivo pra INSERTs futuros
--   4) PASSO 4 (RPC) — hardening em `get_cobranca_token_by_proposta`
--   5) PASSO 5 (confirma) — re-roda PASSO 1 (deve mostrar 0 órfãos)
-- =============================================

-- PASSO 1: Audit estado atual
SELECT 'cobrancas' AS tabela, count(*) AS total, count(data_expiracao) AS com_expiracao, count(*) - count(data_expiracao) AS sem_expiracao
FROM public.cobrancas
UNION ALL
SELECT 'orcamentos', count(*), count(data_expiracao), count(*) - count(data_expiracao)
FROM public.orcamentos;

-- PASSO 2: Backfill orçamentos NULL
-- Regra: data_expiracao = quando-foi-enviado + validade_dias (default 15 se NULL)
-- Se nunca foi enviado (status rascunho), usa created_at como base
UPDATE public.orcamentos
SET data_expiracao = COALESCE(enviado_em, created_at) + (COALESCE(validade_dias, 15) * INTERVAL '1 day')
WHERE data_expiracao IS NULL;

-- PASSO 3a: Trigger preventivo em orcamentos
CREATE OR REPLACE FUNCTION public.tg_set_orcamento_expiracao()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Só popula se NULL — não sobrescreve expiração já definida manualmente
  IF NEW.data_expiracao IS NULL THEN
    NEW.data_expiracao := COALESCE(NEW.enviado_em, NEW.created_at, NOW())
                          + (COALESCE(NEW.validade_dias, 15) * INTERVAL '1 day');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_orcamento_expiracao ON public.orcamentos;
CREATE TRIGGER trg_set_orcamento_expiracao
BEFORE INSERT OR UPDATE OF validade_dias, enviado_em ON public.orcamentos
FOR EACH ROW EXECUTE FUNCTION public.tg_set_orcamento_expiracao();

-- PASSO 3b: Trigger preventivo em cobrancas (default 60 dias após criação)
-- Cobrancas hoje tem 0 NULL — provavelmente já tem algo populando, mas
-- adicionar trigger explícito garante que NUNCA fique NULL.
CREATE OR REPLACE FUNCTION public.tg_set_cobranca_expiracao()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.data_expiracao IS NULL THEN
    -- Default: cobrança expira 60 dias após criação (gera margem pra cliente
    -- pagar mesmo após data_vencimento). Pode ser refinado por config futura.
    NEW.data_expiracao := COALESCE(NEW.created_at, NOW()) + INTERVAL '60 days';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_cobranca_expiracao ON public.cobrancas;
CREATE TRIGGER trg_set_cobranca_expiracao
BEFORE INSERT ON public.cobrancas
FOR EACH ROW EXECUTE FUNCTION public.tg_set_cobranca_expiracao();

-- PASSO 4: Hardening em get_cobranca_token_by_proposta
-- Helper RPC que retorna o token de cobrança a partir do token de proposta.
-- Antes não checava expiração da cobrança — usuário com token de proposta
-- válida podia recuperar token de cobrança expirada.
CREATE OR REPLACE FUNCTION public.get_cobranca_token_by_proposta(p_proposta_token text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  v_lancamento_id uuid;
  v_cobranca_token text;
BEGIN
  -- Proposta também precisa estar não-expirada (defesa em profundidade)
  SELECT lancamento_id INTO v_lancamento_id
  FROM orcamentos
  WHERE share_token = p_proposta_token
    AND (data_expiracao IS NULL OR data_expiracao > NOW())
  LIMIT 1;

  IF v_lancamento_id IS NULL THEN
    RETURN NULL;
  END IF;

  -- Cobrança também precisa estar não-expirada
  SELECT share_token INTO v_cobranca_token
  FROM cobrancas
  WHERE lancamento_ids @> ARRAY[v_lancamento_id]
    AND (data_expiracao IS NULL OR data_expiracao > NOW())
  LIMIT 1;

  RETURN v_cobranca_token;
END;
$function$;

-- PASSO 5: Confirma — deve mostrar 0 sem_expiracao em ambas as tabelas
SELECT 'cobrancas' AS tabela, count(*) AS total, count(*) - count(data_expiracao) AS sem_expiracao
FROM public.cobrancas
UNION ALL
SELECT 'orcamentos', count(*), count(*) - count(data_expiracao)
FROM public.orcamentos;
