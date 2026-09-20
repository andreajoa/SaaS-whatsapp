/**
 * GET /api/v1/billing/checkout/status?sessao=cs_... — "o pagamento fechou?"
 *
 * ─── Por que existe, se o webhook é a fonte da verdade ─────────────────────
 *
 * Continua sendo. Esta rota não decide nada que o webhook não decidiria: ela
 * relê a MESMA assinatura no Stripe e chama o MESMO `sincronizarAssinatura`.
 * O que ela compra é o intervalo entre o cartão ser aprovado e o webhook
 * chegar — segundos, às vezes mais —, durante o qual a pessoa que acabou de
 * pagar veria a tela dizendo que ela não assinou nada. Gravar duas vezes é
 * inofensivo: o `upsert` é por `organization_id`.
 *
 * Se o Stripe não tiver entregue o webhook, esta rota já deixou o acesso
 * correto. Se entregar depois, sobrescreve com o mesmo valor.
 *
 * ─── O que é conferido antes de ler ────────────────────────────────────────
 *
 * O `cs_...` vem da query string, que é do usuário. Um admin da organização A
 * que adivinhasse (ou roubasse) o id de sessão da organização B faria o
 * servidor gravar a assinatura de B... em B, não em A — mas ainda assim
 * dispararia escrita numa org que não é dele. A checagem
 * `metadata.organization_id === org ativa` fecha isso: a única org que esta
 * rota grava é a do chamador.
 */
import { randomUUID } from "node:crypto";
import type { NextRequest, NextResponse } from "next/server";

import { fail, ok } from "@/lib/api/wrappers";
import { requireRole } from "@/lib/auth/require-role";
import { instalacaoCobra } from "@/lib/billing/planos";
import { sincronizarAssinatura } from "@/lib/billing/sincronizar";
import { lerAssinatura, lerCheckoutSession, StripeError } from "@/lib/billing/stripe";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** `cs_test_...` / `cs_live_...`. Barrado aqui para não virar path na URL do Stripe. */
const FORMATO_DE_SESSAO = /^cs_[A-Za-z0-9_]{10,255}$/;

export async function GET(req: NextRequest): Promise<NextResponse> {
  const requestId = randomUUID();

  if (!instalacaoCobra()) {
    return fail("not_found", "Esta instalação não cobra assinatura.", 404, { requestId });
  }

  const authz = await requireRole("admin", { requestId, resource: "billing" });
  if (!authz.ok) return authz.response;
  const orgId = authz.org.orgId;

  const sessionId = req.nextUrl.searchParams.get("sessao") ?? "";
  if (!FORMATO_DE_SESSAO.test(sessionId)) {
    return fail("invalid_request", "sessão inválida.", 422, { requestId });
  }

  try {
    const sessao = await lerCheckoutSession(sessionId);

    const daSessao = sessao.metadata?.organization_id ?? sessao.client_reference_id;
    if (daSessao !== orgId) {
      // Não conta que existe e é de outro: para quem pergunta, não existe.
      return fail("not_found", "sessão não encontrada.", 404, { requestId });
    }

    // Aberta ou expirada: nada a gravar. A tela mostra o que couber.
    if (sessao.status !== "complete" || !sessao.subscription) {
      return ok({ status: sessao.status ?? "open", plano: null }, { requestId });
    }

    const sub = await lerAssinatura(sessao.subscription);
    const { plano, status } = await sincronizarAssinatura(createAdminClient(), orgId, sub);

    return ok({ status: "complete", plano, assinatura: status }, { requestId });
  } catch (e) {
    const erro = e instanceof StripeError ? e : null;
    return fail(
      "internal_error",
      erro?.message ?? "Não foi possível confirmar o pagamento agora.",
      502,
      { requestId },
    );
  }
}
