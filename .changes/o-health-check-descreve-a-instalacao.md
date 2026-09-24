---
impacto: nada_mudou
secao: corrigido
titulo: O health check passa a descrever a instalação que o responde
---

**Numa VPS com WhatsApp pareado, nada muda — a sonda continua exatamente como era.**
Quem tem conexão viva pelo transporte que a própria máquina hospeda segue sendo
sondado a cada batida, e um transporte caído segue derrubando a rota para 503.

**O que mudou: a lista de checks agora vem do banco, não do `.env`.**
A variável de endereço do transporte é obrigatória no boot, então ela "sempre
existe" — inclusive onde não há serviço nenhum atrás dela. Uma instalação
serverless não tem esse contêiner; quem a opera preenche a variável só para o
Zod parar de reclamar, e a rota respondia `unhealthy` para sempre, com banco e
fila verdes. Agora quem responde "este transporte é usado aqui?" é
`channel_sessions`, que não tem como mentir: a linha só está lá se alguém pareou
um número por ele. Um 503 permanente é um alarme que ninguém mais ouve — no dia
em que o banco cair de verdade, a resposta seria igual à de ontem.

**A ausência de um check é dita em voz alta, e não deduzida.**
O corpo ganhou `transportes`, a lista dos canais com conexão viva. Vazia quer
dizer "esta instalação ainda não transporta nada", que é a frase que explica por
que não há sonda de transporte em `checks`.

**"Não consegui perguntar" não virou "não uso".**
Se o banco não responde, a sonda do transporte roda assim mesmo. Colapsar os
dois casos faria um check DESAPARECER do corpo justamente durante um incidente —
e check ausente lê como check verde, a conclusão oposta à disponível.

**A resposta fica 60 s em memória.** A rota é pública de propósito, para que um
monitor externo possa bater nela; sem memória, cada batida de qualquer um do
mundo viraria uma consulta ao banco com a chave de serviço.
