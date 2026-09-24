/**
 * A CONVERSA DE EXEMPLO CHEGA — E NUNCA DESAPARECE.
 *
 * ─── O que este componente faz, e por que ele é arriscado ──────────────────
 *
 * `EntraEmSequencia` esconde os filhos e os revela um a um quando a seção entra
 * na tela. Os filhos, aqui, são os quatro balões da única demonstração que a
 * página de vendas tem — a conversa em que a IA responde às 22h14.
 *
 * Todo componente que esconde para revelar carrega o mesmo modo de falha, e ele
 * é silencioso: se a revelação não acontecer, o que fica no lugar da prova do
 * produto é um retângulo vazio. E é invisível para quem programou, porque na
 * máquina de desenvolvimento o observador sempre dispara.
 *
 * ─── O que cada bloco vigia ────────────────────────────────────────────────
 *
 * 1. O HTML DO SERVIDOR NÃO ESCONDE NADA. A classe que esconde só existe
 *    quando o componente CONFIRMA navegador capaz. Quem não executa JavaScript
 *    — Googlebot no primeiro passe, prévia de link do WhatsApp, leitor de tela
 *    com script bloqueado — recebe a conversa inteira. Uma página de vendas que
 *    some do índice não dá sinal nenhum.
 * 2. MOVIMENTO REDUZIDO NÃO GANHA VERSÃO PIOR. Quem pediu menos movimento
 *    recebe o mesmo destino sem o percurso: os quatro balões, de uma vez.
 * 3. O CAMINHO NORMAL FUNCIONA. Navegador capaz esconde, a interseção revela.
 * 4. O CINTO SEGURA. Observador que nunca responde não pode deixar a
 *    demonstração invisível: passado o tempo, ela aparece assim mesmo.
 */
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { EntraEmSequencia } from "@/components/site/EntraEmSequencia";

/** O elemento que o componente devolve — o pai dos balões. */
function envolucro(): HTMLElement {
  const filho = screen.getByText("primeiro balao");
  const pai = filho.parentElement;
  if (!pai) throw new Error("o involucro sumiu: o componente deixou de renderizar um pai");
  return pai;
}

function conteudo() {
  return (
    <EntraEmSequencia className="space-y-3">
      <span>primeiro balao</span>
      <span>segundo balao</span>
    </EntraEmSequencia>
  );
}

/** Guarda o callback do observador para o teste decidir QUANDO ele dispara. */
let dispararIntersecao: ((entrando: boolean) => void) | null = null;

function observadorDuble() {
  class Duble {
    constructor(private readonly cb: IntersectionObserverCallback) {
      dispararIntersecao = (entrando: boolean) =>
        this.cb([{ isIntersecting: entrando } as IntersectionObserverEntry], this as never);
    }
    observe() {}
    disconnect() {}
    unobserve() {}
    takeRecords(): IntersectionObserverEntry[] {
      return [];
    }
  }
  vi.stubGlobal("IntersectionObserver", Duble);
}

/**
 * O jsdom não implementa `matchMedia`, e o componente o lê por `window` com
 * `?.` — sem dublê ele degrada para "não pediu movimento reduzido". Aqui a
 * pergunta é deliberada, então a resposta também tem de ser.
 */
function movimentoReduzido(reduzido: boolean) {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: vi.fn(() => ({ matches: reduzido })),
  });
}

beforeEach(() => {
  dispararIntersecao = null;
  movimentoReduzido(false);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("EntraEmSequencia — a demonstracao do produto nunca fica invisivel", () => {
  it("⭐ sem IntersectionObserver, nada e escondido: a conversa inteira esta na tela", () => {
    // jsdom não traz IntersectionObserver — é, de propósito, o mesmo estado de
    // quem chega sem executar JavaScript.
    render(conteudo());

    expect(envolucro().className).not.toContain("sequencia-viva");
    expect(screen.getByText("primeiro balao")).toBeTruthy();
    expect(screen.getByText("segundo balao")).toBeTruthy();
  });

  it("a classe que esconde preserva as classes de layout que vieram por prop", () => {
    observadorDuble();
    render(conteudo());

    // Perder o `space-y-3` empilharia os balões colados — o espaçamento é do
    // chamador, e o componente não pode comê-lo ao acrescentar o seu.
    expect(envolucro().className).toContain("space-y-3");
    expect(envolucro().className).toContain("sequencia-viva");
  });

  it("com `prefers-reduced-motion`, a classe que esconde NUNCA entra", () => {
    observadorDuble();
    movimentoReduzido(true);
    render(conteudo());

    expect(envolucro().className).not.toContain("sequencia-viva");
    expect(envolucro().getAttribute("data-em-cena")).toBeNull();
  });

  it("navegador capaz: esconde no inicio e revela quando a secao entra na tela", () => {
    observadorDuble();
    render(conteudo());

    expect(envolucro().getAttribute("data-em-cena")).toBeNull();

    act(() => dispararIntersecao?.(true));
    expect(envolucro().getAttribute("data-em-cena")).toBe("true");
  });

  it("intersecao que nao acontece nao revela — e o que prova que a sonda esta viva", () => {
    observadorDuble();
    render(conteudo());

    act(() => dispararIntersecao?.(false));
    expect(envolucro().getAttribute("data-em-cena")).toBeNull();
  });

  it("⭐ o cinto: observador que nunca responde nao deixa a conversa invisivel", () => {
    vi.useFakeTimers();
    observadorDuble();
    render(conteudo());

    expect(envolucro().getAttribute("data-em-cena")).toBeNull();
    act(() => {
      vi.advanceTimersByTime(1500);
    });
    expect(envolucro().getAttribute("data-em-cena")).toBe("true");
  });
});
