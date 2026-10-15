import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight } from "lucide-react";

import { CabecalhoDoSite } from "@/components/site/CabecalhoDoSite";
import { RodapeDoSite } from "@/components/site/RodapeDoSite";
import styles from "@/components/site/solucoes.module.css";
import { instalacaoCobra } from "@/lib/billing/planos";
import { marcaDaSaida } from "@/lib/branding/saida";
import { env } from "@/lib/env";
import { artigoPorCaminho, type Artigo } from "@/lib/marketing/artigos";
import { jsonLdSeguro, metadadosPublicos, schemaDoFaq } from "@/lib/marketing/seo";

function comMarca(a: Artigo, marca: string): Artigo {
  return JSON.parse(JSON.stringify(a).replaceAll("{marca}", marca)) as Artigo;
}

export async function metadadosDoArtigo(caminho: string) {
  const bruto = artigoPorCaminho(caminho);
  if (!bruto || !instalacaoCobra()) return { robots: { index: false, follow: false } };
  const marca = await marcaDaSaida(null);
  const a = comMarca(bruto, marca.nome);
  const meta = metadadosPublicos({
    nome: marca.nome,
    titulo: a.title,
    descricao: a.description,
    caminho: a.caminho,
    base: env.NEXT_PUBLIC_APP_URL,
    idioma: a.idioma,
  });
  return {
    ...meta,
    openGraph: { ...meta.openGraph, type: "article", locale: a.hreflang.replace("-", "_") },
  };
}

/** Guia de compra por país: Article + FAQPage, fontes visíveis e um CTA para a página do país. */
export async function PaginaDeArtigo({ caminho }: { readonly caminho: string }) {
  if (!instalacaoCobra()) notFound();
  const bruto = artigoPorCaminho(caminho);
  if (!bruto) notFound();
  const marca = await marcaDaSaida(null);
  const a = comMarca(bruto, marca.nome);
  const base = env.NEXT_PUBLIC_APP_URL;
  const url = new URL(a.caminho, base).toString();
  const dados = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Article",
        headline: a.h1,
        description: a.description,
        inLanguage: a.hreflang,
        url,
        dateModified: "2026-10-12",
        author: { "@type": "Organization", name: marca.nome },
        publisher: { "@type": "Organization", name: marca.nome },
      },
      schemaDoFaq(base, a.caminho, a.faq),
    ],
  };
  const en = a.idioma === "en";
  return (
    <div className={styles.page} lang={a.hreflang}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdSeguro(dados) }}
      />
      <CabecalhoDoSite nome={marca.nome} idioma={a.idioma} />
      <main id="conteudo" className={styles.reading} style={{ display: "block", paddingBlock: 48 }}>
        <article style={{ maxWidth: 760 }}>
          <p className={styles.eyebrow}>
            {en ? "Guide" : "Guía"} · {a.atualizado}
          </p>
          <h1>{a.h1}</h1>
          <p className={styles.intro}>{a.intro}</p>
          {a.sections.map((s) => (
            <section key={s.title} className={styles.chapter}>
              <h2>{s.title}</h2>
              {s.paragraphs.map((p) => (
                <p key={p}>{p}</p>
              ))}
              {s.bullets && (
                <ul>
                  {s.bullets.map((b) => (
                    <li key={b}>{b}</li>
                  ))}
                </ul>
              )}
            </section>
          ))}
          <section className={styles.faq}>
            <h2>{en ? "Frequently asked questions" : "Preguntas frecuentes"}</h2>
            {a.faq.map((f) => (
              <details key={f.question}>
                <summary>{f.question}</summary>
                <p>{f.answer}</p>
              </details>
            ))}
          </section>
          <section className={styles.chapter}>
            <h2>{en ? "Sources" : "Fuentes"}</h2>
            <ul>
              {a.fontes.map((f) => (
                <li key={f.href}>
                  <a href={f.href} target="_blank" rel="noopener noreferrer">
                    {f.rotulo}
                  </a>
                </li>
              ))}
            </ul>
          </section>
          <section className={styles.cta}>
            <h2>{a.cta.texto}</h2>
            <div className={styles.actions}>
              <Link href={a.cta.href} className={styles.primary}>
                {a.cta.rotulo}
                <ArrowRight size={17} aria-hidden />
              </Link>
            </div>
          </section>
        </article>
      </main>
      <RodapeDoSite nome={marca.nome} idioma={a.idioma} />
    </div>
  );
}
