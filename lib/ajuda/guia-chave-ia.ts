/**
 * O GUIA DA CHAVE DE IA — para quem nunca abriu um painel de desenvolvedor.
 *
 * A IA do produto roda na conta do PRÓPRIO cliente (ver `lib/ai/pontos/provedores.ts`).
 * Para um dono de empresa isso é a maior fricção da assinatura: "API",
 * "chave", "créditos" são palavras de outro mundo. Este guia diz, por provedor,
 * onde clicar, quanto custa para começar e onde colar a chave — com o link
 * EXATO de cada página (conferidos em 12/10/2026).
 *
 * Fatos de cada provedor (mínimo de crédito, cartão) vêm da documentação
 * oficial; quando um deles mudar, é aqui que se corrige.
 */

import { DEFAULT_APP_NAME } from "@/lib/branding";

export type IdiomaDoGuia = "pt-BR" | "es" | "en";
export type ProvedorDoGuia = "openai" | "anthropic" | "google" | "openrouter";

export interface PassoDoGuia {
  readonly titulo: string;
  readonly texto: string;
  readonly link?: { readonly rotulo: string; readonly href: string };
}

export interface GuiaDoProvedor {
  readonly id: ProvedorDoGuia;
  readonly nome: string;
  /** Uma frase: por que escolher este. */
  readonly resumo: string;
  /** Selo curto no cartão (ex.: "Mais simples"). */
  readonly selo?: string;
  readonly custo: string;
  readonly tempo: string;
  readonly passos: readonly PassoDoGuia[];
  readonly atencao?: string;
  /** O passo a passo narrado — só existe para a marca do produto e no idioma gravado. */
  readonly video?: { readonly src: string; readonly poster: string };
}

export interface PerguntaDoAssistente {
  readonly pergunta: string;
  readonly resposta: string;
}

export interface GuiaCompleto {
  readonly titulo: string;
  readonly intro: string;
  readonly recomendacao: string;
  readonly provedores: readonly GuiaDoProvedor[];
  readonly assistenteTitulo: string;
  readonly assistenteIntro: string;
  readonly perguntas: readonly PerguntaDoAssistente[];
  readonly ui: {
    readonly passos: string;
    readonly custo: string;
    readonly tempo: string;
    readonly abrir: string;
    readonly atencao: string;
    readonly copiar: string;
    readonly video: string;
  };
}

const LINKS = {
  openai: {
    cadastro: "https://platform.openai.com/signup",
    cobranca: "https://platform.openai.com/settings/organization/billing/overview",
    chaves: "https://platform.openai.com/api-keys",
  },
  anthropic: {
    cadastro: "https://console.anthropic.com/",
    cobranca: "https://console.anthropic.com/settings/billing",
    chaves: "https://console.anthropic.com/settings/keys",
  },
  google: {
    cadastro: "https://aistudio.google.com/",
    chaves: "https://aistudio.google.com/apikey",
  },
  openrouter: {
    cadastro: "https://openrouter.ai/",
    cobranca: "https://openrouter.ai/settings/credits",
    chaves: "https://openrouter.ai/settings/keys",
  },
} as const;

/** Onde colar a chave dentro do produto. */
export const CAMINHO_DAS_CHAVES = "/app/ai/credentials";

