import { describe, expect, it } from "vitest";

import { montarInstrucoes } from "./configuracao";

describe("montarInstrucoes", () => {
  it("leva negócio, preços e perguntas frequentes para as instruções", () => {
    const p = montarInstrucoes({
      negocio: "Agência Exemplo",
      o_que_faz: "cria sites para pequenos negócios",
      servicos_e_precos: "Site institucional: R$ 1.500, prazo 7 dias",
      perguntas_frequentes: [{ pergunta: "Tem hospedagem?", resposta: "Sim, 1 ano incluso." }],
    });
    expect(p).toContain("Agência Exemplo, que é: cria sites para pequenos negócios");
    expect(p).toContain("R$ 1.500");
    expect(p).toContain("P: Tem hospedagem?\nR: Sim, 1 ano incluso.");
  });

  it("sempre proíbe inventar preço", () => {
    expect(montarInstrucoes({ negocio: "X" })).toMatch(/nunca invente valor/);
  });

  it("omite seções vazias", () => {
    const p = montarInstrucoes({ negocio: "X", servicos_e_precos: "   " });
    expect(p).not.toContain("## Serviços e preços");
  });
});
