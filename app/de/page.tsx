import type { Metadata } from "next";
import PaginaOriginal from "../page";

export const metadata: Metadata = {
  title: { absolute: "WhatsApp CRM mit KI und Team-Posteingang" + " | Atenza" },
  description: "Verwalten Sie WhatsApp-Anfragen, KI-Agenten und Vertriebsnachverfolgung in einem übersichtlichen Arbeitsbereich.",
  alternates:{canonical:"/de",languages:{ "pt-BR": "/", "fr-FR": "/fr", "de-DE": "/de", "es-ES": "/es", "es-MX": "/mx", "en-US": "/en-us", "en-GB": "/en-gb" }},
  openGraph:{type:"website",title:"WhatsApp CRM mit KI und Team-Posteingang",description:"Verwalten Sie WhatsApp-Anfragen, KI-Agenten und Vertriebsnachverfolgung in einem übersichtlichen Arbeitsbereich.",url:"/de",locale:"de-DE",siteName:"Atenza"},
  robots:{index:true,follow:true}
};

// Mantém a experiência visual original do Atenza, com SEO por mercado.
export default PaginaOriginal;
