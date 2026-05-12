-- =============================================
-- SEC-024 (12/05/2026): tabela de recovery codes pra MFA
-- =============================================
-- Codigos one-time pra master conseguir voltar a entrar quando perder
-- o celular do autenticador. Cada codigo eh hashado (SHA-256) antes de
-- guardar; o codigo plain so eh mostrado UMA vez na geracao.
--
-- Uso esperado:
--   1. Master vai em /configuracoes -> Seguranca -> Recovery codes
--   2. Clica "Gerar codigos" -> recebe 8 codigos -> salva fora do navegador
--   3. Se perder celular, no challenge de TOTP usa link "usar codigo de
--      recuperacao" -> digita codigo -> backend marca usado e remove
--      fatores TOTP -> proximo login cai em forceSetup (SEC-021).
--
-- Soh master tem isso (decisao Thales 12/05/2026). Outros users que
-- perdem celular dependem do master via SEC-023 (botao Resetar 2FA).
-- =============================================

create table public.mfa_recovery_codes (
  id          uuid        primary key default gen_random_uuid(),
  user_id     uuid        not null references auth.users(id) on delete cascade,
  code_hash   text        not null,
  used_at     timestamptz,
  created_at  timestamptz not null default now()
);

create index mfa_recovery_codes_user_unused_idx
  on public.mfa_recovery_codes (user_id) where used_at is null;

alter table public.mfa_recovery_codes enable row level security;

-- Usuario le os proprios codigos pra UI mostrar status (quantos
-- disponiveis, gerados em quando). O code_hash em si nao serve pra nada
-- mesmo lido — pra usar precisa do code plain que so existe no momento
-- da geracao.
create policy "user_le_proprios_recovery_codes"
  on public.mfa_recovery_codes
  for select
  using (user_id = auth.uid());

-- Insert/update/delete soh via service_role (edge functions). Nao tem
-- policy correspondente, RLS bloqueia.

-- Privilegios de coluna (sem isso, role "permission denied" mesmo com
-- RLS permitindo). Tabelas criadas via SQL Editor as vezes nao herdam
-- DEFAULT PRIVILEGES, entao a gente explicita.
grant select, insert, update, delete on public.mfa_recovery_codes to service_role;
grant select on public.mfa_recovery_codes to authenticated;

-- Comentarios pra docs no DB
comment on table  public.mfa_recovery_codes is 'SEC-024: codigos one-time pra recuperar acesso ao perder o autenticador';
comment on column public.mfa_recovery_codes.code_hash is 'SHA-256 hex do codigo plain (codigo plain so eh mostrado UMA vez)';
comment on column public.mfa_recovery_codes.used_at  is 'Quando o codigo foi consumido. NULL = ainda disponivel';
