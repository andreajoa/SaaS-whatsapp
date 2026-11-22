import Link from "next/link";
import { mercadoDoPais, moedasCobraveis, precoLegivelNoMercado } from "@/lib/mercado/paises";
import { DIAS_DE_TRIAL, ORDEM_DOS_PLANOS, PLANOS, precoResolvidoDoPlano } from "@/lib/billing/planos";
import type { Metadata } from "next";

const NAMES = { essencial: "Essential", pro: "Professional", ilimitado: "Unlimited" } as const;
const HIGHLIGHTS = {
  essencial: [
    "1 WhatsApp number",
    "Up to 3 team members",
    "AI agent trained on your knowledge base",
    "Full sales pipeline, contacts & history",
  ],
  pro: [
    "Up to 3 WhatsApp numbers",
    "Up to 10 team members",
    "Automated follow-ups & campaigns",
    "Performance reports & team goals",
  ],
  ilimitado: [
    "Unlimited WhatsApp numbers",
    "Unlimited team members",
    "API, webhooks & MCP included",
    "Priority support",
  ],
} as const;

export function pricingMetadata(country: "GB" | "US"): Metadata {
  return {
    // `absolute` evita duplicar `· Atenza` do template em `app/layout.tsx`.
    title: { absolute: `WhatsApp CRM pricing (${country}) | Atenza` },
    description:
      "Compare Atenza subscription plans, 7-day free trial terms, and transparent pricing for WhatsApp AI customer support and CRM.",
    robots: { index: true, follow: true },
    alternates: { canonical: country === "GB" ? "/en-gb/pricing" : "/en-us/pricing" },
  };
}

export function EnglishPricing({ country }: { country: "GB" | "US" }) {
  const market = mercadoDoPais(country);
  const brMarket = mercadoDoPais("BR");
  const href = country === "GB" ? "/en-gb" : "/en-us";
  const cobravelNaMoedaLocal = moedasCobraveis().has(market.moeda);
  const available = ORDEM_DOS_PLANOS.filter((plan) => Boolean(precoResolvidoDoPlano(plan, market.moeda)));

  return (
    <main className="mx-auto max-w-5xl px-5 py-14 text-gray-1000">
      <p className="mb-3 text-sm font-medium text-muted-foreground">
        Atenza · {country === "GB" ? "United Kingdom" : "United States"}
      </p>
      <h1 className="mb-4 text-4xl font-bold tracking-tight">Plans and pricing</h1>
      <p className="mb-9 max-w-3xl text-base leading-7 text-muted-foreground">
        Shared WhatsApp inbox, AI-assisted conversations, and CRM. Start with a {DIAS_DE_TRIAL}-day
        free trial — card required up front, cancel in one click anytime before day {DIAS_DE_TRIAL}.
      </p>
      <div className="grid gap-6 sm:grid-cols-3">
        {available.map((plan) => {
          const resolvido = precoResolvidoDoPlano(plan, market.moeda);
          const cobradoEmBrl = resolvido?.moedaCobrada === "BRL" && market.moeda !== "BRL";
          const mercadoExibido = cobradoEmBrl && !cobravelNaMoedaLocal ? brMarket : market;
          const isPopular = plan === "pro";
          return (
            <article
              key={plan}
              className={`relative flex flex-col rounded-xl border p-6 ${isPopular ? "border-foreground shadow-md" : ""}`}
            >
              {isPopular ? (
                <span className="mb-3 inline-block w-fit rounded-full bg-foreground px-3 py-0.5 text-xs font-semibold text-background">
                  Most popular
                </span>
              ) : null}
              <h2 className="mb-2 text-xl font-semibold">{NAMES[plan]}</h2>
              <p className="text-3xl font-bold tracking-tight">
                {precoLegivelNoMercado(plan, mercadoExibido)}{" "}
                <span className="text-sm font-normal text-muted-foreground">/ month</span>
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                {cobradoEmBrl
                  ? `Billed in BRL (${precoLegivelNoMercado(plan, brMarket)}/mo) via Stripe. Final amount in your card currency shown at checkout.`
                  : `Billed in ${mercadoExibido.moeda} via Stripe. ${DIAS_DE_TRIAL} days free, renews monthly.`}
              </p>
              <ul className="mt-5 flex-1 space-y-2 text-sm text-muted-foreground">
                {HIGHLIGHTS[plan].map((item) => (
                  <li key={item} className="flex items-start gap-2">
                    <span aria-hidden className="font-bold text-foreground">
                      ✓
                    </span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              <Link
                href="/signup"
                className="mt-6 inline-block w-full rounded-lg bg-gray-950 px-5 py-3 text-center text-sm font-medium text-white transition-opacity hover:opacity-90"
              >
                Start {DIAS_DE_TRIAL}-day free trial
              </Link>
              <span className="sr-only">{PLANOS[plan].nome}</span>
            </article>
          );
        })}
      </div>
      <p className="mt-8 max-w-4xl text-sm leading-6 text-muted-foreground">
        External WhatsApp/Meta messaging fees and your AI provider&apos;s usage charges apply
        separately at provider rates with zero markup. Check the trial and renewal terms before
        subscribing.
      </p>
      <div className="mt-8 flex gap-6 text-sm">
        <Link className="underline underline-offset-4" href={href}>
          Back to Atenza
        </Link>
        <Link className="underline underline-offset-4" href="/login">
          Sign in
        </Link>
      </div>
    </main>
  );
}
