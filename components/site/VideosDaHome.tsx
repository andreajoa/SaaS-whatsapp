"use client";

import Image from "next/image";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Pause, Play, VolumeX } from "lucide-react";

import styles from "./atenza-home.module.css";

const MEDIA = "/media/atenza";

/** A mídia só é transferida perto da seção e não volta a tocar depois de uma pausa voluntária. */
export function VideoDeContexto({
  textos,
}: {
  readonly textos: {
    alt: string;
    semSom: string;
    pausar: string;
    tocar: string;
    indisponivel: string;
  };
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const pausaVoluntaria = useRef(false);
  const [tocando, setTocando] = useState(false);
  const [erro, setErro] = useState(false);

  useEffect(() => {
    const video = ref.current;
    if (!video || typeof IntersectionObserver === "undefined") return;
    const movimento = window.matchMedia("(prefers-reduced-motion: reduce)");
    const connection = (navigator as Navigator & { connection?: { saveData?: boolean } })
      .connection;
    let visivel = false;
    const atualizar = () => {
      if (
        visivel &&
        document.visibilityState === "visible" &&
        !movimento.matches &&
        !connection?.saveData &&
        !pausaVoluntaria.current
      ) {
        if (!video.getAttribute("src")) video.src = `${MEDIA}/atendimento-loop.mp4`;
        void video.play().catch(() => {});
      } else video.pause();
    };
    const observer = new IntersectionObserver(
      (entradas) => {
        visivel = entradas.some((e) => e.isIntersecting);
        atualizar();
      },
      { threshold: 0.25 },
    );
    observer.observe(video);
    document.addEventListener("visibilitychange", atualizar);
    movimento.addEventListener("change", atualizar);
    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", atualizar);
      movimento.removeEventListener("change", atualizar);
      video.pause();
    };
  }, []);

  async function alternar() {
    const video = ref.current;
    if (!video || erro) return;
    if (!video.paused) {
      pausaVoluntaria.current = true;
      video.pause();
    } else {
      pausaVoluntaria.current = false;
      if (!video.getAttribute("src")) video.src = `${MEDIA}/atendimento-loop.mp4`;
      try {
        await video.play();
      } catch {
        /* A ação pode ser repetida se a política do navegador recusar. */
      }
    }
  }

  return (
    <div className={styles.contextVideo}>
      <Image
        src={`${MEDIA}/atendimento.webp`}
        alt={textos.alt}
        fill
        sizes="(max-width: 767px) 100vw, 58vw"
        className={styles.contextPoster}
      />
      <video
        ref={ref}
        muted
        loop
        playsInline
        preload="none"
        poster={`${MEDIA}/atendimento.webp`}
        aria-label={textos.alt}
        onPlay={() => setTocando(true)}
        onPause={() => setTocando(false)}
        onError={() => setErro(true)}
      />
      <span className={styles.silentLabel}>
        <VolumeX size={15} aria-hidden />
        {textos.semSom}
      </span>
      {!erro && (
        <button
          className={styles.videoPause}
          type="button"
          aria-label={tocando ? textos.pausar : textos.tocar}
          onClick={() => {
            void alternar();
          }}
        >
          {tocando ? <Pause size={18} aria-hidden /> : <Play size={18} aria-hidden />}
        </button>
      )}
      {erro && (
        <span className={styles.videoError} role="status">
          {textos.indisponivel}
        </span>
      )}
    </div>
  );
}

export interface TextosDoVideo {
  titulo: string;
  descricao: string;
  fechar: string;
  legendas: string;
  transcricao: string;
  indisponivel: string;
  paragrafo1: string;
  paragrafo2: string;
  paragrafo3: string;
  paragrafo4: string;
}

/** A capa dá lugar ao player no mesmo bloco; a mídia só carrega após o clique. */
export function VideoExplicativo({
  children,
  textos,
  className,
}: {
  readonly children: ReactNode;
  readonly textos: TextosDoVideo;
  readonly className?: string;
}) {
  const [iniciado, setIniciado] = useState(false);
  const [erro, setErro] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const capaRef = useRef<HTMLButtonElement>(null);
  const iniciadoAntes = useRef(false);

  useEffect(() => {
    const video = videoRef.current;
    if (iniciado) video?.focus();
    else if (iniciadoAntes.current) capaRef.current?.focus();
    iniciadoAntes.current = iniciado;
    return () => video?.pause();
  }, [iniciado]);

  return (
    <div id="video-explicativo" className={styles.inlinePlayer}>
      {!iniciado ? (
        <button
          ref={capaRef}
          type="button"
          className={className}
          onClick={() => {
            setErro(false);
            setIniciado(true);
          }}
        >
          {children}
        </button>
      ) : (
        <div role="region" aria-label={textos.titulo}>
          <p className="sr-only">{textos.descricao}</p>
          <div className={styles.inlineVideoFrame}>
            <video
              ref={videoRef}
              tabIndex={0}
              aria-label={textos.titulo}
              controls
              autoPlay
              playsInline
              preload="metadata"
              poster={`${MEDIA}/explainer-thumbnail.webp`}
              className={styles.inlineVideo}
              onError={() => setErro(true)}
            >
              <source src={`${MEDIA}/atenza-explica.mp4`} type="video/mp4" />
              <track
                src={`${MEDIA}/atenza-explica.vtt`}
                kind="captions"
                srcLang="pt-BR"
                label={textos.legendas}
                default
              />
            </video>
          </div>
          {erro && <p role="alert">{textos.indisponivel}</p>}
          <div className={styles.inlineVideoActions}>
            <button type="button" onClick={() => setIniciado(false)}>
              {textos.fechar}
            </button>
          </div>
          <details className={styles.transcript}>
            <summary>{textos.transcricao}</summary>
            {[textos.paragrafo1, textos.paragrafo2, textos.paragrafo3, textos.paragrafo4].map(
              (p) => (
                <p key={p}>{p}</p>
              ),
            )}
          </details>
        </div>
      )}
    </div>
  );
}
