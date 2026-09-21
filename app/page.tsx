import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowRight,
  Bot,
  ChartColumn,
  Check,
  Clock,
  Inbox,
  QrCode,
  ShieldCheck,
  SquareKanban,
  Sparkles,
} from "lucide-react";

import { LogotipoDoProduto, SimboloDaMarca } from "@/components/branding/MarcaDoProduto";
import { Medidor } from "@/components/site/Medidor";
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
import { precoLegivelNoMercado } from "@/lib/mercado/paises";
import { textoDoSite } from "@/lib/mercado/textos";
import { visitanteAtual } from "@/lib/mercado/visitante";
import { createClient } from "@/lib/supabase/server";

/**
 * A PÁGINA QUE EXPLICA O PRODUTO ANTES DE PEDIR DINHEIRO.
 *
 * ─── Por que a raiz deixou de ser só um redirect ───────────────────────────
 *
 * Até aqui `/` mandava direto para `/app`, e o middleware jogava quem não tem
 * sessão em `/login`. Isso basta enquanto o produto é instalado por quem já
 * sabe o que ele é — o self-host. Num SaaS que cobra assinatura é o contrário:
 * a primeira coisa que a pessoa encontra é um formulário de senha de um sistema
 * que ela nunca viu. Não há como assinar o que não foi explicado.
 *
 * ─── As duas caras, pelo mesmo interruptor da tela de cobrança ─────────────
 *
 * `instalacaoCobra() === false` (sem `STRIPE_SECRET_KEY`) → **nada muda**: a
 * raiz segue redirecionando para `/app`. Quem clonou este repositório para uma
 * VPS não tem plano para vender e não deve ganhar uma página de vendas nossa na
 * frente do próprio sistema. É o MESMO interruptor de
 * `app/app/settings/billing/page.tsx`, de propósito: uma segunda condição para
 * "esta instalação é o SaaS hospedado" divergiria da primeira no primeiro dia.
 *
 * Quem já está logado também segue para `/app`. A página é para quem chega de
 * fora; entregá-la a quem já paga seria pedir que ele passe pela portaria toda
 * vez que digita o domínio.
 *
 * ─── O idioma e o PREÇO, aqui, vêm do país ─────────────────────────────────
 *
 * Nas telas de dentro o idioma sai de `AuthUser.idioma`. Aqui não há usuário:
 * quem lê é um visitante anônimo, e o que se sabe dele é de onde ele chegou.
 * `lib/mercado/visitante.ts` lê o país do cabeçalho da borda e
 * `lib/mercado/paises.ts` converte isso em idioma, moeda e preço de uma vez —
 * as três coisas são a MESMA decisão, e separá-las produziria a combinação
 * absurda de uma página em espanhol cobrando em real.
 *
 * O país vence o `Accept-Language`, e o motivo está no cabeçalho de
 * `visitante.ts`: o cabeçalho do navegador diz que idioma a pessoa configurou
 * uma vez; o país diz onde ela vai passar o cartão.
 *
 * ─── `robots` ──────────────────────────────────────────────────────────────
 *
 * O layout raiz declara `index: false` para o produto INTEIRO, e está certo: o
 * que há lá dentro é conversa de cliente. Esta página é a única exceção, e ela
 * a declara localmente — metadata de página vence a do layout.
 */

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const marca = await marcaDaSaida(null);
  return {
    // `absolute` porque o layout raiz aplica o sufixo `· <marca>` a toda página
    // filha, e aqui o nome da marca já abre o título. Sem isto o resultado é
    // "Atenza — ... · Atenza", que é como um título de página anuncia descuido.
    title: {
      absolute: `${marca.nome} — atendimento por WhatsApp que não perde cliente`,
    },
    description:
      "Centralize o WhatsApp da sua empresa em uma tela só, com um atendente de IA que responde na hora e chama o time humano quando o assunto pede. Funil, histórico e follow-up no mesmo lugar.",
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

  const visitante = await visitanteAtual();
  const { mercado } = visitante;
  const t = (texto: string) => textoDoSite(texto, visitante.idioma);

  const marca = await marcaDaSaida(null);
  const suporte = emailDeSuporte();
  // Só os planos que ESTA instalação de fato vende — mesma regra da tela de
  // cobrança. Anunciar um plano sem `price_...` configurado levaria a pessoa a
  // um checkout que não existe.
  const vendidos: PlanoId[] = ORDEM_DOS_PLANOS.filter((p) => precoDoPlano(p) !== null);

  return (
    <div className="flex min-h-screen flex-col">
      <Medidor
        idioma={visitante.idioma}
        moeda={mercado.moeda}
        dispositivo={visitante.dispositivo}
      />
      <header className="sticky top-0 z-30 border-b border-border/70 bg-bg/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-4 px-6">
          <Marca marca={marca} />
          <nav className="hidden items-center gap-7 text-sm text-text-muted md:flex">
            <a className="transition-colors hover:text-text" href="#como-funciona">
              {t("Como funciona")}
            </a>
            <a className="transition-colors hover:text-text" href="#recursos">
              {t("Recursos")}
            </a>
            {vendidos.length > 0 ? (
              <a className="transition-colors hover:text-text" href="#planos">
                {t("Planos")}
              </a>
            ) : null}
            <a className="transition-colors hover:text-text" href="#perguntas">
              {t("Perguntas")}
            </a>
          </nav>
          <div className="flex items-center gap-2">
            <Link
              href="/login"
              className="hidden h-9 items-center rounded-sm px-3 text-sm font-medium text-text-muted transition-colors hover:text-text sm:inline-flex"
            >
              {t("Entrar")}
            </Link>
            <Link
              href="/signup"
              className="inline-flex h-9 items-center gap-1.5 rounded-sm bg-accent px-4 text-sm font-medium text-accent-foreground shadow-xs transition-colors hover:bg-accent-hover"
            >
              {t("Criar conta")}
              <ArrowRight className="size-4" />
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* ── Capa ─────────────────────────────────────────────────────── */}
        <section className="relative overflow-hidden">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 h-[560px]"
            style={{
              background:
                "radial-gradient(70% 60% at 72% 0%, var(--color-accent-100), transparent 70%)",
            }}
          />
          <div className="relative mx-auto grid w-full max-w-6xl items-center gap-14 px-6 pt-16 pb-20 lg:grid-cols-[1.05fr_1fr] lg:gap-16 lg:pt-24 lg:pb-28">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full border border-accent-200 bg-accent-soft px-3 py-1 text-xs font-medium text-accent-700">
                <Sparkles className="size-3.5" />
                {t("Atendimento por WhatsApp com agente de IA")}
              </span>
              <h1 className="mt-6 text-4xl leading-[1.05] font-semibold tracking-tight text-text sm:text-5xl lg:text-6xl">
                {t("Nunca mais perca um cliente por demora na resposta")}
              </h1>
              <p className="mt-6 max-w-xl text-lg leading-relaxed text-text-muted">
                {t(
                  "Todo o WhatsApp da sua empresa em uma tela só. Um atendente de IA responde na hora, com o que você ensinou, e passa a conversa para uma pessoa do time quando o assunto pede.",
                )}
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Link
                  href="/signup"
                  className="inline-flex h-12 items-center gap-2 rounded-sm bg-accent px-6 text-sm font-medium text-accent-foreground shadow-sm transition-colors hover:bg-accent-hover"
                >
                  {`${t("Começar com")} ${DIAS_DE_TRIAL} ${t("dias grátis")}`}
                  <ArrowRight className="size-4" />
                </Link>
                <Link
                  href="/login"
                  className="inline-flex h-12 items-center rounded-sm border border-border bg-surface px-6 text-sm font-medium text-text transition-colors hover:border-accent hover:text-accent"
                >
                  {t("Já tenho conta")}
                </Link>
              </div>
              <ul className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-sm text-text-subtle">
                <ItemDeConfianca texto={t("Sem cartão para começar")} />
                <ItemDeConfianca texto={t("Você usa o número que já tem")} />
                <ItemDeConfianca texto={t("Cancele quando quiser")} />
              </ul>
            </div>

            <ConversaDeExemplo t={t} />
          </div>
        </section>

        {/* ── O problema ───────────────────────────────────────────────── */}
        <section className="border-y border-border bg-surface-elevated">
          <div className="mx-auto w-full max-w-6xl px-6 py-16 lg:py-20">
            <h2 className="max-w-2xl text-2xl font-semibold tracking-tight text-text sm:text-3xl">
              {t("A venda raramente se perde no preço. Ela se perde no silêncio.")}
            </h2>
            <div className="mt-10 grid gap-6 md:grid-cols-3">
              <Dor
                titulo={t("A resposta demora")}
                texto={t(
                  "Quem pergunta às 22h só é atendido no dia seguinte. Até lá, já comprou de quem respondeu primeiro.",
                )}
              />
              <Dor
                titulo={t("A conversa se perde")}
                texto={t(
                  "Cada pessoa do time guarda um pedaço da história no próprio celular. Ninguém sabe o que já foi combinado.",
                )}
              />
              <Dor
                titulo={t("O retorno nunca acontece")}
                texto={t(
                  "O cliente disse “depois eu vejo” e ninguém voltou nele. É a venda mais barata da empresa, e ela evapora.",
                )}
              />
            </div>
          </div>
        </section>

        {/* ── Como funciona ────────────────────────────────────────────── */}
        <section id="como-funciona" className="scroll-mt-20">
          <div className="mx-auto w-full max-w-6xl px-6 py-20 lg:py-24">
            <Titulo
              olho={t("Como funciona")}
              titulo={t("Três passos, e o atendimento para de depender de memória")}
            />
            <div className="mt-12 grid gap-8 md:grid-cols-3">
              <Passo
                numero="1"
                Icone={QrCode}
                titulo={t("Conecte o seu WhatsApp")}
                texto={t(
                  "O mesmo número que a sua empresa já usa, por leitura de QR code. Ninguém troca de número e nenhuma conversa se perde.",
                )}
              />
              <Passo
                numero="2"
                Icone={Bot}
                titulo={t("Ensine o atendente")}
                texto={t(
                  "Escreva o que a empresa faz, preço, prazo e as regras. O agente responde a partir disso — e só disso.",
                )}
              />
              <Passo
                numero="3"
                Icone={SquareKanban}
                titulo={t("Acompanhe pelo funil")}
                texto={t(
                  "Cada conversa vira um card. Você vê quem está esperando, quem comprou e quem esfriou, sem perguntar a ninguém.",
                )}
              />
            </div>
          </div>
        </section>

        {/* ── Recursos ─────────────────────────────────────────────────── */}
        <section id="recursos" className="scroll-mt-20 border-y border-border bg-surface-elevated">
          <div className="mx-auto w-full max-w-6xl px-6 py-20 lg:py-24">
            <Titulo olho={t("Recursos")} titulo={t("O atendimento inteiro em um lugar só")} />
            <div className="mt-12 grid gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-2 lg:grid-cols-3">
              <Recurso
                Icone={Inbox}
                titulo={t("Uma caixa de entrada para o time todo")}
                texto={t(
                  "Todas as conversas em uma tela, com quem está atendendo o quê à vista de todos.",
                )}
              />
              <Recurso
                Icone={Bot}
                titulo={t("Agente de IA com a sua base de conhecimento")}
                texto={t(
                  "Ele responde pelo que você escreveu, não por achismo, e chama uma pessoa quando não sabe.",
                )}
              />
              <Recurso
                Icone={SquareKanban}
                titulo={t("Funil de vendas colado na conversa")}
                texto={t(
                  "Arraste o card, leia o histórico inteiro e pare de perguntar em que pé está cada cliente.",
                )}
              />
              <Recurso
                Icone={Clock}
                titulo={t("Retorno automático no tempo certo")}
                texto={t(
                  "Quem parou de responder recebe uma mensagem de volta sem que ninguém precise lembrar disso.",
                )}
              />
              <Recurso
                Icone={ChartColumn}
                titulo={t("Relatórios de atendimento")}
                texto={t(
                  "Tempo de resposta, volume por pessoa do time e o que de fato virou venda.",
                )}
              />
              <Recurso
                Icone={ShieldCheck}
                titulo={t("LGPD desde o primeiro dia")}
                texto={t(
                  "Dados isolados por empresa, registro de acesso e exclusão a pedido do titular.",
                )}
              />
            </div>
          </div>
        </section>

        {/* ── Planos ───────────────────────────────────────────────────── */}
        {vendidos.length > 0 ? (
          <section id="planos" className="scroll-mt-20">
            <div className="mx-auto w-full max-w-6xl px-6 py-20 lg:py-24">
              <Titulo
                olho={t("Planos")}
                titulo={t("Comece liberado. Escolha o plano depois.")}
                apoio={`${t("São")} ${DIAS_DE_TRIAL} ${t("dias com tudo funcionando, sem cartão. Você só escolhe um plano quando decidir ficar.")}`}
              />
              <div className="mt-12 grid gap-6 lg:grid-cols-3">
                {vendidos.map((id) => {
                  const plano = PLANOS[id];
                  const destaque = id === "pro";
                  return (
                    <div
                      key={id}
                      className={
                        destaque
                          ? "relative rounded-lg border-2 border-accent bg-surface p-6 shadow-lg"
                          : "relative rounded-lg border border-border bg-surface p-6 shadow-xs"
                      }
                    >
                      {destaque ? (
                        <span className="absolute -top-3 left-6 rounded-full bg-accent px-3 py-1 text-xs font-medium text-accent-foreground">
                          {t("Recomendado")}
                        </span>
                      ) : null}
                      <h3 className="text-sm font-semibold tracking-wide text-text-subtle uppercase">
                        {plano.nome}
                      </h3>
                      <p className="mt-3 flex items-baseline gap-1">
                        <span className="text-4xl font-semibold tracking-tight text-text">
                          {precoLegivelNoMercado(id, mercado)}
                        </span>
                        <span className="text-sm text-text-muted">{t("/mês")}</span>
                      </p>
                      <ul className="mt-6 space-y-3 text-sm text-text-muted">
                        {plano.destaques.map((d) => (
                          <li key={d} className="flex items-start gap-2">
                            <Check className="mt-0.5 size-4 shrink-0 text-accent" />
                            {/*
                              `t(d)` com identificador: o guarda de i18n só
                              enxerga chave LITERAL, então estas traduções são
                              obrigação manual — vivem no bloco de cobrança de
                              `lib/i18n/dicionario.ts`, ao lado das da tela de
                              planos, que renderiza as MESMAS frases.
                            */}
                            <span>{t(d)}</span>
                          </li>
                        ))}
                      </ul>
                      <Link
                        href="/signup"
                        className={
                          destaque
                            ? "mt-8 inline-flex h-11 w-full items-center justify-center rounded-sm bg-accent text-sm font-medium text-accent-foreground transition-colors hover:bg-accent-hover"
                            : "mt-8 inline-flex h-11 w-full items-center justify-center rounded-sm border border-border text-sm font-medium text-text transition-colors hover:border-accent hover:text-accent"
                        }
                      >
                        {t("Começar agora")}
                      </Link>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>
        ) : null}

        {/* ── Perguntas ────────────────────────────────────────────────── */}
        <section id="perguntas" className="scroll-mt-20 border-y border-border bg-surface-elevated">
          <div className="mx-auto w-full max-w-3xl px-6 py-20 lg:py-24">
            <Titulo olho={t("Perguntas")} titulo={t("O que costumam perguntar antes de assinar")} />
            <div className="mt-10 divide-y divide-border border-y border-border">
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
                  "Em base isolada por empresa, com registro de quem acessou o quê. Você pode exportar ou apagar os seus dados quando quiser.",
                )}
              />
            </div>
          </div>
        </section>

        {/* ── Chamada final ────────────────────────────────────────────── */}
        <section className="relative overflow-hidden">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "radial-gradient(60% 100% at 50% 100%, var(--color-accent-100), transparent 70%)",
            }}
          />
          <div className="relative mx-auto w-full max-w-3xl px-6 py-20 text-center lg:py-28">
            <h2 className="text-3xl font-semibold tracking-tight text-text sm:text-4xl">
              {t("A próxima pessoa que te chamar no WhatsApp merece resposta agora")}
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-lg text-text-muted">
              {t(
                "Crie a conta, conecte o número e veja o primeiro atendimento acontecer sozinho ainda hoje.",
              )}
            </p>
            <Link
              href="/signup"
              className="mt-8 inline-flex h-12 items-center gap-2 rounded-sm bg-accent px-7 text-sm font-medium text-accent-foreground shadow-sm transition-colors hover:bg-accent-hover"
            >
              {`${t("Começar com")} ${DIAS_DE_TRIAL} ${t("dias grátis")}`}
              <ArrowRight className="size-4" />
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-border bg-surface">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-10 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <Marca marca={marca} />
            <span className="text-sm text-text-subtle">
              {t("Atendimento e vendas por WhatsApp")}
            </span>
          </div>
          <nav className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-text-muted">
            <Link className="transition-colors hover:text-text" href="/legal/terms">
              {t("Termos de uso")}
            </Link>
            <Link className="transition-colors hover:text-text" href="/legal/privacy">
              {t("Política de Privacidade")}
            </Link>
            <Link className="transition-colors hover:text-text" href="/legal">
              {t("Documentos")}
            </Link>
            <Link className="transition-colors hover:text-text" href="/contato">
              {t("Fale com a gente")}
            </Link>
            {suporte ? (
              <a className="transition-colors hover:text-text" href={`mailto:${suporte}`}>
                {suporte}
              </a>
            ) : null}
            <Link className="transition-colors hover:text-text" href="/login">
              {t("Entrar")}
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}

