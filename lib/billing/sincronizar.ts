/**
 * Traduz UMA assinatura do Stripe para a linha de `org_subscriptions`.
 *
 * Vive fora do webhook porque dois caminhos escrevem a mesma linha e precisam
 * escrever IGUAL: o webhook (a fonte da verdade, que cobre renovação,
 * cancelamento e falha de cartão) e o retorno do checkout embutido (que
 * adianta o mesmo estado para a pessoa não ficar olhando um spinner esperando
 * o webhook chegar). Duas cópias divergiriam no dia em que o Stripe mudasse
 * um campo de lugar — e um dos dois lados passaria a gravar `essencial` para
 * quem pagou `ilimitado`.
 *
 * Escrever duas vezes é seguro de propósito: `gravarAssinatura` é `upsert` por
 * `organization_id`, então o webhook chegando depois do retorno (ou antes) dá
 * o mesmo resultado.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import { gravarAssinatura } from "@/lib/billing/assinatura";
import { ehPlanoConhecido, planoDoPreco, type PlanoId, type StatusAssinatura } from "@/lib/billing/planos";
import type { StripeSubscription } from "@/lib/billing/stripe";

export function comoData(epoch: number | null | undefined): Date | null {
  return typeof epoch === "number" && Number.isFinite(epoch) ? new Date(epoch * 1000) : null;
}

/** O fim do ciclo mudou de lugar na API 2025-08-27 — ver o tipo em stripe.ts. */
export function fimDoCiclo(sub: StripeSubscription): Date | null {
  const doItem = sub.items?.data?.[0]?.current_period_end;
  return comoData(doItem ?? sub.current_period_end ?? null);
}

/**
 * De `price_...` para o plano. Quando o preço não é nenhum dos configurados
 * (o operador trocou o preço no Stripe, ou a assinatura veio de um preço
 * antigo), mantém o plano que já estava gravado — e só cai em `essencial` se
 * não houver nada. Errar para o MENOR plano é a direção certa: o oposto daria
 * `ilimitado` de graça a quem pagou o básico.
 */
export async function resolverPlano(
  admin: SupabaseClient,
  organizationId: string,
  priceId: string | null,
): Promise<PlanoId> {
  if (priceId) {
    const doPreco = planoDoPreco(priceId);
    if (doPreco) return doPreco;
  }
  const { data } = await admin
    .from("org_subscriptions")
    .select("plan")
    .eq("organization_id", organizationId)
    .maybeSingle();
  const atual = (data as { plan?: string } | null)?.plan;
  return atual && ehPlanoConhecido(atual) ? atual : "essencial";
}

export interface Sincronizado {
  plano: PlanoId;
  status: StatusAssinatura;
}

/** Grava a assinatura. Lança quando o banco recusa — quem chama decide o que fazer. */
export async function sincronizarAssinatura(
  admin: SupabaseClient,
  organizationId: string,
  sub: StripeSubscription,
): Promise<Sincronizado> {
  const priceId = sub.items?.data?.[0]?.price?.id ?? null;
  const plano = await resolverPlano(admin, organizationId, priceId);
  const status = (sub.status ?? "incomplete") as StatusAssinatura;

  const { error } = await gravarAssinatura(admin, {
    organizationId,
    plano,
    status,
    stripeCustomerId: typeof sub.customer === "string" ? sub.customer : null,
    stripeSubscriptionId: sub.id,
    stripePriceId: priceId,
    currentPeriodEnd: fimDoCiclo(sub),
    cancelAtPeriodEnd: Boolean(sub.cancel_at_period_end),
    canceledAt: comoData(sub.canceled_at),
  });
  if (error) throw new Error(`org_subscriptions upsert: ${error}`);

  return { plano, status };
}
