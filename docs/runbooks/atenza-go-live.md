# Atenza: verificação antes de divulgar

Este é o caminho de produção do SaaS em `www.atenza.online`: cadastro → cartão
e trial de 7 dias → painel → conexão do WhatsApp → agente publicado → resposta
automática. O `/api/v1/health` verifica app, Supabase, Redis e WAHA; ele **não**
prova que o worker contínuo de IA está rodando.

## Configuração que precisa existir

No projeto Vercel que serve o domínio, conferir `STRIPE_SECRET_KEY`,
`STRIPE_WEBHOOK_SECRET`, os três `STRIPE_PRICE_*` e
`NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`. O webhook da Stripe precisa apontar para
`https://www.atenza.online/api/v1/webhooks/stripe` e processar os eventos
descritos em `.env.example`. Sem a chave secreta, o app desliga a cobrança e o
gate de acesso; sem o webhook, o pagamento não libera a conta.

Para que o cliente não precise trazer chave de IA, configurar no app
`AI_PROVIDER=openrouter`, `AI_DEFAULT_MODEL=<modelo curado>` e
`OPENROUTER_API_KEY`. O worker precisa da mesma chave do OpenRouter. A variável
`AI_GATEWAY_API_KEY` sozinha não supre o provedor do agent-engine contínuo nem
faz o cadastro nascer em OpenRouter.

O processo `pnpm worker` precisa rodar continuamente em uma máquina com acesso
ao `SUPABASE_DB_URL`, `NEXT_PUBLIC_SUPABASE_URL` e
`SUPABASE_SERVICE_ROLE_KEY`. No worker do SaaS, definir
`SAAS_BILLING_REQUIRED=1`. Isso impede resposta para quem ainda não colocou
cartão ou perdeu acesso; o trial `trialing` continua atendendo. O worker
também liga o gate automaticamente se receber `STRIPE_SECRET_KEY`, mas não é
preciso compartilhar essa chave de pagamento com ele.
O arquivo `infra/atenza/worker.compose.yml` sobe apenas o worker, sem duplicar
o app ou o WAHA, e força o gate de assinatura. Fixe `WORKER_IMAGE` na imagem
publicada da mesma revisão do app antes de subir.

Decisão do proprietário em 27/09/2026: usar primeiro a VM Google existente
`deskcomm-waha` e sua cota, sem criar VM ou aumentar plano. O worker compartilha
as redes Docker já existentes `waha_default` e `redis_rede`, sem expor porta
nova à internet. Começar com concorrência 1, pool de banco 3, limite de 384 MB
de RAM, 768 MB somando RAM e swap e 0,5 CPU. A análise periódica opcional
(`FLYWHEEL_INTERVAL_MS`) fica desligada. São limites iniciais de operação;
medir memória, reinícios, saúde do WAHA e tempo da fila antes de ajustar.
Qualquer expansão paga depende de nova decisão do proprietário após clientes.

## Prova de ponta a ponta

1. Confirmar que o container/processo do worker está ativo e que `/healthz`
   responde 200. Verificar nos logs a linha `gate de assinatura do worker`
   com `ativo: true`.
2. Criar conta de teste nova e confirmar que ela é direcionada ao checkout,
   sem publicar atendimento antes do cartão.
3. Usar o modo de teste da Stripe: cadastrar cartão de teste, confirmar o
   webhook e a linha `org_subscriptions.status=trialing`.
4. Conectar um número de teste do WhatsApp, publicar o agente com informações
   reais de uma empresa fictícia e enviar uma pergunta de outro número.
   Confirmar mensagem recebida, job concluído e resposta correta no WhatsApp.
5. Cancelar a assinatura de teste, enviar outra pergunta e confirmar que nenhum
   turno de IA é executado depois da perda de acesso.

Em 27/09/2026, a auditoria leu zero instâncias na conta Oracle configurada,
e a VM Google `deskcomm-waha` tinha WAHA, dois Redis e Cloudflare, sem worker.
O Supabase tinha uma organização, zero `org_subscriptions` e zero `job_queue`.
Os tokens Vercel recebidos acessavam a equipe
`andre-almeidas-projects-7fa48c22`, enquanto os deploys do repositório no
GitHub apontavam para `andres-projects-bbfd1881`; por isso as variáveis do
projeto publicado ainda não foram verificadas. Refaça estas medições antes de
usar esta nota como estado atual.

### Preparação na VM existente, 27/09/2026

CONFIRMADO: o worker foi preparado em `/opt/atenza-worker`, **ainda parado**.
A imagem local `atenza-worker:71d09a6` usa como base a revisão de produção
`75e192f503a3dbb2290592075fbec4db1de11ed8`, digest
`sha256:ca926390813421bb74d522d0f6692c0e6c0edb21bba68623a3272903c765d975`,
com os cinco arquivos de runtime da correção de billing em `71d09a6` por cima.
Não houve alteração de dependências. O build foi feito sem rede, reutilizando
a imagem baixada; o contexto do build não continha o `.env`.

Uma execução isolada dentro da VM confirmou conexão PostgreSQL e Redis HTTP
(200 com POST `['PING']`). A fila de jobs e as mensagens `queued` estavam vazias.
A chave WAHA da cópia local retornou 401; o servidor conserva somente seu hash.
Não trocar a chave do servidor nem reiniciar o WAHA para contornar isso:
recuperar a configuração de produção na equipe Vercel correta antes de ligar
o worker. O acesso disponível recebeu 403 ao consultar essa equipe.

O OpenRouter aceitou uma geração com
`nvidia/nemotron-3-ultra-550b-a55b:free` (HTTP 200, resposta `PRONTO`, custo
retornado 0); o catálogo confirmou suporte a ferramentas, ainda não exercitado
neste teste. A chave e o modelo foram configurados somente no `.env` privado
do worker. A organização existente ainda usa Anthropic e não tem agente
publicado: configurar o provedor no app e validar o fluxo de publicação antes
de declarar atendimento funcional. Não confundir modelo gratuito disponível
com garantia de capacidade ou disponibilidade futura.

Todos os checks do PR #8 passaram na revisão `71d09a6`: verify, invariants,
build, imagens, preview Vercel e as três partes de E2E. Esses checks não
substituem a prova de pagamento e atendimento real descrita acima.
