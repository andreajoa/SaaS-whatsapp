/**
 * O catálogo de planos e o interruptor que decide se esta instalação COBRA.
 *
 * ─── A regra que protege o self-host ───────────────────────────────────────
 *
 * Este produto é open source e a doutrina dele diz, em `CLAUDE.md`:
 * *"Monetização = self-host em VPS, não assinatura"*. Quem clona e instala numa
 * VPS não tem Stripe, não tem plano e não deve ver cobrança em lugar nenhum.
 *
 * Então a cobrança é uma CAPACIDADE DA INSTALAÇÃO, não uma regra do produto:
 * sem `STRIPE_SECRET_KEY`, `instalacaoCobra()` devolve `false` e absolutamente
 * nada de billing acontece — nem gate, nem consulta, nem botão. É o mesmo
 * padrão de `instalacaoOfereceVoz()` (WaCalls), e é o que permite o MESMO
 * código servir o SaaS hospedado e o clone de VPS sem uma linha de diferença.
 *
 * Ligar a cobrança em cima de um clone que já rodava é o modo de falha caro
 * aqui, e ele não é hipotético: o gate vive em `app/app/layout.tsx`, que roda
 * em TODA tela. Uma condição errada tranca a instalação inteira.
 */

/**
 * Os planos vendidos. Pareado com o CHECK de `org_subscriptions.plan`
 * (tests/invariants/vocabulario-banco-x-typescript.test.ts).
 */
export type PlanoId = "essencial" | "pro" | "ilimitado";

/**
 * Os MESMOS nomes de `subscription.status` do Stripe. Pareado com o CHECK de
 * `org_subscriptions.status`. Ver o comentário da migration 0239 sobre por que
 * não traduzimos.
 */
export type StatusAssinatura =
  | "trialing"
  | "active"
  | "past_due"
  | "canceled"
  | "incomplete"
  | "incomplete_expired"
  | "unpaid"
  | "paused";

/**
 * O que um plano É: nome, tetos e o que ele promete.
 *
 * O PREÇO não está aqui, e a ausência é deliberada. Ele depende do mercado de
 * quem lê — `lib/mercado/paises.ts` tem uma linha por país, com moeda, `locale`
 * e a régua de três degraus — e um `precoMensalCents: 9700` fixo neste arquivo
 * seria uma SEGUNDA fonte da verdade sobre o preço brasileiro. Ele já foi isso:
 * a tabela de mercados dizia R$ 197 enquanto esta linha dizia R$ 97, e as duas
 * telas que mostram preço mostrariam números diferentes conforme o import.
 *
 * Quem quer preço chama `precoLegivelNoMercado(id, mercado)`.
 */
export interface Plano {
  id: PlanoId;
  nome: string;
  /** `null` = sem teto. */
  canais: number | null;
  membros: number | null;
  /** Frases curtas para o cartão da tela. */
  destaques: string[];
}

export const PLANOS: Record<PlanoId, Plano> = {
  essencial: {
    id: "essencial",
    nome: "Essencial",
    canais: 1,
    membros: 3,
    destaques: [
      "1 número de WhatsApp",
      "Até 3 pessoas no time",
      "Atendente de IA com a sua base de conhecimento",
      "Funil, contatos e histórico completos",
    ],
  },
  pro: {
    id: "pro",
    nome: "Pro",
    canais: 3,
    membros: 10,
    destaques: [
      "Até 3 números de WhatsApp",
      "Até 10 pessoas no time",
      "Follow-up automático e campanhas",
      "Relatórios e metas de atendimento",
    ],
  },
  ilimitado: {
    id: "ilimitado",
    nome: "Ilimitado",
    canais: null,
    membros: null,
    destaques: [
      "Números de WhatsApp sem limite",
      "Time sem limite",
      "API e webhooks liberados",
      "Suporte prioritário",
    ],
  },
};

export const ORDEM_DOS_PLANOS: PlanoId[] = ["essencial", "pro", "ilimitado"];

