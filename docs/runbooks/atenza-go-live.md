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
`deskcomm-waha` e sua cota, sem criar VM ou aumentar plano. O worker usa rede
Docker própria e os endpoints de produção recuperados da Vercel. Não reutilizar
credenciais ou serviços de outra instalação só por estarem na mesma VM.
Nenhuma porta nova fica exposta à internet. Começar com concorrência 1, pool de banco 3, limite de 384 MB
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

## Ambiente confirmado e correção da auditoria inicial

O projeto Vercel é `saa-s-whatsapp`, equipe `andres-projects-bbfd1881`.
O token com as permissões corretas permitiu confirmar em 27/09/2026 que o
Supabase de produção é `cclrwowgjtutvtlwuday`, região `us-east-2`.
**A cópia `.env.vercel` do checkout original aponta para outra instalação**
(`fnvghggamjyibpiqdgha`). As primeiras contagens e a sessão WORKING vistas
nessa cópia não descreviam o Atenza. Não reutilizar essa cópia para deploy.
O projeto correto tinha três organizações, nenhuma assinatura e nenhum agente
publicado; uma sessão cadastrada sem pareamento concluído. Refazer as leituras
antes de usar essas contagens como estado atual.

### Preparação na VM existente, 27/09/2026

CONFIRMADO: o worker está em `/opt/atenza-worker`, container
`atenza-worker-worker-1`, **running/healthy**, sem reinícios na medição inicial,
com o gate de assinatura ativo. Medição ociosa: 151,4 MiB, 0,74% CPU.
A imagem local `atenza-worker:71d09a6` usa como base a revisão de produção
`75e192f503a3dbb2290592075fbec4db1de11ed8`, digest
`sha256:ca926390813421bb74d522d0f6692c0e6c0edb21bba68623a3272903c765d975`,
com os cinco arquivos de runtime da correção de billing em `71d09a6` por cima.
Não houve alteração de dependências. O build foi feito sem rede, reutilizando
a imagem baixada; o contexto do build não continha o `.env`.

Uma execução isolada dentro da VM confirmou conexão PostgreSQL, WAHA 200 e
Redis HTTP 200. A fila de jobs e as mensagens `queued` estavam vazias.
A conexão postgres que estava na Vercel retornava `28P01`. Foi criado o login
`atenza_runtime`, com senha aleatória privada, limite de seis conexões,
BYPASSRLS para a operação entre tenants e permissões DML no schema public.
Não possui superuser, CREATEDB ou CREATEROLE; não se alterou a senha postgres.
O worker usa esse login e a variável `SUPABASE_DB_URL` da Vercel foi atualizada
e relida para confirmar o valor. A senha não fica neste repositório.

A Stripe confirmou cobrança e repasse habilitados, preços recorrentes ativos
em BRL de 9700/29700/69700 centavos e webhook enabled no endpoint de produção.
Isso verifica configuração, não uma assinatura ou pagamento completo.

O OpenRouter aceitou uma geração com
`nvidia/nemotron-3-ultra-550b-a55b:free` (HTTP 200, resposta `PRONTO`, custo
retornado 0); o catálogo confirmou suporte a ferramentas, ainda não exercitado
neste teste. App e worker usam a configuração de plataforma OpenRouter;
duas organizações anteriores conservam Anthropic nas próprias configurações.
Validar o cadastro novo e o fluxo de publicação antes de declarar atendimento
funcional. Não confundir modelo gratuito disponível
com garantia de capacidade ou disponibilidade futura.

Todos os checks do PR #8 passaram na revisão `71d09a6`: verify, invariants,
build, imagens, preview Vercel e as três partes de E2E. Esses checks não
substituem a prova de pagamento e atendimento real descrita acima.

### Recuperação da imagem QR no onboarding (28/09/2026)

Uma resposta de erro ao buscar a imagem removia o elemento da tela; o polling
continuava, mas não limpava o erro para tentar novamente. O polling e o botão
Gerar novo QR agora limpam esse estado. FAILED significa conexão interrompida,
não prova que um código foi exibido e expirou.

Verificação: 16 testes relevantes do onboarding passaram, incluindo erro de
imagem seguido de nova consulta e reinício manual. Chromium com o componente
real e fronteiras simuladas recebeu HTTP 422 na primeira imagem e carregou a
segunda. Separadamente, o WAHA de produção retornou HTTP 200 e PNG válido após
reinício da sessão não pareada. Isso não substitui o cliente escanear e confirmar
WORKING, nem comprova o atendimento ou a cobrança ponta a ponta.

A validação seguinte reproduziu um segundo defeito: o polling remontava a imagem
a cada três segundos, cancelando requisições mais lentas. O componente agora
aguarda load/error antes de renovar (20 segundos após load; nova tentativa após
erro). O teste Chromium com atraso de 4,5 segundos falhou antes e passou depois;
17 testes do onboarding e typecheck passaram. Uma conta temporária isolada
confirmou QR visível pelo painel autenticado em produção, sem enviar e-mail,
parear telefone ou gerar cobrança.
