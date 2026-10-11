import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowRight,
  Bot,
  Check,
  History,
  LockKeyhole,
  Play,
  QrCode,
  ShieldCheck,
  SquareKanban,
  Users,
} from "lucide-react";

import { LogotipoDoProduto, SimboloDaMarca } from "@/components/branding/MarcaDoProduto";
import { CapturaDeLead } from "@/components/site/CapturaDeLead";
import { ConviteDeLead } from "@/components/site/ConviteDeLead";
import { IntegracoesDaHome } from "@/components/site/IntegracoesDaHome";
import { Medidor } from "@/components/site/Medidor";
import { NavegacaoDaHome } from "@/components/site/NavegacaoDaHome";
import { ProdutoDemonstracao, type TextosDoProduto } from "@/components/site/ProdutoDemonstracao";
import {
  VideoDeContexto,
  VideoExplicativo,
  type TextosDoVideo,
} from "@/components/site/VideosDaHome";
import styles from "@/components/site/atenza-home.module.css";
import { marcaEhADoProduto } from "@/lib/branding";
import { emailDeSuporte, marcaDaSaida, type MarcaDeSaida } from "@/lib/branding/saida";
import {
  DIAS_DE_TRIAL,
  ORDEM_DOS_PLANOS,
  PLANOS,
  instalacaoCobra,
  precoDoPlano,
  type PlanoId,
} from "@/lib/billing/planos";
import { ID_DA_SECAO_DE_PLANOS } from "@/lib/marketing/caminhos";
import { precoLegivelNoMercado } from "@/lib/mercado/paises";
import { textoDoSite } from "@/lib/mercado/textos";
import { visitanteAtual } from "@/lib/mercado/visitante";
import { createClient } from "@/lib/supabase/server";

// O mesmo interruptor da cobrança preserva o clone self-host sem vitrine de assinatura.
export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const marca = await marcaDaSaida(null);
  return {
    title: { absolute: `${marca.nome} — atendimento por WhatsApp que não perde cliente` },
    description:
      "Centralize o WhatsApp da sua empresa em uma tela só, com agentes de IA, histórico compartilhado e funil de vendas. Automatize a rotina e mantenha o cuidado com cada cliente.",
    robots: { index: true, follow: true },
    alternates: { canonical: "/" },
  };
}

