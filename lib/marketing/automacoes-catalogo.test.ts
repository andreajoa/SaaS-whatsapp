import { describe, expect, it } from "vitest";
import {
  automacoesPadrao,
  automacaoSchema,
  dataDeSaoPaulo,
  dataParaCampo,
  estaNaJanela,
  janelaSazonal,
  chaveDaCampanha,
  anoDeSaoPaulo,
} from "./automacoes-catalogo";

describe("calendário comercial do operador", () => {
  const agora = new Date("2026-10-11T12:00:00Z");
  it("novas automações são rascunhos, e a cobrança existente permanece habilitada", () => {
    const defaults = automacoesPadrao(agora);
    expect(defaults.filter((a) => a.enabled).map((a) => a.id)).toEqual(["pagamento-falhou"]);
    for (const a of defaults) expect(automacaoSchema.safeParse(a).success, a.id).toBe(true);
  });
  it("Black Friday 2026 termina no dia 27; Natal e Ano Novo seguem sem sobreposição", () => {
    const bf = janelaSazonal(2026, "black-friday"),
      natal = janelaSazonal(2026, "natal"),
      ano = janelaSazonal(2026, "ano-novo");
    expect(dataParaCampo(bf.ends_at, true)).toBe("2026-11-27");
    expect(bf.ends_at).toBe(natal.starts_at);
    expect(natal.ends_at).toBe(ano.starts_at);
    expect(dataParaCampo(ano.ends_at, true)).toBe("2027-01-01");
  });
  it("meia-noite de São Paulo é UTC03 e o último dia é inclusivo", () => {
    expect(dataDeSaoPaulo("2026-12-25")).toBe("2026-12-25T03:00:00.000Z");
    expect(dataDeSaoPaulo("2026-12-25", true)).toBe("2026-12-26T03:00:00.000Z");
    expect(() => dataDeSaoPaulo("2026-02-30")).toThrow();
  });
  it("não envia antes do início, depois do fim, ou enquanto estiver pausada", () => {
    const a = { ...automacoesPadrao(agora).find((a) => a.id === "natal")!, enabled: true };
    expect(estaNaJanela(a, new Date(a.starts_at!))).toBe(true);
    expect(estaNaJanela(a, new Date(new Date(a.ends_at!).getTime() - 1))).toBe(true);
    expect(estaNaJanela(a, new Date(a.ends_at!))).toBe(false);
    expect(estaNaJanela(a, new Date(new Date(a.starts_at!).getTime() - 1))).toBe(false);
    expect(estaNaJanela({ ...a, enabled: false }, new Date(a.starts_at!))).toBe(false);
  });
  it("Ano Novo guarda a identidade da campanha 2026 mesmo no dia primeiro de 2027", () => {
    const a = automacoesPadrao(agora).find((a) => a.id === "ano-novo")!;
    expect(chaveDaCampanha(a, null)).toBe("ano-novo#2026");
    expect(anoDeSaoPaulo(new Date("2027-01-01T01:00:00Z"))).toBe(2026);
    const signup = automacoesPadrao(agora).find((a) => a.id === "cadastro-sem-assinatura")!;
    expect(chaveDaCampanha(signup, "u-sintetico")).toBe("cadastro-sem-assinatura#u-sintetico");
  });
  it("não permite classificar publicidade como aviso de cobrança", () => {
    const a = automacoesPadrao(agora).find((a) => a.id === "black-friday")!;
    expect(automacaoSchema.safeParse({ ...a, audience: "transacional" }).success).toBe(false);
    const pagamento = automacoesPadrao(agora).find((a) => a.id === "pagamento-recebido")!;
    expect(automacaoSchema.safeParse({ ...pagamento, audience: "todos" }).success).toBe(false);
  });
  it("rejeita cabeçalho injetado e destino externo", () => {
    const a = automacoesPadrao(agora)[0]!;
    expect(
      automacaoSchema.safeParse({
        ...a,
        textos: {
          ...a.textos,
          "pt-BR": { ...a.textos["pt-BR"], assunto: "Assunto\r\nBcc: outro" },
        },
      }).success,
    ).toBe(false);
    expect(
      automacaoSchema.safeParse({
        ...a,
        textos: {
          ...a.textos,
          "pt-BR": {
            ...a.textos["pt-BR"],
            corpo: {
              ...a.textos["pt-BR"].corpo,
              acao: { rotulo: "Link", caminho: "//externo.test" },
            },
          },
        },
      }).success,
    ).toBe(false);
  });
});
