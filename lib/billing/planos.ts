import { MERCADO_PADRAO, TODAS_MOEDAS, type Mercado, type Moeda } from "@/lib/mercado/paises";

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

export interface PrecoResolvido {
  priceId: string;
  moedaCobrada: Moeda;
}

/**
 * Catálogo oficial de `price_...` live da conta Stripe da Atenza por moeda,
 * pareado com os produtos `prod_VIREXEWiksyLQA` (Essencial),
 * `prod_VIREzGfcd9f5SP` (Pro) e `prod_VIREiSir4VQ6FV` (Ilimitado).
 *
 * Só entra em vigor quando a instalação está usando os `STRIPE_PRICE_*` live
 * oficiais da Atenza — qualquer self-host ou operador com conta Stripe própria
 * usa seus próprios `STRIPE_PRICE_*` / `STRIPE_PRICES_POR_MOEDA`.
 */
export const PRECOS_LIVE_ATENZA_BRL: Readonly<Record<PlanoId, string>> = {
  essencial: "price_1UHqM8G3HxcyUpFWDj4Wv7pW",
  pro: "price_1UHqM9G3HxcyUpFWgj7aIi7x",
  ilimitado: "price_1UHqMBG3HxcyUpFWH3Aa7k1a",
};

export const PRECOS_LIVE_ATENZA_POR_MOEDA: Readonly<
  Partial<Record<Exclude<Moeda, "BRL">, Readonly<Record<PlanoId, string>>>>
> = {
  USD: {
    essencial: "price_1UefeJG3HxcyUpFWIEP5SVP6",
    pro: "price_1UefeLG3HxcyUpFWiUtqycxN",
    ilimitado: "price_1UefePG3HxcyUpFWEhGzwLC2",
  },
  GBP: {
    essencial: "price_1Ueff0G3HxcyUpFWlMKc89wG",
    pro: "price_1Ueff6G3HxcyUpFWsAqHXjiI",
    ilimitado: "price_1Ueff7G3HxcyUpFWPAjEPazh",
  },
  EUR: {
    essencial: "price_1Ueff7G3HxcyUpFWpvurfBkp",
    pro: "price_1Ueff8G3HxcyUpFWcULABxPu",
    ilimitado: "price_1Ueff9G3HxcyUpFWnLOTQqPg",
  },
  MXN: {
    essencial: "price_1Ueff9G3HxcyUpFWi07g1Nin",
    pro: "price_1UeffAG3HxcyUpFWq02OgxEL",
    ilimitado: "price_1UeffBG3HxcyUpFWiF3TieX2",
  },
  COP: {
    essencial: "price_1UeffBG3HxcyUpFWb9Xh3NUo",
    pro: "price_1UeffCG3HxcyUpFWab3kKBeL",
    ilimitado: "price_1UeffCG3HxcyUpFWgXc3Ukbf",
  },
  CLP: {
    essencial: "price_1UeffDG3HxcyUpFWCTSL09Gv",
    pro: "price_1UeffEG3HxcyUpFWCMmzSrle",
    ilimitado: "price_1UeffEG3HxcyUpFWbMNDA5B9",
  },
  PEN: {
    essencial: "price_1UeffFG3HxcyUpFWi7piB598",
    pro: "price_1UeffFG3HxcyUpFWShcmu8vI",
    ilimitado: "price_1UeffGG3HxcyUpFWo4CLpZXN",
  },
  INR: {
    essencial: "price_1UeffHG3HxcyUpFWjPGRqS0c",
    pro: "price_1UeffHG3HxcyUpFWXoRU0LlC",
    ilimitado: "price_1UeffIG3HxcyUpFWqmbjNTBU",
  },
  IDR: {
    essencial: "price_1UeffJG3HxcyUpFWag0kAgoD",
    pro: "price_1UeffJG3HxcyUpFW3CF2y7x9",
    ilimitado: "price_1UeffKG3HxcyUpFWdoy8zt7g",
  },
  MYR: {
    essencial: "price_1UeffKG3HxcyUpFWAdA3Qvyo",
    pro: "price_1UeffLG3HxcyUpFWXb4cnhOZ",
    ilimitado: "price_1UeffLG3HxcyUpFWYgRT9yOZ",
  },
  ZAR: {
    essencial: "price_1UeffMG3HxcyUpFWn4UZWxoB",
    pro: "price_1UeffNG3HxcyUpFWzMwlEDZD",
    ilimitado: "price_1UeffNG3HxcyUpFWwPqcFux0",
  },
};

