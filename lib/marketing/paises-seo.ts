/**
 * Páginas por PAÍS, em espanhol — uma porta de entrada por mercado. `{marca}`
 * no texto é trocado pelo nome resolvido da instalação (marca própria).
 *
 * Não são a mesma página com o nome do país trocado: cada uma fala o espanhol
 * de lá (tú no México e na Espanha, usted na Colômbia e no Peru, voseo na
 * Argentina), nomeia a dor do jeito que o dono de negócio de lá a descreve e
 * responde as dúvidas que são de lá (moeda, recibo, lei de dados).
 *
 * Mesma regra editorial de `conteudo-seo.ts`: só o que o produto faz, sem
 * cliente inventado, número de resultado ou promessa de ganho. O PREÇO não
 * está aqui — sai de `lib/mercado/paises.ts`, e só aparece quando o Stripe
 * consegue cobrar aquela moeda (`moedasCobraveis`).
 */

export type PaginaDePais = {
  /** Segmento da URL: `/es/<slug>`. */
  readonly slug: string;
  /** ISO-3166-1 alfa-2 — a linha de `MERCADOS`. */
  readonly pais: string;
  /** `hreflang` da página. */
  readonly hreflang: string;
  readonly nome: string;
  readonly title: string;
  readonly description: string;
  readonly eyebrow: string;
  readonly headline: string;
  readonly intro: string;
  /** As dores, na voz de quem as sente. */
  readonly dores: readonly { readonly titulo: string; readonly texto: string }[];
  readonly sections: readonly {
    readonly title: string;
    readonly paragraphs: readonly string[];
    readonly bullets?: readonly string[];
  }[];
  readonly faq: readonly { readonly question: string; readonly answer: string }[];
  /** Rótulos de interface no registro do país. */
  readonly ui: {
    readonly planes: string;
    readonly crear: string;
    readonly video: string;
    readonly prueba: string;
    readonly dolores: string;
    readonly preguntas: string;
    readonly precios: string;
    readonly mes: string;
    readonly otros: string;
  };
};

const UI_TU = {
  planes: "Ver planes",
  crear: "Crear mi cuenta",
  video: "Ver en menos de 1 minuto",
  prueba: "7 días sin cobro · cancela en un clic",
  dolores: "¿Te suena familiar?",
  preguntas: "Preguntas frecuentes",
  precios: "Planes en tu moneda",
  mes: "/mes",
  otros: "Disponible en otros países",
} as const;

const UI_USTED = {
  planes: "Ver planes",
  crear: "Crear mi cuenta",
  video: "Ver en menos de 1 minuto",
  prueba: "7 días sin cobro · cancele en un clic",
  dolores: "¿Le suena familiar?",
  preguntas: "Preguntas frecuentes",
  precios: "Planes en su moneda",
  mes: "/mes",
  otros: "Disponible en otros países",
} as const;

const UI_VOS = {
  planes: "Ver planes",
  crear: "Crear mi cuenta",
  video: "Mirá cómo funciona en menos de 1 minuto",
  prueba: "7 días sin cargo · cancelás en un clic",
  dolores: "¿Te pasa esto?",
  preguntas: "Preguntas frecuentes",
  precios: "Planes en dólares",
  mes: "/mes",
  otros: "Disponible en otros países",
} as const;

/** O que o produto É, igual em todo país — a parte que não muda com a cultura. */
const COMO_FUNCIONA_TU = {
  title: "Cómo funciona",
  paragraphs: [
    "Conectas el número de WhatsApp de tu negocio por la API oficial de Meta y sigues usando el mismo número. Todas las conversaciones llegan a una bandeja compartida: tu equipo ve el historial completo y sabe quién está atendiendo a cada cliente.",
    "El agente de IA responde con la información que tú le enseñas: precios, horarios, catálogo, zonas de entrega, políticas. Cuando el cliente pide una persona o la pregunta se sale de lo que sabe, pasa la conversación a tu equipo con todo el contexto.",
  ],
  bullets: [
    "API oficial de WhatsApp (Meta): sin riesgo de bloqueo por apps no oficiales",
    "Varios asesores en el mismo número",
    "CRM con embudo de ventas e historial de cada cliente",
    "Seguimiento automático para quien dejó de responder",
  ],
};

