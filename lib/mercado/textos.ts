import { traduzir } from "@/lib/i18n/dicionario";

import type { IdiomaDoSite } from "./paises";

/**
 * O INGLÊS DA VITRINE — e por que ele não mora no dicionário do produto.
 *
 * ─── O buraco que este arquivo tapa ────────────────────────────────────────
 *
 * `lib/mercado/paises.ts` promete inglês à Índia, Indonésia, Malásia, África do
 * Sul e Itália. Sem este arquivo a promessa seria muda: `traduzir()` só conhece
 * `es`, e tudo que não é espanhol DEGRADA para português — de propósito, e bem,
 * porque lá dentro degradar é melhor que mostrar uma chave crua. Só que na
 * VITRINE degradar é perder a venda na primeira linha: um indiano abriria uma
 * página em português e fecharia.
 *
 * ─── Por que não basta acrescentar `en` a `IDIOMAS` ────────────────────────
 *
 * `IDIOMAS` é o que o PRODUTO serve, e `tests/unit/i18n-espanhol-cobre-a-tela`
 * cobra, para todo idioma dessa lista, tradução de TODA chave usada em
 * `app/`, `components/`, `hooks/` e `lib/` — hoje são milhares. Pôr `en` ali
 * significaria traduzir o sistema inteiro antes de a primeira página em inglês
 * subir, ou desligar o guarda. As duas saídas são piores que esta.
 *
 * A vitrine é um recorte pequeno e fechado — as frases de `app/page.tsx` e
 * as das páginas públicas ao lado dela. Ela pode ter inglês HOJE sem que o
 * produto precise ter.
 *
 * ─── O que impede este arquivo de apodrecer ────────────────────────────────
 *
 * Nada, na prosa. Quem impede é `tests/unit/vitrine-fala-ingles.test.ts`: ele
 * varre o AST das telas públicas declaradas e reprova toda chave de `t()` que
 * não tenha linha aqui. Frase nova na vitrine entra vermelha no mesmo dia —
 * que é o único jeito de um idioma inteiro não virar meia-tradução silenciosa.
 *
 * A chave é o texto em português, pela mesma razão do dicionário do produto:
 * quem lê o componente vê a frase.
 */
