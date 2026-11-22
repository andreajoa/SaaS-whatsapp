import { DIAS_DE_TRIAL, ORDEM_DOS_PLANOS, PLANOS } from "@/lib/billing/planos";
import {
  mercadoDoPais,
  precoNoMercado,
  type IdiomaDoSite,
  type Mercado,
} from "@/lib/mercado/paises";
import { AREA_ATENDIDA } from "@/lib/marketing/seo";

// Fora de `seo.ts` de propósito: aquele módulo é importado pelo `proxy.ts` (edge)
// e não deve arrastar a tabela de planos e mercados para cada requisição.
/**
 * O produto como software à venda, com os preços REAIS do mercado ativo (os
 * mesmos do Stripe). Sem `aggregateRating`: não há avaliações coletadas, e nota
 * inventada é motivo de ação manual do Google.
 */
export function schemaDoSoftware(
  nome: string,
  base: string,
  idioma: IdiomaDoSite = "pt-BR",
  mercadoAlvo?: Mercado,
) {
  const url = new URL("/", base).toString();
  const mercado = mercadoAlvo ?? mercadoDoPais("BR");
  const isEn = idioma === "en";
  const isEs = idioma === "es";
  const precosUrl =
    mercado.pais === "US"
      ? `${url}en-us/pricing`
      : mercado.pais === "GB"
        ? `${url}en-gb/pricing`
        : `${url}precos`;

  return {
    "@type": "SoftwareApplication",
    "@id": `${url}#software`,
    name: nome,
    url,
    applicationCategory: "BusinessApplication",
    applicationSubCategory: isEn
      ? "WhatsApp CRM and AI customer support"
      : isEs
        ? "CRM y atención por WhatsApp con IA"
        : "CRM e atendimento por WhatsApp",
    operatingSystem: "Web",
    inLanguage: idioma,
    description: isEn
      ? "Shared WhatsApp inbox with AI agents trained on your business knowledge base, seamless human handoff with full history, and a Kanban sales pipeline."
      : isEs
        ? "Bandeja compartida de WhatsApp con agentes de IA entrenados con el conocimiento de tu negocio, traspaso a tu equipo con historial y CRM en kanban."
        : "Caixa de entrada compartilhada de WhatsApp com agentes de IA treinados com a base da empresa, passagem para atendimento humano e CRM em kanban.",
    featureList: isEn
      ? [
          "Shared WhatsApp Business API inbox for multiple agents on one number",
          "AI agents trained on your company knowledge base (BYO key, zero markup)",
          "Instant AI-to-human handoff with full conversation history",
          "Kanban CRM and sales pipeline",
          "Automated follow-ups and segmented WhatsApp campaigns",
          "Google Calendar and Google Meet booking inside WhatsApp",
          "Shopify, WooCommerce and Nuvemshop integrations",
          "REST API, webhooks and Model Context Protocol (MCP)",
          "Multi-tenant isolation and LGPD/GDPR privacy controls",
        ]
      : [
          "Caixa de entrada compartilhada de WhatsApp com vários atendentes",
          "Agentes de IA com base de conhecimento da empresa",
          "Passagem da IA para atendimento humano com histórico",
          "CRM e funil de vendas em kanban",
          "Follow-up automático e campanhas",
          "Agendamento integrado com Google Agenda e Google Meet",
          "Integrações com Shopify, WooCommerce e Nuvemshop",
          "API, webhooks e servidor MCP",
          "Conformidade com a LGPD",
        ],
    softwareHelp: {
      "@type": "WebPage",
      url: new URL(
        isEn ? "/en/help/ai-key" : isEs ? "/es/ayuda/clave-de-ia" : "/ajuda/chave-de-ia",
        base,
      ).toString(),
    },
    publisher: { "@id": `${url}#organization` },
    areaServed: AREA_ATENDIDA,
    offers: ORDEM_DOS_PLANOS.map((id) => ({
      "@type": "Offer",
      name: isEn ? `${PLANOS[id].nome} Plan` : `Plano ${PLANOS[id].nome}`,
      price: (precoNoMercado(id, mercado) / 100).toFixed(2),
      priceCurrency: mercado.moeda,
      url: precosUrl,
      availability: "https://schema.org/InStock",
      priceSpecification: {
        "@type": "UnitPriceSpecification",
        price: (precoNoMercado(id, mercado) / 100).toFixed(2),
        priceCurrency: mercado.moeda,
        unitCode: "MON",
        referenceQuantity: { "@type": "QuantitativeValue", value: 1, unitCode: "MON" },
      },
      description: isEn
        ? `${DIAS_DE_TRIAL}-day free trial, cancel anytime in one click.`
        : `${DIAS_DE_TRIAL} dias sem cobrança no início.`,
    })),
  };
}
