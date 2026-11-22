"use client";

import { useEffect, useState } from "react";

import styles from "./atenza-home.module.css";

export interface BolhaHero {
  readonly role: "in" | "out";
  readonly text: string;
  readonly link?: string;
}

export interface SlideHero {
  readonly titulo: string;
  readonly contato: string;
  readonly status: string;
  readonly bolhas: readonly BolhaHero[];
}

export interface TextosHeroCelular {
  readonly ariaCelular: string;
  readonly ariaPontos: string;
  readonly entradaPlaceholder: string;
  readonly agora: string;
  readonly seloAoVivoTitulo: string;
  readonly seloAoVivoSubtitulo: string;
  readonly previewUmRotulo: string;
  readonly previewUmTitulo: string;
  readonly previewDoisRotulo: string;
  readonly previewDoisTitulo: string;
  readonly slides: readonly SlideHero[];
}

export function HeroCelularAtenza({ textos }: { readonly textos: TextosHeroCelular }) {
  const [slideAtual, setSlideAtual] = useState(0);
  const [visiveis, setVisiveis] = useState(() => textos.slides[0]?.bolhas.length ?? 0);
  const [digitando, setDigitando] = useState(false);

  const slide = textos.slides[slideAtual] ?? textos.slides[0]!;

  useEffect(() => {
    let cancelado = false;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const agendar = (fn: () => void, ms: number) => {
      const id = setTimeout(() => {
        if (!cancelado) fn();
      }, ms);
      timers.push(id);
    };

    const reduzido =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduzido) {
      agendar(() => {
        setVisiveis(slide.bolhas.length);
        setDigitando(false);
      }, 0);
      return () => {
        cancelado = true;
        timers.forEach(clearTimeout);
      };
    }

    const iniciar = () => {
      agendar(() => {
        setVisiveis(1);
        setDigitando(false);
      }, 0);
      let passo = 1;

      const proximo = () => {
        if (cancelado) return;
        if (passo >= slide.bolhas.length) {
          agendar(() => {
            setSlideAtual((atual) => (atual + 1) % textos.slides.length);
          }, 3400);
          return;
        }
        const proximaBolha = slide.bolhas[passo];
        const indiceAtual = passo;
        passo += 1;

        if (proximaBolha?.role === "out") {
          setDigitando(true);
          agendar(() => {
            setDigitando(false);
            setVisiveis(indiceAtual + 1);
            agendar(proximo, 1550);
          }, 780);
        } else {
          setVisiveis(indiceAtual + 1);
          agendar(proximo, 1450);
        }
      };

      agendar(proximo, 1100);
    };

    if (typeof document === "undefined" || !document.hidden) {
      iniciar();
    }

    const aoMudarVisibilidade = () => {
      timers.forEach(clearTimeout);
      timers.length = 0;
      if (!document.hidden) iniciar();
    };
    document.addEventListener("visibilitychange", aoMudarVisibilidade);

    return () => {
      cancelado = true;
      timers.forEach(clearTimeout);
      document.removeEventListener("visibilitychange", aoMudarVisibilidade);
    };
  }, [slide, textos.slides.length]);

  const inicial = slide.contato.charAt(0).toUpperCase();

  return (
    <div className={styles.heroVisual}>
      <div className={styles.heroHalo} aria-hidden />
      <div className={styles.heroPhone} aria-label={textos.ariaCelular}>
        <div className={styles.heroIsland} aria-hidden />
        <div className={styles.heroPhoneHead}>
          <span aria-hidden>‹</span>
          <span className={styles.heroPhoneAvatar} aria-hidden>
            {inicial}
          </span>
          <span>
            {slide.contato}
            <span className={styles.heroPhoneStatus}>{slide.status}</span>
          </span>
          <span className={styles.heroPhoneMenu} aria-hidden>
            ⋯
          </span>
        </div>
        <div className={styles.heroPhoneBody} aria-live="off">
          {slide.bolhas.slice(0, visiveis).map((bolha, idx) => (
            <div
              key={`${slideAtual}-${idx}`}
              className={`${styles.heroBubble} ${
                bolha.role === "out" ? styles.heroBubbleOut : styles.heroBubbleIn
              }`}
            >
              <span>{bolha.text}</span>
              {bolha.link ? <div className={styles.heroLinkCard}>{bolha.link}</div> : null}
              <small>{textos.agora}</small>
            </div>
          ))}
          {digitando ? (
            <div className={styles.heroTyping} aria-hidden>
              •••
            </div>
          ) : null}
        </div>
        <div className={styles.heroPhoneInput} aria-hidden>
          <span>{textos.entradaPlaceholder}</span>
          <span>⊕</span>
        </div>
        <div className={styles.heroHomebar} aria-hidden />
      </div>

      <div className={styles.heroLive}>
        <i aria-hidden />
        <span>
          {textos.seloAoVivoTitulo}
          <small>{textos.seloAoVivoSubtitulo}</small>
        </span>
      </div>

      <div className={`${styles.heroPreview} ${styles.heroPreviewTwo}`} aria-hidden>
        <div className={styles.heroPreviewLabel}>{textos.previewDoisRotulo}</div>
        <div className={styles.heroPreviewArt}>{textos.previewDoisTitulo}</div>
      </div>

      <div className={styles.heroPreview} aria-hidden>
        <div className={styles.heroPreviewLabel}>{textos.previewUmRotulo}</div>
        <div className={styles.heroPreviewArt}>{textos.previewUmTitulo}</div>
      </div>

      <div className={styles.heroDots} role="tablist" aria-label={textos.ariaPontos}>
        {textos.slides.map((s, idx) => (
          <button
            key={s.titulo}
            type="button"
            role="tab"
            aria-selected={slideAtual === idx}
            aria-label={s.titulo}
            className={slideAtual === idx ? styles.heroDotActive : ""}
            onClick={() => setSlideAtual(idx)}
          />
        ))}
      </div>
    </div>
  );
}
