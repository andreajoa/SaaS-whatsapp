import type { Metadata } from "next";
import { PaginaDoPais } from "@/components/site/PaginaDoPais";

export const metadata: Metadata = {
  title: { absolute: "CRM para WhatsApp Business en México" + " | Atenza" },
  description:
    "Coordina consultas, cotizaciones y seguimiento comercial con un CRM WhatsApp, agentes IA y atención humana.",
  alternates: {
    canonical: "/mx",
    languages: {
      "pt-BR": "/",
      "fr-FR": "/fr",
      "de-DE": "/de",
      "es-ES": "/es",
      "es-MX": "/mx",
      "en-US": "/en-us",
      "en-GB": "/en-gb",
    },
  },
  openGraph: {
    type: "website",
    title: "CRM para WhatsApp Business en México",
    description:
      "Coordina consultas, cotizaciones y seguimiento comercial con un CRM WhatsApp, agentes IA y atención humana.",
    url: "/mx",
    locale: "es-MX",
    siteName: "Atenza",
  },
  robots: { index: true, follow: true },
};

export const dynamic = "force-dynamic";

export default async function Page() {
  return <PaginaDoPais slug="mexico" />;
}
