/**
 * TRANSBORDO DE E-MAIL (27/11/2026): Resend no limite → Brevo → NovaMail;
 * follow-up da sequência → NovaMail, voltando à Resend se ele falhar.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const sendMock = vi.fn();
vi.mock("resend", () => ({ Resend: class { emails = { send: sendMock }; } }));
vi.mock("@/lib/env", () => ({
  env: {
    RESEND_API_KEY: "re_test_key_123",
    RESEND_FROM_EMAIL: "contato@atenza.online",
    BREVO_API_KEY: "",
    NOVAMAIL_API_KEY: "nm_test",
    NOVAMAIL_FROM_EMAIL: "",
    NOVAMAIL_API_URL: "https://nm.test",
  },
}));

const base = { to: "lead@exemplo.com", subject: "Oi", html: "<p>oi</p>", fromName: "Atenza" };
let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  sendMock.mockReset();
  fetchMock = vi.fn(async () => new Response(JSON.stringify({ id: "abc" }), { status: 200 }));
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

describe("transbordo", () => {
  it("Resend no limite de cota cai no NovaMail (sem Brevo), com remetente em mail.", async () => {
    const { sendEmail } = await import("@/lib/email/resend");
    sendMock.mockResolvedValue({ data: null, error: { name: "daily_quota_exceeded", message: "You have reached your daily email sending quota." } });
    const r = await sendEmail(base);
    expect(r).toMatchObject({ ok: true, provider: "novamail", id: "nm:abc" });
    const body = JSON.parse(fetchMock.mock.calls[0]![1].body);
    expect(body.from).toBe("Atenza <contato@mail.atenza.online>");
  });

  it("erro que não é limite não transborda", async () => {
    const { sendEmail } = await import("@/lib/email/resend");
    sendMock.mockResolvedValue({ data: null, error: { name: "validation_error", message: "Invalid to" } });
    const r = await sendEmail(base);
    expect(r.ok).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("follow-up sai pelo NovaMail e volta para a Resend se ele falhar", async () => {
    const { sendEmail } = await import("@/lib/email/resend");
    expect(await sendEmail({ ...base, followUp: true })).toMatchObject({ ok: true, provider: "novamail" });
    expect(sendMock).not.toHaveBeenCalled();

    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ message: "down" }), { status: 503 }));
    sendMock.mockResolvedValue({ data: { id: "re1" }, error: null });
    expect(await sendEmail({ ...base, followUp: true })).toMatchObject({ ok: true, provider: "resend", id: "re1" });
  });
});
