import "@testing-library/jest-dom/vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import type { ComponentProps } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { IntegrationActionPicker } from "./IntegrationActionPicker";

vi.mock("@/hooks/i18n/useT", () => ({ useT: () => (text: string) => text }));

const fetchMock = vi.fn<typeof fetch>();

function action(index: number, enabled = true) {
  return {
    id: `a2440000-0000-4000-8000-${String(index).padStart(12, "0")}`,
    configuration: {
      name: `Ação ${index}`,
      description: `Descrição ${index}`,
      enabled,
      mutating: false,
    },
  };
}

function response(rows: ReturnType<typeof action>[]) {
  return new Response(JSON.stringify({ data: rows }), {
    headers: { "Content-Type": "application/json" },
  });
}

function pendingRequest() {
  let resolve!: (response: Response) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<Response>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

function mountPicker(props: Partial<ComponentProps<typeof IntegrationActionPicker>> = {}) {
  const onChange = vi.fn();
  const view = render(
    <IntegrationActionPicker value={[]} onChange={onChange} disabled={false} operatorEnabled={false} {...props} />,
  );
  return { ...view, onChange };
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("IntegrationActionPicker", () => {
  it("exibe carregamento até receber as ações e permite selecioná-las", async () => {
    const request = pendingRequest();
    fetchMock.mockReturnValueOnce(request.promise);
    const { onChange } = mountPicker();

    expect(screen.getByRole("status")).toHaveTextContent("Carregando ações…");
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledExactlyOnceWith("/api/v1/integration-actions", {
      signal: expect.any(AbortSignal),
    });

    await act(async () => { request.resolve(response([action(1)])); });
    const checkbox = await screen.findByRole("checkbox", { name: /Ação 1/ });
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(checkbox).toBeEnabled();
    await userEvent.setup().click(checkbox);
    expect(onChange).toHaveBeenCalledExactlyOnceWith([action(1).id]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("orienta a criar uma ação quando a lista está vazia", async () => {
    fetchMock.mockResolvedValueOnce(response([]));
    const { onChange } = mountPicker();

    expect(await screen.findByText("Crie uma ação para consultar pedidos, atualizar seu CRM ou conectar uma API.")).toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Gerenciar ações e credenciais" })).toHaveAttribute("href", "/app/integration-actions");
    expect(onChange).not.toHaveBeenCalled();
  });

  it.each(["http", "rede", "resposta inválida"])("preserva seleção na falha de %s e durante o retry", async failure => {
    if (failure === "rede") fetchMock.mockRejectedValueOnce(new Error("offline"));
    else fetchMock.mockResolvedValueOnce(failure === "http"
      ? new Response(null, { status: 503 })
      : new Response(JSON.stringify({ data: [{ id: "inválido" }] })));
    const retry = pendingRequest();
    fetchMock.mockReturnValueOnce(retry.promise);
    const selected = [action(1).id];
    const { onChange } = mountPicker({ value: selected });

    expect(await screen.findByRole("alert")).toHaveTextContent("Não foi possível carregar as ações. Sua seleção foi preservada.");
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Remover ações indisponíveis" })).not.toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();

    const firstSignal = fetchMock.mock.calls[0]?.[1]?.signal;
    await userEvent.setup().click(screen.getByRole("button", { name: "Tentar novamente" }));
    expect(screen.getByRole("status")).toHaveTextContent("Carregando ações…");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(firstSignal?.aborted).toBe(true);
    expect(fetchMock.mock.calls[1]?.[1]?.signal?.aborted).toBe(false);
    expect(onChange).not.toHaveBeenCalled();

    await act(async () => { retry.resolve(response([action(1), action(2)])); });
    expect(await screen.findByRole("checkbox", { name: /Ação 1/ })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: /Ação 2/ })).not.toBeChecked();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
    expect(selected).toEqual([action(1).id]);
  });

  it("avisa sobre ações pausadas ou ausentes e remove somente as indisponíveis", async () => {
    fetchMock.mockResolvedValueOnce(response([action(1), action(2, false), action(3, false)]));
    const selected = [action(1).id, action(2).id, action(4).id];
    const { onChange } = mountPicker({ value: selected });

    expect(await screen.findByRole("alert")).toHaveTextContent("Existem ações selecionadas que estão indisponíveis. Revise a seleção antes de publicar.");
    expect(screen.getByRole("checkbox", { name: /Ação 1/ })).toBeChecked();
    const pausedSelected = screen.getByRole("checkbox", { name: /Ação 2/ });
    expect(pausedSelected).toBeChecked();
    expect(pausedSelected).toBeEnabled();
    const pausedUnselected = screen.getByRole("checkbox", { name: /Ação 3/ });
    expect(pausedUnselected).not.toBeChecked();
    expect(pausedUnselected).toBeDisabled();
    expect(onChange).not.toHaveBeenCalled();

    const user = userEvent.setup();
    await user.click(pausedUnselected);
    expect(onChange).not.toHaveBeenCalled();
    await user.click(pausedSelected);
    expect(onChange).toHaveBeenLastCalledWith([action(1).id, action(4).id]);
    await user.click(screen.getByRole("button", { name: "Remover ações indisponíveis" }));
    expect(onChange).toHaveBeenLastCalledWith([action(1).id]);
    expect(selected).toEqual([action(1).id, action(2).id, action(4).id]);
  });

  it("bloqueia mudanças e remoção de indisponíveis quando desabilitado", async () => {
    fetchMock.mockResolvedValueOnce(response([action(1), action(2)]));
    const { onChange } = mountPicker({ value: [action(1).id, action(3).id], disabled: true });
    await screen.findByRole("alert");

    const user = userEvent.setup();
    for (const checkbox of screen.getAllByRole("checkbox")) {
      expect(checkbox).toBeDisabled();
      await user.click(checkbox);
    }
    const remove = screen.getByRole("button", { name: "Remover ações indisponíveis" });
    expect(remove).toBeDisabled();
    await user.click(remove);
    expect(onChange).not.toHaveBeenCalled();
  });

  it("permite chegar a 25 seleções, bloqueia a 26ª e libera espaço ao desmarcar", async () => {
    const rows = Array.from({ length: 26 }, (_, index) => action(index + 1));
    fetchMock.mockResolvedValueOnce(response(rows));
    const onChange = vi.fn();
    function ControlledPicker() {
      const [value, setValue] = useState(rows.slice(0, 24).map(row => row.id));
      return <IntegrationActionPicker value={value} onChange={ids => { onChange(ids); setValue(ids); }} disabled={false} operatorEnabled={false} />;
    }
    render(<ControlledPicker />);
    const user = userEvent.setup();
    const twentyFifth = await screen.findByRole("checkbox", { name: /^Ação 25(?!\d)/ });
    const twentySixth = screen.getByRole("checkbox", { name: /^Ação 26(?!\d)/ });
    expect(screen.getAllByRole("checkbox", { checked: true })).toHaveLength(24);
    expect(twentyFifth).toBeEnabled();
    expect(twentySixth).toBeEnabled();

    await user.click(twentyFifth);
    expect(onChange).toHaveBeenLastCalledWith(rows.slice(0, 25).map(row => row.id));
    expect(screen.getAllByRole("checkbox", { checked: true })).toHaveLength(25);
    expect(twentyFifth).toBeEnabled();
    expect(twentySixth).toBeDisabled();
    await user.click(twentySixth);
    expect(onChange).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole("checkbox", { name: /^Ação 1(?!\d)/ }));
    expect(screen.getAllByRole("checkbox", { checked: true })).toHaveLength(24);
    expect(twentySixth).toBeEnabled();
    await user.click(twentySixth);
    expect(onChange).toHaveBeenLastCalledWith(rows.slice(1).map(row => row.id));
    expect(screen.getAllByRole("checkbox", { checked: true })).toHaveLength(25);
    expect(screen.getByRole("checkbox", { name: /^Ação 1(?!\d)/ })).toBeDisabled();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it.each(["sucesso", "falha"])("cancela o fetch ao desmontar antes de um retorno de %s", async outcome => {
    const request = pendingRequest();
    fetchMock.mockReturnValueOnce(request.promise);
    const { unmount, container, onChange } = mountPicker({ value: [action(1).id] });
    const signal = fetchMock.mock.calls[0]?.[1]?.signal;
    expect(signal).toBeInstanceOf(AbortSignal);
    expect(signal?.aborted).toBe(false);
    const aborted = vi.fn();
    signal?.addEventListener("abort", aborted);

    unmount();
    expect(signal?.aborted).toBe(true);
    expect(aborted).toHaveBeenCalledTimes(1);
    await act(async () => {
      if (outcome === "sucesso") request.resolve(response([action(1)]));
      else request.reject(new DOMException("Requisição cancelada", "AbortError"));
    });
    expect(container).toBeEmptyDOMElement();
    expect(onChange).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