const PT: GuiaCompleto = {
  titulo: "Como conseguir a chave de IA (passo a passo)",
  intro:
    'O agente de IA usa uma conta de inteligência artificial em seu nome. Você cria essa conta uma vez, coloca um pouco de crédito, copia uma "chave" (um código) e cola na {marca}. Leva uns 10 minutos e você só paga o que usar, direto ao provedor.',
  recomendacao:
    "Não sabe qual escolher? Comece pela OpenAI: uma chave só faz tudo — conversa, áudio e leitura do seu material.",
  provedores: [
    {
      id: "openai",
      nome: "OpenAI (ChatGPT)",
      selo: "Mais simples",
      resumo: "Uma chave faz tudo: conversa, transcrição de áudio e leitura do seu material.",
      custo: "Crédito mínimo de US$ 5 (pago antecipado, sem mensalidade).",
      tempo: "Cerca de 10 minutos",
      passos: [
        {
          titulo: "Crie a conta",
          texto:
            "Entre com seu e-mail ou conta Google. É uma conta diferente do ChatGPT Plus — a assinatura do ChatGPT não serve aqui.",
          link: { rotulo: "Abrir cadastro da OpenAI", href: LINKS.openai.cadastro },
        },
        {
          titulo: "Coloque crédito",
          texto:
            'Em Billing, clique em "Add payment details", cadastre o cartão e escolha o valor inicial (mínimo US$ 5; US$ 10 dura bastante para começar). Deixe a recarga automática desligada se preferir controlar o gasto.',
          link: { rotulo: "Abrir a página de cobrança", href: LINKS.openai.cobranca },
        },
        {
          titulo: "Crie a chave",
          texto:
            'Em API keys, clique em "Create new secret key", dê o nome {marca} e clique em criar. Copie o código que começa com sk- — ele só aparece uma vez.',
          link: { rotulo: "Abrir a página de chaves", href: LINKS.openai.chaves },
        },
        {
          titulo: "Cole na {marca}",
          texto:
            "Em IA › Credenciais, clique em Adicionar credencial, escolha OpenAI, cole a chave e salve. A {marca} confere na hora se ela funciona.",
          link: { rotulo: "Abrir Credenciais", href: CAMINHO_DAS_CHAVES },
        },
      ],
      atencao: "O cartão precisa estar liberado para compras internacionais em dólar.",
    },
    {
      id: "anthropic",
      nome: "Anthropic (Claude)",
      selo: "Melhor conversa",
      resumo:
        "A IA que melhor segue instruções e conversa com o cliente. Para áudio e material, some uma chave da OpenAI.",
      custo: "Crédito mínimo de US$ 5 (pago antecipado).",
      tempo: "Cerca de 10 minutos",
      passos: [
        {
          titulo: "Crie a conta",
          texto:
            "Cadastre-se no Console da Anthropic com seu e-mail. Não é a mesma coisa que a assinatura do Claude.ai.",
          link: { rotulo: "Abrir o Console da Anthropic", href: LINKS.anthropic.cadastro },
        },
        {
          titulo: "Coloque crédito",
          texto:
            'Em Settings › Billing, clique em "Buy credits" (ou "Add funds"), cadastre o cartão e compre a partir de US$ 5.',
          link: { rotulo: "Abrir a página de cobrança", href: LINKS.anthropic.cobranca },
        },
        {
          titulo: "Crie a chave",
          texto:
            'Em Settings › API Keys, clique em "Create Key", dê o nome {marca} e copie o código que começa com sk-ant-. Ele só aparece uma vez.',
          link: { rotulo: "Abrir a página de chaves", href: LINKS.anthropic.chaves },
        },
        {
          titulo: "Cole na {marca}",
          texto:
            "Em IA › Credenciais, clique em Adicionar credencial, escolha Anthropic (Claude), cole e salve.",
          link: { rotulo: "Abrir Credenciais", href: CAMINHO_DAS_CHAVES },
        },
      ],
      atencao:
        "Só aceita cartão de crédito ou débito liberado para pagamentos internacionais em dólar.",
    },
    {
      id: "google",
      nome: "Google (Gemini)",
      selo: "Começa sem cartão",
      resumo: "Dá para criar a chave sem cartão e testar no plano gratuito, com limite de uso.",
      custo:
        "Gratuito para testar (com limite). Para uso contínuo, ative a cobrança no Google Cloud.",
      tempo: "Cerca de 3 minutos",
      passos: [
        {
          titulo: "Entre com sua conta Google",
          texto: "Abra o Google AI Studio e faça login com o Gmail da empresa.",
          link: { rotulo: "Abrir o Google AI Studio", href: LINKS.google.cadastro },
        },
        {
          titulo: "Crie a chave",
          texto:
            'Na página "Get API key", clique em "Create API key", escolha (ou crie) um projeto e copie o código que começa com AIza.',
          link: { rotulo: "Abrir a página de chaves", href: LINKS.google.chaves },
        },
        {
          titulo: "Cole na {marca}",
          texto:
            "Em IA › Credenciais, clique em Adicionar credencial, escolha Google (Gemini), cole e salve.",
          link: { rotulo: "Abrir Credenciais", href: CAMINHO_DAS_CHAVES },
        },
      ],
      atencao:
        "No plano gratuito o Google pode usar as conversas para melhorar os produtos dele e há limite de uso por minuto. Para atender clientes de verdade, ative a cobrança no projeto.",
    },
    {
      id: "openrouter",
      nome: "OpenRouter",
      selo: "Vários modelos",
      resumo:
        "Uma chave dá acesso a centenas de modelos de vários fabricantes, inclusive alguns gratuitos.",
      custo: "Créditos pré-pagos, a partir de poucos dólares. Aceita cartão.",
      tempo: "Cerca de 5 minutos",
      passos: [
        {
          titulo: "Crie a conta",
          texto: "Cadastre-se no OpenRouter com e-mail ou conta Google.",
          link: { rotulo: "Abrir o OpenRouter", href: LINKS.openrouter.cadastro },
        },
        {
          titulo: "Coloque crédito",
          texto: 'Em Settings › Credits, clique em "Add Credits" e escolha o valor.',
          link: { rotulo: "Abrir a página de créditos", href: LINKS.openrouter.cobranca },
        },
        {
          titulo: "Crie a chave",
          texto:
            'Em Settings › Keys, clique em "Create Key", dê o nome {marca} e copie o código que começa com sk-or-.',
          link: { rotulo: "Abrir a página de chaves", href: LINKS.openrouter.chaves },
        },
        {
          titulo: "Cole na {marca}",
          texto:
            "Em IA › Credenciais, clique em Adicionar credencial, escolha OpenRouter, cole e salve.",
          link: { rotulo: "Abrir Credenciais", href: CAMINHO_DAS_CHAVES },
        },
      ],
      atencao: "Para transcrever áudio e ler o seu material, some uma chave da OpenAI.",
    },
  ],
  assistenteTitulo: "Dúvidas rápidas",
  assistenteIntro: "Toque numa pergunta para ver a resposta.",
  perguntas: [
    {
      pergunta: 'O que é uma "chave de API"?',
      resposta:
        "É uma senha em forma de código que deixa a {marca} usar a inteligência artificial na SUA conta do provedor. Você cria uma vez e cola aqui; ela fica guardada criptografada.",
    },
    {
      pergunta: "Quanto vou gastar por mês?",
      resposta:
        "Depende de quantas conversas a IA atende. Para um pequeno negócio, os US$ 5 a US$ 10 iniciais costumam durar semanas. Você vê o consumo no painel da {marca} e no do provedor, e só paga o que usar.",
    },
    {
      pergunta: "Minha assinatura do ChatGPT ou do Claude serve?",
      resposta:
        "Não. As assinaturas Plus/Pro são para usar o chat no site. A {marca} precisa da conta de API (platform.openai.com ou console.anthropic.com), que é cobrada por uso.",
    },
    {
      pergunta: "Qual provedor eu escolho?",
      resposta:
        "Se não sabe, OpenAI: uma chave faz tudo. Se quer a conversa mais natural, Claude (Anthropic) mais uma chave OpenAI para áudio. Para testar sem cartão, Google Gemini.",
    },
    {
      pergunta: "Meu cartão foi recusado. E agora?",
      resposta:
        "OpenAI e Anthropic cobram em dólar. Peça ao banco para liberar compras internacionais online, ou use um cartão internacional/virtual. Também dá para começar pelo Google Gemini, sem cartão.",
    },
    {
      pergunta: "Copiei a chave e perdi. Tem como ver de novo?",
      resposta:
        "Não — por segurança o provedor mostra a chave uma vez só. Crie uma chave nova no mesmo lugar e cole na {marca}; a antiga pode ser apagada.",
    },
    {
      pergunta: "A {marca} disse que a chave falhou na validação.",
      resposta:
        "Os motivos mais comuns: a conta está sem crédito, a chave foi copiada pela metade ou com espaço no fim, ou o provedor errado foi escolhido no formulário. Confira e salve de novo.",
    },
    {
      pergunta: "A {marca} cobra alguma taxa sobre a IA?",
      resposta:
        "Não. O uso da IA é pago direto ao provedor, sem taxa nossa por cima. A assinatura da {marca} é só o plano.",
    },
  ],
  ui: {
    passos: "Passo a passo",
    custo: "Custo para começar",
    tempo: "Tempo",
    abrir: "Abrir",
    atencao: "Atenção",
    copiar: "Copiar link",
    video: "Assista ao passo a passo",
  },
};

