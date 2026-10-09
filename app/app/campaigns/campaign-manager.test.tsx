import { beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import CampaignManager from "./campaign-manager";

vi.mock("@/hooks/i18n/useT", () => ({ useT: () => (text: string) => text }));
vi.mock("@/hooks/i18n/useLocaleDeData", () => ({ useTagDeIdioma: () => "pt-BR" }));

const campaignId = "11111111-1111-4111-8111-111111111111";
const recipientId = "22222222-2222-4222-8222-222222222222";
const actions: unknown[] = [];

function apiFixture(failReview = false) {
  let reviewed = false;
  const campaign = () => ({
    id: campaignId, name: "Oferta de teste", status: "paused", scheduled_at: null,
    counts: { needs_review: reviewed ? 0 : 1, pending: 1 },
    recipients: [{
      id: recipientId, name: "Contato de teste", display_name: null,
      status: reviewed ? "cancelled" : "needs_review", safe_to_retry: false,
      conversation_id: "33333333-3333-4333-8333-333333333333", message_id: null,
      delivery_status: null, error_message: null, last_error: "send_outcome_uncertain", attempts: 1,
    }],
  });
  vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
    if (url.endsWith("/actions")) {
      actions.push(JSON.parse(String(init?.body)));
      if (failReview) return Response.json({ error: { message: "Confira o recibo atualizado." } }, { status: 409 });
      reviewed = true;
      return Response.json({ data: campaign() });
    }
    if (url.endsWith("/options")) return Response.json({ data: { sessions: [], templates: [], contacts: [] } });
    if (url.endsWith(campaignId)) return Response.json({ data: campaign() });
    return Response.json({ data: [campaign()] });
  }));
}

beforeEach(() => { cleanup(); vi.unstubAllGlobals(); actions.length = 0; });

describe("revisão de envio incerto na tela", () => {
  it("só encerra após confirmação e libera os pendentes sem pedir reenvio", async () => {
    apiFixture();
    const user = userEvent.setup();
    render(<CampaignManager canManage />);
    await user.click(await screen.findByRole("button", { name: /Oferta de teste/ }));
    expect(await screen.findByRole("link", { name: "Abrir conversa" })).toHaveAttribute("href", "/app/inbox?id=33333333-3333-4333-8333-333333333333");
    await user.click(await screen.findByRole("button", { name: "Encerrar revisão sem reenviar" }));
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    expect(actions).toEqual([]);
    await user.click(screen.getByRole("button", { name: "Voltar" }));
    expect(actions).toEqual([]);
    await user.click(screen.getByRole("button", { name: "Encerrar revisão sem reenviar" }));
    await user.click(screen.getByRole("button", { name: "Confirmar encerramento da revisão" }));
    await screen.findByText("Revisão encerrada. Retome os destinatários pendentes quando estiver pronto.");
    expect(actions).toEqual([{ action: "resolve_review", confirm: true, resolution: "skip", recipient_id: recipientId }]);
    expect(screen.queryByRole("button", { name: "Preparar nova tentativa segura" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Retomar pendentes" }));
    expect(actions).toEqual([
      { action: "resolve_review", confirm: true, resolution: "skip", recipient_id: recipientId },
      { action: "resume" },
    ]);
  });

  it("quem só acompanha não pode encerrar revisão nem retomar campanha", async () => {
    apiFixture();
    const user = userEvent.setup();
    render(<CampaignManager canManage={false} />);
    await user.click(await screen.findByRole("button", { name: /Oferta de teste/ }));
    await screen.findByText("Contato de teste");
    expect(screen.queryByRole("button", { name: "Encerrar revisão sem reenviar" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Retomar pendentes" })).not.toBeInTheDocument();
    expect(actions).toEqual([]);
  });

  it("recusa do servidor deixa revisão visível e informa o próximo passo", async () => {
    apiFixture(true);
    const user = userEvent.setup();
    render(<CampaignManager canManage />);
    await user.click(await screen.findByRole("button", { name: /Oferta de teste/ }));
    await user.click(await screen.findByRole("button", { name: "Encerrar revisão sem reenviar" }));
    await user.click(screen.getByRole("button", { name: "Confirmar encerramento da revisão" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Confira o recibo atualizado.");
    expect(screen.getByRole("button", { name: "Encerrar revisão sem reenviar" })).toBeInTheDocument();
    expect(actions).toHaveLength(1);
  });
});
