import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { decryptWebhookSecret, encryptWebhookSecret } from "@/lib/webhooks/secrets";
import { ShopifyClient } from "./shopify";
import { WooCommerceClient } from "./woocommerce";
import { commerceRequest, CommerceError } from "./http";
import type { CommerceIntegration, CommerceClient } from "./types";

export const SAFE_CONNECTION_COLUMNS = "id,provider,status,status_reason,scopes,store_metadata,last_sync_at,last_health_check_at,expires_at,created_at";
export const TOKEN_SCHEMA = z.object({ access_token: z.string().min(1), scope: z.string().optional(), expires_in: z.number().optional(), refresh_token: z.string().optional(), refresh_token_expires_in: z.number().optional() });

export async function encryptRequired(db: SupabaseClient, value: string): Promise<string> {
  const encrypted = await encryptWebhookSecret(db, value);
  if (!encrypted) throw new CommerceError("A proteção das credenciais ainda não foi configurada pelo administrador da plataforma.", 422);
  return encrypted;
}
export async function loadCommerceClient(db: SupabaseClient, integration: CommerceIntegration): Promise<CommerceClient> {
  let token = await decryptWebhookSecret(db, integration.oauth_access_token_encrypted);
  if (!token) throw new CommerceError("Não foi possível acessar a credencial. Reconecte a loja.", 422);
  if (integration.provider === "woocommerce") {
    const pair = z.object({ consumer_key: z.string(), consumer_secret: z.string() }).parse(JSON.parse(token));
    return new WooCommerceClient(integration.store_metadata.store_url, pair.consumer_key, pair.consumer_secret);
  }
  if (integration.expires_at && Date.parse(integration.expires_at) <= Date.now() + 120_000) {
    const { SHOPIFY_CLIENT_ID, SHOPIFY_CLIENT_SECRET } = process.env;
    if (!integration.oauth_refresh_token_encrypted || !SHOPIFY_CLIENT_ID || !SHOPIFY_CLIENT_SECRET) {
      throw new CommerceError("A autorização Shopify expirou. Reconecte a loja.", 422);
    }
    const refresh = await decryptWebhookSecret(db, integration.oauth_refresh_token_encrypted);
    if (!refresh) throw new CommerceError("Reconecte a loja para renovar a autorização.", 422);
    const lock = new Date(Date.now() + 60_000).toISOString();
    const claimed = await db.from("tenant_integrations").update({ token_refresh_locked_until: lock })
      .eq("organization_id", integration.organization_id).eq("id", integration.id).neq("status", "disconnected")
      .or(`token_refresh_locked_until.is.null,token_refresh_locked_until.lt.${new Date().toISOString()}`)
      .select("id").maybeSingle();
    if (claimed.error) throw new CommerceError("Falha ao renovar a autorização.");
    if (!claimed.data) throw new CommerceError("A autorização está sendo renovada. Aguarde alguns segundos.", 409);
    try {
      const result = TOKEN_SCHEMA.parse(await commerceRequest(`${integration.store_metadata.store_url}/admin/oauth/access_token`, {
        method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ client_id: SHOPIFY_CLIENT_ID, client_secret: SHOPIFY_CLIENT_SECRET, grant_type: "refresh_token", refresh_token: refresh }).toString(),
      }));
      if (!result.refresh_token || !result.expires_in) throw new CommerceError("Resposta de renovação inválida.");
      const { error, data } = await db.from("tenant_integrations").update({
        oauth_access_token_encrypted: await encryptRequired(db, result.access_token),
        oauth_refresh_token_encrypted: await encryptRequired(db, result.refresh_token),
        expires_at: new Date(Date.now() + result.expires_in * 1000).toISOString(), token_refresh_locked_until: null,
      }).eq("organization_id", integration.organization_id).eq("id", integration.id).eq("token_refresh_locked_until", lock).neq("status", "disconnected").select("id").maybeSingle();
      if (error || !data) throw new CommerceError("A renovação não foi salva. Reconecte a loja.");
      token = result.access_token;
    } finally {
      await db.from("tenant_integrations").update({ token_refresh_locked_until: null }).eq("organization_id", integration.organization_id).eq("id", integration.id).eq("token_refresh_locked_until", lock);
    }
  }
  return new ShopifyClient(integration.store_metadata.store_url, token);
}
