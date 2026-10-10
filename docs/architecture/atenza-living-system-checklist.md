# Living System Checklist — Atenza: integrações e experiência

Registro de implementação e publicação online verificada. Mapas adjacentes têm entrada, saída e retorno explícitos para cada módulo. Os limites de integrações externas estão registrados abaixo.

| Pergunta | Comércio | Ações REST | Conhecimento URL | Qualidade | Campanhas |
|---|---|---|---|---|---|
| 1. Fonte real | Administrador conecta loja; Shopify assina webhook | Gerente configura API; versão autoriza IDs | Operador cadastra página HTTPS pública | Mensagens/conversas existentes e política opt-in | Gerente seleciona contatos/modelo e confirma |
| 2. Consumidor real | Catálogo, busca MCP e pedidos no Inbox | Engine do agente e execução manual explícita | Indexer, chunks e busca do agente | Dashboard, conversa e resposta do visitante | Dispatcher e handler normal de envio |
| 3. Registro | commerce_sync_runs, recibos e audit | execution history e audit | Estado da fonte e evento de indexação | Política, survey e audit sem exposição do token | Destinatários, tentativas, recibos e audit |
| 4. Tela | Central de integrações e catálogo | Ações: histórico; agente: seleção por versão | Conhecimento: fonte, estado e erro | Qualidade e botão Avaliação no Inbox | Campanhas: prévia, progresso e resultado |
| 5. Porta | Navegação → Integrações | Hub IA → Ações de integração | Hub IA → Conhecimento | Navegação → Qualidade; Inbox → Avaliação | Navegação → Campanhas |
| 6. Anti-morte | Fila durável, lease e nova tentativa visível | Timeout, falha explícita e histórico; sem retry automático de mutação | Estado de falha preserva versão anterior | Token expira; ausência de resposta permanece declarada | Pausar, encerrar revisão sem reenviar e retomar pendentes; horário futuro mantém espera durável |
| 7. Configuração | URL, autorização e controles de sincronização | URL fixa, entradas, credenciais cifradas e retorno autorizado | URL e seleção de fonte no agente | Política desativada até configuração explícita | Canal, contrato do modelo, público e intervalo |
| 8. IA↔humano | Mesma fonte de produto/pedido para ambos | Publicação humana autoriza agente; humano consulta execução | Mesma fonte selecionada; operador revisa falha | Humano usa feedback para rever política/contexto; IA não envia pesquisa automaticamente | Campanha e entrega ficam acessíveis na conversa; envio obedece fronteira normal |
| 9. Retorno de erro | Erro explica reparar conexão e repetir sync | Histórico informa falha/resultado incerto e permite ajustar configuração | Corrigir URL e reindexar, sem apagar acervo anterior | Rever prazo e atendimento pelo feedback; sem automação inventada | Conferir recibo antes de repetir; relatório independente orienta correções |
| 10. Mapa | commerce.architecture.json | integration-actions.architecture.json | url-knowledge.architecture.json | service-quality.architecture.json | customer-campaigns.architecture.json |

## Conexão Postgres do ambiente online

O pool existente (`lib/agent-engine/db/pool.ts`) recebe `SUPABASE_DB_URL` e,
opcionalmente, `SUPABASE_DB_CA_CERT` do operador. Alimenta as rotas de campanha
e o runtime do agente; exige TLS validado quando a CA está configurada. A
superfície de configuração é `.env.example` e o ambiente Vercel da instalação.
Falhas de conexão continuam nos logs do pool e nos estados de erro das telas;
não há nova mutação nem decisão automática. O retorno é corrigir a conexão e
repetir a operação pela mesma tela. Nenhuma peça nova foi criada no mapa.

## Limites da verificação

O build, tipos/lint e a suíte completa foram aprovados na revisão `8da768a`.
O baseline foi instalado/reaplicado no projeto Supabase Free de validação, onde
passaram 66 testes de SQL/RLS. A retomada corrigiu e validou a conexão TLS do
pool real, mantendo um usuário de aplicação sem ownership, CREATEDB ou
CREATEROLE. Jornadas autenticadas desktop/celular passaram no preview isolado,
e a publicação foi conferida no domínio de produção.

O proprietário dispensou a conexão real de Shopify/WooCommerce e a chamada
de IA com a chave da plataforma, pois cada cliente usará a própria API. Não
afirmar conexão externa ou geração concluída com fixtures. Campanhas não foram
enviadas a clientes. O teste próprio de email teve recibo de entrega; o de
WhatsApp foi aceito pelo provedor e aguarda confirmação de entrega.
Detalhes e evidências em `../testing/atenza-validacao-online.md`.

