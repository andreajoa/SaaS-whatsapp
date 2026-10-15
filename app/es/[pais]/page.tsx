import { notFound } from "next/navigation";

import { metadadosDoPais, PaginaDoPais } from "@/components/site/PaginaDoPais";
import { paginaEmEspanhol as paginaDePais } from "@/lib/marketing/paises-seo";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ pais: string }> };

/** Lista fechada: só os slugs de `PAGINAS_DE_PAIS` viram página; o resto é 404. */
export async function generateMetadata({ params }: Props) {
  const { pais } = await params;
  return paginaDePais(pais) ? metadadosDoPais(pais) : { robots: { index: false, follow: false } };
}

export default async function Page({ params }: Props) {
  const { pais } = await params;
  if (!paginaDePais(pais)) notFound();
  return <PaginaDoPais slug={pais} />;
}
