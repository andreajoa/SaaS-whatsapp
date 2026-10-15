"use client";

import { useId, useState } from "react";
import {
  ArrowRight,
  Bot,
  Check,
  CheckCheck,
  FileText,
  Inbox,
  MessageCircle,
  Search,
  Send,
  ShieldCheck,
  SquareKanban,
  Users,
} from "lucide-react";

import { ConversaAoVivo } from "./ConversaAoVivo";
import styles from "./atenza-home.module.css";

export interface TextosDoProduto {
  demonstracao: string;
  titulo: string;
  conversas: string;
  agentes: string;
  funil: string;
  fila: string;
  minhas: string;
  todas: string;
  contato: string;
  historico: string;
  equipe: string;
  escrever: string;
  nota: string;
  atribuida: string;
  conhecimento: string;
  documentos: string;
  limites: string;
  limiteTexto: string;
  transferencia: string;
  transferenciaTexto: string;
  oportunidade: string;
  etapa1: string;
  etapa2: string;
  etapa3: string;
  etapa4: string;
  proximo: string;
  mover: string;
  demonstracaoTexto: string;
}

/** Uma demonstração local: abas e etapas respondem ao clique, sem dados de clientes ou envio. */
/**
 * A história de UM negócio na demonstração. Cada quadro da página recebe a
 * sua: os dois mostrando a mesma conversa pareciam um print repetido.
 */
export type CenarioDaDemonstracao = {
  readonly nome: string;
  readonly perfil: string;
  readonly pergunta: string;
  readonly resposta: string;
  readonly segunda: string;
  readonly proximoTexto: string;
  readonly documentos: readonly [string, string, string];
  readonly outros: readonly { nome: string; ultima: string }[];
};

