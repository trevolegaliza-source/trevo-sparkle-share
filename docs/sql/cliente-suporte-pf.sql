-- cliente-suporte-pf.sql
-- Adiciona suporte a cliente PESSOA FÍSICA (contadores autônomos, profissionais
-- liberais, etc). Antes: só PJ via campo cnpj.
--
-- Estratégia:
-- - tipo_pessoa: 'PF' | 'PJ' (default 'PJ' pra retrocompat — todos os clientes
--   existentes ficam marcados como PJ)
-- - cpf: text nullable (similar ao cnpj que ja existia nullable)
-- - cnpj continua existindo e funcionando pra PJ

ALTER TABLE public.clientes
  ADD COLUMN IF NOT EXISTS cpf text,
  ADD COLUMN IF NOT EXISTS tipo_pessoa text NOT NULL DEFAULT 'PJ';

-- Garante que tipo_pessoa só aceita PF ou PJ
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'clientes_tipo_pessoa_check'
  ) THEN
    ALTER TABLE public.clientes
      ADD CONSTRAINT clientes_tipo_pessoa_check CHECK (tipo_pessoa IN ('PF','PJ'));
  END IF;
END $$;

-- Index opcional pra busca por CPF (igual cnpj)
CREATE INDEX IF NOT EXISTS idx_clientes_cpf ON public.clientes(cpf) WHERE cpf IS NOT NULL;

COMMENT ON COLUMN public.clientes.tipo_pessoa IS 'PF (pessoa fisica/autonomo) ou PJ (empresa). Default PJ por retrocompat.';
COMMENT ON COLUMN public.clientes.cpf IS 'Apenas dígitos (sem máscara). Validado no frontend via lib/cpf.ts';
