import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";

import { aplicarEvento, assinaturaResendValida, type LinhaDeEnvio } from "./eventos-resend";

const segredoCru = Buffer.from("segredo-de-teste-com-32-bytes!!!");
const segredo = `whsec_${segredoCru.toString("base64")}`;
const assinar = (id: string, ts: string, corpo: string) =>
  `v1,${createHmac("sha256", segredoCru).update(`${id}.${ts}.${corpo}`).digest("base64")}`;

const linha: LinhaDeEnvio = {
  status: "enviado",
  entregue_em: null,
  aberto_em: null,
  clicado_em: null,
  aberturas: 0,
  cliques: 0,
  erro: null,
};

describe("assinatura do webhook do Resend (Svix)", () => {
  const corpo = '{"type":"email.opened"}';
  it("aceita a assinatura certa, inclusive entre várias", () => {
    const ts = "1791700000";
    const h = { id: "msg_1", timestamp: ts, assinatura: `v1,xxx ${assinar("msg_1", ts, corpo)}` };
    expect(assinaturaResendValida(corpo, h, segredo, 1791700010)).toBe(true);
  });
  it("recusa corpo alterado, timestamp velho e segredo vazio", () => {
    const ts = "1791700000";
    const h = { id: "msg_1", timestamp: ts, assinatura: assinar("msg_1", ts, corpo) };
    expect(assinaturaResendValida(`${corpo} `, h, segredo, 1791700010)).toBe(false);
    expect(assinaturaResendValida(corpo, h, segredo, 1791700000 + 301)).toBe(false);
    expect(assinaturaResendValida(corpo, h, "", 1791700010)).toBe(false);
  });
});

describe("evento → linha de email_envios", () => {
  it("abertura marca entregue e aberto e conta", () => {
    expect(aplicarEvento(linha, "email.opened", { created_at: "T1" })).toEqual({
      status: "aberto",
      entregue_em: "T1",
      aberto_em: "T1",
      aberturas: 1,
    });
  });
  it("entrega atrasada não rebaixa quem já clicou", () => {
    const r = aplicarEvento({ ...linha, status: "clicado" }, "email.delivered", {
      created_at: "T",
    });
    expect(r?.status).toBe("clicado");
  });
  it("bounce permanente bloqueia; temporário só anota", () => {
    expect(aplicarEvento(linha, "email.bounced", { bounce: { type: "Permanent" } })?.status).toBe(
      "bounce",
    );
    const t = aplicarEvento(linha, "email.bounced", {
      bounce: { type: "Transient", message: "cheia" },
    });
    expect(t).not.toHaveProperty("status");
    expect(t?.erro).toContain("bounce_temporario");
  });
  it("reclamação bloqueia, e clique depois de bounce não desbloqueia", () => {
    expect(aplicarEvento(linha, "email.complained", {})?.status).toBe("reclamou");
    expect(aplicarEvento({ ...linha, status: "bounce" }, "email.clicked", {})?.status).toBe(
      "bounce",
    );
  });
  it("evento desconhecido não mexe em nada", () => {
    expect(aplicarEvento(linha, "email.sent", {})).toBeNull();
  });
});
