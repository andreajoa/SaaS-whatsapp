---
impacto: nada_mudou
secao: adicionado
titulo: Painel do funil em /dashboard, atrás de uma senha própria
---

Numa VPS **nada muda**, e nada aparece. Sem `PAINEL_SENHA` no `.env` o painel
**não existe**: `/dashboard` responde 404, não uma tela de login. A diferença
importa — uma instalação padrão que respondesse "digite a senha" daria a todo
clone deste projeto uma porta exposta na internet, convidando a tentativa que de
outro modo ninguém faz. Quem não pediu o painel não ganha superfície.

O que entrou é o livro-razão de quem opera a instalação: quantas visitas, de
que país e cidade, por qual origem, e o que virou lead ou cliente. Ele lê as
tabelas da migration `0240`, que já eram `deny all` na RLS por serem do
operador e não de organização nenhuma.

**A medição é um beacon, não o render da página.** A página de vendas é
renderizada também para o Googlebot, para a prévia de link do WhatsApp e para
qualquer monitor de disponibilidade — contar isso encheria o painel de
movimento que nunca houve. E gravar no banco durante o render poria a latência
do Supabase na frente do primeiro byte da página que vende. O beacon também não
guarda IP nem e-mail: país, cidade e CEP vêm dos cabeçalhos da borda, e a
coluna é **CEP**, não "bairro" — a borda não entrega bairro, e um rótulo que
promete precisão que o dado não tem faz decidir sobre ruído.

**Por que o painel tem porta própria em vez de usar o login do produto.** Ele
atravessa o proxy sem sessão do Supabase, de propósito: o que se lê ali não
pertence a organização nenhuma, e pendurá-lo na sessão do produto entregaria a
lista de clientes a quem viesse a ser platform admin por engano. O preço disso
é que o proxy deixou de ser a proteção, e a proteção inteira é
`lib/painel/sessao.ts` — que falha fechada em três degraus e é medida nos dois
sentidos por `tests/unit/painel-porta.test.ts`.

A senha **é a chave do HMAC** do cookie, e não só o que se digita. Duas
consequências, as duas deliberadas: trocar a senha derruba na hora todas as
sessões abertas — o "sair de todos os dispositivos" sai de graça —, e o piso de
24 caracteres não é regra de formulário, é o que torna a assinatura inviável de
forjar offline por quem já tem um cookie válido. Senha curta não liga o painel.

A rota que emite o cookie está sozinha num arquivo que não renderiza nada e não
consulta o banco: ou a senha confere e sai o cookie, ou sai 401. Quem passa do
limite de dez tentativas por IP recebe o **mesmo** 401 de quem errou a senha,
sem `Retry-After` — dizer quanto falta transforma o limite num relógio a
esperar.
