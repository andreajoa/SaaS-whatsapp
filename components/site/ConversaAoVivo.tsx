"use client";

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";

/**
 * A CONVERSA ACONTECENDO — com "digitando" entre as falas.
 *
 * ─── Por que isto substituiu a entrada em sequência ────────────────────────
 *
 * Antes os quatro balões chegavam um depois do outro, escalonados. Melhor que
 * estáticos, mas ainda era uma LISTA aparecendo — nada ali dizia que do outro
 * lado havia alguém (ou algo) compondo a resposta.
 *
 * O que falta a um print de conversa para parecer conversa é o intervalo entre
 * perguntar e ser respondido. É ele que a página precisa mostrar: a promessa
 * ao pé do quadro é "Respondido na hora", e "na hora" só significa alguma
 * coisa se houver um antes e um depois.
 *
 * ─── O ritmo não é decorativo ──────────────────────────────────────────────
 *
 * Cada fala declara quanto tempo alguém levou "digitando" antes dela. O
 * agente responde em pouco mais de um segundo — é o que ele de fato faz, e
 * fingir dois segundos venderia um produto mais lento do que o que se entrega.
 * O cliente demora um pouco mais para responder "sou do centro", porque gente
 * digitando no celular demora mais que uma IA.
 *
 * ─── As garantias são as mesmas do resto da vitrine ────────────────────────
 *
 * 1. O HTML do servidor traz a conversa INTEIRA, visível. Quem não executa
 *    JavaScript — Googlebot no primeiro passe, prévia de link do WhatsApp —
 *    recebe as quatro falas. Só depois de confirmar navegador capaz é que o
 *    componente esconde para encenar.
 * 2. `prefers-reduced-motion` recebe o mesmo destino sem o percurso.
 * 3. Cinto de segurança: se a encenação não começar, tudo aparece assim mesmo.
 *    Errar para o lado de mostrar sem animação é barato; para o outro, some a
 *    única prova que a página tem.
 */
const useEfeitoAntesDaPintura = typeof window === "undefined" ? useEffect : useLayoutEffect;

export interface FalaDaConversa {
  /** Quem fala. Decide o lado do balão e o lado do "digitando". */
  lado: "cliente" | "agente";
  /** O balão já montado por quem chamou — o texto continua vindo de `t()`. */
  balao: ReactNode;
  /**
   * Milissegundos de "digitando" ANTES desta fala. `0` não mostra indicador:
   * é o caso da primeira mensagem, que já chega — ninguém vê o cliente
   * digitando antes de a conversa existir.
   */
  digitandoMs: number;
}

/** Teto de segurança: passado isto, a conversa aparece inteira, animada ou não. */
const TETO_MS = 12_000;

export function ConversaAoVivo({
  falas,
  className,
}: {
  readonly falas: readonly FalaDaConversa[];
  readonly className?: string;
}) {
  const alvo = useRef<HTMLDivElement>(null);
  const [vivo, setVivo] = useState(false);
  /** Quantas falas já foram ditas. Começa em `falas.length` = tudo visível. */
  const [ditas, setDitas] = useState(falas.length);
  /** O lado que está "digitando" agora, ou `null`. */
  const [digitando, setDigitando] = useState<"cliente" | "agente" | null>(null);

  useEfeitoAntesDaPintura(() => {
    const calmo = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    if (calmo || typeof IntersectionObserver === "undefined") return;
    setVivo(true);
    setDitas(0);
  }, []);

  useEffect(() => {
    if (!vivo) return;
    const elemento = alvo.current;
    if (!elemento) return;

    const timers: number[] = [];
    let comecou = false;

    const encenar = () => {
      if (comecou) return;
      comecou = true;

      // Um acumulador em vez de timers encadeados: encadear faz cada atraso
      // depender do anterior ter disparado, e uma aba em segundo plano (onde o
      // navegador estrangula os timers) desmonta o ritmo inteiro. Agendados de
      // uma vez, no pior caso todos disparam juntos — a conversa aparece de
      // uma vez, que é o mesmo destino.
      let quando = 0;
      falas.forEach((fala, i) => {
        if (fala.digitandoMs > 0) {
          timers.push(window.setTimeout(() => setDigitando(fala.lado), quando));
          quando += fala.digitandoMs;
        }
        timers.push(
          window.setTimeout(() => {
            setDigitando(null);
            setDitas(i + 1);
          }, quando),
        );
        // Uma pausa curta depois de cada fala: sem ela, o "digitando" do
        // próximo nasce no mesmo quadro em que o balão anterior aparece, e os
        // dois lêem como um piscar só.
        quando += 420;
      });
    };

    const observador = new IntersectionObserver(
      (entradas) => {
        if (!entradas.some((e) => e.isIntersecting)) return;
        encenar();
        observador.disconnect();
      },
      { threshold: 0.2 },
    );
    observador.observe(elemento);

    const cinto = window.setTimeout(() => {
      setDigitando(null);
      setDitas(falas.length);
    }, TETO_MS);

    return () => {
      for (const t of timers) window.clearTimeout(t);
      window.clearTimeout(cinto);
      observador.disconnect();
    };
  }, [vivo, falas]);

  return (
    <div ref={alvo} className={className}>
      {falas.slice(0, ditas).map((fala, i) => (
        <div key={i} className={vivo ? "conversa-fala" : undefined}>
          {fala.balao}
        </div>
      ))}
      {digitando ? <Digitando lado={digitando} /> : null}
    </div>
  );
}

/**
 * Os três pontos, do lado de quem está compondo.
 *
 * Mora no mesmo lugar em que o balão vai nascer — à esquerda para o cliente, à
 * direita para o agente. Um indicador centralizado, ou sempre do mesmo lado,
 * obrigaria o olho a reencontrar a resposta quando ela chegasse.
 *
 * `role="status"` com `aria-label` porque isto é informação, não enfeite: quem
 * usa leitor de tela precisa saber que há resposta a caminho. Os pontos em si
 * são `aria-hidden` — ouvir "ponto ponto ponto" não ajuda ninguém.
 */
function Digitando({ lado }: { lado: "cliente" | "agente" }) {
  const doAgente = lado === "agente";
  return (
    <div className={doAgente ? "flex justify-end" : "flex justify-start"}>
      <div
        role="status"
        aria-label={doAgente ? "Respondendo" : "Digitando"}
        className={
          doAgente
            ? "flex items-center gap-1 rounded-lg rounded-br-sm bg-accent px-3.5 py-3 shadow-xs"
            : "flex items-center gap-1 rounded-lg rounded-bl-sm bg-surface-elevated px-3.5 py-3 shadow-xs"
        }
      >
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            aria-hidden
            data-ponto={i}
            className={
              doAgente
                ? "conversa-ponto size-1.5 rounded-full bg-accent-foreground/70"
                : "conversa-ponto size-1.5 rounded-full bg-text-subtle"
            }
          />
        ))}
      </div>
    </div>
  );
}
