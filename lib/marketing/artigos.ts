/**
 * GUIAS DE COMPRA POR PAÍS — o conteúdo que responde à busca de quem ainda
 * está escolhendo ("mejor CRM para WhatsApp en México", "best WhatsApp CRM").
 *
 * Regra editorial: só fatos verificáveis. Preço de concorrente sai de fonte
 * pública e vem com a data em que foi conferido; nada de "somos os melhores"
 * nem número de resultado inventado. `{marca}` vira o nome da instalação.
 */

export interface Artigo {
  readonly slug: string;
  readonly caminho: string;
  readonly idioma: "es" | "en";
  readonly hreflang: string;
  readonly pais: string;
  readonly title: string;
  readonly description: string;
  readonly h1: string;
  readonly intro: string;
  readonly atualizado: string;
  readonly sections: readonly {
    readonly title: string;
    readonly paragraphs: readonly string[];
    readonly bullets?: readonly string[];
  }[];
  readonly faq: readonly { readonly question: string; readonly answer: string }[];
  readonly fontes: readonly { readonly rotulo: string; readonly href: string }[];
  readonly cta: { readonly texto: string; readonly href: string; readonly rotulo: string };
}

const CRITERIOS_ES = [
  "API oficial de WhatsApp (Meta): evita el bloqueo del número por apps no oficiales.",
  "Varios asesores en el mismo número, con historial y responsable de cada conversación.",
  "Agente de IA que responde con la información de su negocio y pasa a una persona cuando hace falta.",
  "Embudo de ventas y seguimiento automático para no perder a quien dejó de responder.",
  "Precio claro en su moneda, sin contrato de permanencia, y prueba antes de pagar.",
];

