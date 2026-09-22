---
impacto: capacidade_nova
secao: corrigido
titulo: A base de conhecimento indexa pela OpenRouter quando é a única chave da instalação
---

**Quem instalou só com a chave da OpenRouter via a base de conhecimento na
tela, cadastrava o material e ele nunca era indexado.** A escada de chaves do
embedding conhecia o painel de Provedores, a credencial OpenAI da organização,
o gateway da Vercel e a `OPENAI_API_KEY` — e parava aí. Sem nenhuma delas, o
agente atendia sem saber nada do que a empresa cadastrou.

**A `OPENROUTER_API_KEY` entrou como degrau, depois do gateway e antes da
`OPENAI_API_KEY`.** O modelo é o mesmo (`text-embedding-3-small`, 1536
dimensões), então o material já indexado por outra chave continua no mesmo
mapa: nada precisa ser reindexado. A tela de conhecimento passa a dizer "Usando
a chave da OpenRouter configurada nesta instalação" quando for ela.

**Numa VPS com as duas chaves preenchidas, a OpenRouter passa a pagar a
indexação**, porque vem antes da `OPENAI_API_KEY` na escada. Quem prefere que a
OpenAI pague escolhe essa chave no painel de Provedores, que vence todos os
degraus. Com só a `OPENAI_API_KEY`, nada muda.
