import { PaginaDeSolucao, metadadosDaSolucao } from "@/components/site/PaginaDeSolucao";

export const dynamic = "force-dynamic";
export async function generateMetadata() {
  return metadadosDaSolucao("crm-whatsapp");
}
export default function Page() {
  return <PaginaDeSolucao slug="crm-whatsapp" />;
}
