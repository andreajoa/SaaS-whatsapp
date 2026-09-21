/**
 * OS DOCUMENTOS LEGAIS QUE FALTAVAM — e por que eles são DADO, não `.tsx`.
 *
 * ─── O problema de escrevê-los como as duas páginas que já existem ─────────
 *
 * `app/legal/terms` e `app/legal/privacy` põem cada parágrafo dentro de
 * `t("...")`. Funciona, e funcionou por meses, porque são duas páginas e dois
 * idiomas. Seis documentos em TRÊS idiomas pelo mesmo caminho custariam
 * algumas centenas de entradas novas em `DICIONARIO` — e o dicionário do
 * produto só conhece espanhol: o inglês, que cinco mercados da tabela esperam,
 * DEGRADARIA para português no meio de um contrato. Meia-tradução num
 * documento legal é pior que em qualquer outra tela, porque quem lê está
 * decidindo se assina.
 *
 * Aqui os três idiomas ficam LADO A LADO, na mesma linha. Divergir exige
 * apagar um campo obrigatório, e o compilador reclama.
 *
 * ─── Por que `{sistema}` e `{operador}` em vez do nome ─────────────────────
 *
 * Mesma doutrina de `lib/legal/operador.ts`: o documento nomeia quem OPERA a
 * instalação, nunca o software. Numa VPS de revendedor o operador é ele, e um
 * contrato que nomeasse o produto inverteria os papéis. Os dois marcadores são
 * substituídos em tempo de renderização por `resolverOperador()`.
 *
 * Nenhuma pessoa, marca ou domínio aparece neste arquivo. Vigiado por
 * `tests/unit/branding.test.ts`.
 *
 * ─── O que estes documentos deliberadamente NÃO afirmam ────────────────────
 *
 * Certificação (SOC 2, ISO 27001), teste de invasão e SLA com número. Nada
 * disso foi feito, e escrever no documento de segurança uma prática que não
 * existe é a única coisa aqui que pode virar processo.
 */

export interface Frase {
  readonly pt: string;
  readonly es: string;
  readonly en: string;
}

export interface SecaoLegal {
  readonly titulo: Frase;
  readonly paragrafos: readonly Frase[];
  readonly itens?: readonly Frase[];
}

export interface DocumentoLegal {
  readonly slug: string;
  readonly titulo: Frase;
  readonly resumo: Frase;
  /** ISO-8601, só data. Aparece na página como "atualizado em". */
  readonly atualizadoEm: string;
  readonly secoes: readonly SecaoLegal[];
}

const ATUALIZADO = "2026-09-21";

const COOKIES: DocumentoLegal = {
  slug: "cookies",
  atualizadoEm: ATUALIZADO,
  titulo: {
    pt: "Política de Cookies",
    es: "Política de Cookies",
    en: "Cookie Policy",
  },
  resumo: {
    pt: "Quais arquivos o {sistema} guarda no seu navegador, para quê, e como recusar os que não são essenciais.",
    es: "Qué archivos guarda {sistema} en tu navegador, para qué, y cómo rechazar los que no son esenciales.",
    en: "Which files {sistema} stores in your browser, what for, and how to refuse the ones that are not essential.",
  },
  secoes: [
    {
      titulo: { pt: "O que é um cookie", es: "Qué es una cookie", en: "What a cookie is" },
      paragrafos: [
        {
          pt: "Cookie é um arquivo pequeno que um site pede ao seu navegador para guardar e devolver na visita seguinte. É o que permite continuar logado ao trocar de página, em vez de digitar a senha a cada clique.",
          es: "Una cookie es un archivo pequeño que un sitio pide a tu navegador que guarde y devuelva en la visita siguiente. Es lo que permite seguir conectado al cambiar de página, en lugar de escribir la contraseña a cada clic.",
          en: "A cookie is a small file a site asks your browser to store and hand back on the next visit. It is what keeps you signed in as you move between pages, instead of typing your password on every click.",
        },
      ],
    },
    {
      titulo: {
        pt: "Os que não dá para recusar",
        es: "Los que no se pueden rechazar",
        en: "The ones you cannot refuse",
      },
      paragrafos: [
        {
          pt: "Três arquivos são condição para o sistema funcionar, e por isso não passam por consentimento: sem eles não há login, e sem login não há serviço a prestar.",
          es: "Tres archivos son condición para que el sistema funcione y por eso no pasan por consentimiento: sin ellos no hay inicio de sesión, y sin inicio de sesión no hay servicio que prestar.",
          en: "Three files are a condition for the system to work at all, so they are not subject to consent: without them there is no sign-in, and without sign-in there is no service to deliver.",
        },
      ],
      itens: [
        {
          pt: "Sessão — mantém você autenticado. É `HttpOnly`, `Secure` e `SameSite=Strict`: não é legível por JavaScript nem viaja para outro site.",
          es: "Sesión — te mantiene autenticado. Es `HttpOnly`, `Secure` y `SameSite=Strict`: no es legible por JavaScript ni viaja a otro sitio.",
          en: "Session — keeps you authenticated. It is `HttpOnly`, `Secure` and `SameSite=Strict`: not readable by JavaScript and never sent to another site.",
        },
        {
          pt: "Preferência de tema e idioma — guarda a escolha que você fez na interface.",
          es: "Preferencia de tema e idioma — guarda la elección que hiciste en la interfaz.",
          en: "Theme and language preference — remembers the choice you made in the interface.",
        },
        {
          pt: "Proteção contra requisição forjada — impede que outro site envie comandos em seu nome.",
          es: "Protección contra petición falsificada — impide que otro sitio envíe órdenes en tu nombre.",
          en: "Cross-site request protection — stops another site from issuing commands on your behalf.",
        },
      ],
    },
    {
      titulo: { pt: "Medição de visitas", es: "Medición de visitas", en: "Visit measurement" },
      paragrafos: [
        {
          pt: "A página pública registra de que país e cidade veio o acesso, de qual site você chegou e qual campanha trouxe você. A origem é lida dos cabeçalhos da requisição e do endereço da página, não de um rastreador de terceiros: não há pixel de rede de anúncios nem perfil publicitário construído sobre você.",
          es: "La página pública registra de qué país y ciudad vino el acceso, desde qué sitio llegaste y qué campaña te trajo. El origen se lee de las cabeceras de la petición y de la dirección de la página, no de un rastreador de terceros: no hay píxel de red publicitaria ni perfil publicitario construido sobre ti.",
          en: "The public page records which country and city the visit came from, which site you arrived from and which campaign brought you. Origin is read from the request headers and the page address, not from a third-party tracker: there is no ad-network pixel and no advertising profile built about you.",
        },
        {
          pt: "O endereço IP não é guardado em texto aberto no registro de visita. O que fica é o resultado da geolocalização, que é grosso o bastante para orientar uma decisão de produto e grosso demais para identificar uma pessoa.",
          es: "La dirección IP no se guarda en texto abierto en el registro de visita. Lo que queda es el resultado de la geolocalización, lo bastante grueso para orientar una decisión de producto y demasiado grueso para identificar a una persona.",
          en: "Your IP address is not stored in the clear on the visit record. What remains is the geolocation result — coarse enough to inform a product decision, and far too coarse to identify a person.",
        },
      ],
    },
    {
      titulo: { pt: "Como recusar", es: "Cómo rechazar", en: "How to refuse" },
      paragrafos: [
        {
          pt: "Todo navegador permite bloquear ou apagar cookies nas configurações de privacidade. Bloquear os essenciais impede o login — não é uma degradação, é a porta fechada. Bloquear a medição de visitas não muda nada no que você vê.",
          es: "Todo navegador permite bloquear o borrar cookies en las opciones de privacidad. Bloquear las esenciales impide el inicio de sesión: no es una degradación, es la puerta cerrada. Bloquear la medición de visitas no cambia nada de lo que ves.",
          en: "Every browser lets you block or delete cookies in its privacy settings. Blocking the essential ones prevents sign-in — that is not a degradation, it is a closed door. Blocking visit measurement changes nothing in what you see.",
        },
      ],
    },
  ],
};

