"use client";

import Image from "next/image";
import { useId, useState } from "react";

import styles from "./atenza-home.module.css";

export interface PublicoSegmento {
  readonly arquivo: string;
  readonly alt: string;
  readonly nome: string;
  readonly resumo: string;
  readonly titulo: string;
  readonly texto: string;
  readonly gatilho: string;
  readonly passo1: string;
  readonly resposta: string;
  readonly passo3: string;
  readonly categorias: string;
  readonly beneficios: readonly { readonly titulo: string; readonly texto: string }[];
}

export interface TextosPublicos {
  readonly eyebrow: string;
  readonly titulo: string;
  readonly subtitulo: string;
  readonly ariaAbas: string;
  readonly respostaAutomatica: string;
  readonly proximoPasso: string;
  readonly comoUsar: string;
  readonly nota: string;
  readonly estatisticas: readonly { readonly valor: string; readonly rotulo: string }[];
  readonly itens: readonly PublicoSegmento[];
}

export function PublicosInterativosAtenza({ textos }: { readonly textos: TextosPublicos }) {
  const [ativo, setAtivo] = useState(0);
  const baseId = useId();
  const atual = textos.itens[ativo] ?? textos.itens[0]!;

  return (
    <section className={styles.audienceSection} id="recursos" aria-labelledby="audience-title">
      <div className={styles.audienceInner}>
        <div className={styles.audienceEyebrow}>{textos.eyebrow}</div>
        <h2 id="audience-title">{textos.titulo}</h2>
        <p className={styles.audienceIntro}>{textos.subtitulo}</p>

        <div className={styles.audienceStats}>
          {textos.estatisticas.map((stat) => (
            <div key={stat.rotulo}>
              <strong>{stat.valor}</strong> {stat.rotulo}
            </div>
          ))}
        </div>

        <div className={styles.audienceTabs} role="tablist" aria-label={textos.ariaAbas}>
          {textos.itens.map((item, idx) => (
            <button
              key={item.arquivo}
              id={`${baseId}-tab-${idx}`}
              type="button"
              role="tab"
              aria-selected={ativo === idx}
              aria-controls={`${baseId}-panel`}
              tabIndex={ativo === idx ? 0 : -1}
              className={styles.audienceTab}
              onClick={() => setAtivo(idx)}
              onKeyDown={(e) => {
                if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
                e.preventDefault();
                const delta = e.key === "ArrowRight" ? 1 : -1;
                const next = (idx + delta + textos.itens.length) % textos.itens.length;
                setAtivo(next);
                document.getElementById(`${baseId}-tab-${next}`)?.focus();
              }}
            >
              <strong>{item.nome}</strong>
              <small>{item.resumo}</small>
            </button>
          ))}
        </div>

        <div
          className={styles.audienceDetail}
          id={`${baseId}-panel`}
          role="tabpanel"
          aria-labelledby={`${baseId}-tab-${ativo}`}
        >
          <div>
            <span className={styles.audienceChip}>{atual.nome}</span>
            <h3>{atual.titulo}</h3>
            <p>{atual.texto}</p>
            <div className={styles.audienceExample}>
              <div>
                <b>{atual.gatilho}</b>
                <span>{atual.passo1}</span>
              </div>
              <div>
                <b className={styles.audienceExampleBrand}>{atual.resposta}</b>
                <span>{textos.respostaAutomatica}</span>
              </div>
              <div>
                <b className={styles.audienceExampleMint}>{textos.proximoPasso}</b>
                <span>{atual.passo3}</span>
              </div>
            </div>
          </div>

          <div className={styles.audienceSide}>
            <div className={styles.audiencePhotoWrap}>
              <Image
                src={`/media/atenza/${atual.arquivo}`}
                alt={atual.alt}
                fill
                sizes="(max-width: 750px) 100vw, 480px"
              />
            </div>
            <h4>{textos.comoUsar}</h4>
            <div className={styles.audienceCategories}>{atual.categorias}</div>
            <div className={styles.audienceBenefits}>
              {atual.beneficios.map((b) => (
                <div key={b.titulo}>
                  <strong>{b.titulo}</strong>
                  <small>{b.texto}</small>
                </div>
              ))}
            </div>
          </div>
        </div>
        <p className={styles.audienceFootnote}>{textos.nota}</p>
      </div>
    </section>
  );
}
