# Hermes + FreeLLMAPI como opção adicional do Atenza

**Status: prova de conceito em branch separada; NÃO conectada ao worker e NÃO ativa em produção.**

## Contrato do produto

As empresas configuram o nome do atendente, informações comerciais, horários e regras.
Gemini, OpenRouter, OpenAI e Anthropic continuam disponíveis. Hermes + FreeLLMAPI
é opcional; o cadastro da empresa nunca troca os provedores existentes.

O nome do atendente é atributo da empresa e não pode ser chave de sessão.

## Fronteira de confiança e isolamento

- organizationId vem da autenticação/resolução do tenant no Atenza.
- conversationId vem de consulta ao banco filtrada por organization_id.
- Histórico, conhecimento, regras, preços e ferramentas são lidos APENAS sob
  organization_id da sessão autenticada (não do texto do usuário/modelo).
- A ponte em lib/ai/hermes/cliente-isolado.ts cria identificadores opacos
  HMAC por empresa + conversa, utilizados nos headers X-Hermes-Session-Id e
  X-Hermes-Session-Key, e outro por turno para Idempotency-Key.
- É proibido passar credenciais ao modelo; comandos do CRM devem ser
  validados no Atenza e escopados por tenant.
- É obrigatório um perfil Hermes dedicado, criado SEM clonar o pessoal,
  com FreeLLMAPI auto, memória global desativada e ferramentas nativas
  desativadas (terminal, arquivos, navegador, web, cron e MCP não autorizado).
- Perfis Hermes isolam estado, mas não dão sandbox de filesystem. Rodar em
  contêiner sem acesso ao host nem segredos pessoais; acesso somente pela rede
  privada do app/worker, autenticado.
- LGPD, logs sem PII, retenção, rate limit por tenant e limites comerciais.

## Bloqueador antes de atendimento real

A API do Hermes executa as próprias ferramentas do agente. Não está homologada
para retornar as chamadas de ferramentas esperadas pelo runModelCall do Atenza.
O Atenza envia mensagens via send_message e atualiza funis/agendas por tools:
trocar o modelo indiscriminadamente pode deixar de enviar ou registrar ações.

NÃO habilitar Hermes no seletor ou onboarding antes da homologação.
Opções: integrar ferramentas com MCP restrito e autorização por tenant no Atenza,
ou usar Hermes somente para classificação/planejamento sem tools e manter o
agente original para os turnos que alteram CRM ou enviam WhatsApp.
Uma resposta textual livre do Hermes não deve contornar os guardrails de envio.

## Testes de aceitação ainda necessários

1. Duas organizações com nome de atendente e primeira mensagem iguais,
   conversas concorrentes: IDs de sessão separados.
2. Tentativa de obter dados da outra empresa: recusada por RLS e por
   autorização das ferramentas, inclusive após prompt injection.
3. Sem memória/skills/arquivos entre empresas após restart e compaction.
4. Comprovar lead criado, funil alterado, horários consultados e agendamento
   real, mensagem única no ledger e histórico apenas do tenant correto.
5. Retries, webhooks duplicados, timeout e 429: sem envios repetidos,
   respeitando capacidade dos modelos e fallback seguro.
6. Falha do Hermes não altera provedores já cadastrados nem seus clientes.
7. Teste de carga, p95 e governança de custo por organização.
8. Termos de uso de cada provedor gratuito e LGPD verificados antes de produção.

## Escopo do experimento

Os seis testes unitários da ponte HTTP usam um servidor simulado; NÃO são
prova de integração com o Hermes real, banco ou WhatsApp. O transporte ainda
não foi adicionado ao runtime. Não ativar em produção.

FreeLLMAPI não garante disponibilidade dos tiers gratuitos e seu mantenedor
não recomenda uso como backend único de um SaaS comercial.