const ES: GuiaCompleto = {
  titulo: "Cómo conseguir la clave de IA (paso a paso)",
  intro:
    'El agente de IA usa una cuenta de inteligencia artificial a su nombre. Usted crea esa cuenta una vez, carga un poco de crédito, copia una "clave" (un código) y la pega en {marca}. Toma unos 10 minutos y solo paga lo que use, directo al proveedor.',
  recomendacao:
    "¿No sabe cuál elegir? Empiece por OpenAI: una sola clave hace todo — conversación, audio y lectura de su material.",
  provedores: [
    {
      id: "openai",
      nome: "OpenAI (ChatGPT)",
      selo: "Más simple",
      resumo: "Una clave hace todo: conversación, transcripción de audio y lectura de su material.",
      custo: "Crédito mínimo de US$ 5 (prepago, sin mensualidad).",
      tempo: "Unos 10 minutos",
      passos: [
        {
          titulo: "Cree la cuenta",
          texto:
            "Entre con su correo o cuenta de Google. Es distinta de ChatGPT Plus: esa suscripción no sirve aquí.",
          link: { rotulo: "Abrir registro de OpenAI", href: LINKS.openai.cadastro },
        },
        {
          titulo: "Cargue crédito",
          texto:
            'En Billing, haga clic en "Add payment details", registre la tarjeta y elija el monto inicial (mínimo US$ 5; con US$ 10 alcanza para empezar).',
          link: { rotulo: "Abrir la página de cobro", href: LINKS.openai.cobranca },
        },
        {
          titulo: "Cree la clave",
          texto:
            'En API keys, haga clic en "Create new secret key", nómbrela {marca} y copie el código que empieza con sk-. Solo se muestra una vez.',
          link: { rotulo: "Abrir la página de claves", href: LINKS.openai.chaves },
        },
        {
          titulo: "Péguela en {marca}",
          texto:
            "En IA › Credenciales, haga clic en Añadir credencial, elija OpenAI, pegue la clave y guarde. {marca} verifica al momento si funciona.",
          link: { rotulo: "Abrir Credenciales", href: CAMINHO_DAS_CHAVES },
        },
      ],
      atencao: "La tarjeta debe estar habilitada para compras internacionales en dólares.",
    },
    {
      id: "anthropic",
      nome: "Anthropic (Claude)",
      selo: "Mejor conversación",
      resumo:
        "La IA que mejor sigue instrucciones y conversa con el cliente. Para audio y material, sume una clave de OpenAI.",
      custo: "Crédito mínimo de US$ 5 (prepago).",
      tempo: "Unos 10 minutos",
      passos: [
        {
          titulo: "Cree la cuenta",
          texto:
            "Regístrese en la Consola de Anthropic con su correo. No es lo mismo que la suscripción de Claude.ai.",
          link: { rotulo: "Abrir la Consola de Anthropic", href: LINKS.anthropic.cadastro },
        },
        {
          titulo: "Cargue crédito",
          texto:
            'En Settings › Billing, haga clic en "Buy credits" (o "Add funds") y compre desde US$ 5.',
          link: { rotulo: "Abrir la página de cobro", href: LINKS.anthropic.cobranca },
        },
        {
          titulo: "Cree la clave",
          texto:
            'En Settings › API Keys, haga clic en "Create Key", nómbrela {marca} y copie el código que empieza con sk-ant-.',
          link: { rotulo: "Abrir la página de claves", href: LINKS.anthropic.chaves },
        },
        {
          titulo: "Péguela en {marca}",
          texto:
            "En IA › Credenciales, haga clic en Añadir credencial, elija Anthropic (Claude), pegue y guarde.",
          link: { rotulo: "Abrir Credenciales", href: CAMINHO_DAS_CHAVES },
        },
      ],
      atencao: "Solo acepta tarjetas habilitadas para pagos internacionales en dólares.",
    },
    {
      id: "google",
      nome: "Google (Gemini)",
      selo: "Empieza sin tarjeta",
      resumo: "Puede crear la clave sin tarjeta y probar en el plan gratuito, con límite de uso.",
      custo:
        "Gratis para probar (con límite). Para uso continuo, active la facturación en Google Cloud.",
      tempo: "Unos 3 minutos",
      passos: [
        {
          titulo: "Entre con su cuenta de Google",
          texto: "Abra Google AI Studio e inicie sesión con el Gmail de la empresa.",
          link: { rotulo: "Abrir Google AI Studio", href: LINKS.google.cadastro },
        },
        {
          titulo: "Cree la clave",
          texto:
            'En "Get API key", haga clic en "Create API key", elija (o cree) un proyecto y copie el código que empieza con AIza.',
          link: { rotulo: "Abrir la página de claves", href: LINKS.google.chaves },
        },
        {
          titulo: "Péguela en {marca}",
          texto:
            "En IA › Credenciales, haga clic en Añadir credencial, elija Google (Gemini), pegue y guarde.",
          link: { rotulo: "Abrir Credenciales", href: CAMINHO_DAS_CHAVES },
        },
      ],
      atencao:
        "En el plan gratuito Google puede usar las conversaciones para mejorar sus productos y hay límite por minuto. Para atender clientes reales, active la facturación del proyecto.",
    },
    {
      id: "openrouter",
      nome: "OpenRouter",
      selo: "Muchos modelos",
      resumo:
        "Una clave da acceso a cientos de modelos de varios fabricantes, incluso algunos gratuitos.",
      custo: "Créditos prepagos desde pocos dólares. Acepta tarjeta.",
      tempo: "Unos 5 minutos",
      passos: [
        {
          titulo: "Cree la cuenta",
          texto: "Regístrese en OpenRouter con correo o cuenta de Google.",
          link: { rotulo: "Abrir OpenRouter", href: LINKS.openrouter.cadastro },
        },
        {
          titulo: "Cargue crédito",
          texto: 'En Settings › Credits, haga clic en "Add Credits" y elija el monto.',
          link: { rotulo: "Abrir la página de créditos", href: LINKS.openrouter.cobranca },
        },
        {
          titulo: "Cree la clave",
          texto:
            'En Settings › Keys, haga clic en "Create Key", nómbrela {marca} y copie el código que empieza con sk-or-.',
          link: { rotulo: "Abrir la página de claves", href: LINKS.openrouter.chaves },
        },
        {
          titulo: "Péguela en {marca}",
          texto:
            "En IA › Credenciales, haga clic en Añadir credencial, elija OpenRouter, pegue y guarde.",
          link: { rotulo: "Abrir Credenciales", href: CAMINHO_DAS_CHAVES },
        },
      ],
      atencao: "Para transcribir audio y leer su material, sume una clave de OpenAI.",
    },
  ],
  assistenteTitulo: "Dudas rápidas",
  assistenteIntro: "Toque una pregunta para ver la respuesta.",
  perguntas: [
    {
      pergunta: '¿Qué es una "clave de API"?',
      resposta:
        "Es una contraseña en forma de código que deja a {marca} usar la inteligencia artificial en SU cuenta del proveedor. La crea una vez y la pega aquí; queda guardada cifrada.",
    },
    {
      pergunta: "¿Cuánto voy a gastar al mes?",
      resposta:
        "Depende de cuántas conversaciones atienda la IA. Para un negocio pequeño, los US$ 5 a 10 iniciales suelen durar semanas. Ve el consumo en el panel y solo paga lo que usa.",
    },
    {
      pergunta: "¿Sirve mi suscripción de ChatGPT o Claude?",
      resposta:
        "No. Las suscripciones Plus/Pro son para usar el chat en la web. {marca} necesita la cuenta de API (platform.openai.com o console.anthropic.com), que se cobra por uso.",
    },
    {
      pergunta: "¿Qué proveedor elijo?",
      resposta:
        "Si no sabe, OpenAI: una clave hace todo. Si quiere la conversación más natural, Claude (Anthropic) más una clave de OpenAI para audio. Para probar sin tarjeta, Google Gemini.",
    },
    {
      pergunta: "Rechazaron mi tarjeta. ¿Qué hago?",
      resposta:
        "OpenAI y Anthropic cobran en dólares. Pida a su banco habilitar compras internacionales en línea o use una tarjeta internacional/virtual. También puede empezar con Google Gemini, sin tarjeta.",
    },
    {
      pergunta: "Copié la clave y la perdí. ¿Puedo verla de nuevo?",
      resposta:
        "No: por seguridad el proveedor la muestra una sola vez. Cree una clave nueva en el mismo lugar y péguela en {marca}.",
    },
    {
      pergunta: "{marca} dice que la clave falló la validación.",
      resposta:
        "Lo más común: la cuenta no tiene crédito, la clave se copió incompleta o con un espacio al final, o se eligió otro proveedor en el formulario. Revise y guarde de nuevo.",
    },
    {
      pergunta: "¿{marca} cobra alguna comisión sobre la IA?",
      resposta: "No. El uso de la IA se paga directo al proveedor, sin comisión nuestra.",
    },
  ],
  ui: {
    passos: "Paso a paso",
    custo: "Costo para empezar",
    tempo: "Tiempo",
    abrir: "Abrir",
    atencao: "Atención",
    copiar: "Copiar enlace",
    video: "Mira el paso a paso",
  },
};

