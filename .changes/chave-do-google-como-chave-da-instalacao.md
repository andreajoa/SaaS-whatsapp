---
impacto: capacidade_nova
secao: adicionado
titulo: A chave do Google (Gemini) passa a valer como chave da instalação
---

**Quem não preenche a variável nova, nada muda.** Anthropic, OpenAI e
OpenRouter continuam resolvendo como antes.

**Antes, o Google só funcionava com chave cadastrada na tela.** Um agente em
`google` sem credencial da organização morria em `LlmNotConfiguredError`, mesmo
com o provedor no catálogo e no registro de modelos do worker.

**Agora `GOOGLE_GENERATIVE_AI_API_KEY` é a quarta chave de plataforma**, lida
pelo app (`chaveDePlataforma`), pelo worker (`lib/agent-engine/env.ts` e
`resolveOrgLlmConfig`) e pela descrição da instalação. Com `AI_PROVIDER=google`
e `AI_DEFAULT_MODEL` apontando para um modelo Gemini, a conta criada pelo
cadastro do site já responde no teste sem cartão sem cadastrar chave nenhuma.

**Atenção à LGPD:** no plano gratuito do Google AI Studio o Google pode usar o
conteúdo enviado para melhorar os produtos dele. Serve para o período de teste;
com cliente pagante, ative o faturamento da chave.
