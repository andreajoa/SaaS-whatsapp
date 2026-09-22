import { describe, expect, it } from "vitest";

import { llmDeNascimento } from "./llm-de-nascimento";

describe("llmDeNascimento — o provedor com que a organização nasce", () => {
  it("⭐ instalação em OpenRouter: provedor e modelo viajam juntos", () => {
    expect(
      llmDeNascimento({ AI_PROVIDER: "openrouter", AI_DEFAULT_MODEL: "nvidia/nemotron-3-ultra-550b-a55b:free" }),
    ).toEqual({ provider: "openrouter", default_model: "nvidia/nemotron-3-ultra-550b-a55b:free" });
  });

  it("⭐ só o provedor, sem modelo: nada — o trigger sobrescreveria o provedor com anthropic", () => {
    expect(llmDeNascimento({ AI_PROVIDER: "openrouter" })).toBeNull();
    expect(llmDeNascimento({ AI_PROVIDER: "openrouter", AI_DEFAULT_MODEL: "   " })).toBeNull();
  });

  it("sem escolha nenhuma: a organização nasce como sempre nasceu", () => {
    expect(llmDeNascimento({})).toBeNull();
    expect(llmDeNascimento({ AI_DEFAULT_MODEL: "qualquer/modelo" })).toBeNull();
  });

  it("anthropic é o que o trigger já grava — não há o que escrever", () => {
    expect(llmDeNascimento({ AI_PROVIDER: "anthropic", AI_DEFAULT_MODEL: "claude-haiku-4-5" })).toBeNull();
  });

  it("normaliza o que vem de um .env escrito à mão", () => {
    expect(llmDeNascimento({ AI_PROVIDER: " OpenRouter ", AI_DEFAULT_MODEL: " a/b " })).toEqual({
      provider: "openrouter",
      default_model: "a/b",
    });
  });
});
