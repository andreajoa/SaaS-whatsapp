-- Configuração exclusiva do operador. Aplicar não ativa campanha nem presume consentimento.
alter table public.site_leads add column if not exists marketing_opt_in_em timestamptz;
alter table public.site_leads add column if not exists marketing_opt_in_origem text;
alter table public.email_envios add column if not exists tentativas integer not null default 1;
alter table public.email_envios add column if not exists ultima_tentativa_em timestamptz;

create table if not exists public.marketing_automacoes (
  id text primary key,
  enabled boolean not null default false,
  audience text not null default 'nao_assinantes',
  starts_at timestamptz,
  ends_at timestamptz,
  textos jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  constraint marketing_automacoes_audience_check check (audience in ('nao_assinantes','assinantes','todos','cadastro_sem_assinatura','transacional')),
  constraint marketing_automacoes_janela_check check (ends_at is null or (starts_at is not null and ends_at > starts_at))
);
alter table public.marketing_automacoes enable row level security;
revoke all on public.marketing_automacoes from public, anon, authenticated;
grant all on public.marketing_automacoes to service_role;
drop trigger if exists trg_marketing_automacoes_updated_at on public.marketing_automacoes;
create trigger trg_marketing_automacoes_updated_at before update on public.marketing_automacoes
  for each row execute function public.fn_set_updated_at();
comment on table public.marketing_automacoes is 'Configuração revisada no /dashboard/automacoes. Deny-all: só o operador autenticado pela porta própria e o cron de serviço.';
comment on column public.site_leads.marketing_opt_in_em is 'Consentimento explícito para mensagens comerciais. Cadastro, compra e confirmação da conta não preenchem esta coluna. Sem backfill de consentimento legado.';

-- Claim, supressão, público atual e relógio comum na MESMA transação.
-- Não faz HTTP. agendado de resultado desconhecido nunca é reenviado automaticamente.
create or replace function public.fn_claim_marketing_envio(
  p_lead_id uuid, p_mensagem text, p_assunto text, p_marketing boolean,
  p_campanha text default null
) returns uuid
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_lead public.site_leads%rowtype;
  v_config public.marketing_automacoes%rowtype;
  v_envio public.email_envios%rowtype;
  v_assinante boolean;
  v_agora timestamptz := clock_timestamp();
begin
  select * into v_lead from public.site_leads where id = p_lead_id for update;
  if not found or v_lead.status in ('bounce','reclamou') then return null; end if;
  if exists (select 1 from public.email_envios where lead_id = p_lead_id and status in ('bounce','reclamou')) then return null; end if;
  if p_marketing and (v_lead.marketing_opt_in_em is null or v_lead.descadastrado_em is not null or v_lead.status not in ('inscrito','confirmado')) then return null; end if;

  if p_campanha is not null then
    select * into v_config from public.marketing_automacoes where id = p_campanha for share;
    if not found then
      if p_marketing or p_campanha <> 'pagamento-falhou' then return null; end if;
    elsif not v_config.enabled then return null; end if;
    if p_marketing then
      if v_config.starts_at is null or v_config.ends_at is null or v_agora < v_config.starts_at or v_agora >= v_config.ends_at then return null; end if;
      -- Informação de billing atual, não o marco histórico assinou_em.
      select exists (select 1 from public.org_subscriptions s where (s.organization_id = v_lead.organization_id or exists (select 1 from public.user_organizations u where u.user_id = v_lead.user_id and u.organization_id = s.organization_id and u.revoked_at is null)) and s.status in ('active','trialing','past_due','unpaid','paused','incomplete')) into v_assinante;
      if v_config.audience = 'assinantes' and not v_assinante then return null; end if;
      if v_config.audience in ('nao_assinantes','cadastro_sem_assinatura') and v_assinante then return null; end if;
      if v_config.audience = 'cadastro_sem_assinatura' and (v_lead.user_id is null or v_lead.virou_usuario_em is null or v_lead.virou_usuario_em > v_agora - interval '24 hours') then return null; end if;
      if v_config.audience = 'transacional' then return null; end if;
    end if;
  end if;

  select * into v_envio from public.email_envios where lead_id = p_lead_id and mensagem = p_mensagem for update;
  if found then
    -- Só 429 conhecido é retentável. Até 3 tentativas, dentro da janela de
    -- idempotência de 24 h do provedor, e nunca para falha de rede ambígua.
    if v_envio.status <> 'falhou' or coalesce(v_envio.erro,'') not like 'rate_limited:%'
      or v_envio.tentativas >= 3 or v_envio.created_at <= v_agora - interval '23 hours'
      or coalesce(v_envio.ultima_tentativa_em,v_envio.created_at) > v_agora - interval '10 minutes' then return null; end if;
    update public.email_envios set status = 'agendado', tentativas = tentativas + 1,
      ultima_tentativa_em = v_agora where id = v_envio.id;
    return v_envio.id;
  end if;

  if p_marketing and v_lead.ultimo_envio_em > v_agora - interval '24 hours' then return null; end if;
  insert into public.email_envios (lead_id,mensagem,assunto,status,agendado_para,ultima_tentativa_em)
    values (p_lead_id,p_mensagem,p_assunto,'agendado',v_agora,v_agora) returning id into v_envio.id;
  if p_marketing then update public.site_leads set ultimo_envio_em = v_agora where id = p_lead_id; end if;
  return v_envio.id;
