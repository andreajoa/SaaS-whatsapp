"use client";

/**
 * O formulário de pagamento do Stripe montado DENTRO da nossa tela.
 *
 * ─── O que este arquivo é, e o que ele não é ───────────────────────────────
 *
 * Ele é uma moldura. O conteúdo é um iframe do Stripe: o número do cartão
 * nunca entra no nosso DOM, nunca passa pelo nosso servidor e não é alcançável
 * por um XSS nesta aplicação. É a mesma garantia do checkout hospedado, sem
 * jogar a pessoa em outro domínio no meio de uma compra.
 *
 * ─── `loadStripe` fora do componente, e por quê ────────────────────────────
 *
 * `loadStripe` injeta a tag <script> do Stripe.js na página. Chamá-la dentro
 * do corpo do componente a re-executa a cada render — o pacote deduplica, mas
 * a promessa passa a ter identidade nova a cada vez, e o `EmbeddedCheckout`
 * não aceita que o `stripe` mude depois de montado. No escopo do módulo ela
 * roda UMA vez por carregamento de página.
 *
 * A chave é lida de `process.env.NEXT_PUBLIC_...` literal, e não via
 * `lib/env.ts`: o Next só substitui a expressão quando ela aparece escrita por
 * inteiro no código do cliente. Indireção aqui vira `undefined` no browser.
 */

import { EmbeddedCheckout, EmbeddedCheckoutProvider } from "@stripe/react-stripe-js";
import { loadStripe, type Stripe } from "@stripe/stripe-js";
import { Lock } from "lucide-react";
import { useEffect, useState } from "react";

import { useT } from "@/lib/i18n/IdiomaProvider";

const PK = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? "";

/**
 * `null` quando a instalação não configurou a chave. O provider aceita `null`
 * e simplesmente não monta — melhor que um throw que derruba a tela inteira
 * por causa de uma variável de ambiente esquecida.
 */
const stripePromise: Promise<Stripe | null> | null = PK ? loadStripe(PK) : null;

export function chavePublicavelAusente(): boolean {
  return PK.length === 0;
}

interface Props {
  /** Vem de POST /api/v1/billing/checkout. Autoriza pagar UMA sessão. */
  clientSecret: string;
  /**
   * Cartão aprovado sem sair da tela. NÃO é a confirmação de que o acesso foi
   * liberado — quem grava é o webhook (e, adiantando, a rota de status). Quem
   * chama deve conferir no servidor antes de dizer que está pago.
   */
  onConcluido: () => void;
}

export function CheckoutEmbutido({ clientSecret, onConcluido }: Props) {
  const t = useT();
  const [pronto, setPronto] = useState(false);

  useEffect(() => {
    if (!stripePromise) return;
    let vivo = true;
    // `.then` e não `await`: o efeito não pode ser async, e o `vivo` evita
    // escrever estado depois de a pessoa ter saído da tela — o carregamento do
    // Stripe.js é longo o bastante para isso acontecer de verdade.
    //
    // `.catch` para o lado de MOSTRAR: se o script do Stripe não carregar, o
    // esqueleto pulsando para sempre é a pior saída possível — some o
    // formulário E some qualquer erro que explicasse o sumiço. Mostrando, o
    // provider monta e é ELE quem exibe a própria falha.
    void stripePromise
      .then(() => {
        if (vivo) setPronto(true);
      })
      .catch(() => {
        if (vivo) setPronto(true);
      });
    return () => {
      vivo = false;
    };
  }, []);

  if (!stripePromise) {
    return (
      <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
        {t("O pagamento não está disponível: falta a chave publicável do Stripe nesta instalação.")}
      </div>
    );
  }

  return (
    <div className="min-h-[420px]">
      {/*
        O ESQUELETO, e por que ele existe.

        O Stripe.js é um script de terceiro: entre o clique no plano e o
        formulário aparecer há um vão que, em 4G, passa de dois segundos. Sem
        nada ali a tela fica em branco no exato instante em que a pessoa
        decidiu pagar — e tela branca na hora do cartão lê como "quebrou", não
        como "está carregando". O abandono nesse ponto é o mais caro do
        produto inteiro: já houve cadastro, onboarding e escolha de plano.

        O sinal é REAL, não um relógio: `pronto` vira true quando a promessa do
        `loadStripe` resolve, que é o momento em que o iframe passa a poder
        montar. Um `setTimeout` chutado erraria nos dois sentidos — sumiria
        cedo numa rede lenta e ficaria sobrando numa rápida.
      */}
      {!pronto ? <EsqueletoDoFormulario /> : null}

      <div className={pronto ? undefined : "sr-only"}>
        <EmbeddedCheckoutProvider
          stripe={stripePromise}
          // `key` força uma remontagem limpa quando a pessoa troca de plano: o
          // provider IGNORA mudança de `clientSecret` depois de montado, e sem
          // isto ela pagaria o plano anterior com a tela mostrando o novo.
          key={clientSecret}
          options={{ clientSecret, onComplete: onConcluido }}
        >
          <EmbeddedCheckout />
        </EmbeddedCheckoutProvider>
      </div>

      {/*
        A linha de confiança fica ABAIXO do formulário, e não acima: acima ela
        competiria com o campo do cartão pela atenção; abaixo ela responde à
        dúvida no instante em que a dúvida nasce, que é com o número digitado e
        o dedo sobre o botão.
      */}
      <p className="mt-4 flex items-center justify-center gap-2 text-xs text-muted-foreground">
        <Lock aria-hidden className="size-3.5" />
        {t("Pagamento processado pelo Stripe. Os dados do cartão não passam por nós.")}
      </p>
    </div>
  );
}

/**
 * O contorno do formulário que vai chegar — não um spinner.
 *
 * Um spinner diz "espere" e não diz mais nada. Um esqueleto com a FORMA do
 * que vem (um campo largo, dois curtos, um botão) faz a chegada do formulário
 * parecer continuação em vez de troca de tela, e é o que reduz a sensação de
 * espera sem reduzir a espera.
 *
 * `aria-hidden` porque não há informação aqui: quem usa leitor de tela ouve o
 * formulário de verdade quando ele monta, e ouvir uma descrição de caixas
 * cinzas antes disso é ruído.
 */
function EsqueletoDoFormulario() {
  return (
    <div aria-hidden className="animate-pulse space-y-4 rounded-lg border border-border p-6">
      <div className="h-4 w-32 rounded-md bg-surface-elevated" />
      <div className="h-11 w-full rounded-md bg-surface-elevated" />
      <div className="flex gap-3">
        <div className="h-11 flex-1 rounded-md bg-surface-elevated" />
        <div className="h-11 flex-1 rounded-md bg-surface-elevated" />
      </div>
      <div className="h-11 w-full rounded-md bg-surface-elevated" />
      <div className="h-11 w-full rounded-md bg-accent/20" />
    </div>
  );
}
