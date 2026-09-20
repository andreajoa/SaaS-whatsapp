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

export interface Plano {
  id: PlanoId;
  nome: string;
  /** Preço mensal em centavos (doutrina: dinheiro é `_cents` + ISO-4217). */
  precoMensalCents: number;
  moeda: "BRL";
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
    precoMensalCents: 9700,
    moeda: "BRL",
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
    precoMensalCents: 29700,
    moeda: "BRL",
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
    precoMensalCents: 69700,
    moeda: "BRL",
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
 * Dias de avaliação antes de a cobrança valer, contados de
 * `organizations.created_at`.
 *
 * Constante e não env: um número de trial diferente por instalação não tem
 * quem o leia (o self-host não cobra), e um knob sem leitor é superfície que
 * envelhece.
 */
export const DIAS_DE_TRIAL = 14;

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

/** Formata centavos em BRL para a tela. */
export function precoLegivel(plano: Plano): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: plano.moeda,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(plano.precoMensalCents / 100);
}
