"use client";

import { useEffect, useRef } from "react";

import { CAMINHO_DO_PRECO, ID_DA_SECAO_DE_PLANOS } from "@/lib/marketing/caminhos";

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
  const jaViuPreco = useRef(false);

  /**
   * A SEGUNDA medida: a pessoa chegou até a tabela de preço.
   *
   * Existe porque sem ela o e-mail de "você olhou os planos e não seguiu" não
   * tem em que se apoiar. O `path` da primeira medida é
   * `window.location.pathname`, e a tabela de preço é uma SEÇÃO da mesma página
   * — o `#precos` é fragmento, e fragmento não é enviado ao servidor por
   * ninguém, nem no `Referer`. Quem só tivesse a primeira medida teria de
   * mandar o e-mail para todo mundo que abriu o site, o que o transforma de
   * resposta a um ato em propaganda cega.
   *
   * A régua é ter ENTRADO NA TELA, não ter clicado: quem rola até o preço e
   * fecha a aba demonstrou exatamente o interesse de que o e-mail fala. Uma
   * vez por carregamento, pelo mesmo motivo do `jaMandou`.
   */
  useEffect(() => {
    const alvo = document.getElementById(ID_DA_SECAO_DE_PLANOS);
    if (!alvo || typeof IntersectionObserver === "undefined") return;

    const observador = new IntersectionObserver(
      (entradas) => {
        if (jaViuPreco.current) return;
        if (!entradas.some((e) => e.isIntersecting)) return;
        jaViuPreco.current = true;
        observador.disconnect();

        void fetch("/api/v1/site/visita", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            path: CAMINHO_DO_PRECO,
            url: window.location.href,
            referrer: document.referrer,
            idioma,
            moeda,
            dispositivo,
          }),
          keepalive: true,
        }).catch(() => {});
      },
      { threshold: 0.4 },
    );

    observador.observe(alvo);
    return () => observador.disconnect();
  }, [idioma, moeda, dispositivo]);

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
