-- 0240 — O FUNIL DO SITE: visita, lead, e-mail e checkout abandonado.
--
-- ─── O buraco que isto fecha ────────────────────────────────────────────────
--
-- A instalação que COBRA (`instalacaoCobra()`, `lib/billing/planos.ts`) tem uma
-- página pública, um checkout e um webhook do Stripe — e, entre a visita e a
-- assinatura, NENHUMA memória. Quem chegou, de onde veio, de que cidade, o que
-- leu, se deixou o e-mail, se recebeu a sequência, se abriu, se começou o
-- checkout e desistiu: tudo isso acontecia e não era escrito em lugar nenhum.
-- O efeito prático não é "falta de relatório", é que NÃO HÁ FOLLOW-UP POSSÍVEL:
-- sem a linha, não existe a quem reenviar, e o carrinho abandonado é abandonado
-- de verdade.
--
-- ─── Por que cinco tabelas e não uma ────────────────────────────────────────
--
-- Elas têm CICLOS DE VIDA diferentes, e é isso que as separa — não o assunto:
--
--   `site_visits`      — append-only, alto volume, expurgável por idade. É a
--                        única sem identidade: um `visitor_id` de cookie
--                        primário, nunca um e-mail. Guardar visita dentro de
--                        `site_leads` faria o expurgo de visita apagar o lead.
--   `site_leads`       — a PESSOA, uma linha por e-mail, viva para sempre (ou
--                        até o descadastro). É a chave de tudo o mais.
--   `email_envios`     — uma linha por (lead, mensagem), com `unique` — o que
--                        torna o disparo IDEMPOTENTE: o cron pode rodar duas
--                        vezes no mesmo minuto e ninguém recebe o e-mail 14
--                        duas vezes. Este único índice é metade do valor do
--                        arquivo.
--   `email_eventos`    — append-only, um por evento do provedor, com o id DELE
--                        em `unique`: o Resend reentrega webhook, e sem isto
--                        uma abertura viraria três.
--   `checkout_tentativas` — o estado de UMA sessão do Stripe. Não cabe em
--                        `org_subscriptions`, que é a assinatura VIGENTE: a
--                        tentativa que falhou não é uma assinatura, e escrevê-la
--                        lá daria acesso a quem não pagou.
--
-- ─── Por que o conteúdo dos 15 e-mails NÃO está aqui ────────────────────────
--
-- As mensagens da sequência são CÓDIGO, não dado: assunto, corpo, atraso e
-- condição de envio vivem em TypeScript (`lib/marketing/sequencia.ts`), sob
-- revisão de PR e sob os mesmos testes do resto. No banco fica só o `mensagem`
-- — o identificador do passo. Uma tabela `email_templates` pareceria mais
-- flexível e seria pior: o corpo passaria a ser dado editável sem revisão, o
-- `update.sh` de um clone teria de semeá-lo, e um clone com semeadura parcial
-- mandaria e-mail pela metade para gente de verdade.
--
-- ─── Por que TODAS são deny-all, sem policy de tenant ───────────────────────
--
-- Nenhuma delas é dado de tenant: são o livro-razão do OPERADOR DA PLATAFORMA
-- sobre o próprio funil de vendas. Um `admin` de organização que as lesse veria
-- o e-mail, a cidade e o plano de TODOS OS OUTROS CLIENTES — vazamento entre
-- concorrentes com a anon key. Por isso a postura de `billing_webhook_events`
-- (0239) e de `platform_google_oauth` (0201): RLS ligada, ZERO policies,
-- privilégio revogado de `anon` e de `authenticated`, tudo para `service_role`.
-- Quem lê é o servidor, no `/dashboard`, atrás de senha própria.
--
-- `site_leads` e `checkout_tentativas` carregam `organization_id` (nullable,
-- `on delete set null`) porque a pergunta "quem virou cliente e de que
-- organização" é o fecho do funil. Isso as põe na varredura de completude de
-- RLS — entram em `PROVA_PROPRIA` com prova comportamental própria em
-- `tests/invariants/funil-do-site-rls.test.ts`, nunca em `DEBITO_CONHECIDO`.
--
-- ─── Self-host não é afetado ────────────────────────────────────────────────
--
-- As tabelas nascem em todo clone para que as migrations sejam as mesmas em
-- todo lugar, e ficam vazias: a página pública só existe quando
-- `instalacaoCobra()` é verdadeiro, e nada escreve aqui sem ela. Tabela vazia
-- não cobra, não envia e não rastreia ninguém.

