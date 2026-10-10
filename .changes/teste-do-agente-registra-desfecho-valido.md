---
impacto: nada_mudou
secao: corrigido
titulo: O teste do agente registra conclusão e falha no histórico
---

O teste do agente encerra seu registro com estados aceitos pelo banco:
concluído quando há resposta candidata, ou falha quando o preview está
bloqueado ou não pode executar. Erros ao salvar o resultado são informados,
evitando que a tela anuncie sucesso enquanto o histórico fica em execução.
