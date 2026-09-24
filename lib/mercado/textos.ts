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
 * A vitrine é um recorte pequeno e fechado — as 72 frases de `app/page.tsx` e
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
  "Já tenho conta": "I already have an account",
  "Começar com": "Start with",
  "dias grátis": "days free",
  "Começar agora": "Get started",
  Recomendado: "Recommended",
  "/mês": "/month",
  São: "That's",

  // ── Topo ───────────────────────────────────────────────────────────────
  "Atendimento por WhatsApp com agente de IA": "WhatsApp support with an AI agent",
  "Nunca mais perca um cliente por demora na resposta":
    "Never lose another customer to a slow reply",
  "Todo o WhatsApp da sua empresa em uma tela só. Um atendente de IA responde na hora, com o que você ensinou, e passa a conversa para uma pessoa do time quando o assunto pede.":
    "Your whole company's WhatsApp on a single screen. An AI agent answers instantly, using what you taught it, and hands the conversation to a teammate when the subject calls for it.",
  "Sem cartão para começar": "No card to start",
  // ── O trial passou a pedir cartão (7 dias sem cobrança) ───────────────
  // A chave acima atende telas que ainda a usam; a vitrine fala pelas de
  // baixo. "sem cartão" saiu porque virou mentira — ver lib/billing/planos.ts.
  "dias sem cobrança": "days with no charge",
  // ── A faixa de benefícios do topo ──────────────────────────────────────
  "Seu número de WhatsApp continua o mesmo": "Your WhatsApp number stays the same",
  "A IA responde em segundos, 24 horas por dia": "The AI answers in seconds, 24 hours a day",
  "Cancele em um clique, sem falar com ninguém": "Cancel with one click, no phone call",
  "Conversas, funil e histórico em uma tela só": "Conversations, pipeline and history on one screen",
  "Dados isolados por empresa, LGPD desde o primeiro dia": "Data isolated per company, privacy compliance from day one",
  "Nada é cobrado nos primeiros dias": "Nothing is charged in the first days",
  "dias com tudo funcionando. Pedimos o cartão para começar e a assinatura só começa depois desse período — cancele em um clique quando quiser.":
    "days with everything working. We ask for a card to start, and the subscription only begins after that — cancel with one click whenever you want.",
  "Escolha o plano e comece hoje. A cobrança só depois.":
    "Pick a plan and start today. The charge comes later.",
  "Você usa o número que já tem": "Keep the number you already use",
  "Cancele quando quiser": "Cancel anytime",

  // ── O problema ─────────────────────────────────────────────────────────
  "A venda raramente se perde no preço. Ela se perde no silêncio.":
    "Sales are rarely lost on price. They are lost in silence.",
  "A resposta demora": "The reply takes too long",
  "Quem pergunta às 22h só é atendido no dia seguinte. Até lá, já comprou de quem respondeu primeiro.":
    "Someone who asks at 10pm gets an answer the next day. By then they have already bought from whoever replied first.",
  "A conversa se perde": "The conversation gets lost",
  "Cada pessoa do time guarda um pedaço da história no próprio celular. Ninguém sabe o que já foi combinado.":
    "Each teammate keeps a piece of the story on their own phone. Nobody knows what was already agreed.",
  "O retorno nunca acontece": "The follow-up never happens",
  "O cliente disse “depois eu vejo” e ninguém voltou nele. É a venda mais barata da empresa, e ela evapora.":
    "The customer said “I'll think about it” and nobody went back. It is the cheapest sale in the company, and it evaporates.",

  // ── Como funciona ──────────────────────────────────────────────────────
  "Três passos, e o atendimento para de depender de memória":
    "Three steps, and support stops depending on memory",
  "Conecte o seu WhatsApp": "Connect your WhatsApp",
  "O mesmo número que a sua empresa já usa, por leitura de QR code. Ninguém troca de número e nenhuma conversa se perde.":
    "The same number your company already uses, by scanning a QR code. Nobody changes numbers and no conversation is lost.",
  "Ensine o atendente": "Teach the agent",
  "Escreva o que a empresa faz, preço, prazo e as regras. O agente responde a partir disso — e só disso.":
    "Write down what the company does, prices, delivery times and the rules. The agent answers from that — and only that.",
  "Acompanhe pelo funil": "Follow it on the pipeline",
  "Cada conversa vira um card. Você vê quem está esperando, quem comprou e quem esfriou, sem perguntar a ninguém.":
    "Every conversation becomes a card. You see who is waiting, who bought and who went cold, without asking anyone.",

  // ── Recursos ───────────────────────────────────────────────────────────
  "O atendimento inteiro em um lugar só": "Your entire support operation in one place",
  "Uma caixa de entrada para o time todo": "One shared inbox for the whole team",
  "Todas as conversas em uma tela, com quem está atendendo o quê à vista de todos.":
    "Every conversation on one screen, with who is handling what visible to everyone.",
  "Agente de IA com a sua base de conhecimento": "An AI agent with your knowledge base",
  "Ele responde pelo que você escreveu, não por achismo, e chama uma pessoa quando não sabe.":
    "It answers from what you wrote, not from guesswork, and calls a human when it does not know.",
  "Funil de vendas colado na conversa": "A sales pipeline attached to the conversation",
  "Arraste o card, leia o histórico inteiro e pare de perguntar em que pé está cada cliente.":
    "Drag the card, read the full history and stop asking where each customer stands.",
  "Retorno automático no tempo certo": "Automatic follow-up at the right time",
  "Quem parou de responder recebe uma mensagem de volta sem que ninguém precise lembrar disso.":
    "Whoever went quiet gets a message back without anyone having to remember it.",
  "Relatórios de atendimento": "Support reporting",
  "Tempo de resposta, volume por pessoa do time e o que de fato virou venda.":
    "Response time, volume per teammate and what actually turned into a sale.",
  "LGPD desde o primeiro dia": "Data protection from day one",
  "Dados isolados por empresa, registro de acesso e exclusão a pedido do titular.":
    "Data isolated per company, access logging and deletion at the data subject's request.",

  // ── Planos ─────────────────────────────────────────────────────────────
  "Comece liberado. Escolha o plano depois.": "Start with everything on. Pick a plan later.",
  "dias com tudo funcionando, sem cartão. Você só escolhe um plano quando decidir ficar.":
    "days with everything working, no card. You only pick a plan when you decide to stay.",

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
  "Em base isolada por empresa, com registro de quem acessou o quê. Você pode exportar ou apagar os seus dados quando quiser.":
    "In a database isolated per company, with a record of who accessed what. You can export or delete your data whenever you want.",

  // ── Fechamento e rodapé ────────────────────────────────────────────────
  "A próxima pessoa que te chamar no WhatsApp merece resposta agora":
    "The next person who messages you on WhatsApp deserves an answer now",
  "Crie a conta, conecte o número e veja o primeiro atendimento acontecer sozinho ainda hoje.":
    "Create the account, connect the number and watch the first conversation handle itself today.",
  "Atendimento e vendas por WhatsApp": "WhatsApp support and sales",
  "Termos de uso": "Terms of use",
  "Política de Privacidade": "Privacy Policy",

  // ── A conversa de exemplo ──────────────────────────────────────────────
  //
  // Traduzida, não transposta: "Sou do centro" vira um bairro que quem lê em
  // inglês reconhece, e o prazo segue o mesmo. Uma vitrine que mostra endereço
  // brasileiro a um comprador indiano está mostrando o cliente de outra pessoa.
  "Novo contato · 22h14": "New contact · 10:14 PM",
  "IA atendendo": "AI replying",
  "Oi! Vocês entregam hoje ainda? 😊": "Hi! Are you still delivering today? 😊",
  "Oi, Mariana! Entregamos sim. Pedidos fechados até as 23h saem amanhã cedo. Me diz o seu bairro que eu confirmo o prazo.":
    "Hi Mariana! We are. Orders placed by 11 PM go out first thing tomorrow. Tell me your neighbourhood and I'll confirm the time.",
  "Sou do centro 🙏": "I'm downtown 🙏",
  "No centro chega em até 2 horas. Quer que eu já reserve para você?":
    "Downtown it arrives within 2 hours. Want me to reserve it for you?",
  "Card criado no funil": "Card created on the pipeline",
  "Respondido na hora": "Answered instantly",

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
  if (idioma === "en") return INGLES_DA_VITRINE[texto] ?? texto;
  return traduzir(texto, idioma);
}
