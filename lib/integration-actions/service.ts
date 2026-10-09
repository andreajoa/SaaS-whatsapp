import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { audit } from "@/lib/audit";
import { roleAtLeast, type Role } from "@/lib/auth/types";
import { supportWriteError, type SupportContext } from "@/lib/impersonate/support";
import { decryptWebhookSecret, encryptWebhookSecret } from "@/lib/webhooks/secrets";
import { executeRestAction, type ExecutionResult, type ExecutorDependencies } from "./executor";
import { validateTemplates } from "./interpolation";
import { parsePublicUrl, resolvePublicAddress } from "./network";
import { actionConfigSchema, credentialsSchema, IntegrationActionError, saveActionSchema, validateInputs, type ActionRow, type ContextVariables, type Json } from "./schema";

export interface ActionAuthContext {
  /** Exclusivamente org/ator resolvidos pela sessão ou autenticação MCP. */
  organizationId: string;
  role: Role;
  actorUserId?: string | null;
  actorApiTokenId?: string | null;
  requestId: string;
  support?: SupportContext | null;
}
export const ACTION_COLUMNS = "id, organization_id, configuration, credential_header_names, created_at, updated_at";
export interface AgentActionAuthorization { agentId: string; versionId: string; }

export function requireActionPermission(ctx: ActionAuthContext, minimum: Role, effect = false): void {
  if (!ctx.organizationId || !roleAtLeast(ctx.role, minimum)) throw new IntegrationActionError("forbidden_role", "Permissão insuficiente para esta operação.", 403);
  const message = effect ? supportWriteError(ctx.support, ctx.organizationId) : null;
  if (message) throw new IntegrationActionError("forbidden", message, 403);
}
function dbError(): never { throw new IntegrationActionError("upstream_unavailable", "Não foi possível acessar as ações de integração.", 503); }

export async function loadAction(db: SupabaseClient, ctx: ActionAuthContext, id: string): Promise<ActionRow> {
  const { data, error } = await db.from("integration_actions").select(ACTION_COLUMNS).eq("organization_id", ctx.organizationId).eq("id", id).maybeSingle();
  if (error) dbError();
  if (!data) throw new IntegrationActionError("not_found", "Ação não encontrada nesta organização.", 404);
  const row = data as ActionRow;
  if (row.organization_id !== ctx.organizationId || row.id !== id) throw new IntegrationActionError("not_found", "Ação não encontrada nesta organização.", 404);
  row.configuration = actionConfigSchema.parse(row.configuration);
  return row;
}

export async function listActions(db: SupabaseClient, ctx: ActionAuthContext): Promise<ActionRow[]> {
  requireActionPermission(ctx, "manager");
  const { data, error } = await db.from("integration_actions").select(ACTION_COLUMNS).eq("organization_id", ctx.organizationId).order("created_at", { ascending: false }).limit(100);
  if (error) dbError();
  return (data ?? []) as ActionRow[];
}

export async function saveAction(db: SupabaseClient, ctx: ActionAuthContext, raw: unknown, id?: string): Promise<ActionRow> {
  requireActionPermission(ctx, "manager", true);
  const input = saveActionSchema.parse(raw);
  validateTemplates(input.configuration);
  await resolvePublicAddress(parsePublicUrl(input.configuration.url_template));
  if (id) await loadAction(db, ctx, id);
  let encrypted: string | null = null;
  let names: string[] | null = null;
  if (input.credential_headers !== undefined) {
    const credentials = credentialsSchema.parse(input.credential_headers);
    if (Object.keys(credentials).some(k => Object.keys(input.configuration.public_headers).some(p => k.toLowerCase() === p.toLowerCase()))) throw new IntegrationActionError("credential_override", "Cabeçalhos públicos não podem sobrescrever credenciais.");
    names = Object.keys(credentials);
    if (names.length) {
      encrypted = await encryptWebhookSecret(db, JSON.stringify(credentials));
      if (!encrypted) throw new IntegrationActionError("encryption_unavailable", "Não foi possível cifrar as credenciais. Ative a chave de cifra da instalação antes de salvar.");
    }
  }
  const actionId = id ?? randomUUID();
  const { data, error } = await db.rpc("fn_save_integration_action", {
    p_org: ctx.organizationId, p_id: actionId, p_configuration: input.configuration,
    p_header_names: names, p_encrypted: encrypted, p_create: !id,
  });
  if (error || !data) dbError();
  void audit({ action: "org.updated", actorUserId: ctx.actorUserId, actorApiTokenId: ctx.actorApiTokenId, organizationId: ctx.organizationId, resourceType: "integration_action", resourceId: actionId, requestId: ctx.requestId, metadata: { operation: id ? "integration_action.updated" : "integration_action.created" } });
  return loadAction(db, ctx, actionId);
}