/**
 * O nome — ou o logo — de quem OPERA esta instalação.
 *
 * Mesma pilha da fachada de acesso (`app/(public)/layout.tsx`): banco acima,
 * `.env` embaixo, nunca uma marca escrita no código. Um revendedor que hospeda
 * isto para os clientes dele precisa que a página de vendas seja a DELE.
 */
function Marca({ marca }: { marca: MarcaDeSaida }) {
  if (marca.logoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={marca.logoUrl}
        alt={marca.nome}
        className="h-8 w-auto max-w-[10rem] object-contain"
      />
    );
  }
  if (marcaEhADoProduto({ name: marca.nome, logoUrl: null })) {
    return <LogotipoDoProduto nome={marca.nome} className="h-7 w-auto" />;
  }
  // Marca de terceiro sem logo: se ela tem arte no registro de desenhos, o
  // símbolo entra ao lado do nome. Sem arte, segue só o nome — que é o que
  // todo revendedor já via, sem regressão.
  return (
    <span className="flex items-center gap-2">
      <SimboloDaMarca nome={marca.nome} className="size-7" decorativo />
      <span className="text-base font-semibold tracking-tight text-text">{marca.nome}</span>
    </span>
  );
}

function ItemDeConfianca({ texto }: { texto: string }) {
  return (
    <li className="flex items-center gap-1.5">
      <Check className="size-4 text-accent" />
      {texto}
    </li>
  );
}

