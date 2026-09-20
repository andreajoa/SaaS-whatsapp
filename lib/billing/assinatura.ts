/**
 * O estado de cobrança de UMA organização, e a única função que decide se ela
 * ainda tem acesso.
 *
 * A decisão vive aqui, e não no layout nem na rota, porque ela é consultada de
 * três lugares com pesos diferentes (o gate de toda tela, a tela de billing, o
 * webhook) e duas cópias dela divergiriam — a versão que tranca e a versão que
 * mostra diriam coisas diferentes na mesma tarde.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  DIAS_DE_TRIAL,
  ehPlanoConhecido,
  instalacaoCobra,
  type PlanoId,
  type StatusAssinatura,
} from "@/lib/billing/planos";

const DIA_MS = 86_400_000;

/**
 * `"nao_cobra"` é um estado de PRIMEIRA CLASSE, não a ausência dos outros.
 *
 * O clone que roda numa VPS cai sempre aqui, e toda tela que lê este módulo
 * precisa saber a diferença entre "esta instalação não cobra" e "esta
 * organização está em dia". A segunda ofereceria botão de gerenciar assinatura
 * a quem não tem assinatura nenhuma.
 */
export type AcessoDeCobranca = "nao_cobra" | "trial" | "em_dia" | "vencido";

export interface EstadoDeCobranca {
  acesso: AcessoDeCobranca;
  plano: PlanoId | null;
  status: StatusAssinatura | null;
  /** Dias inteiros que ainda faltam (trial ou ciclo pago). `null` = não se aplica. */
  diasRestantes: number | null;
  /** Fim do trial ou do ciclo pago, o que estiver valendo. */
  expiraEm: Date | null;
  cancelaNoFimDoCiclo: boolean;
  stripeCustomerId: string | null;
  /** Já houve alguma assinatura? Distingue "nunca assinou" de "cancelou". */
  jaAssinou: boolean;
}

/**
 * Estados do Stripe que mantêm o acesso ligado.
 *
 * `past_due` ENTRA, e é a decisão que mais importa nesta lista: o Stripe
 * mantém a assinatura em `past_due` durante toda a régua de novas tentativas
 * (dias, configurável no dashboard dele) antes de desistir e mandar `unpaid`
 * ou `canceled`. Cortar no primeiro cartão recusado desliga o WhatsApp de uma
 * empresa inteira por causa de um cartão que venceu — e o cliente descobre
 * pelo cliente dele, não pela fatura. Quem corta de fato é `unpaid`/`canceled`,
 * que só chegam depois de o Stripe ter tentado e avisado.
 *
 * `paused` fica de FORA: pausa é um pedido explícito de parar de cobrar, e
 * cobrar acesso sem cobrar dinheiro é o pior dos dois mundos.
 */
const STATUS_COM_ACESSO: ReadonlySet<string> = new Set([
  "trialing",
  "active",
  "past_due",
]);

interface LinhaDeAssinatura {
  plan: string;
  status: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
}

function diasAte(quando: Date | null, agora: Date): number | null {
  if (!quando) return null;
  return Math.max(0, Math.ceil((quando.getTime() - agora.getTime()) / DIA_MS));
}

/**
 * Lê o estado de cobrança. NUNCA lança e NUNCA tranca por erro.
 *
 * O chamador principal é `app/app/layout.tsx`, que roda em toda tela: uma
 * exceção aqui é 500 no produto inteiro, e um "vencido" por falha de leitura
 * tranca clientes pagantes fora do sistema por causa de um soluço do banco.
 * Falha aberta é a escolha certa neste eixo — o pior caso é alguém usar um dia
 * a mais de graça.
 *
 * Recebe o client como parâmetro (admin, já escopado pelo chamador) em vez de
 * criá-lo: o layout já tem um de pé, e a org vem de fonte confiável lá.
 */
