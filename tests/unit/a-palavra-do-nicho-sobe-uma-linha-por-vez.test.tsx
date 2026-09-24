/**
 * A PALAVRA DO NICHO SOBE UMA LINHA POR VEZ — NÃO A FITA INTEIRA.
 *
 * ─── O defeito que este teste fecha ────────────────────────────────────────
 *
 * A primeira versão movia a fita com `translateY(-i * 100%)`. Em CSS, a
 * porcentagem de `translateY` é relativa à altura DO PRÓPRIO ELEMENTO — e o
 * elemento é a fita, com as cinco palavras empilhadas. O primeiro passo subia
 * cinco linhas de uma vez: a janela ficava vazia da segunda palavra em diante,
 * e o que se via no site era "clínicas" e depois nada.
 *
 * O defeito é invisível em código: `translateY(-100%)` parece certo, e num
 * componente de UMA linha ele seria. Só o passo medido denuncia.
 *
 * ─── O que cada caso vigia ─────────────────────────────────────────────────
 *
 * 1. O PASSO É DE UMA LINHA. Entre a palavra `n` e a `n+1` o deslocamento
 *    cresce exatamente uma altura de linha. É a asserção que reprova o
 *    `-100%` e reprova também um `-i * 100 / itens` que alguém "consertasse"
 *    sem reparar que o passo passa a mudar quando a lista muda de tamanho.
 * 2. O PASSO NÃO DEPENDE DA CONTAGEM. Com quatro nichos ou com oito, a
 *    distância entre duas palavras é a mesma. Era essa a fragilidade da
 *    receita original.
 * 3. A FITA REPETE A PRIMEIRA PALAVRA NO FIM. É o que faz o laço fechar sem
 *    tranco, e sumir com ela traria de volta o salto de quatro linhas.
 * 4. SEM CAPACIDADE, A FRASE CONTINUA INTEIRA. Quem não executa JavaScript lê
 *    "Atendimento por WhatsApp para clínicas", não um espaço vazio.
 */
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PalavraQueAlterna } from "@/components/site/PalavraQueAlterna";

const NICHOS = ["clínicas", "imobiliárias", "e-commerce", "serviços"];

function movimentoReduzido(reduzido: boolean) {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: vi.fn(() => ({ matches: reduzido })),
  });
}

/** A fita é o único filho do invólucro. */
function fita(): HTMLElement {
  const caixa = screen.getByTestId("caixa").firstElementChild as HTMLElement;
  const f = caixa.firstElementChild as HTMLElement | null;
  if (!f) throw new Error("a fita sumiu: o componente deixou de animar");
  return f;
}

/** Quantos `em` a fita subiu, lido do transform. */
function deslocamentoEm(): number {
  const t = fita().style.transform;
  const m = /translateY\(-?([\d.]+)em\)/.exec(t);
  if (!m) throw new Error(`transform não está em \`em\`: ${JSON.stringify(t)}`);
  return Number(m[1]);
}

function montar(palavras: readonly string[]) {
  return render(
    <div data-testid="caixa">
      <PalavraQueAlterna palavras={palavras} />
    </div>,
  );
}

beforeEach(() => {
  movimentoReduzido(false);
  vi.useFakeTimers();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("PalavraQueAlterna — o passo é de UMA linha", () => {
  it("⭐ entre duas palavras, a fita sobe exatamente uma altura de linha", () => {
    montar(NICHOS);

    const zero = deslocamentoEm();
    expect(zero).toBe(0);

    act(() => void vi.advanceTimersByTime(3600));
    const um = deslocamentoEm();

    act(() => void vi.advanceTimersByTime(3600));
    const dois = deslocamentoEm();

    // O passo existe (não ficou parado) e é CONSTANTE.
    expect(um).toBeGreaterThan(0);
    expect(dois - um).toBeCloseTo(um - zero, 3);

    // E é pequeno: uma linha. O `-100%` do defeito equivalia a cinco.
    expect(um).toBeLessThan(2);
  });

  it("⭐ o passo NÃO muda quando a lista cresce", () => {
    // A receita original dividia por `itens`, o que amarra o passo à
    // contagem: acrescentar um nicho mudaria a distância de todos os outros, e
    // quem acrescentasse não teria como saber.
    montar(NICHOS);
    act(() => void vi.advanceTimersByTime(3600));
    const comQuatro = deslocamentoEm();
    cleanup();

    montar([...NICHOS, "advogados", "academias", "pet shops", "escolas"]);
    act(() => void vi.advanceTimersByTime(3600));
    const comOito = deslocamentoEm();

    expect(comOito).toBeCloseTo(comQuatro, 3);
  });

  it("a fita repete a primeira palavra no fim, que é o que fecha o laço", () => {
    montar(NICHOS);
    const filhos = Array.from(fita().children).map((c) => c.textContent);
    expect(filhos).toHaveLength(NICHOS.length + 1);
    expect(filhos[0]).toBe("clínicas");
    expect(filhos[filhos.length - 1]).toBe("clínicas");
  });

  it("⭐ com `prefers-reduced-motion`, a frase fica inteira e parada", () => {
    movimentoReduzido(true);
    montar(NICHOS);

    // Sem fita: o componente devolve a primeira palavra, seca. A frase
    // "Atendimento por WhatsApp para clínicas" continua verdadeira sozinha.
    const caixa = screen.getByTestId("caixa").firstElementChild as HTMLElement;
    expect(caixa.textContent).toBe("clínicas");
    expect(caixa.querySelector(".alterna-fita")).toBeNull();
  });

  it("com uma palavra só não há o que alternar, e nada se move", () => {
    montar(["clínicas"]);
    const caixa = screen.getByTestId("caixa").firstElementChild as HTMLElement;
    expect(caixa.textContent).toBe("clínicas");
    expect(caixa.querySelector(".alterna-fita")).toBeNull();
  });
});
