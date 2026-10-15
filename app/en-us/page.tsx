import type { Metadata } from "next";
import { PaginaEUA } from "@/components/site/PaginaEUA";

export const metadata: Metadata = {
  title: { absolute: "WhatsApp CRM and AI Customer Support" + " | Atenza" },
  description:
    "Bring customer conversations, AI agents, team inboxes and your sales pipeline into one clear workflow.",
  alternates: {
    canonical: "/en-us",
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
    title: "WhatsApp CRM and AI Customer Support",
    description:
      "Bring customer conversations, AI agents, team inboxes and your sales pipeline into one clear workflow.",
    url: "/en-us",
    locale: "en-US",
    siteName: "Atenza",
  },
  robots: { index: true, follow: true },
};

export const dynamic = "force-dynamic";

export default async function Page() {
  return PaginaEUA();
}
