import { RodapeDoSite } from "@/components/site/RodapeDoSite";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowRight,
  Bot,
  CalendarDays,
  Check,
  History,
  LockKeyhole,
  MessagesSquare,
  Play,
  QrCode,
  ShieldCheck,
  SquareKanban,
  Users,
} from "lucide-react";

import { LogotipoDoProduto, SimboloDaMarca } from "@/components/branding/MarcaDoProduto";
import { CapturaDeLead } from "@/components/site/CapturaDeLead";
import { ConviteDeLead } from "@/components/site/ConviteDeLead";
import {
  HeroCelularAtenza,
  type TextosHeroCelular,
} from "@/components/site/HeroCelularAtenza";
import { IntegracoesDaHome } from "@/components/site/IntegracoesDaHome";
import { Medidor } from "@/components/site/Medidor";
import { MegaMenu } from "@/components/site/MegaMenu";
import { PaisesDisponiveis } from "@/components/site/PaisesDisponiveis";
import {
  ProdutoDemonstracao,
  type CenarioDaDemonstracao,
  type TextosDoProduto,
} from "@/components/site/ProdutoDemonstracao";
import {
  PublicosInterativosAtenza,
  type TextosPublicos,
} from "@/components/site/PublicosInterativosAtenza";
import {
  RecursosInterativosAtenza,
  type TextosRecursosInterativos,
} from "@/components/site/RecursosInterativosAtenza";
import {
  VideoDeContexto,
  VideoExplicativo,
  type TextosDoVideo,
} from "@/components/site/VideosDaHome";
import styles from "@/components/site/atenza-home.module.css";
import { marcaEhADoProduto } from "@/lib/branding";
import { SIMBOLO_ATENZA, simboloDaMarca } from "@/lib/branding/desenho";
import { marcaDaSaida, type MarcaDeSaida } from "@/lib/branding/saida";
import {
  DIAS_DE_TRIAL,
  ORDEM_DOS_PLANOS,
  PLANOS,
  instalacaoCobra,
  precoDoPlano,
  type PlanoId,
} from "@/lib/billing/planos";
import { ID_DA_SECAO_DE_PLANOS } from "@/lib/marketing/caminhos";
import { montarMenu } from "@/lib/marketing/menu";
import {
  identidadePublica,
  jsonLdSeguro,
  metadadosDaHome,
  LINKS_SEO,
  SELETOR_DE_IDIOMA,
} from "@/lib/marketing/seo";
import { env } from "@/lib/env";
import { schemaDoSoftware } from "@/lib/marketing/schema-do-produto";
import { precoLegivelNoMercado, type IdiomaDoSite } from "@/lib/mercado/paises";
import { textoDoSite } from "@/lib/mercado/textos";
import { ehBotDeBusca, visitanteAtual } from "@/lib/mercado/visitante";
import { transcricaoDoVideo, videoDaApresentacao } from "@/lib/marketing/video";
import { createClient, SESSION_COOKIE_NAME } from "@/lib/supabase/server";

// O mesmo interruptor da cobrança preserva o clone self-host sem vitrine de assinatura.
export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: { params?: Promise<{ idioma?: string }> } = {}): Promise<Metadata> {
  const marca = await marcaDaSaida(null);
  const escolhido = (await params)?.idioma;
  const idioma = escolhido === "en" || escolhido === "es" ? escolhido : "pt-BR";
  return metadadosDaHome(marca.nome, env.NEXT_PUBLIC_APP_URL, idioma);
}

