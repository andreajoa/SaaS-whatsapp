# Living System Checklist — Atenza: integrações e experiência

Registro de implementação; validação de release ainda pendente. Mapas adjacentes têm entrada, saída e retorno explícitos para cada módulo.

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

O build, tipos/lint e a suíte completa foram aprovados na revisão `9eac8d6`.
O baseline foi instalado/reaplicado no projeto Supabase Free de validação, onde
passaram 66 testes de SQL/RLS. A retomada corrigiu e validou a conexão TLS do
pool real, mantendo um usuário de aplicação sem ownership, CREATEDB ou
CREATEROLE. O novo preview e suas jornadas permanecem em validação.

Shopify/WooCommerce dependem da autorização de uma loja real; não afirmar
conexão externa concluída com fixtures. Campanhas não foram enviadas a clientes.
Detalhes e evidências em `../testing/atenza-validacao-online.md`.
