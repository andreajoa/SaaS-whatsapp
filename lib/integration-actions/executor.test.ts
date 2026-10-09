import { describe, expect, it, vi } from "vitest";
import { executeRestAction, redactResult } from "./executor";
import { interpolate, validateTemplates } from "./interpolation";
import { isPublicAddress, parsePublicUrl, resolvePublicAddress, type Address, type SafeRequest, type SafeResponse } from "./network";
import { actionConfigSchema, executeSchema, IntegrationActionError, saveActionSchema, validateInputs, validInputSchema, type ActionConfig, type Json } from "./schema";

const base = (): ActionConfig => actionConfigSchema.parse({ name: "Consulta de pedido", description: "Consulta o status de um pedido na loja", method: "GET", mutating: false, url_template: "https://api.vendor.com/orders/{{input.order_id}}", input_schema: { type: "object", properties: { order_id: { type: "string" }, quantity: { type: "integer" } }, required: ["order_id"], additionalProperties: false }, result_mapping: { status: "order.status" } });
const dependencies = () => ({ resolve: vi.fn<(hostname: string) => Promise<Address[]>>(async () => [{ address: "93.184.216.34", family: 4 }]), transport: vi.fn<(input: SafeRequest) => Promise<SafeResponse>>(async () => ({ status: 200, body: '{"order":{"status":"paid"}}' })) });
const run = (config = base(), deps = dependencies()) => executeRestAction({ configuration: config, inputs: { order_id: "abc" }, credentialHeaders: {}, confirmMutation: false }, deps);

describe("integrações: SSRF", () => {
  it.each(["0.0.0.0", "10.0.0.1", "127.0.0.1", "100.64.0.1", "169.254.169.254", "172.16.1.1", "192.168.1.1", "192.0.2.1", "198.18.0.1", "198.51.100.1", "203.0.113.3", "224.0.0.1", "255.255.255.255", "::1", "::", "fc00::1", "fe80::1", "::ffff:127.0.0.1", "2001:db8::1", "2001::1", "2002:7f00:1::", "3fff::1", "not-an-ip"])("recusa endereço reservado %s", ip => expect(isPublicAddress(ip)).toBe(false));
  it.each(["8.8.8.8", "93.184.216.34", "2606:4700:4700::1111", "2001:4860:4860::8888"])("aceita endereço público %s", ip => expect(isPublicAddress(ip)).toBe(true));
  it.each(["http://api.vendor.com", "https://127.1", "https://2130706433", "https://0x7f000001", "https://[::1]", "https://user:pass@api.vendor.com", "https://api.vendor.com:8443", "https://api.vendor.com#fragment", "https://{{input.host}}/orders", "https://api.vendor.com/?api_key=secret", "https://localhost.local/", "https://api.vendor.com./", "https://api.vendor.com\\@127.0.0.1/"])("recusa URL %s", url => expect(() => parsePublicUrl(url)).toThrow());
  it("recusa conjunto DNS misto, mesmo com primeiro IP público", async () => {
    await expect(resolvePublicAddress(parsePublicUrl("https://api.vendor.com"), async () => [{ address: "93.184.216.34", family: 4 }, { address: "10.0.0.1", family: 4 }])).rejects.toMatchObject({ code: "unsafe_dns" });
  });
  it("DNS privado impede transporte e informa erro seguro", async () => {
    const deps = dependencies(); deps.resolve.mockResolvedValue([{ address: "169.254.169.254", family: 4 }]);
    expect(await run(base(), deps)).toMatchObject({ success: false, error_code: "unsafe_dns", outcome_uncertain: false });
    expect(deps.transport).not.toHaveBeenCalled();
  });
  it("redirecionamento não é resultado válido", async () => {
    const deps = dependencies(); deps.transport.mockResolvedValue({ status: 302, body: "https://127.0.0.1" });
    expect(await run(base(), deps)).toMatchObject({ success: false, error_code: "redirect_blocked" });
    expect(deps.transport).toHaveBeenCalledTimes(1);
  });
});

