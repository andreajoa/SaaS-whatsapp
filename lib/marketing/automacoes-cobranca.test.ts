import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("@/lib/marketing/disparo", () => ({ dispararTransacional: vi.fn() }));
import { dispararTransacional } from "@/lib/marketing/disparo";
import { agradecerFaturaPaga } from "./automacoes-cobranca";
const fatura = { id: "in_sintetica", amount_paid: 19700, customer_email: "pagante@example.test" };
beforeEach(() => vi.clearAllMocks());
describe("agradecimento por cobrança efetiva", () => {
  it("cobra identidade estável por fatura, nunca por evento ou mês", async () => {
    await agradecerFaturaPaga(fatura, "org-sintetica");
    expect(dispararTransacional).toHaveBeenCalledWith({
      email: fatura.customer_email,
      transacionalId: "pagamento-recebido",
      chave: "in_sintetica",
      origem: "checkout",
    });
  });
  it("trial de zero, valor inválido ou organização desconhecida não agradecem cobrança", async () => {
    for (const amount_paid of [0, -1, "19700", null, undefined])
      await agradecerFaturaPaga({ ...fatura, amount_paid }, "org-sintetica");
    await agradecerFaturaPaga(fatura, null);
    expect(dispararTransacional).not.toHaveBeenCalled();
  });
  it("sem id da fatura ou endereço verificável não inventa destinatário", async () => {
    await agradecerFaturaPaga({ ...fatura, id: null }, "org-sintetica");
    await agradecerFaturaPaga({ ...fatura, customer_email: null }, "org-sintetica");
    expect(dispararTransacional).not.toHaveBeenCalled();
  });
});
