import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { LogotipoDoProduto } from "@/components/branding/MarcaDoProduto";
import { MegaMenu } from "@/components/site/MegaMenu";
import { ORDEM_DOS_PLANOS, precoDoPlano } from "@/lib/billing/planos";
import { montarMenu } from "@/lib/marketing/menu";
import type { IdiomaDoSite } from "@/lib/mercado/paises";
import { textoDoSite } from "@/lib/mercado/textos";
import styles from "./megamenu.module.css";

/**
 * O cabeçalho das páginas públicas de conteúdo (soluções, recursos, segmentos,
 * demonstração) — o mesmo menu da home, para que qualquer porta de entrada
 * leve a todo o resto sem voltar à página inicial.
 */
export function CabecalhoDoSite({
  nome,
  idioma = "pt-BR",
}: {
  readonly nome: string;
  readonly idioma?: IdiomaDoSite;
}) {
  const comPlanos = ORDEM_DOS_PLANOS.some((p) => precoDoPlano(p) !== null);
  const menu = montarMenu((texto) => textoDoSite(texto, idioma), comPlanos);
  return (
    <header className={styles.cabecalho}>
      <div className={styles.cabecalhoInterno}>
        <Link
          href={idioma === "pt-BR" ? "/" : `/${idioma}`}
          aria-label={nome}
          className={styles.logoLink}
        >
          <LogotipoDoProduto nome={nome} decorativo className="h-8 w-auto" />
        </Link>
        <MegaMenu menu={menu} />
        <div className={styles.acoes}>
          <Link href="/login" className={styles.entrar}>
            {menu.entrar}
          </Link>
          <Link href="/signup" className={styles.criar}>
            {menu.criarConta}
            <ArrowRight size={16} aria-hidden />
          </Link>
        </div>
      </div>
    </header>
  );
}
