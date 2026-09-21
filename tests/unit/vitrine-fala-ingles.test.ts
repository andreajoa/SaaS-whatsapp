import { readFileSync } from "node:fs";
import { join } from "node:path";

import ts from "typescript";
import { describe, expect, it } from "vitest";

import { INGLES_DA_VITRINE } from "@/lib/mercado/textos";
import { MERCADOS } from "@/lib/mercado/paises";

/**
 * A VITRINE FALA INGLÊS INTEIRO, OU NÃO FALA.
 *
 * ─── O defeito que este guarda existe para impedir ─────────────────────────
 *
 * `lib/mercado/paises.ts` serve inglês a cinco mercados. `textoDoSite()`
 * DEGRADA para português quando falta tradução — e degradar é a decisão certa
 * em tempo de execução, porque uma frase faltando não pode derrubar a página de
 * vendas. Mas a mesma degradação, sem guarda, produz o pior resultado
 * possível: uma página metade em inglês e metade em português, que não fica
 * vermelha em lugar nenhum e que quem escreveu nunca vê, porque ele navega em
 * português.
 *
 * Meia-tradução é pior que nenhuma. Nenhuma é uma decisão; meia é um descuido
 * visível para o comprador e invisível para quem vende.
 *
 * ─── Por que varre o AST e não faz `grep` ──────────────────────────────────
 *
 * `grep` acha `t("...")` e perde `t(\`...\`)`, e acha `t(` dentro de
 * comentário. O AST responde a pergunta certa — quais CHAVES LITERAIS chegam à
 * função de tradução — e alcança arquivo que ainda não foi escrito, que é o
 * ponto: a página de contato e as páginas legais entram na conta no dia em que
 * nascem, sem ninguém lembrar de atualizar lista nenhuma.
 */

const RAIZ = join(__dirname, "..", "..");

/**
 * As telas que um ESTRANHO vê antes de ter conta.
 *
 * Esta lista só cresce, e cresce junto com a vitrine. Ela é explícita — e não
 * "tudo que é público" — porque o que define vitrine não é a rota ser pública
 * e sim a página estar tentando vender: `/login` é pública e não vende nada.
 */
const TELAS_DA_VITRINE = ["app/page.tsx"];

/** Toda chave literal passada a `t()` / `textoDoSite()` nas telas da vitrine. */
function chavesDaVitrine(): Map<string, string> {
  const usadas = new Map<string, string>();
  for (const rel of TELAS_DA_VITRINE) {
    const arq = join(RAIZ, rel);
    const fonte = ts.createSourceFile(
      arq,
      readFileSync(arq, "utf8"),
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX,
    );
    const visita = (no: ts.Node): void => {
      if (ts.isCallExpression(no) && no.arguments.length > 0) {
        const alvo = no.expression;
        const nome = ts.isIdentifier(alvo)
          ? alvo.text
          : ts.isPropertyAccessExpression(alvo)
            ? alvo.name.text
            : "";
        if (nome === "t" || nome === "textoDoSite") {
          const a = no.arguments[0];
          if (a && (ts.isStringLiteral(a) || ts.isNoSubstitutionTemplateLiteral(a))) {
            const linha = fonte.getLineAndCharacterOfPosition(a.getStart()).line + 1;
            if (!usadas.has(a.text)) usadas.set(a.text, `${rel}:${linha}`);
          }
        }
      }
      ts.forEachChild(no, visita);
    };
    visita(fonte);
  }
  return usadas;
}

describe("a vitrine fala inglês inteiro", () => {
  it("toda frase da vitrine tem inglês", () => {
    const sem = [...chavesDaVitrine().entries()]
      .filter(([chave]) => !INGLES_DA_VITRINE[chave])
      .map(([chave, onde]) => `${onde} → ${JSON.stringify(chave)}`);
    expect(
      sem,
      `${sem.length} frase(s) da vitrine sem inglês: Índia, Indonésia, Malásia, África do Sul e Itália veriam isto em PORTUGUÊS`,
    ).toEqual([]);
  });

  /**
   * A direção oposta. Uma entrada que ninguém usa não quebra a página, mas
   * mente sobre o tamanho do trabalho e sobrevive a refatoração — daí ela
   * reprova aqui em vez de virar dívida silenciosa.
   */
  it("nenhuma tradução sobra sem dono na vitrine", () => {
    const usadas = new Set(chavesDaVitrine().keys());
    const orfas = Object.keys(INGLES_DA_VITRINE).filter((k) => !usadas.has(k));
    expect(orfas, `${orfas.length} tradução(ões) para frase que a vitrine não usa mais`).toEqual([]);
  });

  it("nenhuma tradução repete o português", () => {
    // Uma "tradução" idêntica à chave é indistinguível da degradação, e passaria
    // no teste de cima sem traduzir nada. Nomes próprios ficariam de fora — não
    // há nenhum na vitrine hoje, e o dia em que houver esta linha explica o
    // porquê da exceção.
    const iguais = Object.entries(INGLES_DA_VITRINE)
      .filter(([pt, en]) => pt === en)
      .map(([pt]) => pt);
    expect(iguais).toEqual([]);
  });
});

describe("o inglês é servido a quem a tabela de mercados promete", () => {
  it("existe mercado servido em inglês", () => {
    // Se um dia a tabela parar de servir inglês, este arquivo inteiro vira
    // manutenção paga por ninguém — e é aqui que isso aparece, em vez de o
    // dicionário seguir sendo mantido por hábito.
    const emIngles = MERCADOS.filter((m) => m.idioma === "en").map((m) => m.pais);
    expect(emIngles.length, "nenhum mercado usa inglês — INGLES_DA_VITRINE virou órfão").toBeGreaterThan(0);
  });
});
