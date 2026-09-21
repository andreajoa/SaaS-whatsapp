import { MERCADO_PADRAO, mercadoDoPais, type Mercado } from "./paises";

/**
 * O MERCADO DA ORGANIZAÇÃO — decidido uma vez, no cadastro, e guardado.
 *
 * ─── Por que não basta reler o IP ──────────────────────────────────────────
 *
 * Na vitrine o país vem do cabeçalho da borda a cada visita, e está certo: quem
 * chega não tem cadastro, e a única coisa que se sabe dele é de onde ele
 * chegou. Dentro do produto isso vira defeito. Um cliente brasileiro que abre a
 * tela de cobrança de um hotel no México veria o plano em pesos — e, pior,
 * veria um preço DIFERENTE do que ele paga. A tela de dinheiro é o pior lugar
 * do produto para um número mudar sozinho.
 *
 * Então o mercado é uma propriedade da ORGANIZAÇÃO, resolvida no cadastro e
 * gravada. Viagem não muda preço.
 *
 * ─── Por que em `settings` e não em coluna ─────────────────────────────────
 *
 * Doutrina DIRC: antes de somar coluna, pergunte se o dado precisa viver aqui
 * mesmo. Este não precisa — nenhuma consulta filtra, ordena ou junta por
 * mercado; ele é lido pela chave primária da org, uma vez por tela. `settings`
 * já é onde moram marca e segurança, e uma coluna a mais em `organizations`
 * custaria migration, tipo regenerado e uma linha de RLS para nada.
 *
 * Só o `pais` é gravado. Moeda, idioma, preço e `locale` são DERIVADOS dele por
 * `mercadoDoPais()`: gravar os cinco criaria cinco fontes que podem divergir, e
 * o dia do reajuste seria o dia em que o preço na tela discorda do preço no
 * Stripe para quem se cadastrou antes.
 *
 * ─── O que acontece com quem se cadastrou antes disto existir ──────────────
 *
 * Nada, e é o comportamento certo: `settings.mercado` ausente cai no mercado
 * padrão (Brasil), que é o que essas organizações sempre viram. Não há
 * backfill e não deve haver — inventar país para quem nunca declarou um
 * trocaria o preço de um cliente existente por adivinhação.
 */

/** O que é gravado. Só o país; o resto é derivado. */
export interface MercadoGravado {
  readonly pais: string;
}

/**
 * Lê o mercado de um `organizations.settings`.
 *
 * Aceita `unknown` de propósito: o que volta do PostgREST é `Json`, e um
 * `settings` de clone antigo pode ser qualquer coisa. Nunca lança — esta função
 * roda na tela de cobrança, e um `settings` estranho não pode virar 500.
 */
export function mercadoDaOrganizacao(settings: unknown): Mercado {
  if (typeof settings !== "object" || settings === null) return MERCADO_PADRAO;
  const bruto = (settings as Record<string, unknown>).mercado;
  if (typeof bruto !== "object" || bruto === null) return MERCADO_PADRAO;
  const pais = (bruto as Record<string, unknown>).pais;
  return typeof pais === "string" ? mercadoDoPais(pais) : MERCADO_PADRAO;
}

/** O pedaço de `settings` que grava o mercado, para o INSERT do provisionamento. */
export function settingsDoMercado(mercado: Mercado): { mercado: MercadoGravado } {
  // O internacional tem `pais: ""` — gravá-lo assim é deliberado e volta
  // íntegro por `mercadoDoPais("")`, que devolve o internacional de novo.
  return { mercado: { pais: mercado.pais } };
}
