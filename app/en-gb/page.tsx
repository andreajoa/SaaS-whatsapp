import type { Metadata } from "next";
import PaginaOriginal from "../page";

export const metadata: Metadata = {
  title: { absolute: "WhatsApp CRM and AI Customer Service" + " | Atenza" },
  description: "Coordinate WhatsApp messages, AI-assisted responses and human handovers with a shared sales pipeline.",
  alternates:{canonical:"/en-gb",languages:{ "pt-BR": "/", "fr-FR": "/fr", "de-DE": "/de", "es-ES": "/es", "es-MX": "/mx", "en-US": "/en-us", "en-GB": "/en-gb" }},
  openGraph:{type:"website",title:"WhatsApp CRM and AI Customer Service",description:"Coordinate WhatsApp messages, AI-assisted responses and human handovers with a shared sales pipeline.",url:"/en-gb",locale:"en-GB",siteName:"Atenza"},
  robots:{index:true,follow:true}
};

// Mantém a experiência visual original do Atenza, com SEO por mercado.
export default PaginaOriginal;