function Titulo({ olho, titulo, apoio }: { olho: string; titulo: string; apoio?: string }) {
  return (
    <div className="max-w-2xl">
      <span className="text-xs font-semibold tracking-[0.12em] text-accent uppercase">{olho}</span>
      <h2 className="mt-3 text-2xl font-semibold tracking-tight text-text sm:text-3xl">{titulo}</h2>
      {apoio ? <p className="mt-3 text-base text-text-muted">{apoio}</p> : null}
    </div>
  );
}

function Dor({ titulo, texto }: { titulo: string; texto: string }) {
  return (
    <div className="rounded-lg border border-border bg-surface p-6 shadow-xs">
      <h3 className="text-base font-semibold text-text">{titulo}</h3>
      <p className="mt-2 text-sm leading-relaxed text-text-muted">{texto}</p>
    </div>
  );
}

function Passo({
  numero,
  Icone,
  titulo,
  texto,
}: {
  numero: string;
  Icone: React.ComponentType<{ className?: string }>;
  titulo: string;
  texto: string;
}) {
  return (
    <div>
      <div className="flex items-center gap-3">
        <span className="flex size-10 items-center justify-center rounded-full bg-accent-soft text-accent">
          <Icone className="size-5" />
        </span>
        <span className="font-mono text-sm text-text-subtle">{numero}</span>
      </div>
      <h3 className="mt-4 text-lg font-semibold text-text">{titulo}</h3>
      <p className="mt-2 text-sm leading-relaxed text-text-muted">{texto}</p>
    </div>
  );
}

