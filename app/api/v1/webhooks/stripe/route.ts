/**
 * POST /api/v1/webhooks/stripe — a única fonte da verdade sobre quem pagou.
 *
 * ─── Por que o estado NÃO é gravado no retorno do checkout ─────────────────
 *
 * A tela de sucesso é uma sugestão: o cliente pode fechar o navegador antes do
 * redirect, e a renovação do mês que vem não passa por tela nenhuma. Se o
 * acesso dependesse do `success_url`, metade das assinaturas nunca ficaria
 * ativa e nenhuma renovação seria registrada. O webhook é o caminho, e a tela
 * de sucesso só manda recarregar.
 *
 * ─── Verificação ───────────────────────────────────────────────────────────
 *
 * HMAC-SHA256 sobre `<timestamp>.<corpo CRU>` com `timingSafeEqual`, o mesmo
 * padrão dos demais webhooks de entrada deste repositório. O corpo tem de ser o
 * texto exato — ver `lib/billing/stripe.ts`.
 *
 * (A frase acima nomeava o transporte de mensagens como precedente. Não pode:
 * `scripts/lint-channels.ts` proíbe nomear provider fora de `lib/channels/`, e
 * a varredura é textual — vale para comentário também, de propósito, porque é
 * de comentário que o nome vaza para o próximo arquivo que copia o padrão.)
 *
 * ─── Reentrega ─────────────────────────────────────────────────────────────
 *
 * O Stripe reentrega o MESMO `event.id` por até 3 dias enquanto não receber
 * 2xx. A linha em `billing_webhook_events` é a reivindicação do evento: quem
 * insere primeiro processa, o `23505` do segundo devolve 200 sem reprocessar.
 * Quando o processamento falha, a reivindicação é DESFEITA e a rota devolve
 * 500 — senão a falha ficaria registrada como sucesso e o Stripe nunca mais
 * tentaria.
 */
