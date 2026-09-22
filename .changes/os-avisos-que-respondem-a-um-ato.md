---
impacto: nada_mudou
secao: adicionado
titulo: Os cinco avisos agora têm quem os dispare, e o botão de "ver os planos" leva aos planos
---

**Numa VPS nada disto acontece, e o motivo é o mesmo da sequência.**
Os cinco avisos só disparam onde a instalação VENDE assinatura: dois pendem
do webhook do Stripe, um do formulário do site, e dois de um cron que varre
`checkout_tentativas` e `site_visits` — tabelas que numa VPS nascem e morrem
vazias. O cron novo custa duas consultas por hora, encontra zero linhas e não
audita, porque rodada sem efeito não é mutação.

**O que entrou:** a rota `api/v1/cron/checkout-abandonado`, o despachante
compartilhado `lib/marketing/disparo.ts`, a escrituração do funil em
`lib/marketing/funil.ts`, e os três pontos de chamada — cadastro no site,
`checkout.session.completed` e `invoice.payment_failed`.

**O índice único que protege a série é uma mordaça nos avisos que repetem.**
`unique (lead_id, mensagem)` quer dizer "uma vez na vida", que é exatamente o
certo para os quinze e-mails de propaganda e exatamente o errado para "seu
cartão foi recusado": o cartão de alguém falha em julho, o aviso sai, o
cartão falha de novo em outubro e o aviso não sai — a pessoa perde o acesso
sem nunca ter sido avisada da segunda vez. A saída foi dar escopo à chave:
`mensagem` passa a poder ser `pagamento-falhou#in_1PabcXYZ`, e o índice vira
"uma vez por fatura". A mesma peça, com a chave da sessão, faz o lembrete de
checkout ser por sessão largada, não por pessoa.

**A escolha da chave é a decisão inteira, e ela muda por aviso.** O aviso de
assinatura ativa pende de `checkout.session.completed` com a chave da
ASSINATURA, e não de `invoice.paid`, que dispara em toda renovação e mandaria
"sua assinatura está ativa" todo mês para sempre. O de cartão recusado pende
da FATURA, porque o Stripe retenta o mesmo cartão umas quatro vezes ao longo
de duas semanas e emite o evento em cada uma. O de carrinho largado não tem
chave nenhuma: olhar o preço de novo semana que vem não é um fato novo, é a
mesma hesitação.

**As vinte horas entre dois e-mails são por PESSOA, não por remetente.** Quem
se cadastra recebe as boas-vindas na hora, e o cron da sequência rodaria o
primeiro passo da propaganda dentro da hora seguinte — dois e-mails nossos em
sessenta minutos, para alguém que acabou de nos conhecer. O despachante grava
`site_leads.ultimo_envio_em` quando o envio dá certo, então o cron se espaça
de correspondência que ele mesmo não mandou.

**Quem largou o checkout recebe SÓ um dos dois.** Ele passou pela tabela de
preço antes, necessariamente, então sem a exclusão receberia "você olhou os
planos e não seguiu" um dia depois de "você abriu o pagamento e não
terminou" — a mesma pessoa, dois relatos do mesmo fato, o segundo menos
informado que o primeiro.

**O carimbo de "já tratei" vai mesmo quando o e-mail não sai.**
Se ele só fosse gravado no sucesso, a tentativa de alguém
descadastrado seria reexaminada de hora em hora para sempre, ocupando o teto
da rodada e empurrando quem nunca foi avisado para o fim da fila.

**Correção que veio junto: doze botões apontavam para uma âncora inexistente.**
Os CTAs dos e-mails, nos três idiomas, levavam a `/#precos` enquanto a seção
da tabela de preço se chama `planos` — quem clicasse em "Ver os planos"
chegava ao topo da página, sem erro nenhum na tela e sem nada no log. Agora a
âncora e os links saem da mesma constante, e um teste lê `app/page.tsx` para
provar que todo fragmento de CTA resolve numa seção que existe.

**O marco de "viu o preço" é medido, não deduzido.** Fragmento de URL não
chega ao servidor, então `site_visits` não sabia distinguir quem rolou até a
tabela de preço de quem só abriu a página. Sem isso, "você olhou os planos"
teria de ser mandado a todo mundo que visitou o site — propaganda apoiada num
palpite. Um observador de interseção na própria seção grava o marco quando
ela entra na tela de verdade.
