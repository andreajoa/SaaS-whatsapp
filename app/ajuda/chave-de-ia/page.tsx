import { metadadosDaChave, PaginaDaChave } from "@/components/ajuda/PaginaDaChave";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  return metadadosDaChave("pt-BR");
}

export default function Page() {
  return <PaginaDaChave idioma="pt-BR" />;
}
