import type { SupabaseClient } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { actionHistory, executeAction, listActions, requireActionPermission, saveAction, type ActionAuthContext } from "./service";
import { actionConfigSchema, type ActionRow } from "./schema";
import type * as Network from "./network";
import { buildMcpTurnTools } from "@/lib/agent-engine/edge/crm/mcp-tools";
import type { PublishedAgentConfig } from "@/lib/agent-engine/agent/agent-config";
import type { Logger } from "@/lib/agent-engine/obs/logger";

const mocked = vi.hoisted(() => ({ audit: vi.fn(), encrypt: vi.fn(), decrypt: vi.fn(), resolve: vi.fn(), transport: vi.fn(), boundaryGuard: vi.fn() }));
vi.mock("@/lib/audit", () => ({ audit: mocked.audit }));
vi.mock("@/lib/webhooks/secrets", () => ({ encryptWebhookSecret: mocked.encrypt, decryptWebhookSecret: mocked.decrypt }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("./network", async importOriginal => ({ ...await importOriginal<typeof Network>(), resolvePublicAddress: mocked.resolve, requestPinned: mocked.transport }));
vi.mock("@/lib/ai/runtime/tools", () => ({ pickToolsFromMcp: vi.fn(() => ({})) }));
vi.mock("@/lib/ai/runtime/mcp_token", () => ({ mintEphemeralToken: vi.fn(async () => ({ id: "ephemeral" })), revokeEphemeralToken: vi.fn() }));
vi.mock("@/lib/atendimento/fronteira-server", () => ({ currentExecutionBoundary: vi.fn(() => null), currentExecutionJob: vi.fn(() => null), guardServiceEffect: mocked.boundaryGuard }));
vi.mock("@/lib/agent-engine/queue/claim", () => ({ claimOfJob: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));

const org = "a2440000-0000-4000-8000-000000000001";
const id = "a2440000-0000-4000-8000-000000000002";
const ctx = (): ActionAuthContext => ({ organizationId: org, actorUserId: "a2440000-0000-4000-8000-000000000003", role: "manager", requestId: "a2440000-0000-4000-8000-000000000004" });
function action(): ActionRow { return { id, organization_id: org, configuration: actionConfigSchema.parse({ name: "Consulta", description: "Consulta dados do fornecedor", url_template: "https://api.vendor.com/orders", method: "GET", mutating: false, enabled: true, input_schema: { type: "object", properties: {}, additionalProperties: false } }), credential_header_names: ["Authorization"], created_at: "2026-10-08T00:00:00Z", updated_at: "2026-10-08T00:00:00Z" }; }
function dbFixture(row: ActionRow | null = action(), historyInsertError = false) {
  const state = {
    action: row,
    encrypted: "\\xCIPHERTEXT" as string | null,
    agent: { id: "a2440000-0000-4000-8000-000000000005", organization_id: org, published_version_id: "a2440000-0000-4000-8000-000000000006" as string | null, archived_at: null as string | null, paused_at: null as string | null, operation_mode: "automatic" },
    version: { id: "a2440000-0000-4000-8000-000000000006", organization_id: org, agent_id: "a2440000-0000-4000-8000-000000000005", status: "published", integration_action_ids: [id] },
    queryError: false,
    afterVersionRead: undefined as (() => void) | undefined,
  };
  const calls: { table: string; filters: [string, unknown][]; operation: string; value?: unknown }[] = [];
  const db = {
    rpc: vi.fn(async (_name: string, args: { p_id?: string }) => {
      if (args.p_id && state.action) state.action.id = args.p_id;
      return { data: args.p_id ?? id, error: null };
    }),
    from: vi.fn((table: string) => {
      const call = { table, filters: [] as [string, unknown][], operation: "select", value: undefined as unknown }; calls.push(call);
      const result = () => ({ error: (state.queryError && call.operation === "select") || (historyInsertError && table === "integration_action_executions" && call.operation === "insert") ? { message: "db down" } : null,
        data: structuredClone(table === "integration_actions" ? state.action : table === "integration_action_credentials" ? (state.encrypted ? { headers_encrypted: state.encrypted } : null) : table === "ai_agents" ? state.agent : table === "ai_agent_versions" ? state.version : table === "integration_action_executions" && call.operation === "select" ? calls.filter(c => c.operation === "update").map(c => c.value) : null) });
      const query = {
        select: vi.fn(() => query), eq: vi.fn((key: string, value: unknown) => { call.filters.push([key, value]); return query; }),
        in: vi.fn((key: string, value: unknown) => { call.filters.push([key, value]); return query; }),
        insert: vi.fn((value: unknown) => { call.operation = "insert"; call.value = value; return query; }),
        update: vi.fn((value: unknown) => { call.operation = "update"; call.value = value; return query; }),
        order: vi.fn(() => query), limit: vi.fn(() => {
          if (table === "integration_actions" && call.filters.some(([key, value]) => key === "id" && Array.isArray(value))) return Promise.resolve({ data: state.action ? [structuredClone(state.action)] : [], error: null });
          return query;
        }),
        maybeSingle: vi.fn(async () => { const value = result(); if (table === "ai_agent_versions") state.afterVersionRead?.(); return value; }),
        then: (fulfilled: (value: ReturnType<typeof result>) => unknown) => Promise.resolve(result()).then(fulfilled),
      };
      return query;
    }),
  } as unknown as SupabaseClient;
  return { db, calls, state };
}
beforeEach(() => { vi.clearAllMocks(); mocked.encrypt.mockResolvedValue("\\xCIPHERTEXT"); mocked.decrypt.mockResolvedValue('{"Authorization":"Bearer test-private-key"}'); mocked.resolve.mockResolvedValue({ address: "93.184.216.34", family: 4 }); mocked.transport.mockResolvedValue({ status: 200, body: "{}" }); mocked.boundaryGuard.mockResolvedValue(undefined); });
describe("ações REST: tenant, permissão, cifra e trilha", () => {
  it.each([false, true])("caller real preview consulta draft sem publicação (pausado=%s)", async paused => {
    const f = dbFixture(); f.state.version.status = "draft"; f.state.agent.published_version_id = null;
    f.state.agent.operation_mode = "assisted";
    if (paused) f.state.agent.paused_at = "2026-10-09T00:00:00Z";
    const agentConfig = { agentId: f.state.agent.id, versionId: f.state.version.id, integrationActionIds: [id], toolIds: [], pipelineIds: [] } as unknown as PublishedAgentConfig;
    const turn = await buildMcpTurnTools({ supabase: f.db }, { organizationId: org, jobId: "preview" }, agentConfig, { warn: vi.fn() } as unknown as Logger, { readOnly: true });
    const restTool = Object.values(turn!.tools)[0]!;
    expect(await restTool.execute!({ inputs: {} }, { toolCallId: "call", messages: [], context: {} })).toMatchObject({ success: true });
    expect(mocked.transport).toHaveBeenCalledTimes(1);
    f.state.action!.configuration = { ...f.state.action!.configuration, method: "POST", mutating: true };
    const mutatingTurn = await buildMcpTurnTools({ supabase: f.db }, { organizationId: org, jobId: "preview" }, agentConfig, { warn: vi.fn() } as unknown as Logger, { readOnly: true });
    expect(mutatingTurn!.tools).toEqual({});
    await turn!.cleanup(); await mutatingTurn!.cleanup();
  });
  it("caller real executa última guarda de serviço após consultas de autorização", async () => {
    const f = dbFixture();
    f.state.afterVersionRead = () => { mocked.boundaryGuard.mockRejectedValueOnce(new Error("revoked_during_query")); };
    const agentConfig = { agentId: f.state.agent.id, versionId: f.state.version.id, integrationActionIds: [id], toolIds: [], pipelineIds: [] } as unknown as PublishedAgentConfig;
    const turn = await buildMcpTurnTools({ supabase: f.db }, { organizationId: org, jobId: "job" }, agentConfig, { warn: vi.fn() } as unknown as Logger);
    const restTool = Object.values(turn!.tools)[0]!;
    expect(await restTool.execute!({ inputs: {} }, { toolCallId: "call", messages: [], context: {} })).toMatchObject({ error_code: "authorization_revoked", outcome_uncertain: false });
    expect(mocked.transport).not.toHaveBeenCalled();
    expect(f.calls.find(c => c.operation === "update")?.value).toMatchObject({ state: "failed" });
    await turn!.cleanup();
  });
  it.each(["inalterado", "pausa", "seleção", "fronteira"])("wiring real engine → ferramenta → serviço após DNS: %s", async reason => {
    const f = dbFixture();
    const agentConfig = { agentId: f.state.agent.id, versionId: f.state.version.id, integrationActionIds: [id], toolIds: [], pipelineIds: [] } as unknown as PublishedAgentConfig;
    const turn = await buildMcpTurnTools({ supabase: f.db }, { organizationId: org, jobId: "job" }, agentConfig, { warn: vi.fn() } as unknown as Logger);
    let entered!: () => void;
    const resolving = new Promise<void>(resolve => { entered = resolve; });
    let release!: () => void;
    mocked.resolve.mockImplementationOnce(() => { entered(); return new Promise(resolve => { release = () => resolve({ address: "93.184.216.34", family: 4 }); }); });
    const restTool = Object.values(turn!.tools)[0]!;
    const running = restTool.execute!({ inputs: {} }, { toolCallId: "call", messages: [], context: {} });
    await resolving;
    expect(mocked.boundaryGuard).not.toHaveBeenCalled();
    if (reason === "pausa") f.state.agent.paused_at = "2026-10-09T00:00:00Z";
    if (reason === "seleção") f.state.version.integration_action_ids = [];
    if (reason === "fronteira") mocked.boundaryGuard.mockRejectedValueOnce(new Error("stale_boundary"));
    release();
    expect(await running).toMatchObject(reason === "inalterado" ? { success: true } : { success: false, error_code: "authorization_revoked", outcome_uncertain: false });
    expect(mocked.transport).toHaveBeenCalledTimes(reason === "inalterado" ? 1 : 0);
    expect(mocked.boundaryGuard).toHaveBeenCalledTimes(["inalterado", "fronteira"].includes(reason) ? 1 : 0);
    expect(f.calls.find(c => c.operation === "update")?.value).toMatchObject({ state: reason === "inalterado" ? "succeeded" : "failed" });
    await turn!.cleanup();
  });
  it.each(["desativada", "removida", "configuração", "updated_at", "credencial", "credencial removida", "tenant da ação", "tenant autenticado", "role", "readonly", "suporte readonly", "agente pausado", "agente arquivado", "modo assistido", "versão substituída", "status da versão", "seleção removida", "tenant da versão", "agente da versão", "falha de consulta"])("DNS suspenso: revoga %s, persiste falha e não transporta", async reason => {
    const f = dbFixture();
    // Também cobre mutações: revogação jamais declara outcome_uncertain.
    f.state.action!.configuration = { ...f.state.action!.configuration, method: "POST", mutating: true };
    const auth = ctx();
    const input = { id, inputs: {}, source: "agent" as const, confirmMutation: true, readOnly: false, agentAuthorization: { agentId: f.state.agent.id, versionId: f.state.version.id } };
    let release!: () => void;
    let entered!: () => void;
    const resolving = new Promise<void>(resolve => { entered = resolve; });
    mocked.resolve.mockImplementationOnce(() => { entered(); return new Promise(resolve => { release = () => resolve({ address: "93.184.216.34", family: 4 }); }); });
    const transport = vi.fn(async () => ({ status: 200, body: "{}" }));
    const running = executeAction(f.db, auth, input, { transport });
    await resolving;
    switch (reason) {
      case "desativada": f.state.action!.configuration.enabled = false; break;
      case "removida": f.state.action = null; break;
      case "configuração": f.state.action!.configuration.url_template = "https://other.vendor.com/orders"; break;
      case "updated_at": f.state.action!.updated_at = "2026-10-09T00:00:00Z"; break;
      case "credencial": f.state.encrypted = "\\xROTATED"; break;
      case "credencial removida": f.state.encrypted = null; break;
      case "tenant da ação": f.state.action!.organization_id = "other"; break;
      case "tenant autenticado": auth.organizationId = "other"; break;
      case "role": auth.role = "agent"; break;
      case "readonly": input.readOnly = true; break;
      case "suporte readonly": auth.support = { organization_id: org, access_mode: "support_readonly", status: "active" } as ActionAuthContext["support"]; break;
      case "agente pausado": f.state.agent.paused_at = "2026-10-09T00:00:00Z"; break;
      case "agente arquivado": f.state.agent.archived_at = "2026-10-09T00:00:00Z"; break;
      case "modo assistido": f.state.agent.operation_mode = "assisted"; break;
      case "versão substituída": f.state.agent.published_version_id = "other"; break;
      case "status da versão": f.state.version.status = "superseded"; break;
      case "seleção removida": f.state.version.integration_action_ids = []; break;
      case "tenant da versão": f.state.version.organization_id = "other"; break;
      case "agente da versão": f.state.version.agent_id = "other"; break;
      case "falha de consulta": f.state.queryError = true; break;
    }
    release();
    const result = await running;
    expect(result).toMatchObject({ success: false, error_code: "authorization_revoked", http_status: null, outcome_uncertain: false });
    expect(transport).not.toHaveBeenCalled();
    const saved = f.calls.find(c => c.operation === "update");
    expect(saved?.value).toMatchObject({ state: "failed", result });
    expect(saved?.filters).toContainEqual(["organization_id", org]);
  });
  it("agente com versão ativa e seleção atual executa; sem identidade falha fechada", async () => {
    const f = dbFixture();
    const transport = vi.fn(async () => ({ status: 200, body: "{}" }));
    const input = { id, inputs: {}, source: "agent" as const, confirmMutation: false };
    expect(await executeAction(f.db, ctx(), { ...input, agentAuthorization: { agentId: f.state.agent.id, versionId: f.state.version.id } }, { transport })).toMatchObject({ success: true });
    expect(await executeAction(f.db, ctx(), input, { transport })).toMatchObject({ error_code: "authorization_revoked", outcome_uncertain: false });
    expect(transport).toHaveBeenCalledTimes(1);
    for (const c of f.calls.filter(c => ["ai_agents", "ai_agent_versions"].includes(c.table))) expect(c.filters).toContainEqual(["organization_id", org]);
  });
  it.each(["manual", "test"] as const)("%s legítimo testa ação desativada sem exigir agente publicado", async source => {
    const f = dbFixture(); f.state.action!.configuration.enabled = false;
    const transport = vi.fn(async () => ({ status: 200, body: "{}" }));
    expect(await executeAction(f.db, ctx(), { id, inputs: {}, source, confirmMutation: false }, { transport })).toMatchObject({ success: true });
    expect(transport).toHaveBeenCalledTimes(1);
  });
  it("resultado e histórico serializados não vazam segredo em chaves nem no mapping", async () => {
    const f = dbFixture();
    mocked.decrypt.mockResolvedValue('{"Authorization":"Bearer abc123"}');
    f.state.action!.configuration.result_mapping = { echo_abc123: "nested" };
    const transport = vi.fn(async () => ({ status: 200, body: '{"nested":[{"echo-abc123":"ok","Bearer%20abc123":"ok"}]}' }));
    const result = await executeAction(f.db, ctx(), { id, inputs: {}, source: "test", confirmMutation: false }, { transport });
    expect(result.success).toBe(true);
    expect(JSON.stringify(result)).not.toContain("abc123");
    expect(JSON.stringify(await actionHistory(f.db, ctx(), id))).not.toContain("abc123");
    expect(JSON.stringify(await actionHistory(f.db, ctx(), id))).toContain("ok");
  });
  it("viewer não configura nem executa; agent executa consulta e não configura", () => {
    expect(() => requireActionPermission({ ...ctx(), role: "viewer" }, "agent", true)).toThrow();
    expect(() => requireActionPermission({ ...ctx(), role: "agent" }, "manager", true)).toThrow();
    expect(() => requireActionPermission({ ...ctx(), role: "agent" }, "agent", true)).not.toThrow();
  });
  it("suporte somente leitura recusa efeito até com role elevado", async () => {
    const readonly = { ...ctx(), support: { organization_id: org, access_mode: "support_readonly" as const, status: "active" as const } as ActionAuthContext["support"] };
    const { db } = dbFixture();
    await expect(executeAction(db, readonly, { id, inputs: {}, source: "test", confirmMutation: false })).rejects.toMatchObject({ code: "forbidden", status: 403 });
    expect(db.from).not.toHaveBeenCalled();
  });
  it("lookup não encontra ação de outra organização", async () => {
    const { db, calls } = dbFixture(null);
    await expect(executeAction(db, ctx(), { id, inputs: {}, source: "manual", confirmMutation: false })).rejects.toMatchObject({ code: "not_found" });
    expect(calls[0]?.filters).toContainEqual(["organization_id", org]);
  });
  it("credenciais são cifradas antes de RPC; retorno tem nomes e nunca valor/cifra", async () => {
    const { db } = dbFixture();
    const result = await saveAction(db, ctx(), { configuration: action().configuration, credential_headers: { Authorization: "Bearer test-private-key" } });
    expect(mocked.encrypt).toHaveBeenCalledWith(db, '{"Authorization":"Bearer test-private-key"}');
    expect(db.rpc).toHaveBeenCalledWith("fn_save_integration_action", expect.objectContaining({ p_org: org, p_encrypted: "\\xCIPHERTEXT", p_header_names: ["Authorization"] }));
    expect(JSON.stringify(result)).not.toContain("test-private-key"); expect(JSON.stringify(result)).not.toContain("CIPHERTEXT");
  });
  it("cifra indisponível falha fechada e não grava", async () => {
    const { db } = dbFixture(); mocked.encrypt.mockResolvedValue(null);
    await expect(saveAction(db, ctx(), { configuration: action().configuration, credential_headers: { Authorization: "Bearer value" } })).rejects.toMatchObject({ code: "encryption_unavailable" });
    expect(db.rpc).not.toHaveBeenCalled();
  });
  it("vazio preserva credenciais; {} explícito remove sem tentar cifrar", async () => {
    const { db } = dbFixture();
    await saveAction(db, ctx(), { configuration: action().configuration }, id);
    expect(db.rpc).toHaveBeenLastCalledWith("fn_save_integration_action", expect.objectContaining({ p_header_names: null, p_encrypted: null }));
    await saveAction(db, ctx(), { configuration: action().configuration, credential_headers: {} }, id);
    expect(db.rpc).toHaveBeenLastCalledWith("fn_save_integration_action", expect.objectContaining({ p_header_names: [], p_encrypted: null }));
    expect(mocked.encrypt).not.toHaveBeenCalled();
  });
  it("tenant do body é recusado, sem consulta nem cifra", async () => {
    const { db } = dbFixture();
    await expect(saveAction(db, ctx(), { configuration: action().configuration, organization_id: "attacker" })).rejects.toThrow();
    expect(db.from).not.toHaveBeenCalled(); expect(mocked.encrypt).not.toHaveBeenCalled();
  });
  it("preview não despacha mutações mesmo com confirmação e manager", async () => {
    const row = action(); row.configuration = { ...row.configuration, method: "POST", mutating: true };
    const { db } = dbFixture(row);
    const transport = vi.fn();
    await expect(executeAction(db, ctx(), { id, inputs: {}, source: "agent", confirmMutation: true, readOnly: true }, { transport })).rejects.toMatchObject({ code: "preview_readonly" });
    expect(transport).not.toHaveBeenCalled(); expect(mocked.decrypt).not.toHaveBeenCalled();
  });
  it("agent sem manager não executa mutação de ferramenta", async () => {
    const row = action(); row.configuration.mutating = true;
    const { db } = dbFixture(row);
    await expect(executeAction(db, { ...ctx(), role: "agent" }, { id, inputs: {}, source: "agent", confirmMutation: true })).rejects.toMatchObject({ code: "forbidden_role" });
    expect(mocked.decrypt).not.toHaveBeenCalled();
  });
  it("ação pausada não é executada por agente", async () => {
    const row = action(); row.configuration.enabled = false;
    const { db } = dbFixture(row);
    await expect(executeAction(db, ctx(), { id, inputs: {}, source: "agent", confirmMutation: false })).rejects.toMatchObject({ code: "action_disabled" });
    expect(mocked.decrypt).not.toHaveBeenCalled();
  });
  it("falha em persistir início impede efeito externo", async () => {
    const { db } = dbFixture(action(), true); const transport = vi.fn();
    await expect(executeAction(db, ctx(), { id, inputs: {}, source: "test", confirmMutation: false }, { transport })).rejects.toMatchObject({ code: "upstream_unavailable" });
    expect(transport).not.toHaveBeenCalled();
  });
  it("resultado e audit sem segredo; queries tenant explícito; trilha visível", async () => {
    const { db, calls } = dbFixture();
    const transport = vi.fn(async () => ({ status: 200, body: '{"order":"paid","echo":"Bearer test-private-key"}' }));
    const result = await executeAction(db, ctx(), { id, inputs: {}, source: "test", confirmMutation: false }, { transport });
    expect(result.success).toBe(true);
    expect(JSON.stringify(result)).not.toContain("test-private-key");
    for (const call of calls.filter(c => c.operation !== "insert")) expect(call.filters).toContainEqual(["organization_id", org]);
    expect(calls.find(c => c.operation === "insert")?.value).toMatchObject({ organization_id: org, state: "running", source: "test" });
    expect(calls.find(c => c.operation === "update")?.value).toMatchObject({ state: "succeeded", result });
    expect(JSON.stringify(mocked.audit.mock.calls)).not.toContain("test-private-key");
  });
  it("listagem não seleciona credenciais", async () => {
    const { db, calls } = dbFixture(); await listActions(db, ctx());
    expect(calls.every(c => c.table === "integration_actions")).toBe(true);
  });
});