describe("integrações: schema e interpolação", () => {
  it("schema fecha propriedades e rejeita nomes de segredo/tenant", () => {
    expect(validInputSchema({ type: "object", properties: {}, additionalProperties: true })).toBe(false);
    for (const key of ["authorization", "secret", "organization_id", "constructor", "api_key"]) expect(validInputSchema({ type: "object", properties: { [key]: { type: "string" } }, additionalProperties: false })).toBe(false);
  });
  it("não aceita tenant, headers ou bearer no body de execução", () => {
    for (const key of ["organization_id", "credential_headers", "authorization", "url"]) expect(executeSchema.safeParse({ inputs: {}, [key]: "attacker" }).success).toBe(false);
    expect(saveActionSchema.safeParse({ configuration: base(), organization_id: "attacker" }).success).toBe(false);
  });
  it("tipos não são coercidos e extras são recusados", () => {
    expect(() => validateInputs(base().input_schema, { order_id: "a", quantity: "2" })).toThrow();
    expect(() => validateInputs(base().input_schema, { order_id: "a", authorization: "Bearer attacker" })).toThrow();
    expect(() => validateInputs(base().input_schema, {})).toThrow();
  });
  it("usa encodeURIComponent nos valores da URL e conserva origem", async () => {
    const deps = dependencies();
    await executeRestAction({ configuration: base(), inputs: { order_id: "a/b?x=1#abc" }, credentialHeaders: {}, confirmMutation: false }, deps);
    expect(deps.transport.mock.calls[0]?.[0].url.href).toBe("https://api.vendor.com/orders/a%2Fb%3Fx%3D1%23abc");
  });
  it.each([".", ".."])("não permite segmento de navegação %s", value => {
    expect(() => interpolate("{{input.order_id}}", base(), { order_id: value }, {}, true)).toThrow();
  });
  it("JSON tipado não vira string e não interpreta conteúdo do input", () => {
    expect(interpolate({ count: "{{input.quantity}}", note: "{{input.order_id}}" }, base(), { order_id: '{{context.agent_id}}"}', quantity: 2 }, {})).toEqual({ count: 2, note: '{{context.agent_id}}"}' });
  });
  it("não permite caminhos arbitrários de ambiente ou segredo", () => {
    for (const placeholder of ["{{env.API_KEY}}", "{{input.secret}}", "{{context.secret}}", "{{input.order_id.__proto__}}", "{{invalid}}"])
      expect(() => validateTemplates({ ...base(), body_template: { value: placeholder } })).toThrow();
  });
  it("contexto usa chave autorizada e valor confiável, nunca o body", () => {
    const config = { ...base(), allowed_context_keys: ["lead_id" as const] };
    expect(interpolate("{{context.lead_id}}", config, {}, { lead_id: "trusted" })).toBe("trusted");
    expect(() => interpolate("{{context.agent_id}}", config, {}, { agent_id: "trusted" })).toThrow();
  });
  it("método que altera dados não pode ser rotulado como leitura", () => {
    for (const method of ["POST", "PUT", "PATCH", "DELETE"]) expect(actionConfigSchema.safeParse({ ...base(), method }).success).toBe(false);
  });
});

