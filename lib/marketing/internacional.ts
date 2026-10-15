// Localized site lead sequences. The scheduler preserves each lead's message IDs and cursor.
import { cabecalhosDeDescadastro, urlDeDescadastro } from "@/lib/marketing/descadastro";
export type IdiomaNovo = "fr" | "de";
type Conteudo = {assunto:string; titulo:string; paragrafos:string[]};
const DADOS: Record<IdiomaNovo, Conteudo[]> = {
  "fr": [
    {
      "assunto": "Que deviennent vos demandes sur WhatsApp ?",
      "titulo": "Que deviennent vos demandes sur WhatsApp ?",
      "paragrafos": [
        "Un prospect pose une question. Votre équipe est occupée. La conversation peut s’arrêter là.",
        "Atenza réunit les conversations WhatsApp, les agents IA et le suivi commercial, avec une reprise possible par vos équipes."
      ]
    },
    {
      "assunto": "Qui répond lorsque les demandes arrivent ensemble ?",
      "titulo": "Qui répond lorsque les demandes arrivent ensemble ?",
      "paragrafos": [
        "Quand plusieurs messages arrivent en même temps, comment répartissez-vous les réponses ?",
        "Une boîte de réception partagée permet de suivre les échanges sans perdre le contexte."
      ]
    },
    {
      "assunto": "Les demandes restées sans suite",
      "titulo": "Les demandes restées sans suite",
      "paragrafos": [
        "Regardez les demandes de prix et de rendez-vous sans réponse cette semaine.",
        "Atenza aide votre équipe à identifier les prochaines actions."
      ]
    },
    {
      "assunto": "Vos clients ne veulent pas naviguer dans des menus",
      "titulo": "Vos clients ne veulent pas naviguer dans des menus",
      "paragrafos": [
        "Une question comporte souvent plusieurs besoins à la fois.",
        "Un agent IA peut utiliser vos informations et transférer les sujets complexes à une personne."
      ]
    },
    {
      "assunto": "Un transfert ne doit pas effacer le contexte",
      "titulo": "Un transfert ne doit pas effacer le contexte",
      "paragrafos": [
        "Personne ne souhaite expliquer plusieurs fois la même demande.",
        "Atenza met l’historique à disposition des collaborateurs."
      ]
    },
    {
      "assunto": "L’IA doit rester sous votre contrôle",
      "titulo": "L’IA doit rester sous votre contrôle",
      "paragrafos": [
        "L’automatisation ne doit pas inventer vos tarifs ni vos conditions.",
        "Vous définissez les connaissances et les règles de transfert à une personne."
      ]
    },
    {
      "assunto": "Quel est le coût d’Atenza ?",
      "titulo": "Quel est le coût d’Atenza ?",
      "paragrafos": [
        "Comparez les fonctionnalités et les frais des fournisseurs d’IA et de WhatsApp.",
        "Consultez les conditions tarifaires applicables à votre marché."
      ]
    },
    {
      "assunto": "Commencez par un usage concret",
      "titulo": "Commencez par un usage concret",
      "paragrafos": [
        "Choisissez une question fréquente et une règle de transfert simple.",
        "Testez la qualité des réponses avant de déployer davantage."
      ]
    },
    {
      "assunto": "Le devis resté sans réponse",
      "titulo": "Le devis resté sans réponse",
      "paragrafos": [
        "Une personne demande un devis, puis les échanges s’arrêtent.",
        "Atenza relie la conversation aux étapes de suivi commercial."
      ]
    },
    {
      "assunto": "Trois situations à tester",
      "titulo": "Trois situations à tester",
      "paragrafos": [
        "Essayez une question simple, une demande inhabituelle et un transfert humain.",
        "Vérifiez les conditions de l’essai et les frais externes."
      ]
    },
    {
      "assunto": "Fin de notre prise de contact",
      "titulo": "Fin de notre prise de contact",
      "paragrafos": [
        "Ce message clôt notre série de prises de contact.",
        "Si l’organisation de votre service WhatsApp devient une priorité, Atenza reste disponible."
      ]
    },
    {
      "assunto": "Quel usage commencer à automatiser ?",
      "titulo": "Quel usage commencer à automatiser ?",
      "paragrafos": [
        "Identifiez la question que votre équipe reçoit le plus souvent. Un bon agent IA commence par une information fiable et une possibilité de reprise humaine."
      ]
    },
    {
      "assunto": "Un suivi commercial plus lisible",
      "titulo": "Un suivi commercial plus lisible",
      "paragrafos": [
        "Reliez vos échanges WhatsApp à des contacts et à des étapes concrètes. Votre équipe conserve le contexte de chaque demande."
      ]
    },
    {
      "assunto": "Un CRM WhatsApp adapté à votre équipe",
      "titulo": "Un CRM WhatsApp adapté à votre équipe",
      "paragrafos": [
        "Centralisez les messages et clarifiez qui prend la suite. Le suivi client ne doit pas dépendre de la mémoire d’une seule personne."
      ]
    },
    {
      "assunto": "Le bon moment pour essayer",
      "titulo": "Le bon moment pour essayer",
      "paragrafos": [
        "Testez un cas simple, une question complexe et une demande de transfert. Découvrez ensuite les conditions et tarifs applicables."
      ]
    }
  ],
  "de": [
    {
      "assunto": "Was geschieht nach einer WhatsApp-Anfrage?",
      "titulo": "Was geschieht nach einer WhatsApp-Anfrage?",
      "paragrafos": [
        "Ein Interessent fragt nach Verfügbarkeit, während Ihr Team beschäftigt ist.",
        "Atenza verbindet WhatsApp, KI-Agenten, persönliche Übergaben und Vertriebsnachverfolgung."
      ]
    },
    {
      "assunto": "Wer bearbeitet neue WhatsApp-Anfragen?",
      "titulo": "Wer bearbeitet neue WhatsApp-Anfragen?",
      "paragrafos": [
        "Mehrere Nachrichten treffen gleichzeitig ein. Ist die Zuständigkeit klar?",
        "Ein gemeinsamer Posteingang vereinfacht die Koordination."
      ]
    },
    {
      "assunto": "Die Anfragen, die Sie nicht erfassen",
      "titulo": "Die Anfragen, die Sie nicht erfassen",
      "paragrafos": [
        "Prüfen Sie unbeantwortete Preis- oder Terminanfragen der letzten Woche.",
        "Atenza macht nächste Schritte im Gesprächsverlauf sichtbar."
      ]
    },
    {
      "assunto": "Kunden wollen kein endloses Auswahlmenü",
      "titulo": "Kunden wollen kein endloses Auswahlmenü",
      "paragrafos": [
        "Eine Anfrage kann mehrere Fragen enthalten.",
        "KI nutzt Ihre Unternehmensinformationen und übergibt komplexe Fälle an Ihr Team."
      ]
    },
    {
      "assunto": "Bei einer Übergabe bleibt der Kontext",
      "titulo": "Bei einer Übergabe bleibt der Kontext",
      "paragrafos": [
        "Kunden möchten ihr Anliegen nicht mehrfach erklären.",
        "Der gemeinsame Gesprächsverlauf erleichtert die Weiterbearbeitung."
      ]
    },
    {
      "assunto": "KI mit klaren Grenzen",
      "titulo": "KI mit klaren Grenzen",
      "paragrafos": [
        "Automatisierung darf Preise oder Richtlinien nicht erfinden.",
        "Sie steuern Wissen und Übergaberegeln."
      ]
    },
    {
      "assunto": "Was kostet Atenza?",
      "titulo": "Was kostet Atenza?",
      "paragrafos": [
        "Vergleichen Sie Funktionen und externe KI- oder WhatsApp-Nutzungskosten.",
        "Prüfen Sie die für Ihren Markt verfügbaren Tarife."
      ]
    },
    {
      "assunto": "Starten Sie mit einem konkreten Anwendungsfall",
      "titulo": "Starten Sie mit einem konkreten Anwendungsfall",
      "paragrafos": [
        "Wählen Sie eine häufige Frage und eine klare Übergaberegel.",
        "Prüfen Sie die Ergebnisse, bevor Sie erweitern."
      ]
    },
    {
      "assunto": "Die Anfrage ohne Nachverfolgung",
      "titulo": "Die Anfrage ohne Nachverfolgung",
      "paragrafos": [
        "Ein Angebot wird angefragt, dann endet das Gespräch.",
        "Atenza verbindet Posteingang und Vertriebsprozess."
      ]
    },
    {
      "assunto": "Drei sinnvolle Tests",
      "titulo": "Drei sinnvolle Tests",
      "paragrafos": [
        "Testen Sie eine Routinefrage, einen Sonderfall und eine Übergabe.",
        "Beachten Sie Testbedingungen und externe Nutzungskosten."
      ]
    },
    {
      "assunto": "Abschluss meiner Kontaktaufnahme",
      "titulo": "Abschluss meiner Kontaktaufnahme",
      "paragrafos": [
        "Dies ist meine letzte Nachricht in dieser Serie.",
        "Bei späterem Interesse finden Sie Atenza weiterhin online."
      ]
    },
    {
      "assunto": "Welchen Prozess zuerst automatisieren?",
      "titulo": "Welchen Prozess zuerst automatisieren?",
      "paragrafos": [
        "Wählen Sie eine häufige Kundenfrage. Gute KI arbeitet mit verlässlichen Angaben und klarer Möglichkeit zur menschlichen Übernahme."
      ]
    },
    {
      "assunto": "Klarheit in der Vertriebsnachverfolgung",
      "titulo": "Klarheit in der Vertriebsnachverfolgung",
      "paragrafos": [
        "Verknüpfen Sie WhatsApp-Unterhaltungen mit konkreten Kontakten und nächsten Schritten. Ihr Team behält den Kontext."
      ]
    },
    {
      "assunto": "WhatsApp CRM für Ihr Team",
      "titulo": "WhatsApp CRM für Ihr Team",
      "paragrafos": [
        "Führen Sie Nachrichten zentral zusammen und legen Sie Zuständigkeiten fest. Kundenbetreuung darf nicht nur von einzelnen Personen abhängen."
      ]
    },
    {
      "assunto": "Ein sinnvoller Praxistest",
      "titulo": "Ein sinnvoller Praxistest",
      "paragrafos": [
        "Testen Sie einen Standardfall, eine schwierige Frage und die Übergabe an eine Person. Prüfen Sie anschließend Konditionen und Preise."
      ]
    }
  ]
};
export function emailLocalizado(idioma: IdiomaNovo, indice: number, token: string) {
 const conteudo = DADOS[idioma]?.[indice];
 if (!conteudo) throw new Error("Etapa localizada ausente");
 const url = urlDeDescadastro(token);
 const rodape = idioma === "fr" ? "Vous recevez ce message après votre inscription sur le site Atenza. Se désinscrire" : "Sie erhalten diese Nachricht nach Ihrer Anmeldung auf der Atenza-Website. Abmelden";
 const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
 const html = `<!doctype html><html lang="${idioma}"><head><meta charset="UTF-8"></head><body style="margin:0;background:#f3f5f3;color:#20362b;font-family:Arial,sans-serif"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center"><table role="presentation" width="580" style="max-width:100%;background:#fff;margin:30px auto"><tr><td style="padding:32px"><strong style="font-size:24px">Atenza</strong><h1 style="font-size:23px">${esc(conteudo.titulo)}</h1>${conteudo.paragrafos.map(p=>`<p style="font-size:16px;line-height:1.65">${esc(p)}</p>`).join("")}<p><a href="https://www.atenza.online/${idioma}" style="color:#315841">Atenza</a></p><p style="font-size:12px;color:#666">${esc(rodape)}: <a href="${esc(url)}">${esc(url)}</a></p></td></tr></table></td></tr></table></body></html>`;
 const text = [conteudo.titulo,...conteudo.paragrafos,"https://www.atenza.online/"+idioma,rodape+": "+url].join("\n\n");
 return {subject:conteudo.assunto, html,text,headers:cabecalhosDeDescadastro(token)};
}
export function idiomaNovo(x:string): x is IdiomaNovo {return x === "fr" || x === "de";}
export function contarEtapasNovas(idioma:IdiomaNovo) {return DADOS[idioma].length;}