export async function deleteAction(db: SupabaseClient, ctx: ActionAuthContext, id: string): Promise<void> {
  requireActionPermission(ctx, "manager", true);
  await loadAction(db, ctx, id);
  const { error } = await db.from("integration_actions").delete().eq("organization_id", ctx.organizationId).eq("id", id);
  if (error) dbError();
  void audit({ action: "org.updated", actorUserId: ctx.actorUserId, organizationId: ctx.organizationId, resourceType: "integration_action", resourceId: id, requestId: ctx.requestId, metadata: { operation: "integration_action.deleted" } });
}

export async function actionHistory(db: SupabaseClient, ctx: ActionAuthContext, id?: string) {
  requireActionPermission(ctx, "agent");
  if (id) await loadAction(db, ctx, id);
  let query = db.from("integration_action_executions").select("id, action_id, action_name, source, state, result, started_at, completed_at").eq("organization_id", ctx.organizationId);
  if (id) query = query.eq("action_id", id);
  const { data, error } = await query.order("started_at", { ascending: false }).limit(50);
  if (error) dbError();
  return data ?? [];
}

async function requireCurrentAgentSelection(db: SupabaseClient, organizationId: string, identity: AgentActionAuthorization | undefined, actionId: string, readOnly: boolean): Promise<void> {
  if (!identity) throw new Error("agent_identity_missing");
  const { data: agent, error: agentError } = await db.from("ai_agents")
    .select("id, organization_id, published_version_id, archived_at, paused_at, operation_mode")
    .eq("organization_id", organizationId).eq("id", identity.agentId).maybeSingle();
  const { data: version, error: versionError } = await db.from("ai_agent_versions")
    .select("id, organization_id, agent_id, status, integration_action_ids")
    .eq("organization_id", organizationId).eq("agent_id", identity.agentId).eq("id", identity.versionId).maybeSingle();
  if (agentError || versionError || !agent || !version) throw new Error("agent_authorization_unavailable");
  const belongsToAgent = agent.id === identity.agentId && agent.organization_id === organizationId
    && version.id === identity.versionId && version.organization_id === organizationId && version.agent_id === identity.agentId;
  const selected = Array.isArray(version.integration_action_ids) && version.integration_action_ids.includes(actionId);
  // Preview usa a versão autenticada exata, inclusive draft; nunca ganha escrita.
  // is_active pertence ao rag_bot legado, não à publicação do mcp_agent.
  const permittedVersion = readOnly
    ? ["draft", "published", "superseded"].includes(version.status)
    : agent.published_version_id === identity.versionId && version.status === "published"
      && agent.paused_at === null && agent.operation_mode === "automatic";
  if (!belongsToAgent || !selected || agent.archived_at !== null || !permittedVersion) throw new Error("agent_authorization_changed");
}

