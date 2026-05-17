-- =============================================
-- CLEANUP NOTIFICAÇÕES LEGADAS SEM DESTINATÁRIO (17/05/2026)
-- =============================================
-- Health check pré-viagem mapeou 4 notificações `lida=false` com
-- `destinatario_id IS NULL` (pré-SEC-020). Após o refactor de
-- SEC-020 (13/05), o frontend filtra notificações por destinatario_id —
-- essas 4 ficam "fantasma" na tabela mas ninguém vê na sino.
--
-- Os eventos são antigos (pagamentos confirmados / cobrança vencida de
-- 15/05) — não exigem ação. Marca como lidas pra limpar a contagem.
--
-- Idempotente. Filtra >1 dia atrás pra não pegar notif legítima
-- criada agora em testes/desenvolvimento.
-- =============================================

UPDATE public.notificacoes
SET lida = true
WHERE lida = false
  AND destinatario_id IS NULL
  AND created_at < NOW() - INTERVAL '1 day';

-- Confirma
SELECT count(*) AS notif_nao_lidas_apos FROM public.notificacoes WHERE lida = false;
