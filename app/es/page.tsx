import HomePage, { generateMetadata as metadataDaHome } from "../page";

export const dynamic = "force-dynamic";
export async function generateMetadata() {
  return metadataDaHome({ params: Promise.resolve({ idioma: "es" }) });
}
export default function Page() {
  return HomePage({ params: Promise.resolve({ idioma: "es" }) });
}
