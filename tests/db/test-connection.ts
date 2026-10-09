import type { PoolConfig } from "pg";

/** O runner online verifica um banco vazio antes de instalar o schema. */
export function invariantConnection(): PoolConfig {
  if (process.env.TEST_DATABASE_URL) {
    if (!process.env.ATENZA_TEST_RUN_ID) throw new Error("Use scripts/test-db-online.mjs para validar o banco de teste.");
    return { connectionString: process.env.TEST_DATABASE_URL, max: 1, statement_timeout: 90000 };
  }
  if (!process.env.TEST_DB_CONTAINER) throw new Error("Banco descartável ausente. Use o runner de testes de banco.");
  return {
    host: "127.0.0.1", port: Number(process.env.TEST_DB_PORT ?? 54329),
    user: "postgres", password: "postgres", database: "postgres", max: 1,
  };
}
