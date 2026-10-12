import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ provider: vi.fn(), registrar: vi.fn(), cookies: vi.fn() }));
vi.mock("next/headers", () => ({
  headers: vi.fn(async () => new Headers({ origin: "https://site.test" })),
  cookies: mocks.cookies,
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({ auth: { signUp: mocks.provider } })),
}));
vi.mock("@/lib/audit", () => ({ audit: vi.fn(), hashEmail: vi.fn(() => "hash-sintetico") }));
vi.mock("@/lib/auth/rate-limit", () => ({
  authRateLimited: vi.fn(async () => false),
  AUTH_LIMITS: { signup: { ip: 5 } },
}));
vi.mock("@/lib/marketing/funil", () => ({ registrarCadastroReal: mocks.registrar }));
vi.mock("@/lib/billing/planos", () => ({ instalacaoCobra: () => true }));
vi.mock("@/lib/mercado/visitante", () => ({
  COOKIE_DO_VISITANTE: "visitor",
  paisDosCabecalhos: () => null,
  idiomaDoVisitante: () => "pt-BR",
}));
vi.mock("@/lib/env", () => ({
  env: {
    NEXT_PUBLIC_APP_URL: "https://site.test",
    INTERNAL_SECRET: "segredo-sintetico-apenas-teste",
  },
}));
import { signUp } from "./signUp";
const input = {
  email: "conta-sintetica@example.test",
  password: "SenhaForte!2026",
  password_confirm: "SenhaForte!2026",
  org_name: "Empresa sintética",
};
beforeEach(() => {
  vi.clearAllMocks();
  mocks.cookies.mockResolvedValue({ get: () => ({ value: "visitor-sintetico" }) });
  mocks.registrar.mockResolvedValue(undefined);
});
describe("cadastro real alimenta CRM sem assumir consentimento", () => {
  it("novo usuário com identidade liga conta ao visitante", async () => {
    mocks.provider.mockResolvedValue({
      data: {
        user: { id: "user-sintetico", identities: [{ id: "identity-sintetica" }] },
        session: null,
      },
      error: null,
    });
    expect((await signUp(input)).ok).toBe(true);
    expect(mocks.registrar).toHaveBeenCalledWith({
      email: input.email,
      userId: "user-sintetico",
      visitorId: "visitor-sintetico",
    });
    expect(mocks.registrar.mock.calls[0]?.[0]).not.toHaveProperty("marketingOptIn");
  });
  it("identities vazio não cria lead falso, e mantém sucesso anti-enumeração", async () => {
    mocks.provider.mockResolvedValue({
      data: { user: { id: "ofuscado", identities: [] }, session: null },
      error: null,
    });
    expect(await signUp(input)).toEqual({ ok: true, sessao_ativa: false });
    expect(mocks.registrar).not.toHaveBeenCalled();
    expect(mocks.cookies).not.toHaveBeenCalled();
  });
  it("erro do provedor não registra cadastro", async () => {
    mocks.provider.mockResolvedValue({
      data: { user: null, session: null },
      error: { status: 429, message: "too many" },
    });
    expect((await signUp(input)).ok).toBe(false);
    expect(mocks.registrar).not.toHaveBeenCalled();
  });
});
