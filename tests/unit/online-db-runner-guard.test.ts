import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { invariantConnection } from "../db/test-connection";

afterEach(() => vi.unstubAllEnvs());

describe("runner de banco online", () => {
  it.each([
    "", "credencial-secreta-invalida", "https://secreta@example.invalid",
    "postgresql://user:secreta@example.invalid:6543/postgres",
  ])("recusa conexão ausente, inválida ou pooler de transação sem expor credencial", value => {
    try {
      execFileSync(process.execPath, [resolve("scripts/test-db-online.mjs")], {
        env: { ...process.env, TEST_DATABASE_URL: value }, encoding: "utf8", stdio: "pipe", timeout: 10000,
      });
      throw new Error("O runner deveria recusar antes de conectar.");
    } catch (error) {
      const failure = error as { status?: number; stderr?: string };
      expect(failure.status).toBe(1);
      expect(failure.stderr).not.toContain("secreta");
    }
  });
  it("testes não recebem conexão online sem o marcador emitido pelo runner", () => {
    vi.stubEnv("TEST_DATABASE_URL", "postgresql://example.invalid/test");
    vi.stubEnv("ATENZA_TEST_RUN_ID", "");
    expect(() => invariantConnection()).toThrow(/test-db-online/);
  });
});
