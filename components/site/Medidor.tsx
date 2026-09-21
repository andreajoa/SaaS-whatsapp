"use client";

import { useEffect, useRef } from "react";

/**
 * O BEACON DA PÁGINA DE VENDAS — um `fetch`, uma vez, e nada na tela.
 *
 * ─── Por que ele não renderiza nada ────────────────────────────────────────
 *
 * Não há pixel, não há `<img>` de 1×1 e não há script de terceiro. A medição é
 * uma chamada ao PRÓPRIO domínio, o que a torna imune a bloqueador de anúncio
 * (que barra domínio de rastreador, não o site que você está lendo) e a mantém
 * fora do consentimento de cookie de terceiro — não há terceiro.
 *
 * ─── Por que `useRef` e não só `useEffect` ─────────────────────────────────
 *
 * Em desenvolvimento o React monta, desmonta e remonta todo componente uma vez
 * (StrictMode), e um `useEffect` sem trava grava DUAS visitas por
 * carregamento. O painel passaria a mostrar o dobro do movimento — e o erro
 * some em produção, onde o StrictMode não roda, o que é o pior jeito de um
 * número errado se comportar: ele mente só onde ninguém está olhando.
 */
export function Medidor({
  idioma,
  moeda,
  dispositivo,
}: {
  readonly idioma: string;
  readonly moeda: string;
  readonly dispositivo: "celular" | "tablet" | "computador";
}) {
  const jaMandou = useRef(false);

  useEffect(() => {
    if (jaMandou.current) return;
    jaMandou.current = true;

    void fetch("/api/v1/site/visita", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        path: window.location.pathname,
        url: window.location.href,
        // `document.referrer` é a ÚNICA fonte da origem: o cabeçalho `Referer`
        // desta requisição é a própria página, não de onde a pessoa veio.
        referrer: document.referrer,
        idioma,
        moeda,
        dispositivo,
      }),
      // A resposta não interessa; o que interessa é o `Set-Cookie` dela, e
      // `keepalive` faz a chamada sobreviver a quem clica e sai na mesma hora.
      keepalive: true,
    }).catch(() => {
      // Rede caiu, rota 404 num self-host, bloqueador exótico. Medição que
      // falha não pode aparecer no console de quem só queria ler a página.
    });
  }, [idioma, moeda, dispositivo]);

  return null;
}
