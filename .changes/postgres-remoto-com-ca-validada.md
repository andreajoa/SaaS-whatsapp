---
impacto: capacidade_nova
secao: adicionado
titulo: Conexão Postgres remota com autoridade certificadora configurável
---

O worker e as rotas que usam Postgres aceitam `SUPABASE_DB_CA_CERT` com o PEM
público do banco. Quando configurado, a conexão exige TLS e valida o servidor,
preservando a CA mesmo se `SUPABASE_DB_URL` também informar `sslmode`.
Sem a variável, a configuração existente continua valendo.
