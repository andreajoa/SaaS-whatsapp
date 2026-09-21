---
impacto: nada_mudou
secao: adicionado
titulo: Saída da lista em um clique, pelo cabeçalho que o Gmail lê
---

Numa VPS **nada muda**. A porta de saída pertence à lista de e-mails de
marketing, que só existe onde a instalação vende assinatura — sem
`STRIPE_SECRET_KEY` ninguém é inscrito, então não há de onde sair.

O que entrou foi o par da RFC 8058 (`List-Unsubscribe` e
`List-Unsubscribe-Post`), a rota que o Gmail chama sozinho quando a pessoa
aperta o botão nativo do cliente de e-mail, e uma página sem JavaScript para
quem prefere clicar no link do rodapé.

**A baixa NUNCA acontece em `GET`, e isso é medido no AST.** Um
`/descadastrar/<token>` que grave no próprio `GET` esvazia a lista sozinho —
não por ataque: o antivírus do provedor, a pré-visualização de link e o robô
de segurança corporativo seguem TODO `GET` que encontram dentro de um e-mail,
antes de a pessoa abrir a mensagem. O log diria que cada um deles pediu para
sair, e a lista simplesmente encolheria. É um defeito que não aparece em teste
manual (quem testa clica uma vez, e funciona) nem em revisão de código (um
`GET` que grava parece normal), então
`tests/unit/descadastro-nunca-em-get.test.ts` lê as exportações do módulo da
rota e reprova a mera DECLARAÇÃO de um `GET`.

**O defeito simétrico custa igual:** dizer "pronto, você saiu" quando a escrita
falhou. A pessoa fecha a aba confiante, recebe o próximo e-mail na semana
seguinte e, dessa vez, não procura o link — clica em spam. Falha de escrita e
falha de leitura resolvem para "não deu para concluir agora", com um botão de
tentar de novo, nunca para "pronto" nem para "link inválido".

A operação é idempotente porque o Gmail reenvia o one-click: quem já está fora
recebe a mesma confirmação sem um segundo `UPDATE`. `status` e
`descadastrado_em` são gravados juntos — um sem o outro deixa a pessoa
invisível para uma consulta e visível para a outra, e a que a enxerga é a que
manda e-mail.

Token malformado nem chega ao banco: varredura e link truncado por cliente de
e-mail não são superfície de consulta. A rota e a página entram em
`PUBLIC_PATHS` ancoradas, porque quem clica para sair de uma lista nunca teve
sessão — exigir login para SAIR é exatamente o que faz a pessoa marcar como
spam em vez de se descadastrar.
