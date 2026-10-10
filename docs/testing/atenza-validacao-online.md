# Validação do Atenza online

Orientação explícita do proprietário em 09/10/2026: o Atenza é um serviço online.
Nesta frente, não usar Docker. O destino é a instalação Vercel/Supabase do
Atenza; não mudar o modelo de hospedagem para self-host.

## Histórico inicial da validação

Em 09/10/2026, leituras públicas de `https://www.atenza.online` e `/login`
retornaram HTTP 200. `/api/v1/health` retornou `healthy`, com Supabase, Redis e
WhatsApp em `ok`. O login foi aberto no Chrome em desktop e celular: não houve
erro de JavaScript nem overflow horizontal no viewport de 390 px.

Essa verificação descreve a revisão que já estava publicada. Não comprova as
integrações, campanhas ou avaliações novas desta branch, nem prova o worker de
IA ou a jornada autenticada.

O conector Vercel e a sessão CLI inicial não acessavam a equipe correta. A
sessão do Chrome permitiu autenticar o CLI 63.1.0 em uma configuração isolada,
sem substituir a sessão anterior. A branch foi enviada e a integração Git
publicou o preview do commit `594ec14`:
`https://saa-s-whatsapp-7unmjbbw1-andres-projects-bbfd1881.vercel.app`.
O deploy ficou Ready; o navegador autenticado abriu a Inbox e a nova central
de integrações, sem overflow horizontal no desktop.

O preview daquela rodada correspondia exatamente ao commit
`9eac8d6f0364f506cf8e92519b40edb6269be18a`:
`https://saa-s-whatsapp-ljc1zjyx5-andres-projects-bbfd1881.vercel.app`.
O alias da branch foi atualizado para essa revisão. Os GETs autenticados
foram repetidos nessa revisão e mantiveram os resultados descritos abaixo.

GET autenticado no preview: ações, comércio e campanhas retornaram 503;
qualidade retornou 500. O health continuou 200/healthy. Uma consulta Postgres
somente leitura confirmou ausência das novas tabelas no banco online. Naquela rodada, preview
e produção apontavam ao mesmo Supabase, então os testes de escrita precisam
de um ambiente separado antes da aplicação das migrations.
Não houve promoção, alteração persistente de schema remoto ou envio de mensagem.

## Validação das alterações de schema

Os testes de isolamento precisam de um projeto Supabase de teste separado ou
de uma branch de banco explicitamente identificada como descartável. Os testes
que criam fixtures, trocam papéis ou removem dados não devem usar produção.
O ambiente precisa permitir aplicar e reaplicar o schema e observar os
privilégios de `anon`, `authenticated` e `service_role`.

As novas migrations desta frente são 0246 (comércio), 0244 (ações), 0245
(qualidade) e 0247 (campanhas), com timestamps que determinam a aplicação.
A migration 0243 já existente do funil do site foi preservada.

As quatro migrations foram instaladas e reaplicadas pelo SQL Editor
administrativo do Supabase existente, dentro de uma única transação com
`ROLLBACK` explícito. O texto executado foi conferido byte a byte com o
arquivo preparado antes de confirmar a execução. O resultado final retornou
NULL para as quatro novas tabelas, e uma leitura Postgres posterior confirmou
que todas as novas tabelas continuam ausentes. Esse preflight comprova
compatibilidade de DDL e reaplicação sobre o schema atual, sem persistir
alterações nem inserir fixtures. Não substitui os testes de RLS e baseline
em um banco separado. A conexão do aplicativo não é dona das tabelas e foi
mantida com suas permissões limitadas.

O harness legado depende de Docker e não foi executado. O novo
`scripts/test-db-online.mjs` usa `TEST_DATABASE_URL`, recusa conexão inválida e
pooler de transação, exige banco com zero tabelas públicas e zero usuários,
confere os papéis Supabase e instala/reaplica o baseline. Um marcador com
expiração limita a execução dos testes ao ambiente preparado pelo runner.
O config `vitest.online-db.config.ts` cobre isolamento de comércio, ações e
campanhas e os nove casos SQL de qualidade, incluindo disputa do token.
O proprietário confirmou que `deskcomm` era o mesmo projeto local e autorizou
sua pausa. Foi criado o projeto `atenza-validacao-free`
(`zaagoawswxlwzwhmtzyi`) na organização `whatsapp`, no plano Free. Nenhum
upgrade foi contratado e nenhum projeto Lovable foi excluído.

