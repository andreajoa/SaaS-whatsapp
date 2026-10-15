import type { PaginaSeo } from "./conteudo-seo";

/**
 * Páginas de RECURSO e de SEGMENTO — o destino de cada item do mega menu.
 *
 * Mesma regra editorial de `conteudo-seo.ts`: só o que o produto faz, sem
 * cliente inventado, número de resultado ou promessa de ganho. Recurso que
 * depende de plano diz qual plano.
 */
const IMG = {
  atendimento: {
    src: "/media/atenza/atendimento.webp",
    alt: "Tela ilustrativa de atendimento pelo WhatsApp",
  },
  escritorio: {
    src: "/media/atenza/hero-office.webp",
    alt: "Cena ilustrativa de uma equipe trabalhando em um escritório",
  },
  painel: {
    src: "/media/atenza/explainer-poster.webp",
    alt: "Ilustração do painel da Atenza com conversas e funil",
  },
  clinica: {
    src: "/media/atenza/segmento-clinica.webp",
    alt: "Cena ilustrativa da recepção de uma clínica",
  },
  comercio: {
    src: "/media/atenza/segmento-comercio.webp",
    alt: "Cena ilustrativa de uma loja atendendo clientes",
  },
  educacao: { src: "/media/atenza/segmento-educacao.webp", alt: "Cena ilustrativa de uma escola" },
  servicos: {
    src: "/media/atenza/segmento-servicos.webp",
    alt: "Cena ilustrativa de uma equipe de serviços",
  },
} as const;

