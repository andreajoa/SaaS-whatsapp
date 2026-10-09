import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { StrictMode } from "react";
import { qualityText } from "@/lib/service-quality/text";
import { DISABLED_POLICY } from "@/lib/service-quality/contracts";
import type * as QualityClient from "@/lib/service-quality/client";
import {
  conversationMetrics,
  pageSummary,
  type QualitySnapshot,
} from "@/lib/service-quality/metrics";
const api = vi.hoisted(() => ({ fetch: vi.fn() }));
const navigation = vi.hoisted(() => ({ params: new URLSearchParams() }));
vi.mock("next/navigation", () => ({ useSearchParams: () => navigation.params }));
vi.mock("@/lib/service-quality/client", async () => {
  const actual = await vi.importActual<typeof QualityClient>("@/lib/service-quality/client");
  return { ...actual, qualityFetch: api.fetch };
});
import { QualityRequestError } from "@/lib/service-quality/client";
import { FeedbackForm } from "@/app/feedback/[token]/feedback-form";
import { QualitySurveyRequest } from "@/app/app/service-quality/survey-request";
import { QualityDashboard } from "@/app/app/service-quality/quality-dashboard";
import { ConversationQualityFeedback } from "@/app/app/service-quality/conversation-feedback";
import { IntegrationsClient } from "@/app/app/integrations/_components/IntegrationsClient";
const text = qualityText("pt-BR"),
  es = qualityText("es"),
  conversation = "aaaaaaaa-2222-4000-8000-000000000001",
  token = "A".repeat(43);
