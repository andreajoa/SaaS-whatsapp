"use client";

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";

/**
 * O INVÓLUCRO QUE FAZ OS FILHOS CHEGAREM, UM DEPOIS DO OUTRO.
 *
 * ─── Por que isto não é enfeite ────────────────────────────────────────────
 *
 * A `ConversaDeExemplo` é a única prova que a página de vendas tem. Ela afirma
 * "Respondido na hora" e mostra quatro balões que já estão todos lá — um
 * diálogo que terminou antes de a pessoa chegar. O que ela precisa provar em
 * três segundos é justamente o contrário: que a resposta SAI, e sai sozinha.
 * Quatro balões chegando na ordem em que a conversa aconteceu é a afirmação
 * encenada em vez de escrita.
 *
 * ─── O estado inicial é VISÍVEL, e isso é a decisão que mais importa ───────
 *
 * Nada aqui esconde nada no HTML que sai do servidor. Quem chega sem executar
 * JavaScript — o Googlebot no primeiro passe, a prévia de link do WhatsApp, um
 * leitor de tela com script bloqueado — recebe a demonstração inteira, do
 * jeito que ela é hoje. Esconder por CSS o que só o JS revela é a forma mais
 * comum de uma página de vendas sumir do índice, e ela não dá sinal nenhum:
 * a tela de quem programou está sempre certa.
 *
 * Quem esconde é a classe `.sequencia-viva`, e ela só é posta pelo próprio
 * componente, depois de confirmar que há navegador, que há
 * `IntersectionObserver` e que a pessoa não pediu menos movimento.
 *
 * ─── Por que `useLayoutEffect` e não `useEffect` ───────────────────────────
 *
 * Com `useEffect` a ordem é: monta → PINTA (os quatro balões aparecem) →
 * efeito esconde → observador dispara → anima. A pessoa vê a conversa inteira
 * piscar e sumir antes de ela se montar, que é pior que não animar nada.
 * `useLayoutEffect` roda ANTES da pintura: a primeira coisa que o olho vê já é
 * o estado inicial certo. O `typeof window` no alto existe porque este
 * componente também renderiza no servidor, onde `useLayoutEffect` avisa no
 * console — e aviso em log de produção é ruído que treina todo mundo a ignorar
 * o log.
 */
const useEfeitoAntesDaPintura = typeof window === "undefined" ? useEffect : useLayoutEffect;

export function EntraEmSequencia({
  children,
  className,
}: {
  readonly children: ReactNode;
  readonly className?: string;
}) {
  const alvo = useRef<HTMLDivElement>(null);
  const [vivo, setVivo] = useState(false);
  const [emCena, setEmCena] = useState(false);

  useEfeitoAntesDaPintura(() => {
    // `prefers-reduced-motion` não ganha uma versão pior do produto: ele ganha
    // o MESMO destino sem o percurso — os quatro balões, de uma vez, que é
    // exatamente o que a página já fazia. É a mesma doutrina das outras
    // animações deste projeto (ver o fim de `app/globals.css`).
    const calmo = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    if (calmo || typeof IntersectionObserver === "undefined") return;
    setVivo(true);
  }, []);

  useEffect(() => {
    if (!vivo) return;
    const elemento = alvo.current;
    if (!elemento) return;

    const observador = new IntersectionObserver(
      (entradas) => {
        if (!entradas.some((e) => e.isIntersecting)) return;
        setEmCena(true);
        // Uma vez só. Reanimar a cada rolagem transforma prova em enfeite, e
        // quem volta ao topo não precisa ver o produto se apresentar de novo.
        observador.disconnect();
      },
      { threshold: 0.25 },
    );

    observador.observe(elemento);

    // CINTO DE SEGURANÇA, e não otimismo: se o observador não responder — aba
    // em segundo plano no momento do mount, navegador exótico, extensão que o
    // substitui —, o que fica na tela é um retângulo vazio no lugar da única
    // demonstração do produto. O custo de errar para este lado é mostrar a
    // conversa sem a encenação; para o outro, é não mostrar a conversa.
    const espera = window.setTimeout(() => setEmCena(true), 1200);

    return () => {
      window.clearTimeout(espera);
      observador.disconnect();
    };
  }, [vivo]);

  return (
    <div
      ref={alvo}
      className={vivo ? `${className ?? ""} sequencia-viva`.trim() : className}
      data-em-cena={emCena ? "true" : undefined}
    >
      {children}
    </div>
  );
}