export default async function HomePage({ params }: { params?: Promise<{ idioma?: string }> } = {}) {
  if (!instalacaoCobra()) redirect("/app");
  const cookieStore = await import("next/headers").then((mod) => mod.cookies());
  const temCookieDeSessao = cookieStore
    .getAll()
    .some((c) => c.name === SESSION_COOKIE_NAME || c.name.startsWith(`${SESSION_COOKIE_NAME}.`));
  if (temCookieDeSessao) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) redirect("/app");
  }

  const [origem, marca] = await Promise.all([visitanteAtual(), marcaDaSaida(null)]);
  const escolhido = (await params)?.idioma;
  if (!escolhido) {
    const h = await import("next/headers").then((mod) => mod.headers());
    if (!ehBotDeBusca(h.get("user-agent"))) {
      if (origem.pais === "GB") redirect("/en-gb");
      if (origem.pais === "US") redirect("/en-us");
      if (!origem.pais && origem.idioma === "en") {
        redirect(h.get("accept-language")?.toLowerCase().startsWith("en-gb") ? "/en-gb" : "/en-us");
      }
    }
  }

  const idioma: IdiomaDoSite = escolhido === "en" || escolhido === "es" ? escolhido : "pt-BR";
  const visitante = { ...origem, idioma };
  const { mercado } = visitante;
  const t = (texto: string) => textoDoSite(texto, visitante.idioma);
  const apresentacao = videoDaApresentacao(idioma, visitante.pais);
  const vendidos: PlanoId[] = ORDEM_DOS_PLANOS.filter((p) => precoDoPlano(p) !== null);
  const menu = montarMenu(t, vendidos.length > 0);
  const textosDaCaptura = {
    rotulo: t("Seu e-mail"),
    exemplo: t("seu@email.com"),
    enviar: t("Quero receber"),
    enviando: t("Enviando..."),
    promessa: t("Sem spam. Um clique para sair, em qualquer e-mail."),
    sucesso: t("Pronto. Se houver novidade que valha o seu tempo, ela chega por e-mail."),
    erro: t("Não foi possível inscrever agora. Tente de novo em instantes."),
    consentimento: t(
      "Quero receber dicas, novidades e campanhas sazonais por e-mail, no máximo uma mensagem comercial por dia. Posso cancelar a qualquer momento.",
    ),
  };

  const produto: TextosDoProduto = {
    demonstracao: t("Demonstração"),
    titulo: t("Explore o produto"),
    conversas: t("Conversas"),
    agentes: t("Agentes de IA"),
    funil: t("Funil de vendas"),
    fila: t("Fila"),
    minhas: t("Minhas"),
    todas: t("Todas"),
    contato: t("Dados do contato"),
    historico: t("Histórico compartilhado"),
    equipe: t("Sua equipe"),
    escrever: t("Escreva uma mensagem..."),
    nota: t("Demonstração interativa com dados fictícios. Nenhuma mensagem é enviada."),
    atribuida: t("Conversa atribuída à equipe"),
    conhecimento: t("O conhecimento é da sua empresa."),
    documentos: t("Organize os materiais que orientam o agente."),
    limites: t("Limites definidos por você"),
    limiteTexto: t("Configure instruções, base de conhecimento e quando pedir ajuda ao time."),
    transferencia: t("Uma pessoa assume com contexto"),
    transferenciaTexto: t("O histórico acompanha a conversa quando ela passa da IA para a equipe."),
    oportunidade: t("A conversa tem um próximo passo."),
    etapa1: t("Novo contato"),
    etapa2: t("Em atendimento"),
    etapa3: t("Proposta"),
    etapa4: t("Concluído"),
    proximo: t("Próximo passo"),
    mover: t("Mover para"),
    demonstracaoTexto: t("Experimente mudar a etapa deste contato no exemplo acima."),
  };

  const cenarioLoja: CenarioDaDemonstracao = {
    nome: "Mariana",
    perfil: t("Cliente da loja"),
    pergunta: t("Oi! Vocês têm este modelo em estoque?"),
    resposta: t("Oi, Mariana! Temos sim. Posso te ajudar a escolher o tamanho?"),
    segunda: t("Pode sim! Estou procurando o tamanho 38."),
    proximoTexto: t("Confirmar o tamanho e acompanhar a decisão."),
    documentos: [t("Produtos e serviços"), t("Prazos e entregas"), t("Trocas e devoluções")],
    outros: [
      { nome: "Pedro", ultima: t("Qual o prazo de entrega para Campinas?") },
      { nome: "Camila", ultima: t("Vocês aceitam Pix?") },
      { nome: "Lucas", ultima: t("Quero trocar o tamanho do pedido.") },
    ],
  };
  const cenarioClinica: CenarioDaDemonstracao = {
    nome: "Ricardo",
    perfil: t("Paciente da clínica"),
    pergunta: t("Boa tarde! Queria marcar uma limpeza. Tem horário esta semana?"),
    resposta: t("Boa tarde, Ricardo! Temos quinta às 15h ou sexta às 10h. Qual fica melhor?"),
    segunda: t("Quinta às 15h, por favor."),
    proximoTexto: t("Confirmar a consulta e enviar o lembrete na véspera."),
    documentos: [t("Tratamentos e valores"), t("Convênios aceitos"), t("Preparo e horários")],
    outros: [
      { nome: "Juliana", ultima: t("Vocês atendem convênio?") },
      { nome: "Fernanda", ultima: t("Preciso remarcar minha consulta.") },
      { nome: "Bruno", ultima: t("Qual o endereço da clínica?") },
    ],
  };

  const textosHeroCelular: TextosHeroCelular = {
    ariaCelular: t("Prévia ilustrativa com dados fictícios"),
    ariaPontos: t("Explore o produto"),
    entradaPlaceholder: t("Escreva uma mensagem..."),
    agora: t("Agora"),
    seloAoVivoTitulo: t("IA no WhatsApp 24h"),
    seloAoVivoSubtitulo: t("Resposta imediata"),
    previewUmRotulo: t("Funil de vendas"),
    previewUmTitulo: t("O próximo passo fica à vista"),
    previewDoisRotulo: t("Agentes de IA"),
    previewDoisTitulo: t("O conhecimento é da sua empresa."),
    slides: [
      {
        titulo: t("Comércio e e-commerce"),
        contato: "Mariana",
        status: t("Cliente da loja"),
        bolhas: [
          { role: "in", text: cenarioLoja.pergunta },
          { role: "out", text: cenarioLoja.resposta },
          { role: "in", text: cenarioLoja.segunda },
          {
            role: "out",
            text: cenarioLoja.proximoTexto,
            link: t("Produtos e serviços"),
          },
        ],
      },
      {
        titulo: t("Clínicas e saúde"),
        contato: "Ricardo",
        status: t("Paciente da clínica"),
        bolhas: [
          { role: "in", text: cenarioClinica.pergunta },
          { role: "out", text: cenarioClinica.resposta },
          { role: "in", text: cenarioClinica.segunda },
          {
            role: "out",
            text: cenarioClinica.proximoTexto,
            link: t("Agendamento com Google Agenda e Meet."),
          },
        ],
      },
      {
        titulo: t("Serviços e B2B"),
        contato: "Camila",
        status: t("Conversa atribuída à equipe"),
        bolhas: [
          { role: "in", text: t("Vocês aceitam Pix?") },
          { role: "out", text: t("O histórico acompanha a conversa quando ela passa da IA para a equipe.") },
          { role: "in", text: t("Qual o prazo de entrega para Campinas?") },
          {
            role: "out",
            text: t("Qualifique os contatos e mantenha o próximo passo visível para o time."),
            link: t("CRM e funil de vendas"),
          },
        ],
      },
    ],
  };

  const textosRecursosInterativos: TextosRecursosInterativos = {
    titulo: t("Principais recursos no WhatsApp"),
    subtitulo: t("Da primeira mensagem ao próximo passo da venda."),
    ariaLista: t("Funcionalidades"),
    ariaCelular: t("Prévia ilustrativa com dados fictícios"),
    cabecalhoCelular: t("Demonstração"),
    ctaRotulo: t("Conhecer os planos"),
    ctaHref: vendidos.length ? "/precos" : "#como-funciona",
    itens: [
      {
        rotulo: t("Agentes de IA"),
        titulo: t("O conhecimento é da sua empresa."),
        descricao: t("Configure instruções, base de conhecimento e quando pedir ajuda ao time."),
        mensagens: [
          cenarioLoja.pergunta,
          cenarioLoja.resposta,
          cenarioLoja.segunda,
          cenarioLoja.proximoTexto,
        ],
      },
      {
        rotulo: t("Multiatendimento"),
        titulo: t("Um histórico para o time inteiro"),
        descricao: t("O histórico acompanha a conversa quando ela passa da IA para a equipe."),
        mensagens: [
          t("Quero trocar o tamanho do pedido."),
          t("Uma pessoa assume com contexto"),
          t("Qual o prazo de entrega para Campinas?"),
          t("Todos acompanham o que já foi conversado."),
        ],
      },
      {
        rotulo: t("CRM e funil de vendas"),
        titulo: t("A conversa tem um próximo passo."),
        descricao: t("Organize os contatos e acompanhe as oportunidades."),
        mensagens: [
          t("Vocês aceitam Pix?"),
          t("Em atendimento"),
          t("Proposta"),
          t("Concluído"),
        ],
      },
      {
        rotulo: t("Agenda"),
        titulo: t("Agendamento com Google Agenda e Meet."),
        descricao: t("Organize o primeiro contato e encaminhe dúvidas para a equipe responsável."),
        mensagens: [
          cenarioClinica.pergunta,
          cenarioClinica.resposta,
          cenarioClinica.segunda,
          cenarioClinica.proximoTexto,
        ],
      },
      {
        rotulo: t("Follow-up automático"),
        titulo: t("A dúvida chega. A conversa continua."),
        descricao: t("Qualifique os contatos e mantenha o próximo passo visível para o time."),
        mensagens: [
          t("Vocês atendem convênio?"),
          t("Convênios aceitos"),
          t("Preciso remarcar minha consulta."),
          t("Confirmar a consulta e enviar o lembrete na véspera."),
        ],
      },
      {
        rotulo: t("API, webhooks e MCP"),
        titulo: t("Conecte qualquer sistema."),
        descricao: t("Lojas, APIs e webhooks para trazer mais contexto ao atendimento."),
        mensagens: [
          t("Produtos e serviços"),
          t("Prazos e entregas"),
          t("Trocas e devoluções"),
          t("O contexto acompanha cada proposta."),
        ],
      },
    ],
  };

  const video: TextosDoVideo = {
    titulo: t("Veja como funciona"),
    descricao: t(
      "Um passeio pelo atendimento, pela IA e pelo funil. Vídeo com áudio e legendas em português.",
    ),
    fechar: t("Fechar vídeo"),
    legendas: t("Português"),
    transcricao: t("Ler a explicação"),
    indisponivel: t("O vídeo não carregou. Você pode ler a explicação abaixo."),
    paragrafo1: t(
      "Onze e quarenta e sete da noite. Um cliente pergunta o preço. Quem responde? Com a Atenza, o seu WhatsApp atende e vende vinte e quatro horas por dia.",
    ),
    paragrafo2: t(
      "O agente de inteligência artificial responde na hora, com as informações do seu negócio: preço, estoque, horário, entrega. Quando a conversa pede uma pessoa, ela passa para a sua equipe, com todo o histórico. Ninguém pergunta tudo de novo.",
    ),
    paragrafo3: t(
      "Cada conversa vira uma oportunidade no funil. E o follow-up automático volta a falar com quem parou de responder. Precisa marcar horário? A Atenza agenda pela própria conversa, direto na sua agenda do Google.",
    ),
    paragrafo4: t(
      "Vários atendentes no mesmo número, a API oficial do WhatsApp e os seus dados protegidos pela LGPD. Atenza: WhatsApp que atende e vende 24h. Teste sete dias sem cobrança.",
    ),
  };
  const transcricaoLocal = transcricaoDoVideo(apresentacao);
  if (transcricaoLocal) {
    video.descricao = t("Um passeio pelo atendimento, pela IA e pelo funil, em menos de 1 minuto.");
    [video.paragrafo1, video.paragrafo2, video.paragrafo3, video.paragrafo4] = transcricaoLocal;
  }

  const trial = `${DIAS_DE_TRIAL} ${t("dias sem cobrança")}`;
  const condicoes = t(
    "Cartão necessário. Renovação automática após a avaliação. Cancele quando quiser.",
  );

  const textosPublicos: TextosPublicos = {
    eyebrow: t("Para quem é a plataforma"),
    titulo: t("No ritmo do seu negócio."),
    subtitulo: t("Veja onde a plataforma entra na sua rotina."),
    ariaAbas: t("Segmentos"),
    respostaAutomatica: t("Resposta imediata"),
    proximoPasso: t("Próximo passo"),
    comoUsar: t("Explore o produto"),
    nota: t(
      "Exemplos de uso. A configuração deve respeitar os processos e as responsabilidades da sua empresa.",
    ),
    estatisticas: [
      { valor: "24/7", rotulo: t("Agentes de IA") },
      { valor: "1", rotulo: t("WhatsApp oficial") },
      { valor: `${DIAS_DE_TRIAL}d`, rotulo: t("dias sem cobrança") },
    ],
    itens: [
      {
        arquivo: "segmento-comercio.webp",
        alt: t("Empreendedora organizando pedidos de uma loja"),
        nome: t("Comércio e e-commerce"),
        resumo: t("Produtos e serviços"),
        titulo: t("A dúvida chega. A conversa continua."),
        texto: t("Reúna perguntas sobre produtos, pedidos e entregas com o contexto da sua loja."),
        gatilho: t("Vocês aceitam Pix?"),
        passo1: t("Cliente da loja"),
        resposta: t("Oi, Mariana! Temos sim. Posso te ajudar a escolher o tamanho?"),
        passo3: t("Confirmar o tamanho e acompanhar a decisão."),
        categorias: `${t("Produtos e serviços")} · ${t("Prazos e entregas")} · ${t("Trocas e devoluções")}`,
        beneficios: [
          { titulo: t("Agentes de IA"), texto: t("O conhecimento é da sua empresa.") },
          { titulo: t("Multiatendimento"), texto: t("Um histórico para o time inteiro") },
          { titulo: t("Funil de vendas"), texto: t("O próximo passo fica à vista") },
          { titulo: t("API, webhooks e MCP"), texto: t("Conecte qualquer sistema.") },
        ],
      },
      {
        arquivo: "segmento-clinica.webp",
        alt: t("Profissional de recepção em uma clínica"),
        nome: t("Clínicas e saúde"),
        resumo: t("Agenda"),
        titulo: t("Mais atenção a quem precisa agendar."),
        texto: t("Organize o primeiro contato e encaminhe dúvidas para a equipe responsável."),
        gatilho: t("Vocês atendem convênio?"),
        passo1: t("Paciente da clínica"),
        resposta: t("Boa tarde, Ricardo! Temos quinta às 15h ou sexta às 10h. Qual fica melhor?"),
        passo3: t("Confirmar a consulta e enviar o lembrete na véspera."),
        categorias: `${t("Tratamentos e valores")} · ${t("Convênios aceitos")} · ${t("Preparo e horários")}`,
        beneficios: [
          { titulo: t("Agenda"), texto: t("Agendamento com Google Agenda e Meet.") },
          { titulo: t("Limites definidos por você"), texto: t("Uma pessoa assume com contexto") },
          { titulo: t("Follow-up automático"), texto: t("A conversa tem um próximo passo.") },
          { titulo: t("Histórico compartilhado"), texto: t("Todos acompanham o que já foi conversado.") },
        ],
      },
      {
        arquivo: "segmento-educacao.webp",
        alt: t("Profissional de educação acompanhando informações no computador"),
        nome: t("Educação"),
        resumo: t("Do interessado à matrícula."),
        titulo: t("Do interesse à próxima conversa."),
        texto: t("Centralize dúvidas sobre cursos e acompanhe os interessados pelo funil."),
        gatilho: t("Qual o endereço da clínica?"),
        passo1: t("Novo contato"),
        resposta: t("Configure instruções, base de conhecimento e quando pedir ajuda ao time."),
        passo3: t("Organize os contatos e acompanhe as oportunidades."),
        categorias: `${t("Conversas")} · ${t("Agentes de IA")} · ${t("Funil de vendas")}`,
        beneficios: [
          { titulo: t("Campanhas"), texto: t("Avisos e promoções para listas segmentadas.") },
          { titulo: t("CRM e funil de vendas"), texto: t("Cada negociação no seu lugar.") },
          { titulo: t("Acesso por pessoa"), texto: t("O time assume quando o atendimento pede.") },
          { titulo: t("Dados protegidos"), texto: t("Direitos do titular dentro do sistema.") },
        ],
      },
      {
        arquivo: "segmento-servicos.webp",
        alt: t("Profissional de serviços conversando com um cliente"),
        nome: t("Serviços e B2B"),
        resumo: t("CRM e funil de vendas"),
        titulo: t("O contexto acompanha cada proposta."),
        texto: t("Qualifique os contatos e mantenha o próximo passo visível para o time."),
        gatilho: t("Qual o prazo de entrega para Campinas?"),
        passo1: t("Em atendimento"),
        resposta: t("O histórico acompanha a conversa quando ela passa da IA para a equipe."),
        passo3: t("Cada negociação no seu lugar."),
        categorias: `${t("Multiatendimento")} · ${t("CRM e funil de vendas")} · ${t("Follow-up automático")}`,
        beneficios: [
          { titulo: t("IA e pessoas, na mesma conversa"), texto: t("Uma pessoa assume com contexto") },
          { titulo: t("Funil de vendas"), texto: t("O próximo passo fica à vista") },
          { titulo: t("API, webhooks e MCP"), texto: t("Conecte qualquer sistema.") },
          { titulo: t("Acesso por pessoa"), texto: t("Cada integrante entra com o próprio acesso e as permissões definidas pela empresa.") },
        ],
      },
    ],
  };

  const proofItens = [
    {
      foto: "/media/atenza/segmento-comercio.webp",
      tag: t("Comércio e e-commerce"),
      canal: "WHATSAPP",
      quote: cenarioLoja.pergunta,
      nota: t("Agentes de IA"),
    },
    {
      foto: "/media/atenza/segmento-clinica.webp",
      tag: t("Clínicas e saúde"),
      canal: t("Agenda"),
      quote: cenarioClinica.pergunta,
      nota: t("Agendamento com Google Agenda e Meet."),
    },
    {
      foto: "/media/atenza/segmento-educacao.webp",
      tag: t("Educação"),
      canal: "CRM",
      quote: t("Do interesse à próxima conversa."),
      nota: t("Funil de vendas"),
    },
    {
      foto: "/media/atenza/segmento-servicos.webp",
      tag: t("Serviços e B2B"),
      canal: t("Multiatendimento"),
      quote: t("O contexto acompanha cada proposta."),
      nota: t("Um histórico para o time inteiro"),
    },
  ];

  return (
    <div className={styles.home} id="topo">
      <Medidor
        idioma={visitante.idioma}
        moeda={mercado.moeda}
        dispositivo={visitante.dispositivo}
      />
      <ConviteDeLead
        textos={{
          titulo: t("Antes de ir: quer ver como isto funciona na prática?"),
          corpo: t(
            "Deixe seu e-mail e receba, em poucas mensagens, o que um atendimento automático de verdade responde — e o que ele nunca deve responder sozinho.",
          ),
          fechar: t("Fechar"),
        }}
        captura={textosDaCaptura}
        idioma={visitante.idioma}
        moeda={mercado.moeda}
      />
      <a className={styles.skipLink} href="#conteudo">
        {t("Ir para o conteúdo")}
      </a>

      {/* Floating Pill Navbar (FlowNexa layout in Atenza palette) */}
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <Link href="/" aria-label={marca.nome} className={styles.brandLink}>
            <Marca marca={marca} />
          </Link>
          <MegaMenu menu={menu} />
          <div className={styles.headerActions}>
            <Link href="/login" className={styles.login}>
              {t("Entrar")}
            </Link>
            <Link href="/signup" data-medir="cta-menu" className={styles.buttonSmall}>
              {t("Criar conta")}
              <ArrowRight size={16} aria-hidden />
            </Link>
          </div>
        </div>
      </header>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLdSeguro({
            "@context": "https://schema.org",
            "@graph": [
              ...identidadePublica(marca.nome, env.NEXT_PUBLIC_APP_URL, marca.logoUrl),
              schemaDoSoftware(marca.nome, env.NEXT_PUBLIC_APP_URL),
            ],
          }),
        }}
      />

      <main id="conteudo">
        {/* 1. FlowNexa 2-Column Hero with Animated iPhone */}
        <div className={styles.heroShell}>
          <section className={styles.hero}>
            <div className={styles.heroContent}>
              <div className={styles.heroMicro}>
                <span aria-hidden>✦</span> {t("WhatsApp oficial")}{" "}
                <small>{t("Agentes de IA")}</small>
              </div>
              <h1>
                <span className={styles.heroHighlight}>{t("Seu atendimento cresce.")}</span>
                <br />
                {t("Seu cliente não espera.")}
              </h1>
              <p>{t("WhatsApp, agentes de IA e funil de vendas na mesma plataforma.")}</p>
              <div className={styles.heroActions}>
                <Link href="/signup" data-medir="cta-hero" className={styles.button}>
                  {`${t("Começar com")} ${trial}`}
                  <ArrowRight size={17} aria-hidden />
                </Link>
                <a href="#video-explicativo" className={styles.buttonOutline}>
                  <Play size={16} aria-hidden />
                  {t("Ver em ação")}
                </a>
                <a
                  href={vendidos.length ? "/precos" : "#como-funciona"}
                  className={styles.buttonOutline}
                >
                  {vendidos.length ? t("Conhecer os planos") : t("Como funciona")}
                </a>
              </div>
              <span className={styles.heroDemoNote}>
                {t("Prévia ilustrativa com dados fictícios")}
              </span>
            </div>

            <HeroCelularAtenza textos={textosHeroCelular} />
          </section>
        </div>

        {/* 2. FlowNexa Proof Strip Continuous Ticker */}
        <section className={styles.proofStrip} aria-label={t("No ritmo do seu negócio.")}>
          <div className={styles.proofLead}>
            {t("WhatsApp, IA e CRM para negócios reais")}
          </div>
          <div className={styles.proofWindow}>
            <div className={styles.proofTrack}>
              {[0, 1].map((dup) => (
                <div className={styles.proofGroup} key={dup} aria-hidden={dup === 1}>
                  {proofItens.map((item) => (
                    <article className={styles.proofItem} key={`${dup}-${item.tag}`}>
                      <Image
                        className={styles.proofPhoto}
                        src={item.foto}
                        alt={dup === 0 ? item.tag : ""}
                        width={58}
                        height={58}
                      />
                      <div className={styles.proofInfo}>
                        <div className={styles.proofMeta}>
                          <strong>{item.tag}</strong>
                          <span>{item.canal}</span>
                        </div>
                        <div className={styles.proofQuote}>{item.quote}</div>
                        <div className={styles.proofNote}>{item.nota} →</div>
                      </div>
                    </article>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 3. FlowNexa Conversion Section + 3-Device Workflow Stage */}
        <section className={styles.conversionSection} aria-labelledby="conversion-title">
          <span className={`${styles.conversionShape} ${styles.conversionShapeLeft}`} aria-hidden />
          <span className={`${styles.conversionShape} ${styles.conversionShapeRight}`} aria-hidden />
          <div className={styles.conversionInner}>
            <div className={styles.conversionPill}>
              <span className={styles.conversionShield} aria-hidden>
                ✦
              </span>
              <strong>{t("WhatsApp oficial")}</strong>
              <span>{t("Conexão pela API oficial do WhatsApp, da Meta.")}</span>
            </div>
            <h2 id="conversion-title">
              {t("Veja o atendimento acontecer.")}
              <span>{t("Da primeira mensagem ao próximo passo da venda.")}</span>
            </h2>
            <p className={styles.conversionDescription}>
              {t(
                "A IA ajuda no repetitivo. Sua equipe entra com atenção, contexto e autonomia quando o cliente precisa.",
              )}
            </p>
            <div className={styles.conversionActions}>
              <Link href="/signup" className={styles.button}>
                {t("Criar conta")}
                <ArrowRight size={17} aria-hidden />
              </Link>
              <a href="#como-funciona" className={styles.buttonOutline}>
                {t("Explore o produto")}
              </a>
            </div>
            <div className={styles.conversionAssurances}>
              <span>
                <Check size={17} aria-hidden />
                {t("Seu número de WhatsApp continua o mesmo")}
              </span>
              <span>
                <Check size={17} aria-hidden />
                {trial}
              </span>
              <span>
                <Check size={17} aria-hidden />
                {t("O controle continua com você")}
              </span>
            </div>
          </div>
        </section>

        {/* 4. Three-Device Workflow Showcase + Dark Integration Band */}
        <section
          className={styles.workflowShowcase}
          aria-label={t("Veja o atendimento acontecer.")}
        >
          <div className={styles.workflowStage}>
            <div className={styles.workflowArc} aria-hidden />
            <div className={styles.workflowDevices}>
              <div className={`${styles.workflowDevice} ${styles.workflowDeviceLeft}`}>
                <div className={styles.workflowUser}>
                  <span className={styles.workflowUserIcon}>M</span>
                  <span>
                    <b>Mariana</b>
                    <small>{t("Cliente da loja")}</small>
                  </span>
                </div>
                <div className={styles.workflowChat}>
                  <div className={styles.workflowLine}>{cenarioLoja.pergunta}</div>
                  <div className={`${styles.workflowLine} ${styles.workflowAnswer}`}>
                    <span className={styles.workflowKeyword}>{t("Agentes de IA")}:</span>{" "}
                    {cenarioLoja.resposta}
                  </div>
                </div>
              </div>

              <div className={`${styles.workflowDevice} ${styles.workflowDeviceCenter}`}>
                <div className={styles.workflowUser}>
                  <span className={styles.workflowUserIcon}>R</span>
                  <span>
                    <b>Ricardo</b>
                    <small>{t("Paciente da clínica")}</small>
                  </span>
                </div>
                <div className={styles.workflowChat}>
                  <div className={`${styles.workflowLine} ${styles.workflowAnswer}`}>
                    {cenarioClinica.resposta}
                  </div>
                  <div className={styles.workflowProduct}>
                    <div className={styles.workflowPromo}>
                      24/7 <small>{t("WhatsApp oficial")}</small>
                    </div>
                    <p>{cenarioClinica.proximoTexto}</p>
                    <span className={styles.workflowProductTag}>{t("Agenda")} →</span>
                  </div>
                </div>
              </div>

              <div className={`${styles.workflowDevice} ${styles.workflowDeviceRight}`}>
                <div className={styles.workflowUser}>
                  <span className={styles.workflowUserIcon}>✓</span>
                  <span>
                    <b>{t("Sua equipe")}</b>
                    <small>{t("Funil de vendas")}</small>
                  </span>
                </div>
                <div className={styles.workflowFollowup}>
                  <div className={styles.workflowLine}>{t("Uma pessoa assume com contexto")}</div>
                  <div className={styles.workflowLine}>
                    {t("O próximo passo fica à vista")}
                  </div>
                  <div className={styles.workflowGreen}>{t("Concluído")} ✓</div>
                </div>
              </div>
            </div>

            <div className={`${styles.workflowFloat} ${styles.workflowFloatA}`}>
              <span className={styles.workflowFicon} aria-hidden>
                <MessagesSquare size={20} />
              </span>
              <span>
                <strong>{t("Multiatendimento")}</strong>
                <small>{t("Um histórico para o time inteiro")}</small>
              </span>
            </div>
            <div className={`${styles.workflowFloat} ${styles.workflowFloatB}`}>
              <span className={styles.workflowFicon} aria-hidden>
                <Bot size={20} />
              </span>
              <span>
                <strong>{t("Agentes de IA")}</strong>
                <small>{t("O conhecimento é da sua empresa.")}</small>
              </span>
            </div>
            <div className={`${styles.workflowFloat} ${styles.workflowFloatC}`}>
              <span className={styles.workflowFicon} aria-hidden>
                <CalendarDays size={20} />
              </span>
              <span>
                <strong>{t("Agenda")}</strong>
                <small>{t("Agendamento com Google Agenda e Meet.")}</small>
              </span>
            </div>
            <div className={`${styles.workflowFloat} ${styles.workflowFloatD}`}>
              <span className={styles.workflowFicon} aria-hidden>
                <SquareKanban size={20} />
              </span>
              <span>
                <strong>{t("Funil de vendas")}</strong>
                <small>{t("Cada negociação no seu lugar.")}</small>
              </span>
            </div>
          </div>

          <div className={styles.integrationBand}>
            <p>{t("Conecte o que sua operação já usa.")}</p>
            <div className={styles.integrationList}>
              <span>WhatsApp Cloud API</span>
              <span>Shopify</span>
              <span>WooCommerce</span>
              <span>Nuvemshop</span>
              <span>Google Calendar</span>
              <span>Webhooks</span>
              <span>API &amp; MCP</span>
            </div>
          </div>
        </section>

        {/* 5. FlowNexa Goldmine Headline + 3 Neo-Brutalist Evidence Cards */}
        <section className={styles.goldmineSection} aria-labelledby="goldmine-heading">
          <h2 id="goldmine-heading">
            <span className={styles.headlineLine}>
              {t("Seu WhatsApp")}{" "}
              <span className={`${styles.headlineLabel} ${styles.headlineLabelFirst}`}>
                {t("atende na hora.")}
              </span>
            </span>
            <span className={styles.headlineLine}>
              {t("Sua equipe")}{" "}
              <span className={`${styles.headlineLabel} ${styles.headlineLabelSecond}`}>
                {t("fecha com contexto.")}
              </span>
            </span>
          </h2>
          <p>{t("Organize o atendimento. Dê contexto à equipe. Acompanhe o próximo passo.")}</p>
        </section>

        <section className={styles.evidenceSection} aria-label={t("Explore o produto")}>
          <div className={styles.evidenceGrid}>
            <article className={`${styles.evidenceCard} ${styles.evidenceMint}`}>
              <div className={styles.evidenceNumber}>24h</div>
              <h3>{t("IA e pessoas, na mesma conversa")}</h3>
              <div className={`${styles.evidenceBox} ${styles.evidenceBoxData}`}>
                <strong>{t("O CONTEXTO")}</strong>
                <p>{t("O conhecimento é da sua empresa.")}</p>
              </div>
              <div className={`${styles.evidenceBox} ${styles.evidenceBoxProblem}`}>
                <strong>
                  <span className={styles.problemSymbol}>✕</span> {t("O PROBLEMA")}
                </strong>
                <p>{t("Sem resposta rápida, o interessado esfria e procura outro lugar.")}</p>
              </div>
              <div className={`${styles.evidenceBox} ${styles.evidenceBoxSolution}`}>
                <strong>
                  <span className={styles.solutionSymbol}>✓</span> {t("COM A PLATAFORMA")}
                </strong>
                <p>{t("Configure instruções, base de conhecimento e quando pedir ajuda ao time.")}</p>
              </div>
            </article>

            <article className={`${styles.evidenceCard} ${styles.evidenceGold}`}>
              <div className={styles.evidenceNumber}>1×</div>
              <h3>{t("Um histórico para o time inteiro")}</h3>
              <div className={`${styles.evidenceBox} ${styles.evidenceBoxData}`}>
                <strong>{t("O CONTEXTO")}</strong>
                <p>{t("Todos acompanham o que já foi conversado.")}</p>
              </div>
              <div className={`${styles.evidenceBox} ${styles.evidenceBoxProblem}`}>
                <strong>
                  <span className={styles.problemSymbol}>✕</span> {t("O PROBLEMA")}
                </strong>
                <p>{t("Um celular na mão de uma pessoa só trava o time inteiro.")}</p>
              </div>
              <div className={`${styles.evidenceBox} ${styles.evidenceBoxSolution}`}>
                <strong>
                  <span className={styles.solutionSymbol}>✓</span> {t("COM A PLATAFORMA")}
                </strong>
                <p>{t("O histórico acompanha a conversa quando ela passa da IA para a equipe.")}</p>
              </div>
            </article>

            <article className={`${styles.evidenceCard} ${styles.evidenceTeal}`}>
              <div className={styles.evidenceNumber}>100%</div>
              <h3>{t("O próximo passo fica à vista")}</h3>
              <div className={`${styles.evidenceBox} ${styles.evidenceBoxData}`}>
                <strong>{t("O CONTEXTO")}</strong>
                <p>{t("A conversa tem um próximo passo.")}</p>
              </div>
              <div className={`${styles.evidenceBox} ${styles.evidenceBoxProblem}`}>
                <strong>
                  <span className={styles.problemSymbol}>✕</span> {t("O PROBLEMA")}
                </strong>
                <p>{t("Conversas soltas viram propostas esquecidas no fim da semana.")}</p>
              </div>
              <div className={`${styles.evidenceBox} ${styles.evidenceBoxSolution}`}>
                <strong>
                  <span className={styles.solutionSymbol}>✓</span> {t("COM A PLATAFORMA")}
                </strong>
                <p>{t("Organize os contatos e acompanhe as oportunidades.")}</p>
              </div>
            </article>
          </div>
        </section>

        {/* 6. Editorial Proof Card — "O que é a Atenza?" (SEO / GEO / Human Clarity) */}
        <section className={styles.oQueE} aria-labelledby="o-que-e">
          <div className={styles.oQueECard}>
            <span className={styles.oQueEQuote} aria-hidden>
              “
            </span>
            <h2 id="o-que-e">
              {t("O que é a")} {marca.nome}?
            </h2>
            <p>
              {marca.nome}{" "}
              {t(
                "é uma plataforma brasileira de atendimento e vendas pelo WhatsApp que reúne, num único sistema, vários atendentes no mesmo número, agentes de inteligência artificial treinados com as informações do seu negócio, CRM com funil de vendas, follow-up automático, campanhas e agenda integrada ao Google.",
              )}
            </p>
            <p>
              {t(
                "A conexão é pela API oficial do WhatsApp, da Meta, com integrações para Shopify, WooCommerce e Nuvemshop, além de API e webhooks para qualquer sistema. Atende empresas de todo o Brasil — lojas, clínicas, escolas, imobiliárias, escritórios e prestadores de serviço —, com planos mensais ou anuais e 7 dias sem cobrança para testar.",
              )}
            </p>
          </div>
        </section>

        {/* 7. FlowNexa Interactive Features Showcase (Forest Textured + Wave) */}
        <RecursosInterativosAtenza textos={textosRecursosInterativos} marca={marca.nome} />

        {/* 8. Full Interactive Product Workspace Demo */}
        <section id="como-funciona" className={`${styles.section} ${styles.productSection}`}>
          <div className={styles.container}>
            <div className={styles.centerHeading}>
              <h2>{t("Explore o produto")}</h2>
              <p>{t("Experimente mudar a etapa deste contato no exemplo acima.")}</p>
            </div>
            <ProdutoDemonstracao textos={produto} cenario={cenarioClinica} marca={marca.nome} />
            <div className={styles.productBenefits}>
              <div>
                <History size={22} aria-hidden />
                <h3>{t("Um histórico para o time inteiro")}</h3>
                <p>{t("Todos acompanham o que já foi conversado.")}</p>
              </div>
              <div>
                <Users size={22} aria-hidden />
                <h3>{t("IA e pessoas, na mesma conversa")}</h3>
                <p>{t("O time assume quando o atendimento pede.")}</p>
              </div>
              <div>
                <SquareKanban size={22} aria-hidden />
                <h3>{t("O próximo passo fica à vista")}</h3>
                <p>{t("Organize os contatos e acompanhe as oportunidades.")}</p>
              </div>
            </div>
          </div>
        </section>

        {/* 9. FlowNexa Interactive Audience Tabs (4 Atenza Segments) */}
        <PublicosInterativosAtenza textos={textosPublicos} />

        {/* 10. Countries Available */}
        <PaisesDisponiveis idioma={visitante.idioma} />

        {/* 11. Integrations Marquee */}
        <section id="integracoes" className={`${styles.section} ${styles.integrationSection}`}>
          <div className={styles.container}>
            <div className={styles.centerHeading}>
              <h2>{t("Conecte o que sua operação já usa.")}</h2>
              <p>{t("Lojas, APIs e webhooks para trazer mais contexto ao atendimento.")}</p>
            </div>
          </div>
          <IntegracoesDaHome
            rotulo={t("Ferramentas e formas de conexão disponíveis")}
            pausar={t("Pausar animação")}
            continuar={t("Continuar animação")}
          />
          <div className={styles.integrationFoot}>
            <p>
              {t(
                "As conexões dependem do plano, das credenciais e das permissões de cada ferramenta.",
              )}
            </p>
            <Link href="/contato" className={styles.buttonOutline}>
              {t("Conversar sobre integrações")}
              <ArrowRight size={17} aria-hidden />
            </Link>
          </div>
        </section>

        {/* 12. Care / Context Video */}
        <section className={styles.careSection}>
          <div className={styles.careLayout}>
            <VideoDeContexto
              textos={{
                alt: t("Cena de atendimento com uma profissional usando headset"),
                semSom: t("Sem som"),
                pausar: t("Pausar vídeo de contexto"),
                tocar: t("Reproduzir vídeo de contexto"),
                indisponivel: t("A imagem continua disponível enquanto o vídeo não carrega."),
              }}
            />
            <div className={styles.careCopy}>
              <h2>
                {t("Automatize a rotina.")}
                <br />
                {t("Mantenha o cuidado.")}
              </h2>
              <p>
                {t(
                  "A IA ajuda no repetitivo. Sua equipe entra com atenção, contexto e autonomia quando o cliente precisa.",
                )}
              </p>
              <ul>
                <li>
                  <LockKeyhole size={22} aria-hidden />
                  <span>
                    <strong>{t("Acesso por pessoa")}</strong>
                    {t(
                      "Cada integrante entra com o próprio acesso e as permissões definidas pela empresa.",
                    )}
                  </span>
                </li>
                <li>
                  <History size={22} aria-hidden />
                  <span>
                    <strong>{t("Histórico compartilhado")}</strong>
                    {t("O contexto fica na conversa, mesmo quando muda quem atende.")}
                  </span>
                </li>
                <li>
                  <ShieldCheck size={22} aria-hidden />
                  <span>
                    <strong>{t("Limites definidos por você")}</strong>
                    {t("Configure o conhecimento, as instruções e a passagem para o time.")}
                  </span>
                </li>
              </ul>
              <Link href="/legal/privacy" className={styles.textLink}>
                {t("Conhecer a política de privacidade")}
                <ArrowRight size={17} aria-hidden />
              </Link>
            </div>
          </div>
        </section>

        {/* 13. Explainer Video */}
        <section className={styles.section}>
          <div className={`${styles.container} ${styles.explainerLayout}`}>
            <div className={styles.sectionHeading}>
              <h2>{t("Conheça antes de decidir.")}</h2>
              <p>
                {t(
                  "Dê o play e entenda como as conversas, a IA e o funil se conectam no dia a dia.",
                )}
              </p>
              <div className={styles.steps}>
                {[
                  [QrCode, t("Conecte o seu WhatsApp")],
                  [Bot, t("Ensine o atendente")],
                  [SquareKanban, t("Acompanhe pelo funil")],
                ].map(([Icone, texto], i) => {
                  const Icon = Icone as typeof QrCode;
                  return (
                    <div key={String(texto)}>
                      <span>{i + 1}</span>
                      <Icon size={21} aria-hidden />
                      <strong>{texto as string}</strong>
                    </div>
                  );
                })}
              </div>
            </div>
            <VideoExplicativo
              textos={video}
              className={styles.explainerCard}
              arquivo={apresentacao}
            >
              <Image src={apresentacao.poster} alt="" fill sizes="(max-width: 767px) 100vw, 52vw" />
              <span className={styles.playCircle}>
                <Play size={27} fill="currentColor" aria-hidden />
              </span>
              <span className={styles.explainerLabel}>
                {t("Assistir à explicação")}
                <small>{t("Com áudio e legendas em português")}</small>
              </span>
            </VideoExplicativo>
          </div>
        </section>

        {/* 14. Live Localized Plans Section (Stripe Multi-Currency) */}
        {vendidos.length > 0 && (
          <section
            id={ID_DA_SECAO_DE_PLANOS}
            className={styles.pricingSection}
            aria-labelledby="planos-titulo"
          >
            <div className={styles.container}>
              <div className={styles.centerHeading}>
                <h2 id="planos-titulo">{t("Planos e preços")}</h2>
                <p>{`${trial}. ${condicoes}`}</p>
              </div>
              <div className={styles.plans}>
                {vendidos.map((id) => {
                  const plano = PLANOS[id];
                  const destaque = id === "pro";
                  return (
                    <article
                      key={id}
                      className={`${styles.plan} ${destaque ? styles.featuredPlan : ""}`}
                    >
                      <div className={styles.planHeading}>
                        <h3>{t(plano.nome)}</h3>
                        {destaque && <span>{t("Recomendado")}</span>}
                      </div>
                      <p className={styles.price}>
                        {precoLegivelNoMercado(id, mercado)}
                        <small>{t("/mês")}</small>
                      </p>
                      <ul>
                        {plano.destaques.map((d) => (
                          <li key={d}>
                            <Check size={17} aria-hidden />
                            {t(d)}
                          </li>
                        ))}
                      </ul>
                      <Link
                        href="/signup"
                        data-medir={`plano-${id}`}
                        className={destaque ? styles.buttonLight : styles.buttonOutline}
                      >
                        {`${t("Começar com")} ${trial}`}
                        <ArrowRight size={17} aria-hidden />
                      </Link>
                      <p className={styles.planTerms}>{condicoes}</p>
                    </article>
                  );
                })}
              </div>
            </div>
          </section>
        )}

        {/* 15. FlowNexa FAQ Showcase (Forest BG + White Rounded Panel) */}
        <section id="perguntas" className={styles.faqShowcase}>
          <div className={styles.faqPanel}>
            <div className={styles.faqLayout}>
              <div className={styles.sectionHeading}>
                <span className={styles.faqKicker}>{t("Perguntas frequentes")}</span>
                <h2>{t("Respostas antes do primeiro passo.")}</h2>
                <p>{t("O que costumam perguntar antes de assinar")}</p>
                <Link href="/contato" className={styles.textLink}>
                  {t("Fale com a gente")}
                  <ArrowRight size={17} aria-hidden />
                </Link>
              </div>
              <div className={styles.faq}>
                <Pergunta
                  pergunta={t("Preciso trocar de número?")}
                  resposta={t(
                    "Não. Você conecta o número que a empresa já usa lendo um QR code, e as conversas seguem de onde pararam.",
                  )}
                />
                <Pergunta
                  pergunta={t("A IA responde sozinha o tempo todo?")}
                  resposta={t(
                    "Só até onde você deixar. Ela responde o que está na base de conhecimento e entrega a conversa a uma pessoa do time quando o assunto sai dali.",
                  )}
                />
                <Pergunta
                  pergunta={t("O time todo consegue usar?")}
                  resposta={t(
                    "Sim. Cada pessoa entra com o próprio acesso e você decide o que cada uma pode ver e fazer.",
                  )}
                />
                <Pergunta
                  pergunta={t("E se eu quiser cancelar?")}
                  resposta={t(
                    "O cancelamento é um clique na própria tela de cobrança, sem falar com ninguém. O acesso continua até o fim do período já pago.",
                  )}
                />
                <Pergunta
                  pergunta={t("Onde ficam os dados dos meus clientes?")}
                  resposta={t(
                    "Os dados são separados por empresa, com controles de acesso. A plataforma oferece recursos de exportação e de atendimento a solicitações de privacidade.",
                  )}
                />
                <Pergunta
                  pergunta={t("O uso de IA tem alguma configuração adicional?")}
                  resposta={t(
                    "Sim. O agente precisa de uma base de conhecimento, instruções e credenciais do provedor de IA configuradas na sua operação. O consumo do provedor pode ter custos próprios.",
                  )}
                />
              </div>
            </div>
          </div>
        </section>

        {/* 16. Final CTA Band */}
        <section className={styles.finalSection}>
          <div className={styles.container}>
            <h2>{t("A próxima conversa pode ser o começo de uma venda.")}</h2>
            <p>{t("Organize o atendimento. Dê contexto à equipe. Acompanhe o próximo passo.")}</p>
            <Link href="/signup" data-medir="cta-final" className={styles.buttonLight}>
              {`${t("Começar com")} ${trial}`}
              <ArrowRight size={18} aria-hidden />
            </Link>
            <p className={styles.finalConditions}>{condicoes}</p>
          </div>
        </section>
      </main>

      <footer className={styles.footer}>
        <div className={`${styles.container} ${styles.footerBottom}`}>
          <nav aria-label="Language">
            {SELETOR_DE_IDIOMA.map((item) => (
              <Link key={item.lang} href={item.href} hrefLang={item.lang} lang={item.lang}>
                {item.label}
              </Link>
            ))}
          </nav>
          {idioma === "pt-BR" && (
            <nav aria-label={t("Informações e contato")}>
              {LINKS_SEO.map((item) => (
                <Link key={item.href} href={item.href}>
                  {item.label}
                </Link>
              ))}
            </nav>
          )}
        </div>
        <div className={`${styles.container} ${styles.footerLead}`}>
          <div>
            <h2>{t("Ainda pensando?")}</h2>
            <p>
              {t(
                "Deixe seu e-mail. Mandamos o que aprendemos sobre atender por WhatsApp sem perder o cliente — e nada além disso.",
              )}
            </p>
          </div>
          <CapturaDeLead
            textos={textosDaCaptura}
            idioma={visitante.idioma}
            moeda={mercado.moeda}
            origem="rodape"
            className={styles.capture}
          />
        </div>
      </footer>
      <RodapeDoSite nome={marca.nome} idioma={idioma} />
    </div>
  );
}

function Marca({ marca }: { marca: MarcaDeSaida }) {
  if (simboloDaMarca(marca.nome) === SIMBOLO_ATENZA)
    return <LogotipoDoProduto nome={marca.nome} className="h-8 w-auto" />;
  if (marca.logoUrl)
    return <img src={marca.logoUrl} alt={marca.nome} className={styles.brandImage} />; // eslint-disable-line @next/next/no-img-element
  if (marcaEhADoProduto({ name: marca.nome, logoUrl: null }))
    return <LogotipoDoProduto nome={marca.nome} className="h-7 w-auto" />;
  return (
    <span className={styles.brand}>
      <SimboloDaMarca nome={marca.nome} className="size-8" decorativo />
      <span>{marca.nome}</span>
    </span>
  );
}

function Pergunta({ pergunta, resposta }: { pergunta: string; resposta: string }) {
  return (
    <details>
      <summary>
        {pergunta}
        <span aria-hidden>+</span>
      </summary>
      <p>{resposta}</p>
    </details>
  );
}
