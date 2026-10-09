-- Campanhas dos tenants. Não são campanhas do site da instalação.
-- Leituras via RLS; mutações exclusivamente nas rotas manager + suporte full.
create unique index if not exists customer_campaign_contacts_org_id on public.contacts(organization_id,id);
create unique index if not exists customer_campaign_sessions_org_id on public.channel_sessions(organization_id,id);
create unique index if not exists customer_campaign_conversations_org_id on public.conversations(organization_id,id);
create unique index if not exists customer_campaign_messages_org_id on public.messages(organization_id,id);

create table if not exists public.customer_campaigns (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null check (length(name) between 1 and 120),
  channel_session_id uuid not null,
  status text not null default 'draft' check(status in ('draft','scheduled','running','paused','completed','cancelled')),
  template_snapshot jsonb not null,
  snapshot_hash text not null,
  template_values jsonb not null default '{}',
  delay_seconds integer not null default 5 check(delay_seconds between 5 and 3600),
  scheduled_at timestamptz,
  next_dispatch_at timestamptz,
  created_by uuid not null references auth.users(id),
  launched_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(organization_id,id),
  foreign key(organization_id,channel_session_id) references public.channel_sessions(organization_id,id)
);
create table if not exists public.customer_campaign_recipients (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  campaign_id uuid not null,
  contact_id uuid not null,
  conversation_id uuid not null,
  status text not null default 'pending' check(status in ('pending','sending','sent','failed','needs_review','cancelled')),
  last_error text,
  safe_to_retry boolean not null default false,
  unique(organization_id,id),
  unique(organization_id,campaign_id,contact_id),
  foreign key(organization_id,campaign_id) references public.customer_campaigns(organization_id,id) on delete cascade,
  foreign key(organization_id,contact_id) references public.contacts(organization_id,id),
  foreign key(organization_id,conversation_id) references public.conversations(organization_id,id)
);
create table if not exists public.customer_campaign_attempts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  recipient_id uuid not null,
  intended_message_id uuid not null unique,
  message_id uuid,
  state text not null default 'sending' check(state in ('sending','sent','failed','needs_review')),
  safe_to_retry boolean not null default false,
  error_code text,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  foreign key(organization_id,recipient_id) references public.customer_campaign_recipients(organization_id,id) on delete cascade,
  foreign key(organization_id,message_id) references public.messages(organization_id,id)
);
create unique index if not exists customer_campaign_single_sending on public.customer_campaign_attempts(organization_id,recipient_id) where state='sending';
create index if not exists customer_campaign_pending on public.customer_campaign_recipients(organization_id,campaign_id,status);
create index if not exists customer_campaign_attempt_history on public.customer_campaign_attempts(organization_id,recipient_id,started_at desc);
alter table public.customer_campaigns enable row level security;
alter table public.customer_campaign_recipients enable row level security;
alter table public.customer_campaign_attempts enable row level security;
drop policy if exists tenant_isolation_customer_campaigns_all on public.customer_campaigns;
create policy tenant_isolation_customer_campaigns_all on public.customer_campaigns for select to authenticated using(organization_id in (select public.fn_user_org_ids()));
drop policy if exists tenant_isolation_customer_campaign_recipients_all on public.customer_campaign_recipients;
create policy tenant_isolation_customer_campaign_recipients_all on public.customer_campaign_recipients for select to authenticated using(organization_id in (select public.fn_user_org_ids()));
drop policy if exists tenant_isolation_customer_campaign_attempts_all on public.customer_campaign_attempts;
create policy tenant_isolation_customer_campaign_attempts_all on public.customer_campaign_attempts for select to authenticated using(organization_id in (select public.fn_user_org_ids()));
revoke all on public.customer_campaigns,public.customer_campaign_recipients,public.customer_campaign_attempts from anon,authenticated;
grant select on public.customer_campaigns,public.customer_campaign_recipients,public.customer_campaign_attempts to authenticated;
grant all on public.customer_campaigns,public.customer_campaign_recipients,public.customer_campaign_attempts to service_role;
