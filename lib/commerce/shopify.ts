import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { CommerceError, commerceRequest } from "./http";
import { decimalCents, type CommerceClient, type CommerceProduct, type CommerceOrder } from "./types";

export const SHOPIFY_API_VERSION = "2026-10";
export const SHOPIFY_SCOPES = ["read_products", "read_inventory", "read_orders"];
const pageInfo = z.object({ hasNextPage: z.boolean(), endCursor: z.string().nullable() });
const money = z.object({ amount: z.string(), currencyCode: z.string().regex(/^[A-Z]{3}$/) });
const variants = z.object({ nodes: z.array(z.object({
  id: z.string(), title: z.string(), sku: z.string().nullable(), price: z.string(),
  inventoryQuantity: z.number().int(), inventoryItem: z.object({ tracked: z.boolean() }),
  image: z.object({ url: z.string() }).nullable(),
  product: z.object({ title: z.string(), description: z.string(), vendor: z.string(), productType: z.string(), status: z.string(), onlineStoreUrl: z.string().nullable(), featuredImage: z.object({ url: z.string() }).nullable() }),
})), pageInfo });
const remoteOrders = z.object({ nodes: z.array(z.object({
  id: z.string(), createdAt: z.string(), updatedAt: z.string(), cancelledAt: z.string().nullable(),
  displayFinancialStatus: z.string().nullable(), displayFulfillmentStatus: z.string(),
  email: z.string().nullable(), phone: z.string().nullable(),
  customer: z.object({ id: z.string() }).nullable(),
  totalPriceSet: z.object({ shopMoney: money }),
  fulfillments: z.array(z.object({ trackingInfo: z.array(z.object({ number: z.string().nullable() })) })),
})), pageInfo });

export class ShopifyClient implements CommerceClient {
  constructor(private storeUrl: string, private token: string) {}
  async graphql(query: string, variables: Record<string, unknown> = {}): Promise<Record<string, unknown>> {
    const raw = await commerceRequest(`${this.storeUrl}/admin/api/${SHOPIFY_API_VERSION}/graphql.json`, {
      method: "POST", headers: { "Content-Type": "application/json", "X-Shopify-Access-Token": this.token }, body: JSON.stringify({ query, variables }),
    });
    const result = z.object({ data: z.record(z.string(), z.unknown()).optional(), errors: z.array(z.unknown()).optional() }).parse(raw);
    if (result.errors?.length || !result.data) throw new CommerceError("A loja recusou a consulta. Verifique as permissões do aplicativo.");
    return result.data;
  }
  async verify() {
    const data = await this.graphql("query { shop { name currencyCode } currentAppInstallation { accessScopes { handle } } }");
    const shop = z.object({ name: z.string(), currencyCode: z.string() }).parse(data.shop);
    const install = z.object({ accessScopes: z.array(z.object({ handle: z.string() })) }).parse(data.currentAppInstallation);
    const scopes = install.accessScopes.map((s) => s.handle);
    if (SHOPIFY_SCOPES.some((scope) => !scopes.includes(scope))) throw new CommerceError("Autorize leitura de produtos, estoque e pedidos para conectar.", 422);
    return { name: shop.name, currency: shop.currencyCode, scopes };
  }
  async products(cursor: string | null) {
    const data = await this.graphql(`query($cursor:String) { shop { currencyCode } productVariants(first:50, after:$cursor) { nodes { id title sku price inventoryQuantity inventoryItem { tracked } image { url } product { title description vendor productType status onlineStoreUrl featuredImage { url } } } pageInfo { hasNextPage endCursor } } }`, { cursor });
    const page = variants.parse(data.productVariants);
    const currency = z.object({ currencyCode: z.string().regex(/^[A-Z]{3}$/) }).parse(data.shop).currencyCode;
    const items: CommerceProduct[] = page.nodes.map((v) => ({
      external_id: v.id, sku: v.sku || v.id.split("/").at(-1)!, name: `${v.product.title}${v.title === "Default Title" ? "" : ` — ${v.title}`}`,
      description: v.product.description, brand: v.product.vendor || null, category: v.product.productType || null,
      price_cents: decimalCents(v.price), currency, tracks_inventory: v.inventoryItem.tracked,
      quantity: Math.max(0, v.inventoryQuantity), active: v.product.status === "ACTIVE",
      image_url: v.image?.url ?? v.product.featuredImage?.url ?? null, url: v.product.onlineStoreUrl,
    }));
    return { items, next_cursor: page.pageInfo.hasNextPage ? page.pageInfo.endCursor : null };
  }
  async orders(cursor: string | null) {
    const data = await this.graphql(`query($cursor:String) { orders(first:50, after:$cursor, sortKey:CREATED_AT, reverse:true) { nodes { id createdAt updatedAt cancelledAt displayFinancialStatus displayFulfillmentStatus email phone customer { id } totalPriceSet { shopMoney { amount currencyCode } } fulfillments { trackingInfo { number } } } pageInfo { hasNextPage endCursor } } }`, { cursor });
    const page = remoteOrders.parse(data.orders);
    const items: CommerceOrder[] = page.nodes.map((o) => ({
      external_id: o.id, customer_external_id: o.customer?.id ?? null, customer_email: o.email, customer_phone: o.phone,
      status: o.cancelledAt ? "cancelled" : o.displayFinancialStatus === "REFUNDED" ? "refunded" : o.displayFulfillmentStatus === "FULFILLED" ? "fulfilled" : ["PAID", "PARTIALLY_REFUNDED"].includes(o.displayFinancialStatus ?? "") ? "paid" : "pending",
      total_cents: decimalCents(o.totalPriceSet.shopMoney.amount), currency: o.totalPriceSet.shopMoney.currencyCode,
      tracking_code: o.fulfillments.flatMap((f) => f.trackingInfo).find((t) => t.number)?.number ?? null,
      ordered_at: o.createdAt, updated_at: o.updatedAt,
    }));
    return { items, next_cursor: page.pageInfo.hasNextPage ? page.pageInfo.endCursor : null };
  }
}

export function verifyShopifyWebhook(raw: string, signature: string | null, secret: string): boolean {
  if (!signature || !secret || !/^[A-Za-z0-9+/]{43}=$/.test(signature)) return false;
  const received = Buffer.from(signature, "base64");
  const expected = createHmac("sha256", secret).update(raw).digest();
  return received.length === expected.length && timingSafeEqual(received, expected);
}
export function verifyShopifyCallback(params: URLSearchParams, secret: string): boolean {
  const signature = params.get("hmac");
  if (!signature || !/^[a-f0-9]{64}$/.test(signature)) return false;
  if ([...new Set(params.keys())].some((key) => params.getAll(key).length !== 1)) return false;
  const entries = [...params.entries()].filter(([key]) => key !== "hmac").sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0);
  const message = entries.map(([key, value]) => `${key}=${value}`).join("&");
  const expected = createHmac("sha256", secret).update(message).digest();
  return timingSafeEqual(Buffer.from(signature, "hex"), expected);
}
