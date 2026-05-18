-- vitae-preco-abertura-540.sql
-- Cliente VITAE negociou: abertura R$ 540 (resto continua R$ 680 do valor_base).
-- Usa o mecanismo de override por tipo (commit que extendeu cliente_precos_por_tipo
-- pra funcionar como override em qualquer cliente, nao so PRECO_POR_TIPO).

-- 1. Cadastra a regra na tabela
INSERT INTO public.cliente_precos_por_tipo (cliente_id, tipo, valor)
VALUES ('9f5a0a4b-93b4-45b8-801b-3e29b431dd6d', 'abertura', 540.00)
ON CONFLICT (cliente_id, tipo) DO UPDATE SET valor = EXCLUDED.valor, updated_at = NOW();

-- 2. Atualiza os 2 processos JA EXISTENTES de abertura do VITAE pra refletir o novo valor
-- (criados antes da regra, ainda com 680).
UPDATE public.processos
   SET valor = 540
 WHERE cliente_id = '9f5a0a4b-93b4-45b8-801b-3e29b431dd6d'
   AND tipo = 'abertura';

-- 3. Atualiza os lancamentos vinculados (a receber) pra mesmo valor
UPDATE public.lancamentos
   SET valor = 540
 WHERE tipo = 'receber'
   AND status IN ('pendente','cobranca_enviada')
   AND processo_id IN (
     SELECT id FROM public.processos
      WHERE cliente_id = '9f5a0a4b-93b4-45b8-801b-3e29b431dd6d'
        AND tipo = 'abertura'
   );

-- 4. Verificacao final
SELECT 'regra' AS o_que, tipo, valor::text AS valor FROM public.cliente_precos_por_tipo
 WHERE cliente_id = '9f5a0a4b-93b4-45b8-801b-3e29b431dd6d'
UNION ALL
SELECT 'processo' AS o_que, p.tipo::text AS tipo, p.valor::text AS valor
  FROM public.processos p
 WHERE p.cliente_id = '9f5a0a4b-93b4-45b8-801b-3e29b431dd6d'
UNION ALL
SELECT 'lancamento' AS o_que, p.tipo::text, l.valor::text
  FROM public.lancamentos l
  JOIN public.processos p ON p.id = l.processo_id
 WHERE p.cliente_id = '9f5a0a4b-93b4-45b8-801b-3e29b431dd6d'
   AND l.tipo = 'receber';
