-- Assinatura mensal por organização (Stripe) — o schema que faltava para cobrar.
--
-- Até aqui NÃO existia nenhuma noção de plano, cota, teto ou vencimento em
-- lugar nenhum do banco nem do código: `app/app/settings/billing/page.tsx` era
-- um cartão "Em breve — Fase 2". Quem roda este produto como SaaS hospedado
-- (um tenant por cliente pagante) não tinha como saber quem pagou.
--
-- ─── Por que a AUSÊNCIA de linha é o trial, e não uma linha 'trialing' ──────
--
-- A organização nasce em `/auth/confirm` e no wizard de onboarding, dois
-- caminhos que nada têm a ver com dinheiro. Obrigá-los a semear uma linha aqui
-- acopla o cadastro à cobrança e cria o modo de falha clássico: a semeadura
-- falha em silêncio e a org nasce SEM assinatura — indistinguível, para o
-- gate, de uma assinatura cancelada. O cliente novo levaria paywall na cara na
-- primeira tela.
--
-- Por isso a tabela só recebe linha vinda do Stripe (checkout/webhook), e o
-- trial é DERIVADO de `organizations.created_at` (doutrina DIRC: Calcular).
-- Ausência de linha = "ainda no período de avaliação". Ver `lib/billing/assinatura.ts`.
--
-- ─── Por que isto NÃO usa `organizations.status = 'suspended'` ──────────────
--
-- Aquele estado é a suspensão MANUAL do platform admin (tem `suspended_by` e
-- `suspended_reason`, e a rota `/api/v1/admin/tenants/[id]/reactivate` a
-- desfaz). Deixar o webhook do Stripe escrever ali faria um cartão recusado
-- virar "conta banida" na tela, e faria a reativação manual brigar com o
-- webhook na próxima fatura. São dois eixos independentes e ambos podem estar
-- ligados ao mesmo tempo.
--
-- ─── Idempotência ──────────────────────────────────────────────────────────
--
-- `if not exists` em tabela e índices, `drop policy if exists` antes de cada
-- policy e do trigger — o `update.sh` de um clone reaplica o apêndice inteiro
-- do baseline sem erro.

create table if not exists public.org_subscriptions (
  -- PK é a própria organização: uma assinatura por tenant, por construção.
  -- Uma tabela com `id` próprio e FK permitiria duas linhas ativas para a
  -- mesma org, e o gate teria de escolher uma — escolha que não existe.
  organization_id uuid primary key references public.organizations(id) on delete cascade,

  -- Vocabulário fechado, pareado com `PlanoId` em `lib/billing/planos.ts`
  -- (tests/invariants/vocabulario-banco-x-typescript.test.ts).
  plan text not null,

  -- Os MESMOS nomes que o Stripe usa em `subscription.status`. Traduzir para um
  -- vocabulário nosso criaria uma tabela de conversão para manter em sincronia
  -- com um terceiro que muda sozinho — e o custo de errar é cobrar quem não
  -- deve ou liberar quem não pagou. Pareado com `StatusAssinatura`.
  status text not null,

  -- Identificadores do Stripe. `unique` nos dois: o webhook resolve a
  -- organização por eles, e um mesmo customer/subscription apontando para duas
  -- orgs é exatamente o vazamento entre tenants que a RLS existe para impedir.
  stripe_customer_id text,
  stripe_subscription_id text,
  stripe_price_id text,

  -- Fim do ciclo pago corrente. É o que o gate compara com `now()` quando o
  -- status é `past_due`: o Stripe mantém `past_due` durante toda a régua de
  -- tentativas (dias), e cortar o acesso no primeiro boleto recusado perderia
  -- cliente por um cartão que venceu.
  current_period_end timestamptz,

  -- `true` = o cliente pediu cancelamento e continua com acesso até o fim do
  -- ciclo já pago. A tela precisa dizer isso; sem a coluna, "cancelou" e
  -- "cancelado" ficam indistinguíveis e o cliente acha que perdeu o que pagou.
  cancel_at_period_end boolean not null default false,

  -- Quando o Stripe encerrou de fato. Nulo enquanto viva.
  canceled_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint org_subscriptions_plan_check
    check (plan = any (array['essencial'::text, 'pro'::text, 'ilimitado'::text])),
  constraint org_subscriptions_status_check
    check (status = any (array[
      'trialing'::text, 'active'::text, 'past_due'::text, 'canceled'::text,
      'incomplete'::text, 'incomplete_expired'::text, 'unpaid'::text, 'paused'::text
    ]))
);

