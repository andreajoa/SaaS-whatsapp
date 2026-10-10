---
impacto: nada_mudou
secao: corrigido
titulo: A retenção chama o expurgo de nonces com os argumentos do banco
---

O varredor de retenção usa `p_dias` e `p_lote` ao expurgar nonces de OAuth,
como exige a função existente no banco. A incompatibilidade de argumentos
deixava a rodada com erro de schema cache antes da varredura de anonimização.
As outras três podas, os pisos de retenção e os limites de lotes continuam
com os mesmos contratos.
