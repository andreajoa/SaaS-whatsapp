import { randomUUID } from "node:crypto";
import { z } from "zod";
import { fail, ok } from "@/lib/api/wrappers";
import { requireRole } from "@/lib/auth/require-role";
import type { Role } from "@/lib/auth/types";
import { requireSupportWrite } from "@/lib/impersonate/support";
import { createAdminClient } from "@/lib/supabase/admin";
import { IntegrationActionError } from "@/lib/integration-actions/schema";
import type { ActionAuthContext } from "@/lib/integration-actions/service";

export async function readJson(req: Request): Promise<unknown> {
  const reader = req.body?.getReader();
  if (!reader) throw new IntegrationActionError("invalid_request", "Envie um objeto JSON.", 400);
  const parts: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 98304) { await reader.cancel(); throw new IntegrationActionError("request_too_large", "Requisição excede o limite permitido.", 413); }
      parts.push(value);
    }
    return JSON.parse(Buffer.concat(parts).toString("utf8"));
  } catch (error) {
    if (error instanceof IntegrationActionError) throw error;
    throw new IntegrationActionError("invalid_request", "JSON inválido.", 400);
  } finally { reader.releaseLock(); }
}
export async function withActionAuth(minimum: Role, effect: boolean, handler: (db: ReturnType<typeof createAdminClient>, ctx: ActionAuthContext) => Promise<unknown>, created = false): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requireRole(minimum, { requestId, resource: "integration_actions" });
  if (!authz.ok) return authz.response;
  if (effect) {
    const denied = await requireSupportWrite(authz.org.orgId);
    if (denied) return denied;
  }
  const ctx: ActionAuthContext = { organizationId: authz.org.orgId, role: authz.org.role, actorUserId: authz.user.id, requestId, support: authz.user.support };
  try { return ok(await handler(createAdminClient(), ctx), { requestId, status: created ? 201 : 200, headers: { "Cache-Control": "no-store" } }); }
  catch (error) {
    if (error instanceof IntegrationActionError) return fail(error.code, error.message, error.status, { requestId });
    if (error instanceof z.ZodError) return fail("invalid_request", "Confira os campos, o schema de entradas e os cabeçalhos.", 400, { requestId });
    return fail("upstream_unavailable", "Não foi possível concluir a operação. Confira a conexão e tente novamente.", 503, { requestId });
  }
}
export async function actionId(params: Promise<{ id: string }>): Promise<string> { return z.string().uuid().parse((await params).id); }
