import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, Check, Play, ShieldCheck, X } from "lucide-react";

import { VideoExplicativo } from "@/components/site/VideosDaHome";
import homeStyles from "@/components/site/atenza-home.module.css";

import { CabecalhoDoSite } from "@/components/site/CabecalhoDoSite";
import { Medidor } from "@/components/site/Medidor";
import { RodapeDoSite } from "@/components/site/RodapeDoSite";
import { instalacaoCobra, ORDEM_DOS_PLANOS, PLANOS, precoDoPlano } from "@/lib/billing/planos";
import { marcaDaSaida } from "@/lib/branding/saida";
import { env } from "@/lib/env";
import { MOLDES_DOS_PAISES, type Molde } from "@/lib/marketing/paises-moldes";
import { transcricaoDoVideo, videoDaApresentacao } from "@/lib/marketing/video";
import { caminhoDaPagina, PAGINAS_DE_PAIS, paginaDePais } from "@/lib/marketing/paises-seo";
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

type Bloco =
  | "faixa"
  | "confianca"
  | "dores"
  | "passos"
  | "comparacao"
  | "leitura"
  | "precos"
  | "faq"
  | "fatos"
  | "privacidade";

/**
 * A ORDEM é a psicologia do molde (ver lib/marketing/paises-moldes.ts): o
 * argentino vê o preço logo de saída; o espanhol, as garantias; o mexicano,
 * a dor antes de qualquer número.
 */
const ORDEM_DO_MOLDE: Record<Molde, readonly Bloco[]> = {
  calido: ["confianca", "dores", "passos", "leitura", "precos", "faq"],
  directo: ["faixa", "comparacao", "dores", "leitura", "precos", "faq"],
  corporativo: ["confianca", "passos", "comparacao", "dores", "leitura", "precos", "faq"],
  sobrio: ["confianca", "dores", "passos", "leitura", "precos", "faq"],
  // Alemanha: fatos e proteção de dados ANTES de qualquer apelo — o leitor
  // alemão decide pela especificação e pela conformidade, não pela emoção.
  sachlich: ["fatos", "privacidade", "dores", "passos", "leitura", "precos", "faq"],
};