-- ── 1. A visita ────────────────────────────────────────────────────────────
--
-- Sem e-mail, sem nome e sem IP. O `visitor_id` é um opaco de cookie primário;
-- o mais perto de endereço que se guarda é `postal_code`, que é o que o
-- roteamento de borda entrega. GUARDAR IP seria dado pessoal por definição da
-- LGPD, com retenção e direito de acesso atrelados, para responder a uma
-- pergunta ("de que cidade?") que `city` já responde.

create table if not exists public.site_visits (
  id uuid primary key default uuid_generate_v4(),
  created_at timestamptz not null default now(),
  visitor_id text not null,
  session_id text,
  path text not null,
  referrer text,
  referrer_host text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_content text,
  utm_term text,
  country text,
  region text,
  city text,
  postal_code text,
  latitude text,
  longitude text,
  device text,
  idioma text,
  moeda text
);

create index if not exists site_visits_created_idx
  on public.site_visits (created_at desc);
create index if not exists site_visits_visitor_idx
  on public.site_visits (visitor_id, created_at desc);
create index if not exists site_visits_origem_idx
  on public.site_visits (referrer_host, created_at desc)
  where referrer_host is not null;
create index if not exists site_visits_campanha_idx
  on public.site_visits (utm_campaign, created_at desc)
  where utm_campaign is not null;

alter table public.site_visits enable row level security;
revoke all on public.site_visits from anon, authenticated;
grant all on public.site_visits to service_role;

comment on table public.site_visits is
  'Uma linha por visita à página pública. Deny-all: livro-razão do operador da plataforma, não dado de tenant. Sem IP e sem e-mail de propósito — o vínculo com a pessoa só existe quando ela deixa o e-mail e vira site_leads, pelo visitor_id.';
comment on column public.site_visits.postal_code is
  'O mais perto de "bairro" que a borda entrega — ela não devolve bairro. Aproximação honesta, não o bairro.';

-- ── 2. A pessoa ────────────────────────────────────────────────────────────
--
-- Uma linha por e-mail, `citext` não existe aqui: o e-mail é normalizado para
-- minúsculas na aplicação ANTES do insert e o índice único é sobre a coluna
-- crua. Ligar a extensão por causa de uma coluna custaria ao `install.sh` de
-- todo clone uma dependência que só esta tabela usa.
--
-- `token_descadastro` é `not null` com default: o descadastro de um clique é
-- exigência de CAN-SPAM/LGPD e do próprio Gmail (`List-Unsubscribe`), e um
-- token nullable produziria, no primeiro lead semeado sem ele, um link de
-- descadastro quebrado — o defeito que mais custa reputação de domínio.

create table if not exists public.site_leads (
  id uuid primary key default uuid_generate_v4(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  email text not null,
  nome text,
  telefone text,
  empresa text,
  mensagem text,
  origem text not null default 'popup',
  visitor_id text,
  country text,
  region text,
  city text,
  idioma text,
  moeda text,
  status text not null default 'inscrito',
  confirmado_em timestamptz,
  descadastrado_em timestamptz,
  token_descadastro text not null default replace(uuid_generate_v4()::text, '-', ''),
  ultimo_envio_em timestamptz,
  proximo_passo integer not null default 0,
  user_id uuid references auth.users(id) on delete set null,
  organization_id uuid references public.organizations(id) on delete set null,
  virou_usuario_em timestamptz,
  assinou_em timestamptz,
  plano text
);

-- Dados antes da constraint: o `update.sh` de um clone roda sem ON_ERROR_STOP,
-- e uma constraint que falha deixa o resto do apêndice por aplicar.
update public.site_leads
  set origem = 'popup'
  where origem is null or origem not in ('popup', 'rodape', 'contato', 'checkout', 'signup');

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'site_leads_origem_check'
  ) then
    alter table public.site_leads add constraint site_leads_origem_check
      check (origem = any (array['popup'::text, 'rodape'::text, 'contato'::text, 'checkout'::text, 'signup'::text]));
  end if;
end $$;

