import { createHmac } from "node:crypto";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { decimalCents } from "./types";
import { ShopifyClient, verifyShopifyCallback, verifyShopifyWebhook, SHOPIFY_API_VERSION } from "./shopify";
import { WooCommerceClient } from "./woocommerce";
import { buscarComRelaxamento } from "@/lib/catalogo/busca";
import type * as Http from "./http";

const request = vi.hoisted(() => vi.fn());
vi.mock("./http", async (original) => ({ ...await original<typeof Http>(), commerceRequest: request }));
const SECRET = "test-only-shopify-secret";
beforeEach(() => request.mockReset());

describe("comércio: valor exato e identidade", () => {
  it("converte decimais exatamente e recusa perda de precisão", () => {
    expect(decimalCents("19.99")).toBe(1999); expect(decimalCents("0.1")).toBe(10); expect(decimalCents("100")).toBe(10000);
    for (const invalid of ["-1", "1.001", "NaN", "Infinity", "1,2", "90071992547409999"]) expect(() => decimalCents(invalid)).toThrow();
  });
  it("a busca reconhece o SKU da loja sem trocar a identidade do catálogo", () => {
    const row = { nome: "Produto especial", codigo: "shopify:gid://shopify/ProductVariant/887744", sku: "SP-256", preco_cents: 15000 };
    const result = buscarComRelaxamento([row], "SP-256");
    expect(result.achados[0]?.produto.codigo).toBe(row.codigo); expect(result.ignorados).toEqual([]);
  });
});
describe("Shopify: autenticação", () => {
  it("webhook autentica os bytes recebidos em base64 e rejeita segredo vazio/alteração", () => {
    const raw = '{"id":123,"body":"olá"}'; const signature = createHmac("sha256", SECRET).update(raw).digest("base64");
    expect(verifyShopifyWebhook(raw, signature, SECRET)).toBe(true);
    expect(verifyShopifyWebhook(raw + " ", signature, SECRET)).toBe(false);
    expect(verifyShopifyWebhook(raw, signature, "")).toBe(false);
    expect(verifyShopifyWebhook(raw, "a", SECRET)).toBe(false);
  });
  it("callback inclui todos os parâmetros e recusa parâmetro repetido", () => {
    const params = new URLSearchParams({ code: "123", shop: "example-store.myshopify.com", state: "state-value", timestamp: "123456", signature: "additional-value" });
    const message = [...params.entries()].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([k, v]) => `${k}=${v}`).join("&");
    params.set("hmac", createHmac("sha256", SECRET).update(message).digest("hex"));
    expect(verifyShopifyCallback(params, SECRET)).toBe(true);
    params.append("shop", "another-store.myshopify.com"); expect(verifyShopifyCallback(params, SECRET)).toBe(false);
  });
});
describe("Shopify: leituras reais do contrato GraphQL", () => {
  it("verifica os três escopos antes de anunciar conexão", async () => {
    request.mockResolvedValueOnce({ data: { shop: { name: "Loja teste", currencyCode: "BRL" }, currentAppInstallation: { accessScopes: [{ handle: "read_products" }] } } });
    await expect(new ShopifyClient("https://test-store.myshopify.com", "test-token").verify()).rejects.toThrow("Autorize");
    const [url, options] = request.mock.calls[0]!;
    expect(url).toContain(`/admin/api/${SHOPIFY_API_VERSION}/graphql.json`);
    expect(options.headers["X-Shopify-Access-Token"]).toBe("test-token"); expect(url).not.toContain("test-token");
  });
  it("importa preço e estoque da variante, preservando paginação e moeda", async () => {
    request.mockResolvedValueOnce({ data: { shop: { currencyCode: "USD" }, productVariants: { nodes: [{ id: "gid://shopify/ProductVariant/5", title: "256 GB", sku: "PH-256", price: "199.95", inventoryQuantity: -2, inventoryItem: { tracked: true }, image: null, product: { title: "Phone", description: "Teste", vendor: "Marca", productType: "Phones", status: "ACTIVE", onlineStoreUrl: "https://example.com/products/phone", featuredImage: { url: "https://example.com/img.png" } } }], pageInfo: { hasNextPage: true, endCursor: "next" } } } });
    const result = await new ShopifyClient("https://test-store.myshopify.com", "test-token").products("previous");
    expect(result.next_cursor).toBe("next"); expect(result.items[0]).toMatchObject({ sku: "PH-256", name: "Phone — 256 GB", price_cents: 19995, currency: "USD", quantity: 0, tracks_inventory: true });
    expect(JSON.parse(request.mock.calls[0]![1].body).variables.cursor).toBe("previous");
  });
  it("erro GraphQL não produz catálogo vazio com sucesso", async () => {
    request.mockResolvedValueOnce({ data: {}, errors: [{ message: "ACCESS_DENIED" }] });
    await expect(new ShopifyClient("https://test-store.myshopify.com", "test-token").orders(null)).rejects.toThrow();
  });
});
describe("WooCommerce: autorização e variantes", () => {
  it("usa Basic em header, valida capacidades e respeita moeda da loja", async () => {
    request.mockResolvedValueOnce({ environment: { site_url: "https://shop.example.com" }, settings: { currency: "EUR" } }).mockResolvedValueOnce([]).mockResolvedValueOnce([]);
    const result = await new WooCommerceClient("https://shop.example.com", "ck_test", "cs_test").verify();
    expect(result.currency).toBe("EUR");
    for (const [url, options] of request.mock.calls) {
      expect(url).not.toContain("ck_test"); expect(url).not.toContain("cs_test");
      expect(options.headers.Authorization).toBe(`Basic ${Buffer.from("ck_test:cs_test").toString("base64")}`);
    }
  });
  it("preço de pai variável não substitui preço das variações e estoque herdado", async () => {
    const parent = { id: 1, name: "Camiseta", type: "variable", sku: "", description: "<p>Algodão</p>", price: "", status: "publish", manage_stock: true, stock_quantity: 4, stock_status: "instock", permalink: "https://shop.example.com/shirt", images: [], categories: [] };
    request.mockResolvedValueOnce({ environment: { site_url: "https://shop.example.com" }, settings: { currency: "BRL" } }).mockResolvedValueOnce([]).mockResolvedValueOnce([]).mockResolvedValueOnce([parent]).mockResolvedValueOnce([{ id: 11, sku: "SH-M", price: "39.90", status: "publish", manage_stock: "parent", stock_quantity: null, stock_status: "instock", image: null, attributes: [{ option: "M" }] }]);
    const result = await new WooCommerceClient("https://shop.example.com", "ck_test", "cs_test").products(null);
    expect(result.items).toHaveLength(1); expect(result.items[0]).toMatchObject({ name: "Camiseta — M", external_id: "11", sku: "SH-M", price_cents: 3990, tracks_inventory: true, quantity: 4 });
  });
});