export async function executeAction(db: SupabaseClient, ctx: ActionAuthContext, input: {
  id: string; inputs: Record<string, Json>; confirmMutation: boolean; source: "manual" | "test" | "agent"; contextVariables?: ContextVariables; readOnly?: boolean;
  /** Identidade confiável do turno, nunca argumentos do modelo. */
  agentAuthorization?: AgentActionAuthorization;
  authorizeBeforeDispatch?: () => Promise<void>;
}, dependencies: ExecutorDependencies = {}): Promise<ExecutionResult> {
  // Histórico e consultas permanecem no tenant autenticado no início da execução.
  const executionContext = { ...ctx };
  requireActionPermission(ctx, "agent", true);
  const action = await loadAction(db, executionContext, input.id);
  if (input.readOnly && action.configuration.mutating) throw new IntegrationActionError("preview_readonly", "O preview não executa operações que alteram dados.", 403);
  if (input.source === "agent") {
    requireActionPermission(ctx, action.configuration.mutating ? "ai_operator" : "agent", true);
    if (!action.configuration.enabled) throw new IntegrationActionError("action_disabled", "Ação pausada. Peça a quem administra para ativá-la.", 409);
  }
  if (input.source === "test") requireActionPermission(ctx, "manager", true);
  if (action.configuration.mutating && !input.confirmMutation) throw new IntegrationActionError("mutation_confirmation_required", "Confirme a operação que altera dados no fornecedor.", 409);
  validateInputs(action.configuration.input_schema, input.inputs);
  const configurationSnapshot = JSON.stringify(action.configuration);
  const headerNamesSnapshot = JSON.stringify(action.credential_header_names);
  const updatedAtSnapshot = action.updated_at;
  let encryptedSnapshot: string | null = null;
  let credentialHeaders: Record<string, string> = {};
  if (action.credential_header_names.length) {
    const { data, error } = await db.from("integration_action_credentials").select("headers_encrypted").eq("organization_id", executionContext.organizationId).eq("action_id", input.id).maybeSingle();
    if (error || !data) throw new IntegrationActionError("credential_unavailable", "Credenciais indisponíveis. Reconfigure a conexão.");
    encryptedSnapshot = data.headers_encrypted as string;
    const plaintext = await decryptWebhookSecret(db, data.headers_encrypted as string);
    if (!plaintext) throw new IntegrationActionError("credential_unavailable", "Não foi possível decifrar as credenciais. Confira a chave de cifra da instalação.");
    try { credentialHeaders = credentialsSchema.parse(JSON.parse(plaintext)); } catch { throw new IntegrationActionError("credential_unavailable", "Credenciais inválidas. Reconfigure a conexão."); }
  }
  const executionId = randomUUID();
  const { error: insertError } = await db.from("integration_action_executions").insert({ id: executionId, organization_id: executionContext.organizationId, action_id: input.id, action_name: action.configuration.name, source: input.source, state: "running", actor_user_id: executionContext.actorUserId ?? null, request_id: executionContext.requestId });
  if (insertError) dbError(); // Nunca despacha sem uma trilha persistida.
  let result: ExecutionResult;
  try {
    result = await executeRestAction({ configuration: action.configuration, inputs: input.inputs, credentialHeaders, contextVariables: input.contextVariables, confirmMutation: input.confirmMutation, executionId,
      authorizeBeforeDispatch: async () => {
        try {
          const current = await loadAction(db, executionContext, input.id);
          if (current.updated_at !== updatedAtSnapshot || JSON.stringify(current.configuration) !== configurationSnapshot || JSON.stringify(current.credential_header_names) !== headerNamesSnapshot) throw new Error("configuration_changed");
          if (encryptedSnapshot !== null) {
            const { data, error } = await db.from("integration_action_credentials").select("headers_encrypted").eq("organization_id", executionContext.organizationId).eq("action_id", input.id).maybeSingle();
            if (error || !data || data.headers_encrypted !== encryptedSnapshot) throw new Error("credentials_changed");
          }
          if (input.source === "agent") {
            await requireCurrentAgentSelection(db, executionContext.organizationId, input.agentAuthorization, input.id, input.readOnly === true);
            if (!current.configuration.enabled) throw new Error("action_disabled");
          }
          // A fronteira do turno e os scopes são a ÚLTIMA guarda async: podem
          // ter sido revogados durante qualquer consulta de estado acima.
          await input.authorizeBeforeDispatch?.();
          if (ctx.organizationId !== executionContext.organizationId) throw new Error("tenant_changed");
          requireActionPermission(ctx, input.source === "test" ? "manager" : input.source === "agent" && current.configuration.mutating ? "ai_operator" : "agent", true);
          if (input.readOnly && current.configuration.mutating) throw new Error("preview_readonly");
        } catch {
          // Antes do transporte: revogação é certa, nunca resultado incerto.
          throw new IntegrationActionError("authorization_revoked", "A autorização mudou durante a execução. Confira a configuração e a seleção atual do agente antes de repetir.", 403);
        }
      },
    }, dependencies);
  } catch (error) {
    const known = error instanceof IntegrationActionError;
    result = { execution_id: executionId, success: false, http_status: null, duration_ms: 0, data: null, error_code: known ? error.code : "invalid_configuration", message: known ? error.message : "Confira a configuração antes de executar.", outcome_uncertain: false };
  }
  const { error: updateError } = await db.from("integration_action_executions").update({ state: result.success ? "succeeded" : "failed", result, completed_at: new Date().toISOString() }).eq("organization_id", executionContext.organizationId).eq("id", executionId);
  void audit({ action: "mcp.tool_called", actorUserId: executionContext.actorUserId, actorApiTokenId: executionContext.actorApiTokenId, organizationId: executionContext.organizationId, resourceType: "integration_action", resourceId: input.id, requestId: executionContext.requestId, metadata: { operation: "integration_action.executed", execution_id: executionId, success: result.success, source: input.source, error_code: result.error_code, outcome_uncertain: result.outcome_uncertain, history_saved: !updateError } });
  if (updateError) throw new IntegrationActionError("execution_history_unavailable", "A chamada terminou, mas não foi possível registrar o resultado. Confira no fornecedor antes de repetir.", 503);
  return result;
}
