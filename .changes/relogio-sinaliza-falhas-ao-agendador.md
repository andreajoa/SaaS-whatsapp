---
impacto: nada_mudou
secao: corrigido
titulo: O relógio avisa o agendador quando uma tarefa falha
---

O tick devolve HTTP 500 quando alguma tarefa executada falha, permitindo que
o agendador externo sinalize o problema. O erro identifica somente tarefas e
status, preservando detalhes internos. Tarefas adiadas pelo orçamento de tempo
continuam sendo tratadas como adiamento normal; efeitos e auditoria da rodada
são preservados.
