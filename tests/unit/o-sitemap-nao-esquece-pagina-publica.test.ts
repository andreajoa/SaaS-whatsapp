import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { DOCUMENTOS_LEGAIS } from "@/lib/legal/documentos";

/**
 * O SITEMAP NÃO PODE ESQUECER UMA PÁGINA PÚBLICA.
 *
 * ─── O defeito que este teste existe para não deixar voltar ────────────────
 *
 * `app/sitemap.ts` listava três URLs e o comentário dele afirmava, em letras:
 * *"São três, e são todas"*. A frase era verdadeira no dia em que foi escrita e
 * ficou falsa no PR seguinte — entraram seis documentos legais e a página de
 * contato, e nenhum chegou ao sitemap. Sete páginas publicadas e invisíveis
 * para o buscador.
 *
 * O que torna isso caro é que NADA falha: as páginas respondem 200, o build
 * passa, o `robots.txt` as libera, e o único sintoma é tráfego que não chega —
 * o sinal mais lento e mais fácil de atribuir a outra coisa que existe num
 * produto que se vende pela busca.
 *
 * ─── Por que a varredura é do DISCO, e não da lista ────────────────────────
 *
 * Cobrar que `DOCUMENTOS_LEGAIS` esteja no sitemap prova pouco: as duas listas
 * sairiam do mesmo import e concordariam por construção. O que este teste faz é
 * ler o que EXISTE em `app/` — as rotas públicas de verdade — e cobrar que cada
 * uma tenha entrada. Página nova nasce vermelha aqui, que é o momento certo de
 * decidir se ela é indexável ou se entra na lista de exceções abaixo, com
 * motivo escrito.
 */
const RAIZ = process.cwd();
const SITEMAP = fs.readFileSync(path.join(RAIZ, "app/sitemap.ts"), "utf8");

/**
 * Rotas com página que NÃO entram no sitemap, cada uma com o porquê. Esta lista
 * só deve crescer com justificativa — é ela que separa "decidimos não indexar"
 * de "esquecemos".
 */
const FORA_DO_SITEMAP: Readonly<Record<string, string>> = {
  "403": "página de erro: indexá-la põe erro nosso no resultado de busca",
  "500": "página de erro",
  "503": "página de erro",
  "account-suspended": "estado de conta de quem já é cliente",
  "acesso-revogado": "estado de conta de quem já é cliente",
  "support-ended": "estado de conta de quem já é cliente",
  dashboard:
    "painel do operador, atrás de senha própria — sem PAINEL_SENHA ele responde 404, e com ela não é conteúdo público",
  design: "página interna de referência visual, sem texto que responda a uma busca",
  "descadastrar/[token]":
    "endereço pessoal com token: indexá-lo publicaria o link de descadastro de quem o recebeu",
  "get-started": "porta de entrada do fluxo de conta, não conteúdo que responda a uma busca",
  "legal/[documento]":
    "rota paramétrica — quem entra no sitemap são os slugs concretos de DOCUMENTOS_LEGAIS",
  "team/accept-invite/[token]": "convite pessoal com token; indexá-lo o entregaria a estranhos",
  "vitrine-agenda": "demonstração interna de agenda, sem texto que responda a uma busca",
};

/**
 * Famílias inteiras que ficam de fora. Prefixo, e não entrada por entrada,
 * porque uma tela nova de onboarding não deve reprovar este gate: ela nasce
 * dentro de um fluxo que, por definição, é de quem já tem conta.
 */
const FAMILIAS_FORA: ReadonlyArray<{ prefixo: string; porque: string }> = [
  { prefixo: "onboarding", porque: "fluxo de quem já criou conta; `robots.ts` barra a área logada" },
];

/** Segmentos de rota que o App Router não publica (grupos, privados, API). */
function ehPublicavel(segmento: string): boolean {
  return !segmento.startsWith("(") && !segmento.startsWith("_") && !segmento.startsWith("@");
}