const scoreSurvey = {
  id: conversation,
  conversation_id: conversation,
  created_at: "2026-10-08T12:00:00Z",
  expires_at: "2026-10-09T12:00:00Z",
  responded_at: "2026-10-08T13:00:00Z",
  score: 2,
  comment: "Synthetic feedback",
};
const row = conversationMetrics(
  {
    conversation_id: conversation,
    status: "open",
    service_started_at: null,
    first_inbound_at: "2026-10-08T12:00:00Z",
    first_response_at: null,
    closed_at: null,
  },
  { ...DISABLED_POLICY, enabled: true, first_response_target_seconds: 60 },
  Date.parse("2026-10-08T13:00:00Z"),
);
const snapshot: QualitySnapshot = {
  policy: DISABLED_POLICY,
  can_manage: true,
  rows: [row],
  surveys: [scoreSurvey],
  summary: {
    ...pageSummary([row], [scoreSurvey]),
    pending_surveys: 0,
    expired_surveys: 0,
    total: 1,
  },
  survey_history_truncated: false,
  next_cursor: null,
  measured_at: "2026-10-08T13:00:00Z",
};
beforeEach(() => {
  api.fetch.mockReset();
  navigation.params = new URLSearchParams();
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Unexpected unmocked fetch")));
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((onResolve, onReject) => {
    resolve = onResolve;
    reject = onReject;
  });
  return { promise, resolve, reject };
}
function withComment(comment: string): QualitySnapshot {
  return { ...snapshot, surveys: [{ ...scoreSurvey, comment }] };
}
describe("UI de SLA e CSAT: ações explícitas", () => {
  it("criar/copy não envia; callback normal de messenger só roda por clique explícito", async () => {
    api.fetch.mockResolvedValue({
      feedback_path: `/feedback/${token}`,
      conversation_id: conversation,
      expires_at: "2026-10-09T12:00:00Z",
    });
    const send = vi.fn().mockResolvedValue(undefined),
      copy = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: copy },
    });
    render(<QualitySurveyRequest conversationId={conversation} onExplicitSend={send} />);
    expect(api.fetch).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText(text.expiry), { target: { value: "24" } });
    fireEvent.click(screen.getByRole("button", { name: text.create }));
    await screen.findByRole("button", { name: text.copy });
    expect(api.fetch).toHaveBeenCalledWith(
      "/api/v1/service-quality/surveys",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ conversation_id: conversation, expires_hours: 24 }),
      }),
    );
    expect(send).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: text.copy }));
    await waitFor(() => expect(copy).toHaveBeenCalledTimes(1));
    expect(send).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: text.sendInvitation }));
    await waitFor(() => expect(send).toHaveBeenCalledTimes(1));
    expect(send.mock.calls[0]![0]).toContain(`/feedback/${token}`);
  });
  it("formulário público usa idioma da organização e envia nota/comment sem tenant", async () => {
    api.fetch.mockImplementation((_: string, options?: RequestInit) =>
      Promise.resolve(options?.method === "POST" ? { accepted: true } : { locale: "es" }),
    );
    render(<FeedbackForm token={token} />);
    await screen.findByText(es.feedbackIntro);
    expect(screen.getByRole("button", { name: es.submit }).hasAttribute("disabled")).toBe(true);
    fireEvent.click(screen.getByRole("radio", { name: "4" }));
    fireEvent.change(screen.getByLabelText(es.comment), {
      target: { value: "  Synthetic comment  " },
    });
    fireEvent.click(screen.getByRole("button", { name: es.submit }));
    await screen.findByText(es.thanks);
    expect(api.fetch).toHaveBeenCalledWith(
      `/api/v1/service-quality/public/${token}`,
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ score: 4, comment: "Synthetic comment" }),
      }),
    );
    expect(screen.queryByRole("button", { name: es.submit })).toBeNull();
  });
  it("uso único/expirado remove formulário e não permite nova submissão", async () => {
    api.fetch.mockRejectedValue(new QualityRequestError(404));
    render(<FeedbackForm token={token} />);
    await screen.findByText(text.unavailable);
    expect(screen.queryByRole("radio")).toBeNull();
    expect(screen.queryByRole("button", { name: text.submit })).toBeNull();
  });
  it("rate limit mostra instrução de esperar e retry", async () => {
    api.fetch.mockRejectedValue(new QualityRequestError(429));
    render(<FeedbackForm token={token} />);
    await screen.findByText(text.slow);
    expect(screen.getByRole("button", { name: text.reload })).toBeTruthy();
  });
  it("painel mostra métricas/alertas ligados ao inbox e CSAT privado da conversa", async () => {
    api.fetch.mockResolvedValue(snapshot);
    render(<QualityDashboard />);
    await screen.findByText(text.pageScope);
    expect(
      screen
        .getAllByRole("link", { name: new RegExp(text.inbox) })
        .every((link) => link.getAttribute("href") === `/app/inbox/${conversation}`),
    ).toBe(true);
    expect(screen.getByText(scoreSurvey.comment)).toBeTruthy();
    expect(screen.getByText("2.00/5")).toBeTruthy();
    expect(screen.getByLabelText(text.enabled)).toBeTruthy();
  });
  it("selecionar conversa abre pedido inline já ligado ao inbox existente", async () => {
    api.fetch.mockResolvedValue(snapshot);
    render(<QualityDashboard />);
    await screen.findByText(text.pageScope);
    fireEvent.click(screen.getByRole("button", { name: text.survey }));
    const input = screen.getByLabelText(text.conversationId) as HTMLInputElement;
    expect(input.value).toBe(conversation);
    expect(input.readOnly).toBe(true);
    expect(screen.getByRole("button", { name: text.create })).toBeTruthy();
    expect(api.fetch).toHaveBeenCalledTimes(1);
  });
  it("viewer lê o feedback mas não ganha ações de gerente", async () => {
    api.fetch.mockResolvedValue({ ...snapshot, can_manage: false });
    render(<QualityDashboard />);
    await screen.findByText(text.pageScope);
    expect(screen.queryByRole("button", { name: text.create })).toBeNull();
    expect(screen.queryByLabelText(text.enabled)).toBeNull();
    expect(screen.getByText(text.readonly)).toBeTruthy();
  });
  it("seam da conversa exibe mesma nota/comentário do dashboard", async () => {
    api.fetch.mockResolvedValue({ ...snapshot, can_manage: false });
    render(<ConversationQualityFeedback conversationId={conversation} />);
    await screen.findByText(scoreSurvey.comment);
    expect(api.fetch).toHaveBeenCalledWith(
      `/api/v1/service-quality?conversation_id=${conversation}`,
      expect.anything(),
    );
    expect(screen.getByText(`${text.score}: 2/5`)).toBeTruthy();
  });
});

