/**
 * POST /api/v1/billing/checkout — abre a sessão de pagamento EMBUTIDA.
 *
 * Devolve um `clientSecret`, não uma URL: o formulário monta dentro da nossa
 * tela (`components/billing/CheckoutEmbutido.tsx`). O cartão continua NUNCA
 * passando por este servidor — o iframe é do Stripe, então o escopo de PCI
 * daqui segue zero e um XSS nesta aplicação não alcança dado de pagamento.
 *
 * O `clientSecret` não é um segredo do nosso lado: ele autoriza pagar UMA
 * sessão específica, já amarrada a um preço e a uma organização que o servidor
 * escolheu. Quem o tem não consegue mudar nem o valor nem o plano.
 *
 * O plano vem do body e o preço NÃO — o `price_...` é resolvido do env pelo
 * servidor (`precoDoPlano`). Aceitar o preço do cliente deixaria qualquer um
 * assinar o plano `ilimitado` pelo `price` do `essencial` com um curl.
 */
import { randomUUID } from "node:crypto";
import type { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { fail, ok } from "@/lib/api/wrappers";
import { audit } from "@/lib/audit";
import { requireRole } from "@/lib/auth/require-role";
import { estadoDaCobranca } from "@/lib/billing/assinatura";
import { DIAS_DE_TRIAL, instalacaoCobra, precoDoPlano } from "@/lib/billing/planos";
import { criarCheckoutSession, StripeError } from "@/lib/billing/stripe";
import { env } from "@/lib/env";
import type { Idioma } from "@/lib/i18n/idiomas";
import { requireSupportWrite } from "@/lib/impersonate/support";
import { registrarTentativa } from "@/lib/marketing/funil";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const corpoSchema = z.object({
  plano: z.enum(["essencial", "pro", "ilimitado"]),
});

/**
 * O idioma da interface traduzido para o vocabulário do Stripe.
 *
 * É um mapa, e não o código repassado direto, pelo mesmo motivo do
 * `LOCALE_DE_DATA` em `lib/i18n/datas.ts`: os dois vocabulários coincidem hoje
 * por acaso, não por contrato. Um idioma novo no produto passa a dar erro de
 * compilação aqui e obriga quem o acrescentou a decidir o que o Stripe mostra
 * — em vez de mandar uma tag que o Stripe não conhece e ver o formulário
 * voltar calado para o inglês.
 */
const LOCALE_DO_STRIPE: Record<Idioma, string> = {
  "pt-BR": "pt-BR",
  es: "es",
};

function baseUrl(req: NextRequest): string {
  const configurada = env.NEXT_PUBLIC_APP_URL;
  const usavel = configurada && !configurada.includes("placeholder.invalid") ? configurada : null;
  return usavel ?? req.headers.get("origin") ?? `${req.nextUrl.protocol}//${req.nextUrl.host}`;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  // Sessão de suporte é SÓ LEITURA por padrão: quem acompanha um cliente não
  // assina no nome dele.
  const supportDenied = await requireSupportWrite();
  if (supportDenied) return supportDenied;

  const requestId = randomUUID();

  if (!instalacaoCobra()) {
    return fail("not_found", "Esta instalação não cobra assinatura.", 404, { requestId });
  }

  const authz = await requireRole("admin", { requestId, resource: "billing" });
  if (!authz.ok) return authz.response;
  const orgId = authz.org.orgId;

  const parsed = corpoSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return fail("invalid_request", "plano inválido.", 422, { requestId });
  }
  const plano = parsed.data.plano;

  const priceId = precoDoPlano(plano);
  if (!priceId) {
    return fail("invalid_request", `O plano ${plano} não está configurado nesta instalação.`, 422, {
      requestId,
    });
  }

  const admin = createAdminClient();

  const { data: org } = await admin
    .from("organizations")
    .select("created_at")
    .eq("id", orgId)
    .maybeSingle();

  const estado = await estadoDaCobranca(admin, orgId, org?.created_at ?? null);

  // Quem já pagou não abre checkout novo — trocar de plano é no PORTAL, que
  // faz o rateio do que já foi pago. Um segundo checkout criaria uma SEGUNDA
  // assinatura no mesmo customer, e o cliente seria cobrado duas vezes.
  //
  // `trial` ENTRA nesta guarda, e a inclusão não é zelo: desde que `trialing`
  // deixou de ser reportado como `em_dia` (ver `assinatura.ts`), checar só
  // `em_dia` deixaria quem está nos sete dias abrir um segundo checkout e
  // terminar com duas assinaturas no mesmo customer — cobrança em dobro a
  // partir do sétimo dia, sem que nada reclamasse.
  if (estado.acesso === "em_dia" || estado.acesso === "trial") {
    return fail(
      "conflict",
      "Já existe uma assinatura ativa. Use 'Gerenciar assinatura' para trocar de plano.",
      409,
      { requestId },
    );
  }

  // ─── O trial mora AQUI desde 2026-09-24 ───────────────────────────────────
  //
  // Antes era derivado de `organizations.created_at` e este campo ia `null`,
  // com o comentário de que somar um segundo trial daria dias de graça a cada
  // abertura do checkout. Esse risco não existe mais, e a razão é do Stripe:
  // `trial_period_days` vale para a assinatura que NASCE nesta sessão, e o
  // passo acima já recusa com 409 quem tem assinatura ativa. Não há como
  // acumular — quem já assinou não chega a esta linha.
  //
  // `jaAssinou` é o que separa o primeiro teste de uma volta: quem cancelou e
  // está voltando não ganha outros sete dias. O trial é boas-vindas, não um
  // desconto recorrente para quem aprendeu a cancelar antes da cobrança.
  const trialDias = estado.jaAssinou ? null : DIAS_DE_TRIAL;

  const base = baseUrl(req);

  let clientSecret: string | null;
  let sessionId: string;
  try {
    const sessao = await criarCheckoutSession({
      priceId,
      organizationId: orgId,
      email: authz.user.email,
      customerId: estado.stripeCustomerId,
      // `{CHECKOUT_SESSION_ID}` é substituído pelo Stripe. Só é usado por meio
      // de pagamento que redireciona (boleto/Pix) — cartão fecha sem sair da
      // tela. Ver `redirect_on_completion` em lib/billing/stripe.ts.
      returnUrl: `${base}/app/settings/billing?sessao={CHECKOUT_SESSION_ID}`,
      trialDias,
      locale: LOCALE_DO_STRIPE[authz.user.idioma],
      // Estável por (org, plano, MINUTO): um duplo-clique reaproveita a MESMA
      // sessão do Stripe em vez de abrir duas. Não usa o requestId, que é novo
      // a cada chamada e portanto nunca deduplicaria nada.
      //
      // Por que minuto e não hora: o Stripe guarda por 24h a resposta da
      // chave **inclusive quando ela foi erro**. Com janela de uma hora, um
      // parâmetro inválido — corrigido e reimplantado — continuaria devolvendo
      // o erro velho até a hora virar. Foi o que aconteceu com
      // `customer_creation`, medido em produção. Uma sessão de checkout aberta
      // e não usada não cobra nada e expira sozinha, então o custo de abrir
      // duas é zero; o de repetir um erro já consertado é a venda.
      idempotencyKey: `checkout:${orgId}:${plano}:${new Date().toISOString().slice(0, 16)}`,
    });
    clientSecret = sessao.client_secret;
    sessionId = sessao.id;
  } catch (e) {
    const erro = e instanceof StripeError ? e : null;
    return fail(
      "internal_error",
      erro?.message ?? "Não foi possível abrir o pagamento agora.",
      502,
      { requestId },
    );
  }

  if (!clientSecret) {
    return fail("internal_error", "O Stripe não devolveu a sessão de pagamento.", 502, {
      requestId,
    });
  }

  void audit({
    action: "billing.checkout_started",
    actorUserId: authz.user.id,
    organizationId: orgId,
    resourceType: "org_subscriptions",
    resourceId: orgId,
    requestId,
    metadata: { plano, sessao: sessionId },
  });

  // A anotação do funil. Sem ela não existe "carrinho largado": uma sessão que
  // a pessoa abandona não produz evento nenhum no Stripe — expira calada 24 h
  // depois —, então quem não anotou a ABERTURA não tem como saber que houve
  // uma. Solta e sem `await` pelo mesmo motivo do audit: anotar não pode
  // atrasar nem derrubar a tela de pagamento.
  void registrarTentativa({
    sessionId,
    organizationId: orgId,
    email: authz.user.email,
    plano,
  }).catch(() => {});

  return ok({ clientSecret, sessionId }, { requestId });
}
