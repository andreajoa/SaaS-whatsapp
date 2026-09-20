/**
 * A verificação do webhook do Stripe.
 *
 * É o único lugar deste produto onde um POST de terceiro, sem sessão nenhuma,
 * muda quem tem acesso ao sistema. Se `verificarWebhook` aceitar o que não
 * devia, qualquer pessoa na internet liga `status=active` para a organização
 * que quiser com um curl. Cada caso abaixo é uma forma de tentar.
 */
import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";

import { formEncode, verificarWebhook } from "@/lib/billing/stripe";

const SEGREDO = "whsec_teste_nunca_usado_em_producao";
const AGORA = 1_700_000_000;

function corpoDe(id = "evt_1", tipo = "invoice.paid"): string {
  return JSON.stringify({ id, type: tipo, data: { object: { id: "sub_1" } } });
}

function assinar(corpo: string, segredo = SEGREDO, t = AGORA): string {
  const v1 = createHmac("sha256", segredo).update(`${t}.${corpo}`, "utf8").digest("hex");
  return `t=${t},v1=${v1}`;
}

describe("verificarWebhook", () => {
  it("aceita a entrega legítima e devolve o evento", () => {
    const corpo = corpoDe();
    const r = verificarWebhook(corpo, assinar(corpo), SEGREDO, AGORA);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.evento.id).toBe("evt_1");
      expect(r.evento.type).toBe("invoice.paid");
    }
  });

  it("recusa quando o CORPO foi trocado depois de assinado", () => {
    // O ataque óbvio: pegar uma entrega real (a assinatura é válida) e trocar
    // o `organization_id` de dentro por outro. É por isso que o HMAC é sobre o
    // corpo cru inteiro e não sobre um resumo dele.
    const original = corpoDe();
    const adulterado = corpoDe("evt_1", "customer.subscription.deleted");
    const r = verificarWebhook(adulterado, assinar(original), SEGREDO, AGORA);
    expect(r).toEqual({ ok: false, motivo: "assinatura não confere" });
  });

  it("recusa assinatura feita com outro segredo", () => {
    const corpo = corpoDe();
    const r = verificarWebhook(corpo, assinar(corpo, "whsec_outro"), SEGREDO, AGORA);
    expect(r).toEqual({ ok: false, motivo: "assinatura não confere" });
  });

  it("recusa entrega fora da janela de 5 minutos (replay)", () => {
    // A assinatura CONTINUA válida para sempre — o que impede reenviar a
    // entrega de ontem é só o timestamp. Sem esta janela, um
    // `customer.subscription.created` capturado uma vez reativaria a conta
    // toda vez que fosse reenviado.
    const corpo = corpoDe();
    const r = verificarWebhook(corpo, assinar(corpo, SEGREDO, AGORA - 301), SEGREDO, AGORA);
    expect(r).toEqual({ ok: false, motivo: "entrega fora da janela de 5 minutos" });
  });

  it("aceita dentro da janela, nos dois sentidos do relógio", () => {
    const corpo = corpoDe();
    expect(verificarWebhook(corpo, assinar(corpo, SEGREDO, AGORA - 299), SEGREDO, AGORA).ok).toBe(
      true,
    );
    // Relógio do Stripe adiantado em relação ao nosso também é aceito: a
    // tolerância é em módulo, senão um servidor com NTP atrasado rejeitaria
    // tudo.
    expect(verificarWebhook(corpo, assinar(corpo, SEGREDO, AGORA + 120), SEGREDO, AGORA).ok).toBe(
      true,
    );
  });

  it("aceita quando UMA das assinaturas bate — o caso da rotação de segredo", () => {
    // Durante a rotação o Stripe manda um `v1=` por segredo ativo. Quem
    // comparasse só o primeiro derrubaria todas as entregas da janela de
    // rotação, que é justamente quando ninguém está olhando.
    const corpo = corpoDe();
    const bom = assinar(corpo).split("v1=")[1];
    const header = `t=${AGORA},v1=${"0".repeat(64)},v1=${bom}`;
    expect(verificarWebhook(corpo, header, SEGREDO, AGORA).ok).toBe(true);
  });

  it("recusa header ausente, malformado ou sem v1", () => {
    const corpo = corpoDe();
    expect(verificarWebhook(corpo, null, SEGREDO, AGORA)).toEqual({
      ok: false,
      motivo: "assinatura ausente",
    });
    expect(verificarWebhook(corpo, "lixo", SEGREDO, AGORA)).toEqual({
      ok: false,
      motivo: "assinatura malformada",
    });
    expect(verificarWebhook(corpo, `t=${AGORA}`, SEGREDO, AGORA)).toEqual({
      ok: false,
      motivo: "assinatura malformada",
    });
  });

  it("recusa timestamp que não é número", () => {
    const corpo = corpoDe();
    expect(verificarWebhook(corpo, `t=ontem,v1=${"a".repeat(64)}`, SEGREDO, AGORA)).toEqual({
      ok: false,
      motivo: "timestamp inválido",
    });
  });

  it("não LANÇA quando a assinatura tem tamanho diferente do HMAC", () => {
    // `timingSafeEqual` lança com tamanhos diferentes, e é exatamente o que um
    // atacante manda para descobrir se a comparação é real. Tem de virar
    // recusa, não 500.
    const corpo = corpoDe();
    const r = verificarWebhook(corpo, `t=${AGORA},v1=ab`, SEGREDO, AGORA);
    expect(r).toEqual({ ok: false, motivo: "assinatura não confere" });
  });

  it("recusa quando o segredo não está configurado", () => {
    // Sem isto, uma instalação com `STRIPE_WEBHOOK_SECRET` vazia assinaria com
    // "" e aceitaria qualquer um que descobrisse o vazio.
    const corpo = corpoDe();
    expect(verificarWebhook(corpo, assinar(corpo), "", AGORA)).toEqual({
      ok: false,
      motivo: "STRIPE_WEBHOOK_SECRET ausente",
    });
  });

  it("recusa corpo assinado que não é JSON de evento", () => {
    const corpo = "isto não é json";
    expect(verificarWebhook(corpo, assinar(corpo), SEGREDO, AGORA)).toEqual({
      ok: false,
      motivo: "corpo não é JSON",
    });

    const semTipo = JSON.stringify({ id: "evt_1" });
    expect(verificarWebhook(semTipo, assinar(semTipo), SEGREDO, AGORA)).toEqual({
      ok: false,
      motivo: "evento sem id ou type",
    });
  });
});

describe("formEncode", () => {
  it("achata objeto e array no formato do Stripe", () => {
    expect(
      formEncode({
        mode: "subscription",
        line_items: [{ price: "price_1", quantity: 1 }],
        metadata: { organization_id: "org-1" },
      }),
    ).toBe(
      "mode=subscription&line_items%5B0%5D%5Bprice%5D=price_1&line_items%5B0%5D%5Bquantity%5D=1&metadata%5Borganization_id%5D=org-1",
    );
  });

  it("OMITE null e undefined em vez de mandar a string vazia", () => {
    // No Stripe, mandar o campo vazio e não mandar o campo são coisas
    // diferentes: `trial_period_days=` zeraria o trial em vez de deixá-lo no
    // padrão da conta.
    expect(formEncode({ a: 1, b: null, c: undefined })).toBe("a=1");
  });
});
