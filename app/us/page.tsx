import { metadadosDosEUA, PaginaEUA } from "@/components/site/PaginaEUA";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  return metadadosDosEUA();
}

export default function Page() {
  return <PaginaEUA />;
}
