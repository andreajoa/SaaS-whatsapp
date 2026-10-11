/**
 * O conteúdo do mega menu — dados puros, montados no servidor com o idioma da
 * página e entregues ao componente de cliente. Ícone vai como CHAVE (string):
 * componente React não atravessa a fronteira servidor → cliente.
 */
export type IconeDoMenu =
  | "equipe"
  | "ia"
  | "robo"
  | "funil"
  | "campanha"
  | "followup"
  | "agenda"
  | "relatorio"
  | "api"
  | "lgpd"
  | "video"
  | "guia"
  | "perguntas"
  | "contato"
  | "regiao";

export type ItemDoMenu = {
  readonly href: string;
  readonly titulo: string;
  readonly descricao: string;
  readonly icone?: IconeDoMenu;
  readonly imagem?: string;
};

export type DestaqueDoMenu = {
  readonly href: string;
  readonly imagem: string;
  readonly titulo: string;
  readonly texto: string;
  readonly acao: string;
};

export type GrupoDoMenu = {
  readonly id: "funcionalidades" | "segmentos" | "recursos";
  readonly rotulo: string;
  readonly estilo: "lista" | "cartoes";
  readonly itens: readonly ItemDoMenu[];
  readonly destaque: DestaqueDoMenu;
};

export type MenuDoSite = {
  readonly grupos: readonly GrupoDoMenu[];
  readonly links: readonly { href: string; rotulo: string }[];
  readonly entrar: string;
  readonly criarConta: string;
  readonly abrir: string;
  readonly fechar: string;
  readonly navegacao: string;
};

