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
const ATENZA_LENTE =
  "M65 83H120A28 28 0 0 1 148 111V136H93A28 28 0 0 1 65 108Z";

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

const D_ABERTO =
  "M26 108V43c0-10 8-18 18-18h54c56 0 91 33 91 81s-35 81-91 81H45l34-34h19c35 0 56-17 56-47s-21-47-56-47H60v49Z";

/** O símbolo: um D aberto com um módulo quadrado destacado. Quadrado de 216. */
export const SIMBOLO = {
  viewBox: "0 0 216 216",
  transform: "translate(0.5 2)",
  d: D_ABERTO,
  modulo: { x: 26, y: 125, width: 34, height: 34, rx: 4 },
} as const;

/**
 * O logotipo: símbolo + "Deskcomm" + "CRM", com o texto já convertido em
 * caminhos — não depende de fonte instalada nem de `@font-face`.
 */
export const LOGOTIPO = {
  viewBox: "51 25 732 211",
  /** Proporção largura/altura do `viewBox`, para dimensionar por altura. */
  proporcao: 732 / 211,
  simbolo: { transform: "translate(44 19) scale(1.05)", d: D_ABERTO, modulo: SIMBOLO.modulo },
  nome: [
    {
      transform: "translate(268 151) scale(0.05 -0.05)",
      d: "M1445 723Q1445 564 1392.0 431.0Q1339 298 1243.0 202.0Q1147 106 1012.0 53.0Q877 0 712 0H161V1446H712Q877 1446 1012.0 1392.5Q1147 1339 1243.0 1243.5Q1339 1148 1392.0 1015.0Q1445 882 1445 723ZM1169 723Q1169 842 1137.5 936.5Q1106 1031 1046.5 1096.5Q987 1162 902.5 1197.0Q818 1232 712 1232H431V214H712Q818 214 902.5 249.0Q987 284 1046.5 349.5Q1106 415 1137.5 509.5Q1169 604 1169 723Z",
    },
    {
      transform: "translate(344.05 151) scale(0.05 -0.05)",
      d: "M783 631Q783 679 769.5 721.5Q756 764 729.0 796.0Q702 828 660.5 846.5Q619 865 564 865Q457 865 395.5 804.0Q334 743 317 631ZM312 482Q318 403 340.0 345.5Q362 288 398.0 250.5Q434 213 483.5 194.5Q533 176 593 176Q653 176 696.5 190.0Q740 204 772.5 221.0Q805 238 829.5 252.0Q854 266 877 266Q908 266 923 243L994 153Q953 105 902.0 72.5Q851 40 795.5 20.5Q740 1 682.5 -7.0Q625 -15 571 -15Q464 -15 372.0 20.5Q280 56 212.0 125.5Q144 195 105.0 297.5Q66 400 66 535Q66 640 100.0 732.5Q134 825 197.5 893.5Q261 962 352.5 1002.0Q444 1042 559 1042Q656 1042 738.0 1011.0Q820 980 879.0 920.5Q938 861 971.5 774.5Q1005 688 1005 577Q1005 521 993.0 501.5Q981 482 947 482Z",
    },
    {
      transform: "translate(397.45 151) scale(0.05 -0.05)",
      d: "M748 826Q738 810 727.0 803.5Q716 797 699 797Q681 797 660.5 807.0Q640 817 613.0 829.5Q586 842 551.5 852.0Q517 862 470 862Q397 862 355.5 831.0Q314 800 314 750Q314 717 335.5 694.5Q357 672 392.5 655.0Q428 638 473.0 624.5Q518 611 564.5 595.0Q611 579 656.0 558.5Q701 538 736.5 506.5Q772 475 793.5 431.0Q815 387 815 325Q815 251 788.5 188.5Q762 126 710.0 80.5Q658 35 581.5 9.5Q505 -16 405 -16Q352 -16 301.5 -6.5Q251 3 204.5 20.0Q158 37 118.5 60.0Q79 83 49 110L106 204Q117 221 132.0 230.0Q147 239 170 239Q193 239 213.5 226.0Q234 213 261.0 198.0Q288 183 324.5 170.0Q361 157 417 157Q461 157 492.5 167.5Q524 178 544.5 195.0Q565 212 574.5 234.5Q584 257 584 281Q584 317 562.5 340.0Q541 363 505.5 380.0Q470 397 424.5 410.5Q379 424 331.5 440.0Q284 456 238.5 477.5Q193 499 157.5 532.0Q122 565 100.5 613.0Q79 661 79 729Q79 792 104.0 849.0Q129 906 177.5 948.5Q226 991 298.5 1016.5Q371 1042 466 1042Q572 1042 659.0 1007.0Q746 972 804 915Z",
    },
    {
      transform: "translate(441.4 151) scale(0.05 -0.05)",
      d: "M369 1486V635H415Q440 635 454.5 641.5Q469 648 484 668L739 983Q755 1004 774.5 1015.0Q794 1026 825 1026H1051L732 645Q698 600 658 576Q679 561 695.5 541.0Q712 521 727 498L1069 0H846Q817 0 796.0 9.5Q775 19 761 44L499 433Q485 456 470.0 463.0Q455 470 425 470H369V0H122V1486Z",
    },
    {
      transform: "translate(494.85 151) scale(0.05 -0.05)",
      d: "M857 809Q846 795 835.5 787.0Q825 779 805 779Q786 779 768.0 790.5Q750 802 725.0 816.5Q700 831 665.5 842.5Q631 854 580 854Q515 854 466.0 830.5Q417 807 384.5 763.0Q352 719 336.0 656.5Q320 594 320 515Q320 433 337.5 369.0Q355 305 388.0 261.5Q421 218 468.0 195.5Q515 173 574 173Q633 173 669.5 187.5Q706 202 731.0 219.5Q756 237 774.5 251.5Q793 266 816 266Q846 266 861 243L932 153Q891 105 843.0 72.5Q795 40 743.5 20.5Q692 1 637.5 -7.0Q583 -15 529 -15Q434 -15 350.0 20.5Q266 56 203.0 124.0Q140 192 103.5 290.5Q67 389 67 515Q67 628 99.5 724.5Q132 821 195.0 891.5Q258 962 351.0 1002.0Q444 1042 565 1042Q680 1042 766.5 1005.0Q853 968 922 899Z",
    },
    {
      transform: "translate(543.05 151) scale(0.05 -0.05)",
      d: "M576 1042Q690 1042 783.5 1005.0Q877 968 943.5 900.0Q1010 832 1046.0 734.0Q1082 636 1082 515Q1082 393 1046.0 295.0Q1010 197 943.5 128.0Q877 59 783.5 22.0Q690 -15 576 -15Q461 -15 367.0 22.0Q273 59 206.5 128.0Q140 197 103.5 295.0Q67 393 67 515Q67 636 103.5 734.0Q140 832 206.5 900.0Q273 968 367.0 1005.0Q461 1042 576 1042ZM576 175Q704 175 765.5 261.0Q827 347 827 513Q827 679 765.5 766.0Q704 853 576 853Q446 853 383.5 765.5Q321 678 321 513Q321 348 383.5 261.5Q446 175 576 175Z",
    },
    {
      transform: "translate(600.5 151) scale(0.05 -0.05)",
      d: "M122 0V1026H273Q321 1026 336 981L352 905Q379 935 408.5 960.0Q438 985 471.5 1003.0Q505 1021 543.5 1031.5Q582 1042 628 1042Q725 1042 787.5 989.5Q850 937 881 850Q905 901 941.0 937.5Q977 974 1020.0 997.0Q1063 1020 1111.5 1031.0Q1160 1042 1209 1042Q1294 1042 1360.0 1016.0Q1426 990 1471.0 940.0Q1516 890 1539.5 818.0Q1563 746 1563 653V0H1316V653Q1316 751 1273.0 800.5Q1230 850 1147 850Q1109 850 1076.5 837.0Q1044 824 1019.5 799.5Q995 775 981.0 738.0Q967 701 967 653V0H719V653Q719 756 677.5 803.0Q636 850 556 850Q502 850 455.5 823.5Q409 797 369 751V0Z",
    },
    {
      transform: "translate(684.25 151) scale(0.05 -0.05)",
      d: "M122 0V1026H273Q321 1026 336 981L352 905Q379 935 408.5 960.0Q438 985 471.5 1003.0Q505 1021 543.5 1031.5Q582 1042 628 1042Q725 1042 787.5 989.5Q850 937 881 850Q905 901 941.0 937.5Q977 974 1020.0 997.0Q1063 1020 1111.5 1031.0Q1160 1042 1209 1042Q1294 1042 1360.0 1016.0Q1426 990 1471.0 940.0Q1516 890 1539.5 818.0Q1563 746 1563 653V0H1316V653Q1316 751 1273.0 800.5Q1230 850 1147 850Q1109 850 1076.5 837.0Q1044 824 1019.5 799.5Q995 775 981.0 738.0Q967 701 967 653V0H719V653Q719 756 677.5 803.0Q636 850 556 850Q502 850 455.5 823.5Q409 797 369 751V0Z",
    },
  ] as readonly Glifo[],
  sufixo: [
    {
      transform: "translate(273 191) scale(0.01171875 -0.01171875)",
      d: "M1073 53Q996 12 915.0 -8.5Q834 -29 743 -29Q456 -29 297.5 174.0Q139 377 139 745Q139 1111 298.5 1315.5Q458 1520 743 1520Q834 1520 915.0 1499.5Q996 1479 1073 1438V1231Q999 1292 914.0 1324.0Q829 1356 743 1356Q546 1356 448.0 1204.0Q350 1052 350 745Q350 439 448.0 287.0Q546 135 743 135Q831 135 915.5 167.0Q1000 199 1073 260Z",
    },
    {
      transform: "translate(292.4492 191) scale(0.01171875 -0.01171875)",
      d: "M760 705Q838 685 893.0 629.5Q948 574 1030 408L1233 0H1016L838 377Q761 538 699.5 584.5Q638 631 539 631H346V0H143V1493H559Q805 1493 936.0 1382.0Q1067 1271 1067 1061Q1067 913 986.5 819.5Q906 726 760 705ZM346 1327V797H567Q712 797 783.0 862.0Q854 927 854 1061Q854 1190 778.5 1258.5Q703 1327 559 1327Z",
    },
    {
      transform: "translate(311.8984 191) scale(0.01171875 -0.01171875)",
      d: "M86 1493H356L614 733L874 1493H1145V0H958V1319L692 532H539L272 1319V0H86Z",
    },
  ] as readonly Glifo[],
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