const REEMBOLSO: DocumentoLegal = {
  slug: "reembolso",
  atualizadoEm: ATUALIZADO,
  titulo: {
    pt: "Política de Reembolso e Cancelamento",
    es: "Política de Reembolso y Cancelación",
    en: "Refund and Cancellation Policy",
  },
  resumo: {
    pt: "Quando o dinheiro volta, quanto volta, e em quanto tempo.",
    es: "Cuándo vuelve el dinero, cuánto vuelve y en cuánto tiempo.",
    en: "When your money comes back, how much of it, and how long it takes.",
  },
  secoes: [
    {
      titulo: { pt: "O teste vem antes", es: "La prueba viene antes", en: "The trial comes first" },
      paragrafos: [
        {
          pt: "A assinatura começa por um período de teste sem cobrança e sem cartão. É de propósito: a pergunta “isto serve para a minha empresa?” tem de ser respondida antes de existir dinheiro em jogo, e não depois, por meio de um pedido de reembolso.",
          es: "La suscripción empieza con un período de prueba sin cobro y sin tarjeta. Es a propósito: la pregunta “¿esto sirve para mi empresa?” debe responderse antes de que haya dinero en juego, y no después, mediante una solicitud de reembolso.",
          en: "The subscription starts with a trial period, free and with no card. That is deliberate: the question “is this right for my company?” should be answered before any money is at stake, not afterwards through a refund request.",
        },
      ],
    },
    {
      titulo: { pt: "Arrependimento", es: "Desistimiento", en: "Right to withdraw" },
      paragrafos: [
        {
          pt: "Dentro de 7 dias corridos contados da primeira cobrança, o cancelamento devolve o valor integral, sem pedir motivo. Esse prazo atende ao direito de arrependimento da lei de defesa do consumidor brasileira e é aplicado a todos os países atendidos, mesmo onde a lei local não o exige.",
          es: "Dentro de los 7 días corridos contados desde el primer cobro, la cancelación devuelve el importe íntegro, sin pedir motivo. Ese plazo atiende al derecho de desistimiento de la ley de defensa del consumidor brasileña y se aplica a todos los países atendidos, incluso donde la ley local no lo exige.",
          en: "Within 7 calendar days of the first charge, cancelling returns the full amount, no reason asked. That window follows the Brazilian consumer right of withdrawal and is applied in every country served, including where local law does not require it.",
        },
      ],
    },
    {
      titulo: {
        pt: "Depois dos 7 dias",
        es: "Después de los 7 días",
        en: "After the 7 days",
      },
      paragrafos: [
        {
          pt: "O cancelamento passa a valer no fim do ciclo já pago, e não na hora: o serviço contratado foi prestado, e o acesso continua até o último dia pago. Não há multa, fidelidade nem cobrança de saída.",
          es: "La cancelación pasa a regir al final del ciclo ya pagado, y no de inmediato: el servicio contratado se prestó, y el acceso continúa hasta el último día pagado. No hay multa, permanencia ni cargo de salida.",
          en: "Cancellation then takes effect at the end of the cycle already paid for, not immediately: the service was delivered, and access continues to the last paid day. There is no penalty, no lock-in and no exit fee.",
        },
        {
          pt: "Interrupção prolongada por falha atribuível ao {operador} gera crédito proporcional aos dias afetados, aplicado na fatura seguinte. Falha de serviço de terceiro fora do controle do {operador} — a plataforma de mensagens, por exemplo — não gera crédito automático, mas pode ser analisada caso a caso.",
          es: "Una interrupción prolongada por falla atribuible a {operador} genera crédito proporcional a los días afectados, aplicado en la factura siguiente. La falla de un servicio de terceros fuera del control de {operador} —la plataforma de mensajería, por ejemplo— no genera crédito automático, pero puede analizarse caso por caso.",
          en: "A prolonged outage caused by {operador} earns a credit proportional to the days affected, applied to the next invoice. An outage in a third-party service outside {operador}'s control — the messaging platform, for instance — earns no automatic credit, but can be reviewed case by case.",
        },
      ],
    },
    {
      titulo: { pt: "Como cancelar", es: "Cómo cancelar", en: "How to cancel" },
      paragrafos: [
        {
          pt: "Pela própria tela de assinatura, dentro do sistema, sem falar com ninguém. Cancelar não apaga os seus dados: eles seguem disponíveis para exportação durante o prazo descrito na Política de Privacidade.",
          es: "Desde la propia pantalla de suscripción, dentro del sistema, sin hablar con nadie. Cancelar no borra tus datos: siguen disponibles para exportación durante el plazo descrito en la Política de Privacidad.",
          en: "From the subscription screen inside the system, without talking to anyone. Cancelling does not erase your data: it stays available for export for the period described in the Privacy Policy.",
        },
      ],
    },
    {
      titulo: { pt: "Prazo do estorno", es: "Plazo del reembolso", en: "Refund timing" },
      paragrafos: [
        {
          pt: "O estorno é emitido em até 5 dias úteis do pedido. Quando ele aparece na sua fatura depende do emissor do cartão, e costuma levar de um a dois ciclos de fatura — esse trecho do caminho não está sob controle do {operador}.",
          es: "El reembolso se emite en hasta 5 días hábiles desde la solicitud. Cuándo aparece en tu resumen depende del emisor de la tarjeta y suele tardar de uno a dos ciclos de facturación: ese tramo del camino no está bajo el control de {operador}.",
          en: "The refund is issued within 5 business days of the request. When it shows up on your statement depends on your card issuer and usually takes one to two billing cycles — that stretch of the journey is not under {operador}'s control.",
        },
      ],
    },
  ],
};