export const INGLES_DA_VITRINE: Readonly<Record<string, string>> = {
  // ── Navegação e ações ──────────────────────────────────────────────────
  "Como funciona": "How it works",
  Recursos: "Features",
  Planos: "Pricing",
  Perguntas: "FAQ",
  Entrar: "Sign in",
  "Criar conta": "Create account",

  "Começar com": "Start with",
  "Começar agora": "Get started",
  Recomendado: "Recommended",
  "/mês": "/month",

  // ── Topo ───────────────────────────────────────────────────────────────

  // ── O trial passou a pedir cartão (7 dias sem cobrança) ───────────────
  // A chave acima atende telas que ainda a usam; a vitrine fala pelas de
  // baixo. "sem cartão" saiu porque virou mentira — ver lib/billing/planos.ts.
  "dias sem cobrança": "days with no charge",

  // ── Com a Atenza / Sem a Atenza ────────────────────────────────────────

  Voltar: "Back",
  // ── O olho do hero, com o nicho que alterna ───────────────────────────

  // ── A faixa de benefícios do topo ──────────────────────────────────────
  "Seu número de WhatsApp continua o mesmo": "Your WhatsApp number stays the same",

  // ── O problema ─────────────────────────────────────────────────────────

  // ── Como funciona ──────────────────────────────────────────────────────
  "Conecte o seu WhatsApp": "Connect your WhatsApp",

  "Ensine o atendente": "Teach the agent",

  "Acompanhe pelo funil": "Follow it on the pipeline",

  // ── Recursos ───────────────────────────────────────────────────────────

  // ── Planos ─────────────────────────────────────────────────────────────

  // ── Perguntas ──────────────────────────────────────────────────────────
  "O que costumam perguntar antes de assinar": "What people ask before subscribing",
  "Preciso trocar de número?": "Do I have to change my number?",
  "Não. Você conecta o número que a empresa já usa lendo um QR code, e as conversas seguem de onde pararam.":
    "No. You connect the number your company already uses by scanning a QR code, and conversations carry on from where they stopped.",
  "A IA responde sozinha o tempo todo?": "Does the AI answer on its own all the time?",
  "Só até onde você deixar. Ela responde o que está na base de conhecimento e entrega a conversa a uma pessoa do time quando o assunto sai dali.":
    "Only as far as you allow. It answers what is in the knowledge base and hands the conversation to a teammate when the subject goes beyond it.",
  "O time todo consegue usar?": "Can the whole team use it?",
  "Sim. Cada pessoa entra com o próprio acesso e você decide o que cada uma pode ver e fazer.":
    "Yes. Each person signs in with their own account and you decide what each one can see and do.",
  "E se eu quiser cancelar?": "What if I want to cancel?",
  "O cancelamento é um clique na própria tela de cobrança, sem falar com ninguém. O acesso continua até o fim do período já pago.":
    "Cancelling is one click on the billing screen, with no phone call. Access continues until the end of the period you already paid for.",
  "Onde ficam os dados dos meus clientes?": "Where is my customers' data kept?",

  // ── Fechamento e rodapé ────────────────────────────────────────────────

  "Atendimento e vendas por WhatsApp": "WhatsApp support and sales",
  "Termos de uso": "Terms of use",
  "Política de Privacidade": "Privacy Policy",

  // ── A conversa de exemplo ──────────────────────────────────────────────
  //
  // Traduzida, não transposta: "Sou do centro" vira um bairro que quem lê em
  // inglês reconhece, e o prazo segue o mesmo. Uma vitrine que mostra endereço
  // brasileiro a um comprador indiano está mostrando o cliente de outra pessoa.

  // ── Documentos legais e contato ────────────────────────────────────────
  //
  // Só a MOLDURA. O corpo dos documentos já nasce trilíngue em
  // `lib/legal/documentos.ts` — ele não passa por aqui nem pelo dicionário.
  Documentos: "Documents",
  Assunto: "Subject",
  Mensagem: "Message",
  "Seu nome": "Your name",
  "Seu e-mail": "Your email",
  "Enviar mensagem": "Send message",
  "Enviando...": "Sending...",
  "Atualizado em": "Updated on",
  "Fale com a gente": "Talk to us",
  "Todos os documentos": "All documents",
  "o operador desta instalação": "the operator of this installation",
  "As regras de uso do sistema.": "The rules for using the system.",
  "Quais dados são tratados, por quanto tempo e quais são os seus direitos.":
    "Which data is processed, for how long, and what your rights are.",
  "Transparência sobre como este sistema trata o seu dinheiro, os seus dados e o número da sua empresa.":
    "Transparency about how this system handles your money, your data and your company's number.",
  "Ficou com dúvida sobre qualquer um destes pontos?": "Still unsure about any of this?",
  "Dúvida sobre planos, pedido de demonstração, problema com a conta ou relato de falha de segurança — tudo chega no mesmo lugar e é lido por gente.":
    "A question about pricing, a demo request, an account problem or a security report — it all lands in the same place and a person reads it.",
  "Mensagem recebida. A resposta vai para o e-mail que você informou.":
    "Message received. The reply will go to the email address you gave us.",
  "Não foi possível enviar agora. Tente de novo em instantes.":
    "We could not send it right now. Please try again in a moment.",
  "Esta instalação ainda não tem endereço de suporte configurado. Procure quem administra o sistema.":
    "This installation has no support address configured yet. Contact whoever administers the system.",

  // ── Captação de e-mail: rodapé e convite ───────────────────────────────
  // "Seu e-mail" e "Enviando..." já estão acima, no formulário de contato — a
  // mesma frase, a mesma tradução. Repeti-las aqui seria chave duplicada no
  // mesmo objeto: a segunda vence em silêncio, e a divergência entre as duas
  // só apareceria quando alguém editasse a errada.
  "seu@email.com": "you@email.com",
  "Quero receber": "Sign me up",
  "Sem spam. Um clique para sair, em qualquer e-mail.":
    "No spam. One click to leave, in every email.",
  "Não foi possível inscrever agora. Tente de novo em instantes.":
    "We could not sign you up right now. Please try again in a moment.",
  "Pronto. Se houver novidade que valha o seu tempo, ela chega por e-mail.":
    "Done. If there is news worth your time, it will arrive by email.",
  "Ainda pensando?": "Still thinking it over?",
  "Deixe seu e-mail. Mandamos o que aprendemos sobre atender por WhatsApp sem perder o cliente — e nada além disso.":
    "Leave your email. We send what we have learned about answering on WhatsApp without losing the customer — and nothing else.",
  Fechar: "Close",
  "Antes de ir: quer ver como isto funciona na prática?":
    "Before you go: want to see how this works in practice?",
  "Deixe seu e-mail e receba, em poucas mensagens, o que um atendimento automático de verdade responde — e o que ele nunca deve responder sozinho.":
    "Leave your email and get, in a handful of messages, what real automated support answers — and what it should never answer on its own.",

  // ── A saída da lista ───────────────────────────────────────────────────
  // Esta tela é a ÚLTIMA que o estrangeiro lê. Meia-tradução aqui é a frase
  // final antes de a pessoa decidir se sai pela porta ou pelo botão de spam —
  // e o botão de spam não atinge o e-mail, atinge o domínio.
  "Sair da lista": "Leave the list",
  "Ao confirmar, seu e-mail deixa de receber as nossas mensagens. Não é preciso entrar em conta nenhuma.":
    "Once you confirm, your email stops receiving our messages. No account sign-in needed.",
  "Confirmar saída": "Confirm",
  "Pronto, você saiu.": "Done, you are out.",
  "Seu e-mail foi removido da lista. Nenhuma mensagem nova será enviada para ele.":
    "Your email was removed from the list. No new message will be sent to it.",
  "Este link não vale mais.": "This link is no longer valid.",
  "Pode ter sido cortado pelo seu programa de e-mail. Abra o link mais recente que recebeu, ou escreva para a gente que tiramos você da lista à mão.":
    "Your email app may have cut it short. Open the most recent link you received, or write to us and we will take you off the list by hand.",
  "Não deu para concluir agora.": "We could not finish right now.",
  "Você continua na lista. Tente de novo em instantes — e se insistir em falhar, escreva para a gente.":
    "You are still on the list. Try again in a moment — and if it keeps failing, write to us.",
  "Tentar de novo": "Try again",

  "Português": "Portuguese",
  // ── A demonstração e a nova vitrine ───────────────────────────────────
  "Demonstração": "Demo",
  "Explore o produto": "Explore the product",
  "Conversas": "Conversations",
  "Agentes de IA": "AI agents",
  "Funil de vendas": "Sales pipeline",
  "Fila": "Queue",
  "Minhas": "Mine",
  "Todas": "All",
  "Dados do contato": "Contact details",
  "Histórico compartilhado": "Shared history",
  "Cliente da loja": "Store customer",
  "Sua equipe": "Your team",
  "Quero mais informações": "I'd like more information",
  "Oi! Vocês têm este modelo em estoque?": "Hi! Do you have this model in stock?",
  "Oi, Mariana! Temos sim. Posso te ajudar a escolher o tamanho?": "Hi, Mariana! We do. Can I help you choose a size?",
  "Pode sim! Estou procurando o tamanho 38.": "Yes, please! I'm looking for size 38.",
  "Escreva uma mensagem...": "Write a message...",
  "Demonstração interativa com dados fictícios. Nenhuma mensagem é enviada.": "Interactive demo with fictional data. No messages are sent.",
  "Conversa atribuída à equipe": "Conversation assigned to the team",
  "O conhecimento é da sua empresa.": "The knowledge comes from your business.",
  "Organize os materiais que orientam o agente.": "Organize the materials that guide your agent.",
  "Produtos e serviços": "Products and services",
  "Prazos e entregas": "Delivery and turnaround times",
  "Perguntas frequentes": "Frequently asked questions",
  "Limites definidos por você": "Limits you define",
  "Configure instruções, base de conhecimento e quando pedir ajuda ao time.": "Set instructions, the knowledge base, and when to ask your team for help.",
  "Uma pessoa assume com contexto": "A teammate takes over with context",
  "O histórico acompanha a conversa quando ela passa da IA para a equipe.": "The history stays with the conversation when it moves from AI to your team.",
  "A conversa tem um próximo passo.": "Every conversation has a next step.",
  "Novo contato": "New contact",
  "Em atendimento": "In progress",
  "Proposta": "Proposal",
  "Concluído": "Completed",
  "Próximo passo": "Next step",
  "Confirmar o tamanho e acompanhar a decisão.": "Confirm the size and follow up on the decision.",
  "Mover para": "Move to",
  "Experimente mudar a etapa deste contato no exemplo acima.": "Try moving this contact to another stage in the example above.",
  "Veja como funciona": "See how it works",
  "Um passeio pelo atendimento, pela IA e pelo funil. Vídeo com áudio e legendas em português.": "A tour of support, AI and the pipeline. Video with Portuguese audio and captions.",
  "Fechar vídeo": "Close video",
  "Ler a explicação": "Read the explanation",
  "O vídeo não carregou. Você pode ler a explicação abaixo.": "The video didn't load. You can read the explanation below.",
  "Seu cliente mandou uma mensagem. E agora? Com o Atenza, seu time organiza o atendimento pelo WhatsApp em uma caixa de entrada compartilhada. As conversas têm contexto, responsáveis e um próximo passo claro.": "Your customer sent a message. What happens next? With Atenza, your team organizes WhatsApp support in a shared inbox. Conversations have context, owners, and a clear next step.",
  "Configure seu agente de IA com o conhecimento do seu negócio e as credenciais do seu provedor. Ele ajuda com as dúvidas da rotina, e sua equipe assume quando o atendimento precisa de atenção humana.": "Set up your AI agent with your business knowledge and your provider's credentials. It helps with routine questions, and your team takes over when support needs a human touch.",
  "Depois, acompanhe as oportunidades no funil e organize os retornos. As integrações disponíveis conectam sua operação, conforme a configuração de cada serviço.": "Then follow opportunities in the pipeline and organize follow-ups. Available integrations connect your operation according to each service's configuration.",
  "Menos improviso. Mais atenção em cada conversa. Conheça os planos do Atenza. Comece com sete dias sem cobrança. É necessário cartão.": "Less improvisation. More care in every conversation. Explore Atenza's plans. Start with seven days with no charge. A card is required.",
  "Cartão necessário. Renovação automática após a avaliação. Cancele quando quiser.": "Card required. Automatically renews after the trial. Cancel anytime.",
  "Comércio e e-commerce": "Retail and e-commerce",
  "A dúvida chega. A conversa continua.": "A question arrives. The conversation continues.",
  "Reúna perguntas sobre produtos, pedidos e entregas com o contexto da sua loja.": "Bring questions about products, orders and deliveries together with your store's context.",
  "Empreendedora organizando pedidos de uma loja": "Business owner organizing store orders",
  "Clínicas e saúde": "Clinics and healthcare",
  "Mais atenção a quem precisa agendar.": "More care for those who need an appointment.",
  "Organize o primeiro contato e encaminhe dúvidas para a equipe responsável.": "Organize the first contact and direct questions to the responsible team.",
  "Profissional de recepção em uma clínica": "Reception professional in a clinic",
  "Educação": "Education",
  "Do interesse à próxima conversa.": "From interest to the next conversation.",
  "Centralize dúvidas sobre cursos e acompanhe os interessados pelo funil.": "Centralize questions about courses and follow interested prospects through the pipeline.",
  "Profissional de educação acompanhando informações no computador": "Education professional reviewing information on a computer",
  "Serviços e B2B": "Services and B2B",
  "O contexto acompanha cada proposta.": "Context follows every proposal.",
  "Qualifique os contatos e mantenha o próximo passo visível para o time.": "Qualify contacts and keep the next step visible to your team.",
  "Profissional de serviços conversando com um cliente": "Services professional talking with a customer",
  "Ir para o conteúdo": "Skip to content",
  "Navegação principal": "Main navigation",
  "Integrações": "Integrations",
  "Abrir navegação": "Open navigation",
  "Seu atendimento cresce.": "Your support grows.",
  "Seu cliente não espera.": "Your customer won't wait.",
  "WhatsApp, agentes de IA e funil de vendas na mesma plataforma.": "WhatsApp, AI agents and a sales pipeline in one platform.",
  "Ver em ação": "See it in action",
  "Conhecer os planos": "Explore pricing",
  "Prévia ilustrativa com dados fictícios": "Illustrative preview with fictional data",
  "O controle continua com você": "You stay in control",
  "Veja o atendimento acontecer.": "See support in action.",
  "Da primeira mensagem ao próximo passo da venda.": "From the first message to the next sales step.",
  "Um histórico para o time inteiro": "One history for the whole team",
  "Todos acompanham o que já foi conversado.": "Everyone can follow what's already been discussed.",
  "IA e pessoas, na mesma conversa": "AI and people in the same conversation",
  "O time assume quando o atendimento pede.": "Your team takes over when support calls for it.",
  "O próximo passo fica à vista": "The next step stays visible",
  "Organize os contatos e acompanhe as oportunidades.": "Organize contacts and follow opportunities.",
  "No ritmo do seu negócio.": "At your business's pace.",
  "Veja onde a plataforma entra na sua rotina.": "See how the platform fits into your routine.",
  "Exemplos de uso. A configuração deve respeitar os processos e as responsabilidades da sua empresa.": "Use case examples. Configuration must respect your company's processes and responsibilities.",
  "Conecte o que sua operação já usa.": "Connect what your operation already uses.",
  "Lojas, APIs e webhooks para trazer mais contexto ao atendimento.": "Stores, APIs and webhooks to bring more context to support.",
  "Ferramentas e formas de conexão disponíveis": "Available tools and connection methods",
  "Pausar animação": "Pause animation",
  "Continuar animação": "Resume animation",
  "As conexões dependem do plano, das credenciais e das permissões de cada ferramenta.": "Connections depend on your plan, credentials and each tool's permissions.",
  "Conversar sobre integrações": "Discuss integrations",
  "Cena de atendimento com uma profissional usando headset": "Support scene with a professional wearing a headset",
  "Vídeo de contexto · sem som": "Context video · no sound",
  "Pausar vídeo de contexto": "Pause context video",
  "Reproduzir vídeo de contexto": "Play context video",
  "A imagem continua disponível enquanto o vídeo não carrega.": "The image remains available while the video doesn't load.",
  "Automatize a rotina.": "Automate the routine.",
  "Mantenha o cuidado.": "Keep the care.",
  "A IA ajuda no repetitivo. Sua equipe entra com atenção, contexto e autonomia quando o cliente precisa.": "AI helps with repetitive work. Your team brings care, context and autonomy when the customer needs it.",
  "Acesso por pessoa": "Individual access",
  "Cada integrante entra com o próprio acesso e as permissões definidas pela empresa.": "Each teammate signs in with their own access and company-defined permissions.",
  "O contexto fica na conversa, mesmo quando muda quem atende.": "The context stays in the conversation, even when someone else takes over.",
  "Configure o conhecimento, as instruções e a passagem para o time.": "Configure knowledge, instructions and the handoff to your team.",
  "Conhecer a política de privacidade": "Read the privacy policy",
  "Conheça antes de decidir.": "Get to know it before deciding.",
  "Dê o play e entenda como as conversas, a IA e o funil se conectam no dia a dia.": "Press play and see how conversations, AI and the pipeline connect in daily work.",
  "Assistir à explicação": "Watch the explanation",
  "Com áudio e legendas em português": "With Portuguese audio and captions",
  "Um plano para o seu momento.": "A plan for your stage.",
  "Escolha o tamanho da sua operação.": "Choose the size of your operation.",
  "Respostas antes do primeiro passo.": "Answers before your first step.",
  "Os dados são separados por empresa, com controles de acesso. A plataforma oferece recursos de exportação e de atendimento a solicitações de privacidade.": "Data is separated by company, with access controls. The platform offers export tools and features for handling privacy requests.",
  "O uso de IA tem alguma configuração adicional?": "Does AI require any additional setup?",
  "Sim. O agente precisa de uma base de conhecimento, instruções e credenciais do provedor de IA configuradas na sua operação. O consumo do provedor pode ter custos próprios.": "Yes. The agent needs a knowledge base, instructions and AI provider credentials configured in your operation. Provider usage may have its own costs.",
  "A próxima conversa pode ser o começo de uma venda.": "The next conversation could start a sale.",
  "Organize o atendimento. Dê contexto à equipe. Acompanhe o próximo passo.": "Organize support. Give your team context. Follow the next step.",
  "Informações e contato": "Information and contact",
};

