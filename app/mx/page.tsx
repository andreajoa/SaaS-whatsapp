import type { Metadata } from "next";
import PaginaOriginal from "../page";

export const metadata: Metadata = {
  title: { absolute: "CRM para WhatsApp Business en México" + " | Atenza" },
  description: "Coordina consultas, cotizaciones y seguimiento comercial con un CRM WhatsApp, agentes IA y atención humana.",
  alternates:{canonical:"/mx",languages:{ "pt-BR": "/", "fr-FR": "/fr", "de-DE": "/de", "es-ES": "/es", "es-MX": "/mx", "en-US": "/en-us", "en-GB": "/en-gb" }},
  openGraph:{type:"website",title:"CRM para WhatsApp Business en México",description:"Coordina consultas, cotizaciones y seguimiento comercial con un CRM WhatsApp, agentes IA y atención humana.",url:"/mx",locale:"es-MX",siteName:"Atenza"},
  robots:{index:true,follow:true}
};

// Mantém a experiência visual original do Atenza, com SEO por mercado.
export default PaginaOriginal;