describe("carregamento de qualidade: cancelamento, retry e polling", () => {
  it.each(["conversa", "painel"])(
    "%s: falha inicial permite retry e limpa o erro",
    async (view) => {
      const retry = deferred<QualitySnapshot>();
      api.fetch
        .mockRejectedValueOnce(new Error("Initial failure"))
        .mockReturnValueOnce(retry.promise);
      render(
        view === "conversa" ? (
          <ConversationQualityFeedback conversationId={conversation} />
        ) : (
          <QualityDashboard />
        ),
      );
      expect(screen.getByText(text.loading)).toBeTruthy();
      await screen.findByRole("alert");
      const button = screen.getByRole("button", { name: text.reload });
      expect(button.hasAttribute("disabled")).toBe(false);
      fireEvent.click(button);
      await act(async () => retry.resolve(snapshot));
      expect(screen.queryByRole("alert")).toBeNull();
      expect(screen.queryByText(text.loading)).toBeNull();
      expect(screen.getByText(scoreSurvey.comment)).toBeTruthy();
    },
  );

  it.each(["conversa", "painel"])(
    "%s: retry e polling ignoram respostas antigas e param ao desmontar",
    async (view) => {
      vi.useFakeTimers();
      const old = deferred<QualitySnapshot>();
      api.fetch
        .mockResolvedValueOnce(snapshot)
        .mockReturnValueOnce(old.promise)
        .mockResolvedValue(withComment("Current poll"));
      const { unmount } = render(
        view === "conversa" ? (
          <ConversationQualityFeedback conversationId={conversation} />
        ) : (
          <QualityDashboard />
        ),
      );
      await act(async () => {});
      fireEvent.click(screen.getByRole("button", { name: text.reload }));
      await act(async () => vi.advanceTimersByTime(30000));
      expect(screen.getByText("Current poll")).toBeTruthy();
      await act(async () => old.reject(new Error("Obsolete failure")));
      expect(screen.queryByRole("alert")).toBeNull();
      const manualSignal = (api.fetch.mock.calls[1]![1] as RequestInit).signal;
      expect(manualSignal?.aborted).toBe(false);
      unmount();
      expect(manualSignal?.aborted).toBe(true);
      await act(async () => vi.advanceTimersByTime(60000));
      expect(api.fetch).toHaveBeenCalledTimes(3);
    },
  );

  it("troca de conversa oculta dados antigos e cancela o retry em andamento", async () => {
    const old = deferred<QualitySnapshot>(),
      current = deferred<QualitySnapshot>();
    const other = "bbbbbbbb-2222-4000-8000-000000000002";
    api.fetch
      .mockResolvedValueOnce(snapshot)
      .mockReturnValueOnce(old.promise)
      .mockReturnValueOnce(current.promise);
    const { rerender } = render(<ConversationQualityFeedback conversationId={conversation} />);
    await screen.findByText(scoreSurvey.comment);
    fireEvent.click(screen.getByRole("button", { name: text.reload }));
    const signal = (api.fetch.mock.calls[1]![1] as RequestInit).signal;
    rerender(<ConversationQualityFeedback conversationId={other} />);
    expect(signal?.aborted).toBe(true);
    expect(screen.queryByText(scoreSurvey.comment)).toBeNull();
    expect(screen.getByText(text.loading)).toBeTruthy();
    await act(async () => old.resolve(withComment("Obsolete conversation")));
    expect(screen.queryByText("Obsolete conversation")).toBeNull();
    await act(async () => current.resolve(withComment("Current conversation")));
    expect(screen.getByText("Current conversation")).toBeTruthy();
  });

  it("paginação cancela recarga antiga, mantém loading e volta pelo cursor", async () => {
    const old = deferred<QualitySnapshot>(),
      next = deferred<QualitySnapshot>();
    api.fetch
      .mockResolvedValueOnce({ ...snapshot, next_cursor: "next cursor" })
      .mockReturnValueOnce(old.promise)
      .mockReturnValueOnce(next.promise)
      .mockResolvedValueOnce(snapshot);
    render(<QualityDashboard />);
    await screen.findByText(text.pageScope);
    fireEvent.click(screen.getByRole("button", { name: text.reload }));
    const signal = (api.fetch.mock.calls[1]![1] as RequestInit).signal;
    fireEvent.click(screen.getByRole("button", { name: text.next }));
    expect(signal?.aborted).toBe(true);
    expect(screen.getByText(text.loading)).toBeTruthy();
    expect(screen.getByRole("button", { name: text.reload }).hasAttribute("disabled")).toBe(true);
    expect(api.fetch.mock.calls[2]![0]).toBe("/api/v1/service-quality?after=next%20cursor");
    await act(async () => old.resolve(withComment("Obsolete page")));
    expect(screen.queryByText("Obsolete page")).toBeNull();
    expect(screen.getByText(text.loading)).toBeTruthy();
    await act(async () => next.resolve(withComment("Next page")));
    expect(screen.getByText("Next page")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: text.previous }));
    await screen.findByText(scoreSurvey.comment);
    expect(api.fetch.mock.calls[3]![0]).toBe("/api/v1/service-quality");
  });

  it.each(["conversa", "painel"])(
    "%s: StrictMode cancela a primeira montagem e mantém a segunda",
    async (view) => {
      const first = deferred<QualitySnapshot>(),
        second = deferred<QualitySnapshot>();
      api.fetch.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
      const { unmount } = render(
        <StrictMode>
          {view === "conversa" ? (
            <ConversationQualityFeedback conversationId={conversation} />
          ) : (
            <QualityDashboard />
          )}
        </StrictMode>,
      );
      const firstSignal = (api.fetch.mock.calls[0]![1] as RequestInit).signal;
      const secondSignal = (api.fetch.mock.calls[1]![1] as RequestInit).signal;
      expect(firstSignal?.aborted).toBe(true);
      expect(secondSignal?.aborted).toBe(false);
      await act(async () => first.resolve(withComment("Discarded mount")));
      expect(screen.queryByText("Discarded mount")).toBeNull();
      expect(screen.getByText(text.loading)).toBeTruthy();
      unmount();
      expect(secondSignal?.aborted).toBe(true);
      await act(async () => second.resolve(snapshot));
    },
  );
});

