import { z } from "zod";
import { ok, fail } from "@/lib/api/wrappers";
import { audit } from "@/lib/audit";
import { checkRateLimit } from "@/lib/ai/dispatcher/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import { decryptWebhookSecret } from "@/lib/webhooks/secrets";
import { verifyShopifyWebhook } from "@/lib/commerce/shopify";

const TOPICS: Record<string, string> = { products_create: "products/create", products_update: "products/update", products_delete: "products/delete", orders_create: "orders/create", orders_updated: "orders/updated", orders_paid: "orders/paid", orders_cancelled: "orders/cancelled", inventory_levels_update: "inventory_levels/update", app_uninstalled: "app/uninstalled" };
const MAX_BODY = 2_000_000;
export const runtime = "nodejs";
export async function POST(req: Request, ctx: { params: Promise<{ token: string; topic: string }> }) {
  const { token, topic } = await ctx.params;
  if (!/^[a-f0-9]{48}$/.test(token) || !TOPICS[topic]) return fail("not_found", "Webhook não encontrado.", 404);
  // Token é opaco, mas não o registra em chave ou log. Limite por hash.
  const { createHash } = await import("node:crypto");
  const rate = await checkRateLimit(`commerce-wh:${createHash("sha256").update(token).digest("hex")}`, 200, 60);
  if (!rate.allowed) return fail("rate_limited", "Tente novamente em alguns instantes.", 429);
  if (Number(req.headers.get("content-length") ?? 0) > MAX_BODY) return fail("validation_failed", "Evento muito grande.", 413);
  const reader = req.body?.getReader(); if (!reader) return fail("validation_failed", "Evento vazio.", 400);
  const chunks: Uint8Array[] = []; let size = 0;
  for (;;) {
    const { done, value } = await reader.read(); if (done) break;
    size += value.byteLength; if (size > MAX_BODY) { await reader.cancel(); return fail("validation_failed", "Evento muito grande.", 413); }
    chunks.push(value);
  }
  const raw = Buffer.concat(chunks).toString("utf8");
  const db = createAdminClient();
  const connection = await db.from("tenant_integrations").select("id,organization_id,provider,status,store_metadata,webhook_secret_encrypted").eq("webhook_path_token", token).eq("provider", "shopify").maybeSingle();
  if (connection.error) return fail("upstream_unavailable", "Não foi possível validar o evento.", 503);
  if (!connection.data) return fail("not_found", "Webhook não encontrado.", 404);
  const row = connection.data;
  const secret = await decryptWebhookSecret(db, row.webhook_secret_encrypted as string);
  if (!secret || !verifyShopifyWebhook(raw, req.headers.get("x-shopify-hmac-sha256"), secret)) return fail("unauthenticated", "Assinatura inválida.", 401);
  const metadata = z.object({ store_url: z.string().url() }).safeParse(row.store_metadata);
  if (!metadata.success || req.headers.get("x-shopify-shop-domain") !== new URL(metadata.data.store_url).hostname || req.headers.get("x-shopify-topic") !== TOPICS[topic]) return fail("validation_failed", "Evento incompatível com esta conexão.", 422);
  const external = z.string().min(1).max(100).safeParse(req.headers.get("x-shopify-webhook-id"));
  if (!external.success) return fail("validation_failed", "Identificador de entrega ausente.", 422);
  if (row.status === "disconnected") return ok({ accepted: false, reason: "disconnected" });
  if (topic === "app_uninstalled") {
    let parsed: unknown;
    try { parsed = JSON.parse(raw); } catch { return fail("validation_failed", "Evento JSON inválido.", 422); }
    const body = z.object({ myshopify_domain: z.string() }).safeParse(parsed);
    if (!body.success || body.data.myshopify_domain !== new URL(metadata.data.store_url).hostname) return fail("validation_failed", "Loja incompatível.", 422);
  }
  const queued = await db.rpc("fn_commerce_webhook", { p_org: row.organization_id, p_integration: row.id, p_external: external.data, p_topic: TOPICS[topic] });
  if (queued.error) return fail("upstream_unavailable", "Não foi possível registrar o evento.", 503);
  if (queued.data) await audit({ organizationId: row.organization_id, action: "commerce.webhook_received", resourceType: "tenant_integration", resourceId: row.id, metadata: { topic: TOPICS[topic] } });
  return ok({ accepted: true, duplicate: !queued.data });
}
