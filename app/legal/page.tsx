import type { Metadata } from "next";
import Link from "next/link";

import { DOCUMENTOS_LEGAIS, frase } from "@/lib/legal/documentos";
import { resolverOperador } from "@/lib/legal/operador";
import { textoDoSite } from "@/lib/mercado/textos";
import { visitanteAtual } from "@/lib/mercado/visitante";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Documentos" };

/**
 * O índice dos documentos legais.
 *
 * Existe para que o rodapé da vitrine tenha UM link em vez de oito, e para que
 * quem procura "a política de reembolso" ache a página sem adivinhar o slug.
 * Os dois documentos antigos (`terms`, `privacy`) entram na lista à mão porque
 * eles são `.tsx` escritos antes desta estrutura — trocá-los de forma agora
 * seria reescrever contrato publicado por um ganho de arrumação.
 */
export default async function LegalIndexPage() {
  const { idioma } = await visitanteAtual();
  const op = await resolverOperador();
  const t = (texto: string) => textoDoSite(texto, idioma);
  const nomes = {
    sistema: op.sistema,
    operador: op.razaoSocial ?? op.nome ?? t("o operador desta instalação"),
  };

  const antigos = [
    { href: "/legal/terms", titulo: t("Termos de uso"), resumo: t("As regras de uso do sistema.") },
    {
      href: "/legal/privacy",
      titulo: t("Política de Privacidade"),
      resumo: t("Quais dados são tratados, por quanto tempo e quais são os seus direitos."),
    },
  ];

  return (
    <>
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">{t("Documentos")}</h1>
        <p className="text-muted-foreground">
          {t(
            "Transparência sobre como este sistema trata o seu dinheiro, os seus dados e o número da sua empresa.",
          )}
        </p>
      </header>

      <ul className="space-y-3">
        {antigos.map((doc) => (
          <li key={doc.href}>
            <Link
              href={doc.href}
              className="block rounded-md border p-4 transition-colors hover:bg-muted/50"
            >
              <span className="font-medium">{doc.titulo}</span>
              <span className="mt-1 block text-muted-foreground">{doc.resumo}</span>
            </Link>
          </li>
        ))}
        {DOCUMENTOS_LEGAIS.map((doc) => (
          <li key={doc.slug}>
            <Link
              href={`/legal/${doc.slug}`}
              className="block rounded-md border p-4 transition-colors hover:bg-muted/50"
            >
              <span className="font-medium">{frase(doc.titulo, idioma, nomes)}</span>
              <span className="mt-1 block text-muted-foreground">
                {frase(doc.resumo, idioma, nomes)}
              </span>
            </Link>
          </li>
        ))}
      </ul>

      <p className="text-muted-foreground">
        {t("Ficou com dúvida sobre qualquer um destes pontos?")}{" "}
        <Link href="/contato" className="underline underline-offset-2">
          {t("Fale com a gente")}
        </Link>
        .
      </p>
    </>
  );
}
