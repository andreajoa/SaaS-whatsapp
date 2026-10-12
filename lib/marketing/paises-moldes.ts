/**
 * O MOLDE de cada página de país — a forma, não o texto.
 *
 * Tradução e moeda não bastam: a mesma página converte diferente conforme o
 * que o visitante está habituado a ver num site do próprio país. Os moldes
 * seguem as dimensões culturais que mais pesam em compra de software
 * (aversão à incerteza, coletivismo/relação, distância hierárquica):
 *
 * - `calido` (México, Colômbia, Peru): compra pela relação. O herói é uma
 *   CONVERSA de WhatsApp com a frase que o cliente de lá escreve, cores
 *   quentes, tranquilização antes do preço e passos simples.
 * - `directo` (Argentina): comprador cético e atento a valor. Preço logo
 *   abaixo do herói, comparação sem/com e texto curto.
 * - `corporativo` (Chile): eficiência e estrutura. Barra de confiança,
 *   processo em três passos e tabela comparativa.
 * - `sobrio` (Espanha): clareza legal e pouco exagero. Confiança logo depois
 *   do herói (sem permanência, pagamento seguro, dados), layout limpo e
 *   perguntas frequentes em destaque.
 *
 * Mesma regra editorial: nada de depoimento, logo de cliente ou número de
 * resultado que não exista. A "prova" aqui é o que o produto faz e as
 * condições (sem permanência, API oficial), não gente inventada.
 */

export type Molde = "calido" | "directo" | "corporativo" | "sobrio";

export type MoldeDoPais = {
  readonly molde: Molde;
  /** Conversa de exemplo do herói (`calido`) — rotulada como ilustrativa. */
  readonly conversa?: readonly { readonly de: "cliente" | "agente"; readonly texto: string }[];
  /** Nome do negócio fictício da conversa. */
  readonly negocio?: string;
  readonly confianca: readonly string[];
  readonly passos?: {
    readonly titulo: string;
    readonly itens: readonly { titulo: string; texto: string }[];
  };
  readonly comparacao?: {
    readonly titulo: string;
    readonly sin: string;
    readonly con: string;
    readonly linhas: readonly { readonly sin: string; readonly con: string }[];
  };
  /** Painel de exemplo do herói (`corporativo`) — rotulado como ilustrativo. */
  readonly painel?: {
    readonly titulo: string;
    readonly linhas: readonly {
      readonly cliente: string;
      readonly assunto: string;
      readonly estado: string;
      readonly tom: "ia" | "equipe" | "ok";
    }[];
  };
  /** Faixa logo abaixo do herói no molde `directo`. */
  readonly faixa?: string;
};

const PASSOS_TU = {
  titulo: "Empieza en tres pasos",
  itens: [
    { titulo: "Crea tu cuenta", texto: "Desde la web, en minutos, sin llamadas de venta." },
    {
      titulo: "Conecta tu WhatsApp",
      texto: "Por la API oficial de Meta, con el mismo número de siempre.",
    },
    {
      titulo: "Enseña a tu agente",
      texto: "Precios, horarios y respuestas frecuentes. Desde ese momento, atiende.",
    },
  ],
};

const PASSOS_USTED = {
  titulo: "Empiece en tres pasos",
  itens: [
    { titulo: "Cree su cuenta", texto: "Desde la web, en minutos, sin llamadas de venta." },
    {
      titulo: "Conecte su WhatsApp",
      texto: "Por la API oficial de Meta, con el mismo número de siempre.",
    },
    {
      titulo: "Enseñe a su agente",
      texto: "Precios, horarios y respuestas frecuentes. Desde ese momento, atiende.",
    },
  ],
};