export function ehPlanoConhecido(valor: string): valor is PlanoId {
  return valor === "essencial" || valor === "pro" || valor === "ilimitado";
}

/**
 * Dias de avaliação SEM COBRANÇA, contados de quando o cartão entra.
 *
 * ─── Mudou de significado em 2026-09-24, e a diferença é toda ──────────────
 *
 * Eram 14 dias contados de `organizations.created_at`, sem cartão nenhum: a
 * ausência de linha em `org_subscriptions` ERA o trial. Duas coisas estavam
 * erradas nisso, e a segunda é a cara:
 *
 *  1. O relógio corria durante o nosso próprio onboarding. Quem levava três
 *     dias para parear o WhatsApp chegava ao produto com 11 — pagando, em
 *     tempo de avaliação, pela fricção que é nossa.
 *  2. A conversão dependia de um ato que ninguém faz: no fim do trial a pessoa
 *     tinha de LEMBRAR de voltar e digitar um cartão. Trial que exige ação
 *     para virar assinatura converte uma fração do que converte o que renova
 *     sozinho.
 *
 * Agora o cartão entra ANTES e o trial é o do Stripe (`trial_period_days`):
 * sete dias sem cobrança nenhuma, e no sétimo o Stripe cobra sozinho e segue
 * mensal até alguém cancelar. O onboarding inteiro continua aberto sem cartão
 * — o gate de `app/app/layout.tsx` roda DEPOIS do gate de onboarding, de
 * propósito, para que a pessoa configure o agente antes de ver preço.
 *
 * ⚠️ A PROMESSA NA TELA É "7 DIAS SEM COBRANÇA", NUNCA "SEM CARTÃO".
 * Há cartão, e dizer o contrário é a letra miúda que este produto existe para
 * não ter. Perto de todo botão que leva ao checkout tem de estar escrito que
 * pede cartão e que renova sozinho no sétimo dia — nos documentos legais
 * também, mas não SÓ neles: promessa que depende do contrato para ser
 * verdadeira já é propaganda enganosa na tela.
 *
 * Constante e não env: um número de trial diferente por instalação não tem
 * quem o leia (o self-host não cobra), e um knob sem leitor é superfície que
 * envelhece.
 */
export const DIAS_DE_TRIAL = 7;

/**
 * Esta instalação cobra assinatura?
 *
 * Lê `process.env` direto, e não `env` de `lib/env.ts`, por um motivo estreito:
 * este módulo é importado por componente de servidor que roda em TODA tela, e
 * `lib/env.ts` já é importado ali de qualquer forma — mas a pergunta aqui é
 * "existe chave?", não "a chave é válida". Uma chave malformada deve falhar na
 * CHAMADA ao Stripe, alto, e não desligar a cobrança em silêncio.
 */
export function instalacaoCobra(): boolean {
  return (process.env.STRIPE_SECRET_KEY ?? "").trim().length > 0;
}

/**
 * O `price` do Stripe correspondente a um plano, ou `null` quando o operador
 * não configurou aquele plano nesta instalação.
 *
 * Plano sem preço configurado NÃO é erro — é um plano que esta instalação não
 * vende. A tela simplesmente não o oferece. Lançar aqui derrubaria a tela
 * inteira por causa de um plano que ninguém pediu.
 */
export function precoDoPlano(plano: PlanoId): string | null {
  const porPlano: Record<PlanoId, string | undefined> = {
    essencial: process.env.STRIPE_PRICE_ESSENCIAL,
    pro: process.env.STRIPE_PRICE_PRO,
    ilimitado: process.env.STRIPE_PRICE_ILIMITADO,
  };
  const valor = (porPlano[plano] ?? "").trim();
  return valor.length > 0 ? valor : null;
}

/** O caminho inverso: de `price_...` de volta ao plano, para o webhook. */
export function planoDoPreco(priceId: string): PlanoId | null {
  for (const id of ORDEM_DOS_PLANOS) {
    if (precoDoPlano(id) === priceId) return id;
  }
  return null;
}

