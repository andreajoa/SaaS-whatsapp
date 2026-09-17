# SaaS Whatsapp — arquitetura cloud scale

## Objetivo

Uma única plataforma atende muitas empresas. Cada organização (`organization_id`) tem WhatsApp, usuários, contatos, conversas, agentes, memória, documentos, regras e ferramentas isolados. O modelo de IA é infraestrutura compartilhada; o contexto é sempre montado por tenant.

## Topologia

```text
Cloudflare (DNS/WAF/rate-limit)
        |
        v
Vercel / Next.js 16  ---- Resend
        |
        +---- Supabase (Postgres/Auth/RLS/Realtime/Storage/pgvector)
        |
        +---- fila/event_log ---- workers horizontais
                                   |        |
                                   |        +---- Meta WhatsApp Cloud API (preferencial)
                                   |        +---- WAHA (opcional, conexão QR)
                                   |
                                   +---- AI endpoint próprio OpenAI-compatible
                                         SAAS_AI_BASE_URL
```

## Cérebro de cada empresa

Não existe um processo de LLM diferente por empresa. Existe um motor de inferência comum e, antes de cada turno, o sistema resolve o `organization_id` e monta o contexto exclusivamente daquele tenant:

1. versão publicada do agente e prompt;
2. regras/memória da organização;
3. conhecimento recuperado por RAG/pgvector;
4. contato e histórico da conversa;
5. ferramentas/capacidades autorizadas;
6. limites de orçamento, handoff e segurança.

RLS e filtros programáticos de `organization_id` são mantidos como fronteira de isolamento. Nenhum prompt ou vetor de outra organização entra no turno.

## IA da plataforma

O provider lógico é `saas_ai`. Ele fala com um endpoint OpenAI-compatible controlado pela plataforma. O app usa aliases estáveis:

- `platform-chat`: atendimento e tool calling;
- `platform-fast`: classificação/roteamento;
- `platform-embedding`: embedding de 1536 dimensões;
- `platform-transcribe`: transcrição compatível com `/v1/audio/transcriptions`.

O backend físico pode mudar sem regravar agentes. Em vLLM ou gateway equivalente, exponha `served-model-name`/aliases correspondentes. Codex e Claude Code permanecem ferramentas de engenharia, não o runtime das conversas dos clientes.

## WhatsApp

`meta_cloud` é o caminho preferencial para escala e conformidade. `waha` permanece como opção para conexão por QR e migração. O domínio não depende do provider: eventos entram na camada de canais, são normalizados e seguem pelo mesmo pipeline multi-tenant.

Não criar um deploy completo do SaaS por cliente. Escalar horizontalmente workers e, quando WAHA for usado, escalar o serviço de sessões separadamente com afinidade/persistência próprias.

## Escala para 1.000 usuários simultâneos

- web stateless na Vercel;
- Supabase como banco único nesta fase (não duplicar dados em Neon);
- pool/conexões protegidos e workers horizontais;
- fila/backpressure entre webhook e IA;
- rate limit por tenant e por número;
- inferência com réplicas GPU atrás de balanceador;
- métricas de p50/p95/p99, fila, erros, tokens e custo por organização;
- Storage para mídia e documentos; não persistir arquivos no filesystem da Vercel;
- idempotência nos webhooks e envios.

## Variáveis centrais

```env
SAAS_AI_BASE_URL=https://ai.interno.exemplo
SAAS_AI_API_KEY=...
SAAS_AI_CHAT_MODEL=platform-chat
SAAS_AI_FAST_MODEL=platform-fast
SAAS_AI_EMBEDDING_MODEL=platform-embedding
SAAS_AI_TRANSCRIPTION_MODEL=platform-transcribe
```

`SAAS_AI_BASE_URL` é a origem sem `/v1`; o código adiciona a versão da API onde necessário.
