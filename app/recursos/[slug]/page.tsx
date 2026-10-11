import { notFound } from "next/navigation";

import { metadadosDaSolucao, PaginaDeSolucao } from "@/components/site/PaginaDeSolucao";
import { PAGES_SEO } from "@/lib/marketing/conteudo-seo";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

/** Lista fechada: só slugs de `PAGES_SEO` viram página; o resto é 404. */
function caminho(slug: string): string | null {
  const alvo = `recursos/${slug}`;
  return PAGES_SEO.some((p) => p.slug === alvo) ? alvo : null;
}

export async function generateMetadata({ params }: Props) {
  const alvo = caminho((await params).slug);
  return alvo ? metadadosDaSolucao(alvo) : { robots: { index: false, follow: false } };
}

export default async function Page({ params }: Props) {
  const alvo = caminho((await params).slug);
  if (!alvo) notFound();
  return <PaginaDeSolucao slug={alvo} />;
}
