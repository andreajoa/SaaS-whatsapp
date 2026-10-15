import type { Metadata } from "next";
import { CapturaDeLead } from "@/components/site/CapturaDeLead";
import { ConviteDeLead } from "@/components/site/ConviteDeLead";
import { instalacaoCobra } from "@/lib/billing/planos";
import { redirect } from "next/navigation";
export const metadata: Metadata = {
  title: "WhatsApp CRM and AI Customer Support" + " | Atenza",
  description: "Bring customer conversations, AI agents, team inboxes and your sales pipeline into one clear workflow.",
  alternates:{canonical:"/en-us",languages:{ "pt-BR": "/", "fr-FR": "/fr", "de-DE": "/de", "es-ES": "/es", "es-MX": "/mx", "en-US": "/en-us", "en-GB": "/en-gb" }},
  openGraph:{type:"website",title:"WhatsApp CRM and AI Customer Support",description:"Bring customer conversations, AI agents, team inboxes and your sales pipeline into one clear workflow.",url:"/en-us",locale:"en-US",siteName:"Atenza"},
  robots:{index:true,follow:true}
};
const copy = {rotulo:"Work email",exemplo:"name@company.com",enviar:"Get practical customer service insights",enviando:"…",promessa:"Unsubscribe at any time.",sucesso:"Request received.",erro:"Please try again."};
export default function LocalizedPage() {
 if (!instalacaoCobra()) redirect("/app");
 const faq = { "@context":"https://schema.org","@type":"SoftwareApplication",name:"Atenza",applicationCategory:"BusinessApplication",operatingSystem:"Web",url:"https://www.atenza.online/en-us",inLanguage:"en-US",description:"Bring customer conversations, AI agents, team inboxes and your sales pipeline into one clear workflow.",featureList:["WhatsApp CRM","Shared inbox","AI agents","Sales follow-ups","Human handoff"] };
 return <main lang="en" className="min-h-screen bg-[#F7F5F0] text-[#263E33]">
  <script type="application/ld+json" dangerouslySetInnerHTML={{__html:JSON.stringify(faq).replace(/</g,"\u003c")}}/>
  <header className="mx-auto max-w-6xl px-6 py-8 font-serif text-3xl font-semibold">Atenza</header>
  <section className="mx-auto grid max-w-6xl gap-14 px-6 py-24 md:grid-cols-2">
    <div><p className="text-sm font-semibold uppercase tracking-widest">WhatsApp · CRM · AI</p><h1 className="mt-7 font-serif text-5xl leading-tight">{"Every WhatsApp conversation deserves a next step."}</h1><p className="mt-8 text-xl leading-8">{"Bring customer conversations, AI agents, team inboxes and your sales pipeline into one clear workflow."}</p><a className="mt-8 inline-block rounded-full bg-[#315841] px-8 py-4 text-white" href="#contact">{"Explore Atenza"}</a></div>
    <div className="rounded-3xl border border-[#D7E0D7] bg-white p-8"><h2 className="font-serif text-3xl">{"Shared WhatsApp inbox, AI chatbot and sales pipeline"}</h2><ul className="mt-7 list-disc space-y-5 pl-6"><li>WhatsApp CRM</li><li>Shared team inbox</li><li>AI agents and knowledge base</li><li>Sales pipeline and follow-ups</li><li>Human handoff</li></ul></div>
  </section>
  <section id="contact" className="mx-auto max-w-2xl px-6 py-20"><h2 className="font-serif text-4xl">{"Get practical customer service insights"}</h2><div className="mt-7"><CapturaDeLead textos={copy} origem="rodape" idioma="en" moeda="USD"/></div></section>
  <ConviteDeLead captura={copy} idioma="en" moeda="USD" textos={{titulo:"Every WhatsApp conversation deserves a next step.",corpo:"Bring customer conversations, AI agents, team inboxes and your sales pipeline into one clear workflow.",fechar:"×"}}/>
 </main>;
}