const EN: GuiaCompleto = {
  titulo: "How to get your AI key (step by step)",
  intro:
    'The AI agent runs on an artificial-intelligence account in your name. You create that account once, add a little credit, copy a "key" (a code) and paste it into {marca}. It takes about 10 minutes and you only pay for what you use, directly to the provider.',
  recomendacao:
    "Not sure which one? Start with OpenAI: one key does everything — conversations, audio and reading your material.",
  provedores: [
    {
      id: "openai",
      nome: "OpenAI (ChatGPT)",
      selo: "Simplest",
      resumo:
        "One key does everything: conversations, audio transcription and reading your material.",
      custo: "Minimum credit of US$ 5 (prepaid, no subscription).",
      tempo: "About 10 minutes",
      passos: [
        {
          titulo: "Create the account",
          texto:
            "Sign up with your email or Google account. It is separate from ChatGPT Plus — that subscription doesn't work here.",
          link: { rotulo: "Open OpenAI sign-up", href: LINKS.openai.cadastro },
        },
        {
          titulo: "Add credit",
          texto:
            'In Billing, click "Add payment details", add your card and choose the starting amount (minimum US$ 5; US$ 10 goes a long way).',
          link: { rotulo: "Open the billing page", href: LINKS.openai.cobranca },
        },
        {
          titulo: "Create the key",
          texto:
            'In API keys, click "Create new secret key", name it {marca} and copy the code starting with sk-. It is shown only once.',
          link: { rotulo: "Open the keys page", href: LINKS.openai.chaves },
        },
        {
          titulo: "Paste it into {marca}",
          texto:
            "In AI › Credentials, click Add credential, choose OpenAI, paste the key and save. {marca} checks right away that it works.",
          link: { rotulo: "Open Credentials", href: CAMINHO_DAS_CHAVES },
        },
      ],
    },
    {
      id: "anthropic",
      nome: "Anthropic (Claude)",
      selo: "Best conversations",
      resumo:
        "The AI that best follows instructions and talks to customers. For audio and material, add an OpenAI key.",
      custo: "Minimum credit of US$ 5 (prepaid).",
      tempo: "About 10 minutes",
      passos: [
        {
          titulo: "Create the account",
          texto:
            "Sign up for the Anthropic Console with your email. It is not the same as a Claude.ai subscription.",
          link: { rotulo: "Open the Anthropic Console", href: LINKS.anthropic.cadastro },
        },
        {
          titulo: "Add credit",
          texto: 'In Settings › Billing, click "Buy credits" (or "Add funds") and buy from US$ 5.',
          link: { rotulo: "Open the billing page", href: LINKS.anthropic.cobranca },
        },
        {
          titulo: "Create the key",
          texto:
            'In Settings › API Keys, click "Create Key", name it {marca} and copy the code starting with sk-ant-.',
          link: { rotulo: "Open the keys page", href: LINKS.anthropic.chaves },
        },
        {
          titulo: "Paste it into {marca}",
          texto:
            "In AI › Credentials, click Add credential, choose Anthropic (Claude), paste and save.",
          link: { rotulo: "Open Credentials", href: CAMINHO_DAS_CHAVES },
        },
      ],
    },
    {
      id: "google",
      nome: "Google (Gemini)",
      selo: "No card to start",
      resumo: "Create the key without a card and try it on the free tier, with usage limits.",
      custo: "Free to try (rate-limited). For ongoing use, enable billing in Google Cloud.",
      tempo: "About 3 minutes",
      passos: [
        {
          titulo: "Sign in with Google",
          texto: "Open Google AI Studio and sign in with your business Gmail.",
          link: { rotulo: "Open Google AI Studio", href: LINKS.google.cadastro },
        },
        {
          titulo: "Create the key",
          texto:
            'On "Get API key", click "Create API key", choose (or create) a project and copy the code starting with AIza.',
          link: { rotulo: "Open the keys page", href: LINKS.google.chaves },
        },
        {
          titulo: "Paste it into {marca}",
          texto:
            "In AI › Credentials, click Add credential, choose Google (Gemini), paste and save.",
          link: { rotulo: "Open Credentials", href: CAMINHO_DAS_CHAVES },
        },
      ],
      atencao:
        "On the free tier Google may use conversations to improve its products and there are per-minute limits. To serve real customers, enable billing on the project.",
    },
    {
      id: "openrouter",
      nome: "OpenRouter",
      selo: "Many models",
      resumo:
        "One key gives access to hundreds of models from many makers, including some free ones.",
      custo: "Prepaid credits from a few dollars. Card accepted.",
      tempo: "About 5 minutes",
      passos: [
        {
          titulo: "Create the account",
          texto: "Sign up for OpenRouter with email or Google.",
          link: { rotulo: "Open OpenRouter", href: LINKS.openrouter.cadastro },
        },
        {
          titulo: "Add credit",
          texto: 'In Settings › Credits, click "Add Credits" and choose the amount.',
          link: { rotulo: "Open the credits page", href: LINKS.openrouter.cobranca },
        },
        {
          titulo: "Create the key",
          texto:
            'In Settings › Keys, click "Create Key", name it {marca} and copy the code starting with sk-or-.',
          link: { rotulo: "Open the keys page", href: LINKS.openrouter.chaves },
        },
        {
          titulo: "Paste it into {marca}",
          texto: "In AI › Credentials, click Add credential, choose OpenRouter, paste and save.",
          link: { rotulo: "Open Credentials", href: CAMINHO_DAS_CHAVES },
        },
      ],
      atencao: "To transcribe audio and read your material, add an OpenAI key.",
    },
  ],
  assistenteTitulo: "Quick questions",
  assistenteIntro: "Tap a question to see the answer.",
  perguntas: [
    {
      pergunta: 'What is an "API key"?',
      resposta:
        "A password in the form of a code that lets {marca} use AI on YOUR provider account. You create it once and paste it here; it is stored encrypted.",
    },
    {
      pergunta: "How much will I spend per month?",
      resposta:
        "It depends on how many conversations the AI handles. For a small business, the first US$ 5–10 usually lasts weeks. You see usage in the dashboard and only pay for what you use.",
    },
    {
      pergunta: "Does my ChatGPT or Claude subscription work?",
      resposta:
        "No. Plus/Pro subscriptions are for the chat website. {marca} needs the API account (platform.openai.com or console.anthropic.com), billed by usage.",
    },
    {
      pergunta: "Which provider should I choose?",
      resposta:
        "If unsure, OpenAI: one key does everything. For the most natural conversations, Claude (Anthropic) plus an OpenAI key for audio. To try without a card, Google Gemini.",
    },
    {
      pergunta: "I lost the key after copying it.",
      resposta:
        "For security the provider shows it only once. Create a new key in the same place and paste it into {marca}.",
    },
    {
      pergunta: "{marca} says the key failed validation.",
      resposta:
        "Most common causes: no credit on the account, the key was copied incompletely or with a trailing space, or the wrong provider was selected. Check and save again.",
    },
  ],
  ui: {
    passos: "Step by step",
    custo: "Cost to start",
    tempo: "Time",
    abrir: "Open",
    atencao: "Note",
    copiar: "Copy link",
    video: "Watch the walkthrough",
  },
};

