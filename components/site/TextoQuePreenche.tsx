"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";

/**
 * A FRASE QUE ACENDE PALAVRA POR PALAVRA ENQUANTO A PESSOA ROLA.
 *
 * ─── Onde ela vive, e por que só ali ───────────────────────────────────────
 *
 * "A venda raramente se perde no preço. Ela se perde no silêncio." é o pico da
 * página: a única linha que nomeia a dor antes de qualquer solução. Acender
 * palavra a palavra faz o olho LER em vez de varrer — a frase passa a durar o
 * tempo que ela merece, e não o tempo de uma rolagem distraída.
 *
 * É efeito de UM lugar. Repetido em cada título viraria maneirismo, e a
 * segunda vez já não segura ninguém.
 *
 * ─── O que mudou em relação à receita original ─────────────────────────────
 *
 * A vitrine de onde este efeito vem escreve `rgba(255,255,255,...)` direto no
 * `style`. Aqui isso seria duplo erro: branco fixo some no tema claro, e o
 * produto é white-label — a cor do texto vem dos tokens de `app/globals.css`,
 * que o revendedor troca. O que se anima é **opacidade**, que não tem cor e
 * portanto atravessa tema claro, tema escuro e marca de terceiro sem saber
 * nada sobre nenhum deles.
 *
 * ─── As mesmas três garantias do `EntraEmSequencia` ────────────────────────
 *
 * 1. O HTML do servidor sai com a frase INTEIRA legível. Quem não executa
 *    JavaScript lê a frase, não um borrão de palavras apagadas.
 * 2. `prefers-reduced-motion` recebe o mesmo destino sem o percurso.
 * 3. O laço de animação só roda com a frase na tela, e para quando ela sai —
 *    senão a bateria de quem rolou para longe continua pagando a conta.
 */
const useEfeitoAntesDaPintura = typeof window === "undefined" ? useEffect : useLayoutEffect;

/** Opacidade da palavra ainda não alcançada pelo cursor de leitura. */
const APAGADA = 0.28;

/** Quantas palavras o degradê atravessa. Menos que isso vira interruptor. */
const DEGRADE = 3;

export function TextoQuePreenche({
  texto,
  className,
}: {
  readonly texto: string;
  readonly className?: string;
}) {
  const alvo = useRef<HTMLSpanElement>(null);
  const [vivo, setVivo] = useState(false);

  const palavras = texto.split(/\s+/).filter(Boolean);

  useEfeitoAntesDaPintura(() => {
    const calmo = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    if (calmo || typeof IntersectionObserver === "undefined") return;
    setVivo(true);
  }, []);

  useEffect(() => {
    if (!vivo) return;
    const elemento = alvo.current;
    if (!elemento) return;

    let quadro = 0;
    let rodando = false;

    const pintar = () => {
      const r = elemento.getBoundingClientRect();
      const altura = window.innerHeight || 800;

      // O cursor de leitura anda enquanto a frase sobe de 85% para 35% da
      // altura da tela. Fora desses dois pontos ela já está toda apagada ou
      // toda acesa — não faz sentido continuar contando.
      const inicio = altura * 0.85;
      const fim = altura * 0.35;
      const bruto = (inicio - r.top) / (inicio - fim);
      const p = Math.max(0, Math.min(1, bruto));

      // Uma margem de DEGRADE antes e depois para a primeira palavra não
      // nascer já acesa nem a última ficar sem chegar ao fim.
      const cursor = p * (palavras.length + DEGRADE * 2) - DEGRADE;

      for (let i = 0; i < elemento.children.length; i++) {
        const span = elemento.children[i] as HTMLElement;
        const d = Math.max(0, Math.min(1, (cursor - i) / DEGRADE));
        span.style.opacity = String(APAGADA + d * (1 - APAGADA));
      }

      quadro = requestAnimationFrame(pintar);
    };

    const observador = new IntersectionObserver(
      (entradas) => {
        const naTela = entradas.some((e) => e.isIntersecting);
        if (naTela && !rodando) {
          rodando = true;
          quadro = requestAnimationFrame(pintar);
        } else if (!naTela && rodando) {
          rodando = false;
          cancelAnimationFrame(quadro);
        }
      },
      { threshold: 0 },
    );

    observador.observe(elemento);

    // Cinto: observador que não responde deixaria a frase apagada para sempre.
    // Acender tudo é o pior caso aceitável; frase ilegível não é.
    const espera = window.setTimeout(() => {
      if (rodando) return;
      for (const filho of Array.from(elemento.children)) {
        (filho as HTMLElement).style.opacity = "1";
      }
    }, 1500);

    return () => {
      window.clearTimeout(espera);
      cancelAnimationFrame(quadro);
      observador.disconnect();
    };
  }, [vivo, palavras.length]);

  return (
    <span ref={alvo} className={className} data-vivo={vivo ? "true" : undefined}>
      {palavras.map((palavra, i) => (
        <span
          key={`${i}-${palavra}`}
          // A opacidade inicial só existe quando o componente confirmou que
          // consegue animar. Sem isso, quem chega sem JavaScript receberia a
          // frase a 28% — legível, mas visivelmente quebrada.
          style={vivo ? { opacity: APAGADA } : undefined}
          className="transition-opacity duration-150"
        >
          {palavra}
          {i < palavras.length - 1 ? " " : ""}
        </span>
      ))}
    </span>
  );
}
