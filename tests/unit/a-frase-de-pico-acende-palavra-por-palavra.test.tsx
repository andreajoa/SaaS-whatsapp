/**
 * A FRASE DE PICO ACENDE — E NUNCA FICA ILEGÍVEL.
 *
 * ─── O que este componente faz, e o risco que ele carrega ──────────────────
 *
 * `TextoQuePreenche` quebra uma frase em palavras e acende uma a uma conforme
 * a rolagem passa. A frase é "A venda raramente se perde no preço. Ela se
 * perde no silêncio." — o pico da página de vendas, a única linha que nomeia a
 * dor antes de oferecer qualquer solução.
 *
 * O risco é o mesmo de todo efeito que apaga para revelar, e é pior aqui do
 * que nos balões: se a revelação não acontecer, o que fica na tela não é um
 * espaço vazio — é a frase mais importante da página escrita a 28% de
 * opacidade, que parece defeito de renderização.
 *
 * ─── O que cada bloco vigia ────────────────────────────────────────────────
 *
 * 1. A FRASE CHEGA INTEIRA. Todas as palavras estão no DOM, na ordem, com os
 *    espaços entre elas — quem lê sem JavaScript lê a frase, não uma lista.
 * 2. SEM CAPACIDADE, NADA É APAGADO. Sem `IntersectionObserver` (o estado de
 *    quem não executa JS) nenhuma palavra nasce com opacidade reduzida.
 * 3. MOVIMENTO REDUZIDO NÃO GANHA VERSÃO PIOR.
 * 4. NÃO HÁ COR NO `style`. É o que garante tema claro, tema escuro e marca de
 *    revendedor — a receita original escrevia branco fixo.
 */
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { TextoQuePreenche } from "@/components/site/TextoQuePreenche";

const FRASE = "A venda raramente se perde no preco";

function palavrasNoDom(): HTMLElement[] {
  const raiz = screen.getByTestId("alvo").firstElementChild as HTMLElement;
  return Array.from(raiz.children) as HTMLElement[];
}

function observadorDuble() {
  class Duble {
    constructor(private readonly cb: IntersectionObserverCallback) {}
    observe() {}
    disconnect() {}
    unobserve() {}
    takeRecords(): IntersectionObserverEntry[] {
      return [];
    }
  }
  vi.stubGlobal("IntersectionObserver", Duble);
}

function movimentoReduzido(reduzido: boolean) {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: vi.fn(() => ({ matches: reduzido })),
  });
}

function montar() {
  return render(
    <div data-testid="alvo">
      <TextoQuePreenche texto={FRASE} />
    </div>,
  );
}

beforeEach(() => movimentoReduzido(false));

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("TextoQuePreenche — a frase de pico nunca fica ilegivel", () => {
  it("⭐ a frase chega inteira ao DOM, na ordem e com os espacos", () => {
    observadorDuble();
    montar();

    const palavras = palavrasNoDom();
    expect(palavras).toHaveLength(FRASE.split(" ").length);
    // `textContent` do conjunto tem de reconstruir a frase — sem isto, um
    // `split` errado entregaria as palavras grudadas.
    const remontada = palavras.map((p) => p.textContent).join("");
    expect(remontada.trim()).toBe(FRASE);
  });

  it("⭐ sem IntersectionObserver, NENHUMA palavra nasce apagada", () => {
    // jsdom não traz IntersectionObserver — o mesmo estado de quem chega sem
    // executar JavaScript. A frase mais importante da página tem de estar
    // legível para ele.
    montar();

    for (const palavra of palavrasNoDom()) {
      expect(palavra.style.opacity, `"${palavra.textContent}" nasceu apagada`).toBe("");
    }
  });

  it("com `prefers-reduced-motion`, nada e apagado", () => {
    observadorDuble();
    movimentoReduzido(true);
    montar();

    for (const palavra of palavrasNoDom()) {
      expect(palavra.style.opacity).toBe("");
    }
    expect(screen.getByTestId("alvo").firstElementChild?.getAttribute("data-vivo")).toBeNull();
  });

  it("navegador capaz: as palavras nascem apagadas, prontas para acender", () => {
    observadorDuble();
    montar();

    const palavras = palavrasNoDom();
    expect(screen.getByTestId("alvo").firstElementChild?.getAttribute("data-vivo")).toBe("true");
    for (const palavra of palavras) {
      expect(Number(palavra.style.opacity)).toBeGreaterThan(0);
      expect(Number(palavra.style.opacity)).toBeLessThan(1);
    }
  });

  it("⭐ nenhuma COR entra no style — e o que atravessa tema e marca", () => {
    // A receita original escrevia `rgba(255,255,255,...)`. Branco fixo some no
    // tema claro e ignora a cor que o revendedor escolheu. Só opacidade passa.
    observadorDuble();
    montar();

    for (const palavra of palavrasNoDom()) {
      expect(palavra.style.color, "cor fixa no style quebra tema e marca propria").toBe("");
      expect(palavra.getAttribute("style") ?? "").not.toMatch(/rgb|#[0-9a-f]{3}/i);
    }
  });
});
