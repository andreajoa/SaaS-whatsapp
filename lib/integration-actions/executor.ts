import { randomUUID } from "node:crypto";
import { interpolate, validateTemplates } from "./interpolation";
import { parsePublicUrl, requestPinned, resolvePublicAddress, type Resolver, type SafeRequest, type SafeResponse } from "./network";
import { actionConfigSchema, credentialsSchema, IntegrationActionError, readPath, validateInputs, type ActionConfig, type ContextVariables, type Json } from "./schema";

export interface ExecutionResult {
  execution_id: string;
  success: boolean;
  http_status: number | null;
  duration_ms: number;
  data: Json;
  error_code: string | null;
  message: string | null;
  /** Falha após o despacho não prova que o fornecedor não aplicou a mutação. */
  outcome_uncertain: boolean;
}
export interface ExecutorDependencies { resolve?: Resolver; transport?: (input: SafeRequest) => Promise<SafeResponse>; }
const SENSITIVE = /authorization|cookie|password|secret|token|api[-_]?key|credential/i;

/** Higieniza chaves E valores: fornecedores podem ecoar o bearer como string comum. */
export function redactResult(value: unknown, credentials: Record<string, string>, depth = 0): Json {
  const fragments = Object.values(credentials).flatMap(v => [v, v.replace(/^Bearer\s+/i, ""), encodeURIComponent(v), encodeURIComponent(v.replace(/^Bearer\s+/i, ""))]).filter(Boolean);
  if (depth > 8) return "[limite de profundidade]";
  if (typeof value === "string") {
    let result = value;
    for (const secret of fragments.sort((a, b) => b.length - a.length)) result = result.split(secret).join("[redigido]");
    return result.slice(0, 8192);
  }
  if (value === null || typeof value === "boolean") return value;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (Array.isArray(value)) return value.slice(0, 100).map(v => redactResult(v, credentials, depth + 1));
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).slice(0, 100).map(([k, v]) => [redactResult(k, credentials) as string, SENSITIVE.test(k) ? "[redigido]" : redactResult(v, credentials, depth + 1)]));
  return null;
}

export async function executeRestAction(input: {
  configuration: ActionConfig;
  inputs: Record<string, Json>;
  credentialHeaders: Record<string, string>;
  contextVariables?: ContextVariables;
  confirmMutation: boolean;
  executionId?: string;
  /** Revalidação live do serviço/chamador; roda após DNS, dentro da deadline. */
  authorizeBeforeDispatch?: () => Promise<void>;
}, dependencies: ExecutorDependencies = {}): Promise<ExecutionResult> {
  const started = Date.now();
  const executionId = input.executionId ?? randomUUID();
  const config = actionConfigSchema.parse(input.configuration);
  validateInputs(config.input_schema, input.inputs);
  if (Buffer.byteLength(JSON.stringify(input.inputs)) > 65536) throw new IntegrationActionError("invalid_inputs", "Entradas excedem o limite permitido.", 400);
  if (config.mutating && !input.confirmMutation) throw new IntegrationActionError("mutation_confirmation_required", "Esta operação altera dados no fornecedor. Confirme antes de executar.", 409);
  validateTemplates(config);
  const credentials = credentialsSchema.parse(input.credentialHeaders);
  const fixedOrigin = parsePublicUrl(config.url_template).origin;
  const url = parsePublicUrl(String(interpolate(config.url_template, config, input.inputs, input.contextVariables ?? {}, true)));
  if (url.origin !== fixedOrigin) throw new IntegrationActionError("unsafe_url", "Variáveis não podem alterar o domínio de destino.");
  const headers: Record<string, string> = { accept: "application/json", "accept-encoding": "identity" };
  for (const [key, template] of Object.entries(config.public_headers)) {
    const value = interpolate(template, config, input.inputs, input.contextVariables ?? {});
    if (typeof value !== "string" || /[\r\n\x00]/.test(value)) throw new IntegrationActionError("invalid_header", "Valor inválido de cabeçalho.");
    headers[key.toLowerCase()] = value;
  }
  for (const [key, value] of Object.entries(credentials)) {
    if (Object.hasOwn(config.public_headers, key) || Object.keys(config.public_headers).some(k => k.toLowerCase() === key.toLowerCase())) throw new IntegrationActionError("credential_override", "Cabeçalhos públicos não podem sobrescrever credenciais.");
    headers[key.toLowerCase()] = value;
  }
  // O modelo não controla headers, bearer, timeout ou endereço.
  if (config.mutating) headers["idempotency-key"] = executionId;
  const body = config.body_template === null ? undefined : JSON.stringify(interpolate(config.body_template as Json, config, input.inputs, input.contextVariables ?? {}));
  if (body && Buffer.byteLength(body) > 65536) throw new IntegrationActionError("request_too_large", "Corpo excede o limite permitido.");
  if (body && !headers["content-type"]) headers["content-type"] = "application/json";
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.timeout_ms);
  let dispatched = false;
  let status: number | null = null;
  try {
    // A deadline inclui DNS, conexão TLS e leitura do corpo, não só o socket.
    const response = await new Promise<SafeResponse>((resolve, reject) => {
      controller.signal.addEventListener("abort", () => reject(new IntegrationActionError("execution_timeout", "O fornecedor não respondeu dentro do prazo.")), { once: true });
      void (async () => {
        const address = await resolvePublicAddress(url, dependencies.resolve);
        controller.signal.throwIfAborted();
        await input.authorizeBeforeDispatch?.();
        controller.signal.throwIfAborted();
        dispatched = true;
        return (dependencies.transport ?? requestPinned)({ url, address, method: config.method, headers, body, signal: controller.signal, maxBytes: config.max_response_bytes });
      })().then(resolve, reject);
    });
    status = response.status;
    if (status >= 300 && status < 400) throw new IntegrationActionError("redirect_blocked", "Redirecionamento recusado. Configure o endereço final.");
    if (Buffer.byteLength(response.body) > config.max_response_bytes) throw new IntegrationActionError("response_too_large", "Resposta excede o limite configurado.");
    if (status < 200 || status >= 300) throw new IntegrationActionError("upstream_http_error", "O fornecedor recusou a operação. Confira a configuração e as credenciais.");
    let raw: unknown = null;
    if (response.body.trim()) {
      try { raw = JSON.parse(response.body); } catch { throw new IntegrationActionError("invalid_json_response", "O fornecedor não devolveu JSON válido."); }
    }
    // Primeiro redige, depois seleciona: mapear token para "resultado" não contorna a proteção.
    const clean = redactResult(raw, credentials);
    // Nomes de saída são configuração: também podem conter a credencial ecoada.
    let result = redactResult(Object.keys(config.result_mapping).length ? Object.fromEntries(Object.entries(config.result_mapping).map(([key, path]) => [key, readPath(clean, path) ?? null])) : clean, credentials);
    if (Buffer.byteLength(JSON.stringify(result)) > 32768) result = { summary: "Resultado excede o limite de exibição. Configure os campos de retorno." };
    return { execution_id: executionId, success: true, http_status: status, duration_ms: Date.now() - started, data: result, error_code: null, message: null, outcome_uncertain: false };
  } catch (error) {
    const known = error instanceof IntegrationActionError;
    return { execution_id: executionId, success: false, http_status: status, duration_ms: Date.now() - started, data: null, error_code: known ? error.code : "upstream_unavailable", message: known ? error.message : "Não foi possível concluir a chamada ao fornecedor.", outcome_uncertain: dispatched && config.mutating };
  } finally { clearTimeout(timer); }
}
