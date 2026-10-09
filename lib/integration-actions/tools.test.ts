import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { McpContext } from "@/lib/mcp/types";
import type { McpAuthResult } from "@/lib/mcp/auth";
import { createIntegrationActionTools, getIntegrationActionDefinitions, integrationActionIdsFromToolIds, integrationActionToolName } from "./tools";
import { actionConfigSchema } from "./schema";
import type { executeAction } from "./service";

const executed = vi.hoisted(() => vi.fn<(...args: Parameters<typeof executeAction>) => Promise<{ success: boolean }>>(async () => ({ success: true })));
vi.mock("@/lib/integration-actions/service", () => ({ executeAction: executed, ACTION_COLUMNS: "id, organization_id, configuration, credential_header_names, created_at, updated_at" }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));
const org = "a2440000-0000-4000-8000-000000000001";
const id = "a2440000-0000-4000-8000-000000000002";
function config(mutating = false) { return actionConfigSchema.parse({ name: "Consulta", description: "Consulta pedido na loja", method: mutating ? "POST" : "GET", mutating, enabled: true, url_template: "https://api.vendor.com/orders", input_schema: { type: "object", properties: { order_id: { type: "string" } }, required: ["order_id"], additionalProperties: false } }); }
function fixture(mutating = false, enabled = true) {
  const configuration = config(mutating); configuration.enabled = enabled;
  const query = { select: vi.fn(() => query), eq: vi.fn(() => query), in: vi.fn(() => query), limit: vi.fn(async () => ({ data: [{ id, organization_id: org, configuration }], error: null })) };
  const db = { from: vi.fn(() => query) } as unknown as SupabaseClient;
  const ctx: McpContext = { organizationId: org, role: "manager", actor: { type: "user", id: "a2440000-0000-4000-8000-000000000003" }, apiTokenId: "token", requestId: "req", supabase: db };
  const auth: McpAuthResult = { organizationId: org, role: "manager", actor: ctx.actor, apiTokenId: "token", scopes: ["mcp:read", "mcp:write"] };
  return { db, query, ctx, auth };
}
beforeEach(() => { executed.mockClear(); });
describe("fábrica de ferramentas REST", () => {
  it("encaminha agentId/versionId confiáveis ao serviço sem aceitar identidade do modelo", async () => {
    const f = fixture();
    const agentAuthorization = { agentId: "trusted-agent", versionId: "trusted-version" };
    const tools = await createIntegrationActionTools({ ...f, actionIds: [id], agentAuthorization });
    await tools[integrationActionToolName(id)]!.execute!({ inputs: { order_id: "123" } }, { toolCallId: "call", messages: [], context: {} });
    expect(executed).toHaveBeenCalledWith(f.db, expect.anything(), expect.objectContaining({ agentAuthorization, authorizeBeforeDispatch: expect.any(Function) }));
    await expect(tools[integrationActionToolName(id)]!.execute!({ inputs: { order_id: "123" }, agentAuthorization: { agentId: "attacker" } }, { toolCallId: "call", messages: [], context: {} })).rejects.toThrow();
    expect(executed).toHaveBeenCalledTimes(1);
  });
  it.each(["scope", "role", "tenant", "readonly", "seleção"])("guarda encaminhada ao serviço revalida %s no despacho", async reason => {
    const f = fixture(true);
    const actionIds = [id];
    const input = { ...f, actionIds, readOnly: false };
    const tools = await createIntegrationActionTools(input);
    executed.mockImplementationOnce(async (_db, _ctx, execution) => {
      if (reason === "scope") f.auth.scopes = ["mcp:read"];
      if (reason === "role") f.auth.role = "agent";
      if (reason === "tenant") f.ctx.organizationId = "other";
      if (reason === "readonly") input.readOnly = true;
      if (reason === "seleção") actionIds.splice(0);
      await execution.authorizeBeforeDispatch!();
      return { success: true };
    });
    await expect(tools[integrationActionToolName(id)]!.execute!({ inputs: { order_id: "123" }, confirm_mutation: true }, { toolCallId: "call", messages: [], context: {} })).rejects.toThrow();
  });
  it("ids vazios habilitam nenhuma ferramenta e não consultam DB", async () => {
    const { db } = fixture(); expect(await getIntegrationActionDefinitions(db, org, [])).toEqual([]); expect(db.from).not.toHaveBeenCalled();
  });
  it("consulta só allowlist da organização e não executa ao carregar", async () => {
    const { db, query } = fixture(); const defs = await getIntegrationActionDefinitions(db, org, [id]);
    expect(query.eq).toHaveBeenCalledWith("organization_id", org); expect(query.in).toHaveBeenCalledWith("id", [id]);
    expect(defs[0]).toMatchObject({ name: integrationActionToolName(id), category: "read", requiresRole: "agent", requiresScope: "mcp:read" }); expect(executed).not.toHaveBeenCalled();
  });
  it("mutação declara write/ai_operator e exige confirmação explícita", async () => {
    const { db } = fixture(true); const defs = await getIntegrationActionDefinitions(db, org, [id]);
    expect(defs[0]).toMatchObject({ category: "write", requiresRole: "ai_operator", requiresScope: "mcp:write" });
    expect(z.safeParse(defs[0]!.inputSchema.confirm_mutation!, false).success).toBe(false);
  });
  it("preview e ação pausada não expõem mutações", async () => {
    const { db } = fixture(true); expect(await getIntegrationActionDefinitions(db, org, [id], {}, { readOnly: true })).toEqual([]);
    expect(await getIntegrationActionDefinitions(fixture(false, false).db, org, [id])).toEqual([]);
  });
  it("token sem scope write não recebe ferramentas de mutação", async () => {
    const f = fixture(true); f.auth.scopes = ["mcp:read"];
    expect(await createIntegrationActionTools({ ...f, actionIds: [id] })).toEqual({});
  });
  it("recusa divergência entre autenticação e tenant do contexto", async () => {
    const f = fixture(); f.auth.organizationId = "another-tenant";
    await expect(createIntegrationActionTools({ ...f, actionIds: [id] })).rejects.toThrow(); expect(f.db.from).not.toHaveBeenCalled();
  });
  it("handler usa tenant autenticado, id fixo e contexto confiável", async () => {
    const f = fixture(); const [def] = await getIntegrationActionDefinitions(f.db, org, [id], { lead_id: "trusted-lead" }, { readOnly: true });
    await def!.handler({ inputs: { order_id: "123" } }, f.ctx);
    expect(executed).toHaveBeenCalledWith(f.db, expect.objectContaining({ organizationId: org }), expect.objectContaining({ id, contextVariables: { lead_id: "trusted-lead" }, readOnly: true, source: "agent" }));
    await expect(def!.handler({ inputs: {} }, { ...f.ctx, organizationId: "attacker" })).rejects.toThrow();
    expect(executed).toHaveBeenCalledTimes(1);
  });
  it("nomes estáveis podem ser extraídos sem permitir IDs inválidos", () => {
    expect(integrationActionIdsFromToolIds([integrationActionToolName(id), "crm_get_lead", "integration_action_bad", integrationActionToolName(id)])).toEqual([id]);
  });
});
