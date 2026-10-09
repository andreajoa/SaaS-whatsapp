#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import pg from "pg";

const root = fileURLToPath(new URL("../", import.meta.url));
const connectionString = process.env.TEST_DATABASE_URL;
if (!connectionString) throw new Error("TEST_DATABASE_URL ausente; informe um Supabase de teste vazio.");
let endpoint;
try { endpoint = new URL(connectionString); }
catch { throw new Error("TEST_DATABASE_URL deve ser uma URL Postgres válida."); }
if (!["postgres:", "postgresql:"].includes(endpoint.protocol) || !endpoint.hostname || endpoint.port === "6543") {
  throw new Error("Use conexão Postgres direta ou pooler em modo sessão, nunca pooler de transação.");
}
const db = new pg.Client({ connectionString, statement_timeout: 120000, connectionTimeoutMillis: 20000 });
try {
  await db.connect();
  // Recusa qualquer banco do produto já instalado. Nunca apaga ou reseta dados.
  const { rows: tables } = await db.query("select tablename from pg_tables where schemaname='public'");
  if (tables.length) throw new Error("O banco contém tabelas em public. Use um projeto/branch Supabase de teste vazio.");
  const { rows: users } = await db.query("select count(*)::int as total from auth.users");
  if (users[0]?.total !== 0) throw new Error("O banco contém usuários. Use um Supabase de teste vazio.");
  const { rows: roles } = await db.query("select rolname from pg_roles where rolname in ('anon','authenticated','service_role')");
  if (roles.length !== 3) throw new Error("O banco deve ter o bootstrap nativo do Supabase.");

  await db.query(`create extension if not exists "uuid-ossp" with schema extensions;
    create extension if not exists pgcrypto with schema extensions;
    create extension if not exists vector with schema public;
    create extension if not exists citext with schema public;
    create extension if not exists pg_trgm with schema public;`);
  const baseline = await readFile(new URL("../supabase/baseline.sql", import.meta.url), "utf8");
  console.log("Instalando baseline no banco online vazio.");
  await db.query(baseline);
  console.log("Reaplicando baseline para conferir idempotência.");
  await db.query(baseline);
  const runId = randomUUID();
  await db.query(`create schema if not exists atenza_validation;
    create table if not exists atenza_validation.run(run_id uuid primary key, expires_at timestamptz not null);`);
  await db.query("insert into atenza_validation.run values($1,now()+interval '1 hour')", [runId]);
  await db.end();
  const child = spawn(process.execPath, ["node_modules/vitest/vitest.mjs", "run", "--config", "vitest.online-db.config.ts"], {
    cwd: root, stdio: "inherit", env: { ...process.env, ATENZA_TEST_RUN_ID: runId },
  });
  const code = await new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("exit", (exitCode) => resolve(exitCode ?? 1));
  });
  process.exitCode = code;
} catch (error) {
  // Não imprimir URL, credencial nem stack com argumentos de conexão.
  console.error(error instanceof Error && !('code' in error) ? error.message : "Falha de banco online; confira permissões, TLS e schema do ambiente de teste.");
  process.exitCode = 1;
} finally {
  await db.end().catch(() => {});
}