export const PAGES_RECURSOS: readonly PaginaSeo[] = [
  {
    slug: "recursos/campanhas-whatsapp",
    title: "Campanhas e notificações em massa pelo WhatsApp",
    description:
      "Envie campanhas e avisos pelo WhatsApp para listas segmentadas, com aprovação do público e da mensagem antes do envio e recibo de cada destinatário.",
    eyebrow: "Campanhas",
    headline: "Campanhas no WhatsApp com controle antes de cada envio.",
    intro:
      "Promoção, aviso de horário, retorno de quem sumiu: a campanha leva a mesma mensagem a muita gente de uma vez. Na Atenza, o público e o modelo são aprovados antes do disparo, cada destinatário tem o próprio registro de envio, e as respostas caem na mesma caixa de entrada da equipe.",
    image: IMG.painel,
    sections: [
      {
        title: "Escolha quem recebe com base no CRM",
        paragraphs: [
          "O público sai dos contatos e etiquetas que você já usa no atendimento: clientes de uma etapa do funil, quem comprou um produto, quem não responde há algum tempo. Assim a campanha fala com quem faz sentido, e não com a lista inteira.",
        ],
        bullets: [
          "Público e modelo aprovados antes do envio",
          "Registro de envio por destinatário",
          "Respostas voltam para a caixa de entrada da equipe",
        ],
      },
      {
        title: "Modelos aprovados pela Meta",
        paragraphs: [
          "Pela API oficial, a primeira mensagem para quem não falou com você nas últimas 24 horas precisa usar um modelo aprovado pela Meta. A Atenza mostra os modelos da sua conta e preenche as variáveis de cada contato. O custo de cada mensagem é cobrado pela Meta, direto na sua conta.",
        ],
      },
      {
        title: "Quem pede para sair não recebe mais",
        paragraphs: [
          'Pedidos de saída como "parar" ou "sair da lista" são reconhecidos e bloqueiam novos envios para aquele contato. Isso protege a reputação do seu número e respeita a LGPD.',
        ],
      },
    ],
    faq: [
      {
        question: "Em qual plano estão as campanhas?",
        answer: "Campanhas e follow-up automático fazem parte dos planos Pro e Ilimitado.",
      },
      {
        question: "A Atenza cobra por mensagem enviada?",
        answer:
          "Não. O valor por mensagem da API oficial é cobrado pela Meta na sua conta do WhatsApp Business. A Atenza cobra só a assinatura.",
      },
      {
        question: "Posso enviar áudio, imagem e arquivo?",
        answer: "Sim, dentro do que o WhatsApp permite para o tipo de modelo escolhido.",
      },
    ],
    relatedSlugs: ["recursos/follow-up-automatico", "crm-whatsapp", "atendimento-whatsapp"],
    kind: "feature",
  },
  {
    slug: "recursos/follow-up-automatico",
    title: "Follow-up automático no WhatsApp",
    description:
      "Volte a falar com quem parou no meio da conversa: follow-up automático por etapa do funil, por falta de resposta e por agendamento perdido, montado num fluxo visual.",
    eyebrow: "Follow-up",
    headline: "Nenhum cliente fica esquecido no meio da conversa.",
    intro:
      'Orçamento enviado e sem resposta, cliente que disse "vou pensar", consulta marcada e faltada: é aí que a venda se perde. O follow-up automático da Atenza volta a falar com essas pessoas na hora certa, e para assim que elas respondem.',
    image: IMG.atendimento,
    sections: [
      {
        title: "Um fluxo visual, sem programar",
        paragraphs: [
          "Você monta a sequência arrastando etapas: esperar um tempo, enviar uma mensagem, conferir se a pessoa respondeu, seguir por um caminho ou outro. O que acontece com cada contato fica registrado na linha do tempo dele.",
        ],
        bullets: [
          "Gatilho quando o lead muda de etapa no funil",
          "Gatilho por falta de resposta",
          "Recuperação de quem faltou a um agendamento",
          "Para sozinho quando o cliente responde",
        ],
      },
      {
        title: "Dentro das regras do WhatsApp",
        paragraphs: [
          "Dentro da janela de 24 horas o follow-up envia texto livre; fora dela, usa um modelo aprovado. A Atenza respeita o horário de atendimento que você definir, para ninguém receber mensagem de madrugada.",
        ],
      },
    ],
    faq: [
      {
        question: "O follow-up para quando o cliente responde?",
        answer:
          "Sim. A resposta do cliente encerra a sequência e a conversa segue com a equipe ou com o agente de IA.",
      },
      {
        question: "Em qual plano está?",
        answer: "Follow-up automático faz parte dos planos Pro e Ilimitado.",
      },
      {
        question: "Posso ter fluxos diferentes por produto ou serviço?",
        answer: "Sim. Cada fluxo tem o próprio gatilho e as próprias mensagens.",
      },
    ],
    relatedSlugs: ["recursos/campanhas-whatsapp", "crm-whatsapp", "recursos/agenda-whatsapp"],
    kind: "feature",
  },
  {
    slug: "recursos/agenda-whatsapp",
    title: "Agendamento pelo WhatsApp com Google Agenda",
    description:
      "Agende consultas, visitas e reuniões pela conversa do WhatsApp, com horários livres da sua agenda, Google Agenda e Google Meet, confirmação e lembrete.",
    eyebrow: "Agenda",
    headline: "O cliente agenda pela conversa. A agenda já fica certa.",
    intro:
      "Marcar horário pelo WhatsApp costuma ser um vai e vem de mensagens. Na Atenza, a conversa oferece os horários livres de verdade, o compromisso vai para a agenda da equipe e, quando é online, o link do Google Meet já sai junto.",
    image: IMG.clinica,
    sections: [
      {
        title: "Horários livres, sem conflito",
        paragraphs: [
          "Você define a jornada de cada profissional ou local. A Atenza considera o que já está ocupado, inclusive no Google Agenda conectado, e oferece só o que está livre.",
        ],
        bullets: [
          "Integração com Google Agenda e Google Meet",
          "Confirmação, remarcação e cancelamento pela conversa",
          "Recuperação automática de quem faltou",
        ],
      },
      {
        title: "O agente de IA também agenda",
        paragraphs: [
          "Quando o agente de IA está ativo, ele pode consultar os horários e marcar o compromisso durante o atendimento, passando para uma pessoa quando o caso pede.",
        ],
      },
    ],
    faq: [
      {
        question: "Preciso usar Google Agenda?",
        answer:
          "Não é obrigatório. A agenda funciona dentro da Atenza; conectar o Google Agenda é opcional.",
      },
      {
        question: "Funciona para várias pessoas da equipe?",
        answer: "Sim. Cada profissional ou local tem a própria jornada e os próprios horários.",
      },
      {
        question: "Serve para atendimento online?",
        answer: "Sim. Compromissos online podem sair com link do Google Meet.",
      },
    ],
    relatedSlugs: ["segmentos/clinicas", "recursos/follow-up-automatico", "agentes-ia-whatsapp"],
    kind: "feature",
  },
  {
    slug: "recursos/integracoes",
    title: "Integrações da Atenza: lojas, sistemas e automações",
    description:
      "Conecte a Atenza a Shopify, WooCommerce e Nuvemshop, consulte pedidos e catálogo na conversa e ligue qualquer sistema por API, webhooks e ações sem código.",
    eyebrow: "Integrações",
    headline: "O WhatsApp conversando com o resto da sua operação.",
    intro:
      "Atendimento bom precisa de informação: o status do pedido, o preço atualizado, o cadastro do cliente. As integrações levam esses dados para dentro da conversa, para a equipe e para o agente de IA.",
    image: IMG.comercio,
    sections: [
      {
        title: "Lojas virtuais",
        paragraphs: [
          "Shopify, WooCommerce e Nuvemshop se conectam pela própria tela da Atenza. Catálogo e pedidos ficam disponíveis no atendimento, e o agente de IA pode consultar a situação de um pedido sem a equipe abrir outro sistema.",
        ],
      },
      {
        title: "Qualquer sistema com API",
        paragraphs: [
          "Com as ações de integração você cadastra uma chamada a outro sistema (consultar um cadastro, criar um pedido, emitir um boleto) e o agente de IA passa a poder usá-la. Webhooks de entrada e de saída levam eventos para ferramentas como n8n, Make e Zapier.",
        ],
        bullets: [
          "Shopify, WooCommerce e Nuvemshop",
          "Ações de API sem código",
          "Webhooks de entrada e saída",
          "API REST e servidor MCP",
        ],
      },
    ],
    faq: [
      {
        question: "Tem integração com o meu ERP?",
        answer:
          "Se o seu sistema tem API, ele pode ser ligado pelas ações de integração ou por webhooks. Integrações prontas com sistemas brasileiros estão sendo adicionadas.",
      },
      {
        question: "API e webhooks estão em todos os planos?",
        answer: "API e webhooks estão liberados no plano Ilimitado.",
      },
      {
        question: "Preciso de programador?",
        answer:
          "Para as lojas virtuais, não. Para ações de API, ajuda conhecer a documentação do sistema que será ligado.",
      },
    ],
    relatedSlugs: ["recursos/api-whatsapp", "segmentos/e-commerce", "agentes-ia-whatsapp"],
    kind: "feature",
  },
  {
    slug: "recursos/api-whatsapp",
    title: "API, webhooks e MCP da Atenza",
    description:
      "API REST, webhooks e servidor MCP para integrar a Atenza a qualquer sistema, inclusive para o Claude Code ou o Codex operarem o atendimento e o CRM.",
    eyebrow: "API e MCP",
    headline: "Tudo o que a tela faz, o seu sistema também faz.",
    intro:
      "Contatos, leads, conversas, agendamentos e etapas do funil ficam acessíveis por API REST com token próprio. Eventos saem por webhook, e o servidor MCP deixa assistentes como o Claude Code e o Codex operarem a sua conta com segurança.",
    image: IMG.painel,
    sections: [
      {
        title: "API REST e webhooks",
        paragraphs: [
          "Tokens com permissão por escopo, que você revoga a qualquer momento. Webhooks avisam seus sistemas quando chega mensagem, quando um lead muda de etapa ou quando um agendamento é marcado.",
        ],
      },
      {
        title: "Claude Code e Codex como atendentes",
        paragraphs: [
          "Pelo servidor MCP, o assistente de IA que você já usa pode listar quem está esperando resposta, ler a conversa e responder, além de configurar agentes e etapas. Ele atende enquanto a sessão dele estiver aberta.",
        ],
      },
    ],
    faq: [
      {
        question: "Em qual plano está a API?",
        answer: "API e webhooks estão liberados no plano Ilimitado.",
      },
      {
        question: "O token pode ser revogado?",
        answer: "Sim, a qualquer momento, pela tela de tokens.",
      },
      {
        question: "O MCP atende 24 horas?",
        answer:
          "O atendimento por Claude Code ou Codex funciona enquanto a sessão estiver aberta. Para atender 24 horas sem computador ligado, use o agente de IA com chave de API.",
      },
    ],
    relatedSlugs: ["recursos/integracoes", "agentes-ia-whatsapp", "segmentos/agencias"],
    kind: "feature",
  },
  {
    slug: "recursos/lgpd-whatsapp",
    title: "WhatsApp em conformidade com a LGPD",
    description:
      "Atendimento pelo WhatsApp com LGPD: pedidos de titular, anonimização, trilha de auditoria, DPA publicado e dados de cada empresa isolados.",
    eyebrow: "LGPD",
    headline: "Atendimento organizado e dentro da LGPD.",
    intro:
      "Conversa de WhatsApp tem dado pessoal: nome, telefone, endereço, às vezes informação de saúde. A Atenza foi feita para tratar esses dados com as obrigações da LGPD já no produto, e não num documento esquecido.",
    image: IMG.escritorio,
    sections: [
      {
        title: "Direitos do titular dentro do sistema",
        paragraphs: [
          "Pedido de acesso, correção ou exclusão é registrado com prazo. A exportação dos dados de um contato e a anonimização acontecem pela tela, e cada ação fica na trilha de auditoria.",
        ],
        bullets: [
          "Pedidos de titular com prazo",
          "Anonimização de contato",
          "Trilha de auditoria",
          "DPA e subprocessadores publicados",
        ],
      },
      {
        title: "Cada empresa no seu espaço",
        paragraphs: [
          "Os dados de cada empresa ficam isolados por regras do próprio banco de dados, testadas a cada atualização. Uma conta não enxerga a outra.",
        ],
      },
    ],
    faq: [
      {
        question: "Onde estão o DPA e a lista de subprocessadores?",
        answer: "Publicados em Documentos, no rodapé de todas as páginas.",
      },
      {
        question: "Quem pede para sair deixa de receber mensagens?",
        answer: "Sim. Pedidos de saída bloqueiam novos envios para aquele contato.",
      },
      {
        question: "Dá para apagar os dados de um contato?",
        answer:
          "Sim, pela anonimização, que preserva os números do relatório sem manter a pessoa identificável.",
      },
    ],
    relatedSlugs: ["segmentos/clinicas", "segmentos/advogados", "atendimento-whatsapp"],
    kind: "feature",
  },
  {
    slug: "recursos/relatorios-atendimento",
    title: "Relatórios de atendimento, SLA e satisfação no WhatsApp",
    description:
      "Acompanhe tempo de resposta, prazos de atendimento (SLA), pesquisa de satisfação (CSAT), funil de vendas e uso da IA em relatórios claros.",
    eyebrow: "Relatórios",
    headline: "Saiba como está o atendimento sem abrir conversa por conversa.",
    intro:
      "Quantas conversas chegaram, quanto tempo levou a primeira resposta, quem está atrasado, quanto virou venda. Os relatórios da Atenza respondem isso com os dados do próprio atendimento.",
    image: IMG.painel,
    sections: [
      {
        title: "Prazos e satisfação",
        paragraphs: [
          "Você define o prazo de resposta esperado e a Atenza mostra o que está dentro e fora dele. Ao fim do atendimento, o cliente pode avaliar a conversa com uma pesquisa curta.",
        ],
        bullets: [
          "Prazo de resposta configurável (SLA)",
          "Pesquisa de satisfação (CSAT)",
          "Funil e conversão",
          "Custo e uso da IA",
        ],
      },
    ],
    faq: [
      {
        question: "Em qual plano estão os relatórios?",
        answer: "Relatórios e metas de atendimento estão nos planos Pro e Ilimitado.",
      },
      {
        question: "Os relatórios usam dados reais?",
        answer: "Sim. Tudo sai das conversas, etapas e avaliações registradas na sua conta.",
      },
      {
        question: "A pesquisa de satisfação é obrigatória?",
        answer: "Não. Você liga e desliga quando quiser.",
      },
    ],
    relatedSlugs: ["atendimento-whatsapp", "crm-whatsapp", "recursos/follow-up-automatico"],
    kind: "feature",
  },
];