export async function estadoDaCobranca(
  admin: SupabaseClient,
  organizationId: string,
  orgCriadaEm: string | Date | null,
  agora: Date = new Date(),
): Promise<EstadoDeCobranca> {
  const vazio: EstadoDeCobranca = {
    acesso: "nao_cobra",
    plano: null,
    status: null,
    diasRestantes: null,
    expiraEm: null,
    cancelaNoFimDoCiclo: false,
    stripeCustomerId: null,
    jaAssinou: false,
  };

  if (!instalacaoCobra()) return vazio;

  let linha: LinhaDeAssinatura | null = null;
  try {
    const { data } = await admin
      .from("org_subscriptions")
      .select(
        "plan, status, stripe_customer_id, stripe_subscription_id, current_period_end, cancel_at_period_end",
      )
      .eq("organization_id", organizationId)
      .maybeSingle();
    linha = (data as LinhaDeAssinatura | null) ?? null;
  } catch {
    // Falha aberta — ver o cabeçalho.
    return { ...vazio, acesso: "em_dia" };
  }

  // ─── Sem linha: trial derivado da criação da organização ──────────────────
  //
  // Ver o cabeçalho da migration 0239 sobre por que a ausência de linha é o
  // trial, e não uma linha 'trialing' semeada no cadastro.
  if (!linha) {
    const nascimento = orgCriadaEm ? new Date(orgCriadaEm) : null;
    if (!nascimento || Number.isNaN(nascimento.getTime())) {
      // Não sei quando nasceu → não tranco. Mesmo princípio de falha aberta.
      return { ...vazio, acesso: "trial" };
    }
    const fim = new Date(nascimento.getTime() + DIAS_DE_TRIAL * DIA_MS);
    const acabou = fim.getTime() <= agora.getTime();
    return {
      ...vazio,
      acesso: acabou ? "vencido" : "trial",
      diasRestantes: acabou ? 0 : diasAte(fim, agora),
      expiraEm: fim,
    };
  }

  const fimDoCiclo = linha.current_period_end ? new Date(linha.current_period_end) : null;
  const plano = ehPlanoConhecido(linha.plan) ? linha.plan : null;
  const status = linha.status as StatusAssinatura;

  return {
    acesso: STATUS_COM_ACESSO.has(linha.status) ? "em_dia" : "vencido",
    plano,
    status,
    diasRestantes: diasAte(fimDoCiclo, agora),
    expiraEm: fimDoCiclo,
    cancelaNoFimDoCiclo: linha.cancel_at_period_end,
    stripeCustomerId: linha.stripe_customer_id,
    jaAssinou: true,
  };
}

/**
 * Grava (ou atualiza) a assinatura de uma organização a partir do que o Stripe
 * contou. Só o webhook e o retorno do checkout chamam isto.
 *
 * `upsert` por `organization_id`: é a PK da tabela, e o mesmo evento pode
 * chegar antes ou depois de a linha existir (a ordem de entrega de webhooks do
 * Stripe não é garantida — `customer.subscription.created` e
 * `checkout.session.completed` chegam em qualquer ordem).
 */
export async function gravarAssinatura(
  admin: SupabaseClient,
  dados: {
    organizationId: string;
    plano: PlanoId;
    status: StatusAssinatura;
    stripeCustomerId: string | null;
    stripeSubscriptionId: string | null;
    stripePriceId: string | null;
    currentPeriodEnd: Date | null;
    cancelAtPeriodEnd: boolean;
    canceledAt: Date | null;
  },
): Promise<{ error: string | null }> {
  const { error } = await admin.from("org_subscriptions").upsert(
    {
      organization_id: dados.organizationId,
      plan: dados.plano,
      status: dados.status,
      stripe_customer_id: dados.stripeCustomerId,
      stripe_subscription_id: dados.stripeSubscriptionId,
      stripe_price_id: dados.stripePriceId,
      current_period_end: dados.currentPeriodEnd?.toISOString() ?? null,
      cancel_at_period_end: dados.cancelAtPeriodEnd,
      canceled_at: dados.canceledAt?.toISOString() ?? null,
    },
    { onConflict: "organization_id" },
  );
  return { error: error?.message ?? null };
}
