/**
 * OS MERCADOS: de que país veio, em que idioma falamos com ele, em que moeda
 * cobramos e quanto.
 *
 * ─── Por que a tabela existe ────────────────────────────────────────────────
 *
 * O produto é vendido onde o WhatsApp é o canal de venda, e isso não é o
 * Brasil sozinho: Argentina 97%, Colômbia 96%, Chile 94%, Malásia 94%, Espanha
 * 93%, Peru 92%, Itália 91%, México ~90%, Brasil 85-93%. Mostrar `R$ 197` a um
 * mexicano é pedir a ele que faça a conta e confie no resultado — e o abandono
 * de checkout por moeda estranha é medido em dois dígitos.
 *
 * ─── O que foi MEDIDO, e por que isto contraria a pesquisa ──────────────────
 *
 * A conta Stripe desta instalação é BRASILEIRA (`country: BR`,
 * `default_currency: brl`), e a leitura corrente do mercado diz que Stripe "não
 * atende" Colômbia, Chile, Peru e Argentina. Isso é verdade para ABRIR conta
 * nesses países e FALSO para COBRAR deles. Medido em 2026-09-20 nesta conta,
 * com `PaymentIntent` real criado e cancelado em seguida, uma moeda por vez:
 *
 *   brl usd mxn eur cop clp pen ars inr idr myr zar ngn gbp → todas ACEITAS.
 *
 * A única recusa foi `cop` com valor de teste pequeno demais ("Amount must
 * convert to at least 50 centavo"), que é limite de VALOR e não de moeda — com
 * o preço real ela passa. O comando que mede está em
 * `scripts/stripe-moedas.mjs`; refaça em vez de acreditar nesta lista.
 *
 * ─── O que isto NÃO resolve ─────────────────────────────────────────────────
 *
 * Duas coisas, e as duas são reais:
 *
 *  1. **Meio de pagamento local não acompanha a moeda.** Uma conta brasileira
 *     oferece cartão e boleto; ela NÃO oferece OXXO no México nem SEPA na
 *     Europa, porque método local é atrelado ao país da CONTA, não ao do
 *     cliente. No México isso deixa de fora ~30% das transações do país. A
 *     moeda local já é a maior parte do ganho; o método local exige entidade
 *     legal lá, e isso é outra decisão.
 *  2. **Liquidação é em BRL, com conversão.** Todo recebimento fora do BRL
 *     paga FX da Stripe. Os preços abaixo já nascem com essa margem embutida —
 *     não são a conversão do preço brasileiro pela cotação do dia.
 *
 * ─── Por que o preço NÃO é conversão de câmbio ──────────────────────────────
 *
 * Porque o concorrente de cada país não cobra em reais convertidos, e é contra
 * ele que o comprador compara. O piso de cada linha é o que o mercado local já
 * paga hoje, medido: Poli R$ 849,90 e Huggy R$ 989 no Brasil; Leadsales US$ 84
 * e Callbell US$ 15/agente no México; Wati ₹ 2.199 e Interakt ₹ 999 na Índia;
 * Qontak Rp 750.000 na Indonésia; Trengo € 349 e Callbell € 14/agente na
 * Europa. Converter o preço brasileiro produziria, em quase todo destino, um
 * número abaixo do mais barato da praça — que não é agressivo, é suspeito.
 *
 * ─── O ladrilho de idiomas ──────────────────────────────────────────────────
 *
 * O produto fala pt-BR e es (`lib/i18n/idiomas.ts`), e o SITE público ganha en
 * como terceira coluna. Não existe linha aqui para país cujo idioma não
 * servimos com tradução humana: Indonésia e Índia recebem o site em INGLÊS, de
 * propósito, porque um site traduzido por máquina em bahasa é pior do que um
 * site em inglês — e o comprador dos dois mercados lê inglês de trabalho.
 * Prometer o que não se entrega é o modo de falha caro aqui.
 */

import { MESES_PAGOS_NO_ANUAL, type PlanoId } from "@/lib/billing/planos";
import { IDIOMA_PADRAO, type Idioma } from "@/lib/i18n/idiomas";

/**
 * Os idiomas do SITE público — superconjunto dos do produto.
 *
 * `IDIOMAS` (o do produto) não ganha `en` de propósito: o guarda de i18n
 * (`tests/unit/i18n-espanhol-cobre-a-tela.test.ts`) cobra coluna para TODO
 * idioma servido, e isso passaria a exigir inglês nas ~2.000 strings de tela
 * do app. A página de vendas tem uma ordem de grandeza menos texto, e é ela
 * que um estrangeiro vê antes de decidir.
 */