export function montarMenu(t: (texto: string) => string, comPlanos: boolean): MenuDoSite {
  return {
    grupos: [
      {
        id: "funcionalidades",
        rotulo: t("Funcionalidades"),
        estilo: "lista",
        itens: [
          {
            href: "/atendimento-whatsapp",
            icone: "equipe",
            titulo: t("Multiatendimento"),
            descricao: t("Vários atendentes no mesmo número."),
          },
          {
            href: "/agentes-ia-whatsapp",
            icone: "ia",
            titulo: t("Agentes de IA"),
            descricao: t("Respondem com as informações do seu negócio."),
          },
          {
            href: "/chatbot-para-whatsapp",
            icone: "robo",
            titulo: t("Chatbot para WhatsApp"),
            descricao: t("Respostas automáticas 24 horas."),
          },
          {
            href: "/crm-whatsapp",
            icone: "funil",
            titulo: t("CRM e funil de vendas"),
            descricao: t("Cada negociação no seu lugar."),
          },
          {
            href: "/recursos/campanhas-whatsapp",
            icone: "campanha",
            titulo: t("Campanhas"),
            descricao: t("Avisos e promoções para listas segmentadas."),
          },
          {
            href: "/recursos/follow-up-automatico",
            icone: "followup",
            titulo: t("Follow-up automático"),
            descricao: t("Volta a falar com quem parou."),
          },
          {
            href: "/recursos/agenda-whatsapp",
            icone: "agenda",
            titulo: t("Agenda"),
            descricao: t("Agendamento com Google Agenda e Meet."),
          },
          {
            href: "/recursos/relatorios-atendimento",
            icone: "relatorio",
            titulo: t("Relatórios e SLA"),
            descricao: t("Tempo de resposta e satisfação."),
          },
          {
            href: "/recursos/api-whatsapp",
            icone: "api",
            titulo: t("API, webhooks e MCP"),
            descricao: t("Conecte qualquer sistema."),
          },
          {
            href: "/recursos/lgpd-whatsapp",
            icone: "lgpd",
            titulo: "LGPD",
            descricao: t("Direitos do titular dentro do sistema."),
          },
        ],
        destaque: {
          href: "/demonstracao",
          imagem: "/media/atenza/explainer-thumbnail.webp",
          titulo: t("Veja em 48 segundos"),
          texto: t("Conversas, agentes de IA e funil de vendas na prática."),
          acao: t("Assistir à demonstração"),
        },
      },
      {
        id: "segmentos",
        rotulo: t("Segmentos"),
        estilo: "cartoes",
        itens: [
          {
            href: "/segmentos/clinicas",
            imagem: "/media/atenza/segmento-clinica.webp",
            titulo: t("Clínicas e consultórios"),
            descricao: t("Agenda, lembretes e recepção organizada."),
          },
          {
            href: "/segmentos/e-commerce",
            imagem: "/media/atenza/segmento-comercio.webp",
            titulo: t("E-commerce e lojas"),
            descricao: t("Pedidos e catálogo dentro da conversa."),
          },
          {
            href: "/segmentos/escolas",
            imagem: "/media/atenza/segmento-educacao.webp",
            titulo: t("Escolas e cursos"),
            descricao: t("Do interessado à matrícula."),
          },
          {
            href: "/segmentos/imobiliarias",
            imagem: "/media/atenza/segmento-servicos.webp",
            titulo: t("Imobiliárias"),
            descricao: t("Contatos distribuídos entre corretores."),
          },
          {
            href: "/segmentos/advogados",
            imagem: "/media/atenza/hero-office.webp",
            titulo: t("Advocacia"),
            descricao: t("Triagem e histórico com sigilo."),
          },
          {
            href: "/segmentos/restaurantes",
            imagem: "/media/atenza/segmento-comercio.webp",
            titulo: t("Restaurantes e delivery"),
            descricao: t("Cardápio e reservas no pico."),
          },
          {
            href: "/segmentos/agencias",
            imagem: "/media/atenza/hero-office.webp",
            titulo: t("Agências"),
            descricao: t("Uma conta por cliente, com a sua marca."),
          },
          {
            href: "/segmentos/servicos",
            imagem: "/media/atenza/segmento-servicos.webp",
            titulo: t("Prestadores de serviço"),
            descricao: t("Orçamentos com retorno."),
          },
        ],
        destaque: {
          href: "/signup",
          imagem: "/media/atenza/atendimento.webp",
          titulo: t("Teste 7 dias sem cobrança"),
          texto: t("Crie a conta pelo site e conecte o WhatsApp da empresa."),
          acao: t("Criar conta"),
        },
      },
      {
        id: "recursos",
        rotulo: t("Recursos"),
        estilo: "lista",
        itens: [
          {
            href: "/demonstracao",
            icone: "video",
            titulo: t("Demonstração em vídeo"),
            descricao: t("O produto funcionando, com legendas."),
          },
          {
            href: "/guias/como-escolher-atendimento-whatsapp",
            icone: "guia",
            titulo: t("Guia de escolha"),
            descricao: t("Como comparar plataformas de atendimento."),
          },
          {
            href: "/atendimento-whatsapp-sao-paulo",
            icone: "regiao",
            titulo: t("São Paulo e Grande SP"),
            descricao: t("Exemplos de uso na região."),
          },
          {
            href: "/#perguntas",
            icone: "perguntas",
            titulo: t("Perguntas frequentes"),
            descricao: t("Respostas rápidas sobre planos e uso."),
          },
          {
            href: "/contato",
            icone: "contato",
            titulo: t("Fale com a gente"),
            descricao: t("Dúvidas antes de assinar."),
          },
        ],
        destaque: {
          href: "/recursos/integracoes",
          imagem: "/media/atenza/segmento-comercio.webp",
          titulo: t("Integrações"),
          texto: t("Shopify, WooCommerce, Nuvemshop, API e webhooks."),
          acao: t("Ver integrações"),
        },
      },
    ],
    links: [
      { href: "/recursos/integracoes", rotulo: t("Integrações") },
      ...(comPlanos ? [{ href: "/#planos", rotulo: t("Planos") }] : []),
    ],
    entrar: t("Entrar"),
    criarConta: t("Criar conta"),
    abrir: t("Abrir navegação"),
    fechar: t("Fechar"),
    navegacao: t("Navegação principal"),
  };
}