function segmento(
  slug: string,
  nome: string,
  image: { src: string; alt: string },
  dor: string,
  usos: readonly string[],
  ia: string,
  faq: PaginaSeo["faq"],
  related: readonly string[],
): PaginaSeo {
  return {
    slug: `segmentos/${slug}`,
    title: `WhatsApp com IA e CRM para ${nome}`,
    description: `Atendimento pelo WhatsApp para ${nome}: vários atendentes no mesmo número, agente de IA com as informações do seu negócio, agenda e CRM. Planos a partir de R$ 97.`,
    eyebrow: nome.charAt(0).toUpperCase() + nome.slice(1),
    headline: `O WhatsApp de ${nome} organizado, do primeiro contato ao retorno.`,
    intro: dor,
    image,
    sections: [
      { title: "Como a Atenza entra na rotina", paragraphs: [], bullets: usos },
      { title: "O agente de IA no seu segmento", paragraphs: [ia] },
      {
        title: "Comece sem complicação",
        paragraphs: [
          "Você cria a conta pelo site, conecta o WhatsApp da empresa pela API oficial, cadastra as informações principais do negócio e convida a equipe. Os primeiros 7 dias são sem cobrança, e o cancelamento é feito em um clique.",
        ],
      },
    ],
    faq,
    relatedSlugs: related,
    kind: "segment",
  };
}

export const PAGES_SEGMENTOS: readonly PaginaSeo[] = [
  segmento(
    "clinicas",
    "clínicas e consultórios",
    IMG.clinica,
    "A recepção de uma clínica responde as mesmas perguntas o dia inteiro: horários, convênios, endereço, preparo de exame. Enquanto isso, o paciente que quer marcar fica esperando. A Atenza reúne o WhatsApp da clínica numa caixa compartilhada e deixa o agente de IA cuidar do que se repete.",
    [
      "Agenda pela conversa, com horários livres de cada profissional",
      "Lembrete e confirmação de consulta",
      "Recuperação automática de quem faltou",
      "Histórico do paciente visível para toda a recepção",
    ],
    "O agente responde com as informações que a clínica cadastra (convênios, endereço, preparo) e passa para a recepção qualquer assunto clínico. Ele não dá orientação médica: dúvidas sobre sintomas e tratamento vão para a equipe.",
    [
      {
        question: "A Atenza serve para consultório com uma pessoa só?",
        answer: "Sim. O plano Essencial já atende até 3 pessoas em 1 número.",
      },
      {
        question: "Os dados dos pacientes ficam seguros?",
        answer:
          "Os dados de cada clínica ficam isolados, com trilha de auditoria e ferramentas da LGPD para pedidos de pacientes.",
      },
      {
        question: "Integra com Google Agenda?",
        answer: "Sim, a agenda pode ser conectada ao Google Agenda e ao Google Meet.",
      },
    ],
    ["recursos/agenda-whatsapp", "recursos/lgpd-whatsapp", "agentes-ia-whatsapp"],
  ),
  segmento(
    "e-commerce",
    "e-commerce e lojas",
    IMG.comercio,
    "Na loja virtual, cada pergunta no WhatsApp é uma venda em jogo: tem o tamanho, quanto custa o frete, onde está meu pedido. A Atenza conecta a loja ao atendimento para a resposta sair rápida e certa.",
    [
      "Integração com Shopify, WooCommerce e Nuvemshop",
      "Consulta de pedido e catálogo dentro da conversa",
      "Campanhas para clientes segmentados",
      "Funil de vendas com cada negociação",
    ],
    "O agente de IA consulta o catálogo e o status do pedido para responder sozinho as dúvidas mais comuns, e passa para a equipe trocas, exceções e negociações.",
    [
      {
        question: "Funciona com a minha loja?",
        answer:
          "Shopify, WooCommerce e Nuvemshop se conectam pela tela. Outras plataformas com API podem ser ligadas por ações de integração.",
      },
      {
        question: "Dá para mandar promoção para os clientes?",
        answer: "Sim, pelas campanhas, nos planos Pro e Ilimitado.",
      },
      {
        question: "Vários atendentes podem usar o mesmo número?",
        answer: "Sim. O Essencial já inclui até 3 pessoas no mesmo número.",
      },
    ],
    ["recursos/integracoes", "recursos/campanhas-whatsapp", "crm-whatsapp"],
  ),
  segmento(
    "escolas",
    "escolas e cursos",
    IMG.educacao,
    "Época de matrícula enche o WhatsApp da escola de perguntas sobre turmas, valores e horários. A Atenza organiza essas conversas, responde o que se repete e acompanha cada interessado até a matrícula.",
    [
      "Funil de matrícula do primeiro contato à inscrição",
      "Respostas sobre turmas, valores e horários",
      "Agendamento de visita ou aula experimental",
      "Avisos para alunos e responsáveis por campanha",
    ],
    "O agente de IA responde com as informações oficiais da escola e encaminha para a secretaria negociações, bolsas e casos específicos.",
    [
      {
        question: "Serve para escola de idiomas e cursos livres?",
        answer: "Sim. O funil e as respostas são configurados para o seu tipo de curso.",
      },
      {
        question: "Dá para enviar aviso para todos os alunos?",
        answer:
          "Sim, por campanha, nos planos Pro e Ilimitado, respeitando quem pediu para não receber.",
      },
      {
        question: "A secretaria inteira pode atender?",
        answer: "Sim. Várias pessoas atendem no mesmo número, cada uma com o próprio acesso.",
      },
    ],
    ["recursos/campanhas-whatsapp", "recursos/agenda-whatsapp", "crm-whatsapp"],
  ),
  segmento(
    "imobiliarias",
    "imobiliárias e corretores",
    IMG.servicos,
    "Anúncio de imóvel gera dezenas de contatos, e muitos param na primeira pergunta. A Atenza qualifica cada interessado, distribui entre os corretores e não deixa ninguém sem retorno.",
    [
      "Distribuição automática de contatos entre corretores",
      "Agendamento de visitas pela conversa",
      "Funil por imóvel ou por etapa da negociação",
      "Follow-up para quem parou de responder",
    ],
    "O agente de IA faz a primeira triagem (tipo de imóvel, bairro, faixa de preço) e entrega ao corretor um contato já qualificado, com o histórico.",
    [
      {
        question: "Cada corretor vê só os próprios contatos?",
        answer:
          "As conversas podem ser distribuídas e atribuídas por pessoa, e a gestão acompanha tudo.",
      },
      {
        question: "Dá para saber de qual anúncio veio o contato?",
        answer: "Contatos vindos de anúncios da Meta podem ser atribuídos à campanha de origem.",
      },
      {
        question: "Funciona para corretor autônomo?",
        answer: "Sim. O plano Essencial atende até 3 pessoas em 1 número.",
      },
    ],
    ["recursos/follow-up-automatico", "recursos/agenda-whatsapp", "crm-whatsapp"],
  ),
  segmento(
    "advogados",
    "escritórios de advocacia",
    IMG.escritorio,
    "No escritório, o WhatsApp recebe de tudo: cliente perguntando do processo, interessado querendo consulta, documento chegando. A Atenza separa, registra e encaminha cada conversa para a pessoa certa, com sigilo.",
    [
      "Triagem do primeiro contato por área do direito",
      "Agendamento de consulta",
      "Histórico de cada cliente com trilha de auditoria",
      "Ferramentas da LGPD para pedidos de titulares",
    ],
    "O agente de IA faz a triagem e responde dúvidas administrativas (horário, documentos necessários, valores de consulta definidos pelo escritório). Ele não dá parecer jurídico: questões de mérito vão para o advogado.",
    [
      {
        question: "A IA dá orientação jurídica?",
        answer:
          "Não. Ela faz triagem e responde informações administrativas cadastradas pelo escritório.",
      },
      {
        question: "As conversas ficam registradas?",
        answer: "Sim, com histórico e trilha de auditoria por contato.",
      },
      {
        question: "Atende escritório pequeno?",
        answer: "Sim. O plano Essencial atende até 3 pessoas em 1 número.",
      },
    ],
    ["recursos/lgpd-whatsapp", "recursos/agenda-whatsapp", "atendimento-whatsapp"],
  ),
  segmento(
    "restaurantes",
    "restaurantes e delivery",
    IMG.comercio,
    "Horário de pico é quando o WhatsApp do restaurante mais toca: cardápio, taxa de entrega, reserva, pedido. A Atenza responde o que se repete na hora e deixa a equipe livre para o que precisa de gente.",
    [
      "Respostas sobre cardápio, horários e área de entrega",
      "Reservas pela conversa",
      "Campanhas de promoção para clientes da casa",
      "Vários atendentes no mesmo número",
    ],
    "O agente de IA responde com o cardápio e as regras que o restaurante cadastra e passa para a equipe pedidos especiais e reclamações.",
    [
      {
        question: "A IA anota pedidos?",
        answer:
          "Ela responde e coleta as informações do pedido; a confirmação final fica com a equipe, conforme a sua operação.",
      },
      {
        question: "Dá para mandar promoção da semana?",
        answer: "Sim, por campanha, nos planos Pro e Ilimitado.",
      },
      {
        question: "Funciona fora do horário?",
        answer: "Sim. Com chave de API, o agente de IA responde 24 horas.",
      },
    ],
    ["recursos/campanhas-whatsapp", "chatbot-para-whatsapp", "atendimento-whatsapp"],
  ),
  segmento(
    "agencias",
    "agências e revendedores",
    IMG.escritorio,
    "Agência que cuida do marketing de vários clientes precisa de um atendimento que funcione para cada um, sem misturar dados. A Atenza separa cada cliente na própria conta e pode ser apresentada com a marca da agência.",
    [
      "Uma conta isolada por cliente",
      "Marca própria: nome, logo e cores da agência",
      "API, webhooks e MCP para automatizar a operação",
      "Atribuição de contatos vindos de anúncios da Meta",
    ],
    "A agência configura agentes de IA, funis e follow-ups para cada cliente, inclusive pelo Claude Code ou Codex via MCP.",
    [
      {
        question: "Posso usar a minha marca?",
        answer: "Sim. Nome, logo e cores podem ser configurados.",
      },
      {
        question: "Os dados de um cliente aparecem para outro?",
        answer: "Não. Cada conta é isolada no banco de dados.",
      },
      {
        question: "Qual plano faz sentido para agência?",
        answer: "O Ilimitado libera números e equipe sem limite, além de API e webhooks.",
      },
    ],
    ["recursos/api-whatsapp", "recursos/integracoes", "crm-whatsapp"],
  ),
  segmento(
    "servicos",
    "prestadores de serviço",
    IMG.servicos,
    "Quem presta serviço vive de orçamento pelo WhatsApp, e orçamento sem retorno é dinheiro que fica na mesa. A Atenza organiza cada pedido, agenda a visita e volta a falar com quem não respondeu.",
    [
      "Coleta das informações para o orçamento",
      "Agendamento de visita técnica",
      "Follow-up de orçamento sem resposta",
      "Funil com cada negociação em andamento",
    ],
    "O agente de IA pergunta o que precisa para o orçamento (serviço, endereço, prazo) e entrega à equipe um pedido completo, com histórico.",
    [
      {
        question: "Serve para quem trabalha sozinho?",
        answer:
          "Sim. O plano Essencial atende até 3 pessoas em 1 número, e o agente de IA responde quando você está em atendimento.",
      },
      {
        question: "Dá para lembrar o cliente do orçamento?",
        answer: "Sim, pelo follow-up automático, nos planos Pro e Ilimitado.",
      },
      {
        question: "Atende a Grande São Paulo?",
        answer:
          "A Atenza é online e atende empresas de todo o Brasil, inclusive a Grande São Paulo.",
      },
    ],
    ["recursos/follow-up-automatico", "recursos/agenda-whatsapp", "atendimento-whatsapp-sao-paulo"],
  ),
];
