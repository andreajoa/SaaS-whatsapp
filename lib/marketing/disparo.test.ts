import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  admin: vi.fn(),
  send: vi.fn(),
  config: vi.fn(),
  rpc: vi.fn(),
  lead: {
    id: "lead-sintetico",
    token_descadastro: "token-sintetico",
    idioma: "pt-BR",
    descadastrado_em: null as string | null,
    status: "inscrito",
    marketing_opt_in_em: null as string | null,
  },
  receipt: null as { status: string } | null,
}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: mocks.admin }));
vi.mock("@/lib/email/resend", () => ({ sendEmail: mocks.send }));
vi.mock("@/lib/env", () => ({
  env: {
    RESEND_API_KEY: "chave-sintetica-configurada",
    RESEND_FROM_EMAIL: "email@example.test",
    NEXT_PUBLIC_APP_URL: "https://site.test",
  },
}));
vi.mock("@/lib/branding/saida", () => ({ marcaDaSaida: vi.fn(async () => ({ nome: "Marca" })) }));
vi.mock("@/lib/marketing/automacoes", () => ({ lerAutomacao: mocks.config }));
vi.mock("@/lib/marketing/lead", () => ({
  normalizarEmail: (s: string) => s.trim().toLowerCase(),
  registrarLead: vi.fn(),
}));
import { dispararTransacional } from "./disparo";
import { automacoesPadrao } from "./automacoes-catalogo";
const query = (table: string) => ({
  eq: () => query(table),
  maybeSingle: async () => ({
    data: table === "site_leads" ? mocks.lead : mocks.receipt,
    error: null,
  }),
});
beforeEach(() => {
  vi.clearAllMocks();
  mocks.lead.status = "inscrito";
  mocks.lead.marketing_opt_in_em = null;
  mocks.lead.descadastrado_em = null;
  mocks.receipt = null;
  mocks.admin.mockReturnValue({
    rpc: mocks.rpc,
    from: (table: string) => ({
      select: () => query(table),
      update: () => ({ eq: async () => ({ error: null }) }),
    }),
  });
  mocks.rpc.mockResolvedValue({ data: "envio-sintetico", error: null });
  mocks.send.mockResolvedValue({ ok: true, id: "provider-sintetico" });
  mocks.config.mockImplementation(async (id: string) =>
    automacoesPadrao().find((a) => a.id === id),
  );
});
describe("disparo preserva consentimento, supressão e recibos", () => {
  const pedido = {
    email: "lead@example.test",
    transacionalId: "checkout-abandonado",
    chave: "cs_sintetica",
  };
  it("cadastro ou compra sem aceite não recebe publicidade", async () => {
    expect(await dispararTransacional(pedido)).toEqual({ tipo: "sem_consentimento" });
    expect(mocks.send).not.toHaveBeenCalled();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("aceite não ressuscita descadastrado e bounce bloqueia inclusive cobrança", async () => {
    mocks.lead.marketing_opt_in_em = "2026-10-10T12:00:00Z";
    mocks.lead.descadastrado_em = "2026-10-10T13:00:00Z";
    expect((await dispararTransacional(pedido)).tipo).toBe("descadastrado");
    mocks.lead.status = "bounce";
    expect(
      (await dispararTransacional({ ...pedido, transacionalId: "pagamento-falhou" })).tipo,
    ).toBe("suprimido");
    expect(mocks.send).not.toHaveBeenCalled();
  });
  it("claim compartilhado aplica throttle; ausência de claim não é envio", async () => {
    mocks.lead.marketing_opt_in_em = "2026-10-10T12:00:00Z";
    mocks.rpc.mockResolvedValue({ data: null, error: null });
    expect((await dispararTransacional(pedido)).tipo).toBe("adiado");
    expect(mocks.send).not.toHaveBeenCalled();
    mocks.receipt = { status: "agendado" };
    expect((await dispararTransacional(pedido)).tipo).toBe("pendente");
    mocks.receipt = { status: "enviado" };
    expect((await dispararTransacional(pedido)).tipo).toBe("ja_enviado");
  });
  it("aviso de cobrança independe de aceite e saída da publicidade; provider usa identidade do recibo", async () => {
    mocks.lead.descadastrado_em = "2026-10-10T13:00:00Z";
    expect(
      (await dispararTransacional({ ...pedido, transacionalId: "pagamento-falhou" })).tipo,
    ).toBe("enviado");
    expect(mocks.rpc).toHaveBeenCalledWith(
      "fn_claim_marketing_envio",
      expect.objectContaining({
        p_marketing: false,
        p_campanha: "pagamento-falhou",
        p_mensagem: "pagamento-falhou#cs_sintetica",
      }),
    );
    expect(mocks.send).toHaveBeenCalledWith(
      expect.objectContaining({ idempotencyKey: "email/envio-sintetico", headers: {} }),
    );
  });
  it("agradecimento começa desativado e não chega ao provedor", async () => {
    expect(
      (await dispararTransacional({ ...pedido, transacionalId: "pagamento-recebido" })).tipo,
    ).toBe("sem_email");
    expect(mocks.send).not.toHaveBeenCalled();
  });
});
