import type { MetadataRoute } from "next";

import { instalacaoCobra } from "@/lib/billing/planos";
import { env } from "@/lib/env";
import { DOCUMENTOS_LEGAIS } from "@/lib/legal/documentos";
import { PAGES_SEO } from "@/lib/marketing/conteudo-seo";
import { ARTIGOS } from "@/lib/marketing/artigos";
import { caminhoDaPagina, PAGINAS_DE_PAIS } from "@/lib/marketing/paises-seo";
import { IDIOMAS_PUBLICOS } from "@/lib/marketing/seo";

/**
 * As páginas que existem para quem ainda não tem conta.
 *
 * ─── Por que os documentos legais são DERIVADOS, e não digitados ───────────
 *
 * Este arquivo dizia "São três, e são todas" — a raiz e as duas páginas que o
 * contrato obriga. A frase era verdadeira quando foi escrita e envelheceu no
 * PR seguinte: entraram seis documentos novos (`lib/legal/documentos.ts`) e a
 * página de contato, e nenhum deles chegou aqui. Sete páginas publicadas e
 * invisíveis para o buscador, sem erro em lugar nenhum — o sitemap não reclama
 * do que falta nele.
 *
 * A lista dos seis sai de `DOCUMENTOS_LEGAIS`, que é a MESMA fonte de que
 * `app/legal/[documento]` e o índice `app/legal` se servem. Documento novo
 * entra no sitemap no mesmo commit em que passa a existir, sem ninguém
 * lembrar — que é a única forma de esta lista não envelhecer de novo.
 *
 * `/descadastrar/[token]` fica de fora de propósito: é endereço pessoal, com
 * token, e indexá-lo publicaria o link de descadastro de quem o recebeu.
 *
 * ─── O mesmo interruptor de sempre ─────────────────────────────────────────
 *
 * Sem cobrança ligada não há página pública nenhuma (a raiz redireciona), então
 * o sitemap é VAZIO e não uma lista de 404 — mesmo interruptor do `robots.ts`.
 * Sitemap e robots são o mesmo mapa visto dos dois lados, e discordarem é o
 * defeito clássico aqui.
 *
 * Não há `lastModified`: a única data honesta seria a do deploy, e um sitemap
 * que jura "mudou hoje" a cada build ensina o buscador a ignorar o campo.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  if (!instalacaoCobra()) return [];

  const url = (caminho: string) => new URL(caminho, env.NEXT_PUBLIC_APP_URL).toString();

  return [
    ...["/fr", "/mx", "/en-us", "/en-gb"].map((path) => ({ url: url(path), priority: 0.8 })),
    ...["/", "/en", "/es"].map((path) => ({
      url: url(path),
      alternates: {
        languages: Object.fromEntries(
          Object.entries(IDIOMAS_PUBLICOS).map(([lang, path]) => [lang, url(path)]),
        ),
      },
    })),
    // Toda página editorial vem da lista fechada — página nova entra sozinha.
    ...PAGES_SEO.map((p) => ({ url: url(`/${p.slug}`), lastModified: "2026-10-11" })),
    // Uma página por país, com hreflang entre todas (es-MX, es-CO…).
    ...PAGINAS_DE_PAIS.map((p) => ({
      url: url(caminhoDaPagina(p)),
      lastModified: "2026-10-11",
      priority: 0.8,
      alternates: {
        languages: Object.fromEntries(
          PAGINAS_DE_PAIS.map((o) => [o.hreflang, url(caminhoDaPagina(o))]),
        ),
      },
    })),
    { url: url("/de/impressum"), changeFrequency: "yearly", priority: 0.3 },
    // Guias de compra por país.
    ...ARTIGOS.map((a) => ({ url: url(a.caminho), lastModified: "2026-10-12", priority: 0.7 })),
    // O guia da chave de IA nos três idiomas, com hreflang entre eles.
    ...["/ajuda/chave-de-ia", "/es/ayuda/clave-de-ia", "/en/help/ai-key"].map((c) => ({
      url: url(c),
      lastModified: "2026-10-12",
      priority: 0.7,
      alternates: {
        languages: {
          "pt-BR": url("/ajuda/chave-de-ia"),
          es: url("/es/ayuda/clave-de-ia"),
          en: url("/en/help/ai-key"),
        },
      },
    })),
    { url: url("/demonstracao"), lastModified: "2026-10-10" },
    { url: url("/precos"), lastModified: "2026-10-11", priority: 0.9 },
    // English acquisition pricing pages must be discoverable in both markets.
    { url: url("/en-gb/pricing"), priority: 0.9 },
    { url: url("/en-us/pricing"), priority: 0.9 },
    // Quem procura "como falar com o suporte" antes de assinar procura esta.
    { url: url("/contato"), changeFrequency: "yearly", priority: 0.5 },
    { url: url("/legal"), changeFrequency: "yearly", priority: 0.4 },
    { url: url("/legal/terms"), changeFrequency: "yearly", priority: 0.3 },
    { url: url("/legal/privacy"), changeFrequency: "yearly", priority: 0.3 },
    ...DOCUMENTOS_LEGAIS.map((doc) => ({
      url: url(`/legal/${doc.slug}`),
      changeFrequency: "yearly" as const,
      priority: 0.3,
    })),
  ];
}
