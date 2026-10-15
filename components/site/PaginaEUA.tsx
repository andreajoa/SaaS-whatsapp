import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowRight,
  Bot,
  Check,
  CircleDollarSign,
  Clock3,
  CreditCard,
  Lock,
  MessagesSquare,
  Play,
  Repeat2,
  ShieldCheck,
  Users,
  X,
} from "lucide-react";

import { CabecalhoDoSite } from "@/components/site/CabecalhoDoSite";
import { Medidor } from "@/components/site/Medidor";
import { RodapeDoSite } from "@/components/site/RodapeDoSite";
import { VideoExplicativo } from "@/components/site/VideosDaHome";
import homeStyles from "@/components/site/atenza-home.module.css";
import { instalacaoCobra, ORDEM_DOS_PLANOS, PLANOS, precoDoPlano } from "@/lib/billing/planos";
import { marcaDaSaida } from "@/lib/branding/saida";
import { env } from "@/lib/env";
import { caminhoDaPagina, PAGINAS_DE_PAIS } from "@/lib/marketing/paises-seo";
import { jsonLdSeguro, metadadosPublicos, schemaDaPagina, schemaDoFaq } from "@/lib/marketing/seo";
import { schemaDoSoftware } from "@/lib/marketing/schema-do-produto";
import { transcricaoDoVideo, videoDaApresentacao } from "@/lib/marketing/video";
import {
  MERCADO_INTERNACIONAL,
  moedasCobraveis,
  precoNoMercado,
  precoLegivelNoMercado,
} from "@/lib/mercado/paises";
import { textoDoSite } from "@/lib/mercado/textos";
import { visitanteAtual } from "@/lib/mercado/visitante";
import styles from "./eua.module.css";

/**
 * A PÁGINA DOS ESTADOS UNIDOS — escrita no padrão de landing page de SaaS
 * americano, não traduzida da brasileira:
 *
 *  - herói com o RESULTADO na manchete ("Never miss…"), dois CTAs acima da
 *    dobra e a microcópia que derruba objeção na hora (cancel anytime);
 *  - faixa de confiança logo abaixo (o americano procura "is it legit?");
 *  - benefícios em blocos curtos com ícone, "How it works" em 3 passos;
 *  - comparação "Without / With" — o formato que a página americana usa
 *    para mostrar o custo de não agir;
 *  - preço transparente com "Most popular", FAQ que mata objeção e um CTA
 *    final cheio; barra fixa de CTA no celular.
 *
 * Tom: "you", frases curtas, resultado e tempo economizado. Nada de número
 * de resultado ou depoimento inventado.
 */

const CAMINHO = "/us";

const FAQ = [
  {
    question: "Do I need a developer to set it up?",
    answer:
      "No. You connect your business number through the official WhatsApp Business API with a guided flow, add your prices and FAQs, and the AI agent starts answering.",
  },
  {
    question: "Will my WhatsApp number change?",
    answer:
      "No. You keep your business number; we connect it to the official WhatsApp Business API.",
  },
  {
    question: "Is the AI included in the price?",
    answer:
      "You plug in your own AI key (OpenAI, Claude, Gemini or OpenRouter) and pay the provider directly, with no markup from us. We have a 10-minute step-by-step guide for each provider.",
  },
  {
    question: "Can I cancel anytime?",
    answer:
      "Yes. No contracts. The first 7 days are free, and you can cancel in one click from your billing page.",
  },
  {
    question: "Does it work with the regular WhatsApp Business app?",
    answer:
      "It uses the official WhatsApp Business API (Meta Cloud API), which is built for teams and automation — so several people and an AI agent can answer the same number safely.",
  },
  {
    question: "What happens to my customers' data?",
    answer:
      "Each company's data is isolated, access is logged, and you can export or anonymize a contact on request. A data processing agreement is available.",
  },
];