export const IDIOMAS_DO_SITE = ["pt-BR", "es", "en"] as const;
export type IdiomaDoSite = (typeof IDIOMAS_DO_SITE)[number];

export function ehIdiomaDoSite(valor: string): valor is IdiomaDoSite {
  return (IDIOMAS_DO_SITE as readonly string[]).includes(valor);
}

/** ISO-4217 em maiúsculas, como a doutrina de API exige. */
export type Moeda =
  "BRL" | "USD" | "MXN" | "EUR" | "COP" | "CLP" | "PEN" | "ARS" | "INR" | "IDR" | "MYR" | "ZAR";

/**
 * Moedas sem centavos NO STRIPE: o `unit_amount` é a unidade inteira.
 *
 * Errar isto não dá erro — dá cobrança 100× maior ou 100× menor, aceita em
 * silêncio. CLP é a única da nossa lista; COP e IDR PARECEM não ter centavos
 * no uso diário e têm duas casas no Stripe, que é exatamente onde a intuição
 * erra.
 */
export const MOEDAS_SEM_CENTAVOS: ReadonlySet<Moeda> = new Set<Moeda>(["CLP"]);

export interface Mercado {
  /** ISO-3166-1 alfa-2, como o cabeçalho de geolocalização da borda entrega. */
  readonly pais: string;
  readonly nome: string;
  readonly moeda: Moeda;
  readonly idioma: IdiomaDoSite;
  /**
   * Preço mensal por plano, na unidade MENOR da moeda (`unit_amount` do
   * Stripe). Em CLP é o peso inteiro — ver `MOEDAS_SEM_CENTAVOS`.
   */
  readonly precos: Readonly<Record<PlanoId, number>>;
  /** O `locale` do `Intl.NumberFormat`. Separador e posição do símbolo são dele. */
  readonly locale: string;
}

/**
 * A régua de preço, em três degraus e uma razão fixa (≈ 1 : 2 : 4, a do Brasil).
 *
 * Revisada em 11/10/2026 contra o que o concorrente local cobra:
 * - México: Leadsales MXN 2.363 / 3.240 / 6.017; Kommo US$ 15–45 POR USUÁRIO.
 *   A Atenza fica abaixo do Leadsales e não parece "barata demais".
 * - Colômbia: ferramentas locais a partir de COP 350.000; Treble (CO) US$ 399+.
 * - Chile e Peru: mesmo patamar em moeda local. Argentina em dólar (abaixo).
 * - Europa: Superchat € 79 / 129 / 249 (3 / 10 / 25 pessoas), Spoki € 19–49,
 *   Callbell € 15–20 por usuário. A Atenza: € 49 / 99 / 199, com a IA paga
 *   pelo cliente.
 *
 * A razão é a mesma em todo mercado de propósito: um cliente que compara duas
 * páginas em idiomas diferentes — e eles comparam — vê a MESMA oferta, não uma
 * negociação. O que muda entre linhas é o nível, não a forma.
 */
