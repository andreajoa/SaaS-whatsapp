---
impacto: nada_mudou
secao: adicionado
titulo: Os cinco avisos agora têm quem os dispare, e o botão de "ver os planos" leva aos planos
---

**Numa VPS nada disto acontece.**
Os cinco avisos só disparam onde a instalação VENDE assinatura: dois pendem do
webhook do Stripe, um do formulário do site, e dois de um cron que varre tabelas
que numa VPS nascem e morrem vazias. O cron custa duas consultas por hora,
encontra zero linhas e não audita, porque rodada sem efeito não é mutação.

**O índice que protege a série de propaganda é uma mordaça nos avisos que repetem.**
`unique (lead_id, mensagem)` quer dizer "uma vez na vida" — certo para os quinze
e-mails de propaganda, errado para "seu cartão foi recusado": o cartão falha em
julho, o aviso sai, falha de novo em outubro e o aviso não sai. A saída foi dar
escopo à chave (`pagamento-falhou#<fatura>`), e o índice vira "uma vez por
fatura". A escolha da chave muda por aviso: a de assinatura ativa é a ASSINATURA
(a fatura dispararia em toda renovação), a de cartão recusado é a FATURA, e a de
carrinho largado não tem chave — olhar o preço de novo não é um fato novo.

**As vinte horas entre dois e-mails são por PESSOA, não por remetente.**
Sem isso, quem se cadastra receberia as boas-vindas e o primeiro passo da
propaganda dentro da mesma hora. E quem largou o checkout recebe só UM dos dois
lembretes: ele passou pela tabela de preço antes, necessariamente.

**O carimbo de "já tratei" vai mesmo quando o e-mail não sai.**
Gravado só no sucesso, a tentativa de alguém descadastrado seria reexaminada de
hora em hora para sempre, empurrando quem nunca foi avisado para o fim da fila.

**Correção que veio junto: doze botões apontavam para uma âncora inexistente.**
Os CTAs dos e-mails, nos três idiomas, levavam a `/#precos` enquanto a seção da
tabela de preço se chama `planos` — sem erro na tela e sem nada no log. Agora a
âncora e os links saem da mesma constante, com teste que o prova.