describe("integrações: execução e segredos", () => {
  it("revalida autorização depois do DNS suspenso e antes do transporte", async () => {
    const deps = dependencies();
    let release!: (addresses: Address[]) => void;
    deps.resolve.mockImplementation(() => new Promise(resolve => { release = resolve; }));
    let authorized = true;
    const authorizeBeforeDispatch = vi.fn(async () => {
      if (!authorized) throw new IntegrationActionError("authorization_revoked", "Autorização revogada.", 403);
    });
    const running = executeRestAction({ configuration: { ...base(), method: "POST", mutating: true }, inputs: { order_id: "a" }, credentialHeaders: {}, confirmMutation: true, authorizeBeforeDispatch }, deps);
    expect(authorizeBeforeDispatch).not.toHaveBeenCalled();
    authorized = false;
    release([{ address: "93.184.216.34", family: 4 }]);
    expect(await running).toMatchObject({ success: false, error_code: "authorization_revoked", outcome_uncertain: false });
    expect(authorizeBeforeDispatch).toHaveBeenCalledTimes(1);
    expect(deps.transport).not.toHaveBeenCalled();
  });
  it("timeout durante a guarda não permite despacho quando ela termina", async () => {
    vi.useFakeTimers();
    try {
      const deps = dependencies();
      let release!: () => void;
      const authorizeBeforeDispatch = vi.fn(() => new Promise<void>(resolve => { release = resolve; }));
      const running = executeRestAction({ configuration: base(), inputs: { order_id: "a" }, credentialHeaders: {}, confirmMutation: false, authorizeBeforeDispatch }, deps);
      await vi.advanceTimersByTimeAsync(10001);
      expect(await running).toMatchObject({ error_code: "execution_timeout", outcome_uncertain: false });
      release();
      await vi.advanceTimersByTimeAsync(0);
      expect(deps.transport).not.toHaveBeenCalled();
    } finally { vi.useRealTimers(); }
  });
  it("redige chaves recursivas com segredo inteiro, sem Bearer e URL encoded", () => {
    const secret = "abc123/x+y";
    const keys = ["Bearer " + secret, secret, encodeURIComponent("Bearer " + secret), encodeURIComponent(secret)];
    const raw = { nested: keys.map(key => ({ ["echo-" + key]: { [key]: "ok" } })) };
    const serialized = JSON.stringify(redactResult(raw, { Authorization: "Bearer " + secret }));
    for (const key of keys) expect(serialized).not.toContain(key);
    expect(serialized).toContain("ok");
  });
  it("result_mapping não reintroduz segredo em chave de saída", async () => {
    const deps = dependencies();
    const result = await executeRestAction({ configuration: { ...base(), result_mapping: { echo_abc123: "order.status" } }, inputs: { order_id: "a" }, credentialHeaders: { Authorization: "Bearer abc123" }, confirmMutation: false }, deps);
    expect(result.success).toBe(true);
    expect(JSON.stringify(result)).not.toContain("abc123");
    expect(Object.values(result.data as Record<string, Json>)).toContain("paid");
  });
  it("consulta executa com IP fixado e retorno mapeado", async () => {
    const deps = dependencies();
    expect(await run(base(), deps)).toMatchObject({ success: true, http_status: 200, data: { status: "paid" }, outcome_uncertain: false });
    expect(deps.resolve).toHaveBeenCalledTimes(1);
    expect(deps.transport.mock.calls[0]?.[0]).toMatchObject({ address: { address: "93.184.216.34", family: 4 }, method: "GET", headers: { "accept-encoding": "identity" } });
  });
  it("credencial armazenada prevalece sem aceitar bearer em inputs", async () => {
    const deps = dependencies();
    await executeRestAction({ configuration: base(), inputs: { order_id: "a" }, credentialHeaders: { Authorization: "Bearer stored-value" }, confirmMutation: false }, deps);
    expect(deps.transport.mock.calls[0]?.[0].headers.authorization).toBe("Bearer stored-value");
    await expect(executeRestAction({ configuration: base(), inputs: { order_id: "a", authorization: "Bearer overwrite" }, credentialHeaders: {}, confirmMutation: false }, deps)).rejects.toMatchObject({ code: "invalid_inputs" });
    expect(deps.transport).toHaveBeenCalledTimes(1);
  });
  it("públicos não podem sobrescrever credenciais nem injetar CRLF", async () => {
    expect(actionConfigSchema.safeParse({ ...base(), public_headers: { Authorization: "Bearer overwrite" } }).success).toBe(false);
    const deps = dependencies();
    await expect(executeRestAction({ configuration: { ...base(), public_headers: { "X-Correlation-Id": "{{input.order_id}}" } }, inputs: { order_id: "x\r\nAuthorization: bad" }, credentialHeaders: {}, confirmMutation: false }, deps)).rejects.toMatchObject({ code: "invalid_header" });
    expect(deps.transport).not.toHaveBeenCalled();
  });
  it("segredo ecoado e chave renomeada são redigidos antes do mapping", async () => {
    const deps = dependencies(); deps.transport.mockResolvedValue({ status: 200, body: '{"access_token":"private-token-123","echo":"Bearer private-token-123","token_copy":"private-token-123"}' });
    const result = await executeRestAction({ configuration: { ...base(), result_mapping: { renamed: "access_token", echo: "echo" } }, inputs: { order_id: "a" }, credentialHeaders: { Authorization: "Bearer private-token-123" }, confirmMutation: false }, deps);
    expect(JSON.stringify(result)).not.toContain("private-token-123");
    expect(result.data).toEqual({ renamed: "[redigido]", echo: "[redigido]" });
  });
  it("redige até em string aninhada e string codificada", () => {
    const clean = redactResult({ nested: ["secretvalue", "Bearer%20secretvalue"], authorization: "other" }, { Authorization: "Bearer secretvalue" });
    expect(JSON.stringify(clean)).not.toContain("secretvalue");
    expect(clean).toMatchObject({ authorization: "[redigido]" });
  });
  it("mutações precisam de confirmação antes de DNS ou transporte", async () => {
    const deps = dependencies();
    await expect(run({ ...base(), method: "POST", mutating: true }, deps)).rejects.toMatchObject({ code: "mutation_confirmation_required" });
    expect(deps.resolve).not.toHaveBeenCalled(); expect(deps.transport).not.toHaveBeenCalled();
  });
  it("mutação confirmada recebe body JSON e chave de idempotência fixa", async () => {
    const deps = dependencies();
    await executeRestAction({ configuration: { ...base(), method: "POST", mutating: true, body_template: { quantity: "{{input.quantity}}" } }, inputs: { order_id: "a", quantity: 2 }, credentialHeaders: {}, confirmMutation: true, executionId: "dedicated-id" }, deps);
    expect(deps.transport.mock.calls[0]?.[0]).toMatchObject({ method: "POST", body: '{"quantity":2}', headers: { "idempotency-key": "dedicated-id", "content-type": "application/json" } });
  });
  it("sem repetição automática; falha de rede de mutação declara incerteza", async () => {
    const deps = dependencies(); deps.transport.mockRejectedValue(new Error("error contains secret-value"));
    const result = await executeRestAction({ configuration: { ...base(), method: "POST", mutating: true }, inputs: { order_id: "a" }, credentialHeaders: {}, confirmMutation: true }, deps);
    expect(result).toMatchObject({ success: false, outcome_uncertain: true, error_code: "upstream_unavailable" });
    expect(result.message).not.toContain("secret-value"); expect(deps.transport).toHaveBeenCalledTimes(1);
  });
  it("recusa resposta acima do limite e resultado não JSON", async () => {
    const deps = dependencies(); deps.transport.mockResolvedValue({ status: 200, body: "x".repeat(70000) });
    expect(await run(base(), deps)).toMatchObject({ error_code: "response_too_large" });
    deps.transport.mockResolvedValue({ status: 200, body: "<html>secret</html>" });
    expect(await run(base(), deps)).toMatchObject({ error_code: "invalid_json_response", data: null });
  });
  it("prazo inclui resolução DNS travada", async () => {
    vi.useFakeTimers();
    try {
      const deps = dependencies(); deps.resolve.mockImplementation(() => new Promise(() => {}));
      const running = run(base(), deps);
      await vi.advanceTimersByTimeAsync(10001);
      expect(await running).toMatchObject({ error_code: "execution_timeout", outcome_uncertain: false });
      expect(deps.transport).not.toHaveBeenCalled();
    } finally { vi.useRealTimers(); }
  });
});
