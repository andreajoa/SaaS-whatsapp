-- Shopify/WooCommerce usam o catálogo e os pedidos existentes; produtos manuais preservados.
alter table public.tenant_integrations drop constraint if exists tenant_integrations_provider_check;
alter table public.tenant_integrations add constraint tenant_integrations_provider_check
  check (provider in ('nuvemshop','vtex','shopify','woocommerce'));
alter table public.orders drop constraint if exists orders_external_provider_check;
alter table public.orders add constraint orders_external_provider_check
  check (external_provider in ('nuvemshop','vtex','shopify','woocommerce'));
alter table public.catalog_products add column if not exists external_provider text;
alter table public.catalog_products add column if not exists external_id text;
alter table public.catalog_products add column if not exists external_sku text;
alter table public.catalog_products add column if not exists product_url text;
alter table public.catalog_products add column if not exists commerce_synced_at timestamptz;
create unique index if not exists catalog_products_external_key
  on public.catalog_products(organization_id,external_provider,external_id) where external_id is not null;
alter table public.tenant_integrations add column if not exists token_refresh_locked_until timestamptz;
alter table public.tenant_integrations add column if not exists commerce_resync_requested boolean not null default false;

create table if not exists public.commerce_sync_runs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  integration_id uuid not null references public.tenant_integrations(id) on delete cascade,
  status text not null default 'queued' check(status in ('queued','running','completed','failed','cancelled')),
  phase text not null default 'products' check(phase in ('products','orders','complete')),
  cursor text, product_count integer not null default 0, order_count integer not null default 0,
  started_at timestamptz not null default now(), completed_at timestamptz, error_code text,
  locked_until timestamptz, created_by uuid references auth.users(id) on delete set null
);
create unique index if not exists commerce_sync_one_active on public.commerce_sync_runs(integration_id)
  where status in ('queued','running');
alter table public.commerce_sync_runs enable row level security;
drop policy if exists tenant_isolation_commerce_sync_runs_all on public.commerce_sync_runs;
create policy tenant_isolation_commerce_sync_runs_all on public.commerce_sync_runs for select to authenticated
  using (organization_id in(select public.fn_user_org_ids()));
revoke all on public.commerce_sync_runs from anon, authenticated;
grant select on public.commerce_sync_runs to authenticated;
grant all on public.commerce_sync_runs to service_role;

create table if not exists public.commerce_oauth_states (
  nonce_hash text primary key, organization_id uuid not null references public.organizations(id) on delete cascade,
  actor_id uuid not null references auth.users(id) on delete cascade,
  auth_session_id uuid not null, shop text not null, expires_at timestamptz not null
);
alter table public.commerce_oauth_states enable row level security;
revoke all on public.commerce_oauth_states from public, anon, authenticated;
grant all on public.commerce_oauth_states to service_role;

create or replace function public.fn_commerce_oauth_allowed(p_org uuid,p_actor uuid,p_session uuid)
returns boolean language sql stable security definer set search_path=public as $$
 select exists(
   select 1 from auth.sessions a join public.organizations o on o.id=p_org
    where a.id=p_session and a.user_id=p_actor and (a.not_after is null or a.not_after>now()) and o.status='active'
      and (not exists(select 1 from auth.mfa_factors f where f.user_id=p_actor and f.status='verified') or a.aal::text='aal2')
      and (
        exists(select 1 from public.user_organizations u where u.user_id=p_actor and u.organization_id=p_org and u.role='admin' and u.accepted_at is not null)
        or exists(select 1 from public.platform_support_sessions s join public.platform_admins p on p.user_id=s.actor_user_id
          where s.organization_id=p_org and s.actor_user_id=p_actor and s.auth_session_id=p_session and s.ended_at is null and s.expires_at>now() and s.access_mode='full' and p.scope='full' and p.revoked_at is null)
      )
 ) and public.fn_support_callback_write_allowed(p_org,p_actor,p_session);
