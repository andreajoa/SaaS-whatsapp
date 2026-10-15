import { DIAS_DE_TRIAL, ORDEM_DOS_PLANOS, PLANOS } from "@/lib/billing/planos";
import { mercadoDoPais, precoNoMercado } from "@/lib/mercado/paises";
import { AREA_ATENDIDA } from "@/lib/marketing/seo";

// Fora de `seo.ts` de propósito: aquele módulo é importado pelo `proxy.ts` (edge)
// e não deve arrastar a tabela de planos e mercados para cada requisição.
/**
 * O produto como software à venda, com os preços REAIS do mercado Brasil (os
 * mesmos do Stripe). Sem `aggregateRating`: não há avaliações coletadas, e nota
 * inventada é motivo de ação manual do Google.
 */
export function schemaDoSoftware(nome: string, base: string) {
  const url = new URL("/", base).toString();
  const brasil = mercadoDoPais("BR");
  return {
    "@type": "SoftwareApplication",
    "@id": `${url}#software`,
    name: nome,
    url,
    applicationCategory: "BusinessApplication",
    applicationSubCategory: "CRM e atendimento por WhatsApp",
    operatingSystem: "Web",
    inLanguage: "pt-BR",
    description:
      "Caixa de entrada compartilhada de WhatsApp com agentes de IA treinados com a base da empresa, passagem para atendimento humano e CRM em kanban.",
    featureList: [
      "Caixa de entrada compartilhada de WhatsApp com vários atendentes",
      "Agentes de IA com base de conhecimento da empresa",
      "Passagem da IA para atendimento humano com histórico",
      "CRM e funil de vendas em kanban",
      "Follow-up automático e campanhas",
      "Integrações com Shopify, WooCommerce e Nuvemshop",
      "API e webhooks",
      "Conformidade com a LGPD",
    ],
    publisher: { "@id": `${url}#organization` },
    areaServed: AREA_ATENDIDA,
    offers: ORDEM_DOS_PLANOS.map((id) => ({
      "@type": "Offer",
      name: `Plano ${PLANOS[id].nome}`,
      price: (precoNoMercado(id, brasil) / 100).toFixed(2),
      priceCurrency: brasil.moeda,
      url: `${url}precos`,
      availability: "https://schema.org/InStock",
      eligibleRegion: { "@type": "Country", name: "Brasil" },
      priceSpecification: {
        "@type": "UnitPriceSpecification",
        price: (precoNoMercado(id, brasil) / 100).toFixed(2),
        priceCurrency: brasil.moeda,
        unitCode: "MON",
        referenceQuantity: { "@type": "QuantitativeValue", value: 1, unitCode: "MON" },
      },
      description: `${DIAS_DE_TRIAL} dias sem cobrança no início.`,
    })),
  };
}
