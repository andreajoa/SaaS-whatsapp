import { randomBytes } from "node:crypto";
import { z } from "zod";
import { ok, fail } from "@/lib/api/wrappers";
import { audit } from "@/lib/audit";
import { requireRole } from "@/lib/auth/require-role";
import { requireSupportWrite } from "@/lib/impersonate/support";
import { createAdminClient } from "@/lib/supabase/admin";
import { connectionSchema, COMMERCE_PROVIDERS } from "@/lib/commerce/types";
import { validateStoreUrl, CommerceError } from "@/lib/commerce/http";
import { encryptRequired, SAFE_CONNECTION_COLUMNS } from "@/lib/commerce/connections";
import { ShopifyClient } from "@/lib/commerce/shopify";
import { WooCommerceClient } from "@/lib/commerce/woocommerce";

export const dynamic = "force-dynamic";
export async function GET() {
  const auth = await requireRole("admin"); if (!auth.ok) return auth.response;
  const db = createAdminClient();
  const connections = await db.from("tenant_integrations").select(SAFE_CONNECTION_COLUMNS).eq("organization_id", auth.org.orgId).in("provider", [...COMMERCE_PROVIDERS, "nuvemshop"]);
  const runs = await db.from("commerce_sync_runs").select("id,integration_id,status,phase,product_count,order_count,error_code,started_at,completed_at,locked_until").eq("organization_id", auth.org.orgId).order("started_at", { ascending: false }).limit(30);
  if (connections.error || runs.error) return fail("upstream_unavailable", "Não foi possível carregar as integrações.", 503);
  return ok({ connections: connections.data, runs: runs.data, shopify_oauth_available: Boolean(process.env.SHOPIFY_CLIENT_ID && process.env.SHOPIFY_CLIENT_SECRET) });
}
export async function POST(req: Request) {
  const auth = await requireRole("admin"); if (!auth.ok) return auth.response;
  const blocked = await requireSupportWrite(auth.org.orgId); if (blocked) return blocked;
  const parsed = connectionSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail("validation_failed", "Confira o endereço e as credenciais da loja.", 422);
  const input = parsed.data; const db = createAdminClient();
  try {
    const storeUrl = await validateStoreUrl(input.store_url, input.provider);
    const previous = await db.from("tenant_integrations").select("store_metadata")
      .eq("organization_id", auth.org.orgId).eq("provider", input.provider).maybeSingle();
    if (previous.error) throw new CommerceError("Não foi possível verificar a conexão atual.");
    const identity = z.object({ store_url: z.string() }).safeParse(previous.data?.store_metadata);
    if (identity.success && identity.data.store_url !== storeUrl) throw new CommerceError("Esta organização já possui outra loja deste provedor. Use uma organização separada para preservar o histórico de pedidos.", 409);
    const credentials = input.provider === "woocommerce" ? JSON.stringify({ consumer_key: input.access_token, consumer_secret: input.consumer_secret }) : input.access_token;
    const encrypted = await encryptRequired(db, credentials);
    const client = input.provider === "shopify" ? new ShopifyClient(storeUrl, input.access_token) : new WooCommerceClient(storeUrl, input.access_token, input.consumer_secret!);
    const verified = await client.verify();
    // Aplicativos próprios podem ter credencial sem expiração; nunca presume validade futura.
    const webhookSecret = input.provider === "shopify" ? input.consumer_secret : undefined;
    const row = await db.from("tenant_integrations").upsert({ organization_id: auth.org.orgId, provider: input.provider,
      oauth_access_token_encrypted: encrypted, oauth_refresh_token_encrypted: input.refresh_token ? await encryptRequired(db, input.refresh_token) : null,
      expires_at: input.expires_at ?? null, status: "healthy", status_reason: null, scopes: verified.scopes,
      webhook_path_token: randomBytes(24).toString("hex"), webhook_secret_encrypted: await encryptRequired(db, webhookSecret || randomBytes(32).toString("hex")),
      webhook_subscriptions: {}, store_metadata: { store_url: storeUrl, name: verified.name, currency: verified.currency, authorization_mode: "custom", webhook_enabled: false },
      last_health_check_at: new Date().toISOString(), last_sync_at: null,
    }, { onConflict: "organization_id,provider" }).select(SAFE_CONNECTION_COLUMNS).single();
    if (row.error) throw new CommerceError("Não foi possível salvar a conexão.");
    const queued = await db.rpc("fn_commerce_begin_sync", { p_org: auth.org.orgId, p_integration: row.data.id, p_actor: auth.user.id });
    if (queued.error) throw new CommerceError("Loja conectada, mas a sincronização não iniciou. Clique em sincronizar novamente.");
    await audit({ actorUserId: auth.user.id, organizationId: auth.org.orgId, action: "commerce.connected", resourceType: "tenant_integration", resourceId: row.data.id, metadata: { provider: input.provider } });
    return ok({ connection: row.data, sync_run_id: z.string().uuid().parse(queued.data) }, { status: 201 });
  } catch (error) {
    return fail("integration_failed", error instanceof CommerceError ? error.message : "Não foi possível validar a loja. Confira as credenciais e permissões.", error instanceof CommerceError ? error.status : 502);
  }
}
