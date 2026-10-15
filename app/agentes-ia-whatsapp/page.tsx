import { PaginaDeSolucao, metadadosDaSolucao } from "@/components/site/PaginaDeSolucao";

export const dynamic = "force-dynamic";
export async function generateMetadata() {
  return metadadosDaSolucao("agentes-ia-whatsapp");
}
export default function Page() {
  return <PaginaDeSolucao slug="agentes-ia-whatsapp" />;
}
