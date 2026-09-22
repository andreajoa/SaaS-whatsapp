---
impacto: nada_mudou
secao: corrigido
titulo: A organização criada pelo cadastro do site nasce no provedor de IA que a instalação escolheu
---

**Numa VPS instalada pelo kit, nada muda.** Lá a organização nasce pelo
instalador, que já aplicava o `AI_PROVIDER` escolhido. Este conserto é do outro
caminho de nascimento: o cadastro self-service do site.

**O que estava quebrado.** Toda organização nova recebe do banco
`settings.llm.provider = 'anthropic'`. O instalador corrigia isso depois; o
cadastro do site não corrigia. Numa instalação que só tem a chave da OpenRouter,
quem se cadastrava, pagava e conectava o WhatsApp ficava com o agente mudo — o
primeiro turno morria pedindo a chave de um provedor que ninguém escolheu.

**Agora o cadastro lê `AI_PROVIDER` e `AI_DEFAULT_MODEL`, os dois juntos.** O
modelo é obrigatório porque é por ele que o banco decide: sem modelo, o provedor
volta a ser `anthropic` no insert. Sem as duas variáveis, a organização nasce
como sempre nasceu.