export async function metadadosDoPais(slug: string) {
  const pagina = paginaDePais(slug);
  if (!pagina || !instalacaoCobra()) return { robots: { index: false, follow: false } };
  const marca = await marcaDaSaida(null);
  const base = env.NEXT_PUBLIC_APP_URL;
  const meta = metadadosPublicos({
    nome: marca.nome,
    titulo: pagina.title,
    descricao: pagina.description,
    caminho: caminhoDaPagina(pagina),
    base,
    idioma: pagina.idioma === "de" ? "en" : "es",
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
          PAGINAS_DE_PAIS.map((p) => [p.hreflang, new URL(caminhoDaPagina(p), base).toString()]),
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
  const caminho = caminhoDaPagina(pagina);
  // O site tem pt, es e en. A página alemã usa cabeçalho e rodapé em inglês —
  // o mais próximo do que o visitante alemão lê sem esforço.
  const idiomaDoSite = pagina.idioma === "de" ? "en" : "es";
  const ui = pagina.ui;
  const molde = MOLDES_DOS_PAISES[slug] ?? { molde: "sobrio" as Molde, confianca: [] };
  const ordem = ORDEM_DO_MOLDE[molde.molde];

  // O preço do país só aparece quando o checkout consegue cobrá-lo naquela
  // moeda. Mostrar MXN e cobrar BRL é exatamente o erro que esta guarda evita.
  const mercado = mercadoDoPais(pagina.pais);
  const cobravel = moedasCobraveis().has(mercado.moeda);
  const vendidos = ORDEM_DOS_PLANOS.filter((p) => precoDoPlano(p) !== null);
  const primeiro = vendidos[0] ?? null;
  // O vídeo do país, com a voz e o sotaque de lá. Sem versão local publicada,
  // a seção não aparece e o botão do herói leva à demonstração geral.
  const apresentacao = videoDaApresentacao(pagina.idioma ?? "es", pagina.pais);
  const transcricao = transcricaoDoVideo(apresentacao);
  const temVideo = transcricao !== null;
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
  const t = (texto: string) => textoDoSite(texto, idiomaDoSite);

  return (
    <div className={`${styles.page} ${pais.raiz}`} data-molde={molde.molde} lang={pagina.hreflang}>
      <Medidor
        idioma={pagina.idioma ?? "es"}
        moeda={visitante.mercado.moeda}
        dispositivo={visitante.dispositivo}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdSeguro(dados) }}
      />
      <a href="#conteudo" className={styles.skip}>
        {ui.saltar ?? "Saltar al contenido"}
      </a>
      <CabecalhoDoSite nome={marca.nome} idioma={idiomaDoSite} />
      <main id="conteudo">
        <div className={pais.banda}>
          <section className={styles.hero}>
            <div>
              <nav className={styles.breadcrumb} aria-label={ui.ruta ?? "Ruta"}>
                <Link href={`/${idiomaDoSite}`}>{marca.nome}</Link>
                <span aria-hidden>/</span>
                <span>{pagina.nome}</span>
              </nav>
              <p className={styles.eyebrow}>
                {marca.nome} {pagina.eyebrow.toLowerCase()}
              </p>
              <h1>{pagina.headline}</h1>
              <p className={styles.intro}>{pagina.intro.replaceAll("{marca}", marca.nome)}</p>
              <div className={styles.actions}>
                <Link href="/signup" className={styles.primary} data-medir="pais-crear">
                  {ui.crear}
                  <ArrowRight size={17} aria-hidden />
                </Link>
                <Link href={temVideo ? "#video" : "/demonstracao"} className={styles.secondary}>
                  <Play size={17} aria-hidden />
                  {ui.video}
                </Link>
              </div>
              <p className={styles.trial}>{ui.prueba}</p>
            </div>
            {molde.conversa ? (
              <figure className={pais.conversa} aria-label="Conversación de ejemplo">
                <figcaption className={pais.conversaTopo}>
                  <span className={pais.avatar} aria-hidden>
                    {(molde.negocio ?? marca.nome).slice(0, 1)}
                  </span>
                  <span>
                    <strong>{molde.negocio}</strong>
                    <small>Agente de IA · en línea</small>
                  </span>
                </figcaption>
                <ol>
                  {molde.conversa.map((m, i) => (
                    <li key={i} data-de={m.de}>
                      {m.texto}
                    </li>
                  ))}
                </ol>
                <p className={pais.conversaNota}>Ejemplo ilustrativo</p>
              </figure>
            ) : molde.painel ? (
              <figure className={pais.painel} aria-label="Panel de ejemplo">
                <figcaption>
                  <strong>{molde.painel.titulo}</strong>
                  <small>Ejemplo ilustrativo</small>
                </figcaption>
                <ul>
                  {molde.painel.linhas.map((l) => (
                    <li key={l.cliente}>
                      <span className={pais.painelAvatar} aria-hidden>
                        {l.cliente.slice(0, 1)}
                      </span>
                      <span>
                        <strong>{l.cliente}</strong>
                        <small>{l.assunto}</small>
                      </span>
                      <em data-tom={l.tom}>{l.estado}</em>
                    </li>
                  ))}
                </ul>
              </figure>
            ) : (
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
            )}
          </section>
        </div>

        {temVideo && transcricao && (
          <section id="video" className={pais.bloco} aria-labelledby="video-titulo">
            <h2 id="video-titulo">{ui.video}</h2>
            <VideoExplicativo
              arquivo={apresentacao}
              className={homeStyles.explainerCard}
              textos={{
                titulo: ui.video,
                descricao: pagina.description,
                fechar: pagina.idioma === "de" ? "Video schließen" : "Cerrar video",
                legendas: pagina.idioma === "de" ? "Deutsch" : "Español",
                transcricao: pagina.idioma === "de" ? "Text lesen" : "Leer la transcripción",
                indisponivel:
                  pagina.idioma === "de"
                    ? "Das Video konnte nicht geladen werden. Den Text finden Sie unten."
                    : "El video no cargó. Puede leer la transcripción abajo.",
                paragrafo1: transcricao[0],
                paragrafo2: transcricao[1],
                paragrafo3: transcricao[2],
                paragrafo4: transcricao[3],
              }}
            >
              <Image
                src={apresentacao.poster}
                alt=""
                fill
                sizes="(max-width: 900px) 100vw, 1100px"
              />
              <span className={homeStyles.playCircle}>
                <Play size={27} fill="currentColor" aria-hidden />
              </span>
            </VideoExplicativo>
          </section>
        )}

        {ordem.map((bloco) => {
          switch (bloco) {
            case "faixa":
              return molde.faixa ? (
                <p key={bloco} className={pais.faixa}>
                  {cobravel && primeiro && (
                    <strong>
                      {PLANOS[primeiro].nome} {precoLegivelNoMercado(primeiro, mercado)}
                      {ui.mes}
                    </strong>
                  )}
                  <span>{molde.faixa}</span>
                </p>
              ) : null;
            case "confianca":
              return (
                <ul
                  key={bloco}
                  className={pais.confianca}
                  aria-label={ui.ruta ? "Garantien" : "Garantías"}
                >
                  {molde.confianca.map((c) => (
                    <li key={c}>
                      <ShieldCheck size={18} aria-hidden />
                      {c}
                    </li>
                  ))}
                </ul>
              );
            case "dores":
              return (
                <section key={bloco} className={pais.bloco} aria-labelledby="dolores">
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
              );
            case "passos":
              return molde.passos ? (
                <section key={bloco} className={pais.bloco} aria-labelledby="pasos">
                  <h2 id="pasos">{molde.passos.titulo}</h2>
                  <ol className={pais.passos}>
                    {molde.passos.itens.map((it, i) => (
                      <li key={it.titulo}>
                        <span className={pais.numero}>{i + 1}</span>
                        <strong>{it.titulo}</strong>
                        <p>{it.texto}</p>
                      </li>
                    ))}
                  </ol>
                </section>
              ) : null;
            case "comparacao":
              return molde.comparacao ? (
                <section key={bloco} className={pais.bloco} aria-labelledby="comparacion">
                  <h2 id="comparacion">
                    {molde.comparacao.titulo.replaceAll("{marca}", marca.nome)}
                  </h2>
                  <div className={pais.tabelaRolagem}>
                    <table className={pais.tabela}>
                      <thead>
                        <tr>
                          <th scope="col">{molde.comparacao.sin}</th>
                          <th scope="col">{molde.comparacao.con}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {molde.comparacao.linhas.map((l) => (
                          <tr key={l.sin}>
                            <td>
                              <X size={16} aria-hidden />
                              {l.sin}
                            </td>
                            <td>
                              <Check size={16} aria-hidden />
                              {l.con}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              ) : null;
            case "leitura":
              return (
                <div key={bloco} className={pais.leitura}>
                  {pagina.sections.map((sec) => (
                    <section key={sec.title} className={styles.chapter}>
                      <h2>{sec.title}</h2>
                      {sec.paragraphs.map((p) => (
                        <p key={p}>{p}</p>
                      ))}
                      {sec.bullets && (
                        <ul>
                          {sec.bullets.map((b) => (
                            <li key={b}>{b}</li>
                          ))}
                        </ul>
                      )}
                    </section>
                  ))}
                </div>
              );
            case "precos":
              return cobravel && vendidos.length > 0 ? (
                <section key={bloco} className={pais.bloco} aria-labelledby="precios">
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
              ) : null;
            case "fatos":
              return molde.fatos ? (
                <section key={bloco} className={pais.bloco} aria-labelledby="fakten">
                  <h2 id="fakten">{molde.fatos.titulo}</h2>
                  <div className={pais.tabelaRolagem}>
                    <table className={pais.tabela}>
                      <tbody>
                        {molde.fatos.linhas.map((l) => (
                          <tr key={l.rotulo}>
                            <th scope="row">{l.rotulo}</th>
                            <td>{l.valor}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              ) : null;
            case "privacidade":
              return molde.privacidade ? (
                <section key={bloco} className={pais.bloco} aria-labelledby="datenschutz">
                  <div className={pais.privacidade}>
                    <h2 id="datenschutz">{molde.privacidade.titulo}</h2>
                    <ul>
                      {molde.privacidade.itens.map((it) => (
                        <li key={it}>
                          <ShieldCheck size={18} aria-hidden />
                          {it}
                        </li>
                      ))}
                    </ul>
                    <p className={pais.links}>
                      {molde.privacidade.links.map((l) => (
                        <Link key={l.href} href={l.href}>
                          {l.rotulo}
                          <ArrowRight size={15} aria-hidden />
                        </Link>
                      ))}
                    </p>
                  </div>
                </section>
              ) : null;
            case "faq":
              return (
                <section key={bloco} className={pais.bloco} aria-labelledby="preguntas">
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
              );
          }
        })}

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
                <Link href={caminhoDaPagina(p)} hrefLang={p.hreflang}>
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
      <RodapeDoSite nome={marca.nome} idioma={idiomaDoSite} />
    </div>
  );
}