end $$;
revoke all on function public.fn_claim_marketing_envio(uuid,text,text,boolean,text) from public, anon, authenticated;
grant execute on function public.fn_claim_marketing_envio(uuid,text,text,boolean,text) to service_role;

-- Elegibilidade ANTES do limite: leads já enviados ou fora do público não
-- ocupam os primeiros lugares para sempre e não deixam os seguintes sem envio.
create or replace function public.fn_marketing_calendario_candidatos(
  p_campanhas text[], p_limite integer default 30
) returns jsonb
language sql stable security definer set search_path = public, pg_temp
as $$
  with elegiveis as (
    select l.id,l.email,l.idioma,l.user_id,l.token_descadastro,l.ultimo_envio_em,
      a.id as campanha,
      row_number() over (partition by l.id order by (e.id is not null) desc,a.starts_at,a.id) as prioridade
    from public.site_leads l
    join public.marketing_automacoes a on a.id = any(p_campanhas)
    left join public.email_envios e on e.lead_id = l.id and e.mensagem =
      a.id || '#' || case when a.id = 'cadastro-sem-assinatura' then l.user_id::text
      else extract(year from a.starts_at at time zone 'America/Sao_Paulo')::integer::text end
    where a.enabled and a.starts_at <= now() and a.ends_at > now()
      and l.marketing_opt_in_em is not null and l.descadastrado_em is null
      and l.status in ('inscrito','confirmado')
      and not exists (select 1 from public.email_envios s where s.lead_id = l.id and s.status in ('bounce','reclamou'))
      and (a.audience = 'todos' or
        (a.audience = 'assinantes' and exists (select 1 from public.org_subscriptions b where
          (b.organization_id = l.organization_id or exists (select 1 from public.user_organizations u where u.user_id = l.user_id and u.organization_id = b.organization_id and u.revoked_at is null))
          and b.status in ('active','trialing','past_due','unpaid','paused','incomplete'))) or
        (a.audience in ('nao_assinantes','cadastro_sem_assinatura') and not exists (select 1 from public.org_subscriptions b where
          (b.organization_id = l.organization_id or exists (select 1 from public.user_organizations u where u.user_id = l.user_id and u.organization_id = b.organization_id and u.revoked_at is null))
          and b.status in ('active','trialing','past_due','unpaid','paused','incomplete'))))
      and (a.audience <> 'cadastro_sem_assinatura' or (l.user_id is not null and l.virou_usuario_em <= now() - interval '24 hours'))
      and ((e.id is null and (l.ultimo_envio_em is null or l.ultimo_envio_em <= now() - interval '24 hours')) or
        (e.status = 'falhou' and e.erro like 'rate_limited:%' and e.tentativas < 3 and e.created_at > now() - interval '23 hours'
          and coalesce(e.ultima_tentativa_em,e.created_at) <= now() - interval '10 minutes')))
  ), lote as (
    select id,email,idioma,user_id,token_descadastro,campanha from elegiveis where prioridade = 1
    order by ultimo_envio_em asc nulls first,id
    limit greatest(0,least(coalesce(p_limite,30),30))
  ) select coalesce(jsonb_agg(to_jsonb(lote)),'[]'::jsonb) from lote;
$$;
revoke all on function public.fn_marketing_calendario_candidatos(text[],integer) from public, anon, authenticated;
grant execute on function public.fn_marketing_calendario_candidatos(text[],integer) to service_role;
notify pgrst, 'reload schema';
