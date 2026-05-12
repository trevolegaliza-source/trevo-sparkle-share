-- =============================================
-- SEC-025 (12/05/2026): historico de login pra detectar IP/device novo
-- =============================================
-- Cada login bem-sucedido grava IP + user-agent + opcionalmente pais.
-- Edge function `registrar-login` compara com os ultimos 30 dias do
-- mesmo user. Se IP /24 ou user-agent for novo, dispara notificacao
-- tipo `login_novo` pro master da empresa (filtrada client-side via
-- SEC-019; nao tem `destinatario_id` ainda — SEC-020).
--
-- IP eh PII em LGPD mas legitimo guardar pra seguranca (deteccao de
-- comprometimento). UI mostra truncado (.x no ultimo octeto).
--
-- TODO: cleanup periodico de registros > 90 dias (sem cron por ora).
-- =============================================

create table public.login_history (
  id          uuid        primary key default gen_random_uuid(),
  user_id     uuid        not null references auth.users(id) on delete cascade,
  empresa_id  uuid        not null references public.empresas(id) on delete cascade,
  ip          text,
  ip_subnet   text,       -- /24 (ex: '123.45.67') pra comparacao tolerante a DHCP
  user_agent  text,
  pais        text,       -- ISO 3166-1 alpha-2 se vier via cf-ipcountry
  created_at  timestamptz not null default now()
);

create index login_history_user_recent_idx
  on public.login_history (user_id, created_at desc);

create index login_history_empresa_recent_idx
  on public.login_history (empresa_id, created_at desc);

alter table public.login_history enable row level security;

-- Master da empresa le tudo (auditoria). Outros users nao leem nem o
-- proprio historico — nao tem caso de uso pra exibir isso pra eles e
-- evita confusao.
create policy "master_le_da_empresa"
  on public.login_history
  for select
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role = 'master'
        and p.empresa_id = login_history.empresa_id
    )
  );

-- Insert soh via service_role (edge function registrar-login).

-- Privilegios (mesma armadilha do SEC-024 — DEFAULT PRIVILEGES nao
-- propaga sempre).
grant select, insert on public.login_history to service_role;
grant select on public.login_history to authenticated;

comment on table  public.login_history is 'SEC-025: log de logins pra deteccao de IP/device novo';
comment on column public.login_history.ip_subnet is '/24 do IP (3 primeiros octetos) — comparacao tolerante a DHCP';