export function ProdutoDemonstracao({
  textos,
  cenario,
  compacto = false,
  marca,
}: {
  readonly textos: TextosDoProduto;
  readonly cenario: CenarioDaDemonstracao;
  readonly compacto?: boolean;
  readonly marca: string;
}) {
  const inicial = cenario.nome.charAt(0);
  const [aba, setAba] = useState(0);
  const [etapa, setEtapa] = useState(1);
  const id = useId();
  const abas = [textos.conversas, textos.agentes, textos.funil];
  const icones = [MessageCircle, Bot, SquareKanban];
  const etapas = [textos.etapa1, textos.etapa2, textos.etapa3, textos.etapa4];

  return (
    <div className={`${styles.product} ${compacto ? styles.productCompact : ""}`}>
      {!compacto && (
        <div className={styles.productTabs} role="tablist" aria-label={textos.titulo}>
          {abas.map((texto, i) => {
            const Icone = icones[i]!;
            return (
              <button
                key={texto}
                id={`${id}-tab-${i}`}
                type="button"
                role="tab"
                aria-selected={aba === i}
                aria-controls={`${id}-panel-${i}`}
                tabIndex={aba === i ? 0 : -1}
                onClick={() => setAba(i)}
                onKeyDown={(event) => {
                  const nova =
                    event.key === "ArrowRight"
                      ? (i + 1) % 3
                      : event.key === "ArrowLeft"
                        ? (i + 2) % 3
                        : event.key === "Home"
                          ? 0
                          : event.key === "End"
                            ? 2
                            : null;
                  if (nova !== null) {
                    event.preventDefault();
                    setAba(nova);
                    document.getElementById(`${id}-tab-${nova}`)?.focus();
                  }
                }}
              >
                <Icone size={17} aria-hidden />
                {texto}
              </button>
            );
          })}
        </div>
      )}
      <div className={styles.productWindow}>
        <aside className={styles.productRail} aria-hidden>
          <span className={styles.productBrand}>{marca}</span>
          <span className={styles.railSelected}>
            <Inbox size={19} />
            {textos.conversas}
          </span>
          <span>
            <SquareKanban size={19} />
            {textos.funil}
          </span>
          <span>
            <Users size={19} />
            {textos.contato}
          </span>
          <span>
            <Bot size={19} />
            {textos.agentes}
          </span>
          <span>
            <ShieldCheck size={19} />
            {textos.limites}
          </span>
        </aside>
        <div
          className={styles.productPanel}
          id={`${id}-panel-${aba}`}
          role={compacto ? undefined : "tabpanel"}
          aria-labelledby={compacto ? undefined : `${id}-tab-${aba}`}
          tabIndex={compacto ? undefined : 0}
        >
          {aba === 0 && (
            <div className={styles.inboxLayout}>
              <aside className={styles.contactList} aria-label={textos.contato}>
                <div className={styles.listHeading}>
                  <strong>Inbox</strong>
                  <Search size={17} aria-hidden />
                </div>
                <div className={styles.listFilters}>
                  <b>{textos.fila}</b>
                  <span>{textos.minhas}</span>
                  <span>{textos.todas}</span>
                </div>
                {[
                  [inicial, cenario.nome, cenario.pergunta],
                  ...cenario.outros.map((o) => [o.nome.charAt(0), o.nome, o.ultima]),
                ].map(([letra, nome, mensagem], i) => (
                  <div
                    key={nome}
                    className={`${styles.contactRow} ${i === 0 ? styles.contactSelected : ""}`}
                  >
                    <span className={styles.avatar}>{letra}</span>
                    <div>
                      <strong>{nome}</strong>
                      <p>{mensagem}</p>
                    </div>
                  </div>
                ))}
              </aside>
              <div className={styles.chat}>
                <div className={styles.chatHeading}>
                  <span className={styles.avatar}>{inicial}</span>
                  <div>
                    <strong>{cenario.nome}</strong>
                    <span>{textos.atribuida}</span>
                  </div>
                  <span className={styles.demoLabel}>{textos.demonstracao}</span>
                </div>
                <div className={styles.messages}>
                  <span className={styles.historyLabel}>{textos.historico}</span>
                  <ConversaAoVivo
                    className={styles.conversaViva}
                    repetirAposMs={5000}
                    classeDaFala={(lado) =>
                      lado === "agente" ? "flex w-full justify-end" : "flex w-full"
                    }
                    falas={[
                      {
                        lado: "cliente",
                        digitandoMs: 0,
                        balao: (
                          <div className={styles.received}>
                            {cenario.pergunta}
                            <small>10:21</small>
                          </div>
                        ),
                      },
                      {
                        lado: "agente",
                        digitandoMs: 1300,
                        balao: (
                          <div className={styles.sent}>
                            {cenario.resposta}
                            <small>
                              10:22 <CheckCheck size={13} aria-hidden />
                            </small>
                          </div>
                        ),
                      },
                      {
                        lado: "cliente",
                        digitandoMs: 2000,
                        balao: (
                          <div className={styles.received}>
                            {cenario.segunda}
                            <small>10:23</small>
                          </div>
                        ),
                      },
                    ]}
                  />
                </div>
                <div className={styles.composer} aria-hidden>
                  <span>{textos.escrever}</span>
                  <span>
                    <Send size={18} />
                  </span>
                </div>
              </div>
              <aside className={styles.contactDetails}>
                <strong>{textos.contato}</strong>
                <span className={styles.avatarLarge}>{inicial}</span>
                <b>{cenario.nome}</b>
                <p>{cenario.perfil}</p>
                <hr />
                <strong>{textos.funil}</strong>
                <span>{textos.etapa2}</span>
                <strong>{textos.proximo}</strong>
                <p>{cenario.proximoTexto}</p>
              </aside>
            </div>
          )}
          {aba === 1 && (
            <div className={styles.agentDemo}>
              <div className={styles.agentHeader}>
                <span className={styles.agentIcon}>
                  <Bot size={30} aria-hidden />
                </span>
                <div>
                  <h3>{textos.conhecimento}</h3>
                  <p>{textos.documentos}</p>
                </div>
              </div>
              <div className={styles.agentColumns}>
                <div className={styles.documents}>
                  {cenario.documentos.map((documento) => (
                    <div key={documento}>
                      <FileText size={21} aria-hidden />
                      <span>{documento}</span>
                      <Check size={16} aria-hidden />
                    </div>
                  ))}
                </div>
                <div className={styles.agentRules}>
                  <ShieldCheck size={24} aria-hidden />
                  <h4>{textos.limites}</h4>
                  <p>{textos.limiteTexto}</p>
                  <h4>{textos.transferencia}</h4>
                  <p>{textos.transferenciaTexto}</p>
                </div>
              </div>
            </div>
          )}
          {aba === 2 && (
            <div className={styles.pipelineDemo}>
              <div className={styles.pipelineHeading}>
                <h3>{textos.oportunidade}</h3>
                <span className={styles.demoLabel}>{textos.demonstracao}</span>
              </div>
              <div className={styles.pipelineColumns}>
                {etapas.map((nome, i) => (
                  <div key={nome} className={styles.pipelineColumn}>
                    <h4>{nome}</h4>
                    {etapa === i && (
                      <div className={styles.pipelineCard}>
                        <span>{cenario.nome}</span>
                        <strong>{cenario.pergunta}</strong>
                        <p>{cenario.proximoTexto}</p>
                        <label>
                          {textos.mover}
                          <select
                            value={etapa}
                            onChange={(event) => setEtapa(Number(event.target.value))}
                          >
                            {etapas.map((texto, valor) => (
                              <option key={texto} value={valor}>
                                {texto}
                              </option>
                            ))}
                          </select>
                        </label>
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <p className={styles.pipelineHint}>
                <ArrowRight size={16} aria-hidden />
                {textos.demonstracaoTexto}
              </p>
            </div>
          )}
        </div>
      </div>
      {!compacto && <p className={styles.productDisclaimer}>{textos.nota}</p>}
    </div>
  );
}
