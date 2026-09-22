import { CAMINHO_DOS_PLANOS } from "@/lib/marketing/caminhos";
import type { CorpoDoEmail } from "@/lib/marketing/molde";
import type { IdiomaDoSite } from "@/lib/mercado/paises";

/**
 * OS CINCO E-MAILS QUE RESPONDEM A UM ATO — e a linha que os separa dos quinze.
 *
 * ─── Os quinze pedem atenção; estes cinco devem uma resposta ───────────────
 *
 * A sequência de propaganda (`sequencia.ts`) é conversa que nós começamos: por
 * isso ela caminha devagar, ensina antes de pedir, e leva saída em todo passo.
 * Estes cinco são a outra ponta — a pessoa fez alguma coisa (assinou a lista,
 * abriu o checkout, pagou, teve o cartão recusado) e ficou esperando. Chegar
 * tarde aqui não é falta de educação: é o cliente supondo que deu errado.
 *
 * ─── Dois são de propaganda, três não são, e a diferença tem consequência ──
 *
 * `boas-vindas` e os dois de abandono saem pelo `montarEmail()`, com o
 * `List-Unsubscribe`: são nossos, e quem não quer pode sair. `pagamento-falhou`
 * e `assinatura-ativa` saem pelo `montarEmailTransacional()`, SEM saída —
 * oferecer descadastro de "seu cartão foi recusado" é oferecer a alguém a
 * opção de não ser avisado de que vai perder o acesso.
 *
 * Esta é a razão de o tipo `EmailTransacional` carregar `ehPropaganda`: quem
 * for disparar não precisa lembrar de qual é qual, e não há como escolher
 * errado sem que o compilador esteja de acordo.
 *
 * ─── Por que o de cartão recusado não ameaça ───────────────────────────────
 *
 * O reflexo do setor é escrever "sua conta será suspensa em 3 dias". Quase
 * sempre a causa é banal — cartão vencido, limite momentâneo, banco barrando
 * compra internacional — e a pessoa já vai resolver. Um aviso que ameaça
 * transforma um contratempo administrativo em motivo para reconsiderar a
 * assinatura inteira. O texto abaixo diz o que houve, o que já está sendo
 * feito (o Stripe tenta de novo sozinho), e onde trocar o cartão se a pessoa
 * quiser adiantar. Nada mais.
 */

export interface EmailTransacional {
  /** Id estável. Vai para `email_envios.mensagem` — nunca um índice. */
  readonly id: string;
  /**
   * `true` = sai pelo `montarEmail()`, com porta de saída.
   * `false` = sai pelo `montarEmailTransacional()`, sem — ver o cabeçalho.
   */
  readonly ehPropaganda: boolean;
  readonly texto: Readonly<
    Record<IdiomaDoSite, { readonly assunto: string; readonly corpo: CorpoDoEmail }>
  >;
}

