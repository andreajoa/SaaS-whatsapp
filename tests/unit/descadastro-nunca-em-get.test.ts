import { readFileSync } from "node:fs";
import { join } from "node:path";

import ts from "typescript";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * A PORTA DE SAÍDA DA LISTA, E O QUE NÃO PODE ACONTECER NELA.
 *
 * ─── O defeito que justifica o arquivo inteiro ────────────────────────────
 *
 * Um `/descadastrar/<token>` que dê baixa no próprio `GET` esvazia a lista
 * sozinho. Não por ataque: o antivírus do provedor, a pré-visualização de link
 * e o robô de segurança corporativo seguem TODO `GET` que encontram dentro de
 * um e-mail, antes de a pessoa abrir a mensagem. O log diria que cada um deles
 * pediu para sair, e ninguém descobriria o motivo — a lista simplesmente
 * encolheria, e cada e-mail seguinte sairia para menos gente.
 *
 * É um defeito que NÃO aparece em teste manual (quem testa clica uma vez, e
 * funciona) nem em revisão de código (um `GET` que grava parece normal). Por
 * isso ele é cobrado no AST: a rota não pode nem DECLARAR um `GET`.
 *
 * ─── E o defeito simétrico ────────────────────────────────────────────────
 *
 * O contrário é igualmente caro: dizer "pronto, você saiu" quando a escrita
 * falhou. A pessoa fecha a aba confiante, recebe o próximo e-mail na semana
 * seguinte e, dessa vez, não procura o link — clica em spam.
 */

const RAIZ = join(__dirname, "..", "..");
const ROTA = "app/api/v1/site/descadastrar/route.ts";

/** Os nomes exportados pelo módulo da rota, lidos do AST — sem importá-lo. */
function exportacoesDaRota(): string[] {
  const arq = join(RAIZ, ROTA);
  const fonte = ts.createSourceFile(
    arq,
    readFileSync(arq, "utf8"),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const nomes: string[] = [];
  const exportado = (no: ts.Node): boolean =>
    ts.canHaveModifiers(no) &&
    (ts.getModifiers(no) ?? []).some((m) => m.kind === ts.SyntaxKind.ExportKeyword);

  for (const no of fonte.statements) {
    if (ts.isFunctionDeclaration(no) && no.name && exportado(no)) nomes.push(no.name.text);
    if (ts.isVariableStatement(no) && exportado(no)) {
      for (const d of no.declarationList.declarations) {
        if (ts.isIdentifier(d.name)) nomes.push(d.name.text);
      }
    }
  }
  return nomes;
}

// ─── O dublê do banco ──────────────────────────────────────────────────────
// Mesmo formato do de `lead-do-site-nao-reescreve-historia.test.ts`: o estado
// é de módulo porque o cliente é construído dentro da função sob teste.

interface Leitura {
  readonly data: Record<string, unknown> | null;
  readonly error: { code?: string } | null;
}

let estado: {
  semServiceRole: boolean;
  leitura: Leitura;
  erroUpdate: boolean;
};
let registro: { atualizacoes: Record<string, unknown>[]; leituras: number };

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => {
    if (estado.semServiceRole) throw new Error("sem service role");
    return {
      from: () => {
        const construtor = {
          select: () => construtor,
          eq: () => construtor,
          maybeSingle: async () => {
            registro.leituras += 1;
            return estado.leitura;
          },
          update: (campos: Record<string, unknown>) => {
            registro.atualizacoes.push(campos);
            return {
              eq: async () => ({ error: estado.erroUpdate ? { code: "XX000" } : null }),
            };
          },
        };
        return construtor;
      },
    };
  },
}));

beforeEach(() => {
  estado = { semServiceRole: false, leitura: { data: null, error: null }, erroUpdate: false };
  registro = { atualizacoes: [], leituras: 0 };
});

afterEach(() => {
  vi.resetModules();
});

describe("a rota de descadastro não tem GET", () => {
  it("exporta POST e não exporta GET", () => {
    const nomes = exportacoesDaRota();
    expect(nomes).toContain("POST");
    expect(
      nomes,
      "um GET aqui deixaria antivírus de provedor e pré-visualização de link esvaziarem a lista sozinhos",
    ).not.toContain("GET");
  });

  it("não exporta nenhum outro verbo que escreva", () => {
    const nomes = new Set(exportacoesDaRota());
    for (const verbo of ["GET", "PUT", "PATCH", "DELETE", "HEAD"]) {
      expect(nomes.has(verbo), `${verbo} não deveria existir nesta rota`).toBe(false);
    }
  });
});