-- Dados antes da constraint: o `update.sh` de um clone roda sem ON_ERROR_STOP,
-- e uma constraint que falha deixa o resto do apêndice por aplicar.
update public.site_leads
  set status = 'inscrito'
  where status is null or status not in ('inscrito', 'confirmado', 'descadastrado', 'bounce', 'reclamou');

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'site_leads_status_check'
  ) then
    alter table public.site_leads add constraint site_leads_status_check
      check (status = any (array['inscrito'::text, 'confirmado'::text, 'descadastrado'::text, 'bounce'::text, 'reclamou'::text]));
  end if;
end $$;

create unique index if not exists site_leads_email_idx on public.site_leads (lower(email));
create unique index if not exists site_leads_token_idx on public.site_leads (token_descadastro);
create index if not exists site_leads_status_idx on public.site_leads (status, created_at desc);
create index if not exists site_leads_passo_idx
  on public.site_leads (proximo_passo, ultimo_envio_em)
  where status in ('inscrito', 'confirmado');

alter table public.site_leads enable row level security;
revoke all on public.site_leads from anon, authenticated;
grant all on public.site_leads to service_role;

drop trigger if exists trg_site_leads_updated_at on public.site_leads;
create trigger trg_site_leads_updated_at
  before update on public.site_leads
  for each row execute function public.fn_set_updated_at();

comment on table public.site_leads is
  'A PESSOA do funil público: uma linha por e-mail. Deny-all — um admin de tenant que a lesse veria o e-mail e o plano de todos os outros clientes. proximo_passo é o cursor da sequência de 15 e-mails; ausência de avanço é o que a torna reentrante.';
comment on column public.site_leads.proximo_passo is
  'Índice do PRÓXIMO e-mail da sequência (lib/marketing/sequencia.ts). Avança só depois do envio gravado em email_envios — cron que morre no meio reenvia o mesmo passo, e o unique de lá o barra.';

-- ── 3. O envio ─────────────────────────────────────────────────────────────
--
-- `unique (lead_id, mensagem)` é a peça central: ele é o que permite ao cron
-- ser burro e correto ao mesmo tempo. O disparo tenta INSERT; `23505` significa
-- "já foi enviado" e o passo é pulado sem consultar nada antes. Sem ele, duas
-- rodadas concorrentes (ou uma rodada que expirou depois do Resend aceitar,
-- antes de gravar) mandam o mesmo e-mail duas vezes para a mesma pessoa.

create table if not exists public.email_envios (
  id uuid primary key default uuid_generate_v4(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  lead_id uuid not null references public.site_leads(id) on delete cascade,
  mensagem text not null,
  assunto text,
  provider_id text,
  status text not null default 'agendado',
  agendado_para timestamptz,
  enviado_em timestamptz,
  entregue_em timestamptz,
  aberto_em timestamptz,
  clicado_em timestamptz,
  aberturas integer not null default 0,
  cliques integer not null default 0,
  erro text
);

-- Dados antes da constraint: o `update.sh` de um clone roda sem ON_ERROR_STOP,
-- e uma constraint que falha deixa o resto do apêndice por aplicar.
update public.email_envios
  set status = 'agendado'
  where status is null or status not in ('agendado', 'enviado', 'falhou', 'entregue', 'aberto', 'clicado', 'bounce', 'reclamou', 'descadastrou');

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'email_envios_status_check'
  ) then
    alter table public.email_envios add constraint email_envios_status_check
      check (status = any (array['agendado'::text, 'enviado'::text, 'falhou'::text, 'entregue'::text, 'aberto'::text, 'clicado'::text, 'bounce'::text, 'reclamou'::text, 'descadastrou'::text]));
  end if;
end $$;

create unique index if not exists email_envios_lead_mensagem_idx
  on public.email_envios (lead_id, mensagem);
create unique index if not exists email_envios_provider_idx
  on public.email_envios (provider_id)
  where provider_id is not null;
create index if not exists email_envios_status_idx
  on public.email_envios (status, created_at desc);

alter table public.email_envios enable row level security;
revoke all on public.email_envios from anon, authenticated;
grant all on public.email_envios to service_role;

drop trigger if exists trg_email_envios_updated_at on public.email_envios;
create trigger trg_email_envios_updated_at
  before update on public.email_envios
  for each row execute function public.fn_set_updated_at();

