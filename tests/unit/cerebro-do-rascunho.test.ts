/**
 * O funcionário sem número responde no onboarding com o cérebro que a versão vai
 * usar quando o WhatsApp chegar: provedor/modelo do nascimento, credencial da
 * organização antes da chave da instalação.
 */
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/ai/credentials", () => ({
  loadCredential: async () => ({ apiKey: "chave-da-org" }),
}));

import { cerebroDoRascunho } from "@/lib/onboarding/cerebro-do-rascunho";

/** Cliente falso: cada tabela devolve o que o teste mandou, por `maybeSingle` ou como lista. */
function adminFalso(tabelas: Record<string, unknown>) {
  return {
    from(tabela: string) {
      const valor = tabelas[tabela] ?? null;
      const consulta: Record<string, unknown> = {};
      for (const m of ["select", "eq", "is", "not", "limit"]) consulta[m] = () => consulta;
      consulta.maybeSingle = async () => ({ data: valor, error: null });
      consulta.then = (ok: (v: unknown) => unknown) => ok({ data: valor, error: null });
      return consulta;
    },
  } as never;
}

afterEach(() => {
  delete process.env.GOOGLE_GENERATIVE_AI_API_KEY;
});

describe("cerebroDoRascunho", () => {
  it("usa o provedor e o modelo do nascimento com a chave da instalação", async () => {
    process.env.GOOGLE_GENERATIVE_AI_API_KEY = "chave-da-instalacao";
    const r = await cerebroDoRascunho(
      adminFalso({
        organizations: { settings: { llm: { provider: "google", default_model: "gemini-3.5-flash" } } },
      }),
      "org-1",
    );
    expect(r).toEqual({ provider: "google", model: "gemini-3.5-flash", apiKey: "chave-da-instalacao" });
  });

  it("sem modelo no nascimento, escolhe o curado do catálogo", async () => {
    process.env.GOOGLE_GENERATIVE_AI_API_KEY = "chave-da-instalacao";
    const r = await cerebroDoRascunho(
      adminFalso({
        organizations: { settings: { llm: { provider: "google" } } },
        ai_models: [
          { model_id: "gemini-2.5-flash-lite", is_default_for_provider: false, supports_tools: true },
          { model_id: "gemini-3.5-flash", is_default_for_provider: true, supports_tools: true },
        ],
      }),
      "org-1",
    );
    expect(r).toMatchObject({ model: "gemini-3.5-flash" });
  });

  it("a credencial validada da organização vence a chave da instalação", async () => {
    process.env.GOOGLE_GENERATIVE_AI_API_KEY = "chave-da-instalacao";
    const r = await cerebroDoRascunho(
      adminFalso({
        organizations: { settings: { llm: { provider: "google", default_model: "gemini-3.5-flash" } } },
        ai_provider_credentials: { id: "cred-1" },
      }),
      "org-1",
    );
    expect(r).toMatchObject({ apiKey: "chave-da-org" });
  });

  it("sem credencial e sem chave da instalação, explica em vez de inventar", async () => {
    const r = await cerebroDoRascunho(
      adminFalso({
        organizations: { settings: { llm: { provider: "google", default_model: "gemini-3.5-flash" } } },
      }),
      "org-1",
    );
    expect(r).toEqual({ erro: "esta instalação não tem chave de google" });
  });
});
