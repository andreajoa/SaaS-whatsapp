import { redirect } from "next/navigation";

import { requireAuth, resolveActiveOrg } from "@/lib/auth/server";
import { ROLE_RANK } from "@/lib/auth/types";
import { emailDeSuporte } from "@/lib/branding/saida";
import { Card } from "@/components/ui/card";
import { tagDeIdioma } from "@/lib/i18n/datas";
import { traduzir } from "@/lib/i18n/dicionario";
import { PlanosDaConta } from "@/components/billing/PlanosDaConta";
import { estadoDaCobranca } from "@/lib/billing/assinatura";
import {
  DIAS_DE_TRIAL,
  ORDEM_DOS_PLANOS,
  instalacaoCobra,
  precoDoPlano,
  type PlanoId,
} from "@/lib/billing/planos";
import { mercadoDaOrganizacao } from "@/lib/mercado/organizacao";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/** `cs_...` e nada mais: o valor vem da URL e é repassado a uma chamada nossa. */
const FORMATO_DE_SESSAO = /^cs_[A-Za-z0-9_]{10,255}$/;

/**
 * A tela de dinheiro.
 *
 * Ela tem DUAS caras, e a diferença não é cosmética: numa instalação self-host
 * (`instalacaoCobra() === false`) não existe plano, não existe Stripe e não
 * existe nada para vender — a tela continua sendo a de antes, porque quem
 * clonou este repo não comprou um SaaS. Só o SaaS hospedado, que tem
 * `STRIPE_SECRET_KEY`, vê o catálogo e o checkout.
 *
 * O contato mostrado é sempre o de quem OPERA a instalação (`SUPPORT_EMAIL`) —
 * a tela de dinheiro entregava o nosso endereço ao cliente do revendedor.
 */
