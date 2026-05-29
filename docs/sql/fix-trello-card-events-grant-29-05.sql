-- =============================================
-- FIX 29/05/2026 — GRANT service_role em trello_card_events
-- =============================================
-- Bug: edge function trello-cards-events tentava INSERT e Postgres
-- devolvia "permission denied for table trello_card_events" (42501).
-- Causa: tabela criada com RLS ENABLE mas SEM grants pro service_role.
-- Service role bypassa RLS, mas precisa ter GRANT na tabela primeiro.
-- Notificacoes e outras tabelas têm grant default; essa não veio.
-- =============================================
GRANT ALL ON public.trello_card_events TO service_role;
GRANT ALL ON public.trello_card_events TO postgres;
-- Também garantir authenticated pode SELECT (já tem policy, mas garantir
-- que GRANT esteja em pé pra evitar mesmo problema futuro)
GRANT SELECT ON public.trello_card_events TO authenticated;
