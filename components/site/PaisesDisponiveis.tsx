import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

import { PLANOS } from "@/lib/billing/planos";
import { caminhoDaPagina, PAGINAS_DE_PAIS } from "@/lib/marketing/paises-seo";
import {
  MERCADO_PADRAO,
  mercadoDoPais,
  precoLegivelNoMercado,
  precoParaQuemCompara,
  type IdiomaDoSite,
} from "@/lib/mercado/paises";
import { textoDoSite } from "@/lib/mercado/textos";
import styles from "./paises-disponiveis.module.css";

/**
 * "Disponível em N países" — a vitrine internacional da home.
 *
 * Para o público brasileiro mostra o preço de LISTA de cada país ao lado do
 * nosso: são os preços oficiais de cada mercado (`lib/mercado/paises.ts`), e
 * o do Brasil é o menor. Em espanhol e inglês a seção só leva às páginas de
 * país — preço ali é o da página do país, na moeda que o checkout cobra.
 *
 * "Disponível", não "presente": diz que qualquer empresa desses países pode
 * assinar hoje, e não inventa cliente nem escritório.
 */
export function PaisesDisponiveis({ idioma }: { readonly idioma: IdiomaDoSite }) {
  const t = (texto: string) => textoDoSite(texto, idioma);
  const nomes = new Intl.DisplayNames([idioma], { type: "region" });
  const comPreco = idioma === "pt-BR";
  const total = PAGINAS_DE_PAIS.length + 2; // Brasil e França têm páginas próprias.

  return (
    <section className={styles.mundo} aria-labelledby="paises-disponiveis">
      <div className={styles.cabeca}>
        <p className={styles.selo}>
          {t("Disponível em")} {total} {t("países")}
        </p>
        <h2 id="paises-disponiveis">
          {t("A mesma plataforma que atende empresas no México, na Espanha e na Argentina.")}
        </h2>
        <p>
          {comPreco
            ? t(
                "Cada país tem página, idioma e preço do próprio mercado. Compare: aqui no Brasil, o mesmo plano sai pelo menor preço.",
              )
            : t("Cada país tem página, idioma e preço do próprio mercado.")}
        </p>
      </div>
      <ul className={styles.paises}>
        <li data-casa="true">
          <span className={styles.codigo}>BR</span>
          <strong>{nomes.of("BR")}</strong>
          {comPreco && (
            <span className={styles.preco}>
              {PLANOS.essencial.nome} {precoLegivelNoMercado("essencial", MERCADO_PADRAO)}
              {t("/mês")}
            </span>
          )}
          {comPreco && <span className={styles.menor}>{t("Menor preço")}</span>}
        </li>
        {PAGINAS_DE_PAIS.map((p) => {
          const mercado = mercadoDoPais(p.pais);
          return (
            <li key={p.slug}>
              <Link href={caminhoDaPagina(p)} hrefLang={p.hreflang}>
                <span className={styles.codigo}>{p.pais}</span>
                <strong>{nomes.of(p.pais)}</strong>
                {comPreco && (
                  <span className={styles.preco}>
                    {PLANOS.essencial.nome} {precoParaQuemCompara("essencial", mercado, "pt-BR")}
                    {t("/mês")}
                  </span>
                )}
                <ArrowUpRight size={17} aria-hidden className={styles.seta} />
              </Link>
            </li>
          );
        })}
        <li>
          <Link href="/fr" hrefLang="fr-FR">
            <span className={styles.codigo}>FR</span>
            <strong>{nomes.of("FR")}</strong>
            <span className={styles.preco} lang="fr">
              Français
            </span>
            <ArrowUpRight size={17} aria-hidden className={styles.seta} />
          </Link>
        </li>
      </ul>
    </section>
  );
}