import type { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";

import { fail, ok } from "@/lib/api/wrappers";
import { audit } from "@/lib/audit";
import { instalacaoCobra, type PlanoId, type StatusAssinatura } from "@/lib/billing/planos";
import { sincronizarAssinatura } from "@/lib/billing/sincronizar";
import { lerAssinatura, verificarWebhook, type StripeSubscription } from "@/lib/billing/stripe";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Os eventos que MUDAM o acesso. O resto (fatura emitida, cartão atualizado,
 * cliente criado) é ignorado com 200 — devolver erro para evento que não nos
 * interessa faria o Stripe reentregar por 3 dias e, depois, desativar o
 * endpoint inteiro por taxa de falha.
 */
const EVENTOS_TRATADOS: ReadonlySet<string> = new Set([
  "checkout.session.completed",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "invoice.paid",
  "invoice.payment_failed",
]);

export async function POST(req: NextRequest): Promise<NextResponse> {
  const requestId = randomUUID();

  if (!instalacaoCobra()) {
    // 404 e não 403: numa instalação que não cobra, este endpoint não existe.
    return fail("not_found", "not_found", 404, { requestId });
  }

  const corpoCru = await req.text();
  const verificacao = verificarWebhook(
    corpoCru,
    req.headers.get("stripe-signature"),
    (process.env.STRIPE_WEBHOOK_SECRET ?? "").trim(),
  );

  if (!verificacao.ok) {
    void audit({
      action: "billing.webhook_invalid_signature",
      requestId,
      metadata: { motivo: verificacao.motivo },
    });
    return fail("unauthorized", "assinatura inválida", 401, { requestId });
  }

  const evento = verificacao.evento;
  const admin = createAdminClient();

  // ─── Reivindica o evento (dedupe) ────────────────────────────────────────
  const { error: erroDeClaim } = await admin.from("billing_webhook_events").insert({
    stripe_event_id: evento.id,
    type: evento.type,
  });
  if (erroDeClaim) {
    // `23505` = já processado. 200 para o Stripe parar de reentregar.
    if ((erroDeClaim as { code?: string }).code === "23505") {
      return ok({ recebido: true, duplicado: true }, { requestId });
    }
    return fail("internal_error", "não foi possível registrar o evento", 500, { requestId });
  }

  const desfazerClaim = async () => {
    await admin.from("billing_webhook_events").delete().eq("stripe_event_id", evento.id);
  };

  if (!EVENTOS_TRATADOS.has(evento.type)) {
    return ok({ recebido: true, ignorado: evento.type }, { requestId });
  }

  try {
    const resultado = await aplicar(admin, evento.type, evento.data.object);

    if (resultado.organizationId) {
      await admin
        .from("billing_webhook_events")
        .update({ organization_id: resultado.organizationId })
        .eq("stripe_event_id", evento.id);

      void audit({
        action: "billing.subscription_updated",
        organizationId: resultado.organizationId,
        resourceType: "org_subscriptions",
        resourceId: resultado.organizationId,
        requestId,
        bypassedRls: true,
        metadata: {
          stripe_event: evento.type,
          status: resultado.status,
          plano: resultado.plano,
        },
      });
    }

    return ok({ recebido: true, aplicado: Boolean(resultado.organizationId) }, { requestId });
  } catch (e) {
    await desfazerClaim();
    return fail(
      "internal_error",
      e instanceof Error ? e.message : "falha ao aplicar o evento",
      500,
      { requestId },
    );
  }
}

interface Aplicado {
  organizationId: string | null;
  status: StatusAssinatura | null;
  plano: PlanoId | null;
}

/**
 * Resolve a assinatura do Stripe que o evento descreve e a grava.
 *
 * Todos os seis eventos convergem para UMA assinatura, e é ela que lemos do
 * Stripe em vez de confiar no recorte que veio no payload: `invoice.paid` traz
 * a fatura, não o estado final da assinatura, e `checkout.session.completed`
 * traz a sessão. Reler custa uma chamada e elimina a classe inteira de bugs em
 * que o payload do evento está desatualizado na hora em que o processamos
 * (reentrega de 3 dias atrás, entrega fora de ordem).
 */
async function aplicar(
  admin: ReturnType<typeof createAdminClient>,
  tipo: string,
  objeto: Record<string, unknown>,
): Promise<Aplicado> {
  const vazio: Aplicado = { organizationId: null, status: null, plano: null };

  const subscriptionId = idDaAssinatura(tipo, objeto);
  if (!subscriptionId) return vazio;

  // `customer.subscription.deleted` é o único que NÃO relemos: a assinatura já
  // não existe para leitura, e o payload do evento é o último estado dela.
  const sub: StripeSubscription =
    tipo === "customer.subscription.deleted"
      ? (objeto as unknown as StripeSubscription)
      : await lerAssinatura(subscriptionId);

  const organizationId = await resolverOrganizacao(admin, sub, objeto);
  if (!organizationId) {
    // Assinatura sem organização é assinatura de outra instalação apontando
    // para o mesmo endpoint (ou teste manual no dashboard). NÃO é erro nosso:
    // devolver 500 faria o Stripe reentregar para sempre.
    return vazio;
  }

  const { plano, status } = await sincronizarAssinatura(admin, organizationId, sub);
  return { organizationId, status, plano };
}

function idDaAssinatura(tipo: string, objeto: Record<string, unknown>): string | null {
  if (tipo.startsWith("customer.subscription.")) {
    return typeof objeto.id === "string" ? objeto.id : null;
  }
  // checkout.session.* e invoice.* trazem a assinatura como referência.
  const sub = objeto.subscription;
  if (typeof sub === "string") return sub;
  if (sub && typeof sub === "object" && typeof (sub as { id?: unknown }).id === "string") {
    return (sub as { id: string }).id;
  }
  // Na API 2025-08 a fatura aponta a assinatura dentro de `parent`.
  const parent = objeto.parent as { subscription_details?: { subscription?: unknown } } | undefined;
  const daFatura = parent?.subscription_details?.subscription;
  return typeof daFatura === "string" ? daFatura : null;
}

/**
 * Qual organização é esta? Três fontes, da mais forte para a mais fraca.
 *
 * NENHUMA delas é "o que veio no body sem assinatura": o payload inteiro já
 * passou pela verificação HMAC, então o `metadata` que o Stripe devolve é o
 * que NÓS gravamos ao criar o checkout. É fonte confiável no sentido da
 * doutrina (webhook assinado), não input de usuário.
 */
async function resolverOrganizacao(
  admin: ReturnType<typeof createAdminClient>,
  sub: StripeSubscription,
  objeto: Record<string, unknown>,
): Promise<string | null> {
  const daAssinatura = sub.metadata?.organization_id;
  if (ehUuid(daAssinatura)) return daAssinatura;

  const daSessao = objeto.client_reference_id;
  if (typeof daSessao === "string" && ehUuid(daSessao)) return daSessao;

  // Retaguarda: o customer já está amarrado a uma organização de uma
  // assinatura anterior. Cobre o caso do cliente que cancelou e reassinou pelo
  // portal do Stripe, onde não passamos metadata nenhum.
  const customer = typeof sub.customer === "string" ? sub.customer : null;
  if (!customer) return null;
  const { data } = await admin
    .from("org_subscriptions")
    .select("organization_id")
    .eq("stripe_customer_id", customer)
    .maybeSingle();
  return (data as { organization_id?: string } | null)?.organization_id ?? null;
}

function ehUuid(v: unknown): v is string {
  return (
    typeof v === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)
  );
}
