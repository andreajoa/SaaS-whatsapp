import { z } from "zod";
import { audit } from "@/lib/audit";
import { createAdminClient } from "@/lib/supabase/admin";
import type { EventHandler, HandlerResult } from "@/lib/event-log/dispatcher";
import { loadCommerceClient } from "./connections";
import { CommerceError } from "./http";
import type { CommerceIntegration, CommerceOrder } from "./types";

const KEY = "commerce-sync";
const runSchema = z.object({ id: z.string().uuid(), integration_id: z.string().uuid(), organization_id: z.string().uuid(), phase: z.enum(["products", "orders", "complete"]), cursor: z.string().nullable(), started_at: z.string(), product_count: z.number(), order_count: z.number() });

/** Um cliente ambíguo não recebe pedido de outra pessoa. Nunca cria contatos pelo e-mail do pedido. */
async function findContact(order: CommerceOrder, organizationId: string): Promise<string | null> {
  const db = createAdminClient();
  if (order.customer_email) {
    const result = await db.from("contacts").select("id").eq("organization_id", organizationId).eq("email_normalized", order.customer_email.trim().toLowerCase()).eq("is_anonymized", false).limit(2);
    if (result.error) throw new CommerceError("Falha ao associar o cliente do pedido.");
    if (result.data?.length === 1) return result.data[0]!.id as string;
  }
  if (order.customer_phone) {
    const phone = order.customer_phone.replace(/\D/g, "");
    if (phone.length < 10 || phone.length > 15) return null;
    const result = await db.from("contacts").select("id").eq("organization_id", organizationId).in("phone_number", [phone, `+${phone}`]).eq("is_anonymized", false).limit(2);
    if (result.error) throw new CommerceError("Falha ao associar o cliente do pedido.");
    if (result.data?.length === 1) return result.data[0]!.id as string;
  }
  return null;
}

export const commerceSyncHandler: EventHandler = {
  key: KEY, events: ["commerce.sync_requested"],
  async handle(event): Promise<HandlerResult> {
    const parsed = z.object({ run_id: z.string().uuid() }).safeParse(event.payload);
    if (!parsed.success) return { consumer_key: KEY, status: "skipped", detail: "invalid_run" };
    const db = createAdminClient(); const org = event.organization_id; const id = parsed.data.run_id;
    const lockedUntil = new Date(Date.now() + 180_000).toISOString();
    const claim = await db.from("commerce_sync_runs").update({ status: "running", locked_until: lockedUntil })
      .eq("organization_id", org).eq("id", id).in("status", ["queued", "running"])
      .or(`locked_until.is.null,locked_until.lt.${new Date().toISOString()}`).select("*").maybeSingle();
    if (claim.error) return { consumer_key: KEY, status: "error", detail: "claim_failed" };
    if (!claim.data) {
      const { data } = await db.from("commerce_sync_runs").select("status").eq("organization_id", org).eq("id", id).maybeSingle();
      return data?.status === "running" ? { consumer_key: KEY, status: "retry", retry_at: new Date(Date.now() + 15_000).toISOString(), detail: "busy" } : { consumer_key: KEY, status: "skipped", detail: "inactive_run" };
    }
    const run = runSchema.parse(claim.data);
    try {
      const { data, error } = await db.from("tenant_integrations").select("*").eq("organization_id", org).eq("id", run.integration_id).neq("status", "disconnected").maybeSingle();
      if (error || !data) throw new CommerceError("Loja desconectada.");
      const integration = data as CommerceIntegration;
      const client = await loadCommerceClient(db, integration);
      const page = run.phase === "products" ? await client.products(run.cursor) : await client.orders(run.cursor);
      const products = run.phase === "products" ? page.items : [];
      const orders: Record<string, unknown>[] = [];
      if (run.phase === "orders") for (const item of page.items as CommerceOrder[]) {
        const { customer_email: _email, customer_phone: _phone, updated_at, ...safe } = item;
        orders.push({ ...safe, updated_at_remote: updated_at, contact_id: await findContact(item, org) });
      }
      const nextPhase = page.next_cursor ? run.phase : run.phase === "products" ? "orders" : "complete";
      const saved = await db.rpc("fn_commerce_store_page", { p_org: org, p_run: id, p_lock: lockedUntil, p_products: products, p_orders: orders, p_phase: nextPhase, p_cursor: page.next_cursor });
      if (saved.error) throw new CommerceError("Falha ao salvar a sincronização.");
      if (nextPhase === "complete") await audit({ action: "commerce.sync_completed", organizationId: org, resourceType: "commerce_sync", resourceId: id, metadata: { provider: integration.provider, product_count: run.product_count, order_count: run.order_count + orders.length } });
      return { consumer_key: KEY, status: "ok" };
    } catch (error) {
      const transient = error instanceof CommerceError && [409, 429].includes(error.status);
      const message = error instanceof CommerceError ? error.message : "Não foi possível sincronizar a loja. Confira a conexão e tente novamente.";
      await db.from("commerce_sync_runs").update({ status: transient ? "queued" : "failed", locked_until: null, error_code: message, ...(!transient ? { completed_at: new Date().toISOString() } : {}) }).eq("organization_id", org).eq("id", id).eq("locked_until", lockedUntil);
      if (!transient) {
        await db.from("tenant_integrations").update({ status: "error", status_reason: message }).eq("organization_id", org).eq("id", run.integration_id).neq("status", "disconnected");
        await audit({ action: "commerce.sync_failed", organizationId: org, resourceType: "commerce_sync", resourceId: id, metadata: { reason: message } });
      }
      return transient ? { consumer_key: KEY, status: "retry", retry_at: new Date(Date.now() + 60_000).toISOString(), detail: "upstream_busy" } : { consumer_key: KEY, status: "ok", detail: "failed_visible_to_operator" };
    }
  },
};
