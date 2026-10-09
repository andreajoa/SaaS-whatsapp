import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { IntegrationActionsClient } from "./IntegrationActionsClient";
import { actionConfigSchema } from "@/lib/integration-actions/schema";

vi.mock("@/hooks/i18n/useT", () => ({ useT: () => (v: string) => v }));
vi.mock("@/lib/i18n/IdiomaProvider", () => ({ useIdioma: () => "pt-BR" }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
function setup(mutating = false) {
  const row = { id: "a2440000-0000-4000-8000-000000000002", organization_id: "a2440000-0000-4000-8000-000000000001", credential_header_names: ["Authorization"], configuration: actionConfigSchema.parse({ name: "Consulta de pedido", description: "Consulta pedidos na loja", url_template: "https://api.vendor.com/orders/{{input.order_id}}", method: mutating ? "POST" : "GET", mutating, enabled: true, input_schema: { type: "object", properties: { order_id: { type: "string" } }, required: ["order_id"], additionalProperties: false } }) };
  const fetch = vi.fn(async (path: RequestInfo | URL, init?: RequestInit) => new Response(JSON.stringify({ data: init?.method === "POST" ? { execution_id: "run", success: true, data: { status: "paid" } } : String(path).endsWith("/history") ? [] : [row] }), { headers: { "Content-Type": "application/json" } }));
  vi.stubGlobal("fetch", fetch);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(<QueryClientProvider client={client}><IntegrationActionsClient /></QueryClientProvider>);
  return { fetch, client };
}
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
describe("interface de ações", () => {
  it("abrir e selecionar não executa, credencial existente nunca é preenchida", async () => {
    const { fetch, client } = setup();
    fireEvent.click(await screen.findByRole("button", { name: /Consulta de pedido/ }));
    expect(screen.getByLabelText("Cabeçalhos de credenciais (JSON)")).toHaveValue("");
    expect(screen.getByText(/Cabeçalhos configurados:/)).toHaveTextContent("Authorization");
    expect(fetch.mock.calls.every(([, init]) => init?.method === "GET")).toBe(true);
    client.clear();
  });
  it("mutação não pode ser testada sem confirmação; chamada explícita recebe confirmação", async () => {
    const { fetch, client } = setup(true);
    fireEvent.click(await screen.findByRole("button", { name: /Consulta de pedido/ }));
    const test = screen.getByRole("button", { name: "Testar chamada real" });
    expect(test).toBeDisabled(); expect(screen.getByRole("button", { name: "Executar ação" })).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Entradas do teste ou execução (JSON)"), { target: { value: '{"order_id":"123"}' } });
    fireEvent.click(screen.getByLabelText("Confirmo a chamada real que altera dados no fornecedor, inclusive no teste."));
    expect(test).toBeEnabled(); fireEvent.click(test);
    await waitFor(() => expect(fetch.mock.calls.some(([path, init]) => String(path).endsWith("/test") && init?.method === "POST")).toBe(true));
    const request = fetch.mock.calls.find(([path]) => String(path).endsWith("/test"));
    expect(JSON.parse(String(request?.[1]?.body))).toEqual({ inputs: { order_id: "123" }, confirm_mutation: true });
    client.clear();
  });
  it("mudar entradas revoga confirmação de mutação", async () => {
    const { client } = setup(true);
    fireEvent.click(await screen.findByRole("button", { name: /Consulta de pedido/ }));
    fireEvent.click(screen.getByLabelText("Confirmo a chamada real que altera dados no fornecedor, inclusive no teste."));
    expect(screen.getByRole("button", { name: "Testar chamada real" })).toBeEnabled();
    fireEvent.change(screen.getByLabelText("Entradas do teste ou execução (JSON)"), { target: { value: '{"order_id":"456"}' } });
    expect(screen.getByRole("button", { name: "Testar chamada real" })).toBeDisabled();
    client.clear();
  });
});