export const GUIAS: Readonly<Record<IdiomaDoGuia, GuiaCompleto>> = { "pt-BR": PT, es: ES, en: EN };

/**
 * O guia no idioma pedido, com o nome da marca da instalação no lugar de
 * `{marca}` (marca própria: o revendedor vê o nome dele, não o nosso).
 */
/**
 * Idiomas em que os vídeos dos provedores já foram gravados. O vídeo mostra e
 * fala o nome do produto, então uma instalação de marca própria não o recebe.
 */
const IDIOMAS_COM_VIDEO: readonly IdiomaDoGuia[] = ["pt-BR"];

function videoDoProvedor(id: ProvedorDoGuia) {
  return { src: `/media/atenza/chave-${id}.mp4`, poster: `/media/atenza/chave-${id}.webp` };
}

export function guiaNoIdioma(idioma: string, marca: string): GuiaCompleto {
  const base = idioma === "es" ? ES : idioma === "en" ? EN : PT;
  const guia = JSON.parse(JSON.stringify(base).replaceAll("{marca}", marca)) as GuiaCompleto;
  const comVideo =
    marca === DEFAULT_APP_NAME && IDIOMAS_COM_VIDEO.includes(base === ES ? "es" : base === EN ? "en" : "pt-BR");
  if (!comVideo) return guia;
  return { ...guia, provedores: guia.provedores.map((p) => ({ ...p, video: videoDoProvedor(p.id) })) };
}
