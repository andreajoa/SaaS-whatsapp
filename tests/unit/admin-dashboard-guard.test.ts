import { beforeEach, describe, expect, it, vi } from "vitest";
const guard = vi.hoisted(() => ({
  valido: false,
  habilitado: true,
  leitura: vi.fn(),
  admin: vi.fn(),
  marca: vi.fn(),
  cookie: "cookie-test",
}));
vi.mock("@/lib/painel/sessao", () => ({
  cookieVale: () => guard.valido,
  painelHabilitado: () => guard.habilitado,
  COOKIE_DO_PAINEL: "painel_funil",
}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: guard.admin }));
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => ({ value: guard.cookie }) }),
}));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("404");
  },
  redirect: vi.fn(),
}));
vi.mock("@/lib/branding/saida", () => ({ marcaDaSaida: guard.marca }));
vi.mock("@/components/painel/PortaDoPainel", () => ({ PortaDoPainel: () => null }));
vi.mock("@/components/painel/PainelDoDono", () => ({ PainelDoDono: () => null }));
beforeEach(() => {
  guard.valido = false;
  guard.habilitado = true;
  vi.clearAllMocks();
});
describe("painel: guard antes de qualquer leitura privilegiada", () => {
  it("o módulo de leitura recusa cookie inválido antes de criar service role", async () => {
    const { lerPainel } = await import("@/lib/painel/funil");
    await expect(lerPainel({ dias: 7, cookie: "forjado" })).rejects.toThrow(
      "Acesso ao painel recusado",
    );
    expect(guard.admin).not.toHaveBeenCalled();
  });
  it("a página sem senha é 404 e não toca banco nem branding", async () => {
    guard.habilitado = false;
    const { default: Page } = await import("@/app/dashboard/page");
    await expect(Page({ searchParams: Promise.resolve({}) })).rejects.toThrow("404");
    expect(guard.admin).not.toHaveBeenCalled();
    expect(guard.marca).not.toHaveBeenCalled();
  });
  it("a página sem cookie válido retorna a porta, sem leitura de clientes", async () => {
    const { default: Page } = await import("@/app/dashboard/page");
    await Page({ searchParams: Promise.resolve({ dias: "90" }) });
    expect(guard.admin).not.toHaveBeenCalled();
    expect(guard.marca).not.toHaveBeenCalled();
  });
});