const USO_ACEITAVEL: DocumentoLegal = {
  slug: "uso-aceitavel",
  atualizadoEm: ATUALIZADO,
  titulo: {
    pt: "Política de Uso Aceitável",
    es: "Política de Uso Aceptable",
    en: "Acceptable Use Policy",
  },
  resumo: {
    pt: "O que não se pode fazer com o {sistema} — e por que a maior parte destas regras protege você, não o {operador}.",
    es: "Qué no se puede hacer con {sistema} — y por qué la mayoría de estas reglas te protege a ti, no a {operador}.",
    en: "What you must not do with {sistema} — and why most of these rules protect you, not {operador}.",
  },
  secoes: [
    {
      titulo: {
        pt: "Mensagem não solicitada",
        es: "Mensaje no solicitado",
        en: "Unsolicited messaging",
      },
      paragrafos: [
        {
          pt: "Só é permitido enviar mensagem a quem deu o contato e tem relação com a sua empresa. Lista comprada, lista raspada e disparo para número obtido de terceiro estão proibidos.",
          es: "Solo se permite enviar mensajes a quien dio su contacto y tiene relación con tu empresa. La lista comprada, la lista extraída y el envío a un número obtenido de un tercero están prohibidos.",
          en: "You may only message people who gave you their contact details and have a relationship with your company. Bought lists, scraped lists and blasts to numbers obtained from a third party are forbidden.",
        },
        {
          pt: "A proibição não é moralismo: a plataforma de mensagens bane o NÚMERO, não a conta do sistema. Quem descumpre perde o número da própria empresa, e é uma perda que não tem recurso nem backup.",
          es: "La prohibición no es moralismo: la plataforma de mensajería banea el NÚMERO, no la cuenta del sistema. Quien incumple pierde el número de su propia empresa, y es una pérdida sin recurso ni copia de seguridad.",
          en: "This is not moralising: the messaging platform bans the NUMBER, not the system account. Break the rule and you lose your own company's number — a loss with no appeal and no backup.",
        },
      ],
    },
    {
      titulo: {
        pt: "Pedido de parada",
        es: "Solicitud de baja",
        en: "Stop requests",
      },
      paragrafos: [
        {
          pt: "Quem pede para não receber mais mensagens é bloqueado automaticamente para envios pelo próprio sistema. Contornar esse bloqueio — reimportando o contato, trocando de canal ou apagando a marcação — é violação direta desta política.",
          es: "A quien pide no recibir más mensajes, el propio sistema lo bloquea automáticamente para envíos. Sortear ese bloqueo —reimportando el contacto, cambiando de canal o borrando la marca— es una violación directa de esta política.",
          en: "Anyone who asks to stop receiving messages is automatically blocked from sends by the system itself. Working around that block — by re-importing the contact, switching channel or clearing the flag — is a direct breach of this policy.",
        },
      ],
    },
    {
      titulo: {
        pt: "Conteúdo proibido",
        es: "Contenido prohibido",
        en: "Prohibited content",
      },
      paragrafos: [],
      itens: [
        {
          pt: "fraude, golpe, falsa identidade e cobrança de dívida que não existe;",
          es: "fraude, estafa, identidad falsa y cobro de una deuda inexistente;",
          en: "fraud, scams, impersonation and collection of a debt that does not exist;",
        },
        {
          pt: "material que explore criança ou adolescente, de qualquer forma;",
          es: "material que explote a niños o adolescentes, de cualquier forma;",
          en: "material that exploits a child or adolescent, in any form;",
        },
        {
          pt: "incitação a violência, ódio ou discriminação;",
          es: "incitación a la violencia, al odio o a la discriminación;",
          en: "incitement to violence, hatred or discrimination;",
        },
        {
          pt: "venda do que a lei do país de destino proíbe vender por mensagem;",
          es: "venta de lo que la ley del país de destino prohíbe vender por mensaje;",
          en: "selling what the destination country's law forbids selling over messaging;",
        },
        {
          pt: "conselho médico, jurídico ou financeiro apresentado como vindo de profissional habilitado quando quem responde é um agente de inteligência artificial.",
          es: "consejo médico, jurídico o financiero presentado como proveniente de un profesional habilitado cuando quien responde es un agente de inteligencia artificial.",
          en: "medical, legal or financial advice presented as coming from a licensed professional when the one replying is an artificial intelligence agent.",
        },
      ],
    },
    {
      titulo: {
        pt: "Uso do agente de IA",
        es: "Uso del agente de IA",
        en: "Use of the AI agent",
      },
      paragrafos: [
        {
          pt: "O agente atende em nome da sua empresa, e a responsabilidade pelo que ele diz é de quem o configurou. Não é permitido instruí-lo a se passar por pessoa humana quando o cliente pergunta diretamente, nem a negar que é um sistema automático.",
          es: "El agente atiende en nombre de tu empresa, y la responsabilidad por lo que dice es de quien lo configuró. No se permite instruirlo para hacerse pasar por una persona humana cuando el cliente pregunta directamente, ni para negar que es un sistema automático.",
          en: "The agent replies on behalf of your company, and whoever configured it is responsible for what it says. You may not instruct it to pass as a human when the customer asks directly, nor to deny that it is an automated system.",
        },
      ],
    },
    {
      titulo: {
        pt: "Integridade técnica",
        es: "Integridad técnica",
        en: "Technical integrity",
      },
      paragrafos: [
        {
          pt: "É proibido tentar alcançar dados de outra organização, sondar a infraestrutura em busca de falha sem autorização escrita, contornar limite de plano ou de taxa, e revender o acesso como se fosse serviço próprio sem acordo com o {operador}.",
          es: "Está prohibido intentar alcanzar datos de otra organización, sondear la infraestructura en busca de fallas sin autorización escrita, sortear límites de plan o de tasa, y revender el acceso como si fuera un servicio propio sin acuerdo con {operador}.",
          en: "You must not attempt to reach another organisation's data, probe the infrastructure for flaws without written authorisation, work around plan or rate limits, or resell access as if it were your own service without an agreement with {operador}.",
        },
        {
          pt: "Encontrou uma falha de segurança? Avise antes de explorar. Relato de boa-fé nunca é tratado como ataque.",
          es: "¿Encontraste una falla de seguridad? Avisa antes de explotarla. Un reporte de buena fe nunca se trata como un ataque.",
          en: "Found a security flaw? Report it before exploiting it. A good-faith report is never treated as an attack.",
        },
      ],
    },
    {
      titulo: {
        pt: "O que acontece se a política for violada",
        es: "Qué pasa si se viola la política",
        en: "What happens on a breach",
      },
      paragrafos: [
        {
          pt: "A resposta é proporcional: aviso, depois suspensão do envio, depois encerramento da conta. Risco iminente a terceiros — fraude em curso, material que explore criança — pula direto ao encerramento, sem aviso prévio.",
          es: "La respuesta es proporcional: aviso, luego suspensión del envío, luego cierre de la cuenta. Un riesgo inminente a terceros —fraude en curso, material que explote a niños— salta directo al cierre, sin aviso previo.",
          en: "The response is proportionate: warning, then suspension of sending, then account termination. Imminent risk to others — fraud under way, child exploitation material — goes straight to termination, with no prior warning.",
        },
      ],
    },
  ],
};

