-- Ações REST configuráveis por organização. Credenciais em tabela separada,
-- inacessível ao browser; resultado higienizado pelo executor, sem input bruto.
-- CONFIRMADO: o coordenador acrescenta este bloco ao baseline e ao MANIFEST.
alter table public.ai_agent_versions add column if not exists integration_action_ids uuid[] not null default '{}';
comment on column public.ai_agent_versions.integration_action_ids is 'Allowlist explícita de ações REST desta versão publicada. Vazio habilita nenhuma ação; enabled na ação não publica a capacidade em todos os agentes.';

create table if not exists public.integration_actions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  configuration jsonb not null check (jsonb_typeof(configuration) = 'object'),
  credential_header_names text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id)
);
create index if not exists integration_actions_org_created_idx on public.integration_actions (organization_id, created_at desc);
alter table public.integration_actions enable row level security;
drop policy if exists integration_actions_manager_read on public.integration_actions;
create policy integration_actions_manager_read on public.integration_actions for select to authenticated
  using (organization_id in (select public.fn_user_org_ids()) and public.fn_role_at_least(organization_id, 'manager'));
drop policy if exists integration_actions_manager_write on public.integration_actions;
create policy integration_actions_manager_write on public.integration_actions for all to authenticated
  using (organization_id in (select public.fn_user_org_ids()) and public.fn_role_at_least(organization_id, 'manager') and public.fn_support_write_allowed(organization_id))
  with check (organization_id in (select public.fn_user_org_ids()) and public.fn_role_at_least(organization_id, 'manager') and public.fn_support_write_allowed(organization_id));
revoke all on public.integration_actions from public, anon, authenticated;
grant select, insert, update, delete on public.integration_actions to authenticated, service_role;
drop trigger if exists integration_actions_updated_at on public.integration_actions;
create trigger integration_actions_updated_at before update on public.integration_actions for each row execute function public.fn_set_updated_at();

create table if not exists public.integration_action_credentials (
  action_id uuid primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  headers_encrypted bytea not null,
  foreign key (organization_id, action_id) references public.integration_actions(organization_id, id) on delete cascade
);
alter table public.integration_action_credentials enable row level security;
revoke all on public.integration_action_credentials from public, anon, authenticated;
grant select, insert, update, delete on public.integration_action_credentials to service_role;
comment on column public.integration_action_credentials.headers_encrypted is 'JSON de cabeçalhos cifrado por fn_encrypt_oauth. Nunca devolver ao cliente, nem em hex.';

create table if not exists public.integration_action_executions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  action_id uuid,
  action_name text not null,
  actor_user_id uuid references auth.users(id) on delete set null,
  request_id uuid not null,
  source text not null check (source in ('manual', 'test', 'agent')),
  state text not null check (state in ('running', 'succeeded', 'failed')),
  result jsonb,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  foreign key (organization_id, action_id) references public.integration_actions(organization_id, id) on delete set null (action_id)
);
create index if not exists integration_action_executions_org_started_idx on public.integration_action_executions (organization_id, started_at desc);
create index if not exists integration_action_executions_action_started_idx on public.integration_action_executions (organization_id, action_id, started_at desc);
alter table public.integration_action_executions enable row level security;
drop policy if exists integration_action_executions_agent_read on public.integration_action_executions;
create policy integration_action_executions_agent_read on public.integration_action_executions for select to authenticated
  using (organization_id in (select public.fn_user_org_ids()) and public.fn_role_at_least(organization_id, 'agent'));
-- Somente o executor grava: um atendente não pode inventar prova de execução.
revoke all on public.integration_action_executions from public, anon, authenticated;
grant select on public.integration_action_executions to authenticated;
grant select, insert, update on public.integration_action_executions to service_role;

-- Configuração e troca de credenciais são atômicas. Serviço revalida requireRole
-- e requireSupportWrite antes de chegar aqui; nenhum cliente executa esta RPC.
create or replace function public.fn_save_integration_action(
  p_org uuid, p_id uuid, p_configuration jsonb, p_header_names text[], p_encrypted bytea, p_create boolean
) returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if p_create then
    insert into public.integration_actions (id, organization_id, configuration, credential_header_names)
      values (p_id, p_org, p_configuration, coalesce(p_header_names, '{}'));
  else
    update public.integration_actions set configuration = p_configuration,
      credential_header_names = coalesce(p_header_names, credential_header_names)
      where id = p_id and organization_id = p_org;
    if not found then raise exception 'integration_action_not_found' using errcode = 'P0002'; end if;
  end if;
  if p_header_names is not null then
    if cardinality(p_header_names) = 0 then
      delete from public.integration_action_credentials where action_id = p_id and organization_id = p_org;
    else
      if p_encrypted is null then raise exception 'encrypted_credentials_required' using errcode = '23514'; end if;
      insert into public.integration_action_credentials (action_id, organization_id, headers_encrypted)
        values (p_id, p_org, p_encrypted)
        on conflict (action_id) do update set headers_encrypted = excluded.headers_encrypted
        where integration_action_credentials.organization_id = p_org;
    end if;
  end if;
  return p_id;
end;
$$;
revoke execute on function public.fn_save_integration_action(uuid, uuid, jsonb, text[], bytea, boolean) from public, anon, authenticated;
grant execute on function public.fn_save_integration_action(uuid, uuid, jsonb, text[], bytea, boolean) to service_role;

-- A seleção é conteúdo da versão: não pode mudar depois de publicada.
-- A existência e o tenant também são conferidos na porta SQL, inclusive para
-- quem não passou pelas rotas HTTP ou pelas server actions.
create or replace function public.fn_validate_agent_integration_actions() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if TG_OP = 'UPDATE' then
    if old.status in ('published','superseded','archived') and (
      new.integration_action_ids is distinct from old.integration_action_ids
      or new.organization_id is distinct from old.organization_id
      or new.status = 'draft'
    ) then
      raise exception 'version_immutable';
    end if;
    if new.integration_action_ids is not distinct from old.integration_action_ids
      and new.organization_id is not distinct from old.organization_id
      and not (new.status = 'published' and old.status <> 'published') then return new; end if;
  end if;
  if cardinality(new.integration_action_ids) > 25
    or cardinality(new.integration_action_ids) <> (select count(distinct id) from unnest(new.integration_action_ids) id)
    or exists (select 1 from unnest(new.integration_action_ids) selected(id)
      where not exists (select 1 from public.integration_actions a
        where a.id = selected.id and a.organization_id = new.organization_id
          and a.configuration->>'enabled' = 'true')) then
    raise exception 'integration_action_invalid';
  end if;
  return new;
end $$;
revoke all on function public.fn_validate_agent_integration_actions() from public, anon, authenticated;
drop trigger if exists tr_agent_integration_actions on public.ai_agent_versions;
create trigger tr_agent_integration_actions before insert or update on public.ai_agent_versions
  for each row execute function public.fn_validate_agent_integration_actions();
