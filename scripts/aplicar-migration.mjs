#!/usr/bin/env node
/**
 * Aplica UMA migration no banco de `SUPABASE_DB_URL` e confere o resultado.
 *
 * ─── Por que isto existe, se já há `supabase db push` ──────────────────────
 *
 * O `db push` exige a CLI logada e o projeto vinculado — duas coisas que só o
 * dono da conta faz, e que travam a sessão inteira esperando um navegador.
 * Este script pede só o que já está no `.env`: a URL do banco. Ele não
 * substitui a doutrina de migrations (o arquivo versionado e a linha no
 * MANIFEST continuam sendo a fonte); ele APLICA o arquivo que já existe.
 *
 * ─── Por que sem transação explícita ──────────────────────────────────────
 *
 * Mesma razão que a doutrina dá para o próprio arquivo `.sql` não trazer
 * `BEGIN`/`COMMIT`: o runner envolve. Aqui o `pg` manda o arquivo inteiro numa
 * query só, e o Postgres já trata múltiplos comandos sem transação explícita
 * como uma transação implícita — ou entra tudo, ou nada.
 *
 * ─── Por que ele CONFERE em vez de confiar no "sem erro" ──────────────────
 *
 * Uma migration idempotente inteira de `if not exists` roda limpa mesmo
 * apontada para o banco errado — ela cria tudo lá e diz "pronto". O modo de
 * falha que isto já custou: as cinco tabelas do funil foram dadas como
 * aplicadas, e o insert em produção devolvia 503 porque nenhuma existia no
 * projeto que a Vercel usa. Por isso o script imprime o REF do projeto antes
 * de escrever, e lista as tabelas depois.
 *
 *   node scripts/aplicar-migration.mjs supabase/migrations/2026..._0240_....sql
 */
import { readFileSync } from "node:fs";
import pg from "pg";

const arquivo = process.argv[2];
if (!arquivo) {
  console.error("uso: node scripts/aplicar-migration.mjs <caminho/da/migration.sql>");
  process.exit(2);
}

const url = (process.env.SUPABASE_DB_URL ?? "").trim();
if (!url) {
  console.error("SUPABASE_DB_URL ausente no ambiente.");
  process.exit(2);
}

const ref = url.match(/postgres\.([a-z0-9]+):/)?.[1] ?? "(ref desconhecido)";
console.log(`projeto : ${ref}`);
console.log(`arquivo : ${arquivo}`);

const sql = readFileSync(arquivo, "utf8");
const cliente = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });

await cliente.connect();
try {
  await cliente.query(sql);
  console.log("aplicada sem erro.");

  // A conferência: as tabelas que o arquivo cria existem AGORA, neste banco.
  const criadas = [...sql.matchAll(/create table if not exists public\.([a-z_]+)/g)].map(
    (m) => m[1],
  );
  if (criadas.length > 0) {
    const { rows } = await cliente.query(
      `select table_name from information_schema.tables
        where table_schema = 'public' and table_name = any($1::text[])`,
      [criadas],
    );
    const achadas = new Set(rows.map((r) => r.table_name));
    for (const t of criadas) console.log(`  ${achadas.has(t) ? "ok   " : "FALTA"}  ${t}`);
    if (achadas.size !== criadas.length) process.exitCode = 1;
  }
} finally {
  await cliente.end();
}
