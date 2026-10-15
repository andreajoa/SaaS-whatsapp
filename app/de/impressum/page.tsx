import type { Metadata } from "next";
import Link from "next/link";

import { CabecalhoDoSite } from "@/components/site/CabecalhoDoSite";
import { RodapeDoSite } from "@/components/site/RodapeDoSite";
import styles from "@/components/site/solucoes.module.css";
import { marcaDaSaida } from "@/lib/branding/saida";
import { env } from "@/lib/env";
import { metadadosPublicos } from "@/lib/marketing/seo";

export const dynamic = "force-dynamic";

/**
 * Impressum (§ 5 DDG) da página alemã. Os dados vêm do operador; o endereço é
 * o da sede no Brasil, porque o serviço é 100% online. O nome do responsável
 * aparece AQUI e só aqui — exigência legal alemã, autorizada pelo operador
 * em 12/10/2026; o resto do site continua sem nomear pessoa.
 */
export async function generateMetadata(): Promise<Metadata> {
  const marca = await marcaDaSaida(null);
  return metadadosPublicos({
    nome: marca.nome,
    titulo: "Impressum",
    descricao: `Anbieterkennzeichnung von ${marca.nome} gemäß § 5 DDG.`,
    caminho: "/de/impressum",
    base: env.NEXT_PUBLIC_APP_URL,
    idioma: "en",
  });
}

export default async function Impressum() {
  const marca = await marcaDaSaida(null);
  return (
    <div className={styles.page} lang="de-DE">
      <CabecalhoDoSite nome={marca.nome} idioma="en" />
      <main id="conteudo" className={styles.reading} style={{ display: "block", paddingBlock: 56 }}>
        <article style={{ maxWidth: 720 }}>
          <h1>Impressum</h1>
          <h2>Angaben gemäß § 5 DDG</h2>
          <p>
            {marca.nome}
            <br />
            Rua Curitiba, 66
            <br />
            06413-695 Barueri – SP
            <br />
            Brasilien
          </p>
          <h2>Vertreten durch</h2>
          <p>André Almeida</p>
          <h2>Kontakt</h2>
          <p>
            E-Mail: <a href="mailto:info@atenza.online">info@atenza.online</a>
          </p>
          <h2>Online-Streitbeilegung</h2>
          <p>
            Wir sind nicht bereit und nicht verpflichtet, an Streitbeilegungsverfahren vor einer
            Verbraucherschlichtungsstelle teilzunehmen.
          </p>
          <h2>Datenschutz und rechtliche Dokumente</h2>
          <p>
            <Link href="/legal/dpa">Auftragsverarbeitung (AVV/DPA)</Link> ·{" "}
            <Link href="/legal/subprocessadores">Unterauftragsverarbeiter</Link> ·{" "}
            <Link href="/legal">Alle rechtlichen Dokumente</Link>
          </p>
        </article>
      </main>
      <RodapeDoSite nome={marca.nome} idioma="en" />
    </div>
  );
}
