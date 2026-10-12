import { notFound } from "next/navigation";

import { GuiaDaChaveDeIa } from "@/components/ajuda/GuiaDaChaveDeIa";
import { CabecalhoDoSite } from "@/components/site/CabecalhoDoSite";
import { RodapeDoSite } from "@/components/site/RodapeDoSite";
import styles from "@/components/site/solucoes.module.css";
import { instalacaoCobra } from "@/lib/billing/planos";
import { marcaDaSaida } from "@/lib/branding/saida";
import { env } from "@/lib/env";
import { guiaNoIdioma, type IdiomaDoGuia } from "@/lib/ajuda/guia-chave-ia";
import { jsonLdSeguro, metadadosPublicos } from "@/lib/marketing/seo";

/** Os três endereços do guia — um por idioma do site. */
export const CAMINHOS_DO_GUIA: Readonly<Record<IdiomaDoGuia, string>> = {
  "pt-BR": "/ajuda/chave-de-ia",
  es: "/es/ayuda/clave-de-ia",
  en: "/en/help/ai-key",
};

export async function metadadosDaChave(idioma: IdiomaDoGuia) {
  if (!instalacaoCobra()) return { robots: { index: false, follow: false } };
  const marca = await marcaDaSaida(null);
  const guia = guiaNoIdioma(idioma, marca.nome);
  const base = env.NEXT_PUBLIC_APP_URL;
  const meta = metadadosPublicos({
    nome: marca.nome,
    titulo: guia.titulo,
    descricao: guia.intro.slice(0, 155),
    caminho: CAMINHOS_DO_GUIA[idioma],
    base,
    idioma,
  });
  return {
    ...meta,
    alternates: {
      ...meta.alternates,
      languages: Object.fromEntries(
        Object.entries(CAMINHOS_DO_GUIA).map(([l, c]) => [l, new URL(c, base).toString()]),
      ),
    },
  };
}

/**
 * A página pública do guia: quem ainda está decidindo assinar vê que pegar a
 * chave é simples ANTES de assinar — e quem já assinou chega aqui pelo link
 * dentro de Credenciais.
 */
export async function PaginaDaChave({ idioma }: { readonly idioma: IdiomaDoGuia }) {
  if (!instalacaoCobra()) notFound();
  const marca = await marcaDaSaida(null);
  const guia = guiaNoIdioma(idioma, marca.nome);
  const base = env.NEXT_PUBLIC_APP_URL;
  // HowTo + FAQPage: o par que buscadores e assistentes de IA citam.
  const dados = {
    "@context": "https://schema.org",
    "@graph": guia.provedores
      .map((p) => ({
        "@type": "HowTo",
        name: `${guia.titulo} — ${p.nome}`,
        totalTime: p.id === "google" ? "PT3M" : "PT10M",
        step: p.passos.map((s, i) => ({
          "@type": "HowToStep",
          position: i + 1,
          name: s.titulo,
          text: s.texto,
          ...(s.link?.href.startsWith("http") ? { url: s.link.href } : {}),
        })),
      }))
      .concat([
        {
          "@type": "FAQPage",
          url: new URL(CAMINHOS_DO_GUIA[idioma], base).toString(),
          mainEntity: guia.perguntas.map((q) => ({
            "@type": "Question",
            name: q.pergunta,
            acceptedAnswer: { "@type": "Answer", text: q.resposta },
          })),
        } as never,
      ]),
  };
  return (
    <div className={styles.page} lang={idioma}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdSeguro(dados) }}
      />
      <CabecalhoDoSite nome={marca.nome} idioma={idioma} />
      <main id="conteudo" className={styles.reading} style={{ display: "block", paddingBlock: 48 }}>
        <GuiaDaChaveDeIa guia={guia} />
      </main>
      <RodapeDoSite nome={marca.nome} idioma={idioma} />
    </div>
  );
}
