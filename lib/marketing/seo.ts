import type { Metadata } from "next";
import type { IdiomaDoSite } from "@/lib/mercado/paises";

/** Idioma pertence à URL pública; país continua determinando moeda e checkout. */
export function idiomaDaUrlPublica(caminho: string): IdiomaDoSite {
  if (caminho === "/en") return "en";
  if (caminho === "/es" || caminho.startsWith("/es/")) return "es";
  return "pt-BR";
}

export const IDIOMAS_PUBLICOS = { "pt-BR": "/", en: "/en", es: "/es", "fr-FR": "/fr", "x-default": "/" };
export const SELETOR_DE_IDIOMA = [
  { href: "/", lang: "pt-BR", label: "Português" },
  { href: "/en", lang: "en", label: "English" },
  { href: "/es", lang: "es", label: "Español" },
  { href: "/fr", lang: "fr", label: "Français" },
];
export const LINKS_SEO = [
  { href: "/atendimento-whatsapp", label: "Atendimento WhatsApp" },
  { href: "/chatbot-para-whatsapp", label: "Chatbot para WhatsApp" },
  { href: "/agentes-ia-whatsapp", label: "Agentes de IA" },
  { href: "/crm-whatsapp", label: "CRM para WhatsApp" },
  { href: "/atendimento-whatsapp-sao-paulo", label: "São Paulo e Grande São Paulo" },
  {
    href: "/guias/como-escolher-atendimento-whatsapp",
    label: "Como escolher um sistema de atendimento",
  },
  { href: "/demonstracao", label: "Demonstração em vídeo" },
];

const HOME = {
  "pt-BR": {
    title: "Atendimento WhatsApp com IA e CRM",
    description:
      "Organize o atendimento no WhatsApp com múltiplos atendentes, agentes de IA e CRM. Conheça a demonstração, compare os planos e comece com 7 dias sem cobrança.",
  },
  en: {
    title: "WhatsApp customer service with AI and CRM",
    description:
      "Organize WhatsApp conversations with a shared inbox, AI agents and a sales pipeline. Explore the demo, compare plans and start with 7 days at no charge.",
  },
  es: {
    title: "Atención por WhatsApp con IA y CRM",
    description:
      "Organiza las conversaciones de WhatsApp con varios agentes, inteligencia artificial y CRM. Conoce la demostración y los planes: 7 días sin cobro inicial.",
  },
};

export function metadadosPublicos({
  nome,
  titulo,
  descricao,
  caminho,
  base,
  idioma = "pt-BR",
  imagem = "/media/atenza/hero-office.webp",
}: {
  nome: string;
  titulo: string;
  descricao: string;
  caminho: string;
  base: string;
  idioma?: IdiomaDoSite;
  imagem?: string;
}): Metadata {
  const title = `${titulo} | ${nome}`;
  const url = new URL(caminho, base).toString();
  const image = new URL(imagem, base).toString();
  return {
    title: { absolute: title },
    description: descricao,
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
    alternates: { canonical: url },
    openGraph: {
      type: "website",
      title,
      description: descricao,
      url,
      siteName: nome,
      locale: idioma === "pt-BR" ? "pt_BR" : idioma === "es" ? "es_ES" : "en_US",
      images: [{ url: image, alt: titulo }],
    },
    twitter: { card: "summary_large_image", title, description: descricao, images: [image] },
  };
}

export function metadadosDaHome(nome: string, base: string, idioma: IdiomaDoSite): Metadata {
  const texto = HOME[idioma];
  const meta = metadadosPublicos({
    nome,
    titulo: texto.title,
    descricao: texto.description,
    caminho: IDIOMAS_PUBLICOS[idioma],
    base,
    idioma,
  });
  return {
    ...meta,
    alternates: {
      ...meta.alternates,
      languages: Object.fromEntries(
        Object.entries(IDIOMAS_PUBLICOS).map(([lang, path]) => [
          lang,
          new URL(path, base).toString(),
        ]),
      ),
    },
  };
}

