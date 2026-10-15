import type { Metadata } from "next";
import PaginaOriginal from "../page";

export const metadata: Metadata = {
  title: { absolute: "CRM WhatsApp con IA y atención multiagente" + " | Atenza" },
  description: "Centraliza WhatsApp, tu equipo y agentes de IA. Mantén cada oportunidad organizada en un CRM compartido.",
  alternates:{canonical:"/es",languages:{ "pt-BR": "/", "fr-FR": "/fr", "de-DE": "/de", "es-ES": "/es", "es-MX": "/mx", "en-US": "/en-us", "en-GB": "/en-gb" }},
  openGraph:{type:"website",title:"CRM WhatsApp con IA y atención multiagente",description:"Centraliza WhatsApp, tu equipo y agentes de IA. Mantén cada oportunidad organizada en un CRM compartido.",url:"/es",locale:"es-ES",siteName:"Atenza"},
  robots:{index:true,follow:true}
};

// Mantém a experiência visual original do Atenza, com SEO por mercado.
export default PaginaOriginal;
