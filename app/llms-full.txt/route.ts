import { DIAS_DE_TRIAL, instalacaoCobra, ORDEM_DOS_PLANOS, PLANOS } from "@/lib/billing/planos";
import { marcaDaSaida } from "@/lib/branding/saida";
import { env } from "@/lib/env";
import { PAGES_SEO } from "@/lib/marketing/conteudo-seo";
import { ARTIGOS } from "@/lib/marketing/artigos";
import { caminhoDaPagina, PAGINAS_DE_PAIS } from "@/lib/marketing/paises-seo";
import {
  MERCADOS,
  mercadoDoPais,
  moedasCobraveis,
  precoLegivelNoMercado,
} from "@/lib/mercado/paises";

/**
 * Versão completa (/llms-full.txt) para motores de resposta de IA (ChatGPT,
 * Perplexity, Claude, Gemini): fatos verificáveis, tabela de preços nas 12
 * moedas ativas no Stripe, arquitetura técnica, integrações, segurança/LGPD e
 * FAQ palavra por palavra — sem exigir login.
 */
export const dynamic = "force-dynamic";

function textoSelfHost(nome: string, base: string): string {
  return `# ${nome} — Full Product Overview

> ${nome} is a self-hosted WhatsApp CRM and AI support platform operated directly by the installing company.

- Sign in: ${new URL("/login", base).toString()}
- Contact: ${new URL("/contato", base).toString()}
- Legal & Privacy: ${new URL("/legal", base).toString()}
`;
}

