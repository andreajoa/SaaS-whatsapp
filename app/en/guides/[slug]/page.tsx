import { notFound } from "next/navigation";

import { metadadosDoArtigo, PaginaDeArtigo } from "@/components/site/PaginaDeArtigo";
import { artigoPorCaminho } from "@/lib/marketing/artigos";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

/** Lista fechada: só os guias de `lib/marketing/artigos.ts` existem. */
export async function generateMetadata({ params }: Props) {
  return metadadosDoArtigo(`/en/guides/${(await params).slug}`);
}

export default async function Page({ params }: Props) {
  const caminho = `/en/guides/${(await params).slug}`;
  if (!artigoPorCaminho(caminho)) notFound();
  return <PaginaDeArtigo caminho={caminho} />;
}
