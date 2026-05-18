-- fix-orcamento-expiracao.sql
-- Bug: orçamentos antigos enviados ficaram com data_expiracao vencida.
-- Quando user edita e re-envia, a trigger antiga não recalcula expiração
-- (só populava se NULL). Resultado: RPC pública filtra como expirado e
-- cliente vê 404 / 'Proposta indisponível'.
--
-- Fix: ao ENVIAR (status muda pra 'enviado'), recalcula data_expiracao
-- baseado em NOW() + validade_dias. Ao mudar validade_dias estando
-- já enviado, também recalcula.

CREATE OR REPLACE FUNCTION public.tg_set_orcamento_expiracao()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  -- INSERT: popula se NULL (igual antes)
  IF TG_OP = 'INSERT' THEN
    IF NEW.data_expiracao IS NULL THEN
      NEW.data_expiracao := COALESCE(NEW.enviado_em, NEW.created_at, NOW())
                            + (COALESCE(NEW.validade_dias, 15) * INTERVAL '1 day');
    END IF;
    RETURN NEW;
  END IF;

  -- UPDATE: recalcula quando:
  --   1) status virou 'enviado' (re-envio) → reset relógio
  --   2) validade_dias mudou → atualiza
  --   3) enviado_em mudou (caso re-envio força refresh)
  IF NEW.status = 'enviado' AND (OLD.status IS DISTINCT FROM 'enviado' OR OLD.enviado_em IS DISTINCT FROM NEW.enviado_em) THEN
    NEW.data_expiracao := COALESCE(NEW.enviado_em, NOW())
                          + (COALESCE(NEW.validade_dias, 15) * INTERVAL '1 day');
  ELSIF OLD.validade_dias IS DISTINCT FROM NEW.validade_dias THEN
    NEW.data_expiracao := COALESCE(NEW.enviado_em, NEW.created_at, NOW())
                          + (COALESCE(NEW.validade_dias, 15) * INTERVAL '1 day');
  END IF;

  RETURN NEW;
END $$;

-- Backfill: corrige todas as propostas atualmente 'enviado' com expiração
-- vencida. Aplica enviado_em + validade_dias; se enviado_em é null usa NOW().
UPDATE public.orcamentos
   SET data_expiracao = COALESCE(enviado_em, NOW()) + (COALESCE(validade_dias, 15) * INTERVAL '1 day')
 WHERE status IN ('enviado', 'aguardando_pagamento')
   AND (data_expiracao IS NULL OR data_expiracao < NOW());
