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

/**
 * Quanto tempo cada palavra fica PARADA, legível, antes de subir.
 *
 * Eram 2,2 s e estava rápido demais: o olho precisa terminar de ler a frase
 * inteira ANTES de a palavra trocar, senão a troca rouba a leitura em vez de
 * acrescentar a ela. "Atendimento por WhatsApp para clínicas" leva cerca de
 * 1,5 s para ser lida; com a subida de 0,52 s, 3,6 s de pausa deixam mais de
 * dois segundos de frase parada — tempo de ler e ainda reparar que mudou.
 */
const PAUSA_MS = 3600;

/** Precisa bater com a duração da transição no CSS (`.alterna-fita`). */
const SUBIDA_MS = 520;

/**
 * A ALTURA DE UMA LINHA, e por que ela é `em` e não porcentagem.
 *
 * ─── O defeito que isto conserta ───────────────────────────────────────────
 *
 * A primeira versão movia a fita com `translateY(-i * 100%)`. Em CSS, a
 * porcentagem de `translateY` é relativa à altura DO PRÓPRIO ELEMENTO — e o
 * elemento é a fita inteira, com as cinco palavras empilhadas. Então o
 * primeiro passo subia CINCO linhas de uma vez: a janela ficava vazia a partir
 * da segunda palavra, e o que se via era "clínicas" e depois nada.
 *
 * A receita de onde o efeito veio dividia pelo número de itens
 * (`-i * 100 / itens`). Dividir funciona, mas amarra a conta à contagem: um
 * nicho novo na lista muda o passo de todos os outros, e quem acrescentar não
 * tem como saber disso.
 *
 * Em `em` o passo é absoluto — uma linha é uma linha, com quatro palavras ou
 * com quarenta. O número tem de ser o MESMO da altura da janela em
 * `app/globals.css` (`.alterna-janela`), e é por isso que ele é uma constante
 * com nome em vez de um literal solto nos dois arquivos.
 */
const ALTURA_DA_LINHA_EM = 1.25;

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
          transform: `translateY(-${(i * ALTURA_DA_LINHA_EM).toFixed(3)}em)`,
          ...(semTransicao ? { transition: "none" } : {}),
        }}
      >
        {/* A cópia do primeiro no fim é o que faz o laço fechar sem tranco. */}
        {[...palavras, primeira].map((palavra, n) => (
          <span
            key={`${n}-${palavra}`}
            // Altura e `line-height` explícitos: sem eles cada palavra ocupa o
            // que a fonte decidir, a soma não bate com o passo em `em` e a
            // fita desalinha um pouco a cada volta — um erro que só aparece
            // depois de várias trocas, que é o pior jeito de aparecer.
            className="block overflow-hidden whitespace-nowrap"
            style={{ height: `${ALTURA_DA_LINHA_EM}em`, lineHeight: `${ALTURA_DA_LINHA_EM}em` }}
          >
            {palavra}
          </span>
        ))}
      </span>
    </span>
  );
}