describe("integrações: parâmetros derivados e carregamento", () => {
  const connected = "Shopify conectada. Os produtos e pedidos estão sendo sincronizados.";
  const manual =
    "Shopify conectada. Alguns avisos automáticos precisam de configuração; você pode sincronizar manualmente.";
  const oauthError =
    "Não foi possível concluir a autorização Shopify. Abra a conexão e tente novamente.";
  const commerce = { connections: [], runs: [], shopify_oauth_available: true };
  const response = (runs: unknown[] = []) =>
    new Response(JSON.stringify({ data: { ...commerce, runs } }));

  it("deriva avisos Shopify na renderização e permite retry do erro OAuth", async () => {
    const initial = deferred<Response>();
    vi.mocked(fetch).mockReturnValueOnce(initial.promise).mockImplementation(async () => response());
    navigation.params = new URLSearchParams("shopify=connected");
    const { rerender } = render(<IntegrationsClient />);
    expect(screen.getByText(connected)).toBeTruthy();
    navigation.params = new URLSearchParams("shopify=connected_manual_sync");
    rerender(<IntegrationsClient />);
    expect(screen.getByText(manual)).toBeTruthy();
    expect(screen.queryByText(connected)).toBeNull();
    navigation.params = new URLSearchParams("shopify=failed");
    rerender(<IntegrationsClient />);
    expect(screen.getByText(oauthError)).toBeTruthy();
    await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
    await act(async () => initial.resolve(response()));
    navigation.params = new URLSearchParams("shopify=another_failure");
    vi.mocked(fetch)
      .mockRejectedValueOnce(new Error("Synthetic failure"))
      .mockImplementation(async () => response());
    rerender(<IntegrationsClient />);
    await screen.findByText("Synthetic failure");
    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
  });

  it("polling de 5s continua durante sincronização, ignora resposta antiga e para ao concluir", async () => {
    vi.useFakeTimers();
    const old = deferred<Response>();
    const running = [
      {
        id: "run",
        integration_id: "store",
        status: "running",
        phase: "products",
        product_count: 0,
        order_count: 0,
        error_code: null,
        started_at: "2026-10-08T12:00:00Z",
        completed_at: null,
      },
    ];
    vi.mocked(fetch)
      .mockResolvedValueOnce(response(running))
      .mockReturnValueOnce(old.promise)
      .mockResolvedValueOnce(response(running))
      .mockResolvedValueOnce(response());
    const { unmount } = render(<IntegrationsClient />);
    await act(async () => {});
    fireEvent.click(screen.getByRole("button", { name: "Atualizar status" }));
    await act(async () => vi.advanceTimersByTime(5000));
    expect(fetch).toHaveBeenCalledTimes(3);
    await act(async () => old.reject(new Error("Obsolete commerce failure")));
    expect(screen.queryByRole("alert")).toBeNull();
    await act(async () => vi.advanceTimersByTime(5000));
    expect(fetch).toHaveBeenCalledTimes(4);
    await act(async () => vi.advanceTimersByTime(10000));
    expect(fetch).toHaveBeenCalledTimes(4);
    const signal = vi.mocked(fetch).mock.calls[1]![1]?.signal;
    unmount();
    expect(signal?.aborted).toBe(true);
  });

  it("StrictMode cancela montagem e recarga manual ao desmontar", async () => {
    const first = deferred<Response>(),
      manual = deferred<Response>();
    vi.mocked(fetch)
      .mockReturnValueOnce(first.promise)
      .mockResolvedValueOnce(response())
      .mockReturnValueOnce(manual.promise);
    const { unmount } = render(
      <StrictMode>
        <IntegrationsClient />
      </StrictMode>,
    );
    expect(vi.mocked(fetch).mock.calls[0]![1]?.signal?.aborted).toBe(true);
    await act(async () => {});
    fireEvent.click(screen.getByRole("button", { name: "Atualizar status" }));
    const signal = vi.mocked(fetch).mock.calls[2]![1]?.signal;
    expect(signal?.aborted).toBe(false);
    unmount();
    expect(signal?.aborted).toBe(true);
    await act(async () => {
      first.resolve(response());
      manual.reject(new Error("Unmounted request"));
    });
  });
});
