---
impacto: nada_mudou
secao: adicionado
titulo: Seis documentos legais e uma página de contato, em três idiomas
---

Numa VPS **nada muda**. A página de contato só mostra formulário quando
`SUPPORT_EMAIL` está preenchido — vazio, ela diz que a instalação não tem
endereço de suporte e manda procurar quem administra. Um campo que aceita a
mensagem e não tem para onde mandá-la é pior que a ausência dele: quem escreveu
vai embora achando que foi atendido.

O que entrou foram seis documentos que faltavam — cookies, reembolso, uso
aceitável, subprocessadores, segurança e acordo de tratamento de dados — mais o
índice em `/legal` e a página `/contato`.

Os documentos são **dado**, não `.tsx`. As duas páginas que já existiam
(`terms`, `privacy`) põem cada parágrafo dentro de `t()`, e isso funciona para
dois documentos em dois idiomas. Seis em TRÊS custariam algumas centenas de
entradas novas no dicionário do produto — que só conhece espanhol, de modo que
o inglês **degradaria para português no meio de um contrato**. Em
`lib/legal/documentos.ts` os três idiomas ficam na mesma linha, e divergir exige
apagar um campo obrigatório.

Nenhum documento nomeia pessoa, marca ou domínio: eles falam de `{sistema}` e
`{operador}`, resolvidos em tempo de renderização. É a mesma doutrina de
`lib/legal/operador.ts` — um contrato que nomeasse o software inverteria os
papéis de controlador e operador.

A página de segurança diz explicitamente o que **não** existe: nenhuma
certificação SOC 2 ou ISO 27001, nenhum teste de invasão independente. Afirmar
o contrário seria mais fácil e é o único parágrafo aqui capaz de virar processo.

A rota do formulário não tem sessão por definição — quem escreve ainda não é
cliente. No lugar dela: Zod com teto de tamanho, limite de 5 mensagens por IP a
cada 10 minutos, campo-armadilha que responde `200` ao robô, e o endereço do
visitante em `replyTo` e **nunca** em `from` (o contrário faria o domínio se
passar por terceiro e cair no spam do próprio destinatário).

Documento novo nascendo atrás do login é o modo de falha que
`tests/unit/legal-documentos.test.ts` existe para impedir: quem escreveu tem
sessão e abre normalmente, e só o visitante anônimo — a única pessoa para quem
o documento foi escrito — leva o 307 para o login.
