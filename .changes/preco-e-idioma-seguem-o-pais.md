---
impacto: nada_mudou
secao: adicionado
titulo: A página de vendas fala o idioma e cobra na moeda do país de quem chega
---

Numa VPS **nada muda**, e é por construção: tudo isto vive atrás de
`instalacaoCobra()` — o mesmo interruptor da tela de cobrança, que lê
`STRIPE_SECRET_KEY`. Sem chave não há plano para vender, a raiz segue
redirecionando para `/app`, e o visitante anônimo que este código atende
simplesmente não existe na sua instalação.

O que foi acrescentado é para o deploy **hospedado**. Lá a primeira coisa que
alguém encontra é uma página pública, e ela precisava responder a duas
perguntas ao mesmo tempo: *em que idioma eu leio isto* e *em que moeda eu
pago*. São a MESMA decisão — separá-las produz a combinação absurda de uma
página em espanhol cobrando em real —, então quem responde às duas é um
arquivo só, `lib/mercado/paises.ts`, a partir do país que a borda informa.

O país vence o `Accept-Language` de propósito: o cabeçalho do navegador diz
que idioma a pessoa configurou uma vez; o país diz onde ela vai passar o
cartão.

Onze mercados, e o conjunto não foi escolhido no chute — são países onde o
WhatsApp é o canal dominante, com o preço calibrado contra o que se cobra por
ferramenta equivalente em cada um. A conta Stripe brasileira consegue cobrar
em todas as onze; isso foi **medido**, criando e cancelando uma cobrança real
em cada moeda, e não lido na documentação:

```bash
node scripts/stripe-moedas.mjs
```

O mercado é gravado na organização no momento da confirmação do e-mail — o
último instante em que o país ainda está à mão. Da próxima tela em diante quem
responde é o banco, e não o cabeçalho.
