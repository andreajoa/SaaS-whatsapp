import { metadadosDaChave, PaginaDaChave } from "@/components/ajuda/PaginaDaChave";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  return metadadosDaChave("en");
}

export default function Page() {
  return <PaginaDaChave idioma="en" />;
}
