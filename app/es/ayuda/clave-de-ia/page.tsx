import { metadadosDaChave, PaginaDaChave } from "@/components/ajuda/PaginaDaChave";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  return metadadosDaChave("es");
}

export default function Page() {
  return <PaginaDaChave idioma="es" />;
}