export const MERCADOS: readonly Mercado[] = [
  {
    // 07/10/2026: R$ 97 / 197 / 397. A IA e os fornecedores de canal passaram a ser
    // pagas pelo CLIENTE (chave própria), então o Atenza não embute custo
    // variável e pode ficar abaixo de quem embute (BotConversa R$ 189 sem IA de
    // verdade; Wati/Respond.io US$ 79+). Estes valores TÊM de bater com os
    // `price_` do Stripe em STRIPE_PRICE_* — até esta data a tela dizia
    // 197/497/997 e o Stripe cobrava 97/297/697.
    pais: "BR",
    nome: "Brasil",
    moeda: "BRL",
    idioma: "pt-BR",
    locale: "pt-BR",
    precos: { essencial: 9700, pro: 19700, ilimitado: 39700 },
  },
  {
    pais: "PT",
    nome: "Portugal",
    moeda: "EUR",
    idioma: "pt-BR",
    locale: "pt-PT",
    precos: { essencial: 4900, pro: 9900, ilimitado: 19900 },
  },
  {
    // Segunda praça a abrir, e não a Índia: a tarifa da Meta aqui é 2× menor
    // que a brasileira (US$ 0,0305) e o concorrente cobra US$ 84.
    pais: "MX",
    nome: "México",
    moeda: "MXN",
    idioma: "es",
    locale: "es-MX",
    precos: { essencial: 69900, pro: 139900, ilimitado: 279900 },
  },
  {
    // A melhor razão preço/tarifa da América Latina: a Meta cobra US$ 0,0125
    // por conversa de marketing, um QUINTO do Brasil.
    pais: "CO",
    nome: "Colômbia",
    moeda: "COP",
    idioma: "es",
    locale: "es-CO",
    precos: { essencial: 11900000, pro: 23900000, ilimitado: 47900000 },
  },
  {
    // Zero-decimal no Stripe: estes são pesos inteiros, não centavos.
    pais: "CL",
    nome: "Chile",
    moeda: "CLP",
    idioma: "es",
    locale: "es-CL",
    precos: { essencial: 34900, pro: 69900, ilimitado: 139900 },
  },
  {
    pais: "PE",
    nome: "Peru",
    moeda: "PEN",
    idioma: "es",
    locale: "es-PE",
    precos: { essencial: 10900, pro: 21900, ilimitado: 43900 },
  },
  {
    // Em DÓLAR, e é a única linha da América Latina que não usa a moeda do
    // país. Uma tabela de preços em pesos argentinos envelhece dentro do mês —
    // e um reajuste mensal de tabela é pior sinal ao comprador do que um preço
    // em dólar, que ele já está habituado a ver em software.
    pais: "AR",
    nome: "Argentina",
    moeda: "USD",
    idioma: "es",
    locale: "es-AR",
    precos: { essencial: 2900, pro: 5900, ilimitado: 11900 },
  },
  {
    pais: "ES",
    nome: "Espanha",
    moeda: "EUR",
    idioma: "es",
    locale: "es-ES",
    precos: { essencial: 4900, pro: 9900, ilimitado: 19900 },
  },
  {
    pais: "DE",
    nome: "Alemanha",
    moeda: "EUR",
    idioma: "en",
    locale: "de-DE",
    precos: { essencial: 4900, pro: 9900, ilimitado: 19900 },
  },
  {
    pais: "IT",
    nome: "Itália",
    moeda: "EUR",
    idioma: "en",
    locale: "it-IT",
    precos: { essencial: 4900, pro: 9900, ilimitado: 19900 },
  },
  {
    // Em inglês de propósito — ver o cabeçalho. O gargalo aqui não é preço, é
    // meio de pagamento: cartão internacional é minoria, e UPI não sai de uma
    // conta brasileira.
    pais: "IN",
    nome: "Índia",
    moeda: "INR",
    idioma: "en",
    locale: "en-IN",
    precos: { essencial: 149900, pro: 399900, ilimitado: 799900 },
  },
  {
    pais: "ID",
    nome: "Indonésia",
    moeda: "IDR",
    idioma: "en",
    locale: "en-ID",
    precos: { essencial: 39900000, pro: 99900000, ilimitado: 199900000 },
  },
  {
    pais: "MY",
    nome: "Malásia",
    moeda: "MYR",
    idioma: "en",
    locale: "en-MY",
    precos: { essencial: 19900, pro: 49900, ilimitado: 99900 },
  },
  {
    pais: "ZA",
    nome: "África do Sul",
    moeda: "ZAR",
    idioma: "en",
    locale: "en-ZA",
    precos: { essencial: 69900, pro: 179900, ilimitado: 349900 },
  },
];

/**
 * O que serve quem não está na tabela: dólar e inglês.
 *
 * NÃO é o Brasil. Um visitante da Alemanha vendo `R$` conclui que o produto
 * não é para ele — e conclui certo, porque nem cobrar poderíamos em euro sem
 * a linha. Dólar e inglês é a moeda e o idioma que todo mercado de software
 * reconhece como "internacional", e é honesto sobre o que entregamos.
 */
export const MERCADO_INTERNACIONAL: Mercado = {
  pais: "",
  nome: "Internacional",
  moeda: "USD",
  idioma: "en",
  locale: "en-US",
  // O MESMO dólar da Argentina: o `price` do Stripe tem UMA opção em USD por
  // plano, então dois preços em dólar na tela seriam um deles mentindo.
  precos: { essencial: 2900, pro: 5900, ilimitado: 11900 },
};

/** O mercado de casa — o que a instalação usa quando não há de onde deduzir. */
export const MERCADO_PADRAO: Mercado =
  MERCADOS.find((m) => m.pais === "BR") ?? MERCADO_INTERNACIONAL;

const POR_PAIS: ReadonlyMap<string, Mercado> = new Map(MERCADOS.map((m) => [m.pais, m]));

