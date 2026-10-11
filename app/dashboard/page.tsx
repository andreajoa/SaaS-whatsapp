import type { Metadata } from "next";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { PortaDoPainel } from "@/components/painel/PortaDoPainel";
import { PainelDoDono } from "@/components/painel/PainelDoDono";
import { COOKIE_DO_PAINEL, cookieVale, painelHabilitado } from "@/lib/painel/sessao";
import { lerPainel } from "@/lib/painel/funil";
import { marcaDaSaida } from "@/lib/branding/saida";
import { sairDoPainel } from "./actions";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Painel do proprietário",
  robots: { index: false, follow: false },
};
export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  if (!painelHabilitado()) notFound();
  const jar = await cookies();
  const cookie = jar.get(COOKIE_DO_PAINEL)?.value;
  // Nenhuma leitura de dados do operador ou branding administrativo antecede o guard.
  if (!cookieVale(cookie)) return <PortaDoPainel />;
  const params = await searchParams;
  const pedido = Number(Array.isArray(params.dias) ? params.dias[0] : params.dias);
  const dias = [7, 30, 90].includes(pedido) ? pedido : 7;
  const [painel, marca] = await Promise.all([lerPainel({ dias, cookie }), marcaDaSaida(null)]);
  return <PainelDoDono painel={painel} dias={dias} nome={marca.nome} sair={sairDoPainel} />;
}
