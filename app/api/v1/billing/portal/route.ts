/**
 * POST /api/v1/billing/portal — abre o portal de cobrança do Stripe.
 *
 * É o portal HOSPEDADO deles: trocar cartão, ver faturas, mudar de plano com
 * rateio e cancelar. Construir essas quatro telas aqui significaria reimplementar
 * — e manter alinhado com a régua fiscal de outro país — o que o Stripe já
 * entrega pronto e mantém.
 *
 * O `customer` NUNCA vem do body: ele é lido da linha da organização. Aceitá-lo
 * do cliente deixaria qualquer admin abrir o portal (com faturas e cartão) de
 * outra empresa só trocando um id.
 */
import { randomUUID } from "node:crypto";
import type { NextRequest, NextResponse } from "next/server";

import { fail, ok } from "@/lib/api/wrappers";
import { audit } from "@/lib/audit";
import { requireRole } from "@/lib/auth/require-role";
import { estadoDaCobranca } from "@/lib/billing/assinatura";
import { instalacaoCobra } from "@/lib/billing/planos";
import { criarPortalSession, StripeError } from "@/lib/billing/stripe";
import { env } from "@/lib/env";
import { requireSupportWrite } from "@/lib/impersonate/support";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: NextRequest): Promise<NextResponse> {
  const supportDenied = await requireSupportWrite();
  if (supportDenied) return supportDenied;

  const requestId = randomUUID();

  if (!instalacaoCobra()) {
    return fail("not_found", "Esta instalação não cobra assinatura.", 404, { requestId });
  }

  const authz = await requireRole("admin", { requestId, resource: "billing" });
  if (!authz.ok) return authz.response;
  const orgId = authz.org.orgId;

  const admin = createAdminClient();
  const { data: org } = await admin
    .from("organizations")
    .select("created_at")
    .eq("id", orgId)
    .maybeSingle();

  const estado = await estadoDaCobranca(admin, orgId, org?.created_at ?? null);
  if (!estado.stripeCustomerId) {
    return fail(
      "not_found",
      "Esta empresa ainda não tem assinatura. Escolha um plano primeiro.",
      404,
      { requestId },
    );
  }

  const configurada = env.NEXT_PUBLIC_APP_URL;
  const usavel = configurada && !configurada.includes("placeholder.invalid") ? configurada : null;
  const base = usavel ?? req.headers.get("origin") ?? `${req.nextUrl.protocol}//${req.nextUrl.host}`;

  let url: string;
  try {
    const sessao = await criarPortalSession({
      customerId: estado.stripeCustomerId,
      returnUrl: `${base}/app/settings/billing`,
    });
    url = sessao.url;
  } catch (e) {
    const erro = e instanceof StripeError ? e : null;
    return fail(
      "internal_error",
      erro?.message ?? "Não foi possível abrir o portal de cobrança agora.",
      502,
      { requestId },
    );
  }

  void audit({
    action: "billing.portal_opened",
    actorUserId: authz.user.id,
    organizationId: orgId,
    resourceType: "org_subscriptions",
    resourceId: orgId,
    requestId,
  });

  return ok({ url }, { requestId });
}
