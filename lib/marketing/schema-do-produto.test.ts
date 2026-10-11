import { describe, expect, it } from "vitest";

import { schemaDoSoftware } from "@/lib/marketing/schema-do-produto";
import { schemaDoFaq, verificacaoDoBuscador } from "@/lib/marketing/seo";

describe("SEO do domínio oficial", () => {
  it("a meta do Search Console só sai em atenza.online", () => {
    expect(verificacaoDoBuscador("https://www.atenza.online")).toEqual({
      google: "CrYhy8LdJsnENi_wtvU3A8ECgveVLBX03mIeApnm3Yc",
    });
    expect(verificacaoDoBuscador("https://atenza.online")).toBeDefined();
    expect(verificacaoDoBuscador("https://crm.cliente.com.br")).toBeUndefined();
    expect(verificacaoDoBuscador("https://atenza.online.golpe.com")).toBeUndefined();
  });

  it("as ofertas do schema são os preços do Brasil, em reais, sem nota inventada", () => {
    const software = schemaDoSoftware("Atenza", "https://www.atenza.online");
    expect(software.offers.map((o) => [o.price, o.priceCurrency])).toEqual([
      ["97.00", "BRL"],
      ["197.00", "BRL"],
      ["397.00", "BRL"],
    ]);
    expect(software).not.toHaveProperty("aggregateRating");
    expect(JSON.stringify(software.areaServed)).toContain("Guarulhos");
  });

  it("FAQPage repete pergunta e resposta da página", () => {
    const faq = schemaDoFaq("https://www.atenza.online", "/crm-whatsapp", [
      { question: "P?", answer: "R." },
    ]);
    expect(faq.mainEntity).toEqual([
      { "@type": "Question", name: "P?", acceptedAnswer: { "@type": "Answer", text: "R." } },
    ]);
  });
});
