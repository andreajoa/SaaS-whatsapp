// @vitest-environment node
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  executar: vi.fn(),
  audit: vi.fn(),
  role: vi.fn(),
  user: vi.fn(),
  support: vi.fn(),
}));

vi.mock("@/lib/relogio/executar", () => ({ executarTickDoRelogio: mocks.executar }));
vi.mock("@/lib/audit", () => ({ audit: mocks.audit }));
vi.mock("@/lib/auth/require-role", () => ({ requireRole: mocks.role }));
vi.mock("@/lib/auth/server", () => ({ loadAuthUser: mocks.user }));
vi.mock("@/lib/impersonate/support", () => ({ requireSupportWrite: mocks.support }));
vi.mock("@/lib/env", () => ({
  env: { INTERNAL_CRON_SECRET: "cron-secret-de-teste", INTERNAL_SECRET: "internal-secret-de-teste" },
}));

import { GET, POST } from "./route";

function pedido(headers: Record<string, string> = { authorization: "Bearer cron-secret-de-teste" }) {
  return new NextRequest("https://app.example/api/v1/system/relogio/tick", {
    method: "POST",
    headers,
  });
}

describe("tick HTTP — falha de tarefa não vira sucesso do agendador", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.support.mockResolvedValue(null);
    mocks.role.mockResolvedValue({ ok: false });
    mocks.user.mockResolvedValue({ id: "admin-de-teste" });
    mocks.audit.mockResolvedValue(undefined);
    mocks.executar.mockResolvedValue({ tarefas: [], mexeu: false });
  });

  it("devolve 500 com ids/status seguros e audita efeitos anteriores à falha", async () => {
    const tarefas = [
      { id: "event-log-drain", ok: true, detalhe: "conteúdo privado de uma mensagem" },
      { id: "followup-flow-worker", ok: false, detalhe: "senha=segredo-em-detalhe telefone=5511999999999" },
    ];
    mocks.executar.mockResolvedValue({ tarefas, mexeu: true });

    const res = await POST(pedido());
    expect(res.status).toBe(500);
    expect(res.ok).toBe(false);
    const corpo = await res.json();
    expect(corpo).toEqual({
      error: {
        code: "internal_error",
        message: expect.any(String),
        details: { tarefas: tarefas.map(({ id, ok }) => ({ id, ok })) },
      },
    });
    expect(JSON.stringify(corpo)).not.toContain("segredo-em-detalhe");
    expect(JSON.stringify(corpo)).not.toContain("conteúdo privado");
    expect(mocks.audit).toHaveBeenCalledOnce();
    expect(mocks.audit).toHaveBeenCalledWith(expect.objectContaining({
      action: "relogio.tick_run",
      requestId: res.headers.get("X-Request-Id"),
      metadata: { tarefas: tarefas.map(({ id, ok }) => ({ id, ok })) },
    }));
    expect(mocks.user).not.toHaveBeenCalled();
  });

  it("despacho sem configuração também falha mesmo sem efeitos para auditar", async () => {
    mocks.executar.mockResolvedValue({
      tarefas: [{ id: "despacho-http", ok: false, detalhe: "configuração interna" }],
      mexeu: false,
    });
    const res = await POST(pedido());
    expect(res.status).toBe(500);
    expect((await res.json()).error.details.tarefas).toEqual([{ id: "despacho-http", ok: false }]);
    expect(mocks.audit).not.toHaveBeenCalled();
  });

  it("preserva resposta de sucesso e não trata orçamento adiado como falha", async () => {
    const resultado = {
      tarefas: [
        { id: "routing-worker", ok: true },
        { id: "orcamento", ok: true, detalhe: "2 tarefas ficaram para o próximo tick" },
      ],
      mexeu: false,
    };
    mocks.executar.mockResolvedValue(resultado);
    const res = await POST(pedido());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ data: resultado });
    expect(res.headers.get("X-Request-Id")).toBeTruthy();
    expect(mocks.audit).not.toHaveBeenCalled();
  });

  it("GET de cron externo conserva a mesma sinalização de falha", async () => {
    mocks.executar.mockResolvedValue({ tarefas: [{ id: "routing-worker", ok: false }], mexeu: false });
    const res = await GET(pedido({ "x-cron-secret": "internal-secret-de-teste" }));
    expect(res.status).toBe(500);
    expect(mocks.executar).toHaveBeenCalledOnce();
    expect(mocks.role).not.toHaveBeenCalled();
  });

  it("não expõe detalhes de uma exceção inesperada no corpo do erro", async () => {
    mocks.executar.mockRejectedValue(new Error("conexão password=segredo-privado"));
    const res = await POST(pedido());
    expect(res.status).toBe(500);
    const corpo = await res.json();
    expect(corpo.error.code).toBe("internal_error");
    expect(JSON.stringify(corpo)).not.toContain("segredo-privado");
    expect(res.headers.get("X-Request-Id")).toBeTruthy();
  });

  it("segredo errado e sessão recusada não executam nem auditam o tick", async () => {
    const res = await POST(pedido({ authorization: "Bearer errado" }));
    expect(res.status).toBe(403);
    expect(mocks.executar).not.toHaveBeenCalled();
    expect(mocks.audit).not.toHaveBeenCalled();
    expect(mocks.role).toHaveBeenCalledWith("admin", expect.objectContaining({
      resource: "system_relogio_tick", allowPlatformAdmin: true,
    }));
  });

  it("sessão admin aceita mantém autor da auditoria mesmo com falha parcial", async () => {
    mocks.role.mockResolvedValue({ ok: true });
    mocks.executar.mockResolvedValue({ tarefas: [{ id: "routing-worker", ok: false }], mexeu: true });
    const res = await POST(pedido({}));
    expect(res.status).toBe(500);
    expect(mocks.audit).toHaveBeenCalledWith(expect.objectContaining({ actorUserId: "admin-de-teste" }));
  });

  it("suporte somente leitura continua barrado antes de executar o tick", async () => {
    const recusa = new Response(null, { status: 403 });
    mocks.support.mockResolvedValue(recusa);
    expect(await POST(pedido())).toBe(recusa);
    expect(mocks.executar).not.toHaveBeenCalled();
    expect(mocks.role).not.toHaveBeenCalled();
  });
});
