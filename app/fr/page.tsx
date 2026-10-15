import type { Metadata } from "next";
import { CapturaDeLead } from "@/components/site/CapturaDeLead";
import { ConviteDeLead } from "@/components/site/ConviteDeLead";
import { instalacaoCobra } from "@/lib/billing/planos";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "CRM WhatsApp avec IA et multi-agents | Atenza France",
  description: "CRM WhatsApp pour entreprises : boîte de réception partagée, chatbot IA, suivi commercial, relances et transfert à un conseiller. Découvrez Atenza.",
  keywords: ["CRM WhatsApp", "logiciel WhatsApp Business", "service client WhatsApp", "chatbot WhatsApp IA", "WhatsApp multi-agents", "automatisation WhatsApp", "suivi des prospects", "boîte de réception partagée"],
  openGraph: {type: "website", locale: "fr_FR", title: "Atenza | CRM WhatsApp, IA et service client", description: "Centralisez les messages WhatsApp, les équipes et le suivi des prospects avec des agents IA sous contrôle humain.", url: "/fr", siteName: "Atenza"},
  twitter: {card: "summary_large_image", title: "Atenza | CRM WhatsApp avec IA", description: "Multi-agents, service client WhatsApp et suivi commercial dans un même outil."},
  robots: {index: true, follow: true},
  alternates: { canonical: "/fr", languages: { "pt-BR": "/", "fr-FR": "/fr", "de-DE": "/de", "es-ES": "/es", "es-MX": "/mx", "en-US": "/en-us", "en-GB": "/en-gb" } },
};
const capture = {
  rotulo: "Votre e-mail professionnel", exemplo: "contact@entreprise.fr",
  enviar: "Recevoir la présentation", enviando: "Envoi en cours…",
  promessa: "Informations sur Atenza et le suivi client. Désinscription à tout moment.",
  sucesso: "Merci, votre demande a été reçue.",
  erro: "Votre demande n'a pas pu être enregistrée."
};
export default function FrancePage() {
  if (!instalacaoCobra()) redirect("/app");
  const schema = {
    "@context": "https://schema.org",
    "@graph": [
      {"@type":"SoftwareApplication","@id":"https://www.atenza.online/fr#software","name":"Atenza","url":"https://www.atenza.online/fr","applicationCategory":"BusinessApplication","operatingSystem":"Web","inLanguage":"fr-FR","description":"Logiciel CRM WhatsApp avec boîte de réception multi-agents, agents IA, suivi des prospects et transfert au service client.","featureList":["CRM WhatsApp","Boîte de réception partagée","Agents IA","Transfert à un conseiller","Historique des échanges","Suivi commercial"]},
      {"@type":"WebPage","@id":"https://www.atenza.online/fr#page","url":"https://www.atenza.online/fr","name":"CRM WhatsApp avec IA et multi-agents | Atenza France","inLanguage":"fr-FR","about":{"@id":"https://www.atenza.online/fr#software"}}
    ]
  };
  return <main lang="fr" className="min-h-screen bg-[#F7F5F0] text-[#263E33]">
    <script type="application/ld+json" dangerouslySetInnerHTML={{__html: JSON.stringify(schema).replace(/</g, "\\u003c")}} />
    <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-8">
      <a href="/fr" className="font-serif text-3xl font-semibold">Atenza <span className="font-sans text-xs tracking-widest uppercase">France</span></a>
      <a href="#contact" className="text-sm underline underline-offset-4">En savoir plus</a>
    </header>
    <section className="mx-auto grid max-w-6xl gap-12 px-6 py-24 md:grid-cols-2">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[.22em]">WhatsApp · Service client · Intelligence artificielle</p>
        <h1 className="mt-6 font-serif text-5xl leading-[1.1] md:text-7xl">CRM WhatsApp et agents IA : chaque conversation mérite une suite.</h1>
        <p className="mt-8 text-lg leading-8 text-[#506459]">Regroupez vos conversations WhatsApp, vos collaborateurs et vos agents IA dans un seul espace. Un service plus fluide, sans perdre le contrôle humain.</p>
        <a href="#contact" className="mt-9 inline-block rounded-full bg-[#315841] px-7 py-4 font-semibold text-white">Découvrir Atenza</a>
      </div>
      <div className="rounded-3xl border border-[#D7E0D7] bg-white p-9">
        <h2 className="font-serif text-3xl">De la première demande au suivi.</h2>
        <div className="mt-8 space-y-7">{[
          ["01. Centraliser","Un espace commun pour les conversations et les collaborateurs."],
          ["02. Accompagner","Des agents IA guidés par les informations de votre entreprise."],
          ["03. Garder la main","Une reprise humaine et un historique accessible à votre équipe."]
        ].map(([h,p])=><div key={h}><h3 className="font-semibold">{h}</h3><p className="mt-2 text-[#59695C]">{p}</p></div>)}</div>
      </div>
    </section>
    <section className="mx-auto max-w-6xl px-6 pb-24">
      <h2 className="font-serif text-4xl">Un logiciel WhatsApp Business pensé pour le suivi client</h2>
      <div className="mt-8 grid gap-6 md:grid-cols-3">
        {[
          ["CRM WhatsApp et suivi des prospects","Conservez l’historique des échanges et visualisez les étapes de chaque opportunité commerciale."],
          ["WhatsApp multi-agents","Plusieurs collaborateurs peuvent coordonner la prise en charge dans une boîte de réception partagée."],
          ["Chatbot WhatsApp et agents IA","Répondez aux questions fréquentes à partir de votre base de connaissances et transmettez les cas complexes à un humain."],
          ["Automatisation et relances","Structurez les prochaines actions commerciales et les relances sans perdre le contexte des conversations."],
          ["Service client WhatsApp","Gérez les demandes entrantes et les transferts entre collaborateurs au même endroit."],
          ["Données et supervision","Gardez la maîtrise des connaissances utilisées par les agents et des règles de transfert."]
        ].map(([titre, description]) => <article key={titre} className="rounded-2xl border border-[#D7E0D7] bg-white p-6"><h3 className="font-semibold text-lg">{titre}</h3><p className="mt-3 leading-7 text-[#59695C]">{description}</p></article>)}
      </div>
      <h2 className="mt-16 font-serif text-3xl">Questions fréquentes sur le CRM WhatsApp</h2>
      <div className="mt-6 space-y-5">
        {[
          ["Quelle est la différence entre un CRM WhatsApp et une simple messagerie ?","Un CRM WhatsApp relie les échanges à des contacts, un historique et des étapes de suivi commercial. Il facilite la coordination entre les membres de l’équipe."],
          ["Peut-on transférer une conversation d’un agent IA à un conseiller ?","Oui. Atenza prévoit une reprise humaine avec le contexte de la conversation."],
          ["Les réponses de l’IA peuvent-elles être encadrées ?","Oui. L’entreprise définit les informations accessibles et les limites de l’agent IA."],
          ["Atenza convient-il aux demandes de rendez-vous et de devis ?","L’outil aide à organiser les demandes reçues sur WhatsApp, les informations récurrentes et le suivi des prospects."]
        ].map(([q,r])=><div key={q}><h3 className="font-semibold">{q}</h3><p className="mt-2 leading-7 text-[#59695C]">{r}</p></div>)}
      </div>
    </section>
    <section className="bg-[#E6EDE6] px-6 py-20"><div className="mx-auto max-w-4xl">
      <h2 className="font-serif text-4xl">Voyez comment cela fonctionne.</h2>
      <p className="mt-4 leading-7">Découvrez le parcours d’une demande client, de la réponse aux questions fréquentes au transfert vers un collaborateur. Les conditions tarifaires et les frais des fournisseurs externes sont à vérifier.</p>
      <video className="mt-8 w-full rounded-2xl bg-black" controls playsInline preload="metadata" src="/videos/atenza-fr.mp4" aria-label="Présentation Atenza en français" />
      <a className="mt-6 inline-block underline underline-offset-4" href="/demonstracao">Voir la démonstration interactive</a>
    </div></section>
    <section id="contact" className="mx-auto max-w-2xl px-6 py-20">
      <h2 className="font-serif text-4xl">Restons en contact.</h2>
      <p className="my-5 leading-7">Recevez des informations utiles pour organiser votre relation client sur WhatsApp.</p>
      <CapturaDeLead origem="rodape" textos={capture} idioma="fr" moeda="EUR"/>
    </section>
    <footer className="mx-auto max-w-6xl border-t border-[#D7E0D7] px-6 py-10 text-sm">
      <a href="/legal/privacy" className="underline">Confidentialité</a>
      <p className="mt-4">Atenza · WhatsApp au service de vos échanges clients, 24 h/24.</p>
    </footer>
    <ConviteDeLead idioma="fr" moeda="EUR" captura={capture}
      textos={{titulo:"Vos conversations méritent un vrai suivi.",corpo:"Découvrez une approche claire de WhatsApp, de l’IA et du suivi commercial.",fechar:"Fermer"}} />
  </main>;
}