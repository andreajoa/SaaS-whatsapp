---
impacto: nada_mudou
secao: adicionado
titulo: `robots.txt` e `sitemap.xml`, pelo mesmo interruptor da página pública
---

Até agora o domínio não servia `robots.txt` nenhum — o pedido caía na página de
404. Sem esse arquivo o buscador só descobre que não deve indexar DEPOIS de
baixar a página, então ele rastreava `/app` inteiro para no fim jogar tudo fora.

Numa instalação self-host **nada muda no que é visível**, e o `robots.txt` que
passa a existir diz `Disallow: /`: sem cobrança ligada não há página pública
nenhuma (a raiz redireciona), e o CRM de um cliente não tem por que aparecer em
resultado de busca. O `sitemap.xml` vem vazio pelo mesmo motivo.

Onde a cobrança está ligada, o mapa é o par da página que apresenta o produto:
libera a raiz e as duas páginas legais, barra `/app`, `/api`, `/login` e
`/signup`. O layout raiz também passa a declarar `metadataBase` a partir de
`NEXT_PUBLIC_APP_URL` — sem ela o `canonical` da página pública saía relativo,
isto é, declarando a página canônica sem dizer de qual host, que é justamente a
pergunta em aberto num produto que roda no domínio de cada operador.
