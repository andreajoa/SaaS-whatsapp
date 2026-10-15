import type { Metadata } from "next";
import { CapturaDeLead } from "@/components/site/CapturaDeLead";
import { ConviteDeLead } from "@/components/site/ConviteDeLead";
import { instalacaoCobra } from "@/lib/billing/planos";
import { redirect } from "next/navigation";
export const metadata: Metadata = {
  title: { absolute: "WhatsApp CRM mit KI und Team-Posteingang" + " | Atenza" },
  description: "Verwalten Sie WhatsApp-Anfragen, KI-Agenten und Vertriebsnachverfolgung in einem übersichtlichen Arbeitsbereich.",
  alternates:{canonical:"/de",languages:{ "pt-BR": "/", "fr-FR": "/fr", "de-DE": "/de", "es-ES": "/es", "es-MX": "/mx", "en-US": "/en-us", "en-GB": "/en-gb" }},
  openGraph:{type:"website",title:"WhatsApp CRM mit KI und Team-Posteingang",description:"Verwalten Sie WhatsApp-Anfragen, KI-Agenten und Vertriebsnachverfolgung in einem übersichtlichen Arbeitsbereich.",url:"/de",locale:"de-DE",siteName:"Atenza"},
  robots:{index:true,follow:true}
};
const copy = {rotulo:"Geschäftliche E-Mail-Adresse",exemplo:"name@company.com",enviar:"Mehr Informationen erhalten",enviando:"…",promessa:"Sie können sich jederzeit abmelden.",sucesso:"Ihre Anfrage wurde gespeichert.",erro:"Bitte erneut versuchen."};
export default function LocalizedPage() {
 if (!instalacaoCobra()) redirect("/app");
 const faq = { "@context":"https://schema.org","@type":"SoftwareApplication",name:"Atenza",applicationCategory:"BusinessApplication",operatingSystem:"Web",url:"https://www.atenza.online/de",inLanguage:"de-DE",description:"Verwalten Sie WhatsApp-Anfragen, KI-Agenten und Vertriebsnachverfolgung in einem übersichtlichen Arbeitsbereich.",featureList:["WhatsApp CRM","Shared inbox","AI agents","Sales follow-ups","Human handoff"] };
 return <main lang="de" className="min-h-screen bg-[#F7F5F0] text-[#263E33]">
  <script type="application/ld+json" dangerouslySetInnerHTML={{__html:JSON.stringify(faq).replace(/</g,"\u003c")}}/>
  <header className="mx-auto max-w-6xl px-6 py-8 font-serif text-3xl font-semibold">Atenza</header>
  <section className="mx-auto grid max-w-6xl gap-14 px-6 py-24 md:grid-cols-2">
    <div><p className="text-sm font-semibold uppercase tracking-widest">WhatsApp · CRM · AI</p><h1 className="mt-7 font-serif text-5xl leading-tight">{"Keine Kundenanfrage sollte verloren gehen."}</h1><p className="mt-8 text-xl leading-8">{"Verwalten Sie WhatsApp-Anfragen, KI-Agenten und Vertriebsnachverfolgung in einem übersichtlichen Arbeitsbereich."}</p><a className="mt-8 inline-block rounded-full bg-[#315841] px-8 py-4 text-white" href="#contact">{"Atenza entdecken"}</a></div>
    <div className="rounded-3xl border border-[#D7E0D7] bg-white p-8"><h2 className="font-serif text-3xl">{"WhatsApp Business Software, KI-Chatbot und CRM"}</h2><ul className="mt-7 list-disc space-y-5 pl-6"><li>WhatsApp CRM</li><li>Gemeinsamer Team-Posteingang</li><li>KI-Agenten und Wissensbasis</li><li>Vertriebspipeline und Nachverfolgung</li><li>Übergabe an Mitarbeitende</li></ul></div>
  </section>
  <section id="contact" className="mx-auto max-w-2xl px-6 py-20"><h2 className="font-serif text-4xl">{"Mehr Informationen erhalten"}</h2><div className="mt-7"><CapturaDeLead textos={copy} origem="rodape" idioma="de" moeda="EUR"/></div></section>
  <ConviteDeLead captura={copy} idioma="de" moeda="EUR" textos={{titulo:"Keine Kundenanfrage sollte verloren gehen.",corpo:"Verwalten Sie WhatsApp-Anfragen, KI-Agenten und Vertriebsnachverfolgung in einem übersichtlichen Arbeitsbereich.",fechar:"×"}}/>
 </main>;
}