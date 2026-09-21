---
impacto: nada_mudou
secao: corrigido
titulo: O relógio HTTP passa a cobrir as 22 rotas de cron, não quatro
---

Quem instala numa VPS não muda de comportamento nesta versão, e é bom que não
mude: no self-host quem dispara os crons é o contêiner `deskcomm-scheduler`,
com `crond` de verdade, e ele já chamava as 22 rotas. A tabela nova
(`relogio_execucoes`) nasce em todo clone para que as migrations sejam as
mesmas em todo lugar, e num self-host ela fica **vazia** — tabela vazia não
faz nada.

O que estava quebrado era o deploy **hospedado**. Ali não existe esse
contêiner, e o plano Hobby da Vercel só aceita cron diário — declarar cron
sub-diário no `vercel.json` fora do Pro não degrada, **reprova o deploy
inteiro**. A saída era o relógio HTTP (`/api/v1/system/relogio/tick`), batido
de fora por GitHub Actions ou cron-job.org. Só que ele cobria **quatro**
tarefas: dreno de eventos, follow-up, roteamento e envio travado. As outras
dezoito rotas — `agent-dispatcher` inclusive, que é *a IA responder* — não
tinham quem as chamasse.

E o modo de falha era o pior que existe: não dava erro. As rotas respondiam
200 para quem as chamasse à mão, o build passava, os testes passavam — e a
feature simplesmente não acontecia sozinha. "A IA não respondeu ainda" é
indistinguível de "a IA nunca vai responder".

O tick agora conhece a agenda inteira (`lib/relogio/agenda.ts`, espelho do
crontab do self-host com paridade cobrada no CI nas duas direções) e despacha
o que estiver **vencido**. Vencido não é "o minuto casou com a cadência" — quem
bate o relógio de graça atrasa 5 a 15 minutos, e essa régua perderia quase
tudo. É **"rodou depois da última hora em que deveria ter rodado?"**, lida de
`relogio_execucoes`. Com isso o atraso do agendador fica inofensivo, cada
tarefa se recupera sozinha uma única vez depois de uma queda, e bater de
minuto em minuto não faz a varredura de 5 minutos rodar cinco vezes mais.

Para conferir o que está parado, e por quanto tempo:

```sql
select tarefa, ultima_execucao, ultimo_status, falhas_seguidas
  from public.relogio_execucoes order by ultima_execucao asc;
```

Nenhuma variável nova. O despacho usa `NEXT_PUBLIC_APP_URL` e
`INTERNAL_CRON_SECRET`/`INTERNAL_SECRET`, que já existem — e, faltando algum,
o tick responde dizendo isso em vez de ficar calado.
