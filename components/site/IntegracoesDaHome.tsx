"use client";

import { useState } from "react";
import {
  Braces,
  Cloud,
  MessageCircle,
  Pause,
  Play,
  ShoppingBag,
  Store,
  Webhook,
} from "lucide-react";

import styles from "./atenza-home.module.css";

const integracoes = [
  { nome: "Shopify", Icone: ShoppingBag },
  { nome: "WooCommerce", Icone: Store },
  { nome: "Nuvemshop", Icone: Cloud },
  { nome: "WhatsApp", Icone: MessageCircle },
  { nome: "API", Icone: Braces },
  { nome: "Webhooks", Icone: Webhook },
];

export function IntegracoesDaHome({
  pausar,
  continuar,
  rotulo,
}: {
  readonly pausar: string;
  readonly continuar: string;
  readonly rotulo: string;
}) {
  const [pausado, setPausado] = useState(false);
  return (
    <div className={styles.integrationsMotion} data-paused={pausado}>
      <ul className="sr-only" aria-label={rotulo}>
        {integracoes.map((item) => (
          <li key={item.nome}>{item.nome}</li>
        ))}
      </ul>
      <div className={styles.logoViewport} aria-hidden>
        {[false, true].map((reverso) => (
          <div
            key={String(reverso)}
            className={`${styles.logoTrack} ${reverso ? styles.logoTrackReverse : ""}`}
          >
            {[0, 1, 2].map((copia) => (
              <div className={styles.logoGroup} key={copia}>
                {integracoes.map((item) => (
                  <div className={styles.logoTile} key={item.nome}>
                    <item.Icone size={34} />
                    <span>{item.nome}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        ))}
      </div>
      <button
        type="button"
        className={styles.motionControl}
        aria-pressed={pausado}
        onClick={() => setPausado(!pausado)}
      >
        {pausado ? <Play size={14} aria-hidden /> : <Pause size={14} aria-hidden />}
        {pausado ? continuar : pausar}
      </button>
    </div>
  );
}
