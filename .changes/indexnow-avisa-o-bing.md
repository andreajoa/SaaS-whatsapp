---
impacto: nada_mudou
secao: adicionado
titulo: O site publica a chave do IndexNow e um script avisa o Bing das páginas do sitemap
---

**Nada muda para quem usa o produto.** É divulgação do site público.

O Google já recebe o sitemap pelo Search Console. O Bing, que também abastece a
busca do ChatGPT e do Copilot, aceita o protocolo IndexNow. O site agora publica
a chave em `public/<chave>.txt`, e `npx tsx scripts/indexnow.ts` envia todas as
URLs do sitemap depois de um deploy que mude páginas públicas. O script confere
antes que a chave está no ar e falha alto se não estiver.
