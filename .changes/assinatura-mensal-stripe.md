---
impacto: nada_mudou
secao: adicionado
titulo: Assinatura mensal opcional, com checkout embutido na própria tela
---

Quem instala numa VPS não perde nem ganha nada com esta versão, e isso é a
parte que importa: a cobrança só existe quando `STRIPE_SECRET_KEY` está
preenchida. Com ela vazia — o estado de toda instalação self-host — não há
gate de acesso, não há tela de plano, não há consulta extra a cada
navegação, e `/api/v1/billing/*` responde 404. A doutrina deste produto
monetiza por self-host, não por mensalidade, e ligar cobrança em cima de um
clone que já rodava seria o pior modo de falha possível: o gate mora no
layout de `/app`, que roda em toda tela.

Para quem opera este CRM como SaaS e cobra dos próprios clientes, o que
entrou foi: catálogo de três planos, período de avaliação derivado da data de
criação da organização (sem linha semeada no cadastro — o cadastro não sabe
nada de dinheiro), checkout do Stripe montado DENTRO da tela de cobrança em
vez de mandar o cliente para outro domínio no meio da compra, portal de
gerenciamento para trocar de plano e cancelar, e um webhook que é a única
fonte da verdade sobre quem pagou.

Duas variáveis novas no `.env.example` além das chaves: nenhuma obrigatória,
e todas em branco por padrão.