export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // spec 13 §4: billing é admin-only (viewer/agent/manager = none).
  const user = await requireAuth();
  const activeOrg = await resolveActiveOrg(user);
  if (!activeOrg || ROLE_RANK[activeOrg.role] < ROLE_RANK.admin) {
    redirect("/403");
  }
  const suporte = emailDeSuporte();
  const idioma = user.idioma;

  if (!instalacaoCobra()) {
    return (
      <div className="flex h-full flex-col gap-6 p-6">
        <Cabecalho idioma={idioma} />
        <Card className="max-w-xl p-6">
          <h2 className="text-sm font-semibold">
            {traduzir("Esta instalação não cobra assinatura", idioma)}
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {traduzir(
              "Este sistema roda no seu próprio servidor e não tem mensalidade.",
              idioma,
            )}{" "}
            {suporte ? (
              <>
                {traduzir("Para questões de pagamento, contate", idioma)}{" "}
                <a className="underline" href={`mailto:${suporte}`}>
                  {suporte}
                </a>
                .
              </>
            ) : (
              <>
                {traduzir(
                  "Para questões de pagamento, fale com quem administra este sistema.",
                  idioma,
                )}
              </>
            )}
          </p>
        </Card>
      </div>
    );
  }

  const admin = createAdminClient();
  const { data: org } = await admin
    .from("organizations")
    .select("created_at, settings")
    .eq("id", activeOrg.orgId)
    .maybeSingle();

  const estado = await estadoDaCobranca(admin, activeOrg.orgId, org?.created_at ?? null);

  // Moeda e preço saem do mercado que a ORGANIZAÇÃO declarou no cadastro, não
  // do IP de agora — ver o cabeçalho de `lib/mercado/organizacao.ts`. Org sem
  // mercado gravado (toda org criada antes desta linha existir) cai no padrão,
  // que é exatamente o que ela sempre viu.
  const mercado = mercadoDaOrganizacao(org?.settings);

  // Só oferece o que esta instalação de fato vende — plano sem `price_...`
  // configurado não é erro, é plano que não existe aqui.
  const vendidos: PlanoId[] = ORDEM_DOS_PLANOS.filter((p) => precoDoPlano(p) !== null);

  const params = await searchParams;
  const bruto = params.sessao;
  const sessao = typeof bruto === "string" && FORMATO_DE_SESSAO.test(bruto) ? bruto : null;

  return (
    <div className="flex h-full flex-col gap-6 overflow-y-auto p-6">
      <Cabecalho idioma={idioma} />

      {/*
        O PRIMEIRO CARTÃO QUE UM CLIENTE NOVO VÊ.
        Ele chega aqui ao terminar o onboarding, com o agente já configurado —
        o gate de `app/app/layout.tsx` o manda para cá justamente neste ponto.
        Por isso o texto fala do que ele GANHA, e não do que vai pagar.
        E diz, na mesma frase, que há cartão e que a cobrança começa sozinha no
        sétimo dia. Guardar isso só para os documentos legais seria a letra
        miúda que este produto existe para não ter.
      */}
      {estado.acesso === "sem_cartao" ? (
        <Card className="border-accent/40 bg-accent/5 p-5">
          <h2 className="text-sm font-semibold">
            {`${traduzir("Comece seus", idioma)} ${DIAS_DE_TRIAL} ${traduzir("dias sem cobrança", idioma)}`}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {`${traduzir("Escolha um plano e o seu atendente entra no ar agora. Pedimos o cartão para começar, e nada é cobrado nos primeiros", idioma)} ${DIAS_DE_TRIAL} ${traduzir("dias — a assinatura só começa depois disso, e você cancela em um clique quando quiser.", idioma)}`}
          </p>
        </Card>
      ) : null}

      {estado.acesso === "trial" ? (
        <Card className="border-accent/40 bg-accent/5 p-5">
          <h2 className="text-sm font-semibold">
            {estado.diasRestantes === 0
              ? traduzir("Hoje é o último dia sem cobrança", idioma)
              : estado.diasRestantes === 1
                ? traduzir("Falta 1 dia sem cobrança", idioma)
                : `${traduzir("Faltam", idioma)} ${estado.diasRestantes} ${traduzir("dias sem cobrança", idioma)}`}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {/*
              Nada de "escolha um plano antes do fim para não interromper os
              atendimentos": o plano já foi escolhido e o cartão já está lá. A
              frase antiga assustava sem motivo e escondia o que de fato vai
              acontecer — que a cobrança começa sozinha.
            */}
            {traduzir(
              "Tudo liberado. Quando o período terminar, a assinatura começa automaticamente no cartão cadastrado. Você pode cancelar antes disso, em um clique, sem falar com ninguém.",
              idioma,
            )}
          </p>
        </Card>
      ) : null}

      {estado.acesso === "vencido" ? (
        <Card className="border-destructive/40 bg-destructive/5 p-5">
          <h2 className="text-sm font-semibold">
            {estado.jaAssinou
              ? traduzir("Sua assinatura está parada", idioma)
              : traduzir("Seu período de avaliação acabou", idioma)}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {estado.jaAssinou
              ? traduzir(
                  "O último pagamento não foi concluído. Regularize para voltar a atender.",
                  idioma,
                )
              : traduzir("Escolha um plano para continuar atendendo pelo WhatsApp.", idioma)}
          </p>
        </Card>
      ) : null}

      {estado.acesso === "em_dia" && estado.cancelaNoFimDoCiclo && estado.expiraEm ? (
        <Card className="border-destructive/40 bg-destructive/5 p-5">
          <h2 className="text-sm font-semibold">{traduzir("Assinatura cancelada", idioma)}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {traduzir("O acesso continua até", idioma)}{" "}
            {/* A data acompanha quem está lendo (lib/i18n/datas.ts): uma tela em
                espanhol com "20 de setembro" parece bug, não decisão. */}
            {estado.expiraEm.toLocaleDateString(tagDeIdioma(idioma), {
              day: "2-digit",
              month: "long",
              year: "numeric",
            })}
            {traduzir(". Você pode reativar no portal de cobrança.", idioma)}
          </p>
        </Card>
      ) : null}

      <PlanosDaConta
        planoAtual={estado.plano}
        planosVendidos={vendidos}
        mercado={mercado}
        temAssinatura={Boolean(estado.stripeCustomerId)}
        sessaoDeRetorno={sessao}
      />
    </div>
  );
}

function Cabecalho({ idioma }: { idioma: Parameters<typeof traduzir>[1] }) {
  return (
    <header>
      <h1 className="text-2xl font-semibold tracking-tight">
        {traduzir("Plano e cobrança", idioma)}
      </h1>
      <p className="text-sm text-muted-foreground">
        {traduzir("Planos, faturas e cobrança.", idioma)}
      </p>
    </header>
  );
}