export async function metadadosDosEUA() {
  if (!instalacaoCobra()) return { robots: { index: false, follow: false } };
  const marca = await marcaDaSaida(null);
  const base = env.NEXT_PUBLIC_APP_URL;
  const meta = metadadosPublicos({
    nome: marca.nome,
    titulo: "WhatsApp AI agent & shared inbox for small businesses",
    descricao:
      "Answer every WhatsApp lead in seconds, 24/7. An AI agent trained on your business, a shared inbox for your team and a sales pipeline. 7-day free trial, cancel anytime.",
    caminho: CAMINHO,
    base,
    idioma: "en",
  });
  return {
    ...meta,
    alternates: {
      ...meta.alternates,
      languages: {
        ...Object.fromEntries(
          PAGINAS_DE_PAIS.map((p) => [p.hreflang, new URL(caminhoDaPagina(p), base).toString()]),
        ),
        "pt-BR": new URL("/", base).toString(),
        en: new URL("/en", base).toString(),
      },
    },
    openGraph: { ...meta.openGraph, locale: "en_US" },
  };
}

export async function PaginaEUA() {
  if (!instalacaoCobra()) notFound();
  const [marca, visitante] = await Promise.all([marcaDaSaida(null), visitanteAtual()]);
  const base = env.NEXT_PUBLIC_APP_URL;
  const nome = marca.nome;
  const mercado = MERCADO_INTERNACIONAL;
  const cobravel = moedasCobraveis().has(mercado.moeda);
  const vendidos = ORDEM_DOS_PLANOS.filter((p) => precoDoPlano(p) !== null);
  const video = videoDaApresentacao("en");
  const transcricao = transcricaoDoVideo(video);
  const t = (texto: string) => textoDoSite(texto, "en");

  const paginaSchema = schemaDaPagina(
    nome,
    base,
    CAMINHO,
    "WhatsApp AI agent & shared inbox for small businesses",
    "Answer every WhatsApp lead in seconds, 24/7.",
    marca.logoUrl,
  );
  const dados = {
    ...paginaSchema,
    "@graph": [
      ...paginaSchema["@graph"],
      {
        ...schemaDoSoftware(nome, base),
        "@id": `${new URL(CAMINHO, base).toString()}#software`,
        inLanguage: "en-US",
        applicationSubCategory: "WhatsApp CRM and customer support",
        description:
          "Shared WhatsApp inbox with AI agents trained on your business, human handoff and a sales pipeline.",
        featureList: undefined,
        areaServed: { "@type": "Country", name: "United States" },
        offers: cobravel
          ? vendidos.map((p) => ({
              "@type": "Offer",
              name: PLANOS[p].nome,
              price: precoNoMercado(p, mercado) / 100,
              priceCurrency: "USD",
              url: new URL(CAMINHO, base).toString(),
            }))
          : undefined,
      },
      schemaDoFaq(base, CAMINHO, FAQ),
    ],
  };

  return (
    <div className={styles.pagina} lang="en-US">
      <Medidor idioma="en" moeda={visitante.mercado.moeda} dispositivo={visitante.dispositivo} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdSeguro(dados) }}
      />
      <CabecalhoDoSite nome={nome} idioma="en" />
      <main id="conteudo">
        {/* HERO — outcome headline, two CTAs above the fold, objection microcopy. */}
        <section className={styles.hero}>
          <div className={styles.heroTexto}>
            <p className={styles.pill}>
              <span aria-hidden>●</span> For businesses whose customers live on WhatsApp
            </p>
            <h1>Never miss a WhatsApp lead again.</h1>
            <p className={styles.sub}>
              {nome} answers every customer in seconds, 24/7, with your prices, hours and policies —
              and hands the conversation to your team when it matters.
            </p>
            <div className={styles.ctas}>
              <Link href="/signup" className={styles.primario} data-medir="cta-hero">
                Start your 7-day free trial
                <ArrowRight size={18} aria-hidden />
              </Link>
              <a href="#demo" className={styles.secundario}>
                <Play size={17} aria-hidden />
                Watch the 1-min demo
              </a>
            </div>
            <ul className={styles.micro}>
              <li>
                <Check size={15} aria-hidden /> Cancel anytime
              </li>
              <li>
                <Check size={15} aria-hidden /> No contracts
              </li>
              <li>
                <Check size={15} aria-hidden /> Keep your number
              </li>
            </ul>
          </div>
          <figure className={styles.heroVisual}>
            <Image
              src={video.poster}
              alt=""
              width={1600}
              height={900}
              priority
              sizes="(max-width: 900px) 100vw, 50vw"
            />
          </figure>
        </section>

        {/* TRUST STRIP — "is it legit?" answered right under the fold. */}
        <ul className={styles.confianca}>
          <li>
            <ShieldCheck size={18} aria-hidden /> Official WhatsApp Business API
          </li>
          <li>
            <Lock size={18} aria-hidden /> Secure checkout by Stripe
          </li>
          <li>
            <Bot size={18} aria-hidden /> Your AI, your key — no markup
          </li>
          <li>
            <CreditCard size={18} aria-hidden /> 7 days free · cancel in one click
          </li>
        </ul>

        {/* PROBLEM — the cost of doing nothing. */}
        <section className={styles.problema}>
          <h2>It&apos;s 11:47 PM. A customer asks for your price. Who answers?</h2>
          <p>
            About 1 in 3 U.S. adults uses WhatsApp — and nearly half of Hispanic Americans do. If
            your customers message you there, they text three businesses at once and buy from
            whoever replies first. When your WhatsApp lives on one phone, leads go cold while you
            sleep, while you&apos;re with another customer, or while nobody knows who&apos;s
            supposed to reply.
          </p>
        </section>

        {/* WHO IT'S FOR — WhatsApp is not the default channel in the U.S.; say
            plainly which businesses it fits, so the right visitor self-selects. */}
        <section className={styles.bloco}>
          <h2>Built for U.S. businesses that sell on WhatsApp</h2>
          <ul className={styles.paraQuem}>
            {[
              [
                "Hispanic & Latino customers",
                "Clinics, dentists, law offices, insurance, auto shops and real estate serving Spanish-speaking families.",
              ],
              [
                "Immigrant communities",
                "Businesses serving Brazilian, Indian, Caribbean and other communities that live on WhatsApp.",
              ],
              [
                "International clients",
                "Travel, education, import/export and services with customers outside the U.S.",
              ],
              [
                "English and Spanish",
                "Teach the agent in both languages and let it answer each customer in theirs.",
              ],
            ].map(([titulo, texto]) => (
              <li key={titulo}>
                <strong>{titulo}</strong>
                <span>{texto}</span>
              </li>
            ))}
          </ul>
          <p className={styles.fonte}>Source: Pew Research Center, 2025 survey of U.S. adults.</p>
        </section>

        {/* BENEFITS — short blocks with icons. */}
        <section className={styles.beneficios}>
          {[
            {
              icone: Clock3,
              titulo: "Instant replies, 24/7",
              texto:
                "The AI agent answers prices, stock, hours and shipping in seconds — nights and weekends included.",
            },
            {
              icone: Users,
              titulo: "One number, your whole team",
              texto:
                "A shared inbox with history and assignments. Nobody answers twice, nobody gets forgotten.",
            },
            {
              icone: Repeat2,
              titulo: "Follow-ups that close deals",
              texto:
                "Automatic follow-ups re-engage leads who went quiet, on the schedule you choose.",
            },
            {
              icone: MessagesSquare,
              titulo: "Human handoff with context",
              texto:
                "When a customer needs a person, your team takes over with the full conversation in front of them.",
            },
            {
              icone: CircleDollarSign,
              titulo: "A pipeline you can see",
              texto:
                "Every conversation becomes a deal in a visual pipeline, from first message to paid.",
            },
            {
              icone: Bot,
              titulo: "Trained on your business",
              texto:
                "Upload your prices, FAQs and policies. The agent only answers with what you taught it.",
            },
          ].map((b) => (
            <article key={b.titulo}>
              <b.icone size={22} aria-hidden />
              <h3>{b.titulo}</h3>
              <p>{b.texto}</p>
            </article>
          ))}
        </section>

        {/* DEMO */}
        {transcricao && (
          <section id="demo" className={styles.bloco}>
            <h2>See it in under a minute</h2>
            <VideoExplicativo
              arquivo={video}
              className={homeStyles.explainerCard}
              textos={{
                titulo: "See it in under a minute",
                descricao: "A tour of the inbox, the AI and the pipeline in under a minute.",
                fechar: "Close video",
                legendas: "English",
                transcricao: "Read the transcript",
                indisponivel: "The video didn't load. You can read the transcript below.",
                paragrafo1: transcricao[0],
                paragrafo2: transcricao[1],
                paragrafo3: transcricao[2],
                paragrafo4: transcricao[3],
              }}
            >
              <Image src={video.poster} alt="" fill sizes="(max-width: 900px) 100vw, 1100px" />
              <span className={homeStyles.playCircle}>
                <Play size={27} fill="currentColor" aria-hidden />
              </span>
            </VideoExplicativo>
          </section>
        )}

        {/* HOW IT WORKS */}
        <section className={styles.bloco}>
          <h2>Up and running in 3 steps</h2>
          <ol className={styles.passos}>
            <li>
              <span>1</span>
              <strong>Create your account</strong>
              <p>Sign up online in minutes. No sales call.</p>
            </li>
            <li>
              <span>2</span>
              <strong>Connect WhatsApp</strong>
              <p>
                Link your business number through the official API. Same number, nothing changes for
                customers.
              </p>
            </li>
            <li>
              <span>3</span>
              <strong>Teach your agent</strong>
              <p>
                Add your prices, hours and FAQs, plug in your AI key{" "}
                <Link href="/en/help/ai-key">(10-minute guide)</Link> and go live.
              </p>
            </li>
          </ol>
        </section>

        {/* WITHOUT / WITH */}
        <section className={styles.bloco}>
          <h2>
            Without {nome} vs. with {nome}
          </h2>
          <div className={styles.comparacao}>
            <div>
              <h3>Without</h3>
              <ul>
                {[
                  "Replies hours later — the lead already bought elsewhere",
                  "One phone passed around the team",
                  "No idea who answered what",
                  "Quotes sent and never followed up",
                ].map((x) => (
                  <li key={x}>
                    <X size={16} aria-hidden /> {x}
                  </li>
                ))}
              </ul>
            </div>
            <div data-com="true">
              <h3>With {nome}</h3>
              <ul>
                {[
                  "Answers in seconds, day and night",
                  "Your whole team on one number",
                  "Full history and clear ownership",
                  "Automatic follow-ups until the deal closes",
                ].map((x) => (
                  <li key={x}>
                    <Check size={16} aria-hidden /> {x}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* PRICING */}
        {cobravel && vendidos.length > 0 && (
          <section id="pricing" className={styles.bloco}>
            <h2>Simple pricing. No surprises.</h2>
            <p className={styles.centro}>7 days free on every plan. Cancel anytime.</p>
            <div className={styles.planos}>
              {vendidos.map((p) => (
                <article key={p} data-destaque={p === "pro" ? "true" : undefined}>
                  {p === "pro" && <span className={styles.selo}>Most popular</span>}
                  <h3>{t(PLANOS[p].nome)}</h3>
                  <p className={styles.preco}>
                    {precoLegivelNoMercado(p, mercado)}
                    <small>/month</small>
                  </p>
                  <ul>
                    {PLANOS[p].destaques.map((d) => (
                      <li key={d}>
                        <Check size={16} aria-hidden /> {t(d)}
                      </li>
                    ))}
                  </ul>
                  <Link
                    href="/signup"
                    className={p === "pro" ? styles.primario : styles.secundario}
                    data-medir={`plano-${p}`}
                  >
                    Start free trial
                  </Link>
                </article>
              ))}
            </div>
          </section>
        )}

        {/* FAQ */}
        <section className={styles.bloco}>
          <h2>Frequently asked questions</h2>
          <div className={styles.faq}>
            {FAQ.map((f) => (
              <details key={f.question}>
                <summary>{f.question}</summary>
                <p>{f.answer}</p>
              </details>
            ))}
          </div>
        </section>

        {/* FINAL CTA */}
        <section className={styles.final}>
          <h2>Start answering every lead today.</h2>
          <p>7-day free trial. Cancel anytime. Keep your WhatsApp number.</p>
          <Link href="/signup" className={styles.primarioClaro} data-medir="cta-final">
            Start your free trial
            <ArrowRight size={18} aria-hidden />
          </Link>
        </section>
      </main>

      {/* Sticky CTA on mobile — the US pattern for long landing pages. */}
      <div className={styles.barraFixa}>
        <Link href="/signup" className={styles.primario}>
          Start free trial
        </Link>
      </div>
      <RodapeDoSite nome={nome} idioma="en" />
    </div>
  );
}