export const ARTIGOS: readonly Artigo[] = [
  {
    slug: "crm-whatsapp-mexico",
    caminho: "/es/guias/crm-whatsapp-mexico",
    idioma: "es",
    hreflang: "es-MX",
    pais: "MX",
    title: "Cómo elegir un CRM para WhatsApp en México (guía 2026)",
    description:
      "Qué debe tener un CRM para vender por WhatsApp en México, cuánto cuesta y en qué fijarse: API oficial, IA, varios asesores, embudo y precio en pesos.",
    h1: "Cómo elegir un CRM para WhatsApp en México",
    intro:
      "En México gran parte de las ventas de pymes se cierran por WhatsApp. Un CRM para WhatsApp ordena esas conversaciones, responde rápido y da seguimiento. Esta guía explica qué revisar antes de contratar uno y cuánto cuestan las opciones del mercado.",
    atualizado: "12 de octubre de 2026",
    sections: [
      {
        title: "Lo que no puede faltar",
        paragraphs: ["Antes de comparar precios, confirme que la herramienta cumple lo básico:"],
        bullets: CRITERIOS_ES,
      },
      {
        title: "Cuánto cuesta en México",
        paragraphs: [
          "Los precios varían mucho según cómo cobra cada herramienta. Algunas cobran un plan fijo por empresa y otras cobran por usuario, y eso cambia el total cuando el equipo crece.",
          "Como referencia pública: Leadsales publica planes desde MXN 2,363 al mes; Kommo cobra entre US$ 15 y US$ 45 por usuario al mes, con pago mínimo de 6 meses. {marca} cobra desde MXN 699 al mes por empresa, con 7 días sin cobro y sin plazo forzoso.",
          "Además del plan, la API oficial de WhatsApp tiene costos de Meta por algunos mensajes (como las campañas), y la inteligencia artificial puede ir incluida o cobrarse aparte. Pregunte siempre por esos dos costos.",
        ],
      },
      {
        title: "Preguntas que conviene hacer antes de contratar",
        paragraphs: ["Pídale al proveedor que responda por escrito:"],
        bullets: [
          "¿Uso la API oficial de WhatsApp o una conexión no oficial?",
          "¿El precio es por empresa o por usuario?",
          "¿La IA está incluida o la pago aparte? ¿Cuánto cuesta por conversación?",
          "¿Hay plazo mínimo o puedo cancelar cuando quiera?",
          "¿Emiten factura (CFDI)? Si es un proveedor extranjero, normalmente entrega un recibo internacional.",
        ],
      },
    ],
    faq: [
      {
        question: "¿Necesito WhatsApp Business API o me sirve la app de WhatsApp Business?",
        answer:
          "La app sirve para un solo teléfono. Para varios asesores, automatización e IA en el mismo número, lo correcto es la API oficial, que es la que usan los CRM serios.",
      },
      {
        question: "¿Puedo conservar mi número?",
        answer:
          "Sí. Al conectar el número a la API oficial sigue usando el mismo número con sus clientes.",
      },
    ],
    fontes: [
      {
        rotulo: "Precios de Leadsales (eligetucrm.com)",
        href: "https://www.eligetucrm.com/crm-para-pymes-mexico",
      },
      { rotulo: "Precios de Kommo (kommo.com)", href: "https://www.kommo.com/blog/kommo-pricing/" },
    ],
    cta: {
      texto: "Pruebe {marca} 7 días sin cobro.",
      href: "/es/mexico",
      rotulo: "Ver {marca} para México",
    },
  },
  {
    slug: "crm-whatsapp-colombia",
    caminho: "/es/guias/crm-whatsapp-colombia",
    idioma: "es",
    hreflang: "es-CO",
    pais: "CO",
    title: "Cómo elegir un CRM para WhatsApp en Colombia (guía 2026)",
    description:
      "Qué debe tener un CRM para atender y vender por WhatsApp en Colombia, cuánto cuesta en pesos colombianos y qué preguntar antes de contratar.",
    h1: "Cómo elegir un CRM para WhatsApp en Colombia",
    intro:
      "En Colombia el cliente espera una respuesta rápida y amable por WhatsApp, a cualquier hora. Un CRM para WhatsApp permite atender con varios asesores, responder con IA y no perder a quien se quedó pensando. Esta guía resume qué revisar y cuánto cuesta.",
    atualizado: "12 de octubre de 2026",
    sections: [
      {
        title: "Lo que no puede faltar",
        paragraphs: ["Confirme estos puntos antes de comparar precios:"],
        bullets: CRITERIOS_ES,
      },
      {
        title: "Cuánto cuesta en Colombia",
        paragraphs: [
          "Hay herramientas locales desde unos COP 350.000 al mes y plataformas regionales que trabajan solo con cotización (por ejemplo, Treble, desde alrededor de US$ 399 al mes según fuentes públicas). {marca} cobra desde COP 119.000 al mes por empresa, con 7 días sin cobro y sin cláusula de permanencia.",
          "Pregunte también por los costos de Meta en la API oficial y por el costo de la IA: en algunas herramientas va incluido y en otras se paga aparte.",
        ],
      },
      {
        title: "Qué preguntar antes de contratar",
        paragraphs: ["Pida las respuestas por escrito:"],
        bullets: [
          "¿Es la API oficial de WhatsApp?",
          "¿El precio es por empresa o por usuario?",
          "¿La IA está incluida? ¿Puedo usar mi propia clave?",
          "¿Hay permanencia mínima?",
          "¿Qué pasa con los datos de mis clientes si cancelo?",
        ],
      },
    ],
    faq: [
      {
        question: "¿Sirve para domicilios y pedidos?",
        answer:
          "Sí. El agente responde precios, cobertura y tiempos de entrega con la información que usted le enseña, y pasa el pedido a un asesor cuando hace falta.",
      },
      {
        question: "¿Cumple con la protección de datos?",
        answer:
          "Busque herramientas que permitan exportar y anonimizar los datos de un contacto y que bloqueen a quien pide no recibir más mensajes.",
      },
    ],
    fontes: [
      {
        rotulo: "Precios de Treble y alternativas (mediasource.mx)",
        href: "https://www.mediasource.mx/herramientas-ia/marketing/treble-ai",
      },
    ],
    cta: {
      texto: "Pruebe {marca} 7 días sin cobro.",
      href: "/es/colombia",
      rotulo: "Ver {marca} para Colombia",
    },
  },
  {
    slug: "crm-whatsapp-espana",
    caminho: "/es/guias/crm-whatsapp-espana",
    idioma: "es",
    hreflang: "es-ES",
    pais: "ES",
    title: "Cómo elegir una herramienta de atención al cliente por WhatsApp en España (2026)",
    description:
      "Qué debe tener una plataforma de WhatsApp para empresas en España: API oficial, RGPD, varios agentes, IA y precio sin permanencia.",
    h1: "Cómo elegir una herramienta de WhatsApp para empresas en España",
    intro:
      "En España cada vez más clientes prefieren escribir por WhatsApp para pedir cita o un presupuesto. Una plataforma profesional permite atender con varios agentes, responder fuera de horario con IA y cumplir con el RGPD. Esto es lo que conviene revisar.",
    atualizado: "12 de octubre de 2026",
    sections: [
      {
        title: "Lo que no puede faltar",
        paragraphs: ["Revise estos puntos antes de contratar:"],
        bullets: [
          "API oficial de WhatsApp: la app de WhatsApp Business en el móvil de un empleado plantea problemas con el RGPD y no sirve para equipos.",
          "Contrato de encargado del tratamiento y lista de subencargados disponibles.",
          "Varios agentes en el mismo número, con historial.",
          "IA que responde con la información de su negocio y deriva a una persona.",
          "Precio claro, sin permanencia.",
        ],
      },
      {
        title: "Cuánto cuesta en España",
        paragraphs: [
          "Como referencia pública: Superchat publica planes de 79, 129 y 249 € al mes; Callbell cobra entre 15 y 20 € por usuario más el módulo de WhatsApp. {marca} cobra desde 49 € al mes por empresa, sin permanencia y con 7 días sin coste.",
          "Pregunte por los costes de Meta por mensaje (las respuestas a quien le escribió dentro de 24 horas no tienen coste de Meta) y por el coste de la IA.",
        ],
      },
    ],
    faq: [
      {
        question: "¿Es legal usar WhatsApp con clientes según el RGPD?",
        answer:
          "Con la API oficial y las garantías adecuadas (contrato de encargado, bases legales, derechos de los interesados) se puede usar. Consulte su caso con su delegado de protección de datos.",
      },
    ],
    fontes: [
      {
        rotulo: "Precios de Superchat (omr.com)",
        href: "https://omr.com/en/reviews/product/superchat/pricing",
      },
      { rotulo: "Precios de Callbell (callbell.eu)", href: "https://www.callbell.eu/en/pricing/" },
    ],
    cta: {
      texto: "Pruebe {marca} 7 días sin coste.",
      href: "/es/espana",
      rotulo: "Ver {marca} para España",
    },
  },
  {
    slug: "best-whatsapp-crm",
    caminho: "/en/guides/best-whatsapp-crm",
    idioma: "en",
    hreflang: "en-US",
    pais: "US",
    title: "How to choose a WhatsApp CRM for your small business (2026 guide)",
    description:
      "What a WhatsApp CRM should do, what it costs and the questions to ask before you buy: official API, AI agent, team inbox, pipeline and pricing.",
    h1: "How to choose a WhatsApp CRM for your small business",
    intro:
      "If your customers message you on WhatsApp, a WhatsApp CRM turns that chat into a system: a shared inbox for your team, an AI agent that answers instantly, and a pipeline that shows every deal. Here's what to look for and what it costs.",
    atualizado: "October 12, 2026",
    sections: [
      {
        title: "Must-have features",
        paragraphs: ["Check these before comparing prices:"],
        bullets: [
          "Official WhatsApp Business API (Meta) — unofficial connections can get your number banned.",
          "A shared team inbox with history and clear ownership of each conversation.",
          "An AI agent that answers from your own information and hands off to a person.",
          "A sales pipeline and automatic follow-ups.",
          "Transparent pricing, no long contracts, and a free trial.",
        ],
      },
      {
        title: "What it costs",
        paragraphs: [
          "Pricing models vary: some tools charge per company, others per user or per active contact. As public references, respond.io starts at about US$ 79–99/month, and Kommo charges US$ 15–45 per user per month with a 6-month minimum. {marca} starts at US$ 29/month per company, with a 7-day free trial and no contract.",
          "Also ask about Meta's per-message fees for marketing templates, and whether AI usage is included or billed separately.",
        ],
      },
      {
        title: "Questions to ask vendors",
        paragraphs: ["Get the answers in writing:"],
        bullets: [
          "Is it the official WhatsApp Business API?",
          "Is pricing per company, per user or per contact?",
          "Is AI included? Can I bring my own AI key?",
          "Can I cancel anytime?",
          "Can I export my data if I leave?",
        ],
      },
    ],
    faq: [
      {
        question: "Do I need the WhatsApp Business API or is the WhatsApp Business app enough?",
        answer:
          "The app works for one phone. For a team, automation and AI on the same number, you need the official API — that's what serious WhatsApp CRMs use.",
      },
    ],
    fontes: [
      {
        rotulo: "respond.io pricing (eesel.ai)",
        href: "https://www.eesel.ai/blog/respond-io-pricing",
      },
      { rotulo: "Kommo pricing (kommo.com)", href: "https://www.kommo.com/blog/kommo-pricing/" },
    ],
    cta: { texto: "Try {marca} free for 7 days.", href: "/us", rotulo: "See {marca} for the U.S." },
  },
];

export function artigoPorCaminho(caminho: string): Artigo | null {
  return ARTIGOS.find((a) => a.caminho === caminho) ?? null;
}