/** Todas as rotas com `page.tsx` sob `app/`, na forma de caminho de URL. */
function rotasComPagina(): string[] {
  const base = path.join(RAIZ, "app");
  const achadas: string[] = [];

  function descer(dir: string, prefixo: string[]) {
    for (const entrada of fs.readdirSync(dir, { withFileTypes: true })) {
      if (!entrada.isDirectory()) continue;
      if (!ehPublicavel(entrada.name)) continue;
      const caminho = path.join(dir, entrada.name);
      // `app/api` é rota de dados e `app/app` é a área logada — nenhuma das
      // duas é página que se indexe, e `robots.ts` já as barra.
      if (prefixo.length === 0 && (entrada.name === "api" || entrada.name === "app")) continue;
      if (prefixo.length === 0 && entrada.name === "admin") continue;
      const novo = [...prefixo, entrada.name];
      if (fs.existsSync(path.join(caminho, "page.tsx"))) achadas.push(novo.join("/"));
      descer(caminho, novo);
    }
  }

  descer(base, []);
  return achadas.sort();
}

describe("o sitemap cobre as páginas públicas que existem", () => {
  it("o instrumento está vivo: a varredura acha as rotas de verdade", () => {
    // Guarda de vacuidade. Se `rotasComPagina()` quebrar, os `it.each` abaixo
    // somem e a suíte fica verde por não haver caso — o modo de falha mais
    // silencioso que um gate tem.
    const rotas = rotasComPagina();
    expect(rotas.length, "a varredura de app/ não achou página nenhuma").toBeGreaterThan(5);
    expect(rotas, "a varredura perdeu a página de contato").toContain("contato");
    expect(rotas, "a varredura perdeu o índice legal").toContain("legal");
  });

  it.each(rotasComPagina())("%s está no sitemap, ou declarada fora dele com motivo", (rota) => {
    if (rota in FORA_DO_SITEMAP) return;
    if (FAMILIAS_FORA.some((f) => rota === f.prefixo || rota.startsWith(`${f.prefixo}/`))) return;

    expect(
      SITEMAP.includes(`"/${rota}"`),
      `\`/${rota}\` tem página e não está em app/sitemap.ts. Se ela não deve ser ` +
        `indexada, acrescente-a a FORA_DO_SITEMAP com o motivo — a lista existe para ` +
        `separar "decidimos não indexar" de "esquecemos".`,
    ).toBe(true);
  });

  it("a lista de exceções não guarda rota morta", () => {
    // Exceção para rota que não existe mais é peso morto que passa a esconder
    // o caso real: alguém cria `/precos`, a chave antiga com nome parecido
    // continua lá, e ninguém repara que a página nova ficou fora do sitemap.
    const rotas = new Set(rotasComPagina());
    for (const chave of Object.keys(FORA_DO_SITEMAP)) {
      expect(
        rotas.has(chave),
        `\`${chave}\` está em FORA_DO_SITEMAP e não tem mais página — apague a entrada`,
      ).toBe(true);
    }
    for (const familia of FAMILIAS_FORA) {
      expect(
        [...rotas].some((r) => r === familia.prefixo || r.startsWith(`${familia.prefixo}/`)),
        `a família \`${familia.prefixo}\` não tem mais nenhuma página — apague a entrada`,
      ).toBe(true);
    }
  });

  it("os seis documentos legais entram pelo derivado, e não digitados um a um", () => {
    // Se alguém "consertar" o sitemap colando os seis slugs à mão, o próximo
    // documento volta a ficar de fora — e é esse conserto que este caso impede.
    expect(SITEMAP, "o sitemap deixou de derivar de DOCUMENTOS_LEGAIS").toContain(
      "DOCUMENTOS_LEGAIS.map",
    );
    for (const doc of DOCUMENTOS_LEGAIS) {
      expect(
        SITEMAP.includes(`"/legal/${doc.slug}"`),
        `o slug \`${doc.slug}\` foi digitado à mão no sitemap — deixe o map derivá-lo`,
      ).toBe(false);
    }
  });

  it("sitemap e robots concordam sobre o interruptor da cobrança", () => {
    const robots = fs.readFileSync(path.join(RAIZ, "app/robots.ts"), "utf8");
    // Os dois são o mesmo mapa visto de lados opostos. Um liberar o que o outro
    // esconde é o defeito clássico aqui, e ele não dá erro em lugar nenhum.
    expect(SITEMAP).toContain("instalacaoCobra()");
    expect(robots).toContain("instalacaoCobra()");
  });
});
