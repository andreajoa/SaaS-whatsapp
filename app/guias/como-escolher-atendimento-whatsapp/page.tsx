import { PaginaDeSolucao, metadadosDaSolucao } from "@/components/site/PaginaDeSolucao";

export const dynamic = "force-dynamic";
export async function generateMetadata() {
  return metadadosDaSolucao("guias/como-escolher-atendimento-whatsapp");
}
export default function Page() {
  return <PaginaDeSolucao slug="guias/como-escolher-atendimento-whatsapp" />;
}