create unique index if not exists org_subscriptions_customer_idx
  on public.org_subscriptions (stripe_customer_id)
  where stripe_customer_id is not null;

create unique index if not exists org_subscriptions_subscription_idx
  on public.org_subscriptions (stripe_subscription_id)
  where stripe_subscription_id is not null;

alter table public.org_subscriptions enable row level security;

-- Leitura org-flat: "a empresa está em dia?" é pergunta que TODO membro faz
-- sem saber que faz — o gate do layout roda para viewer também. Restringir a
-- admin faria o gate ter de rodar por service_role em toda navegação de toda
-- pessoa, que é exatamente o caminho que a doutrina manda evitar.
-- Nenhum valor aqui é segredo: é plano, estado e data.
drop policy if exists org_subscriptions_select on public.org_subscriptions;
create policy org_subscriptions_select on public.org_subscriptions
  for select using (
    public.fn_is_platform_admin()
    or organization_id in (select public.fn_user_org_ids())
  );

-- NÃO há policy de escrita, e isso é a decisão: quem escreve aqui é o webhook
-- do Stripe (service_role, que ignora RLS). Um admin de tenant que pudesse dar
-- UPDATE nesta tabela se daria plano `ilimitado` com um PATCH.
revoke all on public.org_subscriptions from anon;
grant select on public.org_subscriptions to authenticated;
grant all on public.org_subscriptions to service_role;

drop trigger if exists trg_org_subscriptions_updated_at on public.org_subscriptions;
create trigger trg_org_subscriptions_updated_at
  before update on public.org_subscriptions
  for each row execute function public.fn_set_updated_at();

comment on table public.org_subscriptions is
  'Assinatura mensal de UMA organização. Linha só nasce do Stripe (checkout/webhook); AUSÊNCIA de linha = trial derivado de organizations.created_at (lib/billing/assinatura.ts). Independente de organizations.status=suspended, que é a suspensão manual do platform admin.';
comment on column public.org_subscriptions.status is
  'Os mesmos nomes de subscription.status do Stripe, de propósito: traduzir criaria uma tabela de conversão para manter em sincronia com um terceiro que muda sozinho.';
comment on column public.org_subscriptions.cancel_at_period_end is
  'true = pediu cancelamento e segue com acesso até current_period_end. Sem esta coluna a tela não distingue "cancelou" de "cancelado".';

-- ───────────────────────────────────────────────────────────────────────────
-- Idempotência do webhook do Stripe.
--
-- O Stripe REENTREGA: qualquer resposta que não seja 2xx em 20s vira nova
-- tentativa, com o MESMO `event.id`, por até 3 dias. Sem esta tabela, uma
-- entrega lenta que o nosso lado processou (mas não confirmou a tempo) volta e
-- é aplicada de novo — e `customer.subscription.deleted` aplicada em cima de
-- uma assinatura JÁ RENOVADA derruba o acesso de quem pagou.
--
-- É o mesmo padrão de `unique (organization_id, external_id)` + captura do
-- `23505` que a ingestão de mensagens usa, com uma diferença: o `event.id` é
-- único GLOBALMENTE no Stripe e chega ANTES de sabermos a organização (é o
-- payload que a revela). Por isso a chave é só ele, e `organization_id` é
-- nullable — preenchido quando resolvido, para o audit e para o suporte.
-- ───────────────────────────────────────────────────────────────────────────

create table if not exists public.billing_webhook_events (
  stripe_event_id text primary key,
  type text not null,
  organization_id uuid references public.organizations(id) on delete set null,
  received_at timestamptz not null default now()
);

create index if not exists billing_webhook_events_received_idx
  on public.billing_webhook_events (received_at desc);

alter table public.billing_webhook_events enable row level security;

-- Nem `authenticated` lê: é registro de plataforma, não dado de tenant. Sem
-- policy de select e sem grant, só o service_role (que ignora RLS) enxerga.
revoke all on public.billing_webhook_events from anon, authenticated;
grant all on public.billing_webhook_events to service_role;

comment on table public.billing_webhook_events is
  'Dedupe de webhook do Stripe. O Stripe reentrega o MESMO event.id por até 3 dias quando não recebe 2xx; sem isto, um customer.subscription.deleted reentregue derrubaria o acesso de quem já renovou.';
