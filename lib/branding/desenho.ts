/**
 * O DESENHO da marca do produto — símbolo e logotipo — como geometria pura.
 *
 * Mora aqui, e não num `.svg` em `public/`, por duas razões que a doutrina de
 * marca própria já paga:
 *
 *  1. `public/` é servido a todo mundo, sempre. Um arquivo fixo ali seria a
 *     marca do PRODUTO na instalação de um revendedor que configurou a dele —
 *     é exatamente o vazamento que `tests/unit/branding.test.ts` vigia. Como
 *     geometria, o desenho só aparece onde um componente decide que a marca em
 *     vigor é a padrão (`marcaEhADoProduto`, em `lib/branding.ts`).
 *  2. O favicon (`app/icon.tsx`) é gerado em runtime pelo `ImageResponse`, que
 *     aceita SVG inline mas não lê arquivo do disco. Um único desenho alimenta
 *     a tela e o ícone — dois arquivos divergiriam na primeira revisão da marca.
 *
 * As cores NÃO estão aqui de propósito: quem desenha escolhe (a tela lê os
 * tokens do tema; o favicon lê a régua do produto). A fonte deste arquivo são
 * os SVGs em `docs/brand/`; ao trocar a arte, regenere os dois lados a partir
 * deles.
 */

/** Glifo com a transformação que o posiciona no `viewBox` do logotipo. */
export type Glifo = { readonly transform: string; readonly d: string };

/**
 * ─── MARCA NOMEADA: quando a arte pertence ao NOME, e não ao produto ────────
 *
 * `marcaEhADoProduto()` responde uma pergunta binária — "ninguém configurou
 * marca?" — e o símbolo abaixo (o D) é a resposta. Isso basta enquanto existe
 * UMA marca com desenho próprio.
 *
 * Não é mais o caso. Este mesmo código roda hospedado sob outra marca, com
 * `APP_NAME` configurado, e portanto cai no ramo "marca de terceiro": texto na
 * tela e uma LETRA no favicon. O resultado medido em produção (2026-09-20) era
 * um quadrado verde com um "A" — a aba de um SaaS que se vende por assinatura
 * mostrando a marca de ninguém.
 *
 * O conserto NÃO é um arquivo em `public/` (a imagem Docker é uma só para
 * todas as marcas — ver o cabeçalho deste arquivo) nem buscar `logo_url` pela
 * rede no `<head>` (SSRF com gatilho em cada page load — ver `app/icon.tsx`).
 * É um REGISTRO: nome → geometria. Quem está no registro recebe a própria arte
 * em toda superfície; quem não está segue exatamente como antes, com a letra.
 *
 * O registro é fechado e mora aqui, ao lado do desenho do produto, porque é a
 * mesma classe de dado: geometria de marca, sem cor, sem arquivo, sem rede.
 */

/** Qual papel da paleta pinta uma camada. A cor em si vem de quem desenha. */
export type TintaDoSimbolo = "clara" | "principal" | "detalhe";

export type CamadaDeSimbolo = {
  readonly d: string;
  readonly tinta: TintaDoSimbolo;
  /**
   * `"evenodd"` quando o caminho traz um FURO como segundo sub-caminho. É como
   * a lente entre os dois balões fica vazada sem máscara SVG: máscara não
   * sobrevive ao satori do `ImageResponse`, e pintar o furo com a cor do fundo
   * quebraria no tema escuro.
   */
  readonly regra?: "evenodd";
};

export type DesenhoDeSimbolo = {
  readonly viewBox: string;
  readonly camadas: readonly CamadaDeSimbolo[];
};

