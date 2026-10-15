import type { Metadata } from "next";
import Link from "next/link";
import { LogotipoDoProduto } from "@/components/branding/MarcaDoProduto";
import { CabecalhoDoSite } from "@/components/site/CabecalhoDoSite";
import { CapturaDeLead } from "@/components/site/CapturaDeLead";
import { ConviteDeLead } from "@/components/site/ConviteDeLead";
import { instalacaoCobra } from "@/lib/billing/planos";
import { menuFrancais } from "@/lib/marketing/menu-fr";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: { absolute: "CRM WhatsApp avec IA et multi-agents | Atenza France" },
  description:
    "CRM WhatsApp pour entreprises : boîte de réception partagée, chatbot IA, suivi commercial, relances et transfert à un conseiller. Découvrez Atenza.",
  keywords: [
    "CRM WhatsApp",
    "logiciel WhatsApp Business",
    "service client WhatsApp",
    "chatbot WhatsApp IA",
    "WhatsApp multi-agents",
    "automatisation WhatsApp",
    "suivi des prospects",
    "boîte de réception partagée",
  ],
  openGraph: {
    type: "website",
    locale: "fr_FR",
    title: "Atenza | CRM WhatsApp, IA et service client",
    description:
      "Centralisez les messages WhatsApp, les équipes et le suivi des prospects avec des agents IA sous contrôle humain.",
    url: "/fr",
    siteName: "Atenza",
  },
  twitter: {
    card: "summary_large_image",
    title: "Atenza | CRM WhatsApp avec IA",
    description: "Multi-agents, service client WhatsApp et suivi commercial dans un même outil.",
  },
  robots: { index: true, follow: true },
  alternates: {
    canonical: "/fr",
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
};
const capture = {
  rotulo: "Votre e-mail professionnel",
  exemplo: "contact@entreprise.fr",
  enviar: "Recevoir la présentation",
  enviando: "Envoi en cours…",
  promessa: "Informations sur Atenza et le suivi client. Désinscription à tout moment.",
  sucesso: "Merci, votre demande a été reçue.",
  erro: "Votre demande n'a pas pu être enregistrée.",
};
export default function FrancePage() {
  if (!instalacaoCobra()) redirect("/app");
  const schema = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "SoftwareApplication",
        "@id": "https://www.atenza.online/fr#software",
        name: "Atenza",
        url: "https://www.atenza.online/fr",
        applicationCategory: "BusinessApplication",
        operatingSystem: "Web",
        inLanguage: "fr-FR",
        description:
          "Logiciel CRM WhatsApp avec boîte de réception multi-agents, agents IA, suivi des prospects et transfert au service client.",
        featureList: [
          "CRM WhatsApp",
          "Boîte de réception partagée",
          "Agents IA",
          "Transfert à un conseiller",
          "Historique des échanges",
          "Suivi commercial",
        ],
      },
      {
        "@type": "WebPage",
        "@id": "https://www.atenza.online/fr#page",
        url: "https://www.atenza.online/fr",
        name: "CRM WhatsApp avec IA et multi-agents | Atenza France",
        inLanguage: "fr-FR",
        about: { "@id": "https://www.atenza.online/fr#software" },
      },
    ],
  };
  return (
    <main lang="fr" className="min-h-screen bg-[#F7F5F0] text-[#263E33]">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schema).replace(/</g, "\\u003c") }}
      />
      <CabecalhoDoSite nome="Atenza" idioma="fr" />
      <section className="mx-auto grid max-w-6xl gap-12 px-6 py-24 md:grid-cols-2">
        <div>
          <p className="text-xs font-semibold tracking-[.22em] uppercase">
            WhatsApp · Service client · Intelligence artificielle
          </p>
          <h1 className="mt-6 font-serif text-5xl leading-[1.1] md:text-7xl">
            CRM WhatsApp et agents IA : chaque conversation mérite une suite.
          </h1>
          <p className="mt-8 text-lg leading-8 text-[#506459]">
            Regroupez vos conversations WhatsApp, vos collaborateurs et vos agents IA dans un seul
            espace. Un service plus fluide, sans perdre le contrôle humain.
          </p>
          <a
            href="#contact"
            className="mt-9 inline-block rounded-full bg-[#315841] px-7 py-4 font-semibold text-white"
          >
            Découvrir Atenza
          </a>
        </div>
        <div className="rounded-3xl border border-[#D7E0D7] bg-white p-9">
          <h2 className="font-serif text-3xl">De la première demande au suivi.</h2>
          <div className="mt-8 space-y-7">
            {[
              ["01. Centraliser", "Un espace commun pour les conversations et les collaborateurs."],
              ["02. Accompagner", "Des agents IA guidés par les informations de votre entreprise."],
              [
                "03. Garder la main",
                "Une reprise humaine et un historique accessible à votre équipe.",
              ],
            ].map(([h, p]) => (
              <div key={h}>
                <h3 className="font-semibold">{h}</h3>
                <p className="mt-2 text-[#59695C]">{p}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
      <section className="mx-auto max-w-6xl px-6 pb-24">
        <h2 className="font-serif text-4xl">
          Un logiciel WhatsApp Business pensé pour le suivi client
        </h2>
        <div className="mt-8 grid gap-6 md:grid-cols-3">
          {[
            [
              "CRM WhatsApp et suivi des prospects",
              "Conservez l’historique des échanges et visualisez les étapes de chaque opportunité commerciale.",
            ],
            [
              "WhatsApp multi-agents",
              "Plusieurs collaborateurs peuvent coordonner la prise en charge dans une boîte de réception partagée.",
            ],
            [
              "Chatbot WhatsApp et agents IA",
              "Répondez aux questions fréquentes à partir de votre base de connaissances et transmettez les cas complexes à un humain.",
            ],
            [
              "Automatisation et relances",
              "Structurez les prochaines actions commerciales et les relances sans perdre le contexte des conversations.",
            ],
            [
              "Service client WhatsApp",
              "Gérez les demandes entrantes et les transferts entre collaborateurs au même endroit.",
            ],
            [
              "Données et supervision",
              "Gardez la maîtrise des connaissances utilisées par les agents et des règles de transfert.",
            ],
          ].map(([titre, description]) => (
            <article key={titre} className="rounded-2xl border border-[#D7E0D7] bg-white p-6">
              <h3 className="text-lg font-semibold">{titre}</h3>
              <p className="mt-3 leading-7 text-[#59695C]">{description}</p>
            </article>
          ))}
        </div>
        <h2 id="questions" className="mt-16 scroll-mt-24 font-serif text-3xl">
          Questions fréquentes sur le CRM WhatsApp
        </h2>
        <div className="mt-6 space-y-5">
          {[
            [
              "Quelle est la différence entre un CRM WhatsApp et une simple messagerie ?",
              "Un CRM WhatsApp relie les échanges à des contacts, un historique et des étapes de suivi commercial. Il facilite la coordination entre les membres de l’équipe.",
            ],
            [
              "Peut-on transférer une conversation d’un agent IA à un conseiller ?",
              "Oui. Atenza prévoit une reprise humaine avec le contexte de la conversation.",
            ],
            [
              "Les réponses de l’IA peuvent-elles être encadrées ?",
              "Oui. L’entreprise définit les informations accessibles et les limites de l’agent IA.",
            ],
            [
              "Atenza convient-il aux demandes de rendez-vous et de devis ?",
              "L’outil aide à organiser les demandes reçues sur WhatsApp, les informations récurrentes et le suivi des prospects.",
            ],
          ].map(([q, r]) => (
            <div key={q}>
              <h3 className="font-semibold">{q}</h3>
              <p className="mt-2 leading-7 text-[#59695C]">{r}</p>
            </div>
          ))}
        </div>
      </section>
      <section id="video" className="scroll-mt-24 bg-[#E6EDE6] px-6 py-20">
        <div className="mx-auto max-w-4xl">
          <h2 className="font-serif text-4xl">Voyez comment cela fonctionne.</h2>
          <p className="mt-4 leading-7">
            Découvrez le parcours d’une demande client, de la réponse aux questions fréquentes au
            transfert vers un collaborateur. Les conditions tarifaires et les frais des fournisseurs
            externes sont à vérifier.
          </p>
          <video
            className="mx-auto mt-8 block h-auto max-h-[min(65vh,600px)] w-auto max-w-full rounded-2xl bg-black"
            controls
            playsInline
            preload="metadata"
            src="/videos/atenza-fr-v2.mp4"
            poster="/media/atenza/fr-presentation.webp"
            aria-label="Présentation Atenza en français"
          />
          <a className="mt-6 inline-block underline underline-offset-4" href="#contact">
            Recevoir une présentation adaptée
          </a>
        </div>
      </section>
      <section className="mx-auto max-w-6xl px-6 py-16">
        {menuFrancais()
          .grupos.slice(0, 2)
          .map((g) => (
            <div key={g.id} className="mb-16">
              <h2 className="font-serif text-4xl">{g.rotulo}</h2>
              <div className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {g.itens.map((item) => (
                  <article
                    key={item.href}
                    id={item.href.split("#")[1]}
                    className="scroll-mt-24 rounded-2xl border border-[#D7E0D7] bg-white p-6"
                  >
                    <h3 className="text-lg font-semibold">{item.titulo}</h3>
                    <p className="mt-3 leading-7 text-[#59695C]">{item.descricao}</p>
                  </article>
                ))}
              </div>
            </div>
          ))}
        <article id="guide" className="mb-12 scroll-mt-24">
          <h2 className="font-serif text-3xl">Comment choisir votre plateforme ?</h2>
          <p className="mt-4 leading-7">
            Testez une question fréquente, une demande hors de la base de connaissances et un
            transfert à un conseiller. Vérifiez le contexte conservé, les limites de l’IA et la
            facilité de suivi pour votre équipe.
          </p>
        </article>
        <article id="integrations" className="mb-12 scroll-mt-24">
          <h2 className="font-serif text-3xl">Connectez vos outils</h2>
          <p className="mt-4 leading-7">
            Atenza propose des intégrations e-commerce, une API, des webhooks et MCP. Vérifiez avec
            nous la compatibilité de votre configuration et les conditions des fournisseurs
            externes.
          </p>
        </article>
        <article id="offres" className="scroll-mt-24">
          <h2 className="font-serif text-3xl">Une offre adaptée à votre activité</h2>
          <p className="mt-4 leading-7">
            Les fonctionnalités dépendent du plan choisi. Les frais d’utilisation des fournisseurs
            d’IA et de WhatsApp sont distincts. Demandez les conditions applicables à votre
            entreprise en France.
          </p>
          <a href="#contact" className="mt-4 inline-block underline">
            Recevoir les informations tarifaires
          </a>
        </article>
      </section>
      <section id="contact" className="mx-auto max-w-2xl px-6 py-20">
        <h2 className="font-serif text-4xl">Restons en contact.</h2>
        <p className="my-5 leading-7">
          Recevez des informations utiles pour organiser votre relation client sur WhatsApp.
        </p>
        <CapturaDeLead origem="rodape" textos={capture} idioma="fr" moeda="EUR" />
      </section>
      <footer className="mx-auto max-w-6xl border-t border-[#D7E0D7] px-6 py-10 text-sm">
        <Link href="/fr" aria-label="Atenza France" className="mb-6 inline-block">
          <LogotipoDoProduto nome="Atenza" decorativo className="h-8 w-auto" />
        </Link>
        <Link href="/legal/privacy" className="underline">
          Confidentialité
        </Link>
        <p className="mt-4">Atenza · WhatsApp au service de vos échanges clients, 24 h/24.</p>
      </footer>
      <ConviteDeLead
        idioma="fr"
        moeda="EUR"
        captura={capture}
        textos={{
          titulo: "Vos conversations méritent un vrai suivi.",
          corpo: "Découvrez une approche claire de WhatsApp, de l’IA et du suivi commercial.",
          fechar: "Fermer",
        }}
      />
    </main>
  );
}