const COMO_FUNCIONA_USTED = {
  title: "Cómo funciona",
  paragraphs: [
    "Usted conecta el número de WhatsApp de su negocio por la API oficial de Meta y sigue usando el mismo número. Todas las conversaciones llegan a una bandeja compartida: su equipo ve el historial completo y sabe quién está atendiendo a cada cliente.",
    "El agente de IA responde con la información que usted le enseña: precios, horarios, catálogo, cobertura de domicilios, políticas. Cuando el cliente pide hablar con una persona o la pregunta se sale de lo que sabe, pasa la conversación a su equipo con todo el contexto.",
  ],
  bullets: [
    "API oficial de WhatsApp (Meta): sin riesgo de bloqueo por apps no oficiales",
    "Varios asesores en el mismo número",
    "CRM con embudo de ventas e historial de cada cliente",
    "Seguimiento automático para quien dejó de responder",
  ],
};

const IA_PROPIA_TU = {
  question: "¿La inteligencia artificial está incluida en el plan?",
  answer:
    "La IA usa la clave del proveedor que tú elijas (OpenAI, Anthropic, Google u OpenRouter). Pagas el uso directo a ese proveedor, sin comisión nuestra, y ves el consumo en el panel. Así el plan no sube de precio cuando atiendes más.",
};

const IA_PROPIA_USTED = {
  question: "¿La inteligencia artificial está incluida en el plan?",
  answer:
    "La IA usa la clave del proveedor que usted elija (OpenAI, Anthropic, Google u OpenRouter). Usted paga el uso directo a ese proveedor, sin comisión nuestra, y ve el consumo en el panel. Así el plan no sube de precio cuando atiende más.",
};

