import Link from "next/link";
import { mercadoDoPais, precoLegivelNoMercado } from "@/lib/mercado/paises";
import { ORDEM_DOS_PLANOS, precoDoPlano } from "@/lib/billing/planos";
import type { Metadata } from "next";

const NAMES = { essencial: "Essential", pro: "Professional", ilimitado: "Unlimited" } as const;
export function pricingMetadata(country: "GB" | "US"): Metadata {
  return { title: `WhatsApp CRM pricing (${country}) | Atenza`,
    description: "Compare Atenza subscription prices, trial conditions and external WhatsApp and AI costs.",
    robots: { index: true, follow: true },
    alternates: { canonical: country === "GB" ? "/en-gb/pricing" : "/en-us/pricing" } };
}
export function EnglishPricing({ country }: { country: "GB" | "US" }) {
  const market = mercadoDoPais(country);
  const href = country === "GB" ? "/en-gb" : "/en-us";
  const available = ORDEM_DOS_PLANOS.filter((plan) => Boolean(precoDoPlano(plan)));
  return (
    <main className="mx-auto max-w-5xl px-5 py-14 text-gray-1000">
      <p className="mb-3 text-sm font-medium">Atenza · {country === "GB" ? "United Kingdom" : "United States"}</p>
      <h1 className="mb-4 text-4xl font-bold">Plans and pricing</h1>
      <p className="mb-9 max-w-3xl text-base leading-7">Shared WhatsApp inbox, AI-assisted conversations and CRM. Choose the right subscription for your team.</p>
      <div className="grid gap-5 sm:grid-cols-3">
        {available.map((plan) => <article key={plan} className="rounded-xl border p-6">
          <h2 className="mb-3 text-xl font-semibold">{NAMES[plan]}</h2>
          <p className="text-3xl font-bold">{precoLegivelNoMercado(plan, market)} <span className="text-sm font-normal">/ month</span></p>
          <p className="mt-3 text-sm">Currency: {market.moeda}. The final price and payment terms appear before checkout.</p>
          <Link href="/signup" className="mt-5 inline-block rounded-lg bg-gray-950 px-5 py-3 text-white">Create account</Link>
        </article>)}
      </div>
      <p className="mt-8 max-w-4xl text-sm leading-6">External WhatsApp/Meta messaging fees and your AI provider's usage charges may apply separately. Check the trial and renewal terms before subscribing.</p>
      <div className="mt-8 flex gap-6"><Link className="underline" href={href}>Back to Atenza</Link><Link className="underline" href="/login">Sign in</Link></div>
    </main>
  );
}