export const MOLDES_DOS_PAISES: Readonly<Record<string, MoldeDoPais>> = {
  mexico: {
    molde: "calido",
    negocio: "Tienda Lupita",
    conversa: [
      { de: "cliente", texto: "Hola, buenas noches 👋 ¿me das informes de los tenis blancos?" },
      {
        de: "agente",
        texto:
          "¡Hola! Claro que sí 😊 Los tenis blancos cuestan $890 y tenemos del 23 al 28. ¿Qué número buscas?",
      },
      { de: "cliente", texto: "El 25. ¿Hacen envíos a Guadalajara?" },
      {
        de: "agente",
        texto: "Sí, llegan en 2 a 3 días hábiles. ¿Te comparto el enlace para apartarlos?",
      },
    ],
    confianca: [
      "API oficial de WhatsApp",
      "Sin plazos forzosos",
      "Panel y soporte en español",
      "Pago seguro con Stripe",
    ],
    passos: PASSOS_TU,
  },
  colombia: {
    molde: "calido",
    negocio: "Domicilios La 70",
    conversa: [
      { de: "cliente", texto: "Buenas noches, ¿me regala información de los almuerzos?" },
      {
        de: "agente",
        texto:
          "¡Con mucho gusto! El almuerzo del día está en $18.000 e incluye sopa, seco y jugo. ¿Para cuántas personas sería?",
      },
      { de: "cliente", texto: "Para dos. ¿Hacen domicilio a Laureles?" },
      {
        de: "agente",
        texto: "Claro que sí, llega en unos 40 minutos. ¿Me confirma la dirección, por favor?",
      },
    ],
    confianca: [
      "API oficial de WhatsApp",
      "Sin cláusula de permanencia",
      "Panel y soporte en español",
      "Pago seguro con Stripe",
    ],
    passos: PASSOS_USTED,
  },
  peru: {
    molde: "calido",
    negocio: "Dulce Lima Postres",
    conversa: [
      { de: "cliente", texto: "Hola, ¿cuánto está la torta de chocolate?" },
      {
        de: "agente",
        texto:
          "¡Hola! La torta de chocolate para 12 personas está S/ 85. ¿Para qué fecha la necesita?",
      },
      { de: "cliente", texto: "Para el sábado. ¿Hacen delivery a Miraflores?" },
      {
        de: "agente",
        texto: "Sí, el delivery a Miraflores es S/ 10. ¿Le paso los datos para el pago?",
      },
    ],
    confianca: [
      "API oficial de WhatsApp",
      "Sin permanencia",
      "Panel y soporte en español",
      "Pago seguro con Stripe",
    ],
    passos: PASSOS_USTED,
  },
  argentina: {
    molde: "directo",
    faixa: "Precio en dólares, sin reajustes mensuales. 7 días sin cargo, cancelás cuando quieras.",
    confianca: [
      "API oficial de WhatsApp",
      "Sin permanencia mínima",
      "Precio en dólares",
      "Pago seguro con Stripe",
    ],
    comparacao: {
      titulo: "Sin y con {marca}",
      sin: "Hoy",
      con: "Con el agente",
      linhas: [
        { sin: '"Te contesto en un rato"', con: "Respuesta en segundos, a toda hora" },
        { sin: "Lista de precios en tu cabeza", con: "Precio vigente en la base de conocimiento" },
        { sin: "Un celular para todo el equipo", con: "Bandeja compartida, cada uno con lo suyo" },
        { sin: '"Lo pienso" y se pierde', con: "Seguimiento automático" },
      ],
    },
  },
  chile: {
    molde: "corporativo",
    painel: {
      titulo: "Cotizaciones de hoy",
      linhas: [
        {
          cliente: "Constructora Andes",
          assunto: "Cotización de 40 m² de porcelanato",
          estado: "Respondida por IA · 1 min",
          tom: "ia",
        },
        {
          cliente: "Clínica Providencia",
          assunto: "Agenda de 3 horas para evaluación",
          estado: "Agendada",
          tom: "ok",
        },
        {
          cliente: "Café Lastarria",
          assunto: "Precio por mayor de café en grano",
          estado: "Con un ejecutivo",
          tom: "equipe",
        },
        {
          cliente: "Estudio Ñuñoa",
          assunto: "Seguimiento de cotización enviada",
          estado: "Seguimiento automático",
          tom: "ia",
        },
      ],
    },
    confianca: [
      "API oficial de WhatsApp",
      "Sin plazo mínimo",
      "Precio en pesos chilenos",
      "Pago seguro con Stripe",
    ],
    passos: PASSOS_TU,
    comparacao: {
      titulo: "Antes y después",
      sin: "Sin plataforma",
      con: "Con el agente",
      linhas: [
        {
          sin: "Cotizaciones respondidas al día siguiente",
          con: "Respuesta inmediata, a toda hora",
        },
        { sin: "Seguimiento según la memoria de cada uno", con: "Embudo con cada oportunidad" },
        { sin: "Un teléfono compartido", con: "Bandeja con historial y responsables" },
      ],
    },
  },
  espana: {
    molde: "sobrio",
    confianca: [
      "Sin permanencia",
      "API oficial de WhatsApp",
      "Exportar y anonimizar datos de contactos",
      "Pago seguro con Stripe",
    ],
    passos: PASSOS_TU,
  },
};
