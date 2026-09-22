---
impacto: nada_mudou
secao: adicionado
titulo: A sequência de propaganda do site, e a linha que a separa dos avisos de cobrança
---

**Quem roda numa VPS não vê nada disto.**
A sequência só tem a quem escrever onde a instalação VENDE assinatura — numa
VPS a tabela do funil público está vazia. O cron novo varre, encontra zero
linhas, não audita (rodada sem efeito não é mutação) e custa uma consulta por
hora. Sem `RESEND_API_KEY` ele nem chega à consulta.

**A linha entre propaganda e aviso tem consequência — por isso são duas funções.**
Uma escreve o par da RFC 8058 e o link de saída; a outra não escreve nenhum dos
dois. Dar `List-Unsubscribe` a "seu cartão foi recusado" é oferecer a alguém a
opção de não ser avisado de que vai perder o acesso — e como o Gmail conta o
descadastro como engajamento negativo, misturar os canais faz a propaganda
contaminar a reputação dos avisos que PRECISAM chegar.

**Nenhum e-mail daqui tem imagem, e isso é medido no HTML que sai.**
Gmail, Outlook e Apple Mail bloqueiam imagem remota de remetente desconhecido —
que é o que somos no primeiro e-mail — e `data:` não é saída porque os dois
primeiros o descartam por política. Toda cor de fundo vai no atributo `bgcolor`
E na propriedade CSS: o Outlook 2016–2021 renderiza por Word, que ignora
`background-color` em `<td>`. Só com o CSS, o layout fica certo no Gmail e
branco-em-branco no cliente que boa parte de quem paga usa no trabalho.

**O disparo é burro de propósito, e o índice único é o que o torna correto.**
Grava, DEPOIS manda, DEPOIS avança o cursor. Duas rodadas concorrentes colidem
no índice em vez de mandarem o mesmo e-mail duas vezes. Envio que falha não
avança o cursor: um `rate_limited` é passageiro, e apagar um passo da série por
causa dele seria perder a mensagem em silêncio.

**Dois dias fora do ar não viram seis e-mails na caixa de ninguém.**
No máximo um passo por pessoa por rodada, no máximo trinta pessoas, e vinte
horas entre dois e-mails para a mesma pessoa — vinte e não vinte e quatro
porque o relógio que bate a rota atrasa, e com vinte e quatro exatas o atraso se
acumularia até a série de quarenta e cinco dias virar uma de sessenta.
