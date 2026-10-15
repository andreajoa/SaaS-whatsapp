import { PaginaDeSolucao, metadadosDaSolucao } from "@/components/site/PaginaDeSolucao";

export const dynamic = "force-dynamic";
export async function generateMetadata() {
  return metadadosDaSolucao("atendimento-whatsapp");
}
export default function Page() {
  return <PaginaDeSolucao slug="atendimento-whatsapp" />;
}
