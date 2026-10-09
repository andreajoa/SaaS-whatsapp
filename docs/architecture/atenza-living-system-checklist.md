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

## Limites da verificação

Shopify/WooCommerce dependem da autorização de uma loja real; não afirmar conexão externa concluída com fixtures. Campanhas não foram enviadas a clientes. Testes sintéticos verificam permissões, contrato e estados. Um baseline anterior foi instalado em PostgreSQL 15, mas isso não aprova as correções SQL/RLS desta retomada. O proprietário definiu operação online sem Docker. Core final: 250 testes; navegação/i18n: 26. Tipos gerados sincronizados; typecheck completo, build e jornada autenticada não certificados. SQL/RLS aguardam Supabase de teste identificado; acesso ao preview Vercel retornou 403. Detalhes em `../testing/atenza-validacao-online.md`.