function Recurso({
  Icone,
  titulo,
  texto,
}: {
  Icone: React.ComponentType<{ className?: string }>;
  titulo: string;
  texto: string;
}) {
  return (
    <div className="bg-surface p-6">
      <Icone className="size-5 text-accent" />
      <h3 className="mt-4 text-base font-semibold text-text">{titulo}</h3>
      <p className="mt-2 text-sm leading-relaxed text-text-muted">{texto}</p>
    </div>
  );
}

function Pergunta({ pergunta, resposta }: { pergunta: string; resposta: string }) {
  return (
    <div className="py-5">
      <h3 className="text-base font-semibold text-text">{pergunta}</h3>
      <p className="mt-2 text-sm leading-relaxed text-text-muted">{resposta}</p>
    </div>
  );
}

/**
 * A demonstração do produto em quatro balões.
 *
 * É desenho, não captura de tela: uma imagem envelheceria na primeira mudança
 * de interface e pesaria no carregamento da primeira tela que a pessoa vê. O
 * que ela precisa entender em três segundos é o que este produto faz de
 * diferente — responder na hora e virar um card no funil —, e isso cabe em
 * quatro balões e uma faixa.
 */
function ConversaDeExemplo({ t }: { t: (texto: string) => string }) {
  return (
    <div className="relative">
      <div aria-hidden className="absolute -inset-4 rounded-xl bg-accent-100/40 blur-2xl" />
      <div className="relative overflow-hidden rounded-xl border border-border bg-surface shadow-xl">
        <div className="flex items-center gap-3 border-b border-border bg-surface-elevated px-5 py-3.5">
          <span className="flex size-9 items-center justify-center rounded-full bg-accent-soft text-sm font-semibold text-accent-700">
            M
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-text">Mariana</p>
            <p className="truncate text-xs text-text-subtle">{t("Novo contato · 22h14")}</p>
          </div>
          <span className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-success-bg px-2.5 py-1 text-xs font-medium text-success-fg">
            <Bot className="size-3.5" />
            {t("IA atendendo")}
          </span>
        </div>

        <div className="space-y-3 px-5 py-6">
          <Balao lado="cliente" texto={t("Oi! Vocês entregam hoje ainda?")} hora="22:14" />
          <Balao
            lado="agente"
            texto={t(
              "Oi, Mariana! Entregamos sim. Pedidos fechados até as 23h saem amanhã cedo. Me diz o seu bairro que eu confirmo o prazo.",
            )}
            hora="22:14"
          />
          <Balao lado="cliente" texto={t("Sou do centro")} hora="22:15" />
          <Balao
            lado="agente"
            texto={t("No centro chega em até 2 horas. Quer que eu já reserve para você?")}
            hora="22:15"
          />
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-border bg-surface-elevated px-5 py-3.5 text-xs text-text-muted">
          <span className="inline-flex items-center gap-1.5">
            <SquareKanban className="size-3.5 text-accent" />
            {t("Card criado no funil")}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Clock className="size-3.5 text-accent" />
            {t("Respondido na hora")}
          </span>
        </div>
      </div>
    </div>
  );
}

function Balao({ lado, texto, hora }: { lado: "cliente" | "agente"; texto: string; hora: string }) {
  const doAgente = lado === "agente";
  return (
    <div className={doAgente ? "flex justify-end" : "flex justify-start"}>
      <div
        className={
          doAgente
            ? "max-w-[85%] rounded-lg rounded-br-sm bg-accent px-3.5 py-2.5 text-sm leading-relaxed text-accent-foreground shadow-xs"
            : "max-w-[85%] rounded-lg rounded-bl-sm bg-surface-elevated px-3.5 py-2.5 text-sm leading-relaxed text-text shadow-xs"
        }
      >
        {texto}
        <span
          className={
            doAgente
              ? "mt-1 block text-right font-mono text-[10px] opacity-70"
              : "mt-1 block text-right font-mono text-[10px] text-text-subtle"
          }
        >
          {hora}
        </span>
      </div>
    </div>
  );
}
