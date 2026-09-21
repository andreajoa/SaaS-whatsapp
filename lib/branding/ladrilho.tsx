import { marcaEhADoProduto } from "@/lib/branding";

import { CORES_DA_MARCA, SIMBOLO, simboloDaMarca } from "./desenho";
import { letraDoIcone } from "./icone";
import { NEUTROS_DE_SAIDA, type MarcaDeSaida } from "./saida";

/**
 * O LADRILHO DA MARCA — um desenho, três destinos.
 *
 * `app/icon.tsx` (a aba), `app/apple-icon.tsx` (o atalho na tela inicial do
 * iPhone) e o cabeçalho dos e-mails precisam do MESMO ladrilho em tamanhos
 * diferentes. Enquanto o desenho morava dentro de `icon.tsx`, o segundo
 * destino teria de copiá-lo — e o terceiro também. Três cópias da mesma
 * escolha de marca divergem na primeira revisão da arte, e a que ninguém
 * percebe é a do e-mail, que é justamente a que sai da nossa tela e entra na
 * caixa de entrada de um comprador.
 *
 * Isto é JSX para o satori do `ImageResponse`, não para o DOM: sem hook, sem
 * evento, sem classe do Tailwind — só `style` inline, que é o que ele lê.
 *
 * A cascata é a mesma dos três lugares, e a ordem importa:
 *
 *  1. marca do PRODUTO (ninguém configurou nada) → o símbolo do produto;
 *  2. marca NOMEADA com arte no registro → a arte dela;
 *  3. qualquer outra → cor de destaque + a inicial.
 *
 * O passo 3 nunca desenha arte nossa: um símbolo que soletra outro nome na aba
 * de quem se chama "Acme" é vazamento de marca, e é o que
 * `tests/unit/branding.test.ts` existe para impedir.
 */

export function LadrilhoDaMarca({ marca, lado }: { marca: MarcaDeSaida; lado: number }) {
  const moldura = {
    width: "100%",
    height: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  } as const;

  if (marcaEhADoProduto({ name: marca.nome, logoUrl: marca.logoUrl })) {
    // 78% da aresta: o D ocupa ~75% do próprio viewBox, então sobra o mesmo
    // respiro que a letra tem no ramo de baixo.
    const tamanho = Math.round(lado * 0.78);
    return (
      <div style={{ ...moldura, background: NEUTROS_DE_SAIDA.fundo }}>
        <svg viewBox={SIMBOLO.viewBox} width={tamanho} height={tamanho}>
          <g fill={CORES_DA_MARCA.claro.simbolo} transform={SIMBOLO.transform}>
            <path d={SIMBOLO.d} />
            <rect {...SIMBOLO.modulo} />
          </g>
        </svg>
      </div>
    );
  }

  const desenho = simboloDaMarca(marca.nome);
  if (desenho) {
    // 86% e não 78%: o símbolo de dois balões já nasce com respiro dentro do
    // próprio viewBox (a arte ocupa 63% da largura), então repetir a margem
    // do ramo acima o deixaria pequeno demais em 16 CSS px.
    const tamanho = Math.round(lado * 0.86);
    return (
      <div style={{ ...moldura, background: NEUTROS_DE_SAIDA.fundo }}>
        <svg viewBox={desenho.viewBox} width={tamanho} height={tamanho}>
          {desenho.camadas.map((camada) => (
            <path
              key={camada.d}
              d={camada.d}
              fill={marca.accent}
              fillOpacity={camada.tinta === "clara" ? OPACIDADE_CLARA : 1}
              fillRule={camada.regra}
            />
          ))}
        </svg>
      </div>
    );
  }

  return (
    <div
      style={{
        ...moldura,
        background: marca.accent,
        color: marca.accentFg,
        // 62% da altura: a caixa maiúscula do Geist ocupa ~72% do em, então a
        // letra fica com respiro sem virar um selo minúsculo no meio.
        fontSize: Math.round(lado * 0.62),
        // O ladrilho é quadrado e cheio: o navegador já arredonda o favicon no
        // chrome dele, e arredondar aqui também produz canto duplo.
        borderRadius: 0,
      }}
    >
      {letraDoIcone(marca.nome) ?? ""}
    </div>
  );
}

/**
 * A camada clara do símbolo, em opacidade sobre o accent — o mesmo número que
 * `components/branding/MarcaDoProduto.tsx` usa na tela. Vive aqui porque quem
 * desenha no `ImageResponse` não pode importar componente de DOM.
 */
export const OPACIDADE_CLARA = 0.55;

/**
 * O cabeçalho de PNG que serve os três destinos.
 *
 * 60s é deliberado, e é o par com o TTL da marca: o operador que troca a cor
 * em `/admin/marca` vê a aba acompanhar dentro de um minuto. Um `immutable` de
 * um ano tornaria a tela de marca uma promessa que o ícone não cumpre;
 * `no-store` faria o satori rodar a cada navegação.
 */
export const CACHE_DO_LADRILHO = {
  "cache-control": "public, max-age=60, stale-while-revalidate=600",
};
