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

Se a hospedagem escolhida for Oracle Always Free, limite a soma das instâncias
Ampere A1 a **2 OCPU e 12 GB de RAM**. O script local
`infra/oracle/tentar-ate-ter-estoque.sh` também tenta 4 OCPU/24 GB; não execute
essa configuração em conta paga sem conferir a cobrança. A falta de estoque na
região pode impedir a criação mesmo com configuração correta.

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
