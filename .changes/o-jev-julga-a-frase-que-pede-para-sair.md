---
impacto: nada_mudou
secao: adicionado
titulo: Pedido para sair escrito com outras palavras também é atendido
---

**A regra de palavra-chave continua na frente, e decide sozinha quando casa.**
"SAIR", "PARAR" e "parar de me mandar" bloqueiam como sempre, sem chamada
nenhuma. O que muda é a frase que pede para sair sem usar nenhum dos padrões
escritos — antes ela passava, e a pessoa seguia recebendo.

**Essa frase agora é julgada pela intenção.** O Jev (TypeSafe System One)
devolve a probabilidade de ser um pedido de descadastro; a partir de 0,70 o
contato é bloqueado com o motivo `stop_intencao`, e a linha de auditoria guarda
a probabilidade (nunca o texto). O limiar foi medido: separa "para de me mandar
essas mensagens" (0,88) de "tem como parar a dor?" (0,03).

**Numa VPS sem chave, nada muda.** O Jev só roda com `TYPESAFE_API_KEY` ou
`OPENROUTER_API_KEY` preenchida. Sem nenhuma, ou com o serviço fora do ar, vale
só a regra de palavra-chave — uma falha do Jev nunca bloqueia ninguém. Só a
mensagem com cara de pedido para parar chega a ele: "bom dia" e "manda o preço"
não geram chamada.