## Evidência da retomada online

CI do commit `cf7dc95` verde, suíte completa 8.989 testes aprovados (mais uma
falha esperada) e 63 testes específicos de qualidade aprovados. Playwright
passou em desktop/celular no preview isolado: entrada pela UI, APIs, Supabase,
chamada pública GitHub, histórico, fonte URL e metas após recarga. Isso comprova
os caminhos de persistência dessa jornada; não comprova loja autorizada,
indexação por IA, publicação do agente ou entrega externa de campanha.

O salvamento de metas perdia a confirmação porque o componente de edição
remontava ao receber a política atualizada. A confirmação agora pertence ao
painel e sobrevive à atualização; erro de edição continua no formulário.
Teste de regressão comprovou falha antes/correção depois.

Schema de produção aplicado em transação e dez tabelas verificadas com RLS e
sem leitura anônima; contagens existentes preservadas. A CA pública foi
configurada para o pool remoto com verificação de TLS. Consulta de credenciais
e fixtures ficou restrita ao projeto de teste, conforme o documento de
validação online.

## Conferência adicional de operação

Cadastro, confirmação, onboarding, recuperação de senha e CRM passaram no
banco isolado, com vínculo da organização conferido antes das escritas. O
botão Novo contato ficou totalmente acessível no celular e criou um contato
HTTP 201 que permaneceu após recarga e no desktop. O domínio publicado passou
em dez verificações de páginas públicas, sem Toolbar ou overflow, e seu health
retornou Supabase/Redis/WAHA `ok`.

O Relógio recebe o cron por minuto, registra a execução e devolve HTTP 500 ao
agendador se alguma tarefa falhar. Esse retorno permite detectar e investigar
a falha; não existe um painel de Relógio inventado para essa correção. A
retenção usa os argumentos reais da RPC de nonces. A execução diária posterior à correção
foi observada com sucesso em 10/10/2026 às 04:40:03 UTC; a falha antiga fica no
histórico.

A revisão do fluxo de chave própria confirmou cadastro cifrado, listagem
segura, seleção por agente e precedência da credencial do cliente no runtime.
Geração e entrega com uma API real ficam fora desta certificação por decisão
do proprietário. Esses ajustes usam módulos existentes e não criam uma nova
entrada no mapa de arquitetura.

## Desfecho do teste do agente

1. Entrada: `TestPanel` envia a versão autorizada ao POST de teste, que exige
   administrador e recorta versão, agente e organização.
2. Saída: `testAgentVersion` retorna candidatos/propostas; `ai_agent_runs`
   recebe o desfecho e `TestPanel` recebe resultado ou erro.
3. Registro: dry-run com `completed_at`, estado válido e código de falha;
   `ai_agent.tested` audita o resultado quando a gravação é confirmada.
4. Tela: a aba Teste mostra o resultado ou a orientação do erro. O registro
   de dry-run não deve ser confundido com a aba Execuções, que lê `llm_calls`.
5. Porta: Hub IA → Agentes → detalhe → Teste.
6. Anti-morte: fim declarado como `completed` ou `failed`; gravação sem linha
   retornada ou com erro devolve HTTP 500, sem anunciar sucesso.
7. Configuração: versão, modelo, credencial e materiais no formulário do agente.
8. Continuidade: teste não atende clientes; não envia mensagem nem publica a
   versão. O operador usa o resultado para revisar a configuração.
9. Retorno: falha orienta conferir modelo, credencial e materiais; o operador
   corrige o rascunho e repete explicitamente o teste, sem reenvio automático.
10. Mapa: o motor compartilhado está documentado em `agent-turn.workflow.json`;
    esta correção altera a persistência da rota de preview existente, sem
    adicionar peça nova de arquitetura.


## Fechamento online da correção de preview

A revisão `8da768a` passou em 834 arquivos/9.012 testes e foi publicada no domínio
Atenza. A jornada da aba Teste no banco isolado demonstrou HTTP 422, orientação
visível e dry-run terminal `failed` persistido, removendo os registros sintéticos
após a conferência. Nenhuma peça nova foi criada no mapa.

A entrega usa os caminhos existentes: wrapper Resend e handler compartilhado de
mensagens. O email próprio teve recibo `delivered`; WhatsApp teve identificador
externo e estado `sent`, com confirmação ao aparelho ainda pendente. O número
próprio entrou temporariamente na lista permitida do canal de teste, cuja
configuração original foi restaurada. Não houve geração de IA nem campanha.
