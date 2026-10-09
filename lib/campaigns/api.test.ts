import { beforeEach, describe, expect, it, vi } from "vitest";
import { fail, ok } from "@/lib/api/wrappers";
import { campaignApi } from "./api";

const guards = vi.hoisted(() => ({ auth:vi.fn(), support:vi.fn() }));
vi.mock("@/lib/auth/require-role", () => ({ requireRole:guards.auth }));
vi.mock("@/lib/impersonate/support", () => ({ requireSupportWrite:guards.support }));
beforeEach(() => {
  vi.clearAllMocks();
  guards.auth.mockResolvedValue({ ok:true, org:{orgId:"session-org"}, user:{id:"actor",support:null} });
  guards.support.mockResolvedValue(null);
});
describe("fronteira HTTP de campanhas", () => {
  it("sessão ausente impede efeitos e nem consulta suporte", async () => {
    guards.auth.mockResolvedValue({ ok:false,response:fail("unauthenticated","Sessão necessária.",401) });
    const effect=vi.fn();
    expect((await campaignApi(true,effect)).status).toBe(401);
    expect(effect).not.toHaveBeenCalled();
    expect(guards.support).not.toHaveBeenCalled();
  });
  it("suporte somente leitura bloqueia antes de executar o efeito", async () => {
    guards.support.mockResolvedValue(fail("forbidden","Somente leitura.",403));
    const effect=vi.fn();
    expect((await campaignApi(true,effect)).status).toBe(403);
    expect(effect).not.toHaveBeenCalled();
    expect(guards.support).toHaveBeenCalledWith("session-org");
  });
  it("escrita usa papel manager e organização resolvida da sessão", async () => {
    const effect=vi.fn(async () => ok({saved:true}));
    expect((await campaignApi(true,effect)).status).toBe(200);
    expect(guards.auth).toHaveBeenCalledWith("manager",expect.any(Object));
    expect(effect).toHaveBeenCalledWith(expect.objectContaining({organizationId:"session-org",actorUserId:"actor"}));
  });
  it("acompanhamento viewer continua disponível sem autorizar escrita", async () => {
    const read=vi.fn(async () => ok([]));
    expect((await campaignApi(false,read)).status).toBe(200);
    expect(guards.auth).toHaveBeenCalledWith("viewer",expect.any(Object));
    expect(guards.support).not.toHaveBeenCalled();
  });
});
