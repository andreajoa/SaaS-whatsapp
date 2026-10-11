import { PAGES_RECURSOS, PAGES_SEGMENTOS } from "./conteudo-recursos";
/** Conteúdo editorial público; marca e condições comerciais resolvidas na página. */
export type PaginaSeo = {
  readonly slug: string;
  readonly title: string;
  readonly description: string;
  readonly eyebrow: string;
  readonly headline: string;
  readonly intro: string;
  readonly image: { readonly src: string; readonly alt: string };
  readonly sections: readonly {
    readonly title: string;
    readonly paragraphs: readonly string[];
    readonly bullets?: readonly string[];
  }[];
  readonly faq: readonly { readonly question: string; readonly answer: string }[];
  readonly relatedSlugs: readonly string[];
  readonly kind: "solution" | "guide" | "regional" | "feature" | "segment";
};

const PAGES_BASE: readonly PaginaSeo[] = [
  {
    slug: "atendimento-whatsapp",
    title: "Atendimento no WhatsApp com equipe, histórico e IA",
    description:
      "Organize o atendimento no WhatsApp em uma caixa compartilhada, com múltiplos atendentes, histórico, agentes de IA e passagem para a equipe humana.",
    eyebrow: "Atendimento em equipe",
    headline: "Atendimento no WhatsApp que continua com a sua equipe.",
    intro:
      "Quando vendas e suporte dividem o WhatsApp, a dificuldade costuma ser saber quem está cuidando de cada conversa. Uma caixa compartilhada reúne mensagens, contexto e equipe no mesmo ambiente. Assim, o atendimento deixa de depender de alguém lembrar o que aconteceu no celular e passa a ter uma rotina que todos conseguem acompanhar.",
    image: {
      src: "/media/atenza/hero-office.webp",
      alt: "Cena ilustrativa de uma equipe trabalhando em um escritório",
    },
    sections: [
      {
        title: "Comece pela responsabilidade de cada conversa",
        paragraphs: [
          "Ter vários atendentes no WhatsApp faz sentido quando existe uma divisão clara de trabalho. Defina quem recebe novas solicitações, quem cuida de clientes em negociação e quem assume os casos que precisam de decisão. O histórico compartilhado ajuda na troca de turno e evita pedir novamente uma informação que a pessoa já enviou.",
          "Antes de ativar automações, organize um primeiro fluxo simples: receber a mensagem, entender o motivo, indicar o responsável e registrar o próximo passo. Uma equipe pequena pode começar com poucas categorias. O objetivo é tornar a operação compreensível para quem atende e para quem acompanha o negócio.",
        ],
      },
      {
        title: "Combine a primeira resposta com atendimento humano",
        paragraphs: [
          "Agentes de IA podem consultar a base de conhecimento da empresa para responder dúvidas recorrentes e coletar informações iniciais. Para isso, a configuração precisa incluir conteúdo atualizado, instruções de atendimento e critérios de passagem para uma pessoa. O histórico permanece disponível para a equipe continuar a conversa com contexto.",
          "Imagine uma loja que recebe perguntas sobre troca e também pedidos de exceção. A política publicada serve de referência para a resposta inicial; uma situação fora da política deve seguir para o responsável. Automatizar perguntas conhecidas funciona melhor quando a equipe sabe reconhecer o momento de intervir.",
        ],
      },
      {
        title: "Conecte a conversa ao trabalho que vem depois",
        paragraphs: [
          "Nem toda mensagem termina em uma resposta. Algumas precisam virar uma oportunidade no CRM, outras exigem consultar informações da loja. O funil em kanban ajuda a acompanhar negociações. Integrações com Shopify, WooCommerce e Nuvemshop, além de API e webhooks, dependem de conexão e configuração para fazer parte da operação.",
        ],
        bullets: [
          "Identifique os assuntos recorrentes e escreva respostas de referência.",
          "Defina quem acompanha negociações que ficaram aguardando retorno.",
          "Teste a troca entre IA e pessoa antes de ampliar a automação.",
          "Revise conversas problemáticas para ajustar conteúdo e instruções.",
        ],
      },
      {
        title: "Escolha pelo uso real da sua equipe",
        paragraphs: [
          "Avalie quantidade de usuários, conexão do WhatsApp, recursos do plano e consumo do provedor de IA. A página de planos mostra as condições comerciais atuais. A configuração da conexão e as credenciais de IA precisam ser consideradas no orçamento. Para comparar opções, reproduza uma conversa típica e verifique se outro atendente consegue continuá-la sem reconstruir o contexto.",
        ],
      },
    ],
    faq: [
      {
        question: "Vários atendentes conseguem trabalhar no mesmo atendimento?",
        answer:
          "A caixa compartilhada permite uma operação com múltiplos atendentes. Combine responsáveis e regras de trabalho para que a equipe saiba quem acompanha cada conversa e quando deve assumir um caso.",
      },
      {
        question: "Preciso usar IA em todas as conversas?",
        answer:
          "Você pode organizar a equipe e o histórico antes de ampliar o uso de IA. Escolha assuntos adequados à automação e mantenha atendimento humano para exceções e decisões que exigem avaliação.",
      },
      {
        question: "Como avaliar se o atendimento ficou melhor?",
        answer:
          "Compare conversas sem responsável, solicitações de informações repetidas e negociações esquecidas antes e depois da mudança. Revise também respostas incorretas: rapidez sozinha não comprova qualidade.",
      },
    ],
    relatedSlugs: [
      "chatbot-para-whatsapp",
      "crm-whatsapp",
      "guias/como-escolher-atendimento-whatsapp",
    ],
    kind: "solution",
  },
  {
    slug: "chatbot-para-whatsapp",
    title: "Chatbot para WhatsApp: respostas com contexto e equipe humana",
    description:
      "Entenda como configurar um chatbot para WhatsApp com base de conhecimento, dúvidas frequentes, testes de atendimento e passagem para uma pessoa.",
    eyebrow: "Automação de conversas",
    headline: "Responda o que se repete. Dê atenção ao que exige cuidado.",
    intro:
      "Quem procura um chatbot para WhatsApp geralmente quer reduzir a repetição de perguntas sobre horários, produtos ou condições. O primeiro passo é escolher quais dúvidas têm uma resposta confiável. Um agente de IA com base de conhecimento pode interpretar a mensagem e usar informações da empresa, enquanto a equipe humana acompanha exceções e assuntos que pedem uma decisão.",
    image: {
      src: "/media/atenza/segmento-comercio.webp",
      alt: "Cena ilustrativa de atendimento em um comércio",
    },
    sections: [
      {
        title: "Escolha as perguntas antes de escolher a automação",
        paragraphs: [
          "Separe uma amostra de conversas e liste os motivos de contato. Perguntas sobre endereço, funcionamento e política de troca costumam ter fontes claras. Descontos especiais, reclamações delicadas e promessas de entrega exigem mais cuidado. Essa separação orienta o conteúdo da base e os momentos em que o atendimento deve seguir para uma pessoa.",
          "Um fluxo de opções pode servir para caminhos previsíveis; uma resposta com IA ajuda quando o cliente escreve de formas diferentes. A escolha depende do problema. Nesta plataforma, os agentes de IA usam instruções e uma base de conhecimento configurada pela empresa. A qualidade da resposta depende também da qualidade desse material.",
        ],
      },
      {
        title: "Prepare uma base que a equipe também usaria",
        paragraphs: [
          "Escreva políticas com linguagem direta, informe condições e retire versões antigas. Evite documentos que misturam ofertas vencidas e regras atuais. Se o preço ou a disponibilidade varia, defina de onde a informação deve vir e quem pode confirmá-la. Um documento estático não substitui dados atualizados de um sistema conectado.",
          "Em um exemplo de loja, a base pode explicar como solicitar uma troca e quais dados são necessários. Já a situação de um pedido específico depende de uma integração disponível e configurada, ou de consulta pela equipe. O chatbot não deve inventar o andamento de uma compra quando essa informação não está acessível.",
        ],
      },
      {
        title: "Teste também as perguntas difíceis",
        paragraphs: [
          "Antes de usar a automação com clientes, reproduza perguntas curtas, erros de digitação e solicitações fora do assunto. Confira se a resposta respeita a política e se a equipe consegue assumir a conversa. Um bom teste inclui o cliente pedindo uma pessoa e uma informação ausente na base, além das perguntas que você espera receber.",
        ],
        bullets: [
          "Pergunta conhecida: a resposta corresponde à fonte atual?",
          "Pedido de exceção: o caso chega ao responsável humano?",
          "Informação ausente: a automação evita uma promessa sem fundamento?",
          "Continuação da conversa: o atendente encontra o histórico?",
        ],
      },
      {
        title: "Inclua manutenção e consumo no orçamento",
        paragraphs: [
          "Consulte os planos atuais e considere o provedor de IA conectado com suas credenciais. O volume e a configuração influenciam o consumo; a conexão do WhatsApp também pode envolver custos conforme a instalação. Reserve tempo para revisar conversas e atualizar a base quando uma política mudar. Automatizar atendimento exige acompanhamento, mesmo depois de a primeira configuração funcionar.",
        ],
      },
    ],
    faq: [
      {
        question: "Um chatbot com IA precisa de respostas prontas para cada frase?",
        answer:
          "Não para cada frase possível. Ele precisa de instruções claras e informações de referência. Formas diferentes de perguntar ainda devem ser testadas para verificar se a resposta mantém o sentido correto.",
      },
      {
        question: "O chatbot pode informar o status de qualquer pedido?",
        answer:
          "Isso depende de acesso aos dados por uma integração configurada e do comportamento habilitado. Sem essa informação disponível, a consulta precisa seguir para a equipe; a base de conhecimento sozinha não comprova o status.",
      },
      {
        question: "O que fazer quando a política de troca muda?",
        answer:
          "Atualize a fonte usada na base, retire a orientação antiga e teste novamente perguntas sobre troca. Avise a equipe para que respostas humanas e automáticas usem a mesma regra.",
      },
    ],
    relatedSlugs: [
      "agentes-ia-whatsapp",
      "atendimento-whatsapp",
      "guias/como-escolher-atendimento-whatsapp",
    ],
    kind: "solution",
  },
  {
    slug: "agentes-ia-whatsapp",
    title: "Agentes de IA no WhatsApp com conhecimento do seu negócio",
    description:
      "Configure agentes de IA para WhatsApp com instruções, base de conhecimento, provedor próprio e continuidade do atendimento com sua equipe humana.",
    eyebrow: "IA com contexto",
    headline: "Seu conhecimento orienta a IA. Sua equipe continua no comando.",
    intro:
      "Um agente de IA no WhatsApp combina instruções, informações do negócio e contexto da conversa para elaborar respostas. Essa combinação pode apoiar o atendimento inicial e a qualificação de interessados. Para funcionar na prática, precisa de um escopo definido: o que responder, quais informações coletar e quando entregar a conversa a uma pessoa que possa decidir.",
    image: {
      src: "/media/atenza/segmento-servicos.webp",
      alt: "Cena ilustrativa de profissionais organizando o atendimento de serviços",
    },
    sections: [
      {
        title: "Dê uma função concreta para o agente",
        paragraphs: [
          "Comece com uma responsabilidade que você consegue avaliar, como explicar serviços e identificar o motivo do contato. Configure o tom de voz, as informações necessárias e os limites da resposta. Um agente genérico, orientado apenas a vender mais, tem menos referências para lidar com dúvidas e exceções do que um agente com uma função delimitada.",
          "Em um exemplo de empresa de manutenção, a IA pode perguntar qual equipamento precisa de atenção e apresentar as condições documentadas de atendimento. Diagnóstico definitivo e orçamento fora das condições publicadas devem passar por uma pessoa. O exemplo orienta a configuração; não significa que qualquer integração ou decisão esteja habilitada automaticamente.",
        ],
      },
      {
        title: "Conhecimento e instrução cumprem papéis diferentes",
        paragraphs: [
          "A base de conhecimento reúne referências: serviços, políticas, perguntas frequentes e procedimentos. As instruções orientam como o agente conversa e em quais situações deve solicitar ajuda. Manter esses dois elementos claros ajuda a revisar uma resposta incorreta: pode faltar informação na fonte ou pode existir uma orientação inadequada sobre como usá-la.",
          "Treinar, neste contexto, significa preparar a base e configurar o comportamento do agente. Não é uma promessa de que ele aprenderá sozinho cada mudança da empresa. Quando uma condição comercial mudar, atualize a referência e faça um novo teste. Escolha alguém da equipe para cuidar dessa revisão.",
        ],
      },
      {
        title: "Prepare a continuidade entre IA e pessoa",
        paragraphs: [
          "A passagem para atendimento humano precisa fazer parte do desenho inicial. Defina quem recebe uma reclamação, uma dúvida sem resposta ou uma negociação que exige autorização. A caixa compartilhada e o histórico oferecem contexto para continuar o caso. Depois da intervenção humana, revise instruções e conteúdo quando o episódio revelar uma lacuna recorrente.",
        ],
        bullets: [
          "Escreva assuntos que a IA pode atender com referências conhecidas.",
          "Liste situações que exigem avaliação humana.",
          "Teste a conversa completa, incluindo a troca de responsável.",
          "Corrija a fonte ou a instrução quando encontrar uma resposta inadequada.",
        ],
      },
      {
        title: "Acompanhe o provedor e as dependências",
        paragraphs: [
          "O uso de IA depende do provedor configurado com credenciais do cliente. Modelo, volume de conversas e tamanho das referências podem influenciar consumo e comportamento. Confira as condições atuais do plano e do provedor antes de ampliar a operação. Consultas a sistemas externos dependem de integrações instaladas e configuradas; ter um agente não torna todos os dados da empresa acessíveis.",
        ],
      },
    ],
    faq: [
      {
        question: "A IA aprende automaticamente tudo o que a empresa faz?",
        answer:
          "Não. Você precisa fornecer referências, configurar instruções e revisar mudanças. O histórico ajuda no contexto da conversa, mas não substitui uma base atualizada nem uma revisão do comportamento.",
      },
      {
        question: "Quem paga o consumo do provedor de IA?",
        answer:
          "O provedor é conectado com credenciais do cliente. Verifique a cobrança desse serviço e as condições do plano da plataforma para calcular o custo completo da configuração escolhida.",
      },
      {
        question: "Qual é um bom primeiro uso para um agente?",
        answer:
          "Escolha dúvidas frequentes com respostas documentadas e um responsável humano disponível para exceções. Teste esse escopo antes de incluir negociações complexas ou consultas que dependem de outros sistemas.",
      },
    ],
    relatedSlugs: ["chatbot-para-whatsapp", "atendimento-whatsapp", "crm-whatsapp"],
    kind: "solution",
  },
  {
    slug: "crm-whatsapp",
    title: "CRM para WhatsApp com funil kanban e histórico de conversas",
    description:
      "Acompanhe oportunidades que chegam pelo WhatsApp com CRM em kanban, histórico e equipe. Saiba como organizar etapas, responsáveis e integrações.",
    eyebrow: "Conversas e oportunidades",
    headline: "A mensagem chegou. Agora a oportunidade precisa de um caminho.",
    intro:
      "Responder uma mensagem não basta para acompanhar uma venda. Um CRM para WhatsApp ajuda a relacionar o contato ao estágio da negociação e ao próximo trabalho da equipe. O funil em kanban oferece uma visão das oportunidades, enquanto o histórico de conversas preserva as informações que explicam por que cada caso está naquela etapa.",
    image: {
      src: "/media/atenza/segmento-comercio.webp",
      alt: "Cena ilustrativa de uma loja organizando o relacionamento com clientes",
    },
    sections: [
      {
        title: "Use etapas que representem decisões reais",
        paragraphs: [
          "Comece com o caminho que seu cliente percorre. Um exemplo para prestação de serviços é: novo interesse, necessidade entendida, proposta enviada e decisão pendente. Esses nomes são uma sugestão de organização, não uma regra obrigatória. Uma etapa útil informa o que já ocorreu e o que falta para a negociação avançar.",
          "Evite criar uma coluna para cada detalhe do atendimento. Se duas etapas exigem exatamente a mesma ação, talvez possam ser uma só. Combine com a equipe o significado de cada estágio para que mover uma oportunidade represente uma mudança real. O kanban perde utilidade quando cada pessoa interpreta as colunas de um jeito.",
        ],
      },
      {
        title: "Mantenha a conversa perto da oportunidade",
        paragraphs: [
          "O histórico ajuda quem assume o atendimento a entender o pedido, as condições discutidas e o motivo da espera. Na rotina comercial, esse contexto evita refazer perguntas e facilita revisar uma negociação que ficou parada. A caixa compartilhada permite que o trabalho continue quando o atendente inicial não está disponível.",
          "Imagine um interessado que pediu um orçamento e respondeu apenas no dia seguinte. A equipe precisa localizar a conversa e conferir o que foi combinado antes de responder. O CRM acrescenta a visão do funil a esse atendimento: qual oportunidade está em andamento e que próximo passo deve ser acompanhado pelo responsável.",
        ],
      },
      {
        title: "Integre apenas o que ajuda a decisão",
        paragraphs: [
          "As conexões com Shopify, WooCommerce e Nuvemshop podem fazer parte da operação quando estiverem instaladas e configuradas. API e webhooks permitem planejar conexões com outros sistemas conforme o fluxo necessário. Antes de integrar, identifique que informação o atendente precisa consultar e em qual momento; reunir dados sem uso claro aumenta o trabalho de manutenção.",
        ],
        bullets: [
          "Defina um responsável pelo acompanhamento de cada negociação.",
          "Registre o próximo passo depois de enviar uma proposta.",
          "Separe uma venda concluída de uma conversa apenas respondida.",
          "Revise oportunidades paradas e confira o motivo antes de agir.",
        ],
      },
      {
        title: "Avalie o processo antes de ampliar a equipe",
        paragraphs: [
          "Teste uma negociação do primeiro contato à conclusão e peça a outro atendente para continuá-la no meio do caminho. Confira se ele encontra o contexto e entende o estágio. Consulte os planos atuais para avaliar recursos e usuários da operação. Se usar IA na qualificação, inclua o consumo do provedor no orçamento e revise se as informações coletadas ajudam a equipe a decidir.",
        ],
      },
    ],
    faq: [
      {
        question: "CRM para WhatsApp substitui a caixa de atendimento?",
        answer:
          "Os dois recursos se complementam. A caixa organiza conversas e trabalho de atendimento; o CRM acompanha oportunidades e etapas da negociação. Uma resposta enviada não significa necessariamente que a venda avançou.",
      },
      {
        question: "Quantas etapas devo criar no funil?",
        answer:
          "Crie as etapas necessárias para representar decisões do seu processo. Comece com poucas, defina o significado de cada uma e acrescente outra somente quando ela mudar a ação esperada da equipe.",
      },
      {
        question: "As integrações com lojas funcionam sem configuração?",
        answer:
          "Não. Cada conexão precisa ser configurada com as credenciais e condições do sistema correspondente. Confira quais dados e comportamentos estão disponíveis para a integração que sua operação utilizará.",
      },
    ],
    relatedSlugs: [
      "atendimento-whatsapp",
      "agentes-ia-whatsapp",
      "guias/como-escolher-atendimento-whatsapp",
    ],
    kind: "solution",
  },
  {
    slug: "atendimento-whatsapp-sao-paulo",
    title: "Atendimento no WhatsApp para empresas de São Paulo",
    description:
      "Software online de atendimento no WhatsApp para empresas de São Paulo e Grande SP, com equipe, histórico, CRM e IA configurada para seu negócio.",
    eyebrow: "São Paulo e Grande SP",
    headline: "Seu negócio é local. A organização do atendimento pode ser online.",
    intro:
      "Empresas de São Paulo e da Grande São Paulo podem organizar o WhatsApp em um software acessado pelo navegador. A equipe reúne conversas, histórico e oportunidades no mesmo ambiente, mesmo quando atende em locais diferentes. A solução é online: a localização da empresa orienta seus processos e referências, sem exigir um atendimento presencial para usar a plataforma.",
    image: {
      src: "/media/atenza/segmento-servicos.webp",
      alt: "Cena ilustrativa de uma equipe de serviços atendendo clientes",
    },
    sections: [
      {
        title: "Comércio em Guarulhos: perguntas claras antes da venda",
        paragraphs: [
          "Como exemplo de configuração, pense em uma loja independente de Guarulhos que recebe dúvidas sobre retirada e troca. A equipe pode reunir políticas, endereço e horários na base de conhecimento e usar o histórico para continuar negociações. Uma pergunta sobre disponibilidade precisa de uma fonte atualizada ou de confirmação humana, conforme a configuração da operação.",
          "O CRM em kanban ajuda a distinguir quem está pesquisando de quem aguarda uma proposta. Se a loja usa Shopify, WooCommerce ou Nuvemshop, a integração depende de instalação e configuração. Esse cenário descreve uma possibilidade de uso; não é um caso de cliente nem uma promessa de resultado comercial.",
        ],
      },
      {
        title: "Clínicas no ABC: informação administrativa com cuidado",
        paragraphs: [
          "Em uma clínica de Santo André, São Bernardo ou São Caetano, o primeiro contato pode envolver localização, funcionamento e informações administrativas. Uma base revisada ajuda a manter orientações consistentes. Defina quais dados realmente são necessários para esse contato e quais assuntos precisam ser encaminhados à equipe responsável, evitando tratar mensagens de saúde como perguntas comerciais comuns.",
          "A IA deve ficar dentro do escopo documentado pela clínica. Dúvidas sobre sintomas, diagnóstico ou decisões clínicas precisam de avaliação profissional adequada. Não presuma agenda conectada ou confirmação automática de consultas: qualquer comportamento desse tipo depende dos recursos e integrações efetivamente configurados para aquela operação.",
        ],
      },
      {
        title: "Serviços em Osasco: organize o orçamento e a região atendida",
        paragraphs: [
          "Uma prestadora de serviços de Osasco pode receber solicitações de bairros e cidades diferentes. Como exemplo de processo, registre regiões atendidas, condições do serviço e informações necessárias para analisar um orçamento. A IA pode apoiar perguntas iniciais com essas referências; a equipe confirma exceções e acompanha oportunidades que dependem de visita ou avaliação do próprio prestador.",
        ],
        bullets: [
          "Mantenha endereço, horários e regiões de atendimento atualizados.",
          "Informe condições diferentes entre unidades quando existirem.",
          "Defina quem assume dúvidas específicas e pedidos de exceção.",
          "Teste a continuidade do atendimento entre membros da equipe.",
        ],
      },
      {
        title: "Compare software, configuração e custo total",
        paragraphs: [
          "O acesso à plataforma acontece pela web. Consulte os planos atuais e o canal de contato publicado para dúvidas sobre o software. Considere usuários, recursos, conexão do WhatsApp e consumo do provedor de IA conforme sua configuração. A página regional ajuda a pensar rotinas de empresas locais; contratação de software não implica consultoria presencial, visita técnica ou execução de serviços no estabelecimento.",
        ],
      },
    ],
    faq: [
      {
        question: "Preciso estar na capital para usar o software?",
        answer:
          "Não. O acesso é online pelo navegador. Empresas da Grande São Paulo podem organizar sua equipe, base de conhecimento e funil conforme as necessidades da própria operação.",
      },
      {
        question: "Esta página oferece atendimento presencial em São Paulo?",
        answer:
          "A oferta é de software online. Os exemplos locais ajudam a planejar a configuração e não representam escritório, visita técnica ou consultoria presencial incluída na contratação.",
      },
      {
        question: "Posso informar áreas diferentes de atendimento?",
        answer:
          "Prepare referências com as regiões e condições praticadas pela sua empresa. Teste perguntas sobre cada área e defina quem confirma situações que não estejam previstas na base.",
      },
    ],
    relatedSlugs: [
      "atendimento-whatsapp",
      "crm-whatsapp",
      "guias/como-escolher-atendimento-whatsapp",
    ],
    kind: "regional",
  },
  {
    slug: "guias/como-escolher-atendimento-whatsapp",
    title: "Como escolher uma plataforma de atendimento no WhatsApp",
    description:
      "Compare plataformas de atendimento no WhatsApp por equipe, histórico, IA, CRM, integrações e custo total. Use um roteiro de testes antes de automatizar.",
    eyebrow: "Guia de escolha",
    headline: "Escolha com uma conversa real. Depois compare a lista de recursos.",
    intro:
      "Uma plataforma de atendimento no WhatsApp precisa resolver a rotina da sua equipe. Para comparar alternativas, transforme os problemas atuais em situações que você consegue testar: troca de atendente, dúvida recorrente, pedido de exceção e negociação que ficou aguardando resposta. Esse roteiro mostra se a ferramenta encaixa no processo antes de você investir em configuração e automação.",
    image: {
      src: "/media/atenza/hero-office.webp",
      alt: "Cena ilustrativa de profissionais avaliando uma operação de atendimento",
    },
    sections: [
      {
        title: "1. Descreva o trabalho que precisa melhorar",
        paragraphs: [
          "Liste quem atende, quais assuntos chegam e onde o trabalho se perde. Se a dificuldade é dividir conversas, avalie caixa compartilhada e múltiplos atendentes. Se oportunidades desaparecem depois do orçamento, teste o CRM e o funil. Se perguntas iguais consomem a equipe, examine a base de conhecimento e os critérios de atendimento com IA.",
          "Defina também seus requisitos de conexão do WhatsApp. Pergunte como a conta é conectada, quais dependências precisam funcionar e como a equipe identifica uma interrupção. Não trate métodos de conexão diferentes como se fossem equivalentes; confirme o modelo oferecido e sua adequação às exigências da empresa antes de contratar.",
        ],
      },
      {
        title: "2. Faça a ferramenta passar por uma conversa completa",
        paragraphs: [
          "Use um ambiente de teste e dados fictícios. Inicie uma conversa, peça uma informação conhecida e depois solicite uma condição que exige autorização. Troque o atendente e confira se ele consegue continuar pelo histórico. Caso use CRM, acompanhe a oportunidade até a etapa seguinte e verifique se o responsável entende o próximo passo.",
        ],
        bullets: [
          "Uma pergunta sem resposta na base precisa revelar o limite da IA.",
          "Um pedido de atendimento humano precisa chegar a uma pessoa responsável.",
          "Uma política alterada precisa produzir a orientação atual após revisão.",
          "Uma integração necessária precisa ser testada com o sistema conectado.",
        ],
      },
      {
        title: "3. Calcule o custo da configuração escolhida",
        paragraphs: [
          "Compare o preço do plano com a quantidade de usuários, recursos e limites incluídos. Acrescente consumo do provedor de IA, quando ele usa credenciais do cliente, e custos da conexão do WhatsApp conforme o modelo de configuração. Verifique ainda implantação, manutenção das integrações e tempo da equipe para atualizar conteúdo. Esses itens podem variar entre propostas.",
          "Use os planos publicados como referência atual e confirme as condições antes da contratação. Uma mensalidade isolada não descreve o custo total. Para estimar o uso de IA, registre o consumo de uma amostra representativa no provedor e considere que volume e tamanho das conversas podem mudar ao longo do mês.",
        ],
      },
      {
        title: "4. Automatize aos poucos e revise o resultado",
        paragraphs: [
          "Comece por assuntos documentados, com um responsável humano para exceções. Revise respostas incorretas, conversas sem continuidade e dados coletados sem finalidade clara. Confira permissões, tratamento de informações e possibilidades de acesso aos dados com quem administra a operação. Escolher uma ferramenta inclui decidir quem cuidará dela depois da contratação.",
          "Nesta plataforma, o atendimento reúne WhatsApp, equipe, histórico, agentes de IA e CRM. Integrações com lojas, API e webhooks dependem de configuração. Use as páginas de cada recurso para preparar perguntas específicas e os testes acima para avaliar o encaixe. Amplie a automação depois de comprovar a qualidade da rotina inicial.",
        ],
      },
    ],
    faq: [
      {
        question: "Qual teste devo fazer primeiro?",
        answer:
          "Teste a passagem de uma conversa para outro atendente. Ela mostra se o histórico e a divisão de responsabilidades permitem continuar o atendimento sem pedir novamente tudo ao cliente.",
      },
      {
        question: "Devo comparar apenas o preço mensal?",
        answer:
          "Compare plano, usuários, consumo de IA, conexão do WhatsApp e manutenção conforme cada proposta. Confirme o que está incluído e quem paga os serviços externos necessários à configuração.",
      },
      {
        question: "Quando é hora de ampliar a automação?",
        answer:
          "Depois de testar respostas, exceções e passagem para humanos no escopo inicial. Revise conversas e ajuste fontes e instruções antes de incluir assuntos mais complexos ou novas integrações.",
      },
    ],
    relatedSlugs: [
      "atendimento-whatsapp",
      "chatbot-para-whatsapp",
      "agentes-ia-whatsapp",
      "crm-whatsapp",
    ],
    kind: "guide",
  },
];

/** Toda página editorial pública: soluções, guia, região, recursos e segmentos. */
export const PAGES_SEO: readonly PaginaSeo[] = [
  ...PAGES_BASE,
  ...PAGES_RECURSOS,
  ...PAGES_SEGMENTOS,
];
