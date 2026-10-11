import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, Check, Minus } from "lucide-react";

import { CabecalhoDoSite } from "@/components/site/CabecalhoDoSite";
import { Medidor } from "@/components/site/Medidor";
import { RodapeDoSite } from "@/components/site/RodapeDoSite";
import homeStyles from "@/components/site/atenza-home.module.css";
import {
  DIAS_DE_TRIAL,
  instalacaoCobra,
  instalacaoVendeAnual,
  ORDEM_DOS_PLANOS,
  PLANOS,
  precoDoPlano,
  type PlanoId,
} from "@/lib/billing/planos";
import { marcaDaSaida } from "@/lib/branding/saida";
import { env } from "@/lib/env";
import { ID_DA_SECAO_DE_PLANOS } from "@/lib/marketing/caminhos";
import { jsonLdSeguro, metadadosPublicos, schemaDoFaq } from "@/lib/marketing/seo";
import { schemaDoSoftware } from "@/lib/marketing/schema-do-produto";
import { precoAnualLegivelNoMercado, precoLegivelNoMercado } from "@/lib/mercado/paises";
import { visitanteAtual } from "@/lib/mercado/visitante";
import styles from "./precos.module.css";

export const dynamic = "force-dynamic";

/**
 * A PÁGINA DE PREÇOS — onde a decisão acontece.
 *
 * A home vende o benefício; aqui ficam o preço, a comparação, como funciona a
 * assinatura, quanto custa a IA e as dúvidas de quem está para assinar. A
 * tabela mantém `id="planos"`: é por ele que o medidor registra "chegou ao
 * preço", e o resgate de checkout abandonado depende desse registro.
 */
export async function generateMetadata() {
  const marca = await marcaDaSaida(null);
  return metadadosPublicos({
    nome: marca.nome,
    titulo: "Preços e planos: atendimento WhatsApp com IA e CRM",
    descricao:
      "Planos a partir de R$ 97/mês para atender e vender pelo WhatsApp com vários atendentes, agentes de IA e CRM. 7 dias sem cobrança e cancelamento em um clique.",
    caminho: "/precos",
    base: env.NEXT_PUBLIC_APP_URL,
  });
}

/** Linhas da comparação: só o que cada plano entrega de fato (os destaques do catálogo). */
const COMPARACAO: { recurso: string; planos: Record<PlanoId, string | boolean> }[] = [
  {
    recurso: "Números de WhatsApp",
    planos: { essencial: "1", pro: "Até 3", ilimitado: "Sem limite" },
  },
  {
    recurso: "Pessoas na equipe",
    planos: { essencial: "Até 3", pro: "Até 10", ilimitado: "Sem limite" },
  },
  {
    recurso: "Caixa de entrada compartilhada",
    planos: { essencial: true, pro: true, ilimitado: true },
  },
  {
    recurso: "Agente de IA com a sua base de conhecimento",
    planos: { essencial: true, pro: true, ilimitado: true },
  },
  {
    recurso: "CRM, funil de vendas e histórico",
    planos: { essencial: true, pro: true, ilimitado: true },
  },
  { recurso: "Ferramentas da LGPD", planos: { essencial: true, pro: true, ilimitado: true } },
  {
    recurso: "Follow-up automático e campanhas",
    planos: { essencial: false, pro: true, ilimitado: true },
  },
  {
    recurso: "Relatórios e metas de atendimento",
    planos: { essencial: false, pro: true, ilimitado: true },
  },
  { recurso: "API e webhooks", planos: { essencial: false, pro: false, ilimitado: true } },
  { recurso: "Suporte prioritário", planos: { essencial: false, pro: false, ilimitado: true } },
];

const PASSOS = [
  { titulo: "Crie a sua conta", texto: "Pelo site, em poucos minutos, sem falar com ninguém." },
  {
    titulo: "Escolha o plano",
    texto: `Cadastre o cartão no checkout seguro da Stripe. Nada é cobrado nos primeiros ${DIAS_DE_TRIAL} dias.`,
  },
  {
    titulo: "Conecte e configure",
    texto:
      "Ligue o WhatsApp da empresa pela API oficial e cadastre as informações que a IA vai usar.",
  },
  {
    titulo: "Use e decida",
    texto: "Depois dos 7 dias a assinatura começa sozinha. Quer parar? Cancele em um clique.",
  },
];

