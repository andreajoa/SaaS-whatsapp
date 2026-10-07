import { describe, expect, it } from "vitest";

import { clienteFalouPorUltimo } from "./atendimento-externo";

describe("clienteFalouPorUltimo", () => {
  it("cliente escreveu e nunca foi respondido", () => {
    expect(clienteFalouPorUltimo({ last_inbound_at: "2026-10-07T10:00:00Z", last_outbound_at: null })).toBe(true);
  });
  it("cliente escreveu depois da última resposta", () => {
    expect(
      clienteFalouPorUltimo({ last_inbound_at: "2026-10-07T10:05:00Z", last_outbound_at: "2026-10-07T10:00:00Z" }),
    ).toBe(true);
  });
  it("empresa respondeu por último: não está esperando", () => {
    expect(
      clienteFalouPorUltimo({ last_inbound_at: "2026-10-07T10:00:00Z", last_outbound_at: "2026-10-07T10:01:00Z" }),
    ).toBe(false);
  });
  it("conversa sem mensagem do cliente não entra", () => {
    expect(clienteFalouPorUltimo({ last_inbound_at: null, last_outbound_at: "2026-10-07T10:01:00Z" })).toBe(false);
  });
});
