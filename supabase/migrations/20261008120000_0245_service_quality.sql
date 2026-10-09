-- Qualidade sobre o atendimento existente. Sem tickets paralelos, metas opt-in,
-- tempo corrido (inclusive pausas/noites). Não agenda nem envia mensagens.
create table if not exists public.service_quality_policies (
 organization_id uuid primary key references public.organizations(id) on delete cascade,
 enabled boolean not null default false,
 first_response_target_seconds integer check (first_response_target_seconds > 0),
 resolution_target_seconds integer check (resolution_target_seconds > 0),
 clock_mode text not null default 'elapsed' check (clock_mode = 'elapsed'),
 updated_at timestamptz not null default now(),
 constraint service_quality_enabled_targets check (not enabled or first_response_target_seconds is not null or resolution_target_seconds is not null)
);
create table if not exists public.service_quality_surveys (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.organizations(id) on delete cascade,
 conversation_id uuid not null references public.conversations(id) on delete cascade,
 service_started_at timestamptz,
 token_hash text not null unique check (token_hash ~ '^[a-f0-9]{64}$'),
 requested_by_user_id uuid references auth.users(id) on delete set null,
 created_at timestamptz not null default now(),
 expires_at timestamptz not null,
 responded_at timestamptz,
 score smallint check (score between 1 and 5),
 comment text check (char_length(comment) <= 2000),
 constraint service_quality_survey_expiry check (expires_at > created_at),
 constraint service_quality_survey_response check ((responded_at is null and score is null and comment is null) or (responded_at is not null and score is not null))
);
create index if not exists service_quality_surveys_conversation_idx on public.service_quality_surveys(organization_id, conversation_id, created_at desc);
create index if not exists service_quality_messages_clock_idx on public.messages(organization_id, conversation_id, sent_at) where revoked_at is null;
alter table public.service_quality_policies enable row level security;
alter table public.service_quality_surveys enable row level security;
-- ALL restritiva aplica isolamento mesmo às policies de escrita.
drop policy if exists tenant_isolation_service_quality_policies_all on public.service_quality_policies;
create policy tenant_isolation_service_quality_policies_all on public.service_quality_policies as restrictive for all to authenticated
 using (organization_id in (select public.fn_user_org_ids())) with check (organization_id in (select public.fn_user_org_ids()));
drop policy if exists service_quality_policies_read on public.service_quality_policies;
create policy service_quality_policies_read on public.service_quality_policies for select to authenticated using (true);
drop policy if exists service_quality_policies_write on public.service_quality_policies;
create policy service_quality_policies_write on public.service_quality_policies for all to authenticated
 using (public.fn_role_at_least(organization_id,'manager') and public.fn_support_write_allowed(organization_id))
 with check (public.fn_role_at_least(organization_id,'manager') and public.fn_support_write_allowed(organization_id));
drop policy if exists tenant_isolation_service_quality_surveys_all on public.service_quality_surveys;
create policy tenant_isolation_service_quality_surveys_all on public.service_quality_surveys as restrictive for all to authenticated
 using (organization_id in (select public.fn_user_org_ids())) with check (organization_id in (select public.fn_user_org_ids()));
drop policy if exists service_quality_surveys_read on public.service_quality_surveys;
create policy service_quality_surveys_read on public.service_quality_surveys for select to authenticated using (exists (
 select 1 from public.conversations c where c.id=conversation_id and c.organization_id=service_quality_surveys.organization_id
 and public.fn_can_view_conversation(c.organization_id,c.assigned_to_user_id)));
revoke all on public.service_quality_policies, public.service_quality_surveys from public, anon, authenticated;
grant select, insert, update on public.service_quality_policies to authenticated;
-- Hash nunca sai pela API autenticada/cliente.
grant select (id,organization_id,conversation_id,service_started_at,requested_by_user_id,created_at,expires_at,responded_at,score,comment) on public.service_quality_surveys to authenticated;
grant select,insert,update,delete on public.service_quality_policies,public.service_quality_surveys to service_role;

-- Fatos calculados no banco: não há limite oculto de 1000 mensagens do PostgREST.
-- RLS de conversations/messages permanece ativa: atendente não ganha escopo extra.
create or replace function public.fn_service_quality_facts(p_org uuid,p_after uuid default null,p_limit integer default 50,p_conversation uuid default null)
returns jsonb language sql stable security invoker set search_path=public,pg_temp as $fn$
 with selected as (
 select c.* from public.conversations c where c.organization_id=p_org and not c.is_group
 and (p_after is null or c.id>p_after) and (p_conversation is null or c.id=p_conversation)
 order by c.id limit least(greatest(p_limit,1),101)
 ), facts as (
 select c.id as conversation_id,c.status,c.service_started_at,
 case when c.status in ('closed','resolved','archived') then c.service_closed_at end as closed_at,
 inbound.first_inbound_at,response.first_response_at
 from selected c
 left join lateral (select min(m.sent_at) as first_inbound_at from public.messages m
  where m.organization_id=p_org and m.conversation_id=c.id and m.direction='inbound' and m.revoked_at is null
  and m.sent_at>=coalesce(c.service_started_at,c.created_at)
  and (c.status not in ('closed','resolved','archived') or m.sent_at<=c.service_closed_at)) inbound on true
 left join lateral (select min(m.sent_at) as first_response_at from public.messages m
  where m.organization_id=p_org and m.conversation_id=c.id and m.direction='outbound' and m.revoked_at is null
  and m.status in ('sent','delivered','read') and m.sent_at>=inbound.first_inbound_at
  and (c.status not in ('closed','resolved','archived') or m.sent_at<=c.service_closed_at)) response on true
 ) select coalesce(jsonb_agg(to_jsonb(facts) order by conversation_id),'[]'::jsonb) from facts;
