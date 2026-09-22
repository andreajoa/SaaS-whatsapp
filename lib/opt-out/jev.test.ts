import { describe, expect, it, vi } from "vitest";

import { LIMIAR_DE_BLOQUEIO, merecePerguntarAoJev, probabilidadeDeOptOut } from "./jev";

function respostaDoJev(noul: unknown, status = 200): Response {
  return new Response(
    JSON.stringify({ answers: { quer_parar_de_receber: { type: "noul", noul } } }),
    { status, headers: { "Content-Type": "application/json" } },
  );
}

describe("merecePerguntarAoJev — o filtro de custo antes da rede", () => {
  it.each([
    "não quero mais receber essas mensagens",
    "para de me encher com isso",
    "tem como parar a dor?", // o Jev é quem separa esta — por isso ela PRECISA chegar lá
    "me tira dessa lista por favor",
    "vocês estão me incomodando",
    "ya no me escriban",
  ])("frase com pista vai ao Jev: %s", (texto) => {
    expect(merecePerguntarAoJev(texto)).toBe(true);
  });

  it.each([
    "SAIR", // palavra solta é do portão determinístico — o Jev empaca em ~0.77 nela
    "bom dia, tudo bem?",
    "manda o preço para mim",
    "quero agendar para amanhã",
    "",
  ])("não vai ao Jev: %s", (texto) => {
    expect(merecePerguntarAoJev(texto)).toBe(false);
  });

  it("nulo e vazio não vão", () => {
    expect(merecePerguntarAoJev(null)).toBe(false);
    expect(merecePerguntarAoJev(undefined)).toBe(false);
  });
});

describe("probabilidadeDeOptOut — nunca lança, e falha para o lado de não bloquear", () => {
  const env = { OPENROUTER_API_KEY: "chave-de-teste" };

  it("⭐ devolve a probabilidade que o Jev calibrou", async () => {
    const fetch = vi.fn(async () => respostaDoJev(0.98));
    await expect(probabilidadeDeOptOut("me tira da lista", { fetch, env })).resolves.toBe(0.98);
  });

  it("sem chave nenhuma: null, e nem chega a chamar a rede", async () => {
    const fetch = vi.fn();
    await expect(probabilidadeDeOptOut("me tira da lista", { fetch, env: {} })).resolves.toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("a chave nativa da TypeSafe vence a da OpenRouter", async () => {
    const fetch = vi.fn(async () => respostaDoJev(0.5));
    await probabilidadeDeOptOut("x y", { fetch, env: { ...env, TYPESAFE_API_KEY: "nativa" } });
    expect(fetch.mock.calls[0]?.[0]).toBe("https://api.typesafe.ai/v1/systemone");
  });

  it.each([
    ["HTTP de erro", () => respostaDoJev(0.99, 429)],
    ["rede caída", () => Promise.reject(new Error("ECONNRESET"))],
    ["probabilidade fora de [0,1]", () => respostaDoJev(1.7)],
    ["resposta sem a pergunta", () => new Response("{}", { status: 200 })],
  ])("%s: null — nunca um bloqueio", async (_caso, gerar) => {
    const fetch = vi.fn(gerar) as unknown as typeof globalThis.fetch;
    await expect(probabilidadeDeOptOut("me tira da lista", { fetch, env })).resolves.toBeNull();
  });

  it("o limiar mora no meio do vão medido (0.56 … 0.82)", () => {
    expect(LIMIAR_DE_BLOQUEIO).toBeGreaterThan(0.56);
    expect(LIMIAR_DE_BLOQUEIO).toBeLessThan(0.82);
  });
});
