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
      {/*
        O cabeçalho ganha ar e hierarquia: título grande, resumo em corpo de
        texto e a data em letra miúda, separada por uma linha. Antes os três
        tinham praticamente o mesmo peso e a data — que é o dado que mais
        importa num documento legal, porque diz se o que se lê ainda vale —
        passava despercebida no meio.
      */}
      <header className="space-y-3 border-b border-border pb-8">
        <h1 className="text-3xl font-semibold tracking-tight text-text sm:text-4xl">
          {f(doc.titulo)}
        </h1>
        <p className="text-base leading-relaxed text-text-muted">{f(doc.resumo)}</p>
        <p className="font-mono text-xs text-text-subtle">
          {t("Atualizado em")} {doc.atualizadoEm}
        </p>
      </header>

      {doc.secoes.map((secao, i) => (
        <section key={`${doc.slug}-${i}`} className="space-y-3 scroll-mt-24">
          <h2 className="text-lg font-semibold text-text">{f(secao.titulo)}</h2>
          {secao.paragrafos.map((p, j) => (
            <p key={`p-${j}`}>{f(p)}</p>
          ))}
          {secao.itens ? (
            <ul className="list-disc space-y-1.5 pl-5 marker:text-accent">
              {secao.itens.map((item, j) => (
                <li key={`i-${j}`}>{f(item)}</li>
              ))}
            </ul>
          ) : null}
        </section>
      ))}

      <footer className="flex flex-wrap gap-x-6 gap-y-2 border-t border-border pt-6 text-sm">
        <Link href="/legal" className="link-sublinha text-text-muted hover:text-text">
          {t("Todos os documentos")}
        </Link>
        <Link href="/contato" className="link-sublinha text-text-muted hover:text-text">
          {t("Fale com a gente")}
        </Link>
      </footer>
    </>
  );
}
