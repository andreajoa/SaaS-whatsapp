import type { Metadata } from "next";
import { CapturaDeLead } from "@/components/site/CapturaDeLead";
import { ConviteDeLead } from "@/components/site/ConviteDeLead";
import { instalacaoCobra } from "@/lib/billing/planos";
import { redirect } from "next/navigation";
export const metadata: Metadata = {
  title: { absolute: "CRM para WhatsApp Business en México" + " | Atenza" },
  description: "Coordina consultas, cotizaciones y seguimiento comercial con un CRM WhatsApp, agentes IA y atención humana.",
  alternates:{canonical:"/mx",languages:{ "pt-BR": "/", "fr-FR": "/fr", "de-DE": "/de", "es-ES": "/es", "es-MX": "/mx", "en-US": "/en-us", "en-GB": "/en-gb" }},
  openGraph:{type:"website",title:"CRM para WhatsApp Business en México",description:"Coordina consultas, cotizaciones y seguimiento comercial con un CRM WhatsApp, agentes IA y atención humana.",url:"/mx",locale:"es-MX",siteName:"Atenza"},
  robots:{index:true,follow:true}
};
const copy = {rotulo:"Correo empresarial",exemplo:"name@company.com",enviar:"Recibe consejos sobre atención al cliente",enviando:"…",promessa:"Puedes darte de baja en cualquier momento.",sucesso:"Solicitud recibida.",erro:"Vuelve a intentarlo."};
export default function LocalizedPage() {
 if (!instalacaoCobra()) redirect("/app");
 const faq = { "@context":"https://schema.org","@type":"SoftwareApplication",name:"Atenza",applicationCategory:"BusinessApplication",operatingSystem:"Web",url:"https://www.atenza.online/mx",inLanguage:"es-MX",description:"Coordina consultas, cotizaciones y seguimiento comercial con un CRM WhatsApp, agentes IA y atención humana.",featureList:["WhatsApp CRM","Shared inbox","AI agents","Sales follow-ups","Human handoff"] };
 return <main lang="es" className="min-h-screen bg-[#F7F5F0] text-[#263E33]">
  <script type="application/ld+json" dangerouslySetInnerHTML={{__html:JSON.stringify(faq).replace(/</g,"\u003c")}}/>
  <header className="mx-auto max-w-6xl px-6 py-8 font-serif text-3xl font-semibold">Atenza</header>
  <section className="mx-auto grid max-w-6xl gap-14 px-6 py-24 md:grid-cols-2">
    <div><p className="text-sm font-semibold uppercase tracking-widest">WhatsApp · CRM · AI</p><h1 className="mt-7 font-serif text-5xl leading-tight">{"Tus conversaciones merecen seguimiento."}</h1><p className="mt-8 text-xl leading-8">{"Coordina consultas, cotizaciones y seguimiento comercial con un CRM WhatsApp, agentes IA y atención humana."}</p><a className="mt-8 inline-block rounded-full bg-[#315841] px-8 py-4 text-white" href="#contact">{"Conoce Atenza"}</a></div>
    <div className="rounded-3xl border border-[#D7E0D7] bg-white p-8"><h2 className="font-serif text-3xl">{"WhatsApp multiagente, chatbot IA y seguimiento de prospectos"}</h2><ul className="mt-7 list-disc space-y-5 pl-6"><li>CRM WhatsApp</li><li>Bandeja compartida</li><li>Agentes IA y base de conocimientos</li><li>Seguimiento de prospectos</li><li>Transferencia a un asesor</li></ul></div>
  </section>
  <section id="contact" className="mx-auto max-w-2xl px-6 py-20"><h2 className="font-serif text-4xl">{"Recibe consejos sobre atención al cliente"}</h2><div className="mt-7"><CapturaDeLead textos={copy} origem="rodape" idioma="es" moeda="MXN"/></div></section>
  <ConviteDeLead captura={copy} idioma="es" moeda="MXN" textos={{titulo:"Tus conversaciones merecen seguimiento.",corpo:"Coordina consultas, cotizaciones y seguimiento comercial con un CRM WhatsApp, agentes IA y atención humana.",fechar:"×"}}/>
 </main>;
}