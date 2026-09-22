import { CAMINHO_DOS_PLANOS } from "@/lib/marketing/caminhos";
import type { CorpoDoEmail } from "@/lib/marketing/molde";
import type { IdiomaDoSite } from "@/lib/mercado/paises";

/**
 * OS QUINZE E-MAILS — o que eles são, e as três regras que os governam.
 *
 * ─── 1. O passo é IDENTIFICADO, nunca posicional ──────────────────────────
 *
 * `site_leads.proximo_passo` é um índice, mas o que vai para
 * `email_envios.mensagem` é o `id` em texto — `"o-silencio-custa"`, não `2`.
 * A diferença aparece no dia em que alguém insere uma mensagem no meio: com
 * índice, toda a lista se desloca, e quem já recebeu o antigo passo 7 recebe
 * o novo passo 7 (outro e-mail, mesmo número) enquanto o `unique (lead_id,
 * mensagem)` acha que é o mesmo e cala. Com id, inserir no meio é seguro:
 * quem já recebeu não recebe de novo, e quem ainda não recebeu recebe.
 *
 * Por isso o cursor é resolvido por BUSCA do id, e não por `MENSAGENS[n]`.
 *
 * ─── 2. O dia é uma ESPERA MÍNIMA, não uma data ───────────────────────────
 *
 * `dia` conta a partir da inscrição. O cron só manda o passo quando
 * `now() - created_at >= dia`, e nunca manda dois no mesmo tique. Um cron que
 * ficou dois dias parado — máquina dormindo, chave vencida — volta e manda UM,
 * não a fila inteira de uma vez. Despejar seis e-mails atrasados numa caixa de
 * entrada é o gesto mais parecido com spam que um remetente pode fazer, e o
 * Gmail o lê exatamente assim.
 *
 * ─── 3. Ensinar antes de pedir ────────────────────────────────────────────
 *
 * Dos quinze, quatro pedem alguma coisa. Os outros onze explicam um problema
 * que a pessoa reconhece e mostram como ele se resolve — inclusive sem nós.
 * Quem chegou por um formulário de rodapé não está comprando; está avaliando
 * se sabemos do que estamos falando. Uma sequência que pede em todos os
 * quinze passos é descadastrada no terceiro.
 *
 * ─── Sobre o idioma ───────────────────────────────────────────────────────
 *
 * Cada mensagem existe nos três idiomas do site. O do destinatário é o que ele
 * usava quando se inscreveu (`site_leads.idioma`); ausente, cai no português.
 * Não há degradação parcial: ou o idioma tem os três campos, ou o objeto não
 * compila — é o mesmo contrato de `lib/legal/documentos.ts`.
 */

/** O que o cron precisa saber de uma mensagem para decidir mandá-la. */
export interface MensagemDaSequencia {
  /** Vai para `email_envios.mensagem`. Estável: renomear reenvia para todos. */
  readonly id: string;
  /** Espera mínima em dias desde a inscrição. */
  readonly dia: number;
  readonly texto: Readonly<Record<IdiomaDoSite, ConteudoDaMensagem>>;
}

export interface ConteudoDaMensagem {
  readonly assunto: string;
  readonly corpo: CorpoDoEmail;
}

