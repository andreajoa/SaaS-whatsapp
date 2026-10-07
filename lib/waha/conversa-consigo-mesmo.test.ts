import { describe, expect, it } from "vitest";

import { ehChatConsigoMesmo, testeConsigoMesmoLigado } from "./conversa-consigo-mesmo";

// Forma real, medida no Atenza online em 07/10/2026 (NOWEB 2026.7.2).
const EU = { id: "5511992598585@c.us", lid: "68543399907471@lid" };

describe("ehChatConsigoMesmo", () => {
  it("reconhece o chat consigo mesmo pelo próprio @lid", () => {
    expect(ehChatConsigoMesmo(["68543399907471@lid"], EU)).toBe(true);
  });
  it("reconhece pelo telefone em remoteJidAlt", () => {
    expect(ehChatConsigoMesmo([null, "5511992598585@s.whatsapp.net"], EU)).toBe(true);
  });
  it("cliente comum não é o chat consigo mesmo", () => {
    expect(ehChatConsigoMesmo(["5511988887777@c.us", "99999999999999@lid"], EU)).toBe(false);
  });
  it("grupo nunca é o chat consigo mesmo", () => {
    expect(ehChatConsigoMesmo(["5511992598585@g.us"], EU)).toBe(false);
  });
  it("sem `me` no envelope não há como saber: não promove", () => {
    expect(ehChatConsigoMesmo(["68543399907471@lid"], null)).toBe(false);
  });
});

describe("testeConsigoMesmoLigado", () => {
  it("desligado quando a chave não existe", () => {
    expect(testeConsigoMesmoLigado({})).toBe(false);
    expect(testeConsigoMesmoLigado(null)).toBe(false);
  });
  it("só `true` liga — string não liga", () => {
    expect(testeConsigoMesmoLigado({ teste_consigo_mesmo: true })).toBe(true);
    expect(testeConsigoMesmoLigado({ teste_consigo_mesmo: "true" })).toBe(false);
  });
});
