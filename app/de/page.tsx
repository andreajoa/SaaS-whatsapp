import { metadadosDoPais, PaginaDoPais } from "@/components/site/PaginaDoPais";

export const dynamic = "force-dynamic";

/** Deutschland — a única página de país fora de `/es`, porque é em alemão. */
export async function generateMetadata() {
  return metadadosDoPais("deutschland");
}

export default function Page() {
  return <PaginaDoPais slug="deutschland" />;
}
