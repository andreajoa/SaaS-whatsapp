"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { X } from "lucide-react";

import { CapturaDeLead, type TextosDaCaptura } from "@/components/site/CapturaDeLead";

/**
 * O CONVITE — o pop-up que pede o e-mail, e as regras que o impedem de irritar.
 *
 * ─── Por que ele não aparece na chegada ────────────────────────────────────
 *
 * Um pop-up que cobre a página antes de a pessoa ler a primeira frase pede
 * algo a quem ainda não tem motivo para dar. Ele pode ser fechado num reflexo
 * — e o reflexo é o mesmo com que se fecha a aba. Aqui ele espera por UM de
 * dois sinais, e os dois significam interesse:
 *
 *  - **Metade da página rolada.** Quem rolou metade leu o que o produto faz.
 *  - **Intenção de sair, no computador.** O ponteiro subindo para fora do topo
 *    da janela é a mão indo para a aba ou para a barra de endereço. É o último
 *    instante em que ainda há alguém para perguntar.
 *
 * A intenção de sair não existe no celular — não há ponteiro. Por isso o
 * gatilho de rolagem não é o plano B: é o único plano para metade das
 * pessoas, e é por isso que ele vem primeiro.
 *
 * ─── O que garante que ele aparece UMA vez ─────────────────────────────────
 *
 * Três lembranças diferentes em `localStorage`, e não uma:
 *
 *  - quem se inscreveu nunca mais vê — pedir de novo a quem já deu diz que
 *    ninguém anotou;
 *  - quem fechou não vê por 30 dias — fechar é uma resposta, e insistir na
 *    visita seguinte é ignorar a resposta;
 *  - a mesma sessão nunca mostra duas vezes, mesmo sem `localStorage` (aba
 *    anônima com armazenamento bloqueado), porque o estado em memória também
 *    guarda.
 *
 * `localStorage` pode LANÇAR — Safari no modo privado, e navegador com
 * cookies de terceiro bloqueados. Toda leitura e escrita está em `try`, e a
 * falha significa "não sei se já mostrei", que resolve para NÃO mostrar. É a
 * escolha conservadora de propósito: o custo de não pedir um e-mail é um
 * e-mail; o de pedir a mesma pessoa cinco vezes é ela ir embora.
 *
 * ─── Fechar tem de ser óbvio ───────────────────────────────────────────────
 *
 * `Esc`, clique fora, e um botão com área de toque de verdade. Um pop-up cujo
 * "x" tem 12 pixels num celular é um pop-up que não fecha, e quem não consegue
 * fechar fecha a aba.
 *
 * ─── Por que os textos chegam por prop ─────────────────────────────────────
 *
 * A mesma regra de `FormularioDeContato` e `CapturaDeLead`: a tradução da
 * vitrine mora no servidor (`textoDoSite`, que conhece três idiomas) e o
 * dicionário do cliente conhece dois. Chamar `t()` aqui dentro faria um
 * visitante indiano ver a página em inglês e o pop-up em português — e
 * arrastaria o dicionário inteiro para o bundle da página de vendas.
 *
 * Os textos do campo (`captura`) passam por aqui sem serem lidos: quem os
 * monta é `app/page.tsx`, do lado do servidor, e é lá que o guarda de idioma
 * da vitrine consegue enxergá-los.
 */

const CHAVE_INSCRITO = "atenza_convite_inscrito";
const CHAVE_FECHADO = "atenza_convite_fechado_em";
/** 30 dias. Fechar é uma resposta; ela vale por um mês. */
const SILENCIO_MS = 30 * 24 * 60 * 60 * 1000;
/** Metade da página. Quem chegou aqui leu o que o produto faz. */
const FRACAO_ROLADA = 0.5;

function lembra(chave: string): string | null {
  try {
    return window.localStorage.getItem(chave);
  } catch {
    return null;
  }
}

function anota(chave: string, valor: string): void {
  try {
    window.localStorage.setItem(chave, valor);
  } catch {
    // Armazenamento bloqueado. O estado em memória ainda impede a repetição
    // dentro desta sessão, que é o caso que mais incomoda.
  }
}

