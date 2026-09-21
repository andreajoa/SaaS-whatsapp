---
impacto: nada_mudou
secao: adicionado
titulo: Captação de e-mail na página de vendas (rodapé e convite)
---

Numa VPS **nada muda**, e nada aparece. Os dois lugares que pedem o e-mail só
existem onde a instalação de fato vende assinatura: sem `STRIPE_SECRET_KEY` a
página de vendas nem é renderizada (a raiz redireciona para `/app`), e
`POST /api/v1/site/lead` responde 404 mesmo que alguém a chame direto. Quem
instala este projeto para atender no próprio WhatsApp não ganha um formulário
de mala direta no rodapé.

O que entrou são duas portas para a mesma pergunta — um bloco no rodapé e um
convite que aparece uma vez — e uma função, `registrarLead`, que é a única a
escrever em `site_leads`.

**Por que `registrarLead` não é um `upsert`.** A tabela tem
`unique (lower(email))`, então a linha óbvia seria um `upsert` e pronto. Ela
quebra três coisas, e as três só dariam sinal semanas depois:

- **reiniciaria a sequência** — `proximo_passo` é o cursor dos e-mails, e
  gravá-lo de volta em zero faz quem já recebeu tudo receber tudo de novo, por
  ter digitado o próprio endereço duas vezes. É o caminho mais curto para virar
  spam aos olhos do Gmail;
- **ressuscitaria quem saiu** — descadastro é ato legal, e um formulário em que
  qualquer pessoa digita qualquer endereço não pode desfazê-lo: bastaria um
  estranho digitar o e-mail de quem pediu para parar;
- **apagaria o que já se sabe** — quem chegou pelo checkout tem nome; quem
  volta pelo rodapé manda só o e-mail, e o `upsert` gravaria `nome: null` por
  cima do nome.

O que vale é enriquecimento: dado novo preenche lacuna, nunca escreve por cima.
As colunas que contam a história da pessoa — `status`, `proximo_passo`,
`descadastrado_em`, `origem`, `token_descadastro` — ficam fora do alcance do
formulário, e `tests/unit/lead-do-site-nao-reescreve-historia.test.ts` mede
isso pelo que a função NÃO escreveu.

**A resposta é a mesma para novo, conhecido e descadastrado.** Um formulário
aberto que diga "este e-mail já está na lista" é um oráculo de enumeração: com
ele se descobre, um endereço por vez, quem está aqui dentro. Só `sem_banco`
vira erro visível — dizer "pronto" a quem não foi inscrito o manda embora
esperando um e-mail que nunca chega.

O teto é de **5 inscrições por IP a cada 10 minutos**, bem mais apertado que o
beacon de visita. Não é o banco que se protege: cada linha criada aqui vira
destinatário de uma sequência, e reputação de domínio queimada não volta com um
deploy.

**O convite não aparece na chegada.** Ele espera metade da página rolada ou a
intenção de sair — os dois significam interesse. Quem se inscreveu nunca mais o
vê; quem fechou fica 30 dias sem vê-lo, porque fechar é uma resposta. Com o
`localStorage` bloqueado (navegação privada), a falha de leitura resolve para
não repetir dentro da sessão em vez de silenciar o convite para sempre.
