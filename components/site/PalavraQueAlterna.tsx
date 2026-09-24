"use client";

import { useEffect, useLayoutEffect, useState } from "react";

/**
 * A PALAVRA QUE TROCA DENTRO DA FRASE.
 *
 * ─── Por que ela ganha o nicho, e não um adjetivo ──────────────────────────
 *
 * O uso fácil deste efeito é alternar elogios ao produto — "rápido", "simples",
 * "poderoso". Não faz nada: quem lê já esperava o elogio e não aprende nada com
 * ele.
 *
 * Aqui ela alterna o NICHO: clínica, imobiliária, e-commerce, prestador de
 * serviço. Quem chega procurando "CRM para clínica" vê a própria palavra
 * aparecer na primeira linha da página, e a promessa deixa de ser genérica sem
 * que a página precise de uma versão por segmento. É o mesmo texto falando
 * com quatro públicos.
 *
 * ─── Como o laço fecha sem tranco ──────────────────────────────────────────
 *
 * A fita é uma coluna com as palavras, e ela sobe uma altura de linha por vez.
 * No último item ela volta ao topo COM A TRANSIÇÃO DESLIGADA — é o instante
 * que ninguém vê, porque o primeiro item e a cópia final são a mesma palavra.
 * Sem essa cópia extra no fim, a volta é um salto de quatro linhas para cima,
 * visível e feio.
 *
 * ─── O que o servidor manda ────────────────────────────────────────────────
 *
 * A primeira palavra, e só ela, renderizada estática. Quem não executa
 * JavaScript lê "Atendimento por WhatsApp para clínicas" — uma frase inteira e
 * verdadeira, não um espaço vazio esperando animação. O mesmo vale para quem
 * pediu menos movimento: recebe a frase parada, e nenhuma informação é perdida
 * porque os quatro nichos aparecem escritos mais abaixo na própria página.
 */
const useEfeitoAntesDaPintura = typeof window === "undefined" ? useEffect : useLayoutEffect;

/** Quanto tempo cada palavra fica parada, legível, antes de subir. */
const PAUSA_MS = 2200;

/** Precisa bater com a duração da transição no CSS (`.alterna-fita`). */
const SUBIDA_MS = 520;

export function PalavraQueAlterna({
  palavras,
  className,
}: {
  readonly palavras: readonly string[];
  readonly className?: string;
}) {
  const [vivo, setVivo] = useState(false);
  const [i, setI] = useState(0);
  /** Desliga a transição no quadro em que a fita volta ao topo. */
  const [semTransicao, setSemTransicao] = useState(false);

  useEfeitoAntesDaPintura(() => {
    const calmo = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    if (calmo || palavras.length < 2) return;
    setVivo(true);
  }, [palavras.length]);

  useEffect(() => {
    if (!vivo) return;
    const id = window.setInterval(() => {
      setI((atual) => {
        const proximo = atual + 1;
        // Chegou na cópia do primeiro item: deixa a subida terminar e então
        // volta ao zero sem transição. `proximo` continua sendo mostrado no
        // meio-tempo, senão a palavra pularia antes de a subida acabar.
        if (proximo >= palavras.length) {
          window.setTimeout(() => {
            setSemTransicao(true);
            setI(0);
            // Dois quadros: um para o navegador aplicar `transition: none` e
            // outro para ele aplicar o `transform`. Religar a transição no
            // mesmo quadro faria a volta ser animada — que é o salto que toda
            // esta mecânica existe para esconder.
            requestAnimationFrame(() => {
              requestAnimationFrame(() => setSemTransicao(false));
            });
          }, SUBIDA_MS);
        }
        return proximo;
      });
    }, PAUSA_MS);
    return () => window.clearInterval(id);
  }, [vivo, palavras.length]);

  const primeira = palavras[0] ?? "";
  if (!vivo) return <span className={className}>{primeira}</span>;

  return (
    <span className={`alterna-janela ${className ?? ""}`.trim()}>
      <span
        className="alterna-fita"
        style={{
          transform: `translateY(-${i * 100}%)`,
          ...(semTransicao ? { transition: "none" } : {}),
        }}
      >
        {/* A cópia do primeiro no fim é o que faz o laço fechar sem tranco. */}
        {[...palavras, primeira].map((palavra, n) => (
          <span key={`${n}-${palavra}`} className="block whitespace-nowrap">
            {palavra}
          </span>
        ))}
      </span>
    </span>
  );
}
