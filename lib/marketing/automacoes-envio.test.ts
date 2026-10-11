import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("@/lib/email/resend", () => ({ sendEmail: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));
import { registrarResultadoEnvio, reivindicarEnvio } from "./automacoes-envio";
import type { createAdminClient } from "@/lib/supabase/admin";

function fake() {
  const eq = vi.fn().mockResolvedValue({ error: null });
  const update = vi.fn(() => ({ eq }));
  const rpc = vi.fn().mockResolvedValue({ data: "envio-sintetico", error: null });
  return {
    admin: { from: vi.fn(() => ({ update })), rpc } as unknown as ReturnType<
      typeof createAdminClient
    >,
    update,
    eq,
    rpc,
  };
}
describe("recibo de envio e resultados ambíguos", () => {
  it("claim carrega a política comercial e a campanha para a transação do banco", async () => {
    const f = fake();
    expect(
      await reivindicarEnvio(f.admin, {
        leadId: "lead",
        mensagem: "natal#2026",
        assunto: "Natal",
        marketing: true,
        campanha: "natal",
      }),
    ).toBe("envio-sintetico");
    expect(f.rpc).toHaveBeenCalledWith("fn_claim_marketing_envio", {
      p_lead_id: "lead",
      p_mensagem: "natal#2026",
      p_assunto: "Natal",
      p_marketing: true,
      p_campanha: "natal",
    });
  });
  it("falha de consulta é fail-closed", async () => {
    const f = fake();
    f.rpc.mockResolvedValueOnce({ data: null, error: { message: "indisponível" } });
    expect(
      await reivindicarEnvio(f.admin, {
        leadId: "lead",
        mensagem: "natal#2026",
        assunto: "Natal",
        marketing: true,
      }),
    ).toBeNull();
  });
  it("timeout permanece pendente e não fica elegível a retry", async () => {
    const f = fake();
    expect(
      await registrarResultadoEnvio(f.admin, "envio", {
        ok: false,
        error: "send_failed",
        details: "timeout",
      }),
    ).toBe(false);
    expect(f.update).toHaveBeenCalledWith({ status: "agendado", erro: "send_failed: timeout" });
  });
  it("429 explicitamente recusado pode tentar novamente", async () => {
    const f = fake();
    await registrarResultadoEnvio(f.admin, "envio", {
      ok: false,
      error: "rate_limited",
      details: "429",
    });
    expect(f.update).toHaveBeenCalledWith({ status: "falhou", erro: "rate_limited: 429" });
  });
  it("aceito pelo provedor guarda recibo; falha ao guardar não declara sucesso", async () => {
    const f = fake();
    expect(
      await registrarResultadoEnvio(f.admin, "envio", { ok: true, id: "provider-sintetico" }),
    ).toBe(true);
    expect(f.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: "enviado", provider_id: "provider-sintetico", erro: null }),
    );
    f.eq.mockResolvedValueOnce({ error: { message: "fora" } });
    expect(
      await registrarResultadoEnvio(f.admin, "envio", { ok: true, id: "provider-sintetico" }),
    ).toBe(false);
  });
});
