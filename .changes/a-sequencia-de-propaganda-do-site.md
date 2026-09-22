---
impacto: nada_mudou
secao: adicionado
titulo: A sequência de propaganda do site, e a linha que a separa dos avisos de cobrança
---

**Quem roda numa VPS não vê nada disto, e isso não é acaso.**
A sequência só tem a quem escrever onde a instalação VENDE assinatura — e
numa VPS `site_leads` está vazia, porque o funil público nasce com o
formulário do site hospedado. O cron novo varre, encontra zero linhas, não
audita (rodada sem efeito não é mutação, como nos outros vinte e dois) e custa
uma consulta por hora. Sem `RESEND_API_KEY` ele nem chega à consulta.

**O que entrou:** quinze e-mails de propaganda em português, inglês e
espanhol, cinco avisos que respondem a um ato da pessoa (entrou na lista,
largou o carrinho, largou o checkout, pagou, teve o cartão recusado), o casco
que os desenha e a rota `api/v1/cron/marketing-sequencia` que os despacha.

**A linha entre os dois grupos tem consequência — por isso são duas funções.**
`montarEmail()` escreve o par da RFC 8058 e o link de saída;
`montarEmailTransacional()` não escreve nenhum dos dois. Dar
`List-Unsubscribe` a "seu cartão foi recusado" é oferecer a alguém a opção de
não ser avisado de que vai perder o acesso — e o Gmail conta o descadastro
como engajamento negativo, então misturar os canais faz a lista de propaganda
contaminar a reputação dos avisos que PRECISAM chegar. Um parâmetro opcional
seria esquecido nos dois sentidos; duas funções, não.

**Nenhum e-mail daqui tem imagem, e isso é medido no HTML que sai.** Gmail,
Outlook e Apple Mail bloqueiam imagem remota de remetente desconhecido — que
é o que somos no primeiro e-mail —, e `data:` não é a saída porque os dois
primeiros o descartam por política. Toda cor de fundo vai no atributo
`bgcolor` E na propriedade CSS: o Outlook 2016–2021 renderiza por Word, que
ignora `background-color` em `<td>` numa boa parte dos casos. Quem escrevesse
só o CSS veria o layout certo no Gmail e um e-mail branco-em-branco no
cliente que boa parte de quem paga usa no trabalho.

**O disparo é burro de propósito, e o índice único é o que o torna correto.**
A ordem é: grava em `email_envios`, DEPOIS manda, DEPOIS avança o cursor.
Duas rodadas concorrentes — ou uma que expirou depois de o Resend aceitar e
antes de gravar — colidem no `unique (lead_id, mensagem)` em vez de mandarem
o mesmo e-mail duas vezes. Envio que falha fica em `falhou` e não avança o
cursor: a rodada seguinte reconhece a linha pelo status e tenta a mesma
mensagem outra vez, porque um `rate_limited` é passageiro e apagar um passo
da série por causa dele seria perder a mensagem em silêncio.

**E o cursor é um palpite, não a verdade.** `site_leads.proximo_passo` é um
inteiro porque é barato de filtrar em SQL, mas quem decide o que já saiu é
`email_envios.mensagem`, que guarda o id estável (`"o-silencio-custa"`).
Inserir uma mensagem no meio da série desloca todos os índices; o id não
desloca. Quando as duas leituras discordam, o índice único ganha e o cursor é
corrigido sem mandar nada.

**Dois dias fora do ar não viram seis e-mails na caixa de ninguém.** No
máximo um passo por pessoa por rodada, no máximo trinta pessoas, e vinte
horas entre dois e-mails para a mesma pessoa — vinte e não vinte e quatro
porque o relógio que bate a rota atrasa, e com vinte e quatro exatas o atraso
se acumularia até a sequência de quarenta e cinco dias virar uma de sessenta.