O baseline foi instalado e reaplicado nesse banco remoto. A execução do runner
online terminou com exit 0: quatro arquivos e 66 testes aprovados, incluindo
isolamento entre organizações, RLS/RBAC, idempotência e concorrência do token de
avaliação. Esses testes usaram somente dados sintéticos no projeto de teste.
O registro da sessão anterior conserva o resultado; o log estava em `/tmp` e
foi removido após o encerramento do ambiente. Na retomada, as novas tabelas
foram confirmadas pela Data API do projeto de teste.

## Critérios antes de publicar

1. Conferir equipe, projeto e revisão de código do preview Vercel.
2. Instalar e reaplicar as migrations no banco de teste, provando isolamento e
   privilégios dos novos módulos.
3. Executar as jornadas autenticadas em desktop e celular no preview: conectar
   loja de teste, selecionar e publicar ações, preparar conhecimento por URL,
   revisar qualidade e acompanhar campanha com destinatários de teste.
4. Suspender uma ação enquanto o DNS aguarda e provar ausência de chamada
   externa após revogação. Provar espera de campanha fora do horário e revisão
   de resultado incerto sem reenvio.
5. Usar autorização explícita e destinatários de teste para operações externas.
   Fixtures e mocks não certificam autorização de loja ou entrega real.

## Evidência da branch em 09/10/2026

- Core: 12 arquivos, 250 testes passaram, incluindo revogação após DNS e
  higienização de segredo em chaves/result mapping.
- Navegação/i18n: 26 testes passaram. Contratos de conhecimento, versões e
  MANIFEST: 27 testes passaram.
- UI: 49 testes únicos aprovados entre seletor, campanhas, qualidade e cadastro
  de conhecimento. O teste do link da campanha foi corrigido para conferir o
  link antes de abrir o modal, que oculta o fundo para leitores de tela; os 3
  testes da campanha passaram na reexecução.
- Total sem duplicação nas rodadas finais: 22 arquivos / 352 testes focados.
  Essa rodada inicial foi focada; a aprovação completa posterior está abaixo.
- Qualidade: suíte específica passou com 62 testes, 19 de UI; sobrepõe core/UI.
- ESLint focado dos novos módulos, telas e runner online: zero erros/avisos.
  Lint global anterior: zero erros, 376 avisos. O lint de canais agora passa;
  quatro referências anteriores foram corrigidas e os 7 testes do helper
  legado continuam aprovados.
- Revisão independente final: nenhum BLOCKER/MAJOR comprovado no escopo de
  revogação, segredo e espera/revisão de campanha. O cancelamento durante veto
  tem predicados SQL, mas falta teste específico de concorrência em banco.
- Typecheck completo aprovado após corrigir duplicações de campos, eventos de
  auditoria, locale das telas e tipos de testes. A rodada final terminou com
  exit 0. A UI de qualidade passou novamente com 19 testes.
