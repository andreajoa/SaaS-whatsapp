import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  limparCacheDeAcesso,
  organizacaoTemAcessoAtivo,
  organizacaoTemAcessoAtivoPg,
} from "./gate-runtime";

const ORG_A = "11111111-1111-4111-8111-111111111111";
const CHAVE_ORIGINAL = process.env.STRIPE_SECRET_KEY;

function fakePool(rows: Array<{ status: string }>, shouldThrow = false) {
  const query = vi.fn(async () => {
    if (shouldThrow) throw new Error("db_down");
    return { rows };
  });
  return { query };
}

function fakeAdmin(row: Record<string, unknown> | null, shouldThrow = false) {
  return {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => {
            if (shouldThrow) throw new Error("db_down");
            return { data: row, error: null };
          },
        }),
      }),
    }),
  } as never;
}

describe("gate-runtime de assinatura (workers, agent-engine, MCP)", () => {
  beforeEach(() => {
    limparCacheDeAcesso();
  });

  afterEach(() => {
    limparCacheDeAcesso();
    if (CHAVE_ORIGINAL === undefined) delete process.env.STRIPE_SECRET_KEY;
    else process.env.STRIPE_SECRET_KEY = CHAVE_ORIGINAL;
  });

  it("em self-host (sem STRIPE_SECRET_KEY) libera sem consultar o banco", async () => {
    delete process.env.STRIPE_SECRET_KEY;
    const pool = fakePool([]);
    expect(await organizacaoTemAcessoAtivoPg(pool, ORG_A)).toBe(true);
    expect(pool.query).not.toHaveBeenCalled();
  });

  it("com cobrança ligada: bloqueia organização sem linha (sem_cartao) ou cancelada/unpaid", async () => {
    process.env.STRIPE_SECRET_KEY = "sk_test_123";

    expect(await organizacaoTemAcessoAtivoPg(fakePool([]), ORG_A, 1_000)).toBe(false);
    limparCacheDeAcesso(ORG_A);

    for (const status of ["canceled", "unpaid", "incomplete", "incomplete_expired", "paused"]) {
      expect(await organizacaoTemAcessoAtivoPg(fakePool([{ status }]), ORG_A, 1_000)).toBe(false);
      limparCacheDeAcesso(ORG_A);
    }
  });

  it("com cobrança ligada: libera trialing, active e past_due", async () => {
    process.env.STRIPE_SECRET_KEY = "sk_test_123";

    for (const status of ["trialing", "active", "past_due"]) {
      expect(await organizacaoTemAcessoAtivoPg(fakePool([{ status }]), ORG_A, 1_000)).toBe(true);
      limparCacheDeAcesso(ORG_A);
    }
  });

  it("em falha transitória de banco, falha ABERTO para não derrubar pagante", async () => {
    process.env.STRIPE_SECRET_KEY = "sk_test_123";
    expect(await organizacaoTemAcessoAtivoPg(fakePool([], true), ORG_A, 1_000)).toBe(true);
    expect(await organizacaoTemAcessoAtivo(fakeAdmin(null, true), ORG_A, 1_000)).toBe(true);
  });

  it("cacheia por 60s e limparCacheDeAcesso invalida imediatamente", async () => {
    process.env.STRIPE_SECRET_KEY = "sk_test_123";
    const pool = fakePool([{ status: "canceled" }]);
    expect(await organizacaoTemAcessoAtivoPg(pool, ORG_A, 10_000)).toBe(false);
    expect(await organizacaoTemAcessoAtivoPg(pool, ORG_A, 20_000)).toBe(false);
    expect(pool.query).toHaveBeenCalledTimes(1);

    limparCacheDeAcesso(ORG_A);
    const poolAtivo = fakePool([{ status: "active" }]);
    expect(await organizacaoTemAcessoAtivoPg(poolAtivo, ORG_A, 21_000)).toBe(true);
  });
});
