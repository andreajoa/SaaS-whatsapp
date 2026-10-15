import type { MenuDoSite, ItemDoMenu, IconeDoMenu } from "./menu";

/** French navigation stays within French content; no silent Portuguese destinations. */
export function menuFrancais(): MenuDoSite {
  const features: readonly [IconeDoMenu, string, string][] = [
    ["equipe", "Boîte de réception partagée", "Plusieurs collaborateurs sur un même numéro."],
    ["ia", "Agents IA", "Des réponses guidées par les informations de votre entreprise."],
    ["robo", "Chatbot WhatsApp", "Des réponses automatiques aux questions fréquentes."],
    ["funil", "CRM et suivi commercial", "Chaque opportunité et sa prochaine étape."],
    ["campanha", "Campagnes", "Des messages pour vos listes de contacts segmentées."],
    ["followup", "Relances automatiques", "Reprenez les échanges restés sans suite."],
    ["agenda", "Agenda", "Rendez-vous avec Google Agenda et Meet."],
    ["relatorio", "Rapports et délais de réponse", "Suivez la qualité du service client."],
    ["api", "API, webhooks et MCP", "Connectez vos outils à votre relation client."],
    ["lgpd", "Protection des données", "Gérez les droits et les règles de confidentialité."],
  ];
  const sectors: readonly [string, string, string][] = [
    ["Cliniques et cabinets", "Accueil, rendez-vous et rappels.", "clinicas"],
    ["E-commerce et boutiques", "Commandes et catalogue dans la conversation.", "e-commerce"],
    ["Écoles et formations", "De la première demande à l’inscription.", "escolas"],
    ["Agences immobilières", "Répartissez les demandes entre vos conseillers.", "imobiliarias"],
    ["Cabinets d’avocats", "Accueil et historique confidentiel.", "advogados"],
    ["Restaurants et livraison", "Réservations et demandes aux heures de pointe.", "restaurantes"],
    ["Agences", "Un espace par client, avec votre marque.", "agencias"],
    ["Prestataires de services", "Devis et suivi des demandes.", "servicos"],
  ];
  const items: ItemDoMenu[] = features.map(([icone, titre, descricao], i) => ({
    icone,
    titulo: titre,
    descricao,
    href: `/fr#fonction-${i + 1}`,
  }));
  return {
    grupos: [
      {
        id: "funcionalidades",
        rotulo: "Fonctionnalités",
        estilo: "lista",
        itens: items,
        destaque: {
          href: "/fr#video",
          imagem: "/media/atenza/fr-presentation.webp",
          titulo: "Découvrez Atenza en vidéo",
          texto: "WhatsApp, agents IA et suivi commercial en français.",
          acao: "Voir la présentation",
        },
      },
      {
        id: "segmentos",
        rotulo: "Secteurs",
        estilo: "cartoes",
        itens: sectors.map(([titulo, descricao, asset], i) => ({
          titulo,
          descricao,
          href: `/fr#secteur-${i + 1}`,
          imagem: `/media/atenza/ilustracoes/segmentos_${asset}.webp`,
        })),
        destaque: {
          href: "/fr#contact",
          imagem: "/media/atenza/atendimento.webp",
          titulo: "Un projet pour votre entreprise ?",
          texto: "Découvrez un usage adapté à votre équipe.",
          acao: "Nous contacter",
        },
      },
      {
        id: "recursos",
        rotulo: "Ressources",
        estilo: "lista",
        itens: [
          {
            href: "/fr#video",
            icone: "video",
            titulo: "Présentation en vidéo",
            descricao: "La présentation et les sous-titres en français.",
          },
          {
            href: "/fr#guide",
            icone: "guia",
            titulo: "Guide de choix",
            descricao: "Les critères pour évaluer une plateforme.",
          },
          {
            href: "/fr#questions",
            icone: "perguntas",
            titulo: "Questions fréquentes",
            descricao: "Des réponses sur le fonctionnement d’Atenza.",
          },
          {
            href: "/fr#contact",
            icone: "contato",
            titulo: "Contactez-nous",
            descricao: "Posez vos questions avant de vous lancer.",
          },
        ],
        destaque: {
          href: "/fr#integrations",
          imagem: "/media/atenza/ilustracoes/recursos_integracoes.webp",
          titulo: "Intégrations",
          texto: "Shopify, WooCommerce, API et webhooks.",
          acao: "Découvrir les intégrations",
        },
      },
    ],
    links: [
      { href: "/fr#integrations", rotulo: "Intégrations" },
      { href: "/fr#offres", rotulo: "Offres" },
    ],
    entrar: "Connexion",
    criarConta: "Créer un compte",
    abrir: "Ouvrir la navigation",
    fechar: "Fermer",
    navegacao: "Navigation principale",
  };
}
