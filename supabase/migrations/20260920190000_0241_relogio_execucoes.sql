-- 0241 — A MEMÓRIA DO RELÓGIO: quando cada cron rodou pela última vez.
--
-- ─── O buraco que isto fecha ────────────────────────────────────────────────
--
-- O self-host tem `crond` de verdade (`docker/scheduler/entrypoint.sh`) e não
-- precisa de memória: o crontab sabe que horas são e dispara. O deploy
-- HOSPEDADO não tem esse contêiner, e o plano Hobby da Vercel só aceita cron
-- diário — doze das 22 rotas rodam sub-diário, e declarar `crons` sub-diário
-- no `vercel.json` fora do Pro REPROVA O DEPLOY inteiro, não degrada.
--
-- A saída é o relógio HTTP (`/api/v1/system/relogio/tick`), batido de fora por
-- GitHub Actions ou cron-job.org. Só que quem bate de graça ATRASA — 5 a 15
-- minutos é normal no Actions. Um tick que perguntasse "o minuto atual casa
-- com `*/5`?" perderia quase tudo, e `17 * * * *` não rodaria nunca.
--
-- Então o tick pergunta outra coisa: **esta tarefa rodou depois da última hora
-- em que ela deveria ter rodado?** Para responder, é preciso LEMBRAR. Esta
-- tabela é essa lembrança, e é o que torna o atraso do agendador inofensivo:
-- a tarefa se recupera sozinha depois de uma queda e roda uma vez por janela,
-- não uma vez por batida.
--
-- ─── Por que uma tabela e não um contador em memória ────────────────────────
--
-- Função serverless não tem memória entre invocações — cada tick é um processo
-- novo. Um `Map` no módulo sobreviveria por acaso, enquanto o contêiner
-- estivesse quente, e morreria no primeiro deploy ou na primeira hora ociosa.
-- "Funciona até esfriar" é o pior tipo de agendador: ele acerta no teste e
-- erra de madrugada.
--
-- Redis (Upstash) responderia também, e foi recusado: ele é OPCIONAL nesta
-- instalação (sem `UPSTASH_REDIS_REST_URL` o rate-limit cai para contador em
-- memória, de propósito), e pendurar o agendamento do produto inteiro numa
-- dependência opcional transforma "o Redis caiu" em "a IA parou de responder".
-- O Postgres já é obrigatório.
--
-- ─── Por que deny-all ───────────────────────────────────────────────────────
--
-- Não é dado de tenant: é o livro-razão do OPERADOR sobre a própria máquina.
-- Não tem `organization_id` e nem deveria ter — uma rodada do `data-retention`
-- atravessa todas as organizações. RLS ligada, zero policies, privilégio
-- revogado de `anon` e `authenticated`, tudo para `service_role`. Mesma
-- postura de `billing_webhook_events` (0239) e do funil do site (0240).
--
-- ─── Por que uma linha por tarefa, e não append-only ────────────────────────
--
-- A pergunta que o tick faz é "quando foi a última vez?", e ela tem UMA
-- resposta. Um histórico completo seria ~32 mil linhas por dia numa instalação
-- que não atende ninguém (22 tarefas × 1.440 minutos, no pior caso) — o mesmo
-- defeito que o audit log de cron já pagou uma vez (`CLAUDE.md`, achado 17).
-- O que interessa do histórico — falhou, quantas vezes seguidas, com que
-- mensagem — cabe em colunas, e o que precisa de trilha permanente já vai para
-- `api_audit_log` pelas próprias rotas quando elas MEXEM em alguma coisa.

create table if not exists public.relogio_execucoes (
  -- O nome do diretório em `app/api/v1/cron/`. É a chave natural: existe uma
  -- rota, existe no máximo uma linha. Uma PK sintética permitiria duas linhas
  -- para `agent-dispatcher` e o tick teria de escolher uma — escolha que não
  -- existe.
  tarefa text primary key,
  ultima_execucao timestamptz not null default now(),
  -- `ok` | `falhou` | `pulou`. Texto com CHECK, não enum (doutrina).
  ultimo_status text not null default 'ok',
  ultimo_detalhe text,
  duracao_ms integer,
  -- Zera no primeiro sucesso. É o que a tela do operador lê para dizer
  -- "esta tarefa está quebrada há 40 rodadas" em vez de "está tudo bem".
  falhas_seguidas integer not null default 0,
  atualizado_em timestamptz not null default now()
);

-- A correção de dados vem ANTES da constraint: o `update.sh` de um clone roda
-- SEM `ON_ERROR_STOP`, então um erro aqui passaria em silêncio e deixaria o
-- resto por aplicar.
update public.relogio_execucoes
   set ultimo_status = 'ok'
 where ultimo_status is null
    or ultimo_status not in ('ok', 'falhou', 'pulou');

update public.relogio_execucoes
   set falhas_seguidas = 0
 where falhas_seguidas is null
    or falhas_seguidas < 0;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'relogio_execucoes_status_chk'
  ) then
    alter table public.relogio_execucoes
      add constraint relogio_execucoes_status_chk
      check (ultimo_status in ('ok', 'falhou', 'pulou'));
  end if;
end $$;

-- A tela do operador ordena por "o que está mais parado".
create index if not exists relogio_execucoes_ultima_idx
  on public.relogio_execucoes (ultima_execucao asc);

alter table public.relogio_execucoes enable row level security;
revoke all on public.relogio_execucoes from anon, authenticated;
grant all on public.relogio_execucoes to service_role;

comment on table public.relogio_execucoes is
  'Quando cada rota de app/api/v1/cron rodou pela última vez. Existe para o deploy HOSPEDADO, onde não há crond: o tick de /api/v1/system/relogio/tick compara esta marca com a última ocorrência devida da cadência (lib/relogio/agenda.ts) e roda o que está vencido. Deny-all: livro-razão do operador, não dado de tenant.';
comment on column public.relogio_execucoes.tarefa is
  'Nome do diretório em app/api/v1/cron/. Chave natural — uma rota, no máximo uma linha.';
comment on column public.relogio_execucoes.falhas_seguidas is
  'Zera no primeiro sucesso. É o que distingue "falhou agora" de "está quebrada há 40 rodadas".';

notify pgrst, 'reload schema';
