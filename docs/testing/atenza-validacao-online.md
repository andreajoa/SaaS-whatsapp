# Validação do Atenza online

Orientação explícita do proprietário em 09/10/2026: o Atenza é um serviço online.
Nesta frente, não usar Docker. O destino é a instalação Vercel/Supabase do
Atenza; não mudar o modelo de hospedagem para self-host.

## Ambiente verificado nesta retomada

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

GET autenticado no preview: ações, comércio e campanhas retornaram 503;
qualidade retornou 500. O health continuou 200/healthy. Uma consulta Postgres
somente leitura confirmou ausência das novas tabelas no banco online. Preview
e produção ainda apontam ao mesmo Supabase, então os testes de escrita precisam
de um ambiente separado antes da aplicação das migrations.
Não houve promoção, escrita de schema remoto ou envio de mensagem.

## Validação das alterações de schema

Os testes de isolamento precisam de um projeto Supabase de teste separado ou
de uma branch de banco explicitamente identificada como descartável. Os testes
que criam fixtures, trocam papéis ou removem dados não devem usar produção.
O ambiente precisa permitir aplicar e reaplicar o schema e observar os
privilégios de `anon`, `authenticated` e `service_role`.

As novas migrations desta frente são 0246 (comércio), 0244 (ações), 0245
(qualidade) e 0247 (campanhas), com timestamps que determinam a aplicação.
A migration 0243 já existente do funil do site foi preservada.

O harness legado depende de Docker e não foi executado. O novo
`scripts/test-db-online.mjs` usa `TEST_DATABASE_URL`, recusa conexão inválida e
pooler de transação, exige banco com zero tabelas públicas e zero usuários,
confere os papéis Supabase e instala/reaplica o baseline. Um marcador com
expiração limita a execução dos testes ao ambiente preparado pelo runner.
O config `vitest.online-db.config.ts` cobre isolamento de comércio, ações e
campanhas e os nove casos SQL de qualidade, incluindo disputa do token.
A execução real depende de um banco de teste. O acesso foi recuperado, mas a
cota Free já contém Atenza e `deskcomm` ativos. Os quatro projetos de Lovable
estão pausados e não consomem essa cota. Nenhum upgrade foi contratado, projeto
apagado ou pausado. O proprietário determinou não pagar nada; a decisão de
pausar `deskcomm` está pendente porque interrompe outro projeto ativo.

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
  Isso não representa execução/aprovação da suíte completa.
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
  aprovados. A nova rodada completa será executada na revisão seguinte.
  SQL/RLS remoto permanece pendente.
- O transporte de `executeRestAction` foi executado sem mocks contra a API
  pública GitHub: HTTP 200 em 717 ms, retornando o repositório esperado. Isso
  exercita DNS/TLS/HTTP reais; não prova persistência no Atenza nem uma loja
  autenticada.

Esses resultados usam fixtures e não certificam transporte, loja, jornada
multitenant ou persistência real no ambiente online.