/** As chaves do catálogo vêm de PLANOS, portanto não são literais no JSX da vitrine. */
const INGLES_DOS_PLANOS: Readonly<Record<string, string>> = {
  Essencial: "Essential",
  Pro: "Pro",
  Ilimitado: "Unlimited",
  "1 número de WhatsApp": "1 WhatsApp number",
  "Até 3 pessoas no time": "Up to 3 team members",
  "Atendente de IA com a sua base de conhecimento": "AI agent with your knowledge base",
  "Funil, contatos e histórico completos": "Full pipeline, contacts and history",
  "Até 3 números de WhatsApp": "Up to 3 WhatsApp numbers",
  "Até 10 pessoas no time": "Up to 10 team members",
  "Follow-up automático e campanhas": "Automatic follow-ups and campaigns",
  "Relatórios e metas de atendimento": "Support reports and goals",
  "Números de WhatsApp sem limite": "Unlimited WhatsApp numbers",
  "Time sem limite": "Unlimited team members",
  "API e webhooks liberados": "API and webhooks included",
  "Suporte prioritário": "Priority support",
};

/**
 * O texto da vitrine no idioma de quem chegou.
 *
 * Português e espanhol seguem pelo dicionário do produto — a vitrine não tem
 * uma segunda tradução em espanhol, e ter duas seria garantir que elas
 * divergissem. O inglês é o único que mora aqui.
 *
 * Falta de inglês DEGRADA para o português, como em todo o resto do produto, e
 * não lança: uma frase sem tradução não pode derrubar a página de vendas. Quem
 * garante que isso não acontece na prática é o guarda de teste, não esta
 * função — degradação é a rede, não o plano.
 */
export function textoDoSite(texto: string, idioma: IdiomaDoSite): string {
  if (idioma === "en") return INGLES_DA_VITRINE[texto] ?? INGLES_DOS_PLANOS[texto] ?? texto;
  return traduzir(texto, idioma);
}