const SUBPROCESSADORES: DocumentoLegal = {
  slug: "subprocessadores",
  atualizadoEm: ATUALIZADO,
  titulo: {
    pt: "Subprocessadores",
    es: "Subencargados",
    en: "Sub-processors",
  },
  resumo: {
    pt: "As empresas que tocam nos dados tratados pelo {sistema}, e o que cada uma faz com eles.",
    es: "Las empresas que tocan los datos tratados por {sistema}, y qué hace cada una con ellos.",
    en: "The companies that touch data processed by {sistema}, and what each one does with it.",
  },
  secoes: [
    {
      titulo: {
        pt: "Por que esta lista existe",
        es: "Por qué existe esta lista",
        en: "Why this list exists",
      },
      paragrafos: [
        {
          pt: "Nenhum sistema deste porte roda sozinho. A lei de proteção de dados exige que quem contrata saiba a quem mais os dados chegam, e esta é a lista completa dos serviços que o {operador} usa nesta instalação.",
          es: "Ningún sistema de este tamaño funciona solo. La ley de protección de datos exige que quien contrata sepa a quién más llegan los datos, y esta es la lista completa de los servicios que {operador} usa en esta instalación.",
          en: "No system this size runs alone. Data protection law requires the customer to know who else the data reaches, and this is the complete list of services {operador} uses in this installation.",
        },
        {
          pt: "Numa instalação própria em servidor do cliente a lista é menor: cada serviço abaixo só entra em cena quando a chave correspondente está configurada, e o que não está configurado não recebe dado nenhum.",
          es: "En una instalación propia en el servidor del cliente la lista es menor: cada servicio de abajo solo entra en escena cuando la clave correspondiente está configurada, y lo que no está configurado no recibe ningún dato.",
          en: "In a self-hosted install the list is shorter: each service below only comes into play when its key is configured, and anything unconfigured receives no data at all.",
        },
      ],
    },
    {
      titulo: {
        pt: "Infraestrutura",
        es: "Infraestructura",
        en: "Infrastructure",
      },
      paragrafos: [],
      itens: [
        {
          pt: "Hospedagem da aplicação — executa o código e serve as páginas. Vê o tráfego, não guarda o banco.",
          es: "Alojamiento de la aplicación — ejecuta el código y sirve las páginas. Ve el tráfico, no guarda la base de datos.",
          en: "Application hosting — runs the code and serves the pages. Sees the traffic, does not hold the database.",
        },
        {
          pt: "Banco de dados e armazenamento de arquivos — guarda contatos, conversas, negócios e mídia. É onde o dado realmente mora.",
          es: "Base de datos y almacenamiento de archivos — guarda contactos, conversaciones, negocios y medios. Es donde el dato realmente vive.",
          en: "Database and file storage — holds contacts, conversations, deals and media. This is where the data actually lives.",
        },
        {
          pt: "Cache e controle de taxa — guarda contadores de curta duração. Não recebe conteúdo de mensagem.",
          es: "Caché y control de tasa — guarda contadores de corta duración. No recibe contenido de mensajes.",
          en: "Cache and rate limiting — holds short-lived counters. Receives no message content.",
        },
      ],
    },
    {
      titulo: {
        pt: "Mensagens e comunicação",
        es: "Mensajería y comunicación",
        en: "Messaging and communication",
      },
      paragrafos: [],
      itens: [
        {
          pt: "Plataforma de mensagens — entrega e recebe as conversas do canal conectado. Trata número de telefone e conteúdo de mensagem, sob os termos da própria plataforma.",
          es: "Plataforma de mensajería — entrega y recibe las conversaciones del canal conectado. Trata el número de teléfono y el contenido del mensaje, bajo los términos de la propia plataforma.",
          en: "Messaging platform — delivers and receives the conversations of the connected channel. Handles phone numbers and message content, under the platform's own terms.",
        },
        {
          pt: "Envio de e-mail transacional — entrega confirmação de cadastro, recuperação de senha e avisos. Trata nome e endereço de e-mail.",
          es: "Envío de correo transaccional — entrega confirmación de registro, recuperación de contraseña y avisos. Trata nombre y dirección de correo.",
          en: "Transactional email delivery — sends sign-up confirmations, password resets and notices. Handles name and email address.",
        },
      ],
    },
    {
      titulo: {
        pt: "Inteligência artificial",
        es: "Inteligencia artificial",
        en: "Artificial intelligence",
      },
      paragrafos: [
        {
          pt: "Os modelos que respondem no lugar de uma pessoa recebem o trecho da conversa necessário para responder, e o conhecimento que você carregou. Os contratos de uso corporativo desses fornecedores não permitem treinar modelo com o que passa pela interface de programação — e é por isso que o acesso é feito por essa via, e não pela interface de consumidor.",
          es: "Los modelos que responden en lugar de una persona reciben el fragmento de conversación necesario para responder y el conocimiento que cargaste. Los contratos de uso corporativo de esos proveedores no permiten entrenar modelos con lo que pasa por la interfaz de programación — y por eso el acceso se hace por esa vía, y no por la interfaz de consumidor.",
          en: "The models that answer in a person's place receive the slice of conversation needed to reply, plus the knowledge you uploaded. These vendors' business terms do not allow training models on what goes through the programming interface — which is precisely why access happens that way, and not through the consumer interface.",
        },
      ],
    },
    {
      titulo: {
        pt: "Pagamento e monitoramento",
        es: "Pago y monitoreo",
        en: "Payment and monitoring",
      },
      paragrafos: [],
      itens: [
        {
          pt: "Processador de pagamento — trata os dados do cartão. O número do cartão NUNCA passa pelo {sistema} nem é guardado nele; o navegador fala direto com o processador.",
          es: "Procesador de pago — trata los datos de la tarjeta. El número de la tarjeta NUNCA pasa por {sistema} ni se guarda en él; el navegador habla directamente con el procesador.",
          en: "Payment processor — handles card details. The card number NEVER passes through {sistema} and is never stored in it; the browser talks to the processor directly.",
        },
        {
          pt: "Monitoramento de erro — recebe o relato técnico de uma falha. O relato é higienizado antes de sair: dado pessoal e segredo são removidos.",
          es: "Monitoreo de errores — recibe el reporte técnico de una falla. El reporte se higieniza antes de salir: el dato personal y los secretos se eliminan.",
          en: "Error monitoring — receives the technical report of a failure. The report is sanitised before it leaves: personal data and secrets are stripped.",
        },
      ],
    },
    {
      titulo: {
        pt: "Mudanças nesta lista",
        es: "Cambios en esta lista",
        en: "Changes to this list",
      },
      paragrafos: [
        {
          pt: "Um subprocessador novo é anunciado com antecedência razoável antes de passar a tratar dados. Quem discordar pode cancelar sem multa, pelo caminho descrito na Política de Reembolso.",
          es: "Un subencargado nuevo se anuncia con antelación razonable antes de pasar a tratar datos. Quien no esté de acuerdo puede cancelar sin multa, por el camino descrito en la Política de Reembolso.",
          en: "A new sub-processor is announced a reasonable time before it starts processing data. Anyone who disagrees may cancel without penalty, by the route described in the Refund Policy.",
        },
      ],
    },
  ],
};