/**
 * O mercado de um país, ou o internacional.
 *
 * NUNCA lança e NUNCA devolve `null`: quem chama é o componente de servidor da
 * página de vendas, e uma exceção aqui é a primeira tela do produto em branco.
 * País desconhecido, vazio ou malformado cai no internacional, que é uma
 * resposta boa — não um erro disfarçado.
 */
/**
 * As moedas que o Stripe desta instalação CONSEGUE cobrar: o real sempre (a
 * conta é brasileira) e as que o operador listou em `STRIPE_MOEDAS` depois de
 * cadastrá-las em `currency_options` de cada `price`.
 *
 * Mostrar um preço numa moeda que o checkout não cobra é anunciar US$ 99 e
 * cobrar R$ 197 — foi o estado da tela até 11/10/2026.
 */
export function moedasCobraveis(): ReadonlySet<Moeda> {
  const extras = (process.env.STRIPE_MOEDAS ?? "")
    .split(",")
    .map((m) => m.trim().toUpperCase())
    .filter((m) => m.length > 0) as Moeda[];
  return new Set<Moeda>(["BRL", ...extras]);
}

/** O mercado cujo PREÇO esta instalação pode cobrar: o próprio, ou o brasileiro. */
export function mercadoDePreco(mercado: Mercado): Mercado {
  return moedasCobraveis().has(mercado.moeda) ? mercado : MERCADO_PADRAO;
}

export function mercadoDoPais(pais: string | null | undefined): Mercado {
  const chave = (pais ?? "").trim().toUpperCase();
  if (chave.length !== 2) return MERCADO_INTERNACIONAL;
  return POR_PAIS.get(chave) ?? MERCADO_INTERNACIONAL;
}

/** O preço de um plano naquele mercado, na unidade menor da moeda. */
export function precoNoMercado(plano: PlanoId, mercado: Mercado): number {
  return mercado.precos[plano];
}

/**
 * O preço escrito como a pessoa daquele país o escreveria.
 *
 * Sem centavos na tela em nenhum mercado: os preços são todos redondos, e
 * `R$ 197,00` só acrescenta ruído. `Intl` com o `locale` da linha resolve
 * separador, símbolo e posição — `1.299 MXN` e `$1,299.00` são a mesma quantia
 * e só a primeira parece um preço para quem mora lá.
 */
export function precoLegivelNoMercado(plano: PlanoId, mercado: Mercado): string {
  const bruto = precoNoMercado(plano, mercado);
  const valor = MOEDAS_SEM_CENTAVOS.has(mercado.moeda) ? bruto : bruto / 100;
  return new Intl.NumberFormat(mercado.locale, {
    style: "currency",
    currency: mercado.moeda,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(valor);
}

/**
 * O preço de um mercado escrito para quem lê de OUTRO país — a comparação da
 * home. Com o `locale` de quem lê, o símbolo fica inequívoco: um brasileiro lê
 * "$699" como dólar, e "MX$ 699" como o peso mexicano que é.
 */
export function precoParaQuemCompara(plano: PlanoId, mercado: Mercado, locale: string): string {
  const bruto = precoNoMercado(plano, mercado);
  const valor = MOEDAS_SEM_CENTAVOS.has(mercado.moeda) ? bruto : bruto / 100;
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: mercado.moeda,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(valor);
}

/**
 * O preço do ANO no ciclo anual: dez mensalidades (dois meses grátis), escrito
 * como `precoLegivelNoMercado`. Calculado da régua mensal para não existir uma
 * segunda tabela de preço que possa discordar da primeira.
 */
export function precoAnualLegivelNoMercado(plano: PlanoId, mercado: Mercado): string {
  const bruto = precoNoMercado(plano, mercado) * MESES_PAGOS_NO_ANUAL;
  const valor = MOEDAS_SEM_CENTAVOS.has(mercado.moeda) ? bruto : bruto / 100;
  return new Intl.NumberFormat(mercado.locale, {
    style: "currency",
    currency: mercado.moeda,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(valor);
}

/**
 * O idioma do produto correspondente ao do site.
 *
 * `en` não existe dentro do app: quem entra vê a tela em espanhol, que é o
 * mais próximo que temos com tradução humana. Traduzir o app por máquina para
 * fechar a lacuna trocaria uma falta visível por um erro invisível.
 */
export function idiomaDoProduto(doSite: IdiomaDoSite): Idioma {
  // O produto tem português, espanhol e inglês — cada site abre o seu.
  return doSite;
}

/** O `IDIOMA_PADRAO` do produto, como idioma de site — para quem não negociou nada. */
export const IDIOMA_DO_SITE_PADRAO: IdiomaDoSite = IDIOMA_PADRAO;