export default async function HomePage() {
  if (!instalacaoCobra()) redirect("/app");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect("/app");

  const [visitante, marca] = await Promise.all([visitanteAtual(), marcaDaSaida(null)]);
  const { mercado } = visitante;
  const t = (texto: string) => textoDoSite(texto, visitante.idioma);
  const suporte = emailDeSuporte();
  const vendidos: PlanoId[] = ORDEM_DOS_PLANOS.filter((p) => precoDoPlano(p) !== null);
  const textosDaCaptura = {
    rotulo: t("Seu e-mail"),
    exemplo: t("seu@email.com"),
    enviar: t("Quero receber"),
    enviando: t("Enviando..."),
    promessa: t("Sem spam. Um clique para sair, em qualquer e-mail."),
    sucesso: t("Pronto. Se houver novidade que valha o seu tempo, ela chega por e-mail."),
    erro: t("Não foi possível inscrever agora. Tente de novo em instantes."),
  };
  // As ilhas recebem os três idiomas da vitrine por prop, sem importar o dicionário do produto.
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
    cliente: t("Cliente da loja"),
    equipe: t("Sua equipe"),
    ultima: t("Quero mais informações"),
    pergunta: t("Oi! Vocês têm este modelo em estoque?"),
    resposta: t("Oi, Mariana! Temos sim. Posso te ajudar a escolher o tamanho?"),
    agradecimento: t("Pode sim! Estou procurando o tamanho 38."),
    escrever: t("Escreva uma mensagem..."),
    nota: t("Demonstração interativa com dados fictícios. Nenhuma mensagem é enviada."),
    atribuida: t("Conversa atribuída à equipe"),
    conhecimento: t("O conhecimento é da sua empresa."),
    documentos: t("Organize os materiais que orientam o agente."),
    documento1: t("Produtos e serviços"),
    documento2: t("Prazos e entregas"),
    documento3: t("Perguntas frequentes"),
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
    proximoTexto: t("Confirmar o tamanho e acompanhar a decisão."),
    mover: t("Mover para"),
    demonstracaoTexto: t("Experimente mudar a etapa deste contato no exemplo acima."),
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
      "Seu cliente mandou uma mensagem. E agora? Com o Atenza, seu time organiza o atendimento pelo WhatsApp em uma caixa de entrada compartilhada. As conversas têm contexto, responsáveis e um próximo passo claro.",
    ),
    paragrafo2: t(
      "Configure seu agente de IA com o conhecimento do seu negócio e as credenciais do seu provedor. Ele ajuda com as dúvidas da rotina, e sua equipe assume quando o atendimento precisa de atenção humana.",
    ),
    paragrafo3: t(
      "Depois, acompanhe as oportunidades no funil e organize os retornos. As integrações disponíveis conectam sua operação, conforme a configuração de cada serviço.",
    ),
    paragrafo4: t(
      "Menos improviso. Mais atenção em cada conversa. Conheça os planos do Atenza. Comece com sete dias sem cobrança. É necessário cartão.",
    ),
  };
  const trial = `${DIAS_DE_TRIAL} ${t("dias sem cobrança")}`;
  const condicoes = t(
    "Cartão necessário. Renovação automática após a avaliação. Cancele quando quiser.",
  );
  const segmentos = [
    {
      arquivo: "segmento-comercio.webp",
      nome: t("Comércio e e-commerce"),
      titulo: t("A dúvida chega. A conversa continua."),
      texto: t("Reúna perguntas sobre produtos, pedidos e entregas com o contexto da sua loja."),
      alt: t("Empreendedora organizando pedidos de uma loja"),
    },
    {
      arquivo: "segmento-clinica.webp",
      nome: t("Clínicas e saúde"),
      titulo: t("Mais atenção a quem precisa agendar."),
      texto: t("Organize o primeiro contato e encaminhe dúvidas para a equipe responsável."),
      alt: t("Profissional de recepção em uma clínica"),
    },
    {
      arquivo: "segmento-educacao.webp",
      nome: t("Educação"),
      titulo: t("Do interesse à próxima conversa."),
      texto: t("Centralize dúvidas sobre cursos e acompanhe os interessados pelo funil."),
      alt: t("Profissional de educação acompanhando informações no computador"),
    },
    {
      arquivo: "segmento-servicos.webp",
      nome: t("Serviços e B2B"),
      titulo: t("O contexto acompanha cada proposta."),
      texto: t("Qualifique os contatos e mantenha o próximo passo visível para o time."),
      alt: t("Profissional de serviços conversando com um cliente"),
    },
  ];

  return (
    <div className={styles.home}>
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
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <Link href="/" aria-label={marca.nome} className={styles.brandLink}>
            <Marca marca={marca} />
          </Link>
          <nav className={styles.desktopNav} aria-label={t("Navegação principal")}>
            <a href="#como-funciona">{t("Como funciona")}</a>
            <a href="#recursos">{t("Recursos")}</a>
            <a href="#integracoes">{t("Integrações")}</a>
            {vendidos.length > 0 && <a href={`#${ID_DA_SECAO_DE_PLANOS}`}>{t("Planos")}</a>}
            <a href="#perguntas">{t("Perguntas")}</a>
          </nav>
          <div className={styles.headerActions}>
            <Link href="/login" className={styles.login}>
              {t("Entrar")}
            </Link>
            <Link href="/signup" data-medir="cta-menu" className={styles.buttonSmall}>
              {t("Criar conta")}
              <ArrowRight size={16} aria-hidden />
            </Link>
            <NavegacaoDaHome
              abrir={t("Abrir navegação")}
              rotulo={t("Navegação principal")}
              itens={[
                { href: "#como-funciona", texto: t("Como funciona") },
                { href: "#recursos", texto: t("Recursos") },
                { href: "#integracoes", texto: t("Integrações") },
                ...(vendidos.length
                  ? [{ href: `#${ID_DA_SECAO_DE_PLANOS}`, texto: t("Planos") }]
                  : []),
                { href: "#perguntas", texto: t("Perguntas") },
                { href: "/login", texto: t("Entrar") },
              ]}
            />
          </div>
        </div>
      </header>
      <main id="conteudo">
        <section className={styles.hero}>
          <Image
            src="/media/atenza/hero-office.webp"
            alt=""
            fill
            preload
            sizes="100vw"
            className={styles.heroImage}
          />
          <div className={styles.heroContent}>
            <h1>
              {t("Seu atendimento cresce.")}
              <br />
              {t("Seu cliente não espera.")}
            </h1>
            <p>{t("WhatsApp, agentes de IA e funil de vendas na mesma plataforma.")}</p>
            <div className={styles.heroActions}>
              <a href="#video-explicativo" className={styles.button}>
                <Play size={17} aria-hidden />
                {t("Ver em ação")}
              </a>
              <a
                href={`#${vendidos.length ? ID_DA_SECAO_DE_PLANOS : "como-funciona"}`}
                className={styles.buttonOutline}
              >
                {vendidos.length ? t("Conhecer os planos") : t("Como funciona")}
                <ArrowRight size={17} aria-hidden />
              </a>
            </div>
          </div>
          <div className={styles.heroProduct}>
            <ProdutoDemonstracao textos={produto} marca={marca.nome} compacto />
            <span className={styles.heroDemoNote}>
              {t("Prévia ilustrativa com dados fictícios")}
            </span>
          </div>
        </section>
        <div className={styles.benefits}>
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

        <section id="como-funciona" className={`${styles.section} ${styles.productSection}`}>
          <div className={styles.container}>
            <div className={styles.centerHeading}>
              <h2>{t("Veja o atendimento acontecer.")}</h2>
              <p>{t("Da primeira mensagem ao próximo passo da venda.")}</p>
            </div>
            <ProdutoDemonstracao textos={produto} marca={marca.nome} />
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

        <section id="recursos" className={styles.section}>
          <div className={styles.container}>
            <div className={styles.sectionHeading}>
              <h2>{t("No ritmo do seu negócio.")}</h2>
              <p>{t("Veja onde a plataforma entra na sua rotina.")}</p>
            </div>
            <div className={styles.segmentGrid}>
              {segmentos.map((s, i) => (
                <article
                  className={`${styles.segment} ${i === 0 ? styles.segmentFeatured : ""}`}
                  key={s.arquivo}
                >
                  <div className={styles.segmentImage}>
                    <Image
                      src={`/media/atenza/${s.arquivo}`}
                      alt={s.alt}
                      fill
                      sizes="(max-width: 599px) 100vw, (max-width: 1023px) 50vw, 40vw"
                    />
                  </div>
                  <div className={styles.segmentCopy}>
                    <span>{s.nome}</span>
                    <h3>{s.titulo}</h3>
                    <p>{s.texto}</p>
                  </div>
                </article>
              ))}
            </div>
            <p className={styles.useCaseNote}>
              {t(
                "Exemplos de uso. A configuração deve respeitar os processos e as responsabilidades da sua empresa.",
              )}
            </p>
          </div>
        </section>

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

        <section className={styles.careSection}>
          <div className={styles.careLayout}>
            <VideoDeContexto
              textos={{
                alt: t("Cena de atendimento com uma profissional usando headset"),
                semSom: t("Vídeo de contexto · sem som"),
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
            <VideoExplicativo textos={video} className={styles.explainerCard}>
              <Image
                src="/media/atenza/explainer-thumbnail.webp"
                alt=""
                fill
                sizes="(max-width: 767px) 100vw, 52vw"
              />
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

        {vendidos.length > 0 && (
          <section
            id={ID_DA_SECAO_DE_PLANOS}
            className={`${styles.section} ${styles.pricingSection}`}
          >
            <div className={styles.container}>
              <div className={styles.centerHeading}>
                <h2>{t("Um plano para o seu momento.")}</h2>
                <p>
                  {trial}. {t("Escolha o tamanho da sua operação.")}
                </p>
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
                        {t("Começar agora")}
                        <ArrowRight size={17} aria-hidden />
                      </Link>
                      <p className={styles.planTerms}>{condicoes}</p>
                    </article>
                  );
                })}
              </div>
              <p className={styles.conditions}>{condicoes}</p>
            </div>
          </section>
        )}

        <section id="perguntas" className={styles.section}>
          <div className={`${styles.container} ${styles.faqLayout}`}>
            <div className={styles.sectionHeading}>
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
        </section>

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
        <div className={`${styles.container} ${styles.footerBottom}`}>
          <div>
            <Marca marca={marca} />
            <p>{t("Atendimento e vendas por WhatsApp")}</p>
          </div>
          <nav aria-label={t("Informações e contato")}>
            <Link href="/legal/terms">{t("Termos de uso")}</Link>
            <Link href="/legal/privacy">{t("Política de Privacidade")}</Link>
            <Link href="/legal">{t("Documentos")}</Link>
            <Link href="/contato">{t("Fale com a gente")}</Link>
            {suporte && <a href={`mailto:${suporte}`}>{suporte}</a>}
            <Link href="/login">{t("Entrar")}</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}

function Marca({ marca }: { marca: MarcaDeSaida }) {
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
