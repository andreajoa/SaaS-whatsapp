import { CabecalhoDoSite } from "@/components/site/CabecalhoDoSite";
import { RodapeDoSite } from "@/components/site/RodapeDoSite";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, Play } from "lucide-react";

import { LogotipoDoProduto } from "@/components/branding/MarcaDoProduto";
import { Medidor } from "@/components/site/Medidor";
import { instalacaoCobra } from "@/lib/billing/planos";
import { marcaDaSaida } from "@/lib/branding/saida";
import { env } from "@/lib/env";
import { PAGES_SEO } from "@/lib/marketing/conteudo-seo";
import { INTERFACE_SEO as ui } from "@/lib/marketing/interface-seo";
import { jsonLdSeguro, metadadosPublicos, schemaDaPagina, schemaDoFaq } from "@/lib/marketing/seo";
import { visitanteAtual } from "@/lib/mercado/visitante";
import styles from "./solucoes.module.css";

export async function metadadosDaSolucao(slug: string) {
  const pagina = PAGES_SEO.find((p) => p.slug === slug);
  if (!pagina || !instalacaoCobra()) return { robots: { index: false, follow: false } };
  const marca = await marcaDaSaida(null);
  return metadadosPublicos({
    nome: marca.nome,
    titulo: pagina.title,
    descricao: pagina.description,
    caminho: `/${slug}`,
    base: env.NEXT_PUBLIC_APP_URL,
    imagem: pagina.image.src,
  });
}

/** Lista editorial fechada: nenhuma URL arbitrária cria conteúdo comercial. */
export async function PaginaDeSolucao({ slug }: { readonly slug: string }) {
  if (!instalacaoCobra()) notFound();
  const pagina = PAGES_SEO.find((p) => p.slug === slug);
  if (!pagina) notFound();
  const [marca, visitante] = await Promise.all([marcaDaSaida(null), visitanteAtual()]);
  const paginaSchema = schemaDaPagina(
    marca.nome,
    env.NEXT_PUBLIC_APP_URL,
    `/${slug}`,
    pagina.title,
    pagina.description,
    marca.logoUrl,
  );
  // FAQPage repete as perguntas que a página mostra; buscadores de IA citam esse par.
  const dados = {
    ...paginaSchema,
    "@graph": [
      ...paginaSchema["@graph"],
      schemaDoFaq(env.NEXT_PUBLIC_APP_URL, `/${slug}`, pagina.faq),
    ],
  };
  const relacionadas = PAGES_SEO.filter((p) => pagina.relatedSlugs.includes(p.slug));
  return (
    <div className={styles.page} lang="pt-BR">
      <Medidor idioma="pt-BR" moeda={visitante.mercado.moeda} dispositivo={visitante.dispositivo} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdSeguro(dados) }}
      />
      <a href="#conteudo" className={styles.skip}>
        {ui.skip}
      </a>
      <CabecalhoDoSite nome={marca.nome} />
      <main id="conteudo">
        <section className={styles.hero}>
          <div>
            <nav className={styles.breadcrumb} aria-label={ui.home}>
              <Link href="/">{marca.nome}</Link>
              <span aria-hidden>/</span>
              <span>{pagina.eyebrow}</span>
            </nav>
            <p className={styles.eyebrow}>{pagina.eyebrow}</p>
            <h1>{pagina.headline}</h1>
            <p className={styles.intro}>{pagina.intro}</p>
            <div className={styles.actions}>
              <Link href="/#planos" className={styles.primary}>
                {ui.plans}
                <ArrowRight size={17} aria-hidden />
              </Link>
              <Link href="/demonstracao" className={styles.secondary}>
                <Play size={17} aria-hidden />
                {ui.video}
              </Link>
            </div>
            <p className={styles.trial}>{ui.trial}</p>
          </div>
          <figure className={styles.figure}>
            <Image
              src={pagina.image.src}
              alt={pagina.image.alt}
              width={1000}
              height={563}
              sizes="(max-width: 800px) 100vw, 45vw"
              priority
            />
            <figcaption>{ui.caption}</figcaption>
          </figure>
        </section>
        <div className={styles.reading}>
          <aside>
            <nav aria-label={ui.index}>
              <p>{ui.index}</p>
              {pagina.sections.map((s, i) => (
                <a key={s.title} href={`#parte-${i + 1}`}>
                  {s.title}
                </a>
              ))}
              <a href="#perguntas">{ui.questions}</a>
            </nav>
          </aside>
          <article>
            {pagina.sections.map((s, i) => (
              <section key={s.title} id={`parte-${i + 1}`} className={styles.chapter}>
                <span className={styles.number}>{String(i + 1).padStart(2, "0")}</span>
                <h2>{s.title}</h2>
                {s.paragraphs.map((p) => (
                  <p key={p}>{p}</p>
                ))}
                {s.bullets && (
                  <ul>
                    {s.bullets.map((p) => (
                      <li key={p}>{p}</li>
                    ))}
                  </ul>
                )}
              </section>
            ))}
            <section id="perguntas" className={styles.faq}>
              <h2>{ui.questions}</h2>
              {pagina.faq.map((p) => (
                <details key={p.question}>
                  <summary>{p.question}</summary>
                  <p>{p.answer}</p>
                </details>
              ))}
            </section>
          </article>
        </div>
        <section className={styles.cta}>
          <p className={styles.eyebrow}>{marca.nome}</p>
          <h2>{ui.cta}</h2>
          <div className={styles.actions}>
            <Link href="/#planos" className={styles.primary}>
              {ui.plans}
              <ArrowRight size={17} aria-hidden />
            </Link>
            <Link href="/contato" className={styles.secondary}>
              {ui.contact}
            </Link>
          </div>
          <p className={styles.trial}>{ui.trial}</p>
        </section>
        <section className={styles.related}>
          <h2>{ui.related}</h2>
          <div>
            {relacionadas.map((p) => (
              <Link key={p.slug} href={`/${p.slug}`}>
                <span>{p.eyebrow}</span>
                <strong>{p.title}</strong>
                <ArrowRight size={20} aria-hidden />
              </Link>
            ))}
          </div>
        </section>
      </main>
      <RodapeDoSite nome={marca.nome} />
    </div>
  );
}
