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

  if (!stripePromise) {
    return (
      <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
        {t("O pagamento não está disponível: falta a chave publicável do Stripe nesta instalação.")}
      </div>
    );
  }

  return (
    <div className="min-h-[420px]">
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
  );
}