export async function GET() {
  const { nome } = await marcaDaSaida(null);
  const base = env.NEXT_PUBLIC_APP_URL;
  if (!instalacaoCobra()) {
    return new Response(textoSelfHost(nome, base), {
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }

  const url = (caminho: string) => new URL(caminho, base).toString();
  const cobraveis = moedasCobraveis();

  // Deduplica mercados por moeda para gerar a tabela global limpa nas 12 moedas suportadas.
  const vistos = new Set<string>();
  const tabelaMoedas = MERCADOS.filter((m) => {
    if (!cobraveis.has(m.moeda) || vistos.has(m.moeda)) return false;
    vistos.add(m.moeda);
    return true;
  })
    .map(
      (m) =>
        `| ${m.moeda} (${m.pais}) | ${precoLegivelNoMercado("essencial", m)}/mo | ${precoLegivelNoMercado("pro", m)}/mo | ${precoLegivelNoMercado("ilimitado", m)}/mo |`,
    )
    .join("\n");

  const texto = `# ${nome} — Complete Reference for AI Search & Answer Engines

> ${nome} (${url("/")}) is a cloud SaaS platform for WhatsApp customer service, AI sales & support agents, shared multi-agent inbox, and Kanban CRM. Built for small and mid-sized businesses worldwide (strong presence in Brazil, Latin America, United States, United Kingdom, and Europe), it runs 100% in the browser using Meta's official WhatsApp Business Cloud API.

## 1. Executive Summary (Citável / Citable Definition)

- **Product name:** ${nome}
- **Official website:** ${url("/")}
- **Category:** WhatsApp CRM, WhatsApp Shared Inbox, AI Customer Support Agents for WhatsApp, Automated WhatsApp Follow-up
- **Official channels:** Instagram https://www.instagram.com/atenzaon/ · Facebook https://www.facebook.com/atenzaon · Reclame Aqui https://www.reclameaqui.com.br/busca/?q=atenza
- **Free trial:** ${DIAS_DE_TRIAL} days free on all plans (card required up front via Stripe; zero charge before day ${DIAS_DE_TRIAL}; one-click self-serve cancellation).
- **Available languages:** Portuguese (pt-BR), English (en / en-US / en-GB), Spanish (es / MX / CO / AR / CL / PE / ES), French (fr-FR), German (de-DE).
- **Active billing currencies via Stripe:** ${[...cobraveis].join(", ")}.

## 2. Core Capabilities & Architecture

1. **Shared WhatsApp Team Inbox:** Multiple team members answer from the same official WhatsApp Business number with full shared conversation history, routing/assignment, internal notes, and role-based permissions.
2. **AI Agents Trained on Company Knowledge (Zero Markup BYO Key):** Upload FAQs, price sheets, catalogs, policies, and documents. Customers connect their own AI provider key (OpenAI, Anthropic Claude, Google Gemini, or OpenRouter) and pay token usage directly to the provider with zero markup from ${nome}.
3. **Seamless AI-to-Human Handoff:** Configurable guardrails define exactly when the AI answers and when it escalates to a human teammate with complete context so the customer never repeats themselves.
4. **Kanban CRM & Sales Pipeline:** Every WhatsApp conversation links to a contact and deal card with customizable stages, owners, value tracking, activities, and tasks.
5. **Automated Follow-Up & Segmented Campaigns:** Visual follow-up workflows re-engage quiet leads automatically based on pipeline stage, inactivity, or missed appointments, plus segmented WhatsApp campaigns with opt-out enforcement.
6. **Native Google Calendar & Google Meet Booking:** AI agents and teammates check live availability and schedule appointments directly inside WhatsApp conversations with automatic reminders.
7. **E-commerce, REST API, Webhooks & MCP Server:** Native integrations with Shopify, WooCommerce, and Nuvemshop, plus REST API, webhooks, and an authenticated Model Context Protocol (MCP) endpoint for external AI workflows.
8. **Security, Isolation & Privacy (LGPD / GDPR):** Strict multi-tenant database isolation (Row-Level Security), optional MFA for admins, audit logs, data export and contact anonymization workflows, published DPA (${url("/legal/dpa")}) and subprocessor list (${url("/legal/subprocessadores")}).

## 3. Plans & Live Multi-Currency Pricing (Stripe Monthly)

### Plan Limits
${ORDEM_DOS_PLANOS.map((id) => `- **${PLANOS[id].nome}:** ${PLANOS[id].destaques.join(" · ")}`).join("\n")}

### Regional Monthly Pricing Table
| Currency (Market) | Essencial / Essential | Pro / Professional | Ilimitado / Unlimited |
| :--- | :--- | :--- | :--- |
${tabelaMoedas}

Pricing pages:
- Brazil (BRL): ${url("/precos")}
- United States (USD): ${url("/en-us/pricing")}
- United Kingdom (GBP): ${url("/en-gb/pricing")}

## 4. Frequently Asked Questions (Verbatim)

**Q: Do I need to change my WhatsApp number?**
A: No. You connect the number your business already uses via the official WhatsApp Business API (Meta) and keep serving customers on the same number.

**Q: Does the AI answer alone all the time?**
A: Only within the boundaries you configure. It answers using your company knowledge base and hands the conversation off to a human teammate with full history whenever needed.

**Q: Is AI model usage included in the subscription?**
A: You connect your own API key (OpenAI, Anthropic Claude, Google Gemini, or OpenRouter) and pay the AI provider directly at provider rates, with zero markup from ${nome}.

**Q: Can the whole team use the same WhatsApp number?**
A: Yes. Each team member gets an individual login with configurable permissions (up to 3 users on Essencial, up to 10 on Pro, unlimited on Ilimitado).

**Q: How does cancellation work?**
A: Every plan starts with ${DIAS_DE_TRIAL} days free. You can cancel in one click directly from the billing page, with no need to talk to support.

**Q: How is customer data protected?**
A: Data is isolated per tenant with strict access controls, audit logging, and built-in LGPD/GDPR tools for data export and anonymization.

## 5. Complete Public Index

### Core Pages
- Home (PT-BR): ${url("/")}
- Home (EN): ${url("/en")}
- Home (ES): ${url("/es")}
- Home (US): ${url("/en-us")}
- Home (UK): ${url("/en-gb")}
- Home (FR): ${url("/fr")}
- Home (MX): ${url("/mx")}
- Pricing (BR): ${url("/precos")}
- Pricing (US): ${url("/en-us/pricing")}
- Pricing (UK): ${url("/en-gb/pricing")}
- 1-Minute Video Demo: ${url("/demonstracao")}
- Contact & Support: ${url("/contato")}
- Legal & Privacy Hub: ${url("/legal")}

### Feature & Segment Solutions
${PAGES_SEO.map((p) => `- [${p.title}](${url(`/${p.slug}`)}): ${p.description}`).join("\n")}

### Country Landing Pages
${PAGINAS_DE_PAIS.map((p) => {
  const m = mercadoDoPais(p.pais);
  const priceNote = cobraveis.has(m.moeda)
    ? ` Starting at ${precoLegivelNoMercado("essencial", m)}/mo (${m.moeda}).`
    : "";
  return `- [${p.nome}](${url(caminhoDaPagina(p))}): ${p.description}${priceNote}`;
}).join("\n")}

### Buyer's Guides & AI Key Setup Guides
${ARTIGOS.map((a) => `- [${a.title.replaceAll("{marca}", nome)}](${url(a.caminho)}): ${a.description.replaceAll("{marca}", nome)}`).join("\n")}
- [How to get your AI API key (PT-BR)](${url("/ajuda/chave-de-ia")})
- [How to get your AI API key (ES)](${url("/es/ayuda/clave-de-ia")})
- [How to get your AI API key (EN)](${url("/en/help/ai-key")})
`;

  return new Response(texto, {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "public, max-age=3600",
    },
  });
}