/** Escape '<' inclusive em nome vindo do banco, para não fechar a tag script. */
export function jsonLdSeguro(valor: unknown): string {
  return JSON.stringify(valor)
    .replace(/</g, "\\u003c")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

/**
 * Token do Search Console da propriedade www.atenza.online (enviado pelo dono em
 * 11/10/2026). Só sai no domínio oficial: um clone self-host que publicasse a
 * meta estaria declarando a propriedade de outra pessoa.
 */
const VERIFICACAO_GOOGLE_ATENZA = "CrYhy8LdJsnENi_wtvU3A8ECgveVLBX03mIeApnm3Yc";

/** Perfis oficiais da Atenza; como a meta do Google, só valem no domínio oficial. */
const INSTAGRAM_ATENZA = "https://www.instagram.com/atenzaon/";

function ehDominioOficial(base: string): boolean {
  return new URL(base).hostname.replace(/^www\./, "") === "atenza.online";
}

/**
 * Página da Atenza no Reclame Aqui (empresa cadastrada pelo dono em 11/10/2026).
 * Aponta para a busca pelo nome, que sempre leva à página da empresa — o
 * endereço exato do perfil não pôde ser conferido (o site barra acesso automático).
 */
const RECLAME_AQUI_ATENZA = "https://www.reclameaqui.com.br/busca/?q=atenza";

export function reclameAquiOficial(base: string): string | null {
  return ehDominioOficial(base) ? RECLAME_AQUI_ATENZA : null;
}

export function instagramOficial(base: string): string | null {
  return ehDominioOficial(base) ? INSTAGRAM_ATENZA : null;
}

export function verificacaoDoBuscador(base: string): Metadata["verification"] {
  return ehDominioOficial(base) ? { google: VERIFICACAO_GOOGLE_ATENZA } : undefined;
}

/**
 * Área de uso do SaaS: Brasil inteiro, com a Grande São Paulo nomeada porque é
 * onde está o foco comercial. É área ATENDIDA (o produto é online), não endereço
 * físico — nenhum PostalAddress é declarado.
 */
export const AREA_ATENDIDA = [
  { "@type": "Country", name: "Brasil" },
  { "@type": "State", name: "São Paulo" },
  ...[
    "São Paulo",
    "Guarulhos",
    "Osasco",
    "Santo André",
    "São Bernardo do Campo",
    "São Caetano do Sul",
    "Diadema",
    "Mauá",
    "Barueri",
    "Carapicuíba",
    "Mogi das Cruzes",
    "Taboão da Serra",
    "Cotia",
    "Itaquaquecetuba",
    "Suzano",
  ].map((name) => ({ "@type": "City", name })),
];

export function identidadePublica(nome: string, base: string, logoUrl: string | null) {
  const url = new URL("/", base).toString();
  return [
    {
      "@type": "Organization",
      "@id": `${url}#organization`,
      name: nome,
      url,
      ...(logoUrl ? { logo: new URL(logoUrl, base).toString() } : {}),
      areaServed: AREA_ATENDIDA,
      knowsLanguage: ["pt-BR", "en", "es"],
      // sameAs liga a marca ao perfil social no Knowledge Graph e nas respostas de IA.
      ...(instagramOficial(base) ? { sameAs: [instagramOficial(base)] } : {}),
    },
    {
      "@type": "WebSite",
      "@id": `${url}#website`,
      name: nome,
      url,
      publisher: { "@id": `${url}#organization` },
      inLanguage: ["pt-BR", "en", "es"],
    },
  ];
}

export function schemaDaPagina(
  nome: string,
  base: string,
  caminho: string,
  titulo: string,
  descricao: string,
  logoUrl: string | null,
) {
  const url = new URL(caminho, base).toString();
  const inicio = new URL("/", base).toString();
  return {
    "@context": "https://schema.org",
    "@graph": [
      ...identidadePublica(nome, base, logoUrl),
      {
        "@type": "WebPage",
        "@id": `${url}#page`,
        url,
        name: titulo,
        description: descricao,
        inLanguage: "pt-BR",
        isPartOf: { "@id": `${inicio}#website` },
        breadcrumb: { "@id": `${url}#breadcrumb` },
      },
      {
        "@type": "BreadcrumbList",
        "@id": `${url}#breadcrumb`,
        itemListElement: [
          { "@type": "ListItem", position: 1, name: nome, item: inicio },
          { "@type": "ListItem", position: 2, name: titulo, item: url },
        ],
      },
    ],
  };
}

export function schemaDoVideo(nome: string, base: string) {
  return {
    "@context": "https://schema.org",
    "@type": "VideoObject",
    name: `Como funciona o ${nome}: WhatsApp, IA e CRM`,
    description:
      "Demonstração ilustrativa: caixa de entrada compartilhada, conhecimento do agente de IA, atendimento humano e funil de vendas. Áudio e legendas em português.",
    thumbnailUrl: new URL("/media/atenza/explainer-thumbnail.webp", base).toString(),
    uploadDate: "2026-10-11T18:00:00-03:00",
    duration: "PT53S",
    inLanguage: "pt-BR",
    contentUrl: new URL("/media/atenza/atenza-explica.mp4", base).toString(),
    mainEntityOfPage: new URL("/demonstracao", base).toString(),
  };
}

/** Perguntas visíveis na página viram FAQPage — as mesmas, palavra por palavra. */
export function schemaDoFaq(
  base: string,
  caminho: string,
  faq: readonly { question: string; answer: string }[],
) {
  const url = new URL(caminho, base).toString();
  return {
    "@type": "FAQPage",
    "@id": `${url}#faq`,
    mainEntity: faq.map((p) => ({
      "@type": "Question",
      name: p.question,
      acceptedAnswer: { "@type": "Answer", text: p.answer },
    })),
  };
}