const FAQ = [
  {
    question: "Preciso de cartão para testar?",
    answer: `Sim. O cartão é cadastrado no checkout da Stripe, mas nada é cobrado nos primeiros ${DIAS_DE_TRIAL} dias. Se cancelar antes, não paga nada.`,
  },
  {
    question: "O custo da inteligência artificial está incluído?",
    answer:
      "A IA usa a chave do provedor que você escolher (como OpenAI, Anthropic, Google ou OpenRouter). Você paga o uso direto ao provedor, sem taxa nossa por cima, e acompanha o consumo no painel.",
  },
  {
    question: "Existe cobrança por mensagem?",
    answer:
      "Cobramos só a assinatura. Pela API oficial do WhatsApp, a Meta pode cobrar por algumas mensagens (como as de campanha), direto na sua conta do WhatsApp Business.",
  },
  {
    question: "Posso trocar de plano ou cancelar?",
    answer:
      "Sim, a qualquer momento, pela própria tela de assinatura. O cancelamento é em um clique, sem falar com ninguém.",
  },
  {
    question: "Meu número de WhatsApp muda?",
    answer:
      "Não. Você conecta o número da empresa à API oficial e continua atendendo pelo mesmo número.",
  },
  {
    question: "Quantas pessoas podem atender?",
    answer: "Até 3 no Essencial, até 10 no Pro e sem limite no Ilimitado, todas no mesmo número.",
  },
];

