---
impacto: nada_mudou
secao: adicionado
titulo: A raiz do domínio passa a explicar o produto — só onde há cobrança
---

Numa instalação self-host **nada muda**: `/` continua redirecionando para
`/app`, e o middleware continua mandando quem não tem sessão para o login. O
interruptor é o MESMO da tela de cobrança (`instalacaoCobra()`, isto é,
`STRIPE_SECRET_KEY` preenchida) — de propósito, para que "esta instalação é o
SaaS hospedado" seja uma pergunta só, respondida num lugar só. Quem clonou este
repositório para vender o próprio serviço não ganha uma página de vendas nossa
na frente do sistema dele.

Onde a cobrança está ligada, a raiz passa a servir uma página que apresenta o
produto a quem ainda não tem conta: o que ele faz, em três passos, os recursos,
os planos lidos do MESMO catálogo que a tela de cobrança usa (plano sem
`price_...` configurado não é anunciado), as perguntas de sempre e o caminho
para o cadastro. Quem já está logado segue direto para `/app`, como antes.

Duas escolhas que valem para quem hospeda isto com a própria marca: o nome e o
logo saem da pilha de sempre (banco acima, `.env` embaixo) — a página é do
operador, não nossa —, e o idioma vem do `Accept-Language` do navegador, porque
aqui ainda não existe perfil de onde tirá-lo. Português e espanhol, como o resto
do produto.
