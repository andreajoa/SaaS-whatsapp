---
impacto: nada_mudou
secao: adicionado
titulo: Captação de e-mail na página de vendas (rodapé e convite)
---

Numa VPS **nada muda** — sem `STRIPE_SECRET_KEY` a página de vendas redireciona para `/app` e `POST /api/v1/site/lead` responde 404.

Onde há assinatura, o rodapé e o convite da vitrine passam a captar leads em `site_leads` sem sobrescrever histórico anterior, sem enumeração de e-mails cadastrados e com limite de 5 inscrições por IP a cada 10 minutos.
