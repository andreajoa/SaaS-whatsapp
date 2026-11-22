import Link from "next/link";
import { env } from "@/lib/env";
import {
  identidadePublica,
  jsonLdSeguro,
  schemaDoFaq,
} from "@/lib/marketing/seo";
import { schemaDoSoftware } from "@/lib/marketing/schema-do-produto";
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

const PRICING_FAQ = [
  {
    question: "How does the 7-day free trial work?",
    answer: `Every plan includes a ${DIAS_DE_TRIAL}-day free trial. You enter your card at Stripe checkout, nothing is charged before day ${DIAS_DE_TRIAL}, and you can cancel in one click anytime from your billing screen.`,
  },
  {
    question: "Is AI model usage included in the monthly price?",
    answer:
      "You connect your own API key (OpenAI, Anthropic Claude, Google Gemini, or OpenRouter) and pay the provider directly at their rates, with zero markup from Atenza.",
  },
  {
    question: "Will my business keep its current WhatsApp number?",
    answer:
      "Yes. You connect your existing business number via Meta's official WhatsApp Business API and keep using the same number.",
  },
  {
    question: "Can I upgrade, downgrade or cancel anytime?",
    answer:
      "Yes. There are no long-term contracts — change plans or cancel in one click directly in your Stripe billing portal.",
  },
] as const;

export function pricingMetadata(country: "GB" | "US"): Metadata {
  const base = env.NEXT_PUBLIC_APP_URL;
  const canonicalPath = country === "GB" ? "/en-gb/pricing" : "/en-us/pricing";
  const url = new URL(canonicalPath, base).toString();
  const image = new URL("/media/atenza/hero-office.webp", base).toString();
  const title = `WhatsApp CRM pricing (${country}) | Atenza`;
  const description =
    "Compare Atenza subscription plans, 7-day free trial terms, and transparent pricing for WhatsApp AI customer support and CRM.";
  return {
    // `absolute` evita duplicar `· Atenza` do template em `app/layout.tsx`.
    title: { absolute: title },
    description,
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        "max-snippet": -1,
        "max-image-preview": "large",
        "max-video-preview": -1,
      },
    },
    alternates: {
      canonical: url,
      languages: {
        "en-US": new URL("/en-us/pricing", base).toString(),
        "en-GB": new URL("/en-gb/pricing", base).toString(),
        "pt-BR": new URL("/precos", base).toString(),
        "x-default": new URL("/precos", base).toString(),
      },
    },
    openGraph: {
      type: "website",
      title,
      description,
      url,
      siteName: "Atenza",
      locale: country === "GB" ? "en_GB" : "en_US",
      images: [{ url: image, alt: title }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [image],
    },
  };
}

