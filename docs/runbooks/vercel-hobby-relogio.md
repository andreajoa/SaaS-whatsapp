# Relógio no Vercel Hobby (follow-up não fica preso)

## Por que existe

No plano Hobby a Vercel só agenda **1 cron por dia**. Sem um relógio externo:

1. o lead responde "SIM" no WhatsApp;
2. a mensagem entra no banco (inbox OK);
3. o enrollment fica em `waiting_reply` / `cap_nome` para sempre.

O endpoint `POST /api/v1/system/relogio/tick` drena eventos, aplica respostas
inbound nos follow-ups e envia textos fixos pendentes. Quem precisa chamar
esse endpoint a cada poucos minutos é um **cron de fora** — grátis.

## Pré-requisito: um só deploy no domínio do WAHA

O webhook WAHA tem que bater no **mesmo** deployment que a UI/`webhooks/in`.

```bash
# Ver para onde o domínio aponta hoje
npx vercel alias ls | findstr /i "crm-gabrielle deskcomm-crm"

# Se ainda apontar para um deploy CLI antigo, reaponte para o da branch develop:
npx vercel alias set <url-do-deploy-develop> crm-gabrielle.vercel.app
```

Confirme nos logs: `POST /api/v1/webhooks/waha` e `POST /api/v1/webhooks/in`
devem compartilhar o **mesmo** `dep=dpl_…`.

## Opção A — GitHub Actions (grátis em repo público)

Arquivo: [`.github/workflows/relogio.yml`](../../.github/workflows/relogio.yml).

**Limitação:** o `schedule:` do Actions **só roda na branch default (`main`)**.
Se o workflow existir só em `develop`, o cron **nunca** dispara.

### Ligar

1. Mergeie `.github/workflows/relogio.yml` em `main` (ou copie o arquivo).
2. No GitHub do **seu** fork/instalação → Settings → Secrets and variables:

| Tipo | Nome | Valor |
|------|------|--------|
| Variable | `RELOGIO_LIGADO` | `1` |
| Secret | `RELOGIO_APP_URL` | `https://crm-gabrielle.vercel.app` (sem barra no fim) |
| Secret | `RELOGIO_SECRET` | o mesmo `INTERNAL_SECRET` do projeto na Vercel |

3. Actions → **relogio** → Run workflow (teste manual).
4. Espere o schedule `*/5` (o GitHub atrasa; 5–15 min é normal).

```bash
# Via CLI (com permissão de secrets no repo)
gh variable set RELOGIO_LIGADO -R SEU_USER/DeskcommCRM -b 1
gh secret set RELOGIO_APP_URL -R SEU_USER/DeskcommCRM -b "https://crm-gabrielle.vercel.app"
gh secret set RELOGIO_SECRET -R SEU_USER/DeskcommCRM -b "$INTERNAL_SECRET"
```

## Opção B — cron-job.org (grátis, a cada 1 minuto)

Melhor latência que o Actions. Conta free permite job a cada minuto.

