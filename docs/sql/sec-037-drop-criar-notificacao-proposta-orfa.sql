-- ════════════════════════════════════════════════════════════════════════════
-- SEC-037 — DROP de criar_notificacao_proposta (RPC órfã com injeção)
-- ════════════════════════════════════════════════════════════════════════════
-- Achado nesta auditoria (25/05/2026):
--
-- Função `public.criar_notificacao_proposta(uuid, text, text)`:
--   - Aceita `p_mensagem text` LITERAL, sem sanitização
--   - EXECUTE grant para PUBLIC (anon + authenticated)
--   - Insere direto em `notificacoes.mensagem` (que vira push notif)
--   - Hardcoded titulo "🟢 PROPOSTA APROVADA" ou "🔴 PROPOSTA RECUSADA"
--   - SECURITY DEFINER → contorna qualquer RLS
--
-- Vetores de ataque:
--   - Anon descobre/adivinha um uuid de orcamento + token → spam de notif
--   - Phishing: titulo verde "APROVADA" + mensagem maliciosa
--   - Após SEC-034 push lockscreen já tá mascarado, mas user vê texto
--     malicioso AO ABRIR o app
--
-- Verificação pré-DROP (executei em 25/05):
--   - Zero callers no frontend (grep src/)
--   - Zero callers em routines SQL (information_schema.routines)
--   - Zero callers em triggers (information_schema.triggers)
--   - Zero callers nas 26 edge functions deployadas
--
-- Conclusão: função ÓRFÃ. DROP seguro.
-- Se algum fluxo de aprovação/recusa vier a precisar, recriar como:
--   - SECURITY DEFINER + REVOKE PUBLIC
--   - Validação por share_token (não p_orcamento_id direto)
--   - Sanitização: tamanho máx 200 chars, escape HTML, etc
-- ════════════════════════════════════════════════════════════════════════════

BEGIN;

-- Drop com CASCADE pra cobrir qualquer dependência futura que eu não previ
-- (a verificação acima viu zero, mas defesa em profundidade).
DROP FUNCTION IF EXISTS public.criar_notificacao_proposta(uuid, text, text) CASCADE;

-- Verificação: função não deve mais existir
SELECT count(*) AS deve_ser_zero
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
 WHERE n.nspname = 'public' AND p.proname = 'criar_notificacao_proposta';

COMMIT;

-- ════════════════════════════════════════════════════════════════════════════
-- ROLLBACK (se descobrir algum caller depois):
-- ════════════════════════════════════════════════════════════════════════════
-- BEGIN;
-- CREATE OR REPLACE FUNCTION public.criar_notificacao_proposta(p_orcamento_id uuid, p_tipo text, p_mensagem text)
--   RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
-- DECLARE v_empresa_id uuid;
-- BEGIN
--   SELECT empresa_id INTO v_empresa_id FROM orcamentos WHERE id = p_orcamento_id;
--   IF v_empresa_id IS NULL THEN RETURN; END IF;
--   INSERT INTO notificacoes (empresa_id, tipo, titulo, mensagem, orcamento_id)
--   VALUES (v_empresa_id, p_tipo,
--     CASE WHEN p_tipo = 'aprovacao' THEN '🟢 PROPOSTA APROVADA' ELSE '🔴 PROPOSTA RECUSADA' END,
--     substring(p_mensagem from 1 for 200),  -- pelo menos limita tamanho
--     p_orcamento_id);
-- END $$;
-- REVOKE EXECUTE ON FUNCTION public.criar_notificacao_proposta(uuid, text, text) FROM PUBLIC, anon;
-- COMMIT;
