import { tool, type Tool } from "ai";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { ensureRole, ensureScope, type McpAuthResult } from "@/lib/mcp/auth";
import type { McpContext, McpToolDefinition } from "@/lib/mcp/types";
import { actionConfigSchema, type ContextVariables, type InputSchema, type Json } from "./schema";
import { executeAction, type ActionAuthContext, type AgentActionAuthorization, ACTION_COLUMNS } from "./service";

interface ActionToolOptions {
  readOnly?: boolean;
  agentAuthorization?: AgentActionAuthorization;
  authorizeBeforeDispatch?: () => Promise<void>;
  authForDispatch?: McpAuthResult;
}

/** Nome estável por id; renomear a ação não quebra seleções publicadas do agente. */
export function integrationActionToolName(id: string): string { return `integration_action_${id.replace(/-/g, "")}`; }
export function integrationActionIdsFromToolIds(toolIds: readonly string[]): string[] {
  return [...new Set(toolIds.flatMap(name => {
    const hex = /^integration_action_([0-9a-f]{32})$/i.exec(name)?.[1];
    if (!hex) return [];
    const id = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
    return z.string().uuid().safeParse(id).success ? [id] : [];
  }))];
}

function schemaToZod(schema: InputSchema): z.ZodType {
  let result: z.ZodType;
  switch (schema.type) {
    case "object": result = z.object(Object.fromEntries(Object.entries(schema.properties ?? {}).map(([key, spec]) => [key, schema.required?.includes(key) ? schemaToZod(spec) : schemaToZod(spec).optional()]))).strict(); break;
    case "array": result = z.array(schemaToZod(schema.items!)).max(100); break;
    case "string": result = z.string().max(8192); break;
    case "number": result = z.number(); break;
    case "integer": result = z.number().int(); break;
    case "boolean": result = z.boolean(); break;
  }
  return schema.enum ? result.refine(v => schema.enum!.includes(v as string | number | boolean), "Valor fora das opções configuradas.") : result;
}
function executionContext(ctx: McpContext): ActionAuthContext {
  return { organizationId: ctx.organizationId, role: ctx.role, actorUserId: ctx.actor.type === "user" ? ctx.actor.id : null, actorApiTokenId: ctx.apiTokenId || null, requestId: ctx.requestId };
}

/** O catálogo usa apenas ids selecionados por configuração confiável do agente.
 * Não existe tool de criar ações nem argumentos de URL/headers/tenant.
 */
export async function getIntegrationActionDefinitions(db: SupabaseClient, organizationId: string, actionIds: readonly string[], contextVariables: ContextVariables = {}, options: ActionToolOptions = {}): Promise<McpToolDefinition[]> {
  if (!actionIds.length) return [];
  const ids = z.array(z.string().uuid()).max(100).parse([...actionIds]);
  const { data, error } = await db.from("integration_actions").select(ACTION_COLUMNS).eq("organization_id", organizationId).in("id", ids).limit(100);
  if (error) throw new Error("Não foi possível carregar as ações de integração.");
  return (data ?? []).flatMap(row => {
    const parsed = actionConfigSchema.safeParse(row.configuration);
    if (!parsed.success || !parsed.data.enabled) return [];
    const config = parsed.data;
    if (options.readOnly && config.mutating) return [];
    const minimum = config.mutating ? "ai_operator" as const : "agent" as const;
    const scope = config.mutating ? "mcp:write" as const : "mcp:read" as const;
    return [{
      name: integrationActionToolName(row.id as string),
      description: `${config.name}: ${config.description} (${config.method}; ${config.mutating ? "ALTERA DADOS NO FORNECEDOR; confirme a intenção antes de chamar" : "consulta"}).`,
      inputSchema: { inputs: schemaToZod(config.input_schema), ...(config.mutating ? { confirm_mutation: z.literal(true).describe("Confirma que esta operação externa foi autorizada.") } : {}) },
      category: config.mutating ? "write" : "read", requiresRole: minimum, requiresScope: scope,
      handler: async (args: Record<string, unknown>, ctx: McpContext) => {
        // Também protege quem reutiliza diretamente a definição, sem wrapper MCP.
        ensureRole(ctx.role, minimum);
        if (ctx.organizationId !== organizationId) throw new Error("Ação fora da organização autenticada.");
        // O serviço revalida readOnly na configuração efetivamente despachada.
        return executeAction(ctx.supabase, executionContext(ctx), { id: row.id as string, inputs: args.inputs as Record<string, Json>, confirmMutation: args.confirm_mutation === true, source: "agent", contextVariables, readOnly: options.readOnly,
          agentAuthorization: options.agentAuthorization,
          authorizeBeforeDispatch: async () => {
            await options.authorizeBeforeDispatch?.();
            ensureRole(ctx.role, minimum);
            if (options.authForDispatch) {
              ensureRole(options.authForDispatch.role, minimum);
              ensureScope(options.authForDispatch.scopes, scope);
              if (options.authForDispatch.organizationId !== organizationId) throw new Error("Organização da ferramenta alterada.");
            }
            if (ctx.organizationId !== organizationId || !actionIds.includes(row.id as string) || (options.readOnly && config.mutating)) throw new Error("Autorização da ferramenta revogada.");
          },
        });
      },
    } satisfies McpToolDefinition];
  });
}

export async function createIntegrationActionTools(input: { ctx: McpContext; auth: McpAuthResult; actionIds: readonly string[]; contextVariables?: ContextVariables } & ActionToolOptions): Promise<Record<string, Tool>> {
  if (input.auth.organizationId !== input.ctx.organizationId) throw new Error("Contexto e autenticação discordam sobre a organização.");
  const definitions = await getIntegrationActionDefinitions(input.ctx.supabase, input.auth.organizationId, input.actionIds, input.contextVariables, { get readOnly() { return input.readOnly; }, agentAuthorization: input.agentAuthorization, authForDispatch: input.auth,
    authorizeBeforeDispatch: async () => {
      await input.authorizeBeforeDispatch?.();
      if (input.auth.organizationId !== input.ctx.organizationId) throw new Error("Organização da ferramenta alterada.");
    },
  });
  return Object.fromEntries(definitions.filter(def => {
    try { ensureRole(input.auth.role, def.requiresRole); ensureScope(input.auth.scopes, def.requiresScope); return true; } catch { return false; }
  }).map(def => [def.name, tool({
    description: def.description,
    inputSchema: z.object(def.inputSchema).strict(),
    execute: async (args: unknown) => {
      ensureRole(input.auth.role, def.requiresRole);
      ensureScope(input.auth.scopes, def.requiresScope);
      return def.handler(z.object(def.inputSchema).strict().parse(args), { ...input.ctx, role: input.auth.role });
    },
  })]));
}
