---
impacto: capacidade_nova
secao: adicionado
titulo: Interface e onboarding em inglês, cobrança multi-moeda no Stripe, gate de assinatura no runtime de IA e metadados públicos em runtime
---

**A interface autenticada e o onboarding agora servem inglês (`en`) ao lado de português (`pt-BR`) e espanhol (`es`).**
O seletor do topo, as preferências de perfil e o idioma da organização oferecem as três línguas com cobertura verificada em toda a árvore de componentes, e o cadastro inicial herda o idioma e o mercado de origem do visitante.

**O checkout do Stripe resolve preços por moeda (`STRIPE_PRICE_<PLANO>_<MOEDA>`) com fallback seguro para BRL.**
Quando os preços da moeda da organização estão configurados, o cartão na tela e o checkout embutido cobram nessa moeda; sem eles, a tela exibe e cobra em BRL sem divergência entre o valor mostrado e o cobrado.

**O runtime de IA (`inbound_turn`, `followup_turn`, dispatcher e MCP) confere o acesso da organização quando a instalação cobra assinatura.**
Numa instalação self-host (`STRIPE_SECRET_KEY` vazia) nada muda e nenhuma consulta extra é feita; no SaaS hospedado, organizações sem assinatura ativa deixam de consumir turnos de IA em segundo plano.

**`robots.txt`, `sitemap.xml`, `manifest.webmanifest` e `llms.txt` são resolvidos em runtime (`force-dynamic`)**, com cabeçalhos `Content-Security-Policy` e `Strict-Transport-Security` habilitados e cookies de sessão em `SameSite=Lax` para preservar o login no retorno de portais externos de pagamento.
