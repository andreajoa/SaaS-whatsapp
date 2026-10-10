/**
 * Runtime real do "Testar agente" (issue #71).
 *
 * O preview usa o mesmo core e as mesmas dependências de um turno normal. Este
 * teste fixa o contrato de falha desse caminho: o run guarda um checkpoint
 * útil e a pessoa recebe orientação legível, sem detalhes internos do provider.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { requireRole } from "@/lib/auth/require-role";
import { createAdminClient } from "@/lib/supabase/admin";
import { ROLE_RANK, type AuthUser, type Role } from "@/lib/auth/types";
import { testAgentVersion } from "@/lib/agent-engine/agent/sandbox";
import { requestTurnDeps } from "@/lib/agent-engine/agent/request-deps";
import { getRequestPool } from "@/lib/agent-engine/db/request-pool";
import { fail } from "@/lib/api/wrappers";
import { audit } from "@/lib/audit";
import type * as SupportModule from "@/lib/impersonate/support";

vi.mock("@/lib/auth/require-role", () => ({ requireRole: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));
vi.mock("@/lib/audit", () => ({ audit: vi.fn(async () => undefined) }));
vi.mock("@/lib/agent-engine/agent/sandbox", () => ({
  testAgentVersion: vi.fn(async () => {
    throw new Error("AI_GATEWAY_API_KEY ausente");
  }),
}));
vi.mock("@/lib/agent-engine/agent/request-deps", () => ({ requestTurnDeps: vi.fn() }));
vi.mock("@/lib/agent-engine/db/request-pool", () => ({ getRequestPool: vi.fn() }));

const ORG = "22222222-2222-4222-8222-222222222222";
const USER = "11111111-1111-4111-8111-111111111111";
const AGENT = "33333333-3333-4333-8333-333333333333";
const VERSION = "44444444-4444-4444-8444-444444444444";
const sql = readFileSync(join(process.cwd(), "supabase/baseline.sql"), "utf8");
const statusCheck = sql.match(/CONSTRAINT "ai_agent_runs_status_check" CHECK[^\n]+/);
if (!statusCheck) throw new Error("CHECK de ai_agent_runs ausente no baseline");
const statusPermitidos = [...statusCheck[0].matchAll(/'([^']+)'/g)].map((m) => m[1]);
const registro: Record<string, unknown> = {};
const filtrosDeVersao: Record<string, string> = {};
const filtrosDeAtualizacao: Array<Record<string, string>> = [];
const inserts: Record<string, unknown>[] = [];
let falhaAoGravar = false;
let registroAusente = false;
let versaoDisponivel = true;

function stubAdmin(atualizacoes: Record<string, unknown>[]) {
  return {
    from: (table: string) => {
      if (table === "ai_agent_versions") {
        const query = {
          eq: (campo: string, valor: string) => {
            filtrosDeVersao[campo] = valor;
            return query;
          },
          maybeSingle: async () => {
            const noRecorte = versaoDisponivel
              && filtrosDeVersao.organization_id === ORG
              && filtrosDeVersao.id === VERSION
              && filtrosDeVersao.agent_id === AGENT;
            return {
              data: noRecorte ? {
                id: VERSION,
                agent_id: AGENT,
                organization_id: ORG,
                system_prompt: "oi",
                provider: "anthropic",
                model: "claude-sonnet-4-6",
                channel_session_id: null,
                max_steps: 3,
                token_budget: 1000,
                cost_budget_cents: 100,
                tool_ids: [],
              } : null,
              error: null,
            };
          },
        };
        return { select: () => query };
      }
      // ai_agent_runs
      return {
        insert: (payload: Record<string, unknown>) => {
          inserts.push(payload);
          Object.assign(registro, payload);
          return { select: () => ({ single: async () => ({ data: { id: "run-1" }, error: null }) }) };
        },
        update: (payload: Record<string, unknown>) => {
          atualizacoes.push(payload);
          const filtros: Record<string, string> = {};
          filtrosDeAtualizacao.push(filtros);
          const chain = {
            eq: (campo: string, valor: string) => {
              filtros[campo] = valor;
              return chain;
            },
            select: () => chain,
            single: () => chain,
            then: (resolver: (value: { data: { id: string } | null; error: { message: string } | null }) => unknown) => {
              const error = falhaAoGravar
                ? { message: "falha privada de persistência" }
                : !statusPermitidos.includes(String(payload.status))
                  ? { message: "23514: ai_agent_runs_status_check" }
                  : filtros.organization_id !== ORG || filtros.id !== "run-1"
                    ? { message: "filtro de tenant ausente" }
                    : null;
              const data = error || registroAusente ? null : { id: "run-1" };
              if (data) Object.assign(registro, payload);
              return Promise.resolve({ data, error }).then(resolver);
            },
          };
          return chain;
        },
      };
    },
  };
}

describe("POST .../versions/:vid/test — core compartilhado", () => {
  const atualizacoes: Record<string, unknown>[] = [];
  const requestPool = { query: vi.fn() };
  const turnDeps = {};

  beforeEach(() => {
    atualizacoes.length = 0;
    inserts.length = 0;
    filtrosDeAtualizacao.length = 0;
    for (const key of Object.keys(registro)) delete registro[key];
    for (const key of Object.keys(filtrosDeVersao)) delete filtrosDeVersao[key];
    falhaAoGravar = false;
    registroAusente = false;
    versaoDisponivel = true;
    vi.mocked(testAgentVersion).mockReset().mockRejectedValue(new Error("AI_GATEWAY_API_KEY ausente"));
    vi.mocked(createAdminClient).mockClear();
    vi.mocked(audit).mockClear();
    const user: AuthUser = {
      id: USER,
      email: "a@example.com",
      full_name: null,
      avatar_url: null,
      is_platform_admin: false,
      idioma: "pt-BR" as const,
      organizations: [{ organization_id: ORG, organization_name: "Org", role: "admin" }],
    };
    vi.mocked(requireRole).mockImplementation(async (min: Role) =>
      ROLE_RANK["admin"] >= ROLE_RANK[min]
        ? { ok: true, user, org: { orgId: ORG, name: "Org", role: "admin" } }
        : ({ ok: false, response: null } as never),
    );
    vi.mocked(createAdminClient).mockReturnValue(stubAdmin(atualizacoes) as never);
    vi.mocked(getRequestPool).mockReturnValue(requestPool as never);
    vi.mocked(requestTurnDeps).mockReturnValue(turnDeps as never);
  });

  it("falha do core vira checkpoint e orientação legível", async () => {
    const { POST } = await import("./route");
    const req = new NextRequest("http://localhost/x", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ sample_message: "oi" }),
    });

    const res = await POST(req, { params: Promise.resolve({ id: AGENT, vid: VERSION }) });
    const body = (await res.json()) as { error?: { code?: string; message?: string } };

    expect(testAgentVersion).toHaveBeenCalledWith(
      requestPool,
      turnDeps,
      expect.objectContaining({
        organizationId: ORG,
        agentId: AGENT,
        versionId: VERSION,
        runId: "run-1",
        sampleMessage: "oi",
      }),
    );
    expect(res.status).toBe(422);
    expect(body.error).toMatchObject({
      code: "preview_failed",
      message: "Não foi possível executar o teste. Confira modelo, credencial e materiais do agente.",
    });
    expect(body.error?.message).not.toContain("AI_GATEWAY_API_KEY");
    expect(atualizacoes).toContainEqual(expect.objectContaining({
      status: "failed",
      error_code: "preview_failed",
    }));
    expect(registro.status).toBe("failed");
    expect(registro.completed_at).toEqual(expect.any(String));
    expect(filtrosDeAtualizacao).toEqual([{ organization_id: ORG, id: "run-1" }]);
  });

  async function executar() {
    const { POST } = await import("./route");
    return POST(new NextRequest("http://localhost/x", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ sample_message: "oi" }),
    }), { params: Promise.resolve({ id: AGENT, vid: VERSION }) });
  }

  function preview(comResposta: boolean) {
    vi.mocked(testAgentVersion).mockResolvedValue({
      candidates: comResposta ? [{ body: "Olá, como posso ajudar?", citations: [], trace: [] }] : [],
      proposals: [], impediments: [], restrictions: [],
    });
  }

  it("resposta candidata encerra o registro com completed aceito pelo CHECK real", async () => {
    preview(true);
    const res = await executar();
    expect(res.status).toBe(200);
    expect((await res.json()).data.status).toBe("ok");
    expect(registro).toMatchObject({ status: "completed", error_code: null });
    expect(statusPermitidos).toContain(String(registro.status));
    expect(inserts[0]).toMatchObject({ organization_id: ORG, is_dry_run: true });
    expect(filtrosDeVersao).toEqual({ id: VERSION, organization_id: ORG, agent_id: AGENT });
    expect(filtrosDeAtualizacao).toEqual([{ organization_id: ORG, id: "run-1" }]);
  });

  it("preview sem candidato preserva blocked na resposta e grava failed/preview_blocked", async () => {
    preview(false);
    const res = await executar();
    expect(res.status).toBe(200);
    expect((await res.json()).data.status).toBe("blocked");
    expect(registro).toMatchObject({ status: "failed", error_code: "preview_blocked" });
    expect(registro.completed_at).toEqual(expect.any(String));
  });

  it.each([true, false])("falha ao gravar não vira sucesso do preview (candidato=%s)", async (comResposta) => {
    preview(comResposta);
    falhaAoGravar = true;
    const res = await executar();
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error.code).toBe("internal_error");
    expect(JSON.stringify(body)).not.toContain("falha privada");
    expect(registro.status).toBe("running");
  });

  it("falha ao gravar o checkpoint de exceção também é informada", async () => {
    falhaAoGravar = true;
    const res = await executar();
    expect(res.status).toBe(500);
    expect((await res.json()).error.code).toBe("internal_error");
    expect(registro.status).toBe("running");
  });

  it.each(["candidate", "blocked", "exception"] as const)("registro ausente impede anunciar desfecho (%s)", async (resultado) => {
    if (resultado !== "exception") preview(resultado === "candidate");
    registroAusente = true;
    const res = await executar();
    expect(res.status).toBe(500);
    expect((await res.json()).error.code).toBe("internal_error");
    expect(registro.status).toBe("running");
    expect(audit).not.toHaveBeenCalled();
  });

  it("versão ausente no recorte do tenant não inicia execução", async () => {
    versaoDisponivel = false;
    const res = await executar();
    expect(res.status).toBe(404);
    expect(testAgentVersion).not.toHaveBeenCalled();
    expect(inserts).toEqual([]);
  });

  it("recusa de autorização não abre client admin nem executa runtime", async () => {
    vi.mocked(requireRole).mockResolvedValueOnce({ ok: false, response: fail("forbidden_role", "Acesso negado.", 403) });
    const res = await executar();
    expect(res.status).toBe(403);
    expect(createAdminClient).not.toHaveBeenCalled();
    expect(testAgentVersion).not.toHaveBeenCalled();
  });
});

// Este teste isola o handler; autoridade de suporte é exercitada na suíte própria.
vi.mock("@/lib/impersonate/support", async (importOriginal) => ({
  ...await importOriginal<typeof SupportModule>(),
  requireSupportWrite: vi.fn(async () => null),
  authenticatedSessionId: vi.fn(async () => "f2200000-0000-4000-8000-000000000099"),
}));
