import { beforeEach, describe, expect, it, vi } from "vitest";
import { fail } from "@/lib/api/wrappers";
import { GET, POST } from "./route";
import { POST as execute } from "./[id]/execute/route";
import { POST as testAction } from "./[id]/test/route";
import { readJson } from "./_http";

const mocks = vi.hoisted(() => ({ auth: vi.fn(), support: vi.fn(), admin: vi.fn(), list: vi.fn(), save: vi.fn(), execute: vi.fn() }));
vi.mock("@/lib/auth/require-role", () => ({ requireRole: mocks.auth }));
vi.mock("@/lib/impersonate/support", () => ({ requireSupportWrite: mocks.support }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: mocks.admin }));
vi.mock("@/lib/integration-actions/service", () => ({ listActions: mocks.list, saveAction: mocks.save, executeAction: mocks.execute }));
const id = "a2440000-0000-4000-8000-000000000002";
const org = "a2440000-0000-4000-8000-000000000001";
const params = () => ({ params: Promise.resolve({ id }) });
const request = (body: unknown) => new Request("https://crm.vendor.com/api/v1/integration-actions", { method: "POST", body: JSON.stringify(body), headers: { "Content-Type": "application/json" } });
beforeEach(() => {
  vi.clearAllMocks();
  mocks.auth.mockResolvedValue({ ok: true, user: { id: "actor", support: null }, org: { orgId: org, role: "manager" } });
  mocks.support.mockResolvedValue(null); mocks.admin.mockReturnValue({});
  mocks.list.mockResolvedValue([]); mocks.execute.mockResolvedValue({ success: true });
});
describe("REST: sessão, permissões e limite de entrada", () => {
  it("listagem usa guard manager e tenant da sessão", async () => {
    expect((await GET()).status).toBe(200);
    expect(mocks.auth).toHaveBeenCalledWith("manager", expect.objectContaining({ resource: "integration_actions" }));
    expect(mocks.list).toHaveBeenCalledWith({}, expect.objectContaining({ organizationId: org, actorUserId: "actor" }));
  });
  it("sem autenticação não cria cliente admin nem lê body", async () => {
    mocks.auth.mockResolvedValue({ ok: false, response: fail("unauthenticated", "Auth required.", 401) });
    expect((await POST(request({ credential_headers: { Authorization: "Bearer private" } }))).status).toBe(401);
    expect(mocks.admin).not.toHaveBeenCalled(); expect(mocks.save).not.toHaveBeenCalled();
  });
  it("acompanhamento readonly bloqueia teste e execução antes do cliente admin", async () => {
    mocks.support.mockResolvedValue(fail("forbidden", "Somente leitura.", 403));
    expect((await execute(request({ inputs: {} }), params())).status).toBe(403);
    expect((await testAction(request({ inputs: {} }), params())).status).toBe(403);
    expect(mocks.admin).not.toHaveBeenCalled(); expect(mocks.execute).not.toHaveBeenCalled();
  });
  it("execute usa agent, teste manager; nenhuma execução aceita tenant do body", async () => {
    expect((await execute(request({ inputs: {}, organization_id: "other-org" }), params())).status).toBe(400);
    expect(mocks.execute).not.toHaveBeenCalled();
    expect((await execute(request({ inputs: {} }), params())).status).toBe(200);
    expect(mocks.auth).toHaveBeenLastCalledWith("agent", expect.any(Object));
    expect(mocks.execute).toHaveBeenCalledWith({}, expect.objectContaining({ organizationId: org }), expect.objectContaining({ id, source: "manual", confirmMutation: false }));
    expect((await testAction(request({ inputs: {} }), params())).status).toBe(200);
    expect(mocks.auth).toHaveBeenLastCalledWith("manager", expect.any(Object));
  });
  it("erro de banco não vaza conteúdo de credencial", async () => {
    mocks.list.mockRejectedValue(new Error("database error Bearer leaked-secret"));
    const result = await GET(); expect(result.status).toBe(503); expect(await result.text()).not.toContain("leaked-secret");
  });
  it("limita leitura em streaming e recusa JSON inválido", async () => {
    await expect(readJson(request({ padding: "x".repeat(99000) }))).rejects.toMatchObject({ code: "request_too_large", status: 413 });
    await expect(readJson(new Request("https://crm.vendor.com", { method: "POST", body: "{invalid" }))).rejects.toMatchObject({ code: "invalid_request" });
  });
});
