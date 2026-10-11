import { describe, expect, it } from "vitest";
import { isPublicPath } from "@/lib/auth/public-paths";
import { PAGES_SEO } from "./conteudo-seo";
import { montarMenu } from "./menu";
import {
  idiomaDaUrlPublica,
  jsonLdSeguro,
  LINKS_SEO,
  metadadosDaHome,
  schemaDaPagina,
  schemaDoVideo,
} from "./seo";

const base = "https://example.test";

describe("URLs comerciais rastreáveis", () => {
  it.each(["/", "/en", "/es"])(
    "%s tem idioma, canonical próprio e alternates recíprocos",
    (path) => {
      const idioma = idiomaDaUrlPublica(path);
      const meta = metadadosDaHome("Marca de teste", base, idioma);
      expect(meta.alternates?.canonical).toBe(new URL(path, base).toString());
      expect(meta.alternates?.languages).toEqual({
        "pt-BR": `${base}/`,
        en: `${base}/en`,
        es: `${base}/es`,
        "x-default": `${base}/`,
      });
      expect(meta.description).toBeTruthy();
      expect(meta.openGraph?.url).toBe(new URL(path, base).toString());
    },
  );
  it("não transforma prefixos próximos em outras línguas", () => {
    expect(idiomaDaUrlPublica("/en/private")).toBe("pt-BR");
    expect(idiomaDaUrlPublica("/escolas")).toBe("pt-BR");
  });
  it("libera somente as páginas editoriais concretas e preserva a área privada", () => {
    for (const item of LINKS_SEO) {
      expect(isPublicPath(item.href)).toBe(true);
      expect(isPublicPath(`${item.href}/private`)).toBe(false);
    }
    expect(isPublicPath("/guias/qualquer-outra-rota")).toBe(false);
    expect(isPublicPath("/api/v1/painel/exportar")).toBe(false);
    expect(isPublicPath("/app/contacts")).toBe(false);
  });
  it("todas as páginas são alcançáveis e seus links relacionados existem", () => {
    const slugs = new Set(PAGES_SEO.map((p) => p.slug));
    expect(slugs.size).toBe(PAGES_SEO.length);
    for (const p of PAGES_SEO) {
      // Alcançável pelo rodapé (LINKS_SEO) ou pelo mega menu.
      const noMenu = montarMenu((t) => t, true).grupos.some(
        (g) => g.itens.some((i) => i.href === `/${p.slug}`) || g.destaque.href === `/${p.slug}`,
      );
      expect(LINKS_SEO.some((l) => l.href === `/${p.slug}`) || noMenu, p.slug).toBe(true);
      expect(p.relatedSlugs.every((slug) => slugs.has(slug) && slug !== p.slug)).toBe(true);
    }
  });
});

describe("identidade e dados estruturados verdadeiros", () => {
  it("usa a marca e domínio da instalação sem inventar endereço ou avaliações", () => {
    const schema = schemaDaPagina(
      "Outra marca",
      base,
      "/crm-whatsapp",
      "CRM",
      "Descrição",
      "/logo.svg",
    );
    expect(schema["@graph"][0]).toMatchObject({
      name: "Outra marca",
      url: `${base}/`,
      logo: `${base}/logo.svg`,
    });
    const texto = JSON.stringify(schema);
    expect(texto).not.toMatch(/aggregateRating|LocalBusiness|streetAddress|review/);
    expect(texto).not.toContain("atenza.online");
  });
  it("um nome contendo fechamento de script não sai da tag JSON-LD", () => {
    const nome = '</script><script>alert("x")</script>\u2028';
    const valor = jsonLdSeguro({ name: nome });
    expect(valor).not.toContain("<");
    expect(JSON.parse(valor)).toEqual({ name: nome });
  });
  it("o vídeo descreve o arquivo real com capa própria e duração real", () => {
    const video = schemaDoVideo("Minha marca", base);
    expect(video.duration).toBe("PT48S");
    expect(video.contentUrl).toBe(`${base}/media/atenza/atenza-explica.mp4`);
    expect(video.thumbnailUrl).toBe(`${base}/media/atenza/explainer-thumbnail.webp`);
    expect(video.mainEntityOfPage).toBe(`${base}/demonstracao`);
  });
});