export function EnglishPricing({ country }: { country: "GB" | "US" }) {
  const base = env.NEXT_PUBLIC_APP_URL;
  const market = mercadoDoPais(country);
  const brMarket = mercadoDoPais("BR");
  const href = country === "GB" ? "/en-gb" : "/en-us";
  const canonicalPath = country === "GB" ? "/en-gb/pricing" : "/en-us/pricing";
  const cobravelNaMoedaLocal = moedasCobraveis().has(market.moeda);
  const available = ORDEM_DOS_PLANOS.filter((plan) =>
    Boolean(precoResolvidoDoPlano(plan, market.moeda)),
  );

  const schema = {
    "@context": "https://schema.org",
    "@graph": [
      ...identidadePublica("Atenza", base, null),
      schemaDoSoftware("Atenza", base, "en", cobravelNaMoedaLocal ? market : brMarket),
      {
        "@type": "BreadcrumbList",
        "@id": `${new URL(canonicalPath, base).toString()}#breadcrumb`,
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Atenza", item: new URL(href, base).toString() },
          {
            "@type": "ListItem",
            position: 2,
            name: "Plans and pricing",
            item: new URL(canonicalPath, base).toString(),
          },
        ],
      },
      schemaDoFaq(base, canonicalPath, PRICING_FAQ),
    ],
  };

  return (
    <div className="atenza-app-canvas min-h-screen bg-background">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdSeguro(schema) }}
      />
      <main className="mx-auto max-w-5xl px-5 py-14 text-text">
        <p className="mb-4 inline-flex items-center gap-2 rounded-full border-2 border-[#0e241d] bg-white px-4 py-1.5 text-xs font-extrabold uppercase tracking-wider text-[#0e241d] shadow-[4px_4px_0_#64d893]">
          ✦ Atenza · {country === "GB" ? "United Kingdom" : "United States"}
        </p>
        <h1 className="mb-4 text-4xl font-black tracking-tight sm:text-5xl">Plans and pricing</h1>
        <p className="mb-10 max-w-3xl text-base leading-7 text-muted-foreground">
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
                className={`relative flex flex-col rounded-2xl border-[3px] border-[#0e241d] p-7 ${
                  isPopular
                    ? "bg-[#123f34] text-white shadow-[8px_8px_0_#64d893]"
                    : "bg-white text-[#0e241d] shadow-[6px_6px_0_rgba(14,36,29,0.14)]"
                }`}
              >
                {isPopular ? (
                  <span className="mb-3 inline-block w-fit rounded-lg border-2 border-[#0e241d] bg-[#f2cb57] px-3 py-1 text-xs font-black uppercase tracking-wider text-[#0e241d]">
                    Most popular
                  </span>
                ) : null}
                <h2 className="mb-2 text-xl font-black">{NAMES[plan]}</h2>
                <p className="text-4xl font-black tracking-tight">
                  {precoLegivelNoMercado(plan, mercadoExibido)}{" "}
                  <span
                    className={`text-sm font-semibold ${
                      isPopular ? "text-[#cde5d6]" : "text-muted-foreground"
                    }`}
                  >
                    / month
                  </span>
                </p>
                <p
                  className={`mt-2 text-xs ${
                    isPopular ? "text-[#cde5d6]" : "text-muted-foreground"
                  }`}
                >
                  {cobradoEmBrl
                    ? `Billed in BRL (${precoLegivelNoMercado(plan, brMarket)}/mo) via Stripe. Final amount in your card currency shown at checkout.`
                    : `Billed in ${mercadoExibido.moeda} via Stripe. ${DIAS_DE_TRIAL} days free, renews monthly.`}
                </p>
                <ul
                  className={`mt-6 flex-1 space-y-2.5 text-sm ${
                    isPopular ? "text-[#e5f3ea]" : "text-[#2c4239]"
                  }`}
                >
                  {HIGHLIGHTS[plan].map((item) => (
                    <li key={item} className="flex items-start gap-2">
                      <span
                        aria-hidden
                        className={`font-black ${isPopular ? "text-[#64d893]" : "text-[#1f6b52]"}`}
                      >
                        ✓
                      </span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
                <Link
                  href="/signup"
                  className={`mt-7 inline-block w-full rounded-xl border-2 border-[#0e241d] px-5 py-3 text-center text-sm font-extrabold transition-transform hover:-translate-y-0.5 ${
                    isPopular
                      ? "bg-[#f2cb57] text-[#0e241d] shadow-[4px_4px_0_#0e241d]"
                      : "bg-[#123f34] text-white shadow-[4px_4px_0_#0e241d]"
                  }`}
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

        <section className="mt-14 rounded-2xl border-[3px] border-[#0e241d] bg-white p-7 shadow-[6px_6px_0_#64d893]">
          <h2 className="mb-5 text-2xl font-black text-[#0e241d]">Pricing FAQ</h2>
          <div className="divide-y divide-[#dbe6dd]">
            {PRICING_FAQ.map((item) => (
              <details key={item.question} className="py-4">
                <summary className="cursor-pointer font-bold text-[#0e241d]">
                  {item.question}
                </summary>
                <p className="mt-2 text-sm leading-6 text-[#4b6158]">{item.answer}</p>
              </details>
            ))}
          </div>
        </section>

        <div className="mt-8 flex gap-6 text-sm font-bold">
          <Link className="underline underline-offset-4" href={href}>
            Back to Atenza
          </Link>
          <Link className="underline underline-offset-4" href="/login">
            Sign in
          </Link>
        </div>
      </main>
    </div>
  );
}
