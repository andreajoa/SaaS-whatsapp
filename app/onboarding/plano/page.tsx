import { redirect } from "next/navigation";

import { patchOnboardingState } from "@/app/actions/onboarding/_shared";
import { PlanosDaConta } from "@/components/billing/PlanosDaConta";
import { requireAuth, resolveActiveOrg } from "@/lib/auth/server";
import { estadoDaCobranca } from "@/lib/billing/assinatura";
import { DIAS_DE_TRIAL, ORDEM_DOS_PLANOS, instalacaoCobra, precoDoPlano, type PlanoId } from "@/lib/billing/planos";
import { traduzir } from "@/lib/i18n/dicionario";
import { mercadoDaOrganizacao } from "@/lib/mercado/organizacao";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/**
 * "Plano" — o cartão entra aqui, antes do telefone.
 *
 * Decisão do dono (27/10/2026): cartão antes de usar. A pessoa já treinou e viu
 * a IA responder no ensaio, então sabe o que está comprando; o Stripe dá
 * `DIAS_DE_TRIAL` dias sem cobrança e cobra sozinho no fim.
 *
 * O passo se cumpre SOZINHO quando a cobrança diz que há acesso: é o mesmo
 * `estadoDaCobranca` que o layout do app e as rotas de conexão consultam, e não
 * um clique da tela — `PlanosDaConta` recarrega a página quando o pagamento
 * fecha, e esta página vê a assinatura e segue para o próximo passo. Assim o
 * passo não pode ficar "cumprido" sem cartão, nem preso depois de pago.
 *
 * Boleto/Pix voltam do Stripe para a tela de Cobrança (o `returnUrl` do
 * checkout); durante o onboarding o layout do app os traz de volta para cá, e
 * o webhook do Stripe já terá gravado a assinatura.
 */
export default async function PlanoPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireAuth();
  const activeOrg = await resolveActiveOrg(user);
  if (!activeOrg) redirect("/get-started");
  const idioma = user.idioma;

  const admin = createAdminClient();
  const { data: org } = await admin
    .from("organizations")
    .select("created_at, settings")
    .eq("id", activeOrg.orgId)
    .maybeSingle();

  const estado = await estadoDaCobranca(admin, activeOrg.orgId, org?.created_at ?? null);
  if (!instalacaoCobra() || estado.acesso === "trial" || estado.acesso === "em_dia" || estado.acesso === "nao_cobra") {
    await patchOnboardingState(activeOrg.orgId, {
      plano: { acesso: estado.acesso, em: new Date().toISOString() },
    });
    redirect("/onboarding");
  }

  const mercado = mercadoDaOrganizacao(org?.settings);
  const vendidos: PlanoId[] = ORDEM_DOS_PLANOS.filter((p) => precoDoPlano(p) !== null);
  const bruto = (await searchParams).sessao;
  const sessao = typeof bruto === "string" && bruto.startsWith("cs_") ? bruto : null;

  return (
    <div className="space-y-6">
      <header>
        <h2 className="text-2xl font-semibold tracking-tight">
          {`${traduzir("Escolha seu plano:", idioma)} ${DIAS_DE_TRIAL} ${traduzir("dias grátis", idioma)}`}
        </h2>
        <p className="text-sm text-muted-foreground">
          {`${traduzir("O cartão é cadastrado agora e nada é cobrado nos primeiros", idioma)} ${DIAS_DE_TRIAL} ${traduzir("dias. A cobrança começa sozinha depois disso, e você cancela em um clique quando quiser.", idioma)}`}
        </p>
      </header>
      <PlanosDaConta
        planoAtual={estado.plano}
        planosVendidos={vendidos}
        mercado={mercado}
        temAssinatura={Boolean(estado.stripeCustomerId)}
        sessaoDeRetorno={sessao}
        destinoAoConcluir="/onboarding/plano"
      />
    </div>
  );
}