comment on table public.email_envios is
  'Uma linha por (lead, mensagem). O unique é a IDEMPOTÊNCIA do disparo: o cron tenta o INSERT e trata 23505 como "já enviado", sem consulta prévia. provider_id é o id do Resend — é por ele que o webhook reencontra a linha.';

-- ── 4. O evento ────────────────────────────────────────────────────────────
--
-- Append-only, e `provider_event_id` único porque o Resend reentrega webhook
-- quando não recebe 2xx — mesmo motivo de `billing_webhook_events` (0239).
-- Duas tabelas em vez de contadores só em `email_envios` porque a pergunta
-- "quando ele abriu" tem mais de uma resposta, e a resposta agregada
-- (`aberturas`) não permite reconstruir a série se a contagem errar.

create table if not exists public.email_eventos (
  id uuid primary key default uuid_generate_v4(),
  created_at timestamptz not null default now(),
  envio_id uuid references public.email_envios(id) on delete cascade,
  lead_id uuid references public.site_leads(id) on delete cascade,
  tipo text not null,
  provider_event_id text,
  dados jsonb not null default '{}'::jsonb
);

create unique index if not exists email_eventos_provider_idx
  on public.email_eventos (provider_event_id)
  where provider_event_id is not null;
create index if not exists email_eventos_envio_idx
  on public.email_eventos (envio_id, created_at desc);
create index if not exists email_eventos_tipo_idx
  on public.email_eventos (tipo, created_at desc);

alter table public.email_eventos enable row level security;
revoke all on public.email_eventos from anon, authenticated;
grant all on public.email_eventos to service_role;

comment on table public.email_eventos is
  'Append-only, um por evento do provedor de e-mail. provider_event_id único porque o Resend reentrega webhook não confirmado — sem isto uma abertura viraria três no painel.';

-- ── 5. O checkout que não terminou ─────────────────────────────────────────
--
-- `stripe_session_id` é a chave natural e é único: o webhook encontra a linha
-- por ele. `status` começa `aberto` e só sai daí por evento do Stripe
-- (`checkout.session.completed` / `.expired`) — nunca por relógio nosso, que
-- discordaria do deles e mandaria "você esqueceu algo" a quem acabou de pagar.
-- `lembrete_enviado_em` é o que impede o lembrete de sair duas vezes.

create table if not exists public.checkout_tentativas (
  id uuid primary key default uuid_generate_v4(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  organization_id uuid references public.organizations(id) on delete set null,
  lead_id uuid references public.site_leads(id) on delete set null,
  stripe_session_id text not null,
  email text,
  plano text,
  moeda text,
  valor_cents integer,
  status text not null default 'aberto',
  concluido_em timestamptz,
  lembrete_enviado_em timestamptz
);

-- Dados antes da constraint: o `update.sh` de um clone roda sem ON_ERROR_STOP,
-- e uma constraint que falha deixa o resto do apêndice por aplicar.
update public.checkout_tentativas
  set status = 'aberto'
  where status is null or status not in ('aberto', 'concluido', 'expirado', 'abandonado');

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'checkout_tentativas_status_check'
  ) then
    alter table public.checkout_tentativas add constraint checkout_tentativas_status_check
      check (status = any (array['aberto'::text, 'concluido'::text, 'expirado'::text, 'abandonado'::text]));
  end if;
end $$;

create unique index if not exists checkout_tentativas_sessao_idx
  on public.checkout_tentativas (stripe_session_id);
create index if not exists checkout_tentativas_status_idx
  on public.checkout_tentativas (status, created_at desc);
create index if not exists checkout_tentativas_lembrete_idx
  on public.checkout_tentativas (created_at)
  where status = 'aberto' and lembrete_enviado_em is null;

alter table public.checkout_tentativas enable row level security;
revoke all on public.checkout_tentativas from anon, authenticated;
grant all on public.checkout_tentativas to service_role;

drop trigger if exists trg_checkout_tentativas_updated_at on public.checkout_tentativas;
create trigger trg_checkout_tentativas_updated_at
  before update on public.checkout_tentativas
  for each row execute function public.fn_set_updated_at();

comment on table public.checkout_tentativas is
  'Estado de UMA sessão de checkout do Stripe. Deny-all: organization_id existe para fechar o funil (quem virou cliente), não para dar leitura ao tenant. status só muda por evento do Stripe — relógio nosso discordaria do deles e mandaria "esqueceu algo" a quem já pagou.';

notify pgrst, 'reload schema';