1. Crie conta em [https://cron-job.org](https://cron-job.org).
2. Create cronjob:
   - **URL:** `https://crm-gabrielle.vercel.app/api/v1/system/relogio/tick`
   - **Schedule:** every 1 minute
   - **Request method:** POST
   - **Header:** `Authorization` = `Bearer <INTERNAL_SECRET>`
3. Enable e rode "Execute now".

O curl equivalente:

```bash
curl -fsS -X POST \
  -H "Authorization: Bearer $INTERNAL_SECRET" \
  "https://crm-gabrielle.vercel.app/api/v1/system/relogio/tick"
```

## Opção C — `pg_cron` no próprio Supabase (grátis, a cada 1 minuto, sem conta nova)

**Por que existe:** o `*/5` da Opção A é um pedido, não uma garantia. Medido em
2026-09-22 num repositório público: o GitHub disparou o `schedule` às 06:49,
12:08, 16:56 e 20:03 — uma batida a cada **4–5 horas**. Um lead que responde
"SIM" espera esse tempo todo pelo passo seguinte do follow-up. A Opção A serve
de rede de segurança; o relógio de verdade precisa de outro lugar.

O Supabase hospedado já traz `pg_cron` (agenda) e `pg_net` (HTTP assíncrono —
o `net.http_post` só enfileira, então nenhuma transação espera a rede). O
segredo fica no **Vault**, cifrado, e não em texto puro na definição do job
(que qualquer um com leitura em `cron.job` veria).

No painel do Supabase → **SQL Editor**, troque `<INTERNAL_SECRET>` e
`<APP_URL>` (ex.: `https://www.seudominio.com`, com o host FINAL — um
redirecionamento 308 de domínio apex para `www` derruba o `Authorization`) e rode:

```sql
create extension if not exists pg_cron with schema pg_catalog;
grant usage on schema cron to postgres;
create extension if not exists pg_net with schema extensions;

select vault.create_secret('<INTERNAL_SECRET>', 'relogio_tick_secret',
  'Bearer do POST /api/v1/system/relogio/tick (= INTERNAL_SECRET da Vercel)');

select cron.schedule('relogio-tick', '* * * * *', $$
  select net.http_post(
    url := '<APP_URL>/api/v1/system/relogio/tick',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets
                                     where name = 'relogio_tick_secret')),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000)
$$);
```

Conferir (as respostas HTTP ficam em `net._http_response` por algumas horas):

```sql
select status, start_time from cron.job_run_details order by start_time desc limit 5;
select status_code, left(content, 120) from net._http_response order by created desc limit 5;
```

Desligar: `select cron.unschedule('relogio-tick');`. Trocou o `INTERNAL_SECRET`
na Vercel? Troque também no Vault: `select vault.update_secret((select id from
vault.secrets where name = 'relogio_tick_secret'), '<NOVO>');`.

## Como saber que está funcionando

Nos logs da Vercel (produção), a cada batida:

- `POST /api/v1/system/relogio/tick` → 200
- quando há "SIM" preso: `[relogio] follow-up avancou por resposta inbound`

Na fila de follow-ups, o status sai de **Aguardando resposta**.

## O que o tick faz (ordem)

**Até 2026-09-20 o tick cobria QUATRO tarefas. Hoje cobre as 22.** A versão de
quatro deixava dezoito rotas de `app/api/v1/cron/` sem ninguém para chamá-las no
deploy hospedado — `agent-dispatcher` inclusive, que é *a IA responder*. Não dava
erro: as rotas respondiam 200 a quem as chamasse à mão, o build passava, e a
feature simplesmente não acontecia sozinha.

Primeiro, **em processo** (chamada de função, sem rede — são baratas e rodam a
cada minuto):

1. `event-log-drain` — consome `message.received` (reatividade do follow-up)
2. `followup-flow-worker` — aplica texto inbound + claim de enrollments + envio fixo
3. `routing-worker`
4. `recover-stuck-messages`

Depois, **por HTTP**, as demais rotas que estiverem **vencidas** — cada uma na
própria função, com o próprio `maxDuration` (o tick tem 60 s;
`kb-conversations-batch` precisa de 120).

### O que "vencida" quer dizer, e por que não é "o minuto casou"

Quem bate o relógio de graça **atrasa**: 5 a 15 minutos é normal no GitHub
Actions. Se o tick perguntasse *"o minuto atual casa com a cadência?"*, quase
tudo passaria batido e `contact-proposals-watcher` (`17 * * * *`) não rodaria
praticamente nunca.

A pergunta é outra: **"esta tarefa rodou depois da última hora em que deveria
ter rodado?"** A resposta vem de `relogio_execucoes` (migration 0241), uma linha
por tarefa. Consequências que importam:

- atraso do agendador é **inofensivo** — a janela continua valendo;
- depois de uma queda, cada tarefa se recupera **uma vez**, não uma por batida;
- bater de minuto em minuto (Opção B) **não** faz a varredura de 5 min rodar
  cinco vezes mais — ela continua rodando de 5 em 5;
- o que não couber no orçamento de 40 s do tick **não se perde**: fica vencido e
  o próximo tick o pega primeiro, porque a fila é ordenada pelo mais atrasado.

### Ver o que está parado

```sql
select tarefa, ultima_execucao, ultimo_status, falhas_seguidas, duracao_ms
  from public.relogio_execucoes
 order by ultima_execucao asc;
```

`falhas_seguidas` zera no primeiro sucesso — é o que distingue "falhou agora" de
"está quebrada há 40 rodadas". Uma rota que falha **ainda assim avança**
`ultima_execucao`, de propósito: sem isso, uma rota diária quebrada seria
rechamada a cada batida durante 24 h. Rota quebrada tem de doer no painel, não
na conta.

### Duas coisas que precisam existir na Vercel

O despacho por HTTP precisa de `NEXT_PUBLIC_APP_URL` e de
`INTERNAL_CRON_SECRET` (ou `INTERNAL_SECRET`). Faltando qualquer um, o tick
responde 200 **dizendo isso** numa tarefa chamada `despacho-http` — um tick que
devolvesse 200 calado sobre as dezoito seria indistinguível de um tick saudável.

Definição canônica: `lib/relogio/agenda.ts` (as 22 rotas e suas cadências,
espelho do crontab do self-host, com paridade cobrada em
`tests/unit/relogio-agenda-bate-com-scheduler.test.ts`) + `lib/relogio/executar.ts`.