- O workflow sem Docker foi executado no GitHub para o commit `594ec14`:
  [run 37954137761](https://github.com/andreajoa/SaaS-whatsapp/actions/runs/37954137761).
  O build de produção e o job de tipos/lint foram aprovados. A suíte completa
  terminou com 8.960 aprovados, 14 falhas e 1 falha esperada em 831 arquivos.
  As 14 falhas foram corrigidas: clipboard canônico, status traduzido, tokens
  Tailwind, inventário/contratos CI, classificação de ferramentas de
  configuração, compatibilidade do rodapé de e-mail, cobertura das guardas de
  suporte e fixtures do envio por credencial do tenant. O bloco final de
  revogação anon foi movido depois das novas funções no baseline.
  As reexecuções focadas passaram com 185 testes únicos, incluindo 4 novos
  testes de autorização do wrapper de campanha. Tipos e lint continuaram
  aprovados.
- A rodada completa sem Docker do commit `9eac8d6` foi aprovada:
  [run 37957667832](https://github.com/andreajoa/SaaS-whatsapp/actions/runs/37957667832).
  Os quatro shards somam 832 arquivos, 8.982 testes aprovados e uma falha
  esperada, sem falhas inesperadas. Build serverless e tipos/lint passaram.
  Os 62 testes específicos de qualidade também passaram em cada shard;
  sobrepõem a suíte completa e não entram novamente na contagem única.
  A rodada anterior do commit `464bbf5`, run 37956913280, também terminou
  aprovada. A validação SQL/RLS no banco Free passou com 66 testes, conforme
  descrito acima.
- O transporte de `executeRestAction` foi executado sem mocks contra a API
  pública GitHub: HTTP 200 em 717 ms, retornando o repositório esperado. Isso
  exercita DNS/TLS/HTTP reais; não prova persistência no Atenza nem uma loja
  autenticada.

As suítes unitárias usam fixtures. O probe GitHub certifica apenas o transporte
descrito; o preflight certifica apenas o DDL revertido. Loja autorizada, jornada
multitenant e persistência dos novos módulos no ambiente online permanecem
pendentes.

## Retomada concluída: código e preview isolado

Commit `cf7dc95f2c3c9e2031a352166f4241b098a6e54a`, preview
`https://saa-s-whatsapp-kcsbs1glw-andres-projects-bbfd1881.vercel.app`.
A equipe e o projeto foram conferidos no CLI oficial. As 35 variáveis de
validação têm destino preview e branch exata; o banco é exclusivamente
`zaagoawswxlwzwhmtzyi`. WhatsApp, Redis e credenciais de serviços pagos estão
desativados nessa configuração. A cifra do banco de teste foi provisionada e
o papel Postgres da aplicação continua sem ownership, SUPERUSER, CREATEDB
ou CREATEROLE. Nenhuma fixture foi inserida em produção.

[CI 37994667128](https://github.com/andreajoa/SaaS-whatsapp/actions/runs/37994667128)
aprovou tipos, lint, build serverless e a suíte completa: 833 arquivos,
8.989 testes passaram e uma falha esperada. A suíte específica de qualidade
passou com 63 testes; ela sobrepõe os anteriores. O typecheck local também
passou usando Node 22 e limite de heap de 4 GB.

Duas jornadas autenticadas, desktop 1440×1000 e celular 390×844, passaram em
2,7 minutos no Playwright. Nenhuma resposta do aplicativo foi simulada:

- Login e identificação da organização sintética pela API de sessão.
- Central de lojas com resposta HTTP 200 e botões Shopify/WooCommerce.
- Criação de ação e chamada HTTPS real ao GitHub, retorno mapeado e histórico
  de execução preservado após recarga. Cabeçalho cifrado não reapresentado.
- Ação disponível e selecionável no formulário do agente. Esse passo não
  publica uma versão nem executa um atendimento de IA.
- Cadastro de fonte por URL e persistência após recarga. A resposta confirmou
  `indexacao_habilitada: false`, pois a chave de IA foi desativada no teste.
- Salvamento de metas HTTP 200, recarga e confirmação visível.
- Campanhas e opções de campanha HTTP 200, sem erro e sem overflow horizontal.

As screenshots estão em `.superpowers/evidence/atenza-online-preview`.
Traces e arquivos de sessão foram desativados para não registrar credenciais.
O OIDC oficial só foi enviado ao domínio exato do preview. O runner recusa
domínio de produção e exige a identidade do banco de testes.

A verificação real encontrou e corrigiu a confirmação perdida ao remontar a
política de metas. O teste de regressão falhou antes da correção e passou
depois. Também foi corrigida a configuração que incluía Playwright no Vitest
e o encerramento do timer de foco Radix no teste do composer.

A CA pública oficial do Supabase passou a ser configurável. O pool exige
`rejectUnauthorized: true` quando ela existe e remove parâmetros de SSL da
URL que fariam o pg substituir a CA. A conexão remota com o papel restrito
foi confirmada; quatro regressões exercitam a interpretação real do pg.

Loja autorizada, OAuth e sincronização de catálogo/pedidos reais ainda exigem
uma loja de teste do proprietário. A indexação/atendimento de IA e a entrega
de WhatsApp também não foram certificados nesta rodada. Não confundir os
resultados de preview e os 66 testes SQL anteriores com essas integrações.

## Aplicação do schema em produção

As quatro migrations foram aplicadas no projeto `cclrwowgjtutvtlwuday` pelo SQL
Editor administrativo, numa única transação. O texto foi comparado byte a byte
com o arquivo preparado antes da execução: SHA-256
`a315de94a11ea605de83ab44710ec3ca7ff02625691bce5203dce18f8d446ffa`.
O script conferiu as dez novas tabelas com RLS ativo e sem SELECT para `anon`
antes do COMMIT; uma consulta posterior confirmou as mesmas invariantes.
As contagens existentes permaneceram iguais: 4 organizações, 0 pedidos e
0 produtos. Não houve fixtures, mensagens ou mutações de loja em produção.
A cifra existente também foi verificada, sem trocar a chave.

## Publicação e conferência final

O build de produção `dpl_8GNJqx1gE6o9WWofqheqfXs6pbvx` foi preparado a partir
do `git archive` do commit `cf7dc95`, usando variáveis de produção, e conferido
antes da promoção. Somente arquivos rastreados foram enviados; os únicos
arquivos `.env*` eram os dois exemplos do repositório. O login e o health foram
abertos pelo Chrome com autenticação Vercel normal: HTTP 200 e `healthy`,
Supabase/Redis/WhatsApp `ok`. Não foi necessário ampliar Trusted Sources.

A promoção oficial foi concluída. O projeto Vercel confirmou o deployment e
SHA exatos como destino de produção. Em `https://www.atenza.online`, login e
health continuaram HTTP 200. A sessão existente abriu a central de integrações
e seis GETs autenticados retornaram HTTP 200: comércio, ações, histórico de
ações, qualidade, campanhas e opções de campanha. São verificações somente
leitura; não houve envios ou fixtures na organização de produção.

A pedido do proprietário, a Vercel Toolbar foi desativada explicitamente no
projeto Atenza para preview e produção (`enablePreviewFeedback=false` e
`enableProductionFeedback=false`). Não há dependência da Toolbar no código.
O painel confirmou ambos os valores como `Off`. Uma resposta nova do servidor
não injeta o script da Toolbar, e a conferência visual da aba autenticada,
inclusive após recarregar `/app/integrations`, confirmou a ausência da Toolbar.
A preferência do projeto deve permanecer em futuras publicações.

Destino anterior preservado para rollback de aplicação:
`dpl_6W1b8s1ieYc3A7osiiwBtbP1YLkV`, SHA
`228605d8a28423448cd760dcb1af46bbcf1879de`. Não remover as novas tabelas numa
reversão de aplicativo; as migrations são aditivas e seguem versionadas.
A main não foi alterada; o release usa o commit verificado da branch.

## Conferência para divulgação — 9 de outubro de 2026

Este registro complementa as rodadas anteriores. O proprietário dispensou a
conexão com loja real, pois não dispõe de uma loja, e dispensou a chamada de IA
com a chave da plataforma: cada cliente usará a própria API. Essas dispensas
não equivalem a testes aprovados de OAuth, sincronização, geração ou entrega.

O commit `e71c4e91eddcb12781500c132131589295f14929` passou no
[CI 38016497933](https://github.com/andreajoa/SaaS-whatsapp/actions/runs/38016497933):
tipos, lint, build serverless e 9.001 testes unitários, mais uma falha esperada.
Foi publicado como `dpl_8UsZsrbcKyNvTAN2vErNV9uif9n6`, com o domínio
`www.atenza.online` conferido pelo CLI oficial. A origem desse release é um
arquivo dos arquivos rastreados; credenciais e evidências privadas ficaram de
fora. O destino anterior de aplicação é
`dpl_8GNJqx1gE6o9WWofqheqfXs6pbvx`, para rollback sem remover tabelas.

As verificações online adicionais passaram:

- Cinco páginas públicas em desktop e celular: dez respostas HTTP 200, sem
  exceções JavaScript, overflow horizontal ou Vercel Toolbar visível.
- Cadastro sintético, confirmação pelo callback normal com TokenHash, vínculo
  com a organização, primeiro acesso e onboarding concluído sem conectar loja
  nem enviar mensagens. Entrega de email não foi exercitada.
- Recuperação de senha em celular: callback, troca de senha, saída da sessão
  e novo login com a senha alterada, preservando a organização correta.
- CRM: criação/edição de contato, criação/conclusão de tarefa e criação de
  lead com persistência após recarga, em desktop e celular.
- O botão Novo contato estava cortado no celular. A correção permite quebrar
  as ações em linhas; o botão inteiro foi conferido visualmente e criou um
  contato sintético sem telefone, HTTP 201, preservado após recarga e no desktop.
- Após a promoção, o health público respondeu HTTP 200, `healthy`, com
  Supabase, Redis e WAHA `ok`. Isso prova conectividade; não prova entrega ao
  destinatário nem resposta de um agente publicado.

Todos os testes com escrita de cadastro e CRM usaram o banco isolado
`zaagoawswxlwzwhmtzyi`, com guardas de origem e de identidade da organização.
OIDC foi limitado ao domínio exato do preview. Não houve fixtures, publicação
de agente ou envio a clientes em produção. Traces, tokens e senhas não estão
neste relatório nem no repositório.

### Manutenção e acompanhamento

O tick do Relógio agora retorna HTTP 500 se uma tarefa falhar, mantendo o
registro das tarefas executadas e sem expor exceções internas. A retenção
chama a função de nonces com os argumentos reais `p_dias` e `p_lote`; as outras
funções continuam com seus contratos próprios. As regressões e a revisão
independente passaram. Uma consulta somente leitura confirmou a rotina por
minuto e as tarefas recentes com sucesso. O histórico de retenção ainda
mostrava a execução anterior à correção: a próxima execução diária não foi
observada, e nenhum expurgo global foi forçado em produção para testar.

### API de IA do cliente e limites

A revisão independente confirmou o fluxo de chave própria: administrador
cadastra a credencial, o sistema cifra com AES-GCM, a lista usa a view segura,
o agente seleciona a credencial e a publicação verifica sua organização,
atividade, validação e correspondência ao provedor. O runtime prioriza a chave
do cliente; a chave da plataforma é fallback. Há testes da precedência,
ausência de chave e exposição segura. Isso comprova a implementação revisada,
sem certificar uma chave ou atendimento real de cliente.

Antes da dispensa, o modelo do rascunho testado devolveu texto sem propor
`send_message` (`no_candidate`). Um modelo alternativo recebeu HTTP 402;
consulta somente leitura confirmou saldo negativo na conta da plataforma.
Não houve compra de créditos, troca de modelo persistido ou publicação desse
rascunho. Os controles de horário foram exercitados isoladamente: bloquearam
fora da janela e permitiram uma proposta no horário simulado, sem executar
envio. Esses probes não contam como aprovação de geração de IA.

Entrega real de WhatsApp, campanhas e emails não foi certificada sem
destinatário próprio fornecido. Conexão de loja e geração com API real ficam
fora do fechamento por decisão explícita do proprietário. Não afirmar que
essas integrações foram comprovadas pelos testes de interface ou pelo health.

## Retomada — 10 de outubro de 2026: desfecho do teste do agente

O POST de teste gravava `ok`/`error` em `ai_agent_runs`, enquanto o CHECK do
baseline aceita `completed`/`failed`. A correção preserva `ok`/`blocked` na API,
grava um estado terminal válido e informa falha de persistência. Ambos os
UPDATEs exigem uma linha retornada, inclusive quando o runtime lança uma
exceção: atualização sem registro não pode anunciar sucesso.

Prova local com configuração offline, sem credenciais reais: o handler
original reprovou 9 dos 11 casos; restaurada a correção byte a byte, os 11
passaram, junto com 7 casos do preview do motor (18 testes em dois arquivos).
Os casos cobrem candidato, bloqueio, exceção, falha de gravação, ausência de
registro, recorte de organização/versão e autorização. A revisão independente
reproduziu o UPDATE sem efeito no client PostgREST instalado, exigiu a guarda
de linha retornada e depois aprovou os 11 casos, sem BLOCKER ou MAJOR no escopo.

Typecheck completo passou. ESLint global terminou com zero erros e 365 avisos
existentes; lint focado, canais, hierarquia de papéis, fragmentos de release e
diff-check passaram. Schema e políticas não foram alterados. A verificação
online desta revisão ainda está pendente; estes resultados locais não
certificam uma chamada de IA ou entrega de mensagem.
