import { createHash } from "node:crypto";
import { z } from "zod";
import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/require-role";
import { requireSupportWrite, authenticatedSessionId } from "@/lib/impersonate/support";
import { createAdminClient } from "@/lib/supabase/admin";
import { fail } from "@/lib/api/wrappers";
import { env } from "@/lib/env";
import { issueState, verifyState } from "@/lib/nuvemshop/state";
import { assinarVinculo } from "@/lib/agenda/google/vinculo";
import { validateStoreUrl } from "@/lib/commerce/http";
import { SHOPIFY_SCOPES } from "@/lib/commerce/shopify";

export async function GET(req: Request) {
  const auth = await requireRole("admin"); if (!auth.ok) return auth.response;
  const blocked = await requireSupportWrite(auth.org.orgId); if (blocked) return blocked;
  if (!env.SHOPIFY_CLIENT_ID || !env.SHOPIFY_CLIENT_SECRET) return fail("not_configured", "A conexão com autorização Shopify precisa ser habilitada pelo administrador da plataforma.", 422);
  const parsed = z.string().url().max(300).safeParse(new URL(req.url).searchParams.get("store_url"));
  if (!parsed.success) return fail("validation_failed", "Informe o endereço original da loja Shopify.", 422);
  let storeUrl: string;
  try { storeUrl = await validateStoreUrl(parsed.data, "shopify"); }
  catch { return fail("validation_failed", "Use sua-loja.myshopify.com com HTTPS.", 422); }
  const sessionId = await authenticatedSessionId();
  const token = issueState(auth.org.orgId, { userId: auth.user.id, authSessionId: sessionId });
  const state = verifyState(token)!;
  const db = createAdminClient();
  const saved = await db.from("commerce_oauth_states").insert({ nonce_hash: createHash("sha256").update(state.nonce).digest("hex"), organization_id: auth.org.orgId, actor_id: auth.user.id, auth_session_id: sessionId, shop: new URL(storeUrl).hostname, expires_at: new Date(state.expMs).toISOString() });
  if (saved.error) return fail("upstream_unavailable", "Não foi possível iniciar a autorização.", 503);
  const url = new URL(`${storeUrl}/admin/oauth/authorize`);
  url.searchParams.set("client_id", env.SHOPIFY_CLIENT_ID);
  url.searchParams.set("scope", SHOPIFY_SCOPES.join(","));
  url.searchParams.set("redirect_uri", `${env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "")}/api/v1/integrations/shopify/callback`);
  url.searchParams.set("state", token);
  const response = NextResponse.redirect(url);
  response.cookies.set("crm_shopify_bind", assinarVinculo(state.nonce, env.INTERNAL_SECRET), { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/api/v1/integrations/shopify/callback", maxAge: 600 });
  return response;
}