export const TRANSACIONAIS: readonly EmailTransacional[] = [
  // ─────────────────────────────────────────────────────────────────────────
  // 1. Acabou de entrar na lista. Sai na hora, e não no dia seguinte: quem
  //    deixou o e-mail há trinta segundos ainda está na página.
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: "boas-vindas",
    ehPropaganda: true,
    texto: {
      "pt-BR": {
        assunto: "Pronto — e o que você vai receber daqui",
        corpo: {
          titulo: "Seu e-mail está na lista",
          paragrafos: [
            "Nos próximos dias eu mando algumas coisas sobre atendimento no WhatsApp: por que a maioria das empresas perde venda no silêncio, por que quase todo robô irrita, e o que separa um atendimento automático que funciona de um que gera reclamação.",
            "Não é uma newsletter diária. É uma mensagem a cada dois ou três dias, e quase nenhuma delas pede nada — a maior parte é só o que aprendi vendo isso dar certo e dar errado.",
            "Se em algum momento não fizer sentido, o link de saída está no rodapé de todas elas, e sair leva um clique.",
          ],
          posEscrito: "A primeira chega em instantes.",
        },
      },
      en: {
        assunto: "You're in — and here's what you'll get",
        corpo: {
          titulo: "Your email is on the list",
          paragrafos: [
            "Over the next few days I'll send a few things about WhatsApp customer support: why most businesses lose sales to silence, why nearly every bot annoys people, and what separates automated support that works from the kind that generates complaints.",
            "It isn't a daily newsletter. It's one message every two or three days, and almost none of them ask for anything — most are just what I've learned watching this go right and go wrong.",
            "If it ever stops making sense, the exit link is in the footer of every one, and leaving takes one click.",
          ],
          posEscrito: "The first one arrives shortly.",
        },
      },
      es: {
        assunto: "Listo — y esto es lo que va a recibir",
        corpo: {
          titulo: "Su correo está en la lista",
          paragrafos: [
            "En los próximos días le enviaré algunas cosas sobre atención por WhatsApp: por qué la mayoría de las empresas pierde ventas en el silencio, por qué casi todo robot molesta, y qué separa una atención automática que funciona de una que genera reclamos.",
            "No es un boletín diario. Es un mensaje cada dos o tres días, y casi ninguno pide nada — la mayor parte es lo que aprendí viendo esto salir bien y salir mal.",
            "Si en algún momento deja de tener sentido, el enlace de salida está en el pie de todos ellos, y salir toma un clic.",
          ],
          posEscrito: "El primero llega en instantes.",
        },
      },
    },
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 2. Olhou os planos e não abriu o checkout. O e-mail NÃO insiste na compra:
  //    oferece responder a dúvida, que é o que de fato trava quem chegou até
  //    a tabela de preços e parou.
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: "carrinho-abandonado",
    ehPropaganda: true,
    texto: {
      "pt-BR": {
        assunto: "Ficou alguma dúvida nos planos?",
        corpo: {
          titulo: "Você olhou os planos e não seguiu",
          paragrafos: [
            "Não vou insistir na venda. Mas quem chega até a tabela de preço e para quase sempre para pelo mesmo motivo: sobrou uma pergunta que a página não respondeu.",
            "As três mais frequentes, respondidas aqui mesmo para você não precisar procurar:",
          ],
          destaques: [
            "Precisa trocar de número? Não. O número que você já usa continua o mesmo — o que muda é quem atende nele.",
            "Dá para cancelar? A qualquer momento, pela própria tela de cobrança, sem falar com ninguém e sem multa.",
            "E se eu não gostar da IA atendendo? Ela pode ficar só sugerindo a resposta para uma pessoa aprovar. É uma chave, não uma reinstalação.",
          ],
          acao: { rotulo: "Ver os planos de novo", caminho: CAMINHO_DOS_PLANOS },
          posEscrito:
            "Se a sua dúvida não for nenhuma dessas, responda este e-mail — ele chega numa caixa de verdade.",
        },
      },
      en: {
        assunto: "Any questions about the plans?",
        corpo: {
          titulo: "You looked at the plans and stopped",
          paragrafos: [
            "I won't push the sale. But people who reach the pricing table and stop almost always stop for the same reason: one question the page didn't answer.",
            "The three most common ones, answered right here so you don't have to go looking:",
          ],
          destaques: [
            "Do I need a new number? No. The number you already use stays the same — what changes is who answers on it.",
            "Can I cancel? Any time, from the billing screen itself, without talking to anyone and without a penalty.",
            "What if I don't like AI answering? It can just suggest the reply for a person to approve. It's a switch, not a reinstall.",
          ],
          acao: { rotulo: "See the plans again", caminho: CAMINHO_DOS_PLANOS },
          posEscrito:
            "If your question isn't one of those, reply to this email — it lands in a real inbox.",
        },
      },
      es: {
        assunto: "¿Le quedó alguna duda con los planes?",
        corpo: {
          titulo: "Miró los planes y no siguió",
          paragrafos: [
            "No voy a insistir con la venta. Pero quien llega a la tabla de precios y se detiene casi siempre se detiene por lo mismo: quedó una pregunta que la página no respondió.",
            "Las tres más frecuentes, respondidas aquí mismo para que no tenga que buscar:",
          ],
          destaques: [
            "¿Hay que cambiar de número? No. El número que ya usa sigue igual — lo que cambia es quién atiende en él.",
            "¿Se puede cancelar? En cualquier momento, desde la propia pantalla de cobro, sin hablar con nadie y sin multa.",
            "¿Y si no me gusta que la IA atienda? Puede quedarse solo sugiriendo la respuesta para que una persona la apruebe. Es una llave, no una reinstalación.",
          ],
          acao: { rotulo: "Ver los planes otra vez", caminho: CAMINHO_DOS_PLANOS },
          posEscrito:
            "Si su duda no es ninguna de esas, responda este correo — llega a una casilla de verdad.",
        },
      },
    },
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 3. Abriu o checkout do Stripe e não terminou. Mais perto da compra que o
  //    anterior, e por isso mais curto: quem já tinha o cartão na mão não
  //    precisa de argumento, precisa do link de volta.
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: "checkout-abandonado",
    ehPropaganda: true,
    texto: {
      "pt-BR": {
        assunto: "Seu cadastro ficou pela metade",
        corpo: {
          titulo: "Faltou só terminar",
          paragrafos: [
            "Você abriu a tela de pagamento e não concluiu. Acontece — a maior parte das vezes é o celular tocando, não uma mudança de ideia.",
            "O link abaixo devolve você ao mesmo lugar. Nada foi cobrado, e nada fica pendente se você não quiser seguir.",
          ],
          acao: { rotulo: "Terminar o cadastro", caminho: CAMINHO_DOS_PLANOS },
          posEscrito:
            "Se algo na tela de pagamento não funcionou, me conte respondendo aqui — isso eu quero saber.",
        },
      },
      en: {
        assunto: "Your signup stopped halfway",
        corpo: {
          titulo: "Just one step left",
          paragrafos: [
            "You opened the payment screen and didn't finish. It happens — most of the time it's the phone ringing, not a change of mind.",
            "The link below takes you back to the same place. Nothing was charged, and nothing stays pending if you'd rather not continue.",
          ],
          acao: { rotulo: "Finish signing up", caminho: CAMINHO_DOS_PLANOS },
          posEscrito:
            "If something on the payment screen didn't work, tell me by replying here — that I want to know.",
        },
      },
      es: {
        assunto: "Su registro quedó por la mitad",
        corpo: {
          titulo: "Faltó solo terminar",
          paragrafos: [
            "Abrió la pantalla de pago y no concluyó. Pasa — la mayoría de las veces es el teléfono sonando, no un cambio de opinión.",
            "El enlace de abajo lo devuelve al mismo lugar. No se cobró nada, y nada queda pendiente si prefiere no seguir.",
          ],
          acao: { rotulo: "Terminar el registro", caminho: CAMINHO_DOS_PLANOS },
          posEscrito:
            "Si algo en la pantalla de pago no funcionó, cuéntemelo respondiendo aquí — eso sí quiero saberlo.",
        },
      },
    },
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 4. Pagou. O e-mail não celebra: dá os três próximos passos. A hora mais
  //    perigosa de uma assinatura é o dia 1, e quem não conecta o número na
  //    primeira semana cancela na primeira cobrança.
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: "assinatura-ativa",
    ehPropaganda: false,
    texto: {
      "pt-BR": {
        assunto: "Assinatura ativa — os 3 passos de hoje",
        corpo: {
          titulo: "Está tudo pronto do nosso lado",
          paragrafos: [
            "Sua assinatura está ativa. O que decide se isso vai valer a pena não é o plano que você escolheu — é a próxima meia hora.",
            "São três coisas, nesta ordem:",
          ],
          destaques: [
            "1. Conectar o número de WhatsApp. Sem isso nada acontece, e é o passo que mais gente adia.",
            "2. Subir o que o agente pode dizer: tabela de preço, prazos, política de troca. Ele só afirma o que está escrito em algum lugar seu.",
            "3. Deixar o agente em modo sugestão por uns dias. Ele escreve, você aprova. Quando estiver confiando, vira automático numa chave.",
          ],
          acao: { rotulo: "Começar pelo passo 1", caminho: "/app/settings/channels" },
          posEscrito:
            "Se travar em qualquer um dos três, responda este e-mail. Travado no dia 1 é o pior lugar para ficar.",
        },
      },
      en: {
        assunto: "Subscription active — today's 3 steps",
        corpo: {
          titulo: "Everything is ready on our side",
          paragrafos: [
            "Your subscription is active. What decides whether this pays off isn't the plan you picked — it's the next half hour.",
            "Three things, in this order:",
          ],
          destaques: [
            "1. Connect the WhatsApp number. Nothing happens without it, and it's the step most people put off.",
            "2. Upload what the agent is allowed to say: pricing, lead times, return policy. It only asserts what's written somewhere of yours.",
            "3. Leave the agent in suggestion mode for a few days. It writes, you approve. Once you trust it, one switch makes it automatic.",
          ],
          acao: { rotulo: "Start with step 1", caminho: "/app/settings/channels" },
          posEscrito:
            "If you get stuck on any of the three, reply to this email. Stuck on day 1 is the worst place to be.",
        },
      },
      es: {
        assunto: "Suscripción activa — los 3 pasos de hoy",
        corpo: {
          titulo: "Está todo listo de nuestro lado",
          paragrafos: [
            "Su suscripción está activa. Lo que decide si esto va a valer la pena no es el plan que eligió — es la próxima media hora.",
            "Son tres cosas, en este orden:",
          ],
          destaques: [
            "1. Conectar el número de WhatsApp. Sin eso no pasa nada, y es el paso que más gente posterga.",
            "2. Subir lo que el agente puede decir: precios, plazos, política de cambio. Solo afirma lo que está escrito en algún lugar suyo.",
            "3. Dejar el agente en modo sugerencia unos días. Él escribe, usted aprueba. Cuando ya confíe, una llave lo vuelve automático.",
          ],
          acao: { rotulo: "Empezar por el paso 1", caminho: "/app/settings/channels" },
          posEscrito:
            "Si se traba en cualquiera de los tres, responda este correo. Trabado en el día 1 es el peor lugar para quedarse.",
        },
      },
    },
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 5. O cartão foi recusado. Ver o cabeçalho: sem ameaça, sem prazo, sem
  //    "sua conta será suspensa". Diz o que houve e onde resolver.
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: "pagamento-falhou",
    ehPropaganda: false,
    texto: {
      "pt-BR": {
        assunto: "O pagamento não passou",
        corpo: {
          titulo: "Seu cartão recusou a cobrança desta vez",
          paragrafos: [
            "Quase sempre é uma dessas três: o cartão venceu, o limite estava tomado no momento da cobrança, ou o banco barrou por ser uma compra recorrente. Nenhuma delas é problema seu com a gente.",
            "A cobrança vai ser tentada de novo automaticamente nos próximos dias, e seu acesso continua funcionando enquanto isso. Você não precisa fazer nada se souber que o cartão já está em ordem.",
            "Se preferir resolver agora — ou trocar por outro cartão — a tela de cobrança faz isso em um minuto.",
          ],
          acao: { rotulo: "Atualizar a forma de pagamento", caminho: "/app/settings/billing" },
          posEscrito: "Qualquer coisa estranha na cobrança, responda este e-mail.",
        },
      },
      en: {
        assunto: "The payment didn't go through",
        corpo: {
          titulo: "Your card declined the charge this time",
          paragrafos: [
            "It's almost always one of three: the card expired, the limit was taken at the moment of the charge, or the bank blocked it for being recurring. None of them is a problem between you and us.",
            "The charge will be retried automatically over the next few days, and your access keeps working meanwhile. You don't need to do anything if you know the card is already fine.",
            "If you'd rather sort it now — or switch to another card — the billing screen does it in a minute.",
          ],
          acao: { rotulo: "Update the payment method", caminho: "/app/settings/billing" },
          posEscrito: "Anything odd about the charge, reply to this email.",
        },
      },
      es: {
        assunto: "El pago no pasó",
        corpo: {
          titulo: "Su tarjeta rechazó el cobro esta vez",
          paragrafos: [
            "Casi siempre es una de tres: la tarjeta venció, el límite estaba tomado en el momento del cobro, o el banco lo bloqueó por ser recurrente. Ninguna de ellas es un problema suyo con nosotros.",
            "El cobro se va a intentar de nuevo automáticamente en los próximos días, y su acceso sigue funcionando mientras tanto. No necesita hacer nada si sabe que la tarjeta ya está en orden.",
            "Si prefiere resolverlo ahora — o cambiar por otra tarjeta — la pantalla de cobro lo hace en un minuto.",
          ],
          acao: { rotulo: "Actualizar la forma de pago", caminho: "/app/settings/billing" },
          posEscrito: "Cualquier cosa rara en el cobro, responda este correo.",
        },
      },
    },
  },
] as const;

export function transacionalPorId(id: string): EmailTransacional | null {
  return TRANSACIONAIS.find((m) => m.id === id) ?? null;
}
