---
impacto: capacidade_nova
secao: adicionado
titulo: Interface e onboarding em inglês, cobrança multi-moeda no Stripe, gate de assinatura no runtime de IA e metadados públicos em runtime
---

**A interface autenticada e o onboarding agora servem inglês (`en`) ao lado de português (`pt-BR`) e espanhol (`es`).**
O seletor do topo, o perfil e o idioma da organização oferecem as três línguas com cobertura verificada em toda a árvore de telas.

**Checkout multi-moeda no Stripe (`STRIPE_PRICE_<PLANO>_<MOEDA>`) e gate de assinatura no runtime de IA.**
Numa VPS self-host (`STRIPE_SECRET_KEY` vazia) nada muda; no SaaS hospedado, contas sem assinatura ativa deixam de consumir turnos de IA em segundo plano, `robots.txt`/`sitemap.xml`/`manifest.webmanifest`/`llms.txt` respondem em runtime e a sessão usa `SameSite=Lax` com `CSP` e `HSTS`.