$$;
revoke execute on function public.fn_commerce_oauth_allowed(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.fn_commerce_oauth_allowed(uuid,uuid,uuid) to service_role;

-- Uma página e o próximo evento são confirmados juntos: sem fila fantasma.
create or replace function public.fn_commerce_checkpoint(p_org uuid,p_run uuid,p_phase text,p_cursor text,p_products integer,p_orders integer)
returns void language plpgsql security definer set search_path=public as $$
declare run public.commerce_sync_runs;
begin
  update public.commerce_sync_runs set phase=p_phase,cursor=p_cursor,
    product_count=product_count+p_products,order_count=order_count+p_orders,locked_until=null,
    status=case when p_phase='complete' then 'completed' else 'queued' end,
    completed_at=case when p_phase='complete' then now() else null end
    where id=p_run and organization_id=p_org and status='running' returning * into run;
  if run.id is null then raise exception 'commerce_run_not_claimed'; end if;
  if p_phase='complete' then
    update public.tenant_integrations set last_sync_at=now(),status='healthy',status_reason=null
      where id=run.integration_id and organization_id=p_org and status <> 'disconnected';
    if exists(select 1 from public.tenant_integrations where id=run.integration_id and organization_id=p_org and commerce_resync_requested and status <> 'disconnected') then
      update public.tenant_integrations set commerce_resync_requested=false where id=run.integration_id and organization_id=p_org;
      perform public.fn_commerce_begin_sync(p_org,run.integration_id);
    end if;
  else
    perform public.emit_event('commerce.sync_requested','commerce_sync',p_run,jsonb_build_object('run_id',p_run),'{}'::jsonb,p_org);
  end if;
end $$;
revoke execute on function public.fn_commerce_checkpoint(uuid,uuid,text,text,integer,integer) from public,anon,authenticated;
grant execute on function public.fn_commerce_checkpoint(uuid,uuid,text,text,integer,integer) to service_role;

create or replace function public.fn_commerce_begin_sync(p_org uuid,p_integration uuid,p_actor uuid default null)
returns uuid language plpgsql security definer set search_path=public as $$
declare run_id uuid;
begin
  perform 1 from public.tenant_integrations where id=p_integration and organization_id=p_org and provider in('shopify','woocommerce') and status <> 'disconnected' for update;
  if not found then
    raise exception 'commerce_integration_unavailable';
  end if;
  select id into run_id from public.commerce_sync_runs where integration_id=p_integration and organization_id=p_org and status in('queued','running');
  if run_id is not null then return run_id; end if;
  insert into public.commerce_sync_runs(organization_id,integration_id,created_by)
    values(p_org,p_integration,p_actor) returning id into run_id;
  perform public.emit_event('commerce.sync_requested','commerce_sync',run_id,jsonb_build_object('run_id',run_id),'{}'::jsonb,p_org);
  return run_id;
exception when unique_violation then
  select id into run_id from public.commerce_sync_runs where integration_id=p_integration and organization_id=p_org and status in('queued','running');
  return run_id;
end $$;
revoke execute on function public.fn_commerce_begin_sync(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.fn_commerce_begin_sync(uuid,uuid,uuid) to service_role;

create or replace function public.fn_commerce_store_page(p_org uuid,p_run uuid,p_lock timestamptz,p_products jsonb,p_orders jsonb,p_phase text,p_cursor text)
returns void language plpgsql security definer set search_path=public as $$
declare run public.commerce_sync_runs; connection public.tenant_integrations;
begin
  select * into run from public.commerce_sync_runs where id=p_run and organization_id=p_org;
  if run.id is null then raise exception 'commerce_stale_claim'; end if;
  select * into connection from public.tenant_integrations where id=run.integration_id and organization_id=p_org for update;
  if connection.id is null or connection.status='disconnected' then raise exception 'commerce_disconnected'; end if;
  select * into run from public.commerce_sync_runs where id=p_run and organization_id=p_org for update;
  if run.status <> 'running' or run.locked_until is distinct from p_lock then raise exception 'commerce_stale_claim'; end if;
  insert into public.catalog_products(organization_id,codigo,nome,descricao,marca,categoria,preco_cents,moeda,controla_estoque,quantidade,ativo,origem,imagem_url,external_provider,external_id,external_sku,product_url,commerce_synced_at)
    select p_org,connection.provider||':'||p.external_id,p.name,p.description,p.brand,p.category,p.price_cents,p.currency,p.tracks_inventory,p.quantity,p.active,connection.provider,p.image_url,connection.provider,p.external_id,p.sku,p.url,now()
      from jsonb_to_recordset(p_products) as p(external_id text,sku text,name text,description text,brand text,category text,price_cents bigint,currency text,tracks_inventory boolean,quantity integer,active boolean,image_url text,url text)
    on conflict(organization_id,codigo) do update set nome=excluded.nome,descricao=excluded.descricao,marca=excluded.marca,categoria=excluded.categoria,preco_cents=excluded.preco_cents,moeda=excluded.moeda,controla_estoque=excluded.controla_estoque,quantidade=excluded.quantidade,ativo=excluded.ativo,imagem_url=excluded.imagem_url,external_sku=excluded.external_sku,product_url=excluded.product_url,commerce_synced_at=excluded.commerce_synced_at
      where catalog_products.external_provider=connection.provider and catalog_products.external_id=excluded.external_id;
  insert into public.orders(organization_id,external_id,external_provider,customer_external_id,contact_id,status,total_cents,currency,tracking_code,ordered_at,updated_at_remote)
    select p_org,o.external_id,connection.provider,o.customer_external_id,
      case when exists(select 1 from public.contacts c where c.id=o.contact_id and c.organization_id=p_org and not c.is_anonymized) then o.contact_id else null end,
      o.status,o.total_cents,o.currency,o.tracking_code,o.ordered_at,o.updated_at_remote
    from jsonb_to_recordset(p_orders) as o(external_id text,customer_external_id text,contact_id uuid,status text,total_cents bigint,currency text,tracking_code text,ordered_at timestamptz,updated_at_remote timestamptz)
    on conflict(organization_id,external_provider,external_id) do update set
      status=excluded.status,total_cents=excluded.total_cents,currency=excluded.currency,tracking_code=excluded.tracking_code,
      updated_at_remote=excluded.updated_at_remote,contact_id=coalesce(orders.contact_id,excluded.contact_id)
    where not orders.is_anonymized and (orders.updated_at_remote is null or excluded.updated_at_remote >= orders.updated_at_remote);
  if run.phase='products' and p_phase='orders' then
    update public.catalog_products set ativo=false where organization_id=p_org and external_provider=connection.provider and commerce_synced_at < run.started_at;
  end if;
  perform public.fn_commerce_checkpoint(p_org,p_run,p_phase,p_cursor,jsonb_array_length(p_products),jsonb_array_length(p_orders));
end $$;
revoke execute on function public.fn_commerce_store_page(uuid,uuid,timestamptz,jsonb,jsonb,text,text) from public,anon,authenticated;
grant execute on function public.fn_commerce_store_page(uuid,uuid,timestamptz,jsonb,jsonb,text,text) to service_role;

-- Recebimento e fila na mesma transação. Nenhum payload com PII é arquivado.
create table if not exists public.commerce_webhook_receipts (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  integration_id uuid not null references public.tenant_integrations(id) on delete cascade,
  external_id text not null, topic text not null, received_at timestamptz not null default now(),
  primary key(organization_id,integration_id,external_id)
);
alter table public.commerce_webhook_receipts enable row level security;
revoke all on public.commerce_webhook_receipts from public,anon,authenticated;
grant all on public.commerce_webhook_receipts to service_role;
create or replace function public.fn_commerce_webhook(p_org uuid,p_integration uuid,p_external text,p_topic text)
returns boolean language plpgsql security definer set search_path=public as $$
begin
  perform 1 from public.tenant_integrations where id=p_integration and organization_id=p_org for update;
  if not found then raise exception 'commerce_integration_unavailable'; end if;
  insert into public.commerce_webhook_receipts(organization_id,integration_id,external_id,topic) values(p_org,p_integration,p_external,p_topic) on conflict do nothing;
  if not found then return false; end if;
  if p_topic='app/uninstalled' then
    update public.tenant_integrations set status='disconnected',status_reason='Aplicativo removido da loja.',oauth_access_token_encrypted='\x'::bytea,oauth_refresh_token_encrypted=null where id=p_integration and organization_id=p_org;
    update public.commerce_sync_runs set status='cancelled',locked_until=null,completed_at=now() where integration_id=p_integration and organization_id=p_org and status in('queued','running');
    update public.catalog_products set ativo=false where organization_id=p_org and external_provider='shopify';
  else
    if exists(select 1 from public.commerce_sync_runs where integration_id=p_integration and organization_id=p_org and status in('queued','running')) then
      update public.tenant_integrations set commerce_resync_requested=true where id=p_integration and organization_id=p_org;
    else
      perform public.fn_commerce_begin_sync(p_org,p_integration);
    end if;
  end if;
  return true;
end $$;
revoke execute on function public.fn_commerce_webhook(uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.fn_commerce_webhook(uuid,uuid,text,text) to service_role;

create or replace function public.fn_commerce_disconnect(p_org uuid,p_provider text)
returns void language plpgsql security definer set search_path=public as $$
declare v_integration_id uuid;
begin
  update public.tenant_integrations set status='disconnected',status_reason=null,oauth_access_token_encrypted='\x'::bytea,oauth_refresh_token_encrypted=null,token_refresh_locked_until=null,commerce_resync_requested=false
    where organization_id=p_org and provider=p_provider and provider in('shopify','woocommerce') returning id into v_integration_id;
  if v_integration_id is not null then
    update public.commerce_sync_runs set status='cancelled',locked_until=null,completed_at=now() where organization_id=p_org and integration_id=v_integration_id and status in('queued','running');
    update public.catalog_products set ativo=false where organization_id=p_org and external_provider=p_provider;
  end if;
end $$;
revoke execute on function public.fn_commerce_disconnect(uuid,text) from public,anon,authenticated;
grant execute on function public.fn_commerce_disconnect(uuid,text) to service_role;

-- Uma única loja por provedor/organização. IDs numéricos WooCommerce podem
-- colidir entre lojas; reaproveitar a conexão sobrescreveria pedidos históricos.
create or replace function public.fn_commerce_keep_store_identity() returns trigger
language plpgsql set search_path = public, pg_temp as $$
begin
  if old.provider in ('shopify','woocommerce') and old.store_metadata->>'store_url' is not null
    and new.store_metadata->>'store_url' is distinct from old.store_metadata->>'store_url' then
    raise exception 'commerce_store_change_requires_new_organization';
  end if;
  return new;
end $$;
revoke all on function public.fn_commerce_keep_store_identity() from public, anon, authenticated;
drop trigger if exists tr_commerce_keep_store_identity on public.tenant_integrations;
create trigger tr_commerce_keep_store_identity before update on public.tenant_integrations
  for each row execute function public.fn_commerce_keep_store_identity();