describe("os cabeçalhos que fazem o Gmail desenhar o botão de saída", () => {
  it("emite o par da RFC 8058", async () => {
    const { cabecalhosDeDescadastro } = await import("@/lib/marketing/descadastro");
    const h = cabecalhosDeDescadastro("abc123");
    expect(h["List-Unsubscribe-Post"]).toBe("List-Unsubscribe=One-Click");
    expect(h["List-Unsubscribe"]).toMatch(/<https?:\/\/[^>]+\/api\/v1\/site\/descadastrar\?t=/);
  });

  it("a URL de um clique aponta para a ROTA, e a humana para a PÁGINA", async () => {
    const { urlDeDescadastro, urlDeDescadastroUmClique } =
      await import("@/lib/marketing/descadastro");
    // Se as duas coincidissem, um dia alguém trocaria o método de uma sem
    // perceber que estava trocando o papel da outra junto.
    expect(urlDeDescadastroUmClique("abc123")).toContain("/api/v1/site/descadastrar?t=abc123");
    expect(urlDeDescadastro("abc123")).toContain("/descadastrar/abc123");
    expect(urlDeDescadastro("abc123")).not.toContain("/api/");
  });

  it("escapa o token na URL", async () => {
    const { urlDeDescadastroUmClique } = await import("@/lib/marketing/descadastro");
    expect(urlDeDescadastroUmClique("a&b=c")).toContain("t=a%26b%3Dc");
  });
});

describe("dar baixa", () => {
  it("token malformado nem chega ao banco", async () => {
    const { descadastrarPorToken } = await import("@/lib/marketing/descadastro");
    for (const ruim of ["", "   ", "nao-e-hex", "zz", "abc", "<script>"]) {
      expect(await descadastrarPorToken(ruim)).toEqual({ tipo: "nao_encontrado" });
    }
    expect(registro.leituras, "varredura e link truncado não são superfície de banco").toBe(0);
  });

  it("token que não existe devolve nao_encontrado sem escrever", async () => {
    estado.leitura = { data: null, error: null };
    const { descadastrarPorToken } = await import("@/lib/marketing/descadastro");
    expect(await descadastrarPorToken("a".repeat(32))).toEqual({ tipo: "nao_encontrado" });
    expect(registro.atualizacoes).toEqual([]);
  });

  it("quem já saiu recebe fora de novo, sem segundo UPDATE", async () => {
    estado.leitura = { data: { id: "1", descadastrado_em: "2026-01-01T00:00:00Z" }, error: null };
    const { descadastrarPorToken } = await import("@/lib/marketing/descadastro");
    expect(await descadastrarPorToken("b".repeat(32))).toEqual({ tipo: "fora" });
    expect(registro.atualizacoes, "idempotente: o Gmail reenvia o one-click").toEqual([]);
  });

  it("status e descadastrado_em andam juntos", async () => {
    estado.leitura = { data: { id: "1", descadastrado_em: null }, error: null };
    const { descadastrarPorToken } = await import("@/lib/marketing/descadastro");
    expect(await descadastrarPorToken("c".repeat(32))).toEqual({ tipo: "fora" });
    expect(registro.atualizacoes).toHaveLength(1);
    // Um sem o outro deixa a pessoa invisível para uma consulta e visível para
    // a outra — e a que a enxerga é a que manda e-mail.
    expect(registro.atualizacoes[0]).toHaveProperty("status", "descadastrado");
    expect(typeof registro.atualizacoes[0]?.descadastrado_em).toBe("string");
  });

  it("falha de escrita NÃO vira “pronto, você saiu”", async () => {
    estado.leitura = { data: { id: "1", descadastrado_em: null }, error: null };
    estado.erroUpdate = true;
    const { descadastrarPorToken } = await import("@/lib/marketing/descadastro");
    expect(await descadastrarPorToken("d".repeat(32))).toEqual({ tipo: "sem_banco" });
  });

  it("falha de leitura NÃO vira “link inválido”", async () => {
    // Dizer "inválido" a quem tem token bom manda a pessoa embora achando que
    // o link quebrou — e ela não tenta de novo.
    estado.leitura = { data: null, error: { code: "XX000" } };
    const { descadastrarPorToken } = await import("@/lib/marketing/descadastro");
    expect(await descadastrarPorToken("e".repeat(32))).toEqual({ tipo: "sem_banco" });
  });

  it("sem service role devolve sem_banco", async () => {
    estado.semServiceRole = true;
    const { descadastrarPorToken } = await import("@/lib/marketing/descadastro");
    expect(await descadastrarPorToken("f".repeat(32))).toEqual({ tipo: "sem_banco" });
  });
});