const SEGURANCA: DocumentoLegal = {
  slug: "seguranca",
  atualizadoEm: ATUALIZADO,
  titulo: {
    pt: "Segurança",
    es: "Seguridad",
    en: "Security",
  },
  resumo: {
    pt: "O que o {sistema} faz para proteger os dados, o que ele não faz, e como avisar sobre uma falha.",
    es: "Qué hace {sistema} para proteger los datos, qué no hace, y cómo avisar de una falla.",
    en: "What {sistema} does to protect data, what it does not do, and how to report a flaw.",
  },
  secoes: [
    {
      titulo: {
        pt: "Separação entre organizações",
        es: "Separación entre organizaciones",
        en: "Separation between organisations",
      },
      paragrafos: [
        {
          pt: "Toda tabela que guarda dado de cliente carrega a organização dona, e o banco aplica a regra de isolamento por conta própria — não é a aplicação que filtra, é o próprio Postgres que recusa a linha alheia. Um teste automático cria duas organizações e prova o não-vazamento a cada alteração do código, antes de ela ser aceita.",
          es: "Toda tabla que guarda dato de cliente lleva la organización dueña, y la base de datos aplica la regla de aislamiento por su cuenta: no es la aplicación la que filtra, es el propio Postgres el que rechaza la fila ajena. Una prueba automática crea dos organizaciones y demuestra la no fuga en cada cambio del código, antes de que sea aceptado.",
          en: "Every table holding customer data carries its owning organisation, and the database enforces isolation itself — it is not the application that filters, it is Postgres refusing the other tenant's row. An automated test creates two organisations and proves non-leakage on every code change, before it is accepted.",
        },
      ],
    },
    {
      titulo: {
        pt: "Acesso e autenticação",
        es: "Acceso y autenticación",
        en: "Access and authentication",
      },
      paragrafos: [
        {
          pt: "A senha nunca é guardada; o que fica é uma derivação irreversível dela. A sessão vive num cookie que o JavaScript da página não consegue ler e que não viaja para outro site. Verificação em duas etapas está disponível e pode ser exigida de todo mundo da organização por quem administra.",
          es: "La contraseña nunca se guarda; lo que queda es una derivación irreversible de ella. La sesión vive en una cookie que el JavaScript de la página no puede leer y que no viaja a otro sitio. La verificación en dos pasos está disponible y quien administra puede exigirla a toda la organización.",
          en: "Passwords are never stored; what remains is an irreversible derivation of them. The session lives in a cookie the page's JavaScript cannot read and that never travels to another site. Two-step verification is available and can be required of everyone in the organisation by whoever administers it.",
        },
        {
          pt: "Chave de programação é mostrada UMA vez, na criação, e depois só existe como resumo criptográfico — nem quem opera o servidor consegue lê-la de volta.",
          es: "La clave de programación se muestra UNA vez, al crearla, y después solo existe como resumen criptográfico: ni quien opera el servidor puede leerla de vuelta.",
          en: "An API key is shown ONCE, at creation, and afterwards exists only as a cryptographic digest — not even whoever runs the server can read it back.",
        },
      ],
    },
    {
      titulo: {
        pt: "Registro do que foi feito",
        es: "Registro de lo que se hizo",
        en: "Record of what was done",
      },
      paragrafos: [
        {
          pt: "Toda alteração relevante deixa uma linha de auditoria com quem fez, o quê e quando. O registro é só-acréscimo pelo desenho do banco: nenhum papel tem permissão de alterar ou apagar linha individual, nem o papel administrativo do próprio servidor.",
          es: "Toda alteración relevante deja una línea de auditoría con quién, qué y cuándo. El registro es solo de adición por el diseño de la base: ningún rol tiene permiso para alterar o borrar una línea individual, ni siquiera el rol administrativo del propio servidor.",
          en: "Every meaningful change leaves an audit line with who, what and when. The record is append-only by database design: no role may alter or delete an individual line, not even the server's own administrative role.",
        },
      ],
    },
    {
      titulo: {
        pt: "O que este documento NÃO afirma",
        es: "Lo que este documento NO afirma",
        en: "What this document does NOT claim",
      },
      paragrafos: [
        {
          pt: "Não há certificação SOC 2 nem ISO 27001, e não houve teste de invasão por empresa independente. Dizer o contrário seria mais fácil e é exatamente o tipo de frase que transforma um documento de segurança em risco jurídico. Quando algum desses passos existir, ele será descrito aqui com a data e o escopo.",
          es: "No hay certificación SOC 2 ni ISO 27001, y no hubo prueba de intrusión por una empresa independiente. Decir lo contrario sería más fácil y es exactamente el tipo de frase que convierte un documento de seguridad en un riesgo jurídico. Cuando alguno de esos pasos exista, se describirá aquí con fecha y alcance.",
          en: "There is no SOC 2 or ISO 27001 certification, and no independent penetration test has been performed. Claiming otherwise would be easier, and it is exactly the kind of sentence that turns a security page into legal exposure. When any of those steps exists, it will be described here with its date and scope.",
        },
      ],
    },
    {
      titulo: {
        pt: "Avisar sobre uma falha",
        es: "Avisar de una falla",
        en: "Reporting a flaw",
      },
      paragrafos: [
        {
          pt: "Relate pela página de contato, descrevendo como reproduzir. Peça-se apenas que a falha não seja explorada além do necessário para demonstrá-la e que dado de terceiro não seja acessado. Relato de boa-fé nunca gera medida contra quem relatou.",
          es: "Repórtala por la página de contacto, describiendo cómo reproducirla. Solo se pide que la falla no se explote más allá de lo necesario para demostrarla y que no se acceda a datos de terceros. Un reporte de buena fe nunca genera medidas contra quien lo hizo.",
          en: "Report it through the contact page, describing how to reproduce it. All that is asked is that the flaw not be exploited beyond what is needed to demonstrate it, and that no third party's data be accessed. A good-faith report never triggers action against the reporter.",
        },
        {
          pt: "Incidente que atinja dado pessoal é comunicado a quem foi afetado e à autoridade competente nos prazos que a lei aplicável determinar.",
          es: "Un incidente que afecte datos personales se comunica a los afectados y a la autoridad competente en los plazos que determine la ley aplicable.",
          en: "An incident affecting personal data is reported to those affected and to the competent authority within the deadlines the applicable law sets.",
        },
      ],
    },
  ],
};