export const MENSAGENS: readonly MensagemDaSequencia[] = [
  {
    id: "o-que-e",
    dia: 0,
    texto: {
      "pt-BR": {
        assunto: "O que a gente faz, em um parágrafo",
        corpo: {
          titulo: "Você respondeu. Só que três horas depois.",
          paragrafos: [
            "Obrigado por deixar seu e-mail. Vou ser direto sobre o que fazemos, porque você não pediu uma newsletter — pediu para entender.",
            "Atenza atende no WhatsApp da sua empresa com agentes de inteligência artificial que conversam de verdade: entendem o que a pessoa quer, respondem com o que a sua empresa sabe, e passam para uma pessoa do time quando a conversa sai do que eles dão conta.",
            "Nos próximos dias vou mandar coisas que valem mesmo que você nunca contrate nada — o custo real de uma resposta atrasada, como se mede atendimento, por que a maioria dos robôs de WhatsApp irrita em vez de ajudar. Se em algum momento não fizer sentido, o link de sair está no rodapé de todo e-mail.",
          ],
        },
      },
      en: {
        assunto: "What we do, in one paragraph",
        corpo: {
          titulo: "You replied. Three hours later.",
          paragrafos: [
            "Thanks for leaving your email. I'll be direct about what we do, because you didn't ask for a newsletter — you asked to understand.",
            "Atenza answers on your company's WhatsApp with AI agents that actually hold a conversation: they understand what the person wants, answer with what your company knows, and hand over to a human when the conversation goes past them.",
            "Over the next few days I'll send things that are worth reading even if you never buy anything — the real cost of a late reply, how to measure support, why most WhatsApp bots annoy people instead of helping. If it stops making sense, the unsubscribe link is at the bottom of every email.",
          ],
        },
      },
      es: {
        assunto: "Qué hacemos, en un párrafo",
        corpo: {
          titulo: "Respondió. Tres horas después.",
          paragrafos: [
            "Gracias por dejar su correo. Voy a ser directo sobre lo que hacemos, porque usted no pidió un boletín — pidió entender.",
            "Atenza atiende en el WhatsApp de su empresa con agentes de inteligencia artificial que conversan de verdad: entienden lo que la persona quiere, responden con lo que su empresa sabe, y pasan a alguien del equipo cuando la conversación excede lo que ellos resuelven.",
            "En los próximos días le enviaré cosas que valen aunque nunca contrate nada — el costo real de una respuesta tardía, cómo se mide la atención, por qué la mayoría de los robots de WhatsApp molestan en vez de ayudar. Si deja de tener sentido, el enlace para salir está al pie de cada correo.",
          ],
        },
      },
    },
  },

  {
    id: "o-silencio-custa",
    dia: 2,
    texto: {
      "pt-BR": {
        assunto: "O que acontece nos 5 minutos depois da mensagem",
        corpo: {
          titulo: "A pessoa não esperou. Ela perguntou para outro.",
          paragrafos: [
            "Quem manda mensagem para uma empresa no WhatsApp raramente manda para uma só. Manda para três, e compra de quem responder primeiro com uma resposta que serve.",
            'Isso muda o que significa "demorar". Não é o cliente ficar insatisfeito e reclamar — é ele nunca mais escrever, e você nunca saber que ele existiu. A venda perdida por silêncio não aparece em relatório nenhum: ela é uma conversa que não teve segunda mensagem.',
            "O jeito mais barato de medir isso na sua empresa hoje: abra o WhatsApp, filtre as conversas dos últimos 30 dias em que a última mensagem é do CLIENTE. Cada uma é alguém que perguntou e não teve resposta.",
          ],
          posEscrito: "Amanhã não mando nada. No terceiro dia, falo de por que os robôs irritam.",
        },
      },
      en: {
        assunto: "What happens in the 5 minutes after the message",
        corpo: {
          titulo: "They didn't wait. They asked someone else.",
          paragrafos: [
            "People messaging a business on WhatsApp rarely message just one. They message three, and buy from whoever answers first with an answer that works.",
            "That changes what \"slow\" means. It isn't an unhappy customer who complains — it's someone who never writes again, and you never know they existed. A sale lost to silence shows up in no report: it is a conversation with no second message.",
            "The cheapest way to measure this in your business today: open WhatsApp and filter the last 30 days for conversations where the last message is from the CUSTOMER. Each one is someone who asked and got nothing.",
          ],
          posEscrito: "Nothing tomorrow. On day three, why bots annoy people.",
        },
      },
      es: {
        assunto: "Qué pasa en los 5 minutos después del mensaje",
        corpo: {
          titulo: "No esperó. Le preguntó a otro.",
          paragrafos: [
            "Quien escribe a una empresa por WhatsApp rara vez escribe a una sola. Escribe a tres, y compra a quien responda primero con una respuesta que sirva.",
            'Eso cambia lo que significa "tardar". No es un cliente insatisfecho que reclama — es alguien que no vuelve a escribir, y usted nunca sabe que existió. La venta perdida por silencio no aparece en ningún informe: es una conversación sin segundo mensaje.',
            "La forma más barata de medirlo hoy: abra WhatsApp y filtre los últimos 30 días por conversaciones donde el último mensaje es del CLIENTE. Cada una es alguien que preguntó y no recibió nada.",
          ],
          posEscrito: "Mañana no envío nada. Al tercer día, por qué los robots molestan.",
        },
      },
    },
  },

  {
    id: "por-que-robo-irrita",
    dia: 4,
    texto: {
      "pt-BR": {
        assunto: "Digite 1 para atendimento",
        corpo: {
          titulo: "Por que quase todo robô de WhatsApp irrita",
          paragrafos: [
            "Porque quase todo robô de WhatsApp é uma árvore de menu. Digite 1, digite 2, voltar. Ele não entende a pergunta — ele classifica a pergunta em uma das sete gavetas que alguém desenhou no ano passado.",
            'E a pergunta que a pessoa realmente tem quase nunca cabe numa gaveta. "Vocês entregam no sábado se eu pedir agora?" tem três perguntas dentro. A árvore responde uma e ignora as outras duas, ou joga tudo para o humano — que era justamente o que ela existia para evitar.',
            'A diferença que importa não é a IA ser mais inteligente. É ela ler a frase inteira, responder as três coisas, e saber a hora de parar de tentar. Um agente que sabe dizer "isso eu não resolvo, vou chamar alguém" vale mais que um que tenta sempre.',
          ],
        },
      },
      en: {
        assunto: "Press 1 for support",
        corpo: {
          titulo: "Why nearly every WhatsApp bot annoys people",
          paragrafos: [
            "Because nearly every WhatsApp bot is a menu tree. Press 1, press 2, go back. It doesn't understand the question — it sorts the question into one of seven drawers somebody designed last year.",
            'And the question people actually have rarely fits a drawer. "Do you deliver Saturday if I order now?" has three questions inside it. The tree answers one and ignores two, or dumps everything on a human — which is exactly what it existed to avoid.',
            "The difference that matters isn't the AI being smarter. It's reading the whole sentence, answering all three things, and knowing when to stop trying. An agent that can say \"I can't solve that, let me get someone\" is worth more than one that always tries.",
          ],
        },
      },
      es: {
        assunto: "Marque 1 para atención",
        corpo: {
          titulo: "Por qué casi todo robot de WhatsApp molesta",
          paragrafos: [
            "Porque casi todo robot de WhatsApp es un árbol de menú. Marque 1, marque 2, volver. No entiende la pregunta — clasifica la pregunta en uno de los siete cajones que alguien diseñó el año pasado.",
            'Y la pregunta que la persona realmente tiene casi nunca cabe en un cajón. "¿Entregan el sábado si pido ahora?" tiene tres preguntas dentro. El árbol responde una e ignora dos, o se lo pasa todo al humano — que era justo lo que venía a evitar.',
            'La diferencia que importa no es que la IA sea más lista. Es que lee la frase entera, responde las tres cosas, y sabe cuándo dejar de intentar. Un agente que sabe decir "eso no lo resuelvo, llamo a alguien" vale más que uno que siempre lo intenta.',
          ],
        },
      },
    },
  },

  {
    id: "o-funil-dentro-da-conversa",
    dia: 6,
    texto: {
      "pt-BR": {
        assunto: "O CRM que ninguém preenche",
        corpo: {
          titulo: "Todo CRM morre do mesmo jeito",
          paragrafos: [
            "Ele morre porque alguém tem que preencher. A conversa acontece no WhatsApp, e depois a pessoa deveria abrir outra tela e registrar o que aconteceu. No primeiro mês registra. No terceiro, não.",
            'Seis meses depois o CRM tem cem negócios parados em "contato inicial" que na verdade já foram fechados, perdidos ou esquecidos. E aí ninguém mais confia no relatório, o que é pior que não ter relatório — porque decisão errada com número na mão é mais fácil de defender.',
            "A saída não é cobrar disciplina do time. É o funil viver DENTRO da conversa: o negócio nasce quando a mensagem chega, muda de etapa pelo que foi dito, e o histórico é a conversa em si. Ninguém preenche nada, e por isso ninguém deixa de preencher.",
          ],
        },
      },
      en: {
        assunto: "The CRM nobody fills in",
        corpo: {
          titulo: "Every CRM dies the same way",
          paragrafos: [
            "It dies because someone has to fill it in. The conversation happens on WhatsApp, and then a person is supposed to open another screen and record what happened. Month one, they do. Month three, they don't.",
            'Six months later the CRM has a hundred deals stuck in "first contact" that were actually closed, lost, or forgotten. And then nobody trusts the report, which is worse than having no report — because a wrong decision backed by a number is easier to defend.',
            "The fix isn't demanding discipline from the team. It's the pipeline living INSIDE the conversation: the deal is born when the message arrives, moves stage based on what was said, and the history is the conversation itself. Nobody fills anything in, so nobody fails to.",
          ],
        },
      },
      es: {
        assunto: "El CRM que nadie completa",
        corpo: {
          titulo: "Todo CRM muere de lo mismo",
          paragrafos: [
            "Muere porque alguien tiene que completarlo. La conversación pasa en WhatsApp, y después alguien debería abrir otra pantalla y registrar lo que ocurrió. El primer mes lo registra. El tercero, no.",
            'Seis meses después el CRM tiene cien negocios detenidos en "primer contacto" que en realidad ya se cerraron, se perdieron o se olvidaron. Y entonces nadie confía en el informe, que es peor que no tenerlo — porque una decisión equivocada con un número en la mano es más fácil de defender.',
            "La salida no es exigir disciplina al equipo. Es que el embudo viva DENTRO de la conversación: el negocio nace cuando llega el mensaje, cambia de etapa por lo que se dijo, y el historial es la conversación misma. Nadie completa nada, y por eso nadie deja de completar.",
          ],
        },
      },
    },
  },

  {
    id: "a-madrugada",
    dia: 9,
    texto: {
      "pt-BR": {
        assunto: "23h47 de um sábado",
        corpo: {
          titulo: "A hora em que sua empresa não existe",
          paragrafos: [
            "Olhe o horário das mensagens que chegam para você. Numa boa parte dos negócios, um terço delas chega fora do horário comercial — à noite, no fim de semana, no feriado. É quando a pessoa tem tempo de resolver a vida dela.",
            "O que ela recebe hoje é silêncio, ou uma mensagem automática dizendo que o atendimento é de segunda a sexta. As duas coisas comunicam a mesma coisa: volte depois. Boa parte não volta.",
            "Atender nesse horário não é pôr alguém de plantão. É ter quem responda o que dá para responder — preço, prazo, disponibilidade, como funciona — e registre o resto para a pessoa certa ver na segunda de manhã, com a conversa inteira já lida.",
          ],
          destaques: [
            "Mensagem fora de horário não é urgência. É a única hora que a pessoa tinha.",
            "Responder às 23h47 não obriga ninguém a estar acordado às 23h47.",
          ],
        },
      },
      en: {
        assunto: "11:47pm on a Saturday",
        corpo: {
          titulo: "The hour your business doesn't exist",
          paragrafos: [
            "Look at the timestamps on the messages you get. In most businesses, a third of them arrive outside business hours — at night, on weekends, on holidays. That's when people have time to sort their life out.",
            "What they get today is silence, or an auto-reply saying support runs Monday to Friday. Both communicate the same thing: come back later. Plenty don't.",
            "Covering those hours isn't putting someone on call. It's having something answer what can be answered — price, lead time, availability, how it works — and log the rest for the right person to see Monday morning, with the whole conversation already read.",
          ],
          destaques: [
            "An after-hours message isn't an emergency. It's the only time they had.",
            "Answering at 11:47pm doesn't require anyone to be awake at 11:47pm.",
          ],
        },
      },
      es: {
        assunto: "23:47 de un sábado",
        corpo: {
          titulo: "La hora en que su empresa no existe",
          paragrafos: [
            "Mire la hora de los mensajes que le llegan. En buena parte de los negocios, un tercio llega fuera del horario comercial — de noche, el fin de semana, el feriado. Es cuando la persona tiene tiempo de resolver su vida.",
            "Lo que recibe hoy es silencio, o un mensaje automático diciendo que la atención es de lunes a viernes. Las dos cosas comunican lo mismo: vuelva después. Buena parte no vuelve.",
            "Atender en ese horario no es poner a alguien de guardia. Es tener quien responda lo que se puede responder — precio, plazo, disponibilidad, cómo funciona — y registre el resto para que la persona correcta lo vea el lunes por la mañana, con la conversación entera ya leída.",
          ],
          destaques: [
            "Un mensaje fuera de horario no es una urgencia. Es la única hora que tenía.",
            "Responder a las 23:47 no obliga a nadie a estar despierto a las 23:47.",
          ],
        },
      },
    },
  },

  {
    id: "a-passagem-para-o-humano",
    dia: 12,
    texto: {
      "pt-BR": {
        assunto: "O momento exato de chamar uma pessoa",
        corpo: {
          titulo: "A IA boa é a que sabe parar",
          paragrafos: [
            "O erro mais caro de um atendimento automático não é errar uma resposta. É insistir. A pessoa reformula três vezes, o robô devolve a mesma coisa três vezes, e a conversa termina com alguém irritado que agora tem uma opinião sobre a sua empresa.",
            "Um agente que presta reconhece quatro sinais e sai de cena: a pessoa pediu para falar com alguém, a mesma pergunta voltou de outro jeito, o assunto envolve dinheiro fora do padrão, ou o tom mudou.",
            'E quando sai, entrega a conversa inteira lida para quem assume — não um "o cliente quer falar com você". Quem recebe abre já sabendo o que foi perguntado, o que foi respondido e onde travou. Isso é a diferença entre transferir e abandonar.',
          ],
        },
      },
      en: {
        assunto: "The exact moment to get a human",
        corpo: {
          titulo: "Good AI is the kind that knows when to stop",
          paragrafos: [
            "The most expensive mistake in automated support isn't a wrong answer. It's insisting. The person rephrases three times, the bot returns the same thing three times, and the conversation ends with an irritated human who now has an opinion about your company.",
            "A decent agent recognises four signals and steps aside: they asked for a person, the same question came back differently, the topic involves non-standard money, or the tone changed.",
            'And when it steps aside, it hands over the whole conversation already read — not "the customer wants to talk to you". Whoever picks it up opens knowing what was asked, what was answered, and where it stalled. That is the difference between transferring and abandoning.',
          ],
        },
      },
      es: {
        assunto: "El momento exacto de llamar a una persona",
        corpo: {
          titulo: "La buena IA es la que sabe parar",
          paragrafos: [
            "El error más caro de una atención automática no es equivocar una respuesta. Es insistir. La persona reformula tres veces, el robot devuelve lo mismo tres veces, y la conversación termina con alguien molesto que ahora tiene una opinión sobre su empresa.",
            "Un agente decente reconoce cuatro señales y se aparta: pidieron hablar con alguien, la misma pregunta volvió de otra forma, el tema involucra dinero fuera de lo estándar, o cambió el tono.",
            'Y cuando se aparta, entrega la conversación entera leída a quien asume — no un "el cliente quiere hablar con usted". Quien la recibe abre sabiendo qué se preguntó, qué se respondió y dónde se trabó. Esa es la diferencia entre transferir y abandonar.',
          ],
        },
      },
    },
  },

  {
    id: "o-que-a-ia-sabe",
    dia: 15,
    texto: {
      "pt-BR": {
        assunto: "De onde vem a resposta",
        corpo: {
          titulo: "Uma IA que inventa preço é um problema jurídico",
          paragrafos: [
            "Modelo de linguagem, sozinho, responde qualquer coisa com a mesma confiança — inclusive um prazo que você não pratica e um desconto que você não dá. No atendimento, isso não é um erro divertido: é uma promessa feita em nome da sua empresa, por escrito, com carimbo de hora.",
            "A saída é o agente só poder falar do que está escrito em algum lugar seu. Você sobe o que ele pode dizer — tabela, política de troca, prazos, perguntas frequentes — e ele responde ancorado nisso. O que não está lá, ele não responde: ele chama alguém.",
            'É por isso que "qual IA vocês usam" é a pergunta menos importante. O que separa um atendimento que dá certo de um que gera problema não é o modelo. É o que ele tem permissão de afirmar.',
          ],
        },
      },
      en: {
        assunto: "Where the answer comes from",
        corpo: {
          titulo: "An AI that invents prices is a legal problem",
          paragrafos: [
            "A language model on its own answers anything with equal confidence — including a lead time you don't offer and a discount you don't give. In customer support that isn't a funny mistake: it's a promise made on your company's behalf, in writing, timestamped.",
            "The fix is the agent only being able to speak from something you wrote. You upload what it may say — price list, return policy, lead times, FAQ — and it answers anchored to that. What isn't there, it doesn't answer: it gets a person.",
            "\"Which AI do you use\" is therefore the least important question. What separates support that works from support that creates problems isn't the model. It's what it's allowed to assert.",
          ],
        },
      },
      es: {
        assunto: "De dónde viene la respuesta",
        corpo: {
          titulo: "Una IA que inventa precios es un problema legal",
          paragrafos: [
            "Un modelo de lenguaje, solo, responde cualquier cosa con la misma confianza — incluido un plazo que usted no practica y un descuento que no da. En atención eso no es un error gracioso: es una promesa hecha en nombre de su empresa, por escrito, con hora.",
            "La salida es que el agente solo pueda hablar de lo que está escrito en algún lugar suyo. Usted sube lo que puede decir — lista de precios, política de cambios, plazos, preguntas frecuentes — y responde anclado a eso. Lo que no está ahí, no lo responde: llama a alguien.",
            'Por eso "qué IA usan" es la pregunta menos importante. Lo que separa una atención que funciona de una que genera problemas no es el modelo. Es lo que tiene permiso de afirmar.',
          ],
        },
      },
    },
  },

  {
    id: "nao-virar-spam",
    dia: 18,
    texto: {
      "pt-BR": {
        assunto: "Como se perde um número de WhatsApp",
        corpo: {
          titulo: "O número banido não volta",
          paragrafos: [
            "Empresa que descobre automação de WhatsApp costuma cometer o mesmo erro na primeira semana: dispara para a base inteira, com a mesma mensagem, no mesmo minuto. É o padrão que os sistemas antifraude foram feitos para achar, e o número cai.",
            "E cair não é uma pausa. É o número que está no seu cartão, no seu site e na cabeça dos seus clientes, desligado — junto com o histórico de conversa de todo mundo.",
            'O que evita isso é chato e funciona: ritmo com intervalo irregular entre envios, janela de horário, variação de texto, aquecimento gradual de número novo, e — a peça que mais gente esquece — parar de mandar na hora em que a pessoa pede. Quem escreve "pare" tem que sair da fila naquele segundo, sem depender de alguém lembrar.',
          ],
          destaques: ["Não existe recurso de reputação. Existe reputação que você não gastou."],
        },
      },
      en: {
        assunto: "How to lose a WhatsApp number",
        corpo: {
          titulo: "A banned number doesn't come back",
          paragrafos: [
            "Companies that discover WhatsApp automation tend to make the same mistake in week one: blast the whole list, same message, same minute. That's the exact pattern anti-abuse systems were built to catch, and the number goes down.",
            "And down isn't a pause. It's the number on your card, on your site, and in your customers' heads, switched off — along with everyone's conversation history.",
            'What prevents it is boring and it works: irregular gaps between sends, a time window, text variation, gradual warm-up of a new number, and — the piece most people forget — stopping the moment someone asks. Anyone who writes "stop" has to leave the queue that second, without depending on a person remembering.',
          ],
          destaques: ["There's no reputation appeal. There's reputation you didn't spend."],
        },
      },
      es: {
        assunto: "Cómo se pierde un número de WhatsApp",
        corpo: {
          titulo: "El número baneado no vuelve",
          paragrafos: [
            "La empresa que descubre la automatización de WhatsApp suele cometer el mismo error en la primera semana: dispara a toda la base, con el mismo mensaje, en el mismo minuto. Es el patrón que los sistemas antifraude fueron hechos para encontrar, y el número cae.",
            "Y caer no es una pausa. Es el número que está en su tarjeta, en su sitio y en la cabeza de sus clientes, apagado — junto con el historial de conversación de todos.",
            'Lo que lo evita es aburrido y funciona: ritmo con intervalos irregulares, ventana horaria, variación de texto, calentamiento gradual del número nuevo, y — la pieza que más gente olvida — dejar de enviar en el momento en que la persona lo pide. Quien escribe "pare" tiene que salir de la fila en ese segundo, sin depender de que alguien se acuerde.',
          ],
          destaques: ["No existe apelación de reputación. Existe reputación que no gastó."],
        },
      },
    },
  },

  {
    id: "o-que-medir",
    dia: 21,
    texto: {
      "pt-BR": {
        assunto: "Quatro números, e nenhum deles é volume",
        corpo: {
          titulo: "Atender mais não é atender melhor",
          paragrafos: [
            "Quase todo painel de atendimento mostra a mesma coisa: quantas mensagens entraram. É o número mais fácil de coletar e o menos útil de todos — ele sobe quando o negócio vai bem e sobe também quando algo quebrou e todo mundo está reclamando.",
            "Quatro que valem mais:",
          ],
          destaques: [
            "Tempo até a PRIMEIRA resposta — mediana, não média: uma resposta em 4 horas estraga a média de vinte de 2 minutos.",
            "Conversas sem segunda mensagem do cliente depois de você responder — algumas são resolvidas, outras é gente que desistiu. Vale abrir dez e olhar.",
            "Quantas foram resolvidas sem sair para um humano — e, do outro lado, quantas saíram tarde demais.",
            "Quanto tempo a conversa fica parada esperando alguém — a fila invisível, que ninguém vê porque ninguém mede.",
          ],
          posEscrito:
            "Esses quatro dão para levantar na mão, com exportação de conversa e uma planilha. Faça uma vez antes de contratar qualquer coisa: é o seu ponto de partida.",
        },
      },
      en: {
        assunto: "Four numbers, and none of them is volume",
        corpo: {
          titulo: "More support isn't better support",
          paragrafos: [
            "Almost every support dashboard shows the same thing: how many messages came in. It's the easiest number to collect and the least useful of all — it goes up when business is good and it also goes up when something broke and everyone is complaining.",
            "Four that are worth more:",
          ],
          destaques: [
            "Time to FIRST reply — median, not average: one 4-hour reply ruins the average of twenty 2-minute ones.",
            "Conversations with no second customer message after you replied — some are solved, some are people who gave up. Worth opening ten and looking.",
            "How many were resolved without going to a human — and, on the other side, how many went too late.",
            "How long a conversation sits waiting for someone — the invisible queue nobody sees because nobody measures it.",
          ],
          posEscrito:
            "All four can be pulled by hand, with a chat export and a spreadsheet. Do it once before buying anything: that's your baseline.",
        },
      },
      es: {
        assunto: "Cuatro números, y ninguno es volumen",
        corpo: {
          titulo: "Atender más no es atender mejor",
          paragrafos: [
            "Casi todo panel de atención muestra lo mismo: cuántos mensajes entraron. Es el número más fácil de recoger y el menos útil de todos — sube cuando el negocio va bien y sube también cuando algo se rompió y todos reclaman.",
            "Cuatro que valen más:",
          ],
          destaques: [
            "Tiempo hasta la PRIMERA respuesta — mediana, no promedio: una respuesta de 4 horas arruina el promedio de veinte de 2 minutos.",
            "Conversaciones sin segundo mensaje del cliente después de que usted respondió — algunas están resueltas, otras son gente que desistió. Vale abrir diez y mirar.",
            "Cuántas se resolvieron sin pasar a un humano — y, del otro lado, cuántas pasaron demasiado tarde.",
            "Cuánto tiempo queda la conversación esperando a alguien — la fila invisible, que nadie ve porque nadie mide.",
          ],
          posEscrito:
            "Los cuatro se levantan a mano, con una exportación de conversación y una planilla. Hágalo una vez antes de contratar nada: ese es su punto de partida.",
        },
      },
    },
  },

  {
    id: "por-nicho",
    dia: 24,
    texto: {
      "pt-BR": {
        assunto: "Clínica, loja e imobiliária não são a mesma coisa",
        corpo: {
          titulo: "A mesma ferramenta, três conversas diferentes",
          paragrafos: [
            'Atendimento genérico soa genérico, e a pessoa percebe na segunda frase. O que muda de um negócio para outro não é a tecnologia — é a pergunta que chega e o que significa "resolvido".',
          ],
          destaques: [
            "Clínica: a pergunta é horário. Resolvido = consulta marcada na agenda certa, com a instrução de preparo já enviada.",
            'Loja: a pergunta é "tem?" e "quando chega?". Resolvido = pedido feito, ou a pessoa sabendo a data real em vez de um "em breve".',
            "Imobiliária: a pergunta é uma lista de requisitos disfarçada de frase. Resolvido = visita agendada com o imóvel que atende, não com os oito que não atendem.",
            'Serviço: a pergunta é preço, e a resposta honesta é "depende". Resolvido = as três informações que fazem o orçamento sair, colhidas sem parecer formulário.',
          ],
          posEscrito:
            "É por isso que a configuração por nicho importa mais que o modelo de IA. O mesmo agente, com o mesmo modelo, atende bem ou atende mal conforme o que foi ensinado a perguntar.",
        },
      },
      en: {
        assunto: "A clinic, a shop and a realtor are not the same thing",
        corpo: {
          titulo: "Same tool, three different conversations",
          paragrafos: [
            "Generic support sounds generic, and people notice by the second sentence. What changes between businesses isn't the technology — it's the question that arrives and what \"solved\" means.",
          ],
          destaques: [
            "Clinic: the question is a time slot. Solved = appointment booked on the right calendar, prep instructions already sent.",
            'Shop: the question is "do you have it?" and "when does it arrive?". Solved = order placed, or the person knowing a real date instead of "soon".',
            "Realtor: the question is a list of requirements disguised as a sentence. Solved = a viewing booked for the property that fits, not the eight that don't.",
            'Services: the question is price and the honest answer is "it depends". Solved = the three facts that let a quote happen, collected without sounding like a form.',
          ],
          posEscrito:
            "That's why setup by industry matters more than the AI model. The same agent, same model, does well or badly depending on what it was taught to ask.",
        },
      },
      es: {
        assunto: "Una clínica, una tienda y una inmobiliaria no son lo mismo",
        corpo: {
          titulo: "La misma herramienta, tres conversaciones distintas",
          paragrafos: [
            'La atención genérica suena genérica, y la persona lo nota en la segunda frase. Lo que cambia de un negocio a otro no es la tecnología — es la pregunta que llega y lo que significa "resuelto".',
          ],
          destaques: [
            "Clínica: la pregunta es un horario. Resuelto = cita agendada en la agenda correcta, con la instrucción de preparación ya enviada.",
            'Tienda: la pregunta es "¿tienen?" y "¿cuándo llega?". Resuelto = pedido hecho, o la persona sabiendo una fecha real en vez de un "pronto".',
            "Inmobiliaria: la pregunta es una lista de requisitos disfrazada de frase. Resuelto = visita agendada con el inmueble que sirve, no con los ocho que no.",
            'Servicios: la pregunta es el precio y la respuesta honesta es "depende". Resuelto = los tres datos que permiten cotizar, recogidos sin parecer un formulario.',
          ],
          posEscrito:
            "Por eso la configuración por rubro importa más que el modelo de IA. El mismo agente, con el mismo modelo, atiende bien o mal según lo que se le enseñó a preguntar.",
        },
      },
    },
  },

  {
    id: "seus-dados-sao-seus",
    dia: 28,
    texto: {
      "pt-BR": {
        assunto: "A pergunta que quase ninguém faz antes de contratar",
        corpo: {
          titulo: "E se um dia você quiser sair?",
          paragrafos: [
            "É a pergunta mais importante e a que menos se faz. Todo sistema de atendimento acumula a coisa mais valiosa que a sua empresa tem depois do caixa: o histórico de conversa com cada cliente, quem comprou o quê, quem reclamou de quê.",
            "Se esse histórico só existe dentro de um painel que não exporta, você não contratou uma ferramenta — você alugou os seus próprios dados. E o preço da renovação é definido por quem sabe disso.",
            "Antes de assinar qualquer coisa, incluindo a nossa, pergunte três coisas: dá para exportar tudo, em formato legível, sem pedir para o suporte? Os dados de um cliente podem ser apagados quando ele exigir? Onde eles ficam guardados?",
            "Se a resposta a qualquer uma delas for vaga, isso é a resposta.",
          ],
        },
      },
      en: {
        assunto: "The question almost nobody asks before buying",
        corpo: {
          titulo: "What if one day you want to leave?",
          paragrafos: [
            "It's the most important question and the least asked. Every support system accumulates the most valuable thing your company has after cash: the conversation history with each customer, who bought what, who complained about what.",
            "If that history only exists inside a dashboard that doesn't export, you didn't buy a tool — you rented your own data. And the renewal price is set by whoever knows that.",
            "Before signing anything, including ours, ask three things: can you export all of it, in a readable format, without asking support? Can one customer's data be deleted when they demand it? Where is it stored?",
            "If the answer to any of them is vague, that is the answer.",
          ],
        },
      },
      es: {
        assunto: "La pregunta que casi nadie hace antes de contratar",
        corpo: {
          titulo: "¿Y si un día quiere irse?",
          paragrafos: [
            "Es la pregunta más importante y la que menos se hace. Todo sistema de atención acumula lo más valioso que su empresa tiene después de la caja: el historial de conversación con cada cliente, quién compró qué, quién reclamó por qué.",
            "Si ese historial solo existe dentro de un panel que no exporta, usted no contrató una herramienta — alquiló sus propios datos. Y el precio de la renovación lo define quien lo sabe.",
            "Antes de firmar nada, incluido lo nuestro, pregunte tres cosas: ¿se puede exportar todo, en formato legible, sin pedirlo a soporte? ¿Se pueden borrar los datos de un cliente cuando lo exija? ¿Dónde están guardados?",
            "Si la respuesta a cualquiera de ellas es vaga, esa es la respuesta.",
          ],
        },
      },
    },
  },

  {
    id: "meu-time-da-conta",
    dia: 32,
    texto: {
      "pt-BR": {
        assunto: '"Minha equipe já dá conta"',
        corpo: {
          titulo: "Provavelmente dá. A pergunta é outra.",
          paragrafos: [
            "É a objeção mais comum e quase sempre é verdade — a equipe dá conta. O que ela não dá conta é de dar conta em dezembro, com duas pessoas de férias e o triplo de mensagem.",
            "Automação de atendimento não existe para substituir quem atende bem. Existe para que a variação de demanda não vire variação de qualidade, e para que as vinte perguntas iguais por dia não consumam a pessoa que deveria estar cuidando das cinco conversas difíceis.",
            "O teste honesto: pegue as mensagens de uma semana e separe em duas pilhas — as que exigem alguém que conhece o negócio, e as que qualquer um responderia com a informação à mão. Se a segunda pilha for maior, ela é o custo que você está pagando hoje sem enxergar.",
          ],
        },
      },
      en: {
        assunto: '"My team handles it"',
        corpo: {
          titulo: "They probably do. That's not the question.",
          paragrafos: [
            "It's the most common objection and it's almost always true — the team handles it. What they don't handle is handling it in December, with two people on holiday and triple the messages.",
            "Support automation doesn't exist to replace people who are good at support. It exists so that swings in demand don't become swings in quality, and so the twenty identical questions a day don't consume the person who should be working the five hard conversations.",
            "The honest test: take one week of messages and split them into two piles — those needing someone who knows the business, and those anyone could answer with the facts in front of them. If the second pile is bigger, that pile is the cost you're already paying without seeing it.",
          ],
        },
      },
      es: {
        assunto: '"Mi equipo ya da abasto"',
        corpo: {
          titulo: "Probablemente sí. La pregunta es otra.",
          paragrafos: [
            "Es la objeción más común y casi siempre es cierta — el equipo da abasto. Lo que no da abasto es dar abasto en diciembre, con dos personas de vacaciones y el triple de mensajes.",
            "La automatización de atención no existe para reemplazar a quien atiende bien. Existe para que la variación de demanda no se vuelva variación de calidad, y para que las veinte preguntas iguales por día no consuman a la persona que debería estar atendiendo las cinco conversaciones difíciles.",
            "La prueba honesta: tome los mensajes de una semana y sepárelos en dos pilas — los que exigen a alguien que conoce el negocio, y los que cualquiera respondería con el dato a mano. Si la segunda pila es mayor, esa pila es el costo que ya está pagando sin verlo.",
          ],
        },
      },
    },
  },

  {
    id: "quanto-custa",
    dia: 36,
    texto: {
      "pt-BR": {
        assunto: "Quanto custa, sem rodeio",
        corpo: {
          titulo: "O preço está no site, e a conta é simples",
          paragrafos: [
            "Depois de doze e-mails sem pedir nada, acho justo falar de dinheiro de forma direta.",
            "É assinatura mensal, sem taxa de instalação e sem fidelidade. Três planos, pelo número de WhatsApp conectados e pelo tamanho do time. O preço aparece na moeda do seu país — não é dólar convertido na hora do cartão.",
            "A conta que importa não é o valor da mensalidade: é ela comparada com uma venda. Se o seu ticket médio for maior que a mensalidade, o sistema se paga com um cliente por mês que hoje desistiria no silêncio. Se for menor, a conta é por volume, e vale fazer antes de assinar — posso ajudar a fazer, sem compromisso.",
          ],
          acao: { rotulo: "Ver os planos", caminho: CAMINHO_DOS_PLANOS },
        },
      },
      en: {
        assunto: "What it costs, no runaround",
        corpo: {
          titulo: "The price is on the site, and the maths is simple",
          paragrafos: [
            "After twelve emails without asking for anything, it's fair to talk about money directly.",
            "It's a monthly subscription, no setup fee, no lock-in. Three plans, by how many WhatsApp numbers you connect and how big the team is. The price shows in your country's currency — not dollars converted at card time.",
            "The maths that matters isn't the monthly figure: it's the monthly figure against one sale. If your average order is bigger than the subscription, the system pays for itself with one customer a month who would otherwise give up in the silence. If it's smaller, it's a volume calculation, and it's worth doing before you buy — I'm happy to do it with you, no strings.",
          ],
          acao: { rotulo: "See the plans", caminho: CAMINHO_DOS_PLANOS },
        },
      },
      es: {
        assunto: "Cuánto cuesta, sin rodeos",
        corpo: {
          titulo: "El precio está en el sitio, y la cuenta es simple",
          paragrafos: [
            "Después de doce correos sin pedir nada, me parece justo hablar de dinero de forma directa.",
            "Es una suscripción mensual, sin costo de instalación y sin permanencia. Tres planes, según cuántos números de WhatsApp conecte y el tamaño del equipo. El precio aparece en la moneda de su país — no es dólar convertido al momento de la tarjeta.",
            "La cuenta que importa no es el valor de la mensualidad: es la mensualidad comparada con una venta. Si su ticket promedio es mayor que la mensualidad, el sistema se paga con un cliente al mes que hoy desistiría en el silencio. Si es menor, la cuenta es por volumen, y vale hacerla antes de contratar — puedo ayudarle, sin compromiso.",
          ],
          acao: { rotulo: "Ver los planes", caminho: CAMINHO_DOS_PLANOS },
        },
      },
    },
  },

  {
    id: "como-comeca",
    dia: 40,
    texto: {
      "pt-BR": {
        assunto: "O que acontece na primeira hora",
        corpo: {
          titulo: "Sem projeto, sem consultoria, sem migração",
          paragrafos: [
            "A pergunta que trava mais gente não é preço — é imaginar um projeto de três meses com reunião semanal. Não é isso.",
            "Você cria a conta, conecta o número de WhatsApp, sobe o que o agente pode dizer (uma tabela de preço e uma página de perguntas frequentes já bastam para começar), e liga. As conversas que já existem continuam onde estão; o que muda é quem responde primeiro.",
            "O modo mais seguro de começar não é ligar para tudo. É ligar para UM assunto — o mais repetido, aquele que você sabe de cor — e deixar o resto seguir com o time. Uma semana depois você tem dado real em vez de opinião, e decide se amplia.",
          ],
          acao: { rotulo: "Criar a conta", caminho: "/signup" },
          posEscrito: "Se preferir conversar antes, é só responder este e-mail.",
        },
      },
      en: {
        assunto: "What happens in the first hour",
        corpo: {
          titulo: "No project, no consultancy, no migration",
          paragrafos: [
            "The thing that stalls most people isn't price — it's picturing a three-month project with weekly meetings. It isn't that.",
            "You create the account, connect the WhatsApp number, upload what the agent may say (a price list and an FAQ page is already enough to start), and switch it on. Existing conversations stay where they are; what changes is who answers first.",
            "The safest way to start isn't turning it on for everything. It's turning it on for ONE topic — the most repeated one, the one you know by heart — and leaving the rest with the team. A week later you have real data instead of an opinion, and you decide whether to widen it.",
          ],
          acao: { rotulo: "Create the account", caminho: "/signup" },
          posEscrito: "If you'd rather talk first, just reply to this email.",
        },
      },
      es: {
        assunto: "Qué pasa en la primera hora",
        corpo: {
          titulo: "Sin proyecto, sin consultoría, sin migración",
          paragrafos: [
            "Lo que traba a más gente no es el precio — es imaginar un proyecto de tres meses con reunión semanal. No es eso.",
            "Usted crea la cuenta, conecta el número de WhatsApp, sube lo que el agente puede decir (una lista de precios y una página de preguntas frecuentes ya alcanzan para empezar), y lo enciende. Las conversaciones que ya existen siguen donde están; lo que cambia es quién responde primero.",
            "La forma más segura de empezar no es encenderlo para todo. Es encenderlo para UN tema — el más repetido, el que usted sabe de memoria — y dejar el resto con el equipo. Una semana después tiene dato real en vez de opinión, y decide si amplía.",
          ],
          acao: { rotulo: "Crear la cuenta", caminho: "/signup" },
          posEscrito: "Si prefiere conversar antes, basta responder este correo.",
        },
      },
    },
  },

  {
    id: "o-ultimo",
    dia: 45,
    texto: {
      "pt-BR": {
        assunto: "Último desta série",
        corpo: {
          titulo: "Acabou a sequência",
          paragrafos: [
            "Este é o décimo quinto e último e-mail desta série. Não vou continuar mandando por mandar — se você leu até aqui e não contratou, ou não é a hora, ou não é para você, e as duas respostas são legítimas.",
            "Fica o que interessa: o custo de uma resposta atrasada é uma venda que não aparece em relatório; um robô que insiste é pior que nenhum; e o histórico das suas conversas é seu, independente de quem você contratar.",
            "Se um dia fizer sentido, a porta está aberta e o preço está no site. E se quiser me contar por que não fez sentido, responda este e-mail — leio todas.",
          ],
          acao: { rotulo: "Ver os planos", caminho: CAMINHO_DOS_PLANOS },
          posEscrito: "Obrigado pelo tempo.",
        },
      },
      en: {
        assunto: "Last one in this series",
        corpo: {
          titulo: "That's the end of the sequence",
          paragrafos: [
            "This is the fifteenth and last email in this series. I'm not going to keep sending for the sake of sending — if you read this far and didn't buy, either it's not the moment or it's not for you, and both are legitimate answers.",
            "What's worth keeping: a late reply costs a sale that shows up in no report; a bot that insists is worse than no bot; and your conversation history is yours, whoever you end up hiring.",
            "If it ever makes sense, the door is open and the price is on the site. And if you want to tell me why it didn't make sense, reply to this email — I read all of them.",
          ],
          acao: { rotulo: "See the plans", caminho: CAMINHO_DOS_PLANOS },
          posEscrito: "Thanks for the time.",
        },
      },
      es: {
        assunto: "Último de esta serie",
        corpo: {
          titulo: "Se terminó la secuencia",
          paragrafos: [
            "Este es el decimoquinto y último correo de esta serie. No voy a seguir enviando por enviar — si leyó hasta aquí y no contrató, o no es el momento o no es para usted, y las dos respuestas son legítimas.",
            "Queda lo que importa: el costo de una respuesta tardía es una venta que no aparece en ningún informe; un robot que insiste es peor que ninguno; y el historial de sus conversaciones es suyo, contrate a quien contrate.",
            "Si algún día tiene sentido, la puerta está abierta y el precio está en el sitio. Y si quiere contarme por qué no tuvo sentido, responda este correo — los leo todos.",
          ],
          acao: { rotulo: "Ver los planes", caminho: CAMINHO_DOS_PLANOS },
          posEscrito: "Gracias por el tiempo.",
        },
      },
    },
  },
];

/**
 * A mensagem que vem depois de `atual`.
 *
 * Resolve por BUSCA do id, e não por índice: é o que torna seguro inserir uma
 * mensagem no meio da série depois que gente já está no meio dela (ver o item
 * 1 do cabeçalho). `null` significa que a pessoa terminou a sequência.
 */
export function proximaMensagem(idAtual: string | null): MensagemDaSequencia | null {
  if (idAtual === null) return MENSAGENS[0] ?? null;
  const onde = MENSAGENS.findIndex((m) => m.id === idAtual);
  // Id desconhecido — mensagem removida da série depois de ter sido enviada.
  // Parar é o lado seguro: recomeçar do zero reenviaria os quinze.
  if (onde < 0) return null;
  return MENSAGENS[onde + 1] ?? null;
}

/** A mensagem por id, para o cron reconstruir o corpo na hora de enviar. */
export function mensagemPorId(id: string): MensagemDaSequencia | null {
  return MENSAGENS.find((m) => m.id === id) ?? null;
}