export default async function PaginaDePrecos({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  if (!instalacaoCobra()) notFound();
  const [marca, visitante, params] = await Promise.all([
    marcaDaSaida(null),
    visitanteAtual(),
    searchParams,
  ]);
  const vendidos: PlanoId[] = ORDEM_DOS_PLANOS.filter((p) => precoDoPlano(p) !== null);
  // Os preços anuais são em real: fora do Brasil a página segue só mensal.
  const vendeAnual = instalacaoVendeAnual() && visitante.mercado.moeda === "BRL";
  const anual = vendeAnual && params.ciclo === "anual";
  const condicoes =
    "Cartão necessário. Renovação automática após a avaliação. Cancele quando quiser.";

  return (
    <div className={styles.pagina}>
      <Medidor idioma="pt-BR" moeda={visitante.mercado.moeda} dispositivo={visitante.dispositivo} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLdSeguro({
            "@context": "https://schema.org",
            "@graph": [
              schemaDoSoftware(marca.nome, env.NEXT_PUBLIC_APP_URL),
              schemaDoFaq(env.NEXT_PUBLIC_APP_URL, "/precos", FAQ),
            ],
          }),
        }}
      />
      <CabecalhoDoSite nome={marca.nome} />
      <main id="conteudo">
        <section className={styles.topo}>
          <p className={styles.sobretitulo}>Preços e planos</p>
          <h1>Um plano para cada tamanho de operação.</h1>
          <p className={styles.intro}>
            Vários atendentes no mesmo número, agente de IA com as informações do seu negócio e CRM
            com histórico em todos os planos. {DIAS_DE_TRIAL} dias sem cobrança e cancelamento em um
            clique.
          </p>
        </section>

        <section
          id={ID_DA_SECAO_DE_PLANOS}
          className={homeStyles.pricingSection}
          aria-label="Planos"
        >
          <div className={homeStyles.container}>
            {vendeAnual && (
              <nav className={styles.ciclo} aria-label="Ciclo de cobrança">
                <Link
                  href="/precos#planos"
                  scroll={false}
                  aria-current={anual ? undefined : "page"}
                  data-medir="ciclo-mensal"
                >
                  Mensal
                </Link>
                <Link
                  href="/precos?ciclo=anual#planos"
                  scroll={false}
                  aria-current={anual ? "page" : undefined}
                  data-medir="ciclo-anual"
                >
                  Anual <span>2 meses grátis</span>
                </Link>
              </nav>
            )}
            <div className={homeStyles.plans}>
              {vendidos.map((id) => {
                const plano = PLANOS[id];
                const destaque = id === "pro";
                return (
                  <article
                    key={id}
                    className={`${homeStyles.plan} ${destaque ? homeStyles.featuredPlan : ""}`}
                  >
                    <div className={homeStyles.planHeading}>
                      <h2 className={styles.nomeDoPlano}>{plano.nome}</h2>
                      {destaque && <span>Recomendado</span>}
                    </div>
                    <p className={homeStyles.price}>
                      {anual
                        ? precoAnualLegivelNoMercado(id, visitante.mercado)
                        : precoLegivelNoMercado(id, visitante.mercado)}
                      <small>{anual ? "/ano" : "/mês"}</small>
                    </p>
                    {anual && (
                      <p className={styles.economia}>
                        Equivale a 10 mensalidades: 2 meses grátis por ano.
                      </p>
                    )}
                    <ul>
                      {plano.destaques.map((d) => (
                        <li key={d}>
                          <Check size={17} aria-hidden />
                          {d}
                        </li>
                      ))}
                    </ul>
                    <Link
                      href={anual ? "/signup?ciclo=anual" : "/signup"}
                      data-medir={`plano-${id}${anual ? "-anual" : ""}`}
                      className={destaque ? homeStyles.buttonLight : homeStyles.buttonOutline}
                    >
                      Começar agora
                      <ArrowRight size={17} aria-hidden />
                    </Link>
                    <p className={homeStyles.planTerms}>{condicoes}</p>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        <section className={styles.bloco} aria-labelledby="comparar">
          <h2 id="comparar">Compare os planos</h2>
          <div className={styles.tabelaRolagem}>
            <table className={styles.tabela}>
              <thead>
                <tr>
                  <th scope="col">Recurso</th>
                  {vendidos.map((id) => (
                    <th key={id} scope="col">
                      {PLANOS[id].nome}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {COMPARACAO.map((linha) => (
                  <tr key={linha.recurso}>
                    <th scope="row">{linha.recurso}</th>
                    {vendidos.map((id) => {
                      const v = linha.planos[id];
                      return (
                        <td key={id}>
                          {v === true ? (
                            <Check size={18} aria-label="Incluído" className={styles.sim} />
                          ) : v === false ? (
                            <Minus size={18} aria-label="Não incluído" className={styles.nao} />
                          ) : (
                            v
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className={styles.bloco} aria-labelledby="como-funciona-assinatura">
          <h2 id="como-funciona-assinatura">Como funciona a assinatura</h2>
          <ol className={styles.passos}>
            {PASSOS.map((p, i) => (
              <li key={p.titulo}>
                <span className={styles.numero}>{i + 1}</span>
                <strong>{p.titulo}</strong>
                <p>{p.texto}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className={styles.bloco} aria-labelledby="custo-ia">
          <div className={styles.destaque}>
            <h2 id="custo-ia">E o custo da inteligência artificial?</h2>
            <p>
              A inteligência artificial usa a chave do provedor que você escolher. Você paga o uso
              direto a ele, sem nenhuma taxa nossa por cima, e vê o consumo no painel. Assim o preço
              do plano não sobe com o volume de conversas, e quem atende muito sabe exatamente
              quanto gasta.
            </p>
          </div>
        </section>

        <section className={styles.bloco} aria-labelledby="duvidas">
          <h2 id="duvidas">Dúvidas antes de assinar</h2>
          <div className={styles.faq}>
            {FAQ.map((p) => (
              <details key={p.question}>
                <summary>{p.question}</summary>
                <p>{p.answer}</p>
              </details>
            ))}
          </div>
        </section>

        <section className={styles.chamada}>
          <h2>Comece hoje. Os primeiros {DIAS_DE_TRIAL} dias são por nossa conta.</h2>
          <div className={styles.acoes}>
            <Link href="/signup" className={styles.primario}>
              Criar conta
              <ArrowRight size={18} aria-hidden />
            </Link>
            <Link href="/demonstracao" className={styles.secundario}>
              Ver a demonstração
            </Link>
          </div>
        </section>
      </main>
      <RodapeDoSite nome={marca.nome} />
    </div>
  );
}
