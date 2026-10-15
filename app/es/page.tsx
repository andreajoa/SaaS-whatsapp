import type { Metadata } from "next";
import { CapturaDeLead } from "@/components/site/CapturaDeLead";
import { ConviteDeLead } from "@/components/site/ConviteDeLead";
import { instalacaoCobra } from "@/lib/billing/planos";
import { redirect } from "next/navigation";
export const metadata: Metadata = {
  title: { absolute: "CRM WhatsApp con IA y atención multiagente" + " | Atenza" },
  description: "Centraliza WhatsApp, tu equipo y agentes de IA. Mantén cada oportunidad organizada en un CRM compartido.",
  alternates:{canonical:"/es",languages:{ "pt-BR": "/", "fr-FR": "/fr", "de-DE": "/de", "es-ES": "/es", "es-MX": "/mx", "en-US": "/en-us", "en-GB": "/en-gb" }},
  openGraph:{type:"website",title:"CRM WhatsApp con IA y atención multiagente",description:"Centraliza WhatsApp, tu equipo y agentes de IA. Mantén cada oportunidad organizada en un CRM compartido.",url:"/es",locale:"es-ES",siteName:"Atenza"},
  robots:{index:true,follow:true}
};
const copy = {rotulo:"Introduzca su correo profesional",exemplo:"name@company.com",enviar:"Recibe información útil",enviando:"…",promessa:"Puede darse de baja en cualquier momento.",sucesso:"Solicitud recibida.",erro:"Inténtalo de nuevo."};
export default function LocalizedPage() {
 if (!instalacaoCobra()) redirect("/app");
 const faq = { "@context":"https://schema.org","@type":"SoftwareApplication",name:"Atenza",applicationCategory:"BusinessApplication",operatingSystem:"Web",url:"https://www.atenza.online/es",inLanguage:"es-ES",description:"Centraliza WhatsApp, tu equipo y agentes de IA. Mantén cada oportunidad organizada en un CRM compartido.",featureList:["WhatsApp CRM","Shared inbox","AI agents","Sales follow-ups","Human handoff"] };
 return <main lang="es" className="min-h-screen bg-[#F7F5F0] text-[#263E33]">
  <script type="application/ld+json" dangerouslySetInnerHTML={{__html:JSON.stringify(faq).replace(/</g,"\u003c")}}/>
  <header className="mx-auto max-w-6xl px-6 py-8 font-serif text-3xl font-semibold">Atenza</header>
  <section className="mx-auto grid max-w-6xl gap-14 px-6 py-24 md:grid-cols-2">
    <div><p className="text-sm font-semibold uppercase tracking-widest">WhatsApp · CRM · AI</p><h1 className="mt-7 font-serif text-5xl leading-tight">{"Una conversación bien atendida cambia el resultado."}</h1><p className="mt-8 text-xl leading-8">{"Centraliza WhatsApp, tu equipo y agentes de IA. Mantén cada oportunidad organizada en un CRM compartido."}</p><a className="mt-8 inline-block rounded-full bg-[#315841] px-8 py-4 text-white" href="#contact">{"Descubre Atenza"}</a></div>
    <div className="rounded-3xl border border-[#D7E0D7] bg-white p-8"><h2 className="font-serif text-3xl">{"CRM WhatsApp, atención multiagente y chatbot IA"}</h2><ul className="mt-7 list-disc space-y-5 pl-6"><li>CRM WhatsApp</li><li>Bandeja compartida</li><li>Agentes IA y base de conocimiento</li><li>Seguimiento de oportunidades</li><li>Transferencia a una persona</li></ul></div>
  </section>
  <section id="contact" className="mx-auto max-w-2xl px-6 py-20"><h2 className="font-serif text-4xl">{"Recibe información útil"}</h2><div className="mt-7"><CapturaDeLead textos={copy} origem="rodape" idioma="es" moeda="EUR"/></div></section>
  <ConviteDeLead captura={copy} idioma="es" moeda="EUR" textos={{titulo:"Una conversación bien atendida cambia el resultado.",corpo:"Centraliza WhatsApp, tu equipo y agentes de IA. Mantén cada oportunidad organizada en un CRM compartido.",fechar:"×"}}/>
 </main>;
}