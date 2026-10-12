import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, Check, Play } from "lucide-react";

import { CabecalhoDoSite } from "@/components/site/CabecalhoDoSite";
import { Medidor } from "@/components/site/Medidor";
import { RodapeDoSite } from "@/components/site/RodapeDoSite";
import { instalacaoCobra, ORDEM_DOS_PLANOS, PLANOS, precoDoPlano } from "@/lib/billing/planos";
import { marcaDaSaida } from "@/lib/branding/saida";
import { env } from "@/lib/env";
import { PAGINAS_DE_PAIS, paginaDePais } from "@/lib/marketing/paises-seo";
import { jsonLdSeguro, metadadosPublicos, schemaDaPagina, schemaDoFaq } from "@/lib/marketing/seo";
import { schemaDoSoftware } from "@/lib/marketing/schema-do-produto";
import {
  mercadoDoPais,
  moedasCobraveis,
  precoLegivelNoMercado,
  precoNoMercado,
  MOEDAS_SEM_CENTAVOS,
} from "@/lib/mercado/paises";
import { textoDoSite } from "@/lib/mercado/textos";
import { visitanteAtual } from "@/lib/mercado/visitante";
import styles from "./solucoes.module.css";
import pais from "./pais.module.css";

/**
 * Países que já têm ilustração própria em /media/atenza/ilustracoes/pais_<slug>.webp.
 * Quem não tem usa a de agentes de IA até a sua ficar pronta — nunca um <img>
 * quebrado.
 */
const COM_ILUSTRACAO: ReadonlySet<string> = new Set<string>([]);

function ilustracao(slug: string) {
  return {
    src: COM_ILUSTRACAO.has(slug)
      ? `/media/atenza/ilustracoes/pais_${slug}.webp`
      : "/media/atenza/ilustracoes/agentes-ia-whatsapp.webp",
    alt: "Ilustración de atención por WhatsApp con inteligencia artificial",
  };
}

export async function metadadosDoPais(slug: string) {
  const pagina = paginaDePais(slug);
  if (!pagina || !instalacaoCobra()) return { robots: { index: false, follow: false } };
  const marca = await marcaDaSaida(null);
  const base = env.NEXT_PUBLIC_APP_URL;
  const meta = metadadosPublicos({
    nome: marca.nome,
    titulo: pagina.title,
    descricao: pagina.description,
    caminho: `/es/${slug}`,
    base,
    idioma: "es",
    imagem: ilustracao(slug).src,
  });
  // hreflang por país: o Google mostra a versão certa a quem busca do México,
  // da Colômbia ou da Espanha, em vez de escolher uma só para todo o espanhol.
  return {
    ...meta,
    alternates: {
      ...meta.alternates,
      languages: {
        ...Object.fromEntries(
          PAGINAS_DE_PAIS.map((p) => [p.hreflang, new URL(`/es/${p.slug}`, base).toString()]),
        ),
        "pt-BR": new URL("/", base).toString(),
        es: new URL("/es", base).toString(),
      },
    },
    openGraph: { ...meta.openGraph, locale: pagina.hreflang.replace("-", "_") },
  };
}

