---
impacto: nada_mudou
secao: alterado
titulo: Na instalação que cobra assinatura, o teste volta a ser sem cartão e começa na primeira resposta da IA
---

**Só vale para quem cobra assinatura pela Stripe (`STRIPE_SECRET_KEY` preenchida).**
Numa VPS self-host, que não cobra, nada muda: `instalacaoCobra()` continua
desligando o gate inteiro.

**Antes, a conta sem assinatura ia para a tela de cobrança logo depois do onboarding**
e o teste de 7 dias só existia depois de cadastrar o cartão. Na operação
hospedada isso somou-se a outras duas exigências do primeiro dia (credenciais
da Meta e chave de IA) e nenhuma conta chegou a assinar.

**Agora a conta nova usa tudo sem cartão enquanto a IA não respondeu ninguém,**
e os 7 dias de teste só começam a contar na primeira mensagem que a IA envia a
um cliente (`messages` outbound com `sent_via = 'ai'`), sem migração nova. No
fim do teste a tela de cobrança aparece com o plano a um clique; quem assina no
meio do teste fica só com os dias que faltam, e quem chega depois do fim é
cobrado na hora. Quem nunca põe a IA para responder recebe a tela de cobrança
depois de 14 dias de conta — não existe teste eterno.
