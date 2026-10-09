import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";
import { NextResponse, type NextRequest } from "next/server";
import { env } from "@/lib/env";
import { audit } from "@/lib/audit";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyState } from "@/lib/nuvemshop/state";
import { vinculoConfere } from "@/lib/agenda/google/vinculo";
import { ShopifyClient, verifyShopifyCallback } from "@/lib/commerce/shopify";
import { CommerceError, commerceRequest, validateStoreUrl } from "@/lib/commerce/http";
import { encryptRequired, TOKEN_SCHEMA } from "@/lib/commerce/connections";

function redirect(status: string) {
  const url = new URL("/app/integrations", env.NEXT_PUBLIC_APP_URL);
  url.searchParams.set("shopify", status);
  const response = NextResponse.redirect(url);
  response.cookies.set("crm_shopify_bind", "", { maxAge: 0, path: "/api/v1/integrations/shopify/callback" });
  return response;
}
export async function GET(req: NextRequest) {
  const params = new URL(req.url).searchParams;
  const state = verifyState(params.get("state"));
  if (!env.SHOPIFY_CLIENT_SECRET || !env.SHOPIFY_CLIENT_ID || !state?.userId || !state.authSessionId ||
      !verifyShopifyCallback(params, env.SHOPIFY_CLIENT_SECRET) ||
      !vinculoConfere(req.cookies.get("crm_shopify_bind")?.value, state.nonce, env.INTERNAL_SECRET)) return redirect("invalid_authorization");
  const code = z.string().min(1).max(2000).safeParse(params.get("code"));
  const shop = z.string().regex(/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/).safeParse(params.get("shop"));
  if (!code.success || !shop.success) return redirect("invalid_authorization");
  const db = createAdminClient();
  const allowed = await db.rpc("fn_commerce_oauth_allowed", { p_org: state.orgId, p_actor: state.userId, p_session: state.authSessionId });
  if (allowed.error || allowed.data !== true) return redirect("invalid_authorization");
  const consumed = await db.from("commerce_oauth_states").delete().eq("nonce_hash", createHash("sha256").update(state.nonce).digest("hex")).eq("organization_id", state.orgId).eq("actor_id", state.userId).eq("auth_session_id", state.authSessionId).eq("shop", shop.data).gt("expires_at", new Date().toISOString()).select("shop").maybeSingle();
  if (consumed.error || !consumed.data) return redirect("invalid_authorization");
  try {
    const storeUrl = await validateStoreUrl(`https://${shop.data}`, "shopify");
    const token = TOKEN_SCHEMA.parse(await commerceRequest(`${storeUrl}/admin/oauth/access_token`, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ client_id: env.SHOPIFY_CLIENT_ID, client_secret: env.SHOPIFY_CLIENT_SECRET, code: code.data, expiring: "1" }).toString() }));
    if (!token.refresh_token || !token.expires_in) throw new CommerceError("expiring_token_required");
    const client = new ShopifyClient(storeUrl, token.access_token);
    const verified = await client.verify();
    const pathToken = randomBytes(24).toString("hex");
    const result = await db.from("tenant_integrations").upsert({
      organization_id: state.orgId, provider: "shopify", status: "healthy", status_reason: null,
      oauth_access_token_encrypted: await encryptRequired(db, token.access_token),
      oauth_refresh_token_encrypted: await encryptRequired(db, token.refresh_token),
      expires_at: new Date(Date.now() + token.expires_in * 1000).toISOString(),
      webhook_path_token: pathToken, webhook_secret_encrypted: await encryptRequired(db, env.SHOPIFY_CLIENT_SECRET),
      scopes: verified.scopes, store_metadata: { store_url: storeUrl, name: verified.name, currency: verified.currency, authorization_mode: "oauth", webhook_enabled: false, ...(token.refresh_token_expires_in ? { refresh_expires_at: new Date(Date.now() + token.refresh_token_expires_in * 1000).toISOString() } : {}) },
      webhook_subscriptions: {}, last_sync_at: null, last_health_check_at: new Date().toISOString(),
    }, { onConflict: "organization_id,provider" }).select("id").single();
    if (result.error) throw new CommerceError("save_failed");
    // Inscrições por loja. A rota fixa o tópico; o header remoto não decide o efeito.
    const topics = ["PRODUCTS_CREATE", "PRODUCTS_UPDATE", "PRODUCTS_DELETE", "ORDERS_CREATE", "ORDERS_UPDATED", "ORDERS_PAID", "ORDERS_CANCELLED", "INVENTORY_LEVELS_UPDATE", "APP_UNINSTALLED"];
    const subscriptions: Record<string, { id: string | null }> = {};
    for (const topic of topics) {
      try {
        const url = `${env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "")}/api/v1/webhooks/commerce/${pathToken}/${topic.toLowerCase()}`;
        const data = await client.graphql(`mutation($topic:WebhookSubscriptionTopic!, $url:String!) { webhookSubscriptionCreate(topic:$topic, webhookSubscription:{uri:$url,format:JSON}) { webhookSubscription { id } userErrors { message } } }`, { topic, url });
        const saved = z.object({ webhookSubscription: z.object({ id: z.string() }).nullable(), userErrors: z.array(z.unknown()) }).parse(data.webhookSubscriptionCreate);
        subscriptions[topic] = { id: saved.userErrors.length ? null : saved.webhookSubscription?.id ?? null };
      } catch { subscriptions[topic] = { id: null }; }
    }
    const complete = Object.values(subscriptions).every((v) => v.id);
    const updated = await db.from("tenant_integrations").update({ webhook_subscriptions: subscriptions, store_metadata: { store_url: storeUrl, name: verified.name, currency: verified.currency, authorization_mode: "oauth", webhook_enabled: complete, ...(token.refresh_token_expires_in ? { refresh_expires_at: new Date(Date.now() + token.refresh_token_expires_in * 1000).toISOString() } : {}) }, status_reason: complete ? null : "Alguns avisos automáticos da loja não foram ativados. A sincronização manual continua disponível." }).eq("organization_id", state.orgId).eq("id", result.data.id);
    if (updated.error) throw new CommerceError("save_failed");
    const queued = await db.rpc("fn_commerce_begin_sync", { p_org: state.orgId, p_integration: result.data.id, p_actor: state.userId });
    if (queued.error) throw new CommerceError("queue_failed");
    await audit({ actorUserId: state.userId, actorAuthSessionId: state.authSessionId, organizationId: state.orgId, action: "commerce.connected", resourceType: "tenant_integration", resourceId: result.data.id, metadata: { provider: "shopify", webhooks_complete: complete } });
    return redirect(complete ? "connected" : "connected_manual_sync");
  } catch {
    await audit({ actorUserId: state.userId, actorAuthSessionId: state.authSessionId, organizationId: state.orgId, action: "commerce.oauth_failed", metadata: { reason: "authorization_failed" } });
    return redirect("connection_failed");
  }
}
