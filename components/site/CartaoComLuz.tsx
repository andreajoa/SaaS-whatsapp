"use client";

import { useRef, type ReactNode } from "react";

/**
 * O CARTÃO QUE ACENDE ONDE O MOUSE ESTÁ.
 *
 * ─── Por que ele é barato, e não só bonito ─────────────────────────────────
 *
 * O JavaScript daqui faz UMA coisa: escreve duas custom properties. O brilho
 * inteiro é um `radial-gradient` do CSS lendo essas variáveis
 * (`.cartao-com-luz` em `app/globals.css`). Nenhum estilo é recalculado no
 * laço, nenhum elemento é criado, e o navegador compõe o gradiente na GPU.
 *
 * É o que separa este efeito dos que custam caro: os que desenham em `canvas`
 * rodam um `requestAnimationFrame` perpétuo e cobram bateria de quem só passou
 * o mouse. Este só escreve quando o ponteiro se move, e para sozinho quando o
 * ponteiro sai.
 *
 * ─── Onde ele entra, e por que só ali ──────────────────────────────────────
 *
 * Nos cartões de plano. É o lugar da página em que a pessoa compara, hesita e
 * passa o mouse de um para o outro — e o brilho seguindo o cursor confirma
 * qual ela está olhando. Espalhado por todo cartão da página viraria ruído, e
 * um cartão que acende sem motivo ensina o olho a ignorar cartões que acendem.
 *
 * ─── Em celular ele simplesmente não existe ────────────────────────────────
 *
 * Não há ponteiro para seguir. O CSS guarda o brilho atrás de
 * `@media (hover: hover)`, e o `onPointerMove` com ponteiro grosso nunca
 * dispara de forma útil — então nada é gasto onde nada apareceria.
 */
export function CartaoComLuz({
  children,
  className,
}: {
  readonly children: ReactNode;
  readonly className?: string;
}) {
  const alvo = useRef<HTMLDivElement>(null);

  return (
    <div
      ref={alvo}
      className={`cartao-com-luz ${className ?? ""}`.trim()}
      onPointerMove={(e) => {
        // `pointerType` filtra o toque: no celular o evento dispara uma vez no
        // tap, acenderia um ponto e o deixaria lá — luz parada não é luz que
        // segue nada.
        if (e.pointerType !== "mouse") return;
        const el = alvo.current;
        if (!el) return;
        const r = el.getBoundingClientRect();
        el.style.setProperty("--luz-x", `${e.clientX - r.left}px`);
        el.style.setProperty("--luz-y", `${e.clientY - r.top}px`);
      }}
    >
      {children}
    </div>
  );
}
