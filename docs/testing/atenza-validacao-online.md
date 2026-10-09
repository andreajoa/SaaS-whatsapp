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

O conector Vercel recusou a consulta do projeto `saa-s-whatsapp`, equipe
`andres-projects-bbfd1881`, com HTTP 403 por falta de acesso ao escopo. O CLI
63.1.0 foi instalado separadamente e confirmou que a sessão salva acessa outra
equipe, sem o projeto Atenza. A integração GitHub/Vercel existente foi
confirmada pelos status do commit de produção. A branch de implementação será
enviada para gerar o preview e executar verificações GitHub sem Docker.
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
O config `vitest.online-db.config.ts` cobre isolamento de comércio e ações;
qualidade e campanhas ainda precisam de validação SQL online adicional.
A execução real depende de um banco de teste e acesso ainda indisponíveis.

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
- O build local anterior foi interrompido com TERM após cerca de 18 minutos
  (exit 143). O workflow `atenza-online-verify.yml` executa typecheck/lint,
  suíte unitária completa e build em três runners separados. Esses gates
  remotos e SQL/RLS ainda precisam de resultados.

Esses resultados usam fixtures e não certificam transporte, loja, jornada
multitenant ou persistência real no ambiente online.
