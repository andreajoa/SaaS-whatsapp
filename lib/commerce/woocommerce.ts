import { z } from "zod";
import { commerceRequest, CommerceError } from "./http";
import { decimalCents, type CommerceClient, type CommerceProduct, type CommerceOrder } from "./types";

const productSchema = z.object({
  id: z.number().int(), name: z.string(), type: z.string(), sku: z.string(), description: z.string(),
  price: z.string(), status: z.string(), manage_stock: z.boolean(), stock_quantity: z.number().nullable(),
  stock_status: z.string(), permalink: z.string(), images: z.array(z.object({ src: z.string() })),
  categories: z.array(z.object({ name: z.string() })),
});
const orderSchema = z.object({
  id: z.number(), customer_id: z.number(), status: z.string(), currency: z.string(), total: z.string(),
  date_created_gmt: z.string(), date_modified_gmt: z.string(),
  billing: z.object({ email: z.string(), phone: z.string() }),
});
const PAGE_SIZE = 50;
export class WooCommerceClient implements CommerceClient {
  private authorization: string;
  private currency = "";
  private deadline = Date.now() + 120_000;
  constructor(private storeUrl: string, consumerKey: string, consumerSecret: string) {
    this.authorization = `Basic ${Buffer.from(`${consumerKey}:${consumerSecret}`).toString("base64")}`;
  }
  private request(path: string) {
    if (Date.now() >= this.deadline) throw new CommerceError("Esta página da loja excedeu o tempo de sincronização. Revise produtos com muitas variantes e tente novamente.");
    return commerceRequest(`${this.storeUrl}/wp-json/wc/v3/${path}`, { headers: { Authorization: this.authorization, Accept: "application/json" } });
  }
  async verify() {
    const info = z.object({ environment: z.object({ site_url: z.string() }), settings: z.object({ currency: z.string().regex(/^[A-Z]{3}$/) }) }).parse(await this.request("system_status"));
    this.currency = info.settings.currency;
    // Confirma as duas capacidades que serão usadas, antes de gravar conectado.
    z.array(productSchema).parse(await this.request("products?per_page=1"));
    z.array(orderSchema).parse(await this.request("orders?per_page=1"));
    return { name: new URL(info.environment.site_url).hostname, currency: this.currency, scopes: ["read_products", "read_orders"] };
  }
  private page(cursor: string | null): number {
    const number = Number(cursor ?? "1");
    if (!Number.isSafeInteger(number) || number < 1 || number > 10000) throw new CommerceError("Página de sincronização inválida.");
    return number;
  }
  async products(cursor: string | null) {
    if (!this.currency) await this.verify();
    const number = this.page(cursor);
    const products = z.array(productSchema).parse(await this.request(`products?per_page=${PAGE_SIZE}&page=${number}&orderby=id&order=asc`));
    const items: CommerceProduct[] = [];
    for (const p of products) {
      if (p.type === "variable") {
        // Variantes têm preço/estoque próprios. O pai sem preço nunca vira oferta.
        let variationPage = 1;
        for (;;) {
          const variantSchema = z.object({ id: z.number(), sku: z.string(), price: z.string(), status: z.string(), manage_stock: z.union([z.boolean(), z.literal("parent")]), stock_quantity: z.number().nullable(), stock_status: z.string(), image: z.object({ src: z.string() }).nullable(), attributes: z.array(z.object({ option: z.string() })) });
          const variations = z.array(variantSchema).parse(await this.request(`products/${p.id}/variations?per_page=50&page=${variationPage}`));
          for (const v of variations) {
            if (!v.price) continue;
            const managesStock = v.manage_stock === "parent" ? p.manage_stock : v.manage_stock;
            const quantity = v.manage_stock === "parent" ? p.stock_quantity : v.stock_quantity;
            items.push({ ...this.product(p), external_id: String(v.id), sku: v.sku || String(v.id), name: `${p.name} — ${v.attributes.map((a) => a.option).join(" / ")}`, price_cents: decimalCents(v.price), tracks_inventory: managesStock || v.stock_status !== "instock", quantity: Math.max(0, quantity ?? 0), active: p.status === "publish" && v.status === "publish", image_url: v.image?.src ?? p.images[0]?.src ?? null });
          }
          if (variations.length < 50) break;
          if (++variationPage > 20) throw new CommerceError("Produto com mais de mil variantes: sincronização interrompida para evitar truncagem.");
        }
      } else if (p.price) items.push(this.product(p));
    }
    return { items, next_cursor: products.length === PAGE_SIZE ? String(number + 1) : null };
  }
  private product(p: z.infer<typeof productSchema>): CommerceProduct {
    return { external_id: String(p.id), sku: p.sku || String(p.id), name: p.name, description: p.description.replace(/<[^>]*>/g, " ").trim(), brand: null, category: p.categories.map((c) => c.name).join(", ") || null, price_cents: p.price ? decimalCents(p.price) : 0, currency: this.currency, tracks_inventory: p.manage_stock || p.stock_status !== "instock", quantity: Math.max(0, p.stock_quantity ?? 0), active: p.status === "publish", image_url: p.images[0]?.src ?? null, url: p.permalink };
  }
  async orders(cursor: string | null) {
    const number = this.page(cursor);
    const orders = z.array(orderSchema).parse(await this.request(`orders?per_page=${PAGE_SIZE}&page=${number}&orderby=id&order=asc`));
    const items: CommerceOrder[] = orders.map((o) => ({ external_id: String(o.id), customer_external_id: o.customer_id ? String(o.customer_id) : null, customer_email: o.billing.email || null, customer_phone: o.billing.phone || null, status: o.status === "completed" ? "fulfilled" : o.status === "refunded" ? "refunded" : ["cancelled", "failed"].includes(o.status) ? "cancelled" : o.status === "processing" ? "paid" : "pending", total_cents: decimalCents(o.total), currency: o.currency, tracking_code: null, ordered_at: `${o.date_created_gmt}Z`, updated_at: `${o.date_modified_gmt}Z` }));
    return { items, next_cursor: orders.length === PAGE_SIZE ? String(number + 1) : null };
  }
}