function lerMapaDePrecosJson(): Record<string, Partial<Record<PlanoId, string>>> | null {
  const bruto = (process.env.STRIPE_PRICES_POR_MOEDA ?? "").trim();
  if (!bruto) return null;
  try {
    const parsed = JSON.parse(bruto) as unknown;
    return typeof parsed === "object" && parsed !== null
      ? (parsed as Record<string, Partial<Record<PlanoId, string>>>)
      : null;
  } catch {
    return null;
  }
}

export function usaCatalogoLiveAtenza(plano?: PlanoId): boolean {
  if (plano) {
    const sufixo = plano.toUpperCase();
    return (process.env[`STRIPE_PRICE_${sufixo}`] ?? "").trim() === PRECOS_LIVE_ATENZA_BRL[plano];
  }
  return ORDEM_DOS_PLANOS.some(
    (p) => (process.env[`STRIPE_PRICE_${p.toUpperCase()}`] ?? "").trim() === PRECOS_LIVE_ATENZA_BRL[p],
  );
}

/**
 * O `price` do Stripe correspondente a um plano e moeda (opcional), ou `null`
 * quando o operador não configurou aquele plano nesta instalação.
 *
 * Multi-moeda: quando `moeda` é diferente de `BRL`, procura:
 *  1. `STRIPE_PRICE_<PLANO>_<MOEDA>` no ambiente;
 *  2. `STRIPE_PRICES_POR_MOEDA` (JSON compacto `{ "USD": { "pro": "price_..." } }`);
 *  3. `PRECOS_LIVE_ATENZA_POR_MOEDA` quando a instalação usa o catálogo live oficial da Atenza;
 *  4. fallback para `STRIPE_PRICE_<PLANO>` padrão (BRL).
 */
export function precoResolvidoDoPlano(plano: PlanoId, moeda: Moeda = "BRL"): PrecoResolvido | null {
  const sufixoPlano = plano.toUpperCase();
  if (moeda !== "BRL") {
    const porMoeda = (process.env[`STRIPE_PRICE_${sufixoPlano}_${moeda}`] ?? "").trim();
    if (porMoeda.length > 0) {
      return { priceId: porMoeda, moedaCobrada: moeda };
    }
    const doJson = lerMapaDePrecosJson()?.[moeda]?.[plano]?.trim();
    if (doJson) {
      return { priceId: doJson, moedaCobrada: moeda };
    }
    if (usaCatalogoLiveAtenza(plano)) {
      const oficial = PRECOS_LIVE_ATENZA_POR_MOEDA[moeda]?.[plano];
      if (oficial) {
        return { priceId: oficial, moedaCobrada: moeda };
      }
    }
  }
  const padrao = (process.env[`STRIPE_PRICE_${sufixoPlano}`] ?? "").trim();
  if (padrao.length > 0) {
    return { priceId: padrao, moedaCobrada: "BRL" };
  }
  return null;
}

export function precoDoPlano(plano: PlanoId, moeda?: Moeda): string | null {
  return precoResolvidoDoPlano(plano, moeda ?? "BRL")?.priceId ?? null;
}

/**
 * Mercado efetivo para exibição dos planos na tela de assinatura: só mostra
 * valores na moeda local da organização quando os preços Stripe dessa moeda
 * existem de fato; caso contrário cai no mercado padrão (BRL) para que o valor
 * exibido nunca discorde do cobrado no iframe do Stripe.
 */
export function mercadoCobradoParaPlanos(
  mercado: Mercado,
  planos: readonly PlanoId[] = ORDEM_DOS_PLANOS,
): Mercado {
  if (mercado.moeda === "BRL" || planos.length === 0) return mercado;
  const todosNaMoedaLocal = planos.every(
    (p) => precoResolvidoDoPlano(p, mercado.moeda)?.moedaCobrada === mercado.moeda,
  );
  return todosNaMoedaLocal ? mercado : MERCADO_PADRAO;
}

/** O caminho inverso: de `price_...` de volta ao plano, cobrindo todas as moedas. */
export function planoDoPreco(priceId: string): PlanoId | null {
  const alvo = priceId.trim();
  if (!alvo) return null;
  const mapaJson = lerMapaDePrecosJson();
  for (const id of ORDEM_DOS_PLANOS) {
    const sufixoPlano = id.toUpperCase();
    if ((process.env[`STRIPE_PRICE_${sufixoPlano}`] ?? "").trim() === alvo) return id;
    if (PRECOS_LIVE_ATENZA_BRL[id] === alvo) return id;
    for (const moeda of TODAS_MOEDAS) {
      if (moeda === "BRL") continue;
      if ((process.env[`STRIPE_PRICE_${sufixoPlano}_${moeda}`] ?? "").trim() === alvo) return id;
      if (mapaJson?.[moeda]?.[id]?.trim() === alvo) return id;
      if (PRECOS_LIVE_ATENZA_POR_MOEDA[moeda]?.[id] === alvo) return id;
    }
  }
  return null;
}

