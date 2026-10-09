import { EventEmitter } from "node:events";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { request } from "node:https";
import { requestPinned, type SafeRequest } from "./network";

vi.mock("node:https", () => { const request = vi.fn(); return { request, default: { request } }; });
const mockRequest = vi.mocked(request);
const input = (): SafeRequest => ({ url: new URL("https://api.vendor.com/v1"), address: { address: "93.184.216.34", family: 4 }, method: "GET", headers: {}, signal: new AbortController().signal, maxBytes: 1024 });

function response(status: number, headers: Record<string, string> = {}, body = "{}") {
  const stream = Object.assign(new EventEmitter(), { statusCode: status, headers, destroy: vi.fn() });
  const req = Object.assign(new EventEmitter(), { end: vi.fn(() => { queueMicrotask(() => { stream.emit("data", Buffer.from(body)); stream.emit("end"); }); }) });
  mockRequest.mockImplementation(((...args: unknown[]) => {
    const callback = args.find(v => typeof v === "function") as ((res: typeof stream) => void) | undefined;
    if (!callback) throw new Error(`Mock HTTPS recebeu ${args.length} argumentos sem callback.`);
    callback(stream); return req;
  }) as unknown as typeof request);
  return { stream, req };
}
beforeEach(() => { mockRequest.mockReset(); });
describe("transporte HTTPS fixado", () => {
  it("conecta ao IP validado mantendo URL/host TLS e sem agente/proxy", async () => {
    response(200);
    expect(await requestPinned(input())).toEqual({ status: 200, body: "{}" });
    const args = mockRequest.mock.calls[0] as unknown as unknown[];
    const opts = args.find(v => !!v && typeof v === "object" && "lookup" in v) as { hostname?: string; family: number; agent: boolean; lookup: (host: string, options: unknown, cb: (error: Error | null, address: string, family: number) => void) => void };
    const url = args.find(v => v instanceof URL) as URL | undefined;
    expect(url?.hostname ?? opts.hostname).toBe("api.vendor.com"); expect(opts.agent).toBe(false); expect(opts.family).toBe(4);
    const callback = vi.fn(); opts.lookup("rebound.internal", {}, callback);
    expect(callback).toHaveBeenCalledWith(null, "93.184.216.34", 4);
  });
  it("não segue redirect nem aceita socket privado", async () => {
    const fake = response(302, { location: "https://127.0.0.1" });
    await expect(requestPinned(input())).rejects.toMatchObject({ code: "redirect_blocked" });
    expect(fake.stream.destroy).toHaveBeenCalled(); expect(mockRequest).toHaveBeenCalledTimes(1);
    await expect(requestPinned({ ...input(), address: { address: "127.0.0.1", family: 4 } })).rejects.toMatchObject({ code: "unsafe_dns" });
    expect(mockRequest).toHaveBeenCalledTimes(1);
  });
  it("limita bytes durante o streaming sem depender de Content-Length", async () => {
    const fake = response(200, {}, "x".repeat(1025));
    await expect(requestPinned(input())).rejects.toMatchObject({ code: "response_too_large" });
    expect(fake.stream.destroy).toHaveBeenCalled();
  });
  it("recusa Content-Length grande antes da leitura e respostas comprimidas", async () => {
    response(200, { "content-length": "1025" });
    await expect(requestPinned(input())).rejects.toMatchObject({ code: "response_too_large" });
    response(200, { "content-encoding": "gzip" });
    await expect(requestPinned(input())).rejects.toMatchObject({ code: "unsupported_response" });
  });
});
