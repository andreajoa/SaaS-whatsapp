import { z } from "zod";

export class IntegrationActionError extends Error {
  constructor(public code: string, message: string, public status = 422) {
    super(message);
  }
}

export const CONTEXT_KEYS = ["contact_id", "conversation_id", "lead_id", "agent_id"] as const;
export type ContextVariables = Partial<Record<(typeof CONTEXT_KEYS)[number], string>>;
export type Json = null | boolean | number | string | Json[] | { [key: string]: Json };
export interface InputSchema {
  type: "object" | "array" | "string" | "number" | "integer" | "boolean";
  description?: string;
  properties?: Record<string, InputSchema>;
  required?: string[];
  additionalProperties?: false;
  items?: InputSchema;
  enum?: (string | number | boolean)[];
}

const KEY = /^[a-zA-Z][a-zA-Z0-9_]{0,63}$/;
const FORBIDDEN = /^(?:__proto__|prototype|constructor|authorization|proxy_authorization|cookie|password|secret|secrets|token|access_token|refresh_token|api_key|organization_id)$/i;
export function safeKey(key: string): boolean { return KEY.test(key) && !FORBIDDEN.test(key); }

/** Sous-conjunto explícito de JSON Schema. Sem coerção nem propriedades implícitas. */
export function validInputSchema(value: unknown, depth = 0): value is InputSchema {
  if (!value || typeof value !== "object" || Array.isArray(value) || depth > 6) return false;
  const s = value as InputSchema;
  if (Object.keys(s).some(k => !["type", "description", "properties", "required", "additionalProperties", "items", "enum"].includes(k))) return false;
  if (!["object", "array", "string", "number", "integer", "boolean"].includes(s.type)) return false;
  if (s.description !== undefined && (typeof s.description !== "string" || s.description.length > 500)) return false;
  if (s.enum && (!Array.isArray(s.enum) || s.enum.length > 30 || s.enum.some(v => !["string", "number", "boolean"].includes(typeof v)))) return false;
  if (s.type === "object") {
    if (!s.properties || typeof s.properties !== "object" || Array.isArray(s.properties) || s.additionalProperties !== false) return false;
    if (Object.keys(s.properties).length > 30 || !Object.entries(s.properties).every(([k, v]) => safeKey(k) && validInputSchema(v, depth + 1))) return false;
    if (s.required && (!Array.isArray(s.required) || !s.required.every(k => typeof k === "string" && Object.hasOwn(s.properties!, k)))) return false;
  } else if (s.properties || s.required || s.additionalProperties !== undefined) return false;
  if (s.type === "array") return !!s.items && validInputSchema(s.items, depth + 1);
  return !s.items;
}

export function validateInputs(schema: InputSchema, value: unknown, depth = 0): asserts value is Json {
  const invalid = () => { throw new IntegrationActionError("invalid_inputs", "As entradas não correspondem ao schema configurado.", 400); };
  if (depth > 7) invalid();
  if (schema.type === "object") {
    if (!value || typeof value !== "object" || Array.isArray(value)) invalid();
    const obj = value as Record<string, unknown>;
    if (Object.keys(obj).some(k => !Object.hasOwn(schema.properties!, k))) invalid();
    if (schema.required?.some(k => !Object.hasOwn(obj, k))) invalid();
    for (const [k, v] of Object.entries(obj)) validateInputs(schema.properties![k]!, v, depth + 1);
  } else if (schema.type === "array") {
    if (!Array.isArray(value) || value.length > 100) invalid();
    for (const v of value as unknown[]) validateInputs(schema.items!, v, depth + 1);
  } else {
    const kind = schema.type === "integer" ? "number" : schema.type;
    if (typeof value !== kind || (kind === "string" && (value as string).length > 8192) || (kind === "number" && !Number.isFinite(value))) invalid();
    if (schema.type === "integer" && !Number.isInteger(value)) invalid();
  }
  if (schema.enum && !schema.enum.includes(value as string | number | boolean)) invalid();
}

const headerName = z.string().regex(/^[A-Za-z0-9-]{1,80}$/);
const headerValue = z.string().max(8192).refine(v => !/[\r\n\x00]/.test(v));
const publicHeaders = z.record(headerName, headerValue).refine(h => Object.keys(h).every(k => ["accept", "content-type", "x-correlation-id"].includes(k.toLowerCase())), "Use o campo de credenciais para os demais cabeçalhos.");
export const credentialsSchema = z.record(headerName, headerValue).refine(h => Object.keys(h).length <= 20 && Object.keys(h).every(k => !/^(host|cookie|set-cookie|proxy-.*|forwarded|x-forwarded-.*|connection|transfer-encoding|content-length|accept-encoding|upgrade|expect|te|trailer|idempotency-key)$/i.test(k)) && new Set(Object.keys(h).map(k => k.toLowerCase())).size === Object.keys(h).length && Object.values(h).every(v => !v.includes("{{")), "Cabeçalho de credencial inválido.");

export const actionConfigSchema = z.object({
  name: z.string().trim().min(2).max(100),
  description: z.string().trim().min(5).max(1000),
  method: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE"]),
  url_template: z.string().min(10).max(4096),
  input_schema: z.custom<InputSchema>(v => validInputSchema(v) && v.type === "object", "Schema deve ser um objeto JSON Schema com additionalProperties: false."),
  allowed_context_keys: z.array(z.enum(CONTEXT_KEYS)).max(4).default([]),
  public_headers: publicHeaders.default({}),
  body_template: z.json().nullable().default(null),
  result_mapping: z.record(z.string().refine(safeKey), z.string().regex(/^(?:[A-Za-z][A-Za-z0-9_]*|\d+)(?:\.(?:[A-Za-z][A-Za-z0-9_]*|\d+))*$/).max(200)).refine(v => Object.keys(v).length <= 30).default({}),
  timeout_ms: z.number().int().min(1000).max(15000).default(10000),
  max_response_bytes: z.number().int().min(1024).max(262144).default(65536),
  enabled: z.boolean().default(false),
  /** GET pode ter efeito no fornecedor: o operador pode marcá-lo como mutação. */
  mutating: z.boolean().default(true),
}).strict().superRefine((v, ctx) => {
  if (v.method !== "GET" && !v.mutating) ctx.addIssue({ code: "custom", message: "Este método precisa ser marcado como operação que altera dados." });
  if (v.method === "GET" && v.body_template !== null) ctx.addIssue({ code: "custom", message: "GET não aceita corpo." });
  if (JSON.stringify(v).length > 65536) ctx.addIssue({ code: "custom", message: "Configuração muito grande." });
});
export type ActionConfig = z.infer<typeof actionConfigSchema>;
export const saveActionSchema = z.object({ configuration: actionConfigSchema, credential_headers: credentialsSchema.optional() }).strict();
export const executeSchema = z.object({ inputs: z.record(z.string(), z.json()), confirm_mutation: z.boolean().default(false) }).strict();
export interface ActionRow { id: string; organization_id: string; configuration: ActionConfig; credential_header_names: string[]; created_at: string; updated_at: string; }

export function readPath(value: unknown, path: string): unknown {
  let current = value;
  for (const key of path.split(".")) {
    if (["__proto__", "constructor", "prototype"].includes(key) || !current || typeof current !== "object" || !Object.hasOwn(current, key)) return undefined;
    current = (current as Record<string, unknown>)[key];
  }
  return current;
}
