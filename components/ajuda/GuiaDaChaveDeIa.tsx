"use client";

import { useState } from "react";
import {
  ArrowUpRight,
  Clock3,
  CreditCard,
  MessageCircleQuestion,
  TriangleAlert,
} from "lucide-react";

import type { GuiaCompleto, ProvedorDoGuia } from "@/lib/ajuda/guia-chave-ia";
import styles from "./guia.module.css";

/**
 * O guia da chave de IA — o mesmo componente no site público e dentro do
 * produto (Credenciais). Abas por provedor, passos numerados com o link exato
 * de cada página, e um "assistente" de perguntas prontas que responde em forma
 * de conversa: o dono de empresa toca na dúvida em vez de procurar num texto.
 */
export function GuiaDaChaveDeIa({
  guia,
  inicial = "openai",
  compacto = false,
}: {
  readonly guia: GuiaCompleto;
  readonly inicial?: ProvedorDoGuia;
  /** Dentro do produto: sem o título grande. */
  readonly compacto?: boolean;
}) {
  const [ativo, setAtivo] = useState<ProvedorDoGuia>(inicial);
  const [conversa, setConversa] = useState<number[]>([]);
  const provedor = guia.provedores.find((p) => p.id === ativo) ?? guia.provedores[0]!;

  return (
    <div className={styles.guia}>
      {!compacto && (
        <header className={styles.topo}>
          <h2>{guia.titulo}</h2>
          <p>{guia.intro}</p>
        </header>
      )}
      <p className={styles.recomendacao}>{guia.recomendacao}</p>

      <div className={styles.abas} role="tablist" aria-label={guia.ui.passos}>
        {guia.provedores.map((p) => (
          <button
            key={p.id}
            type="button"
            role="tab"
            aria-selected={p.id === ativo}
            className={styles.aba}
            onClick={() => setAtivo(p.id)}
          >
            <strong>{p.nome}</strong>
            {p.selo && <span>{p.selo}</span>}
          </button>
        ))}
      </div>

      <section className={styles.painel} role="tabpanel" aria-label={provedor.nome}>
        <p className={styles.resumo}>{provedor.resumo}</p>
        <div className={styles.fatos}>
          <span>
            <CreditCard size={16} aria-hidden /> <b>{guia.ui.custo}:</b> {provedor.custo}
          </span>
          <span>
            <Clock3 size={16} aria-hidden /> <b>{guia.ui.tempo}:</b> {provedor.tempo}
          </span>
        </div>
        <ol className={styles.passos}>
          {provedor.passos.map((passo, i) => (
            <li key={passo.titulo}>
              <span className={styles.numero}>{i + 1}</span>
              <div>
                <strong>{passo.titulo}</strong>
                <p>{passo.texto}</p>
                {passo.link && (
                  <a
                    href={passo.link.href}
                    {...(passo.link.href.startsWith("http")
                      ? { target: "_blank", rel: "noopener noreferrer" }
                      : {})}
                    className={styles.link}
                  >
                    {passo.link.rotulo}
                    <ArrowUpRight size={15} aria-hidden />
                  </a>
                )}
              </div>
            </li>
          ))}
        </ol>
        {provedor.atencao && (
          <p className={styles.atencao}>
            <TriangleAlert size={16} aria-hidden />
            <span>
              <b>{guia.ui.atencao}:</b> {provedor.atencao}
            </span>
          </p>
        )}
      </section>

      <section className={styles.assistente} aria-label={guia.assistenteTitulo}>
        <h3>
          <MessageCircleQuestion size={18} aria-hidden /> {guia.assistenteTitulo}
        </h3>
        <p className={styles.dica}>{guia.assistenteIntro}</p>
        {conversa.length > 0 && (
          <ol className={styles.conversa} aria-live="polite">
            {conversa.map((i, k) => (
              <li key={`${i}-${k}`}>
                <p data-de="cliente">{guia.perguntas[i]!.pergunta}</p>
                <p data-de="agente">{guia.perguntas[i]!.resposta}</p>
              </li>
            ))}
          </ol>
        )}
        <div className={styles.perguntas}>
          {guia.perguntas.map((p, i) => (
            <button
              key={p.pergunta}
              type="button"
              disabled={conversa.includes(i)}
              onClick={() => setConversa((c) => [...c, i])}
            >
              {p.pergunta}
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
