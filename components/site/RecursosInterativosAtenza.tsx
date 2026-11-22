"use client";

import Link from "next/link";
import { useEffect, useId, useState } from "react";

import styles from "./atenza-home.module.css";

export interface RecursoInterativoItem {
  readonly rotulo: string;
  readonly titulo: string;
  readonly descricao: string;
  readonly mensagens: readonly string[];
}

export interface TextosRecursosInterativos {
  readonly titulo: string;
  readonly subtitulo: string;
  readonly ariaLista: string;
  readonly ariaCelular: string;
  readonly cabecalhoCelular: string;
  readonly ctaRotulo: string;
  readonly ctaHref: string;
  readonly itens: readonly RecursoInterativoItem[];
}

export function RecursosInterativosAtenza({
  textos,
  marca,
}: {
  readonly textos: TextosRecursosInterativos;
  readonly marca: string;
}) {
  const [ativo, setAtivo] = useState(0);
  const [mensagensVisiveis, setMensagensVisiveis] = useState(
    () => textos.itens[0]?.mensagens.length ?? 0,
  );
  const [textoDigitado, setTextoDigitado] = useState(() => textos.itens[0]?.descricao ?? "");
  const baseId = useId();
  const item = textos.itens[ativo] ?? textos.itens[0]!;

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
        setMensagensVisiveis(item.mensagens.length);
        setTextoDigitado(item.descricao);
      }, 0);
      return () => {
        cancelado = true;
        timers.forEach(clearTimeout);
      };
    }

    const digitar = (indice: number) => {
      if (cancelado) return;
      setTextoDigitado(item.descricao.slice(0, indice));
      if (indice < item.descricao.length) {
        agendar(() => digitar(indice + 1), 18);
      }
    };

    agendar(() => {
      setMensagensVisiveis(1);
      digitar(0);
    }, 0);

    item.mensagens.forEach((_, idx) => {
      if (idx === 0) return;
      agendar(() => setMensagensVisiveis(idx + 1), 600 + idx * 1400);
    });

    agendar(() => {
      setAtivo((atual) => (atual + 1) % textos.itens.length);
    }, 10500);

    return () => {
      cancelado = true;
      timers.forEach(clearTimeout);
    };
  }, [item, textos.itens.length]);

  const inicialMarca = marca.charAt(0).toUpperCase();

  return (
    <section
      className={styles.featuresShowcase}
      id="recursos-detalhes"
      aria-labelledby="features-title"
    >
      <svg
        className={styles.featuresTopWave}
        viewBox="0 0 1440 64"
        preserveAspectRatio="none"
        aria-hidden="true"
        focusable="false"
      >
        <path d="M0 0H1440V43 C1320 30 1230 42 1110 45 S880 39 765 47 S510 32 360 44 S140 49 0 43 Z" />
      </svg>
      <div className={styles.featuresWrap}>
        <div className={styles.featuresHead}>
          <h2 id="features-title">{textos.titulo}</h2>
          <p>{textos.subtitulo}</p>
        </div>
        <div className={styles.featuresLayout}>
          <div className={styles.featuresMenu} role="tablist" aria-label={textos.ariaLista}>
            {textos.itens.map((recurso, idx) => (
              <button
                key={recurso.rotulo}
                id={`${baseId}-tab-${idx}`}
                type="button"
                role="tab"
                aria-selected={ativo === idx}
                aria-controls={`${baseId}-panel`}
                tabIndex={ativo === idx ? 0 : -1}
                onClick={() => setAtivo(idx)}
                onKeyDown={(e) => {
                  if (
                    e.key !== "ArrowRight" &&
                    e.key !== "ArrowLeft" &&
                    e.key !== "ArrowDown" &&
                    e.key !== "ArrowUp"
                  ) {
                    return;
                  }
                  e.preventDefault();
                  const delta = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : -1;
                  const next = (idx + delta + textos.itens.length) % textos.itens.length;
                  setAtivo(next);
                  document.getElementById(`${baseId}-tab-${next}`)?.focus();
                }}
              >
                {recurso.rotulo}
              </button>
            ))}
          </div>

          <div className={styles.featuresPhone} aria-label={textos.ariaCelular}>
            <div className={styles.featuresPhoneHeading}>
              <span className={styles.featuresPhoneAvatar} aria-hidden>
                {inicialMarca}
              </span>
              <span>
                {marca} · {textos.cabecalhoCelular}
              </span>
            </div>
            <div className={styles.featuresPhoneMessages} aria-live="off">
              {item.mensagens.slice(0, mensagensVisiveis).map((msg, idx) => (
                <div
                  key={`${ativo}-${idx}`}
                  className={`${styles.featuresMessage} ${
                    idx % 2 === 1 ? styles.featuresMessageRight : ""
                  }`}
                >
                  {msg}
                </div>
              ))}
            </div>
          </div>

          <div
            className={styles.featuresCopy}
            id={`${baseId}-panel`}
            role="tabpanel"
            aria-labelledby={`${baseId}-tab-${ativo}`}
          >
            <h3>{item.titulo}</h3>
            <p>
              <span>{textoDigitado}</span>
              <span className={styles.featuresCaret} aria-hidden />
            </p>
          </div>
        </div>
        <div className={styles.featuresAllCta}>
          <Link href={textos.ctaHref}>
            {textos.ctaRotulo} <span aria-hidden>→</span>
          </Link>
        </div>
      </div>
    </section>
  );
}