/**
 * Se o armazenamento não responde, a resposta é NÃO MOSTRAR.
 *
 * `lembra()` devolve `null` tanto para "nunca mostrei" quanto para "não
 * consigo saber", e as duas pedem decisões opostas. Aqui o desempate é
 * explícito: sem armazenamento legível, `podeAparecer()` continua devolvendo
 * `true` — porque tratar o bloqueio como "já mostrei" silenciaria o convite
 * para todo mundo que usa navegação privada, que é gente de verdade, e não
 * repetir é garantido pelo estado em memória desta sessão.
 */
function podeAparecer(): boolean {
  if (lembra(CHAVE_INSCRITO)) return false;
  const fechadoEm = Number(lembra(CHAVE_FECHADO) ?? 0);
  if (Number.isFinite(fechadoEm) && fechadoEm > 0 && Date.now() - fechadoEm < SILENCIO_MS) {
    return false;
  }
  return true;
}

export interface TextosDoConvite {
  titulo: string;
  corpo: string;
  fechar: string;
}

export function ConviteDeLead({
  textos,
  captura,
  idioma,
  moeda,
}: {
  readonly textos: TextosDoConvite;
  readonly captura: TextosDaCaptura;
  readonly idioma: string;
  readonly moeda: string;
}) {
  const [aberto, setAberto] = useState(false);
  /** Uma vez por sessão, mesmo quando o `localStorage` não responde. */
  const jaMostrou = useRef(false);
  const fechar = useRef<HTMLButtonElement>(null);

  const abrir = useCallback(() => {
    if (jaMostrou.current || !podeAparecer()) return;
    jaMostrou.current = true;
    setAberto(true);
  }, []);

  useEffect(() => {
    if (!podeAparecer()) return;

    function aoRolar() {
      const alcance = document.documentElement.scrollHeight - window.innerHeight;
      // Página curta demais para rolar: o gatilho de rolagem não se aplica, e
      // dividir por zero aqui daria `Infinity`, que abriria o convite na hora.
      if (alcance <= 0) return;
      if (window.scrollY / alcance >= FRACAO_ROLADA) abrir();
    }

    function aoSair(evento: MouseEvent) {
      // Só para CIMA e só saindo da janela. `clientY > 0` descarta o
      // movimento lateral, que é trocar de monitor, não ir embora.
      if (evento.clientY <= 0 && !evento.relatedTarget) abrir();
    }

    window.addEventListener("scroll", aoRolar, { passive: true });
    document.addEventListener("mouseout", aoSair);
    return () => {
      window.removeEventListener("scroll", aoRolar);
      document.removeEventListener("mouseout", aoSair);
    };
  }, [abrir]);

  const dispensar = useCallback(() => {
    anota(CHAVE_FECHADO, String(Date.now()));
    setAberto(false);
  }, []);

  useEffect(() => {
    if (!aberto) return;
    function aoTeclar(evento: KeyboardEvent) {
      if (evento.key === "Escape") dispensar();
    }
    document.addEventListener("keydown", aoTeclar);
    // O foco vai para o botão de fechar e não para o campo: abrir um teclado
    // de celular por cima de um pop-up que a pessoa não pediu é a versão
    // móvel de sequestrar a tela.
    fechar.current?.focus();
    return () => document.removeEventListener("keydown", aoTeclar);
  }, [aberto, dispensar]);

  if (!aberto) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 backdrop-blur-sm sm:items-center"
      onClick={dispensar}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="convite-titulo"
        className="relative w-full max-w-md rounded-2xl border border-border bg-surface p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          ref={fechar}
          type="button"
          onClick={dispensar}
          aria-label={textos.fechar}
          className="absolute top-3 right-3 flex h-10 w-10 items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-text/5 hover:text-text"
        >
          <X className="h-5 w-5" aria-hidden />
        </button>

        <h2 id="convite-titulo" className="pr-10 text-lg font-semibold tracking-tight">
          {textos.titulo}
        </h2>
        <p className="mt-2 text-sm text-text-muted">{textos.corpo}</p>

        <CapturaDeLead
          textos={captura}
          idioma={idioma}
          moeda={moeda}
          origem="popup"
          aoInscrever={() => anota(CHAVE_INSCRITO, "1")}
          className="mt-4"
        />
      </div>
    </div>
  );
}