export const PAGINAS_DE_PAIS: readonly PaginaDePais[] = [
  {
    slug: "mexico",
    pais: "MX",
    hreflang: "es-MX",
    nome: "México",
    title: "WhatsApp con IA y CRM para negocios en México",
    description:
      'Responde "¿precio?" y "¿me das informes?" a cualquier hora con un agente de IA en WhatsApp, varios asesores en el mismo número y CRM. Prueba 7 días sin cobro.',
    eyebrow: "Para México",
    headline: 'Que ningún "¿me das informes?" se quede en visto.',
    intro:
      'En México se vende por WhatsApp: el cliente ve tu publicación, escribe "¿precio?" y espera respuesta en minutos. Si contestas al día siguiente, ya le compró a otro. {marca} responde al instante con la información de tu negocio, da seguimiento a quien se enfrió y le pasa la venta a tu equipo cuando hace falta.',
    dores: [
      {
        titulo: 'Te escriben "¿precio?" y desaparecen',
        texto:
          "Contestas tarde, el cliente ya no regresa. El agente responde en segundos con precio, existencias y cómo comprar, y si no contesta, le da seguimiento sin que tengas que acordarte.",
      },
      {
        titulo: "Un solo celular para todo el equipo",
        texto:
          "Todos contestan desde el mismo teléfono y nadie sabe quién atendió a quién. Con la bandeja compartida cada asesor ve el historial y sabe qué conversación es suya.",
      },
      {
        titulo: "Buen Fin y Hot Sale te rebasan",
        texto:
          "En temporada los mensajes se multiplican y se pierden ventas por no alcanzar a contestar. La IA atiende las preguntas repetidas y tu equipo se enfoca en cerrar.",
      },
    ],
    sections: [
      COMO_FUNCIONA_TU,
      {
        title: "Hecho para cómo vende un negocio mexicano",
        paragraphs: [
          "El agente aprende de tu catálogo, tus horarios y tus formas de pago, y contesta en un español natural, cercano y amable, como lo haría tu mejor vendedor. Tú decides qué puede responder solo y cuándo debe pasar a una persona.",
          "El panel está en español y lo configuras tú mismo desde el sitio, sin llamadas de venta ni contratos.",
        ],
      },
    ],
    faq: [
      {
        question: "¿En qué moneda se cobra?",
        answer:
          "Cuando el plan se muestra en pesos mexicanos, se cobra en pesos mexicanos con tarjeta, a través de Stripe. Recibes el recibo en tu correo cada mes.",
      },
      {
        question: "¿Emiten factura (CFDI)?",
        answer:
          "No emitimos CFDI, porque no somos una empresa mexicana. Cada cobro genera un recibo internacional; consulta con tu contador cómo registrarlo como gasto.",
      },
      IA_PROPIA_TU,
      {
        question: "¿Meta cobra por los mensajes?",
        answer:
          "Por la API oficial, Meta puede cobrar algunos mensajes (como los de campaña) directo en tu cuenta de WhatsApp Business. Las respuestas a clientes que te escribieron no tienen costo de Meta dentro de la ventana de 24 horas.",
      },
      {
        question: "¿Puedo cancelar cuando quiera?",
        answer:
          "Sí, en un clic desde la pantalla de suscripción, sin plazos forzosos ni penalización.",
      },
    ],
    ui: UI_TU,
  },
  {
    slug: "colombia",
    pais: "CO",
    hreflang: "es-CO",
    nome: "Colombia",
    title: "WhatsApp con IA y CRM para negocios en Colombia",
    description:
      "Atienda por WhatsApp a toda hora con un agente de IA que responde con la información de su negocio, varios asesores en el mismo número y CRM. 7 días sin cobro.",
    eyebrow: "Para Colombia",
    headline: "Atención por WhatsApp a toda hora, con la calidez de siempre.",
    intro:
      'En Colombia el cliente escribe "Buenas, ¿me regala información?" y espera que le respondan con amabilidad y rapidez. {marca} responde al instante, con el trato cordial de su negocio, y le pasa la conversación a un asesor cuando el cliente lo necesita.',
    dores: [
      {
        titulo: "Mensajes que llegan de noche y nadie responde",
        texto:
          "El cliente pregunta a las 10 de la noche y a la mañana ya compró en otro lado. El agente responde con precios, disponibilidad y domicilios a cualquier hora.",
      },
      {
        titulo: "Los asesores se cruzan las conversaciones",
        texto:
          "Dos personas responden al mismo cliente, o ninguna. La bandeja compartida asigna cada conversación y guarda el historial completo.",
      },
      {
        titulo: "Clientes que preguntan y no vuelven",
        texto:
          "El seguimiento automático le escribe a quien se quedó pensando, en el momento que usted defina, sin que nadie tenga que acordarse.",
      },
    ],
    sections: [
      COMO_FUNCIONA_USTED,
      {
        title: "Cordial, claro y a la medida de su negocio",
        paragraphs: [
          "El agente contesta en un español respetuoso y cercano, con usted o con tú según el estilo de su marca, y solo con la información que usted le da: catálogo, horarios, cobertura de domicilios y formas de pago.",
          "Quien pide no recibir más mensajes queda bloqueado para nuevos envíos, y usted puede exportar o anonimizar los datos de un contacto cuando él lo solicite.",
        ],
      },
    ],
    faq: [
      {
        question: "¿En qué moneda se cobra?",
        answer:
          "Cuando el plan se muestra en pesos colombianos, se cobra en pesos colombianos con tarjeta, a través de Stripe. El recibo llega a su correo cada mes.",
      },
      {
        question: "¿Emiten factura electrónica de la DIAN?",
        answer:
          "No, porque no somos una empresa colombiana. Cada cobro genera un recibo internacional; consulte con su contador cómo registrarlo.",
      },
      IA_PROPIA_USTED,
      {
        question: "¿Necesito cambiar mi número de WhatsApp?",
        answer:
          "No. Usted conecta el número de su empresa a la API oficial de Meta y sigue atendiendo por el mismo número.",
      },
      {
        question: "¿Puedo cancelar cuando quiera?",
        answer: "Sí, en un clic desde la pantalla de suscripción, sin cláusula de permanencia.",
      },
    ],
    ui: UI_USTED,
  },
  {
    slug: "argentina",
    pais: "AR",
    hreflang: "es-AR",
    nome: "Argentina",
    title: "WhatsApp con IA y CRM para negocios en Argentina",
    description:
      'Respondé "¿cuánto sale?" al toque con un agente de IA en WhatsApp, varios vendedores en el mismo número y CRM. Precio en dólares, sin reajustes. 7 días sin cargo.',
    eyebrow: "Para Argentina",
    headline: 'Que cada "¿cuánto sale?" tenga respuesta al toque.',
    intro:
      'En Argentina el cliente consulta por WhatsApp a cualquier hora y le escribe a tres negocios a la vez: el que contesta primero, vende. {marca} responde al instante con la información de tu negocio, le hace seguimiento a quien quedó en "lo pienso" y te pasa la venta cuando hace falta.',
    dores: [
      {
        titulo: '"Te contesto en un rato" y la venta se va',
        texto:
          "Mientras atendés el local, la consulta se enfría. El agente responde precio, stock, envíos y medios de pago en segundos, a toda hora.",
      },
      {
        titulo: "Precios que cambian todo el tiempo",
        texto:
          "Actualizás la lista una vez en la base de conocimiento y el agente responde con el precio vigente. Y el plan está en dólares: no te cambia todos los meses.",
      },
      {
        titulo: "Todos contestan desde el mismo celular",
        texto:
          "Con la bandeja compartida cada vendedor ve el historial y sabe qué conversación le toca. Nada se pisa ni se pierde.",
      },
    ],
    sections: [
      {
        title: "Cómo funciona",
        paragraphs: [
          "Conectás el número de WhatsApp de tu negocio por la API oficial de Meta y seguís usando el mismo número. Todas las conversaciones llegan a una bandeja compartida, con el historial completo de cada cliente.",
          "El agente de IA responde con lo que vos le enseñás: precios, horarios, catálogo, envíos, cuotas. Cuando el cliente pide hablar con alguien o la pregunta se sale de lo que sabe, le pasa la conversación a tu equipo con todo el contexto.",
        ],
        bullets: [
          "API oficial de WhatsApp (Meta): sin riesgo de bloqueo por apps truchas",
          "Varios vendedores en el mismo número",
          "CRM con embudo de ventas e historial de cada cliente",
          "Seguimiento automático para quien dejó de responder",
        ],
      },
    ],
    faq: [
      {
        question: "¿Por qué el precio está en dólares?",
        answer:
          "Para que no cambie todos los meses. Se cobra en dólares con tarjeta, a través de Stripe. Si pagás con tarjeta argentina, tu banco puede sumar las percepciones vigentes; pagar el resumen con dólares propios suele evitarlas. Consultá con tu contador.",
      },
      {
        question: "¿La inteligencia artificial está incluida en el plan?",
        answer:
          "La IA usa la clave del proveedor que elijas (OpenAI, Anthropic, Google u OpenRouter). Pagás el uso directo a ese proveedor, sin comisión nuestra, y ves el consumo en el panel.",
      },
      {
        question: "¿Tengo que cambiar mi número?",
        answer:
          "No. Conectás el número de tu empresa a la API oficial de Meta y seguís atendiendo por el mismo número.",
      },
      {
        question: "¿Puedo cancelar cuando quiera?",
        answer: "Sí, en un clic desde la pantalla de suscripción, sin permanencia mínima.",
      },
    ],
    ui: UI_VOS,
  },
  {
    slug: "chile",
    pais: "CL",
    hreflang: "es-CL",
    nome: "Chile",
    title: "WhatsApp con IA y CRM para empresas en Chile",
    description:
      "Responde cotizaciones y consultas por WhatsApp al instante con un agente de IA, varios ejecutivos en el mismo número y CRM. Precio en pesos chilenos. 7 días sin cobro.",
    eyebrow: "Para Chile",
    headline: "Cotizaciones por WhatsApp respondidas al instante.",
    intro:
      "En Chile el cliente pide cotización por WhatsApp y compara varias en paralelo. Gana quien responde rápido, claro y con buena atención. {marca} contesta al instante con la información de tu empresa, ordena las conversaciones del equipo y hace seguimiento a cada cotización abierta.",
    dores: [
      {
        titulo: "Cotizaciones que se quedan sin respuesta",
        texto:
          "Te piden precio un domingo y el lunes ya cerraron con otro. El agente responde a cualquier hora y deja la oportunidad registrada en el CRM.",
      },
      {
        titulo: "No sabes en qué quedó cada cliente",
        texto:
          "El embudo muestra quién está cotizando, quién negocia y quién ya compró. Nada depende de la memoria de un ejecutivo.",
      },
      {
        titulo: "Seguimiento que nadie hace",
        texto:
          "El seguimiento automático vuelve a escribirle a quien recibió la cotización y no respondió, en el plazo que tú definas.",
      },
    ],
    sections: [
      COMO_FUNCIONA_TU,
      {
        title: "Ordenado, medible y sin contratos",
        paragraphs: [
          "Ves cuántas conversaciones entraron, cuántas atendió la IA y cuántas pasaron al equipo, y en qué etapa del embudo está cada cliente.",
          "Todo se configura desde el sitio, en español, sin reuniones de venta ni plazos mínimos.",
        ],
      },
    ],
    faq: [
      {
        question: "¿En qué moneda se cobra?",
        answer:
          "Cuando el plan se muestra en pesos chilenos, se cobra en pesos chilenos con tarjeta, a través de Stripe. El recibo llega a tu correo cada mes.",
      },
      {
        question: "¿Emiten boleta o factura del SII?",
        answer:
          "No, porque no somos una empresa chilena. Cada cobro genera un recibo internacional; consulta con tu contador cómo registrarlo.",
      },
      IA_PROPIA_TU,
      {
        question: "¿Puedo cancelar cuando quiera?",
        answer: "Sí, en un clic desde la pantalla de suscripción, sin plazo mínimo.",
      },
    ],
    ui: UI_TU,
  },
  {
    slug: "peru",
    pais: "PE",
    hreflang: "es-PE",
    nome: "Perú",
    title: "WhatsApp con IA y CRM para negocios en Perú",
    description:
      'Responda "¿cuánto está?" al instante con un agente de IA en WhatsApp, varios asesores en el mismo número y CRM. Precio en soles. 7 días sin cobro.',
    eyebrow: "Para Perú",
    headline: 'Cada "¿cuánto está?" respondido al momento.',
    intro:
      "En Perú el cliente pregunta por WhatsApp, pide el precio y paga en la misma conversación. Si la respuesta tarda, la venta se va. {marca} responde al instante con la información de su negocio, comparte sus datos de pago y pasa la conversación a un asesor cuando el cliente lo necesita.",
    dores: [
      {
        titulo: "Preguntan precio y se van",
        texto:
          "El agente responde precio, stock, delivery y cómo pagar en segundos, a cualquier hora, con la información que usted le enseña.",
      },
      {
        titulo: "Todo el negocio en un solo celular",
        texto:
          "Con la bandeja compartida, varios asesores atienden el mismo número y cada uno ve el historial del cliente.",
      },
      {
        titulo: "Clientes que se olvidan de pagar",
        texto:
          "El seguimiento automático le recuerda a quien quedó a medio camino, en el momento que usted defina.",
      },
    ],
    sections: [
      COMO_FUNCIONA_USTED,
      {
        title: "Su forma de cobrar, en la conversación",
        paragraphs: [
          "Usted registra en la base de conocimiento cómo prefiere cobrar —transferencia, link de pago o billetera— y el agente comparte esos datos cuando el cliente está listo para comprar.",
        ],
      },
    ],
    faq: [
      {
        question: "¿En qué moneda se cobra?",
        answer:
          "Cuando el plan se muestra en soles, se cobra en soles con tarjeta, a través de Stripe. El recibo llega a su correo cada mes.",
      },
      {
        question: "¿Emiten boleta o factura electrónica de SUNAT?",
        answer:
          "No, porque no somos una empresa peruana. Cada cobro genera un recibo internacional; consulte con su contador cómo registrarlo.",
      },
      IA_PROPIA_USTED,
      {
        question: "¿Puedo cancelar cuando quiera?",
        answer: "Sí, en un clic desde la pantalla de suscripción, sin permanencia.",
      },
    ],
    ui: UI_USTED,
  },
  {
    slug: "espana",
    pais: "ES",
    hreflang: "es-ES",
    nome: "España",
    title: "Atención al cliente por WhatsApp con IA y CRM para empresas en España",
    description:
      "Atiende WhatsApp con un agente de IA que responde con la información de tu negocio, varios agentes en el mismo número y CRM. Sin permanencia. 7 días sin cobro.",
    eyebrow: "Para España",
    headline: "Atención al cliente por WhatsApp, también fuera de horario.",
    intro:
      "Tus clientes escriben por WhatsApp para pedir cita, preguntar precios o saber si tienes disponibilidad, y muchas veces lo hacen fuera de tu horario. {marca} responde al momento con la información de tu negocio, organiza las conversaciones de tu equipo y te pasa los casos que necesitan a una persona.",
    dores: [
      {
        titulo: "Mensajes fuera de horario",
        texto:
          "Por la noche, el fin de semana o a la hora de comer: el agente responde dudas, precios y disponibilidad, y deja la cita o la consulta anotada para tu equipo.",
      },
      {
        titulo: "El WhatsApp del negocio en el móvil de alguien",
        texto:
          "Si esa persona no está, nadie contesta. Con la bandeja compartida todo el equipo atiende el mismo número desde el ordenador.",
      },
      {
        titulo: "Presupuestos que nadie sigue",
        texto:
          "El seguimiento automático vuelve a escribir a quien pidió presupuesto y no respondió, cuando tú decidas.",
      },
    ],
    sections: [
      COMO_FUNCIONA_TU,
      {
        title: "Sin permanencia y con control de los datos",
        paragraphs: [
          "Pagas mes a mes y cancelas cuando quieras, en un clic. Quien pide no recibir más mensajes queda bloqueado para nuevos envíos, y puedes exportar o anonimizar los datos de un contacto cuando ejerza sus derechos.",
          "El panel está en español y lo configuras tú desde la web, sin llamadas comerciales.",
        ],
      },
    ],
    faq: [
      {
        question: "¿En qué moneda se cobra?",
        answer:
          "Cuando el plan se muestra en euros, se cobra en euros con tarjeta, a través de Stripe. Recibes el recibo por correo cada mes.",
      },
      {
        question: "¿Tiene permanencia?",
        answer:
          "No. Pagas mes a mes y cancelas en un clic desde la pantalla de suscripción, sin penalización.",
      },
      IA_PROPIA_TU,
      {
        question: "¿Meta cobra por los mensajes?",
        answer:
          "Por la API oficial, Meta puede cobrar algunos mensajes (como los de campaña) directamente en tu cuenta de WhatsApp Business. Responder a quien te escribió no tiene coste de Meta dentro de la ventana de 24 horas.",
      },
    ],
    ui: UI_TU,
  },
];

export function paginaDePais(slug: string): PaginaDePais | null {
  return PAGINAS_DE_PAIS.find((p) => p.slug === slug) ?? null;
}