/**
 * ── Atenza: dois balões que se sobrepõem, e a lente onde eles se entendem ──
 *
 * Geometria pura, derivada da arte em `docs/brand/atenza-simbolo.svg`:
 *
 *  - balão claro (quem chega), retângulo arredondado no alto à direita;
 *  - balão escuro (quem atende), embaixo à esquerda, com UM canto reto — a
 *    ponta que faz um retângulo virar um balão de fala;
 *  - a interseção dos dois é VAZADA nos dois, e os dois pontos moram nela.
 *
 * O furo é a ideia da marca inteira: o que os dois têm em comum é o que se
 * enxerga através. Por isso ele não é pintado — é ausência, e funciona igual
 * sobre creme, sobre grafite e sobre qualquer fundo de cliente de e-mail.
 */
const ATENZA_LENTE = "M65 83H120A28 28 0 0 1 148 111V136H93A28 28 0 0 1 65 108Z";

const ATENZA_BALAO_CLARO =
  "M93 49H148A28 28 0 0 1 176 77V108A28 28 0 0 1 148 136H93A28 28 0 0 1 65 108V77A28 28 0 0 1 93 49Z";

const ATENZA_BALAO_ESCURO =
  "M68 83H120A28 28 0 0 1 148 111V139A28 28 0 0 1 120 167H40V111A28 28 0 0 1 68 83Z";

/** Os dois pontos dentro da lente — o "ainda estou escrevendo" do WhatsApp. */
const ATENZA_PONTOS =
  "M110 110A9 9 0 1 1 92 110A9 9 0 1 1 110 110ZM137 110A9 9 0 1 1 119 110A9 9 0 1 1 137 110Z";

export const SIMBOLO_ATENZA: DesenhoDeSimbolo = {
  viewBox: "0 0 216 216",
  camadas: [
    { d: `${ATENZA_BALAO_CLARO}${ATENZA_LENTE}`, tinta: "clara", regra: "evenodd" },
    { d: `${ATENZA_BALAO_ESCURO}${ATENZA_LENTE}`, tinta: "principal", regra: "evenodd" },
    { d: ATENZA_PONTOS, tinta: "detalhe" },
  ],
};

/**
 * O registro nome → desenho.
 *
 * Chave em minúsculas e sem espaços das pontas: `APP_NAME` é digitado por
 * pessoa, e "atenza " com espaço sobrando não pode virar uma marca sem arte.
 * Comparar o nome cru seria um bug de digitação separando o produto do próprio
 * logo — e ninguém perceberia, porque a letra no lugar parece intencional.
 */
const SIMBOLOS_POR_MARCA: Readonly<Record<string, DesenhoDeSimbolo>> = {
  atenza: SIMBOLO_ATENZA,
};

/**
 * A geometria da marca chamada `nome`, ou `null` quando ela não tem arte aqui.
 *
 * `null` é o caminho normal e não é falha: um revendedor chamado "Acme" não
 * tem desenho neste repositório, e inventar um seria pior que a letra.
 */
export function simboloDaMarca(nome: string): DesenhoDeSimbolo | null {
  return SIMBOLOS_POR_MARCA[nome.trim().toLowerCase()] ?? null;
}

/**
 * O logotipo da Atenza: o símbolo (quadrado de 216) e, à direita, o nome em
 * texto. O nome não vira caminho aqui de propósito — é o `nome` resolvido da
 * tela, na fonte do produto. A proporção cabe "Atenza" com folga.
 */
export const LOGOTIPO = {
  viewBox: "0 0 760 216",
  /** Proporção largura/altura do `viewBox`, para dimensionar por altura. */
  proporcao: 760 / 216,
  texto: { x: 236, y: 150, tamanho: 132 },
} as const;

/**
 * As cores da marca do produto, por tema — os mesmos graus da régua
 * (`regua-do-produto.ts`): sálvia 600/400 para o símbolo, neutro 900/0 para
 * o nome e neutro 600/300 para o "CRM". Copiadas dos SVGs de `docs/brand/`.
 */
export const CORES_DA_MARCA = {
  claro: { simbolo: "#506d48", nome: "#1c1a16", sufixo: "#5d594f" },
  escuro: { simbolo: "#82a077", nome: "#f5f4ef", sufixo: "#8e8b7f" },
} as const;