const DPA: DocumentoLegal = {
  slug: "dpa",
  atualizadoEm: ATUALIZADO,
  titulo: {
    pt: "Acordo de Tratamento de Dados",
    es: "Acuerdo de Tratamiento de Datos",
    en: "Data Processing Agreement",
  },
  resumo: {
    pt: "Quem é controlador, quem é operador, e o que cada um deve ao outro quando há dado pessoal de terceiro em jogo.",
    es: "Quién es responsable, quién es encargado, y qué se deben el uno al otro cuando hay datos personales de terceros en juego.",
    en: "Who is controller, who is processor, and what each owes the other when a third party's personal data is involved.",
  },
  secoes: [
    {
      titulo: {
        pt: "Os papéis, e por que a ordem importa",
        es: "Los roles, y por qué el orden importa",
        en: "The roles, and why the order matters",
      },
      paragrafos: [
        {
          pt: "Você é o CONTROLADOR dos dados dos seus clientes: foi você quem decidiu coletá-los e para quê. O {operador} é o OPERADOR: trata esses dados apenas para prestar o serviço, seguindo a sua instrução.",
          es: "Tú eres el RESPONSABLE de los datos de tus clientes: fuiste tú quien decidió recolectarlos y para qué. {operador} es el ENCARGADO: trata esos datos solo para prestar el servicio, siguiendo tu instrucción.",
          en: "You are the CONTROLLER of your customers' data: you decided to collect it and for what purpose. {operador} is the PROCESSOR: it handles that data only to deliver the service, following your instruction.",
        },
        {
          pt: "A inversão desses papéis é o erro mais comum e o mais caro. É por isso que os documentos que a lei exige nomeiam você, e não o software — o software não decide nada sobre os dados dos seus clientes.",
          es: "La inversión de esos roles es el error más común y el más caro. Por eso los documentos que la ley exige te nombran a ti, y no al software: el software no decide nada sobre los datos de tus clientes.",
          en: "Swapping those roles is the most common and the most expensive mistake. That is why the documents the law requires name you, not the software — the software decides nothing about your customers' data.",
        },
      ],
    },
    {
      titulo: {
        pt: "Objeto e duração",
        es: "Objeto y duración",
        en: "Subject matter and duration",
      },
      paragrafos: [
        {
          pt: "O tratamento cobre contato, conversa, negócio e arquivo trocado nos canais conectados, pelo tempo em que a assinatura estiver ativa, e pelo prazo de retenção declarado na Política de Privacidade depois disso.",
          es: "El tratamiento cubre contacto, conversación, negocio y archivo intercambiado en los canales conectados, mientras la suscripción esté activa, y por el plazo de retención declarado en la Política de Privacidad después de eso.",
          en: "Processing covers contacts, conversations, deals and files exchanged on the connected channels, for as long as the subscription is active, and for the retention period stated in the Privacy Policy thereafter.",
        },
      ],
    },
    {
      titulo: {
        pt: "Obrigações do operador",
        es: "Obligaciones del encargado",
        en: "Processor obligations",
      },
      paragrafos: [],
      itens: [
        {
          pt: "tratar os dados só conforme a sua instrução, e avisar se uma instrução parecer ilegal;",
          es: "tratar los datos solo conforme a tu instrucción, y avisar si una instrucción parece ilegal;",
          en: "process data only on your instruction, and flag an instruction that appears unlawful;",
        },
        {
          pt: "manter as medidas de segurança descritas na página de Segurança;",
          es: "mantener las medidas de seguridad descritas en la página de Seguridad;",
          en: "maintain the security measures described on the Security page;",
        },
        {
          pt: "obrigar ao sigilo quem tiver acesso aos dados;",
          es: "obligar a la confidencialidad a quien tenga acceso a los datos;",
          en: "bind to confidentiality anyone with access to the data;",
        },
        {
          pt: "ajudar você a responder pedido de titular — acesso, correção, portabilidade, eliminação — com as ferramentas do próprio sistema;",
          es: "ayudarte a responder la solicitud de un titular —acceso, corrección, portabilidad, eliminación— con las herramientas del propio sistema;",
          en: "help you answer a data subject request — access, correction, portability, erasure — using the system's own tools;",
        },
        {
          pt: "avisar sem demora indevida sobre incidente que atinja dado pessoal;",
          es: "avisar sin demora indebida sobre un incidente que afecte datos personales;",
          en: "notify you without undue delay of an incident affecting personal data;",
        },
        {
          pt: "eliminar ou devolver os dados ao fim do contrato, à sua escolha.",
          es: "eliminar o devolver los datos al final del contrato, a tu elección.",
          en: "delete or return the data at the end of the contract, as you choose.",
        },
      ],
    },
    {
      titulo: {
        pt: "Obrigações do controlador",
        es: "Obligaciones del responsable",
        en: "Controller obligations",
      },
      paragrafos: [
        {
          pt: "Cabe a você ter base legal para tratar os dados que carrega aqui, informar os seus clientes sobre esse tratamento, e não usar o sistema para finalidade diferente da que originou a coleta.",
          es: "Te corresponde tener base legal para tratar los datos que cargas aquí, informar a tus clientes sobre ese tratamiento, y no usar el sistema para una finalidad distinta de la que originó la recolección.",
          en: "It is on you to have a lawful basis for the data you load here, to inform your customers about that processing, and not to use the system for a purpose other than the one that prompted collection.",
        },
      ],
    },
    {
      titulo: {
        pt: "Subprocessadores e transferência internacional",
        es: "Subencargados y transferencia internacional",
        en: "Sub-processors and international transfer",
      },
      paragrafos: [
        {
          pt: "Você autoriza os subprocessadores listados na página correspondente, e é avisado antes de qualquer inclusão. Parte deles opera fora do seu país; a transferência se apoia nas cláusulas contratuais padrão do próprio fornecedor e nos requisitos da lei aplicável.",
          es: "Autorizas a los subencargados listados en la página correspondiente, y se te avisa antes de cualquier incorporación. Parte de ellos opera fuera de tu país; la transferencia se apoya en las cláusulas contractuales estándar del propio proveedor y en los requisitos de la ley aplicable.",
          en: "You authorise the sub-processors listed on the corresponding page, and you are notified before any addition. Some of them operate outside your country; transfer relies on the vendor's own standard contractual clauses and on the requirements of applicable law.",
        },
      ],
    },
    {
      titulo: {
        pt: "Auditoria",
        es: "Auditoría",
        en: "Audit",
      },
      paragrafos: [
        {
          pt: "Mediante pedido razoável, o {operador} fornece as informações necessárias para demonstrar o cumprimento destas obrigações. Não há hoje relatório de auditoria independente a apresentar — ver a ressalva na página de Segurança.",
          es: "Ante una solicitud razonable, {operador} proporciona la información necesaria para demostrar el cumplimiento de estas obligaciones. Hoy no hay un informe de auditoría independiente que presentar — ver la salvedad en la página de Seguridad.",
          en: "On reasonable request, {operador} provides the information needed to demonstrate compliance with these obligations. There is no independent audit report to present today — see the caveat on the Security page.",
        },
      ],
    },
  ],
};

export const DOCUMENTOS_LEGAIS: readonly DocumentoLegal[] = [
  COOKIES,
  REEMBOLSO,
  USO_ACEITAVEL,
  SUBPROCESSADORES,
  SEGURANCA,
  DPA,
];

export function documentoPorSlug(slug: string): DocumentoLegal | null {
  return DOCUMENTOS_LEGAIS.find((d) => d.slug === slug) ?? null;
}

/**
 * A frase no idioma pedido, com `{sistema}` e `{operador}` já resolvidos.
 *
 * A substituição é global e literal — nada de expressão regular com grupo, que
 * transformaria um `$&` vindo do nome comercial do operador em injeção de
 * texto no documento.
 */
export function frase(
  f: Frase,
  idioma: "pt-BR" | "es" | "en",
  nomes: { sistema: string; operador: string },
): string {
  const base = idioma === "es" ? f.es : idioma === "en" ? f.en : f.pt;
  return base.split("{sistema}").join(nomes.sistema).split("{operador}").join(nomes.operador);
}