$fn$;
revoke execute on function public.fn_service_quality_facts(uuid,uuid,integer,uuid) from public,anon;
grant execute on function public.fn_service_quality_facts(uuid,uuid,integer,uuid) to authenticated,service_role;

-- Criação é explícita e exclusivamente por gerente autenticado; verifica vínculo
-- antes de inserir para impedir survey org A -> conversa org B até via RPC.
create or replace function public.fn_service_quality_request(p_org uuid,p_conversation uuid,p_hash text,p_expires timestamptz)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $fn$
declare c public.conversations; s public.service_quality_surveys;
begin
 if auth.uid() is null or not public.fn_role_at_least(p_org,'manager') or not public.fn_support_write_allowed(p_org) then
  raise exception 'forbidden' using errcode='42501'; end if;
 select * into c from public.conversations where organization_id=p_org and id=p_conversation and not is_group for share;
 if not found then raise exception 'conversation_not_found' using errcode='P0002'; end if;
 if p_expires<=clock_timestamp() or p_expires>clock_timestamp()+interval '30 days' then
  raise exception 'invalid_expiration' using errcode='22023'; end if;
 insert into public.service_quality_surveys(organization_id,conversation_id,service_started_at,token_hash,requested_by_user_id,expires_at)
 values(p_org,c.id,c.service_started_at,p_hash,auth.uid(),p_expires) returning * into s;
 return jsonb_build_object('id',s.id,'conversation_id',s.conversation_id,'expires_at',s.expires_at);
end;
$fn$;
revoke execute on function public.fn_service_quality_request(uuid,uuid,text,timestamptz) from public,anon,service_role;
grant execute on function public.fn_service_quality_request(uuid,uuid,text,timestamptz) to authenticated;

-- Única porta de resgate: hash forte identifica tenant, não aceita org do visitante.
-- Compare-and-set garante uso único inclusive para duas submissões simultâneas.
create or replace function public.fn_service_quality_respond(p_hash text,p_score integer,p_comment text default null)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $fn$
declare s public.service_quality_surveys;
begin
 if p_score is null or p_score not between 1 and 5 or char_length(p_comment)>2000 then
  raise exception 'invalid_feedback' using errcode='22023'; end if;
 update public.service_quality_surveys set score=p_score,comment=nullif(btrim(p_comment),''),responded_at=clock_timestamp()
 where token_hash=p_hash and responded_at is null and expires_at>clock_timestamp() returning * into s;
 if not found then return null; end if;
 -- Somente identificadores/nota no audit; comentário é dado privado da conversa.
 insert into public.api_audit_log(organization_id,action,resource_type,resource_id,bypassed_rls,metadata)
 values(s.organization_id,'conversation.note_added','service_quality_surveys',s.id,true,
 jsonb_build_object('service_quality_action','csat.responded','conversation_id',s.conversation_id,'score',s.score));
 return jsonb_build_object('id',s.id,'organization_id',s.organization_id,'conversation_id',s.conversation_id,'score',s.score,'responded_at',s.responded_at);
end;
$fn$;
revoke execute on function public.fn_service_quality_respond(text,integer,text) from public,anon,authenticated;
grant execute on function public.fn_service_quality_respond(text,integer,text) to service_role;

-- Resumo considera TODAS as avaliações das conversas selecionadas; histórico
-- visual limitado é declarado, não vira média silenciosamente truncada.
create or replace function public.fn_service_quality_surveys(p_org uuid,p_conversations uuid[],p_limit integer default 100)
returns jsonb language sql stable security invoker set search_path=public,pg_temp as $fn$
 with visible as (
 select id,conversation_id,created_at,expires_at,responded_at,score,comment
 from public.service_quality_surveys where organization_id=p_org and conversation_id=any(p_conversations)
 ), history as (select * from visible order by created_at desc,id desc limit least(greatest(p_limit,1),100)), summary as (
 select count(*) as total,count(score) as csat_responses,avg(score) as csat_average,
 count(*) filter(where score<=2) as csat_low_scores,
 count(*) filter(where responded_at is null and expires_at>now()) as pending_surveys,
 count(*) filter(where responded_at is null and expires_at<=now()) as expired_surveys from visible
 ) select jsonb_build_object('surveys',coalesce((select jsonb_agg(to_jsonb(h) order by created_at desc,id desc) from history h),'[]'::jsonb),'summary',(select to_jsonb(summary) from summary));
$fn$;
revoke execute on function public.fn_service_quality_surveys(uuid,uuid[],integer) from public,anon;
grant execute on function public.fn_service_quality_surveys(uuid,uuid[],integer) to authenticated,service_role;

-- FK composta: o vínculo de tenant é propriedade do banco, inclusive para ingestão service_role.
create unique index if not exists service_quality_conversation_tenant_key on public.conversations(organization_id,id);
do $guard$
begin
 if not exists(select 1 from pg_constraint where conname='service_quality_surveys_tenant_conversation_fk' and conrelid='public.service_quality_surveys'::regclass) then
  alter table public.service_quality_surveys add constraint service_quality_surveys_tenant_conversation_fk foreign key(organization_id,conversation_id) references public.conversations(organization_id,id) on delete cascade;
 end if;
end;
$guard$;
