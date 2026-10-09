import { z } from "zod";

export const COMMERCE_PROVIDERS = ["shopify", "woocommerce"] as const;
export type CommerceProvider = (typeof COMMERCE_PROVIDERS)[number];
export const providerSchema = z.enum(COMMERCE_PROVIDERS);
export const connectionSchema = z.object({
  provider: providerSchema,
  store_url: z.string().trim().url().max(300),
  access_token: z.string().trim().min(8).max(2000),
  consumer_secret: z.string().trim().min(8).max(2000).optional(),
  refresh_token: z.string().trim().min(8).max(2000).optional(),
  expires_at: z.string().datetime({ offset: true }).optional(),
}).superRefine((value, ctx) => {
  if (value.provider === "woocommerce" && !value.consumer_secret) {
    ctx.addIssue({ code: "custom", path: ["consumer_secret"], message: "Informe o segredo da chave de leitura." });
  }
});

export interface CommerceProduct {
  external_id: string;
  sku: string;
  name: string;
  description: string;
  brand: string | null;
  category: string | null;
  price_cents: number;
  currency: string;
  tracks_inventory: boolean;
  quantity: number;
  active: boolean;
  image_url: string | null;
  url: string | null;
}
export interface CommerceOrder {
  external_id: string;
  customer_external_id: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  status: "pending" | "paid" | "cancelled" | "fulfilled" | "refunded";
  total_cents: number;
  currency: string;
  tracking_code: string | null;
  ordered_at: string;
  updated_at: string | null;
}
export interface CommercePage<T> { items: T[]; next_cursor: string | null }
export interface CommerceClient {
  verify(): Promise<{ name: string; currency: string; scopes: string[] }>;
  products(cursor: string | null): Promise<CommercePage<CommerceProduct>>;
  orders(cursor: string | null): Promise<CommercePage<CommerceOrder>>;
}
export interface CommerceIntegration {
  id: string; organization_id: string; provider: CommerceProvider;
  oauth_access_token_encrypted: string; oauth_refresh_token_encrypted: string | null;
  expires_at: string | null; status: string;
  store_metadata: { store_url: string; name?: string; currency?: string; refresh_expires_at?: string };
}

/** Valores monetários remotos viram centavos por decimal, nunca por ponto flutuante. */
export function decimalCents(value: string): number {
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(value);
  if (!match) throw new Error("Preço remoto inválido ou moeda com precisão não suportada.");
  const cents = Number(match[1]) * 100 + Number((match[2] ?? "").padEnd(2, "0"));
  if (!Number.isSafeInteger(cents)) throw new Error("Preço remoto fora do limite.");
  return cents;
}
