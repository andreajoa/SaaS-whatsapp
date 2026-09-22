import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * A escada de chaves do embedding, nos degraus da INSTALAÇÃO.
 *
 * O banco responde vazio (sem binding no painel, sem credencial OpenAI da
 * organização): o que se mede aqui é a ordem entre gateway, OpenRouter e
 * `OPENAI_API_KEY` — a parte que decide se a base de conhecimento indexa
 * alguma coisa numa instalação que só tem uma dessas chaves.
 */

const ambiente: Record<string, string> = {};

vi.mock("@/lib/env", () => ({ env: new Proxy({}, { get: (_t, k: string) => ambiente[k] ?? "" }) }));
vi.mock("@/lib/logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
vi.mock("@/lib/supabase/admin", () => {
  // Builder encadeável do PostgREST que sempre devolve "nada encontrado".
  const vazio = { data: null, error: null };
  const cadeia: Record<string, unknown> = new Proxy(
    {},
    {
      get(_t, prop) {
        if (prop === "then") return (resolve: (v: unknown) => void) => resolve(vazio);
        if (prop === "maybeSingle") return async () => vazio;
        return () => cadeia;
      },
    },
  );
  return { createAdminClient: () => cadeia };
});

import { resolverChaveDeEmbedding } from "./chave";

const ORG = "00000000-0000-4000-8000-000000000001";

beforeEach(() => {
  for (const k of Object.keys(ambiente)) delete ambiente[k];
});

describe("resolverChaveDeEmbedding — degraus da instalação", () => {
  it("⭐ só a OpenRouter: ela indexa, pelo endpoint compatível com a OpenAI", async () => {
    ambiente.OPENROUTER_API_KEY = "or-chave";
    await expect(resolverChaveDeEmbedding(ORG)).resolves.toMatchObject({
      apiKey: "or-chave",
      baseUrl: "https://openrouter.ai/api/v1",
      viaGateway: false,
      origem: "openrouter_da_instalacao",
    });
  });

  it("OPENROUTER_BASE_URL preenchida vence o endpoint padrão", async () => {
    ambiente.OPENROUTER_API_KEY = "or-chave";
    ambiente.OPENROUTER_BASE_URL = "https://proxy.exemplo/v1";
    await expect(resolverChaveDeEmbedding(ORG)).resolves.toMatchObject({
      baseUrl: "https://proxy.exemplo/v1",
    });
  });

  it("o gateway vem antes da OpenRouter", async () => {
    ambiente.AI_GATEWAY_API_KEY = "gw";
    ambiente.OPENROUTER_API_KEY = "or-chave";
    await expect(resolverChaveDeEmbedding(ORG)).resolves.toMatchObject({
      viaGateway: true,
      origem: "gateway_da_instalacao",
    });
  });

  it("a OpenRouter vem antes da OPENAI_API_KEY", async () => {
    ambiente.OPENROUTER_API_KEY = "or-chave";
    ambiente.OPENAI_API_KEY = "sk-openai";
    await expect(resolverChaveDeEmbedding(ORG)).resolves.toMatchObject({
      origem: "openrouter_da_instalacao",
    });
  });

  it("só a OPENAI_API_KEY: nada muda para quem instalou assim", async () => {
    ambiente.OPENAI_API_KEY = "sk-openai";
    await expect(resolverChaveDeEmbedding(ORG)).resolves.toMatchObject({
      apiKey: "sk-openai",
      baseUrl: null,
      origem: "chave_da_instalacao",
    });
  });

  it("nenhuma chave: null — um estado que a tela mostra, não uma exceção", async () => {
    await expect(resolverChaveDeEmbedding(ORG)).resolves.toBeNull();
  });
});
