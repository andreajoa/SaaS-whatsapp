---
impacto: nada_mudou
secao: corrigido
titulo: O health check passa a descrever a instalação que o responde
---

**Numa VPS com WhatsApp pareado, nada muda — a sonda continua exatamente como era.**
Quem tem conexão viva pelo transporte que a própria máquina hospeda segue sendo
sondado a cada batida, e um transporte caído segue derrubando a rota para 503.
É o caso que a rota existe para servir, e ele está coberto por teste próprio
justamente para que este conserto não vire "nunca mais sonde".

**O que mudou: a lista de checks agora vem do banco, não do `.env`.**
A variável de endereço do transporte é obrigatória no boot, então ela "sempre
existe" — inclusive onde não há serviço nenhum atrás dela. Uma instalação
serverless não tem esse contêiner; quem a opera preenche a variável só para o
Zod parar de reclamar, e a rota respondia `unhealthy` para sempre, com banco e
fila verdes. Agora quem responde "este transporte é usado aqui?" é
`channel_sessions`, que não tem como mentir: a linha só está lá se alguém pareou
um número por ele.

**Um health check que responde a mesma coisa todo dia não é ruim, é desligado.**
A primeira coisa que qualquer pessoa aprende diante de um 503 permanente é a
ignorá-lo — e no dia em que o banco cair de verdade, a resposta vai ser igual à
de ontem. O defeito não é o status errado; é o alarme que ninguém mais ouve.

**A ausência de um check é dita em voz alta, e não deduzida.**
O corpo ganhou `transportes`, a lista dos canais com conexão viva. Vazia quer
dizer "esta instalação ainda não transporta nada", que é a frase que explica por
que não há sonda de transporte em `checks`. Sem ela, a troca seria apagar uma
informação em vez de substituí-la.

**"Não consegui perguntar" não virou "não uso".**
Se o banco não responde, a sonda do transporte roda assim mesmo. Colapsar os
dois casos faria um check DESAPARECER do corpo justamente durante um incidente —
e check ausente lê como check verde, a conclusão oposta à disponível.

**A pergunta é por capacidade, não por nome.**
Quem sonda pergunta "esta instalação hospeda o próprio transporte?" e nunca
escreve qual serviço é — invariante 1 da restrição de canal. E a capacidade é o
critério certo por si só: o health check cobre o que esta máquina põe de pé.
Canal hospedado por terceiro, autenticado por credencial de cada organização,
não é fato desta instalação nem tem conserto por aqui.

**A memória de 60 s não é economia de consulta, é superfície.**
A rota é pública de propósito, para que um monitor externo possa bater nela.
Sem memória, cada batida de qualquer um do mundo viraria uma consulta ao banco
com a chave de serviço.
