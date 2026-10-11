import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({
  cookies: vi.fn(),
  headers: vi.fn(),
  cookieVale: vi.fn(),
  painelHabilitado: vi.fn(),
  admin: vi.fn(),
  audit: vi.fn(),
  upsert: vi.fn(),
  revalidate: vi.fn(),
  ler: vi.fn(),
}));
vi.mock("next/headers", () => ({ cookies: mocks.cookies, headers: mocks.headers }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
vi.mock("@/lib/env", () => ({ env: { NEXT_PUBLIC_APP_URL: "https://site.test" } }));
vi.mock("@/lib/painel/sessao", () => ({
  COOKIE_DO_PAINEL: "painel_funil",
  cookieVale: mocks.cookieVale,
  painelHabilitado: mocks.painelHabilitado,
}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: mocks.admin }));
vi.mock("@/lib/audit", () => ({ audit: mocks.audit }));
vi.mock("@/lib/branding/saida", () => ({ marcaDaSaida: vi.fn(async () => ({ nome: "Marca" })) }));
vi.mock("@/lib/marketing/automacoes", () => ({ lerAutomacoes: mocks.ler }));
vi.mock("@/lib/marketing/molde", () => ({
  montarEmail: vi.fn(() => ({ html: "<p>Prévia</p>" })),
  montarEmailTransacional: vi.fn(() => ({ html: "<p>Aviso</p>" })),
}));
import { editarAutomacao } from "./actions";
import { automacoesPadrao, type Automacao } from "@/lib/marketing/automacoes-catalogo";
function form(a: Automacao, modo = "salvar") {
  const f = new FormData();
  f.set("automacao", JSON.stringify(a));
  f.set("modo", modo);
  return f;
}
const initial = { ok: false, mensagem: "" };
beforeEach(() => {
  vi.clearAllMocks();
  mocks.cookies.mockResolvedValue({ get: () => ({ value: "cookie-sintetico" }) });
  mocks.headers.mockResolvedValue(new Headers({ origin: "https://site.test" }));
  mocks.cookieVale.mockReturnValue(true);
  mocks.painelHabilitado.mockReturnValue(true);
  mocks.admin.mockReturnValue({ from: () => ({ upsert: mocks.upsert }) });
  mocks.upsert.mockResolvedValue({ error: null });
  mocks.ler.mockResolvedValue({ automacoes: [], semBanco: false });
});
describe("editor exclusivo do operador", () => {
  it("cookie ausente/forjado não chega ao banco", async () => {
    mocks.cookieVale.mockReturnValue(false);
    expect((await editarAutomacao(initial, form(automacoesPadrao()[0]!))).ok).toBe(false);
    expect(mocks.admin).not.toHaveBeenCalled();
  });
  it("origem externa e requisição sem Origin não podem salvar", async () => {
    for (const origin of ["https://externo.test", ""]) {
      mocks.headers.mockResolvedValue(new Headers(origin ? { origin } : {}));
      expect((await editarAutomacao(initial, form(automacoesPadrao()[0]!))).ok).toBe(false);
    }
    expect(mocks.admin).not.toHaveBeenCalled();
  });
  it("prévia renderiza sem gravar nem ativar", async () => {
    const r = await editarAutomacao(initial, form(automacoesPadrao()[0]!, "preview"));
    expect(r.preview).toBe("<p>Aviso</p>");
    expect(mocks.admin).not.toHaveBeenCalled();
  });
  it("salvar rascunho persiste enabled false mesmo quando input vem true", async () => {
    const a = { ...automacoesPadrao()[0]!, enabled: true };
    const r = await editarAutomacao(initial, form(a));
    expect(r.ok).toBe(true);
    expect(mocks.upsert).toHaveBeenCalledWith(expect.objectContaining({ enabled: false }), {
      onConflict: "id",
    });
    expect(mocks.audit).toHaveBeenCalled();
  });
  it("ativar janela vencida não grava", async () => {
    const a = automacoesPadrao(new Date("2020-01-01T12:00:00Z")).find((a) => a.id === "natal")!;
    expect((await editarAutomacao(initial, form(a, "ativar"))).ok).toBe(false);
    expect(mocks.admin).not.toHaveBeenCalled();
  });
  it("ativação explícita salva e audita; janela sobreposta recusa", async () => {
    const a = automacoesPadrao(new Date("2030-01-01T12:00:00Z")).find((a) => a.id === "natal")!;
    expect((await editarAutomacao(initial, form(a, "ativar"))).ok).toBe(true);
    expect(mocks.upsert).toHaveBeenCalledWith(expect.objectContaining({ enabled: true }), {
      onConflict: "id",
    });
    mocks.upsert.mockClear();
    mocks.ler.mockResolvedValue({
      automacoes: [{ ...a, id: "black-friday", enabled: true }],
      semBanco: false,
    });
    expect((await editarAutomacao(initial, form(a, "ativar"))).ok).toBe(false);
    expect(mocks.upsert).not.toHaveBeenCalled();
  });
});
