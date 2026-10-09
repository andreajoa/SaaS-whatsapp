import { ok, fail } from "@/lib/api/wrappers";
import { requireRole } from "@/lib/auth/require-role";
import { requireSupportWrite } from "@/lib/impersonate/support";
import { audit } from "@/lib/audit";
import { createAdminClient } from "@/lib/supabase/admin";
import { providerSchema } from "@/lib/commerce/types";

type Context = { params: Promise<{ provider: string }> };
export async function POST(_req: Request, ctx: Context) {
  const auth = await requireRole("admin"); if (!auth.ok) return auth.response;
  const blocked = await requireSupportWrite(auth.org.orgId); if (blocked) return blocked;
  const provider = providerSchema.safeParse((await ctx.params).provider);
  if (!provider.success) return fail("not_found", "Integração não encontrada.", 404);
  const db = createAdminClient();
  const connection = await db.from("tenant_integrations").select("id,status").eq("organization_id", auth.org.orgId).eq("provider", provider.data).maybeSingle();
  if (connection.error) return fail("upstream_unavailable", "Não foi possível carregar a conexão.", 503);
  if (!connection.data || connection.data.status === "disconnected") return fail("not_found", "Conecte sua loja antes de sincronizar.", 404);
  const queued = await db.rpc("fn_commerce_begin_sync", { p_org: auth.org.orgId, p_integration: connection.data.id, p_actor: auth.user.id });
  if (queued.error) return fail("upstream_unavailable", "Não foi possível iniciar a sincronização.", 503);
  await audit({ actorUserId: auth.user.id, organizationId: auth.org.orgId, action: "commerce.sync_requested", resourceType: "tenant_integration", resourceId: connection.data.id });
  return ok({ sync_run_id: queued.data });
}
export async function DELETE(_req: Request, ctx: Context) {
  const auth = await requireRole("admin"); if (!auth.ok) return auth.response;
  const blocked = await requireSupportWrite(auth.org.orgId); if (blocked) return blocked;
  const provider = providerSchema.safeParse((await ctx.params).provider);
  if (!provider.success) return fail("not_found", "Integração não encontrada.", 404);
  const db = createAdminClient();
  const connection = await db.from("tenant_integrations").select("id").eq("organization_id", auth.org.orgId).eq("provider", provider.data).maybeSingle();
  if (connection.error) return fail("upstream_unavailable", "Não foi possível carregar a conexão.", 503);
  const updated = await db.rpc("fn_commerce_disconnect", { p_org: auth.org.orgId, p_provider: provider.data });
  if (updated.error) return fail("upstream_unavailable", "Não foi possível desconectar a loja.", 503);
  if (connection.data) {
    await audit({ actorUserId: auth.user.id, organizationId: auth.org.orgId, action: "commerce.disconnected", resourceType: "tenant_integration", resourceId: connection.data.id, metadata: { provider: provider.data } });
  }
  return ok({ disconnected: true });
}
