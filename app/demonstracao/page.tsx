import { RodapeDoSite } from "@/components/site/RodapeDoSite";
import Link from "next/link";
import { notFound } from "next/navigation";
import { LogotipoDoProduto } from "@/components/branding/MarcaDoProduto";
import { Medidor } from "@/components/site/Medidor";
import styles from "@/components/site/solucoes.module.css";
import { instalacaoCobra } from "@/lib/billing/planos";
import { marcaDaSaida } from "@/lib/branding/saida";
import { env } from "@/lib/env";
import { INTERFACE_SEO as ui } from "@/lib/marketing/interface-seo";
import { jsonLdSeguro, metadadosPublicos, schemaDoVideo } from "@/lib/marketing/seo";
import { visitanteAtual } from "@/lib/mercado/visitante";

export const dynamic = "force-dynamic";
export async function generateMetadata() {
  const marca = await marcaDaSaida(null);
  return metadadosPublicos({
    nome: marca.nome,
    titulo: "Demonstração: atendimento WhatsApp, IA e CRM",
    descricao: ui.demoIntro,
    caminho: "/demonstracao",
    base: env.NEXT_PUBLIC_APP_URL,
    imagem: "/media/atenza/explainer-thumbnail.webp",
  });
}

export default async function Page() {
  if (!instalacaoCobra()) notFound();
  const [marca, visitante] = await Promise.all([marcaDaSaida(null), visitanteAtual()]);
  return (
    <div className={styles.page} lang="pt-BR">
      <Medidor idioma="pt-BR" moeda={visitante.mercado.moeda} dispositivo={visitante.dispositivo} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLdSeguro(schemaDoVideo(marca.nome, env.NEXT_PUBLIC_APP_URL)),
        }}
      />
      <a href="#conteudo" className={styles.skip}>
        {ui.skip}
      </a>
      <header className={styles.header}>
        <Link href="/" aria-label={marca.nome}>
          <LogotipoDoProduto nome={marca.nome} decorativo className={styles.logo} />
        </Link>
        <Link href="/#planos" className={styles.primary}>
          {ui.plans}
        </Link>
      </header>
      <main id="conteudo" className={styles.watch}>
        <p className={styles.eyebrow}>{marca.nome}</p>
        <h1>{ui.demo}</h1>
        <p className={styles.intro}>{ui.demoIntro}</p>
        <video
          controls
          playsInline
          preload="none"
          poster="/media/atenza/explainer-thumbnail.webp"
          aria-label={ui.video}
        >
          <source src="/media/atenza/atenza-explica.mp4" type="video/mp4" />
          <track
            src="/media/atenza/atenza-explica.vtt"
            kind="captions"
            srcLang="pt-BR"
            label={ui.language}
            default
          />
        </video>
        <div className={styles.actions}>
          <Link href="/#planos" className={styles.primary}>
            {ui.plans}
          </Link>
          <Link href="/contato" className={styles.secondary}>
            {ui.contact}
          </Link>
        </div>
        <p className={styles.trial}>{ui.trial}</p>
        <article>
          <h2>{ui.transcript}</h2>
          <p>{ui.demoP1.replace("o produto", `o ${marca.nome}`)}</p>
          <p>{ui.demoP2}</p>
          <p>{ui.demoP3}</p>
          <p>{ui.demoP4}</p>
        </article>
      </main>
      <RodapeDoSite nome={marca.nome} />
    </div>
  );
}
