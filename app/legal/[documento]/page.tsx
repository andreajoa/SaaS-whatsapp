import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { documentoPorSlug, frase } from "@/lib/legal/documentos";
import { resolverOperador } from "@/lib/legal/operador";
import { textoDoSite } from "@/lib/mercado/textos";
import { visitanteAtual } from "@/lib/mercado/visitante";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ documento: string }>;
}): Promise<Metadata> {
  const { documento } = await params;
  const doc = documentoPorSlug(documento);
  return { title: doc ? doc.titulo.pt : "Documentos" };
}

export default async function DocumentoLegalPage({
  params,
}: {
  params: Promise<{ documento: string }>;
}) {
  const { documento } = await params;
  const doc = documentoPorSlug(documento);
  if (!doc) notFound();

  const { idioma } = await visitanteAtual();
  const op = await resolverOperador();
  const t = (texto: string) => textoDoSite(texto, idioma);
  const nomes = {
    sistema: op.sistema,
    operador: op.razaoSocial ?? op.nome ?? t("o operador desta instalação"),
  };
  const f = (x: Parameters<typeof frase>[0]) => frase(x, idioma, nomes);

  return (
    <>
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">{f(doc.titulo)}</h1>
        <p className="text-muted-foreground">{f(doc.resumo)}</p>
        <p className="text-xs text-muted-foreground">
          {t("Atualizado em")} {doc.atualizadoEm}
        </p>
      </header>

      {doc.secoes.map((secao, i) => (
        <section key={`${doc.slug}-${i}`} className="space-y-2">
          <h2 className="text-base font-semibold">{f(secao.titulo)}</h2>
          {secao.paragrafos.map((p, j) => (
            <p key={`p-${j}`}>{f(p)}</p>
          ))}
          {secao.itens ? (
            <ul className="list-disc space-y-1 pl-5">
              {secao.itens.map((item, j) => (
                <li key={`i-${j}`}>{f(item)}</li>
              ))}
            </ul>
          ) : null}
        </section>
      ))}

      <footer className="border-t pt-4 text-muted-foreground">
        <Link href="/legal" className="underline underline-offset-2">
          {t("Todos os documentos")}
        </Link>
        {" · "}
        <Link href="/contato" className="underline underline-offset-2">
          {t("Fale com a gente")}
        </Link>
      </footer>
    </>
  );
}