export async function PaginaDoPais({ slug }: { readonly slug: string }) {
  if (!instalacaoCobra()) notFound();
  const pagina = paginaDePais(slug);
  if (!pagina) notFound();
  const [marca, visitante] = await Promise.all([marcaDaSaida(null), visitanteAtual()]);
  const base = env.NEXT_PUBLIC_APP_URL;
  const caminho = `/es/${slug}`;
  const ui = pagina.ui;

  // O preço do país só aparece quando o checkout consegue cobrá-lo naquela
  // moeda. Mostrar MXN e cobrar BRL é exatamente o erro que esta guarda evita.
  const mercado = mercadoDoPais(pagina.pais);
  const cobravel = moedasCobraveis().has(mercado.moeda);
  const vendidos = ORDEM_DOS_PLANOS.filter((p) => precoDoPlano(p) !== null);
  const valorDe = (p: (typeof vendidos)[number]) => {
    const bruto = precoNoMercado(p, mercado);
    return MOEDAS_SEM_CENTAVOS.has(mercado.moeda) ? bruto : bruto / 100;
  };

  const paginaSchema = schemaDaPagina(
    marca.nome,
    base,
    caminho,
    pagina.title,
    pagina.description,
    marca.logoUrl,
  );
  const software = schemaDoSoftware(marca.nome, base);
  const dados = {
    ...paginaSchema,
    "@graph": [
      ...paginaSchema["@graph"],
      {
        ...software,
        "@id": `${new URL(caminho, base).toString()}#software`,
        applicationSubCategory: "CRM y atención por WhatsApp",
        description:
          "Bandeja compartida de WhatsApp con agentes de IA entrenados con la información del negocio, paso a atención humana y CRM con embudo de ventas.",
        featureList: undefined,
        inLanguage: pagina.hreflang,
        areaServed: { "@type": "Country", name: pagina.nome },
        // Sem preço cobrável no país, sem oferta: a do Brasil (BRL) não é
        // uma oferta para quem está no México.
        offers: undefined,
        ...(cobravel
          ? {
              offers: vendidos.map((p) => ({
                "@type": "Offer",
                name: PLANOS[p].nome,
                price: valorDe(p),
                priceCurrency: mercado.moeda,
                url: new URL("/precos", base).toString(),
                eligibleRegion: { "@type": "Country", name: pagina.nome },
              })),
            }
          : {}),
      },
      schemaDoFaq(base, caminho, pagina.faq),
    ],
  };

  const imagem = ilustracao(slug);
  const t = (texto: string) => textoDoSite(texto, "es");

  return (
    <div className={styles.page} lang={pagina.hreflang}>
      <Medidor idioma="es" moeda={visitante.mercado.moeda} dispositivo={visitante.dispositivo} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdSeguro(dados) }}
      />
      <a href="#conteudo" className={styles.skip}>
        Saltar al contenido
      </a>
      <CabecalhoDoSite nome={marca.nome} idioma="es" />
      <main id="conteudo">
        <section className={styles.hero}>
          <div>
            <nav className={styles.breadcrumb} aria-label="Ruta">
              <Link href="/es">{marca.nome}</Link>
              <span aria-hidden>/</span>
              <span>{pagina.nome}</span>
            </nav>
            <p className={styles.eyebrow}>
              {marca.nome} {pagina.eyebrow.toLowerCase()}
            </p>
            <h1>{pagina.headline}</h1>
            <p className={styles.intro}>{pagina.intro.replaceAll("{marca}", marca.nome)}</p>
            <div className={styles.actions}>
              <Link href="/signup" className={styles.primary} data-medir={`pais-${slug}-crear`}>
                {ui.crear}
                <ArrowRight size={17} aria-hidden />
              </Link>
              <Link href="/demonstracao" className={styles.secondary}>
                <Play size={17} aria-hidden />
                {ui.video}
              </Link>
            </div>
            <p className={styles.trial}>{ui.prueba}</p>
          </div>
          <figure className={styles.figure} data-ilustracao="true">
            <Image
              src={imagem.src}
              alt={imagem.alt}
              width={1000}
              height={563}
              sizes="(max-width: 800px) 100vw, 45vw"
              priority
            />
          </figure>
        </section>

        <section className={pais.bloco} aria-labelledby="dolores">
          <h2 id="dolores">{ui.dolores}</h2>
          <div className={pais.dores}>
            {pagina.dores.map((d) => (
              <article key={d.titulo}>
                <h3>{d.titulo}</h3>
                <p>{d.texto}</p>
              </article>
            ))}
          </div>
        </section>

        <div className={pais.leitura}>
          {pagina.sections.map((s) => (
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
        </div>

        {cobravel && vendidos.length > 0 && (
          <section className={pais.bloco} aria-labelledby="precios">
            <h2 id="precios">{ui.precios}</h2>
            <div className={pais.planos}>
              {vendidos.map((p) => (
                <article key={p} data-destaque={p === "pro" ? "true" : undefined}>
                  <h3>{PLANOS[p].nome}</h3>
                  <p className={pais.preco}>
                    {precoLegivelNoMercado(p, mercado)}
                    <small>{ui.mes}</small>
                  </p>
                  <ul>
                    {PLANOS[p].destaques.map((d) => (
                      <li key={d}>
                        <Check size={16} aria-hidden />
                        {t(d)}
                      </li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>
          </section>
        )}

        <section className={pais.bloco} aria-labelledby="preguntas">
          <h2 id="preguntas">{ui.preguntas}</h2>
          <div className={styles.faq}>
            {pagina.faq.map((p) => (
              <details key={p.question}>
                <summary>{p.question}</summary>
                <p>{p.answer}</p>
              </details>
            ))}
          </div>
        </section>

        <section className={styles.cta}>
          <p className={styles.eyebrow}>{marca.nome}</p>
          <h2>{pagina.headline}</h2>
          <div className={styles.actions}>
            <Link href="/signup" className={styles.primary}>
              {ui.crear}
              <ArrowRight size={17} aria-hidden />
            </Link>
            <Link href="/precos" className={styles.secondary}>
              {ui.planes}
            </Link>
          </div>
          <p className={styles.trial}>{ui.prueba}</p>
        </section>

        <nav className={pais.bloco} aria-labelledby="otros-paises">
          <h2 id="otros-paises">{ui.otros}</h2>
          <ul className={pais.paises}>
            {PAGINAS_DE_PAIS.filter((p) => p.slug !== slug).map((p) => (
              <li key={p.slug}>
                <Link href={`/es/${p.slug}`} hrefLang={p.hreflang}>
                  {p.nome}
                  <ArrowRight size={16} aria-hidden />
                </Link>
              </li>
            ))}
            <li>
              <Link href="/" hrefLang="pt-BR">
                Brasil
                <ArrowRight size={16} aria-hidden />
              </Link>
            </li>
          </ul>
        </nav>
      </main>
      <RodapeDoSite nome={marca.nome} idioma="es" />
    </div>
  );
}
