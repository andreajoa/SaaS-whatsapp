import { IntegrationActionError, readPath, type ActionConfig, type ContextVariables, type InputSchema, type Json } from "./schema";

const TOKEN = /\{\{\s*(input|context)\.([a-zA-Z][a-zA-Z0-9_]*(?:\.[a-zA-Z][a-zA-Z0-9_]*)*)\s*\}\}/g;
function declared(schema: InputSchema, path: string): boolean {
  let current = schema;
  for (const k of path.split(".")) {
    if (!current.properties || !Object.hasOwn(current.properties, k)) return false;
    current = current.properties[k]!;
  }
  return true;
}
export function interpolate(template: Json, config: ActionConfig, inputs: Record<string, Json>, context: ContextVariables, urlEncode = false): Json {
  if (Array.isArray(template)) return template.map(v => interpolate(v, config, inputs, context, urlEncode));
  if (template !== null && typeof template === "object") return Object.fromEntries(Object.entries(template).map(([k, v]) => [k, interpolate(v, config, inputs, context, urlEncode)]));
  if (typeof template !== "string") return template;
  const resolve = (source: string, path: string): Json => {
    if (source === "input" ? !declared(config.input_schema, path) : !config.allowed_context_keys.includes(path as keyof ContextVariables)) throw new IntegrationActionError("variable_forbidden", "Variável não autorizada no template.");
    const result = readPath(source === "input" ? inputs : context, path);
    if (result === undefined) throw new IntegrationActionError("variable_missing", "Preencha as variáveis necessárias para executar.");
    return result as Json;
  };
  const tokens = [...template.matchAll(TOKEN)];
  if (template.replace(TOKEN, "").includes("{{") || template.replace(TOKEN, "").includes("}}")) throw new IntegrationActionError("invalid_template", "Template de variável inválido.");
  if (!urlEncode && tokens.length === 1 && tokens[0]![0] === template) return resolve(tokens[0]![1]!, tokens[0]![2]!);
  return template.replace(TOKEN, (_m, source: string, path: string) => {
    const value = resolve(source, path);
    if (value === null || typeof value === "object") throw new IntegrationActionError("invalid_template", "Use valores simples em URLs e cabeçalhos.");
    // Nem . nem .. podem ganhar significado de navegação num segmento de URL.
    if (urlEncode && (String(value) === "." || String(value) === "..")) throw new IntegrationActionError("invalid_template", "Segmento de URL inválido.");
    return urlEncode ? encodeURIComponent(String(value)) : String(value);
  });
}

export function validateTemplates(config: ActionConfig): void {
  // Valida placeholders antes de salvar sem exigir valores reais de execução.
  const visit = (v: unknown) => {
    if (typeof v === "string") {
      const rest = v.replace(TOKEN, (_match, source: string, path: string) => {
        if (source === "input" ? !declared(config.input_schema, path) : !config.allowed_context_keys.includes(path as keyof ContextVariables)) throw new IntegrationActionError("variable_forbidden", "Variável não autorizada no template.");
        return "";
      });
      if (rest.includes("{{") || rest.includes("}}")) throw new IntegrationActionError("invalid_template", "Template de variável inválido.");
    } else if (v && typeof v === "object") for (const child of Object.values(v)) visit(child);
  };
  visit(config.url_template); visit(config.public_headers); visit(config.body_template);
}
