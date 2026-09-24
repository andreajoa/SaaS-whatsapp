"use client";

import { useEffect, useRef, useState } from "react";

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
  /** O id da linha de `site_visits`, devolvido pela rota. Sem ele não há
   *  como dizer, na saída, a QUAL visita a duração pertence. */
  const [visitaId, setVisitaId] = useState<string | null>(null);

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
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        const id = j?.data?.visita;
        if (typeof id === "string") setVisitaId(id);
      })
      .catch(() => {
        // Rede caiu, rota 404 num self-host, bloqueador exótico. Medição que
        // falha não pode aparecer no console de quem só queria ler a página.
      });
  }, [idioma, moeda, dispositivo]);

  /**
   * O PULSO DE SAÍDA — quanto tempo ficou, e onde clicou.
   *
   * ─── Por que o relógio conta só a aba VISÍVEL ──────────────────────────
   *
   * Uma aba esquecida em segundo plano acumularia horas e envenenaria a
   * média — e média envenenada é pior que dado ausente, porque parece
   * confiável. O cronômetro para em `visibilitychange` e volta a correr
   * quando a aba reaparece, então o número descreve leitura, não abandono.
   *
   * ─── Por que `sendBeacon`, e não `fetch` ───────────────────────────────
   *
   * É a única API que o navegador promete entregar DEPOIS de a aba fechar.
   * Um `fetch` no `pagehide` é cancelado junto com a página na maioria dos
   * casos, e o dado de quem leu a página inteira e saiu — justamente o mais
   * valioso — seria o que mais se perderia.
   *
   * ─── O clique guarda RÓTULO, nunca o elemento ──────────────────────────
   *
   * Lê-se `data-medir` do ancestral mais próximo, que é um valor que NÓS
   * escrevemos no JSX. Nada do texto, do valor ou da posição do elemento é
   * lido. O servidor ainda valida contra um vocabulário fechado — duas
   * cercas, porque esta roda no navegador e pode ser burlada.
   */
  useEffect(() => {
    if (!visitaId) return;

    let segundos = 0;
    let desde = document.visibilityState === "visible" ? Date.now() : null;
    const cliques: string[] = [];
    let entregue = false;

    const acumular = () => {
      if (desde === null) return;
      segundos += Math.round((Date.now() - desde) / 1000);
      desde = null;
    };

    const aoClicar = (ev: MouseEvent) => {
      const alvo = (ev.target as HTMLElement | null)?.closest?.("[data-medir]");
      const rotulo = alvo?.getAttribute("data-medir");
      // Teto de 40: é o que a rota aceita, e um laço de clique acidental não
      // pode crescer sem limite na memória de quem está só navegando.
      if (rotulo && cliques.length < 40) cliques.push(rotulo);
    };

    const entregar = () => {
      if (entregue) return;
      entregue = true;
      acumular();
      const corpo = JSON.stringify({
        visita: visitaId,
        segundos,
        path: window.location.pathname,
        cliques,
      });
      // `sendBeacon` devolve false quando o corpo excede a cota do navegador.
      // Aí não há segunda chance: um `fetch` neste ponto seria cancelado.
      navigator.sendBeacon?.("/api/v1/site/pulso", new Blob([corpo], { type: "application/json" }));
    };

    const aoTrocarVisibilidade = () => {
      if (document.visibilityState === "hidden") {
        // Entrega AQUI, e não só no `pagehide`: em celular, trocar de app ou
        // bloquear a tela dispara `visibilitychange` e muitas vezes NUNCA
        // dispara `pagehide` — o sistema mata a aba sem avisar a página. Quem
        // só escuta `pagehide` perde a maior parte do tráfego móvel.
        entregar();
      } else {
        desde = Date.now();
      }
    };

    document.addEventListener("click", aoClicar, true);
    document.addEventListener("visibilitychange", aoTrocarVisibilidade);
    window.addEventListener("pagehide", entregar);

    return () => {
      document.removeEventListener("click", aoClicar, true);
      document.removeEventListener("visibilitychange", aoTrocarVisibilidade);
      window.removeEventListener("pagehide", entregar);
    };
  }, [visitaId]);



  return null;
}
