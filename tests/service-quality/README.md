# Testes dedicados de SLA/CSAT

Para validar o Atenza online sem Docker, use um Supabase de teste vazio e
execute `node scripts/test-db-online.mjs` com `TEST_DATABASE_URL` provisionada
fora do código. O runner verifica o ambiente, instala/reaplica o baseline e
executa esta suíte junto com comércio, ações e campanhas. Nesse modo a suíte
usa diretamente o banco preparado, com dois clientes para a disputa do token,
e mantém as fixtures no projeto descartável; não cria nem remove databases.

O teste de banco cria um clone aleatório `service_quality_<sufixo>` do template
descartável já instalado apenas no harness legado. Usa as colunas canônicas de `organizations`, não
reaplica migrations e não altera `postgres` ou o template. Na limpeza, cancela
apenas consultas ativas do clone, fecha o pool e remove esse clone.

```sh
set -a
source /tmp/atenza-local-db.env
set +a
./node_modules/.bin/vitest run --config tests/service-quality/vitest.db.config.ts --maxWorkers=1 --reporter=verbose
```

Os nove casos exercitam RLS entre dois tenants, RBAC de viewer, confidencialidade
do hash, vínculo cross-tenant inclusive com `service_role`, primeira resposta
efetivamente enviada, histórico com mais de mil mensagens, reabertura,
privilégios de RPC, consumo concorrente e único do token, auditoria sem comentário,
expiração, validação da nota e resumo por conversa. Sem ambiente, a suíte falha;
não há `skip` para esconder ausência de banco ou erro na preparação.

O caso de volume mantém todos os triggers habilitados e usa mensagens na fila,
que não devem contar como resposta efetiva. Tem limite específico de 120s para
preparação e verificações. As consultas do clone têm `statement_timeout` de 90s;
os demais casos mantêm o limite de 30s do runner.

Os testes de métricas, rotas e componentes podem rodar sem o setup global que
carrega `.env` reais. A configuração abaixo usa somente placeholders e mocks:

```sh
./node_modules/.bin/vitest run --config tests/service-quality/vitest.unit.config.ts --maxWorkers=1
```

A jornada `service-quality.spec.ts` é Playwright, com configuração própria:

```sh
./node_modules/.bin/playwright test --config tests/service-quality/playwright.config.ts
```

Essa jornada requer a aplicação e o Supabase de teste do harness central, além
das credenciais sintéticas `.e2e-creds.json`. O Postgres descartável sozinho não
fornece esse ambiente. A spec está excluída do Vitest unitário genérico.
