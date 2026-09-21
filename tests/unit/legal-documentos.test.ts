import { describe, expect, it } from "vitest";

import { DOCUMENTOS_LEGAIS, documentoPorSlug, frase, type Frase } from "@/lib/legal/documentos";
import { isPublicPath } from "@/lib/auth/public-paths";

/**
 * DOCUMENTO LEGAL QUE NASCE ATRÁS DO LOGIN É DOCUMENTO QUE NÃO EXISTE.
 *
 * `lib/legal/documentos.ts` é DADO: acrescentar um sétimo documento é
 * acrescentar um objeto num array, e a página `[documento]` passa a servi-lo
 * sozinha. O que NÃO acontece sozinho é a entrada em `PUBLIC_PATHS` — e o modo
 * de falha é silencioso do pior jeito: o link aparece no índice, quem tem
 * sessão (isto é, quem escreveu) abre normalmente, e o visitante anônimo, que
 * é a única pessoa para quem o documento foi escrito, recebe um 307 para o
 * login. Só se descobre por reclamação.
 *
 * O segundo guarda é a tradução. Três idiomas lado a lado no mesmo objeto
 * tornam a divergência visível, mas não impedem o atalho de copiar o português
 * nos três campos — que compila, passa no `typecheck` e produz um contrato em
 * português servido a quem lê inglês.
 */

/**
 * Onde o idioma coincide DE VERDADE, com o motivo escrito.
 *
 * Português e espanhol são línguas irmãs e às vezes produzem a mesma frase —
 * reescrever o título de um documento legal para que ele fique diferente
 * seria o teste mandando no contrato. A exceção é por caminho exato e não por
 * documento: liberar `cookies.*` inteiro deixaria a cópia preguiçosa entrar
 * nos parágrafos de carona. A lista só encolhe.
 */
const IDENTICO_DE_PROPOSITO: Readonly<Record<string, string>> = {
  "cookies.titulo": "“Política de Cookies” se escreve igual em português e espanhol.",
};

/** Toda `Frase` de todo documento, com o caminho até ela para o erro dizer onde. */
function todasAsFrases(): Array<{ onde: string; f: Frase }> {
  const saida: Array<{ onde: string; f: Frase }> = [];
  for (const doc of DOCUMENTOS_LEGAIS) {
    saida.push({ onde: `${doc.slug}.titulo`, f: doc.titulo });
    saida.push({ onde: `${doc.slug}.resumo`, f: doc.resumo });
    doc.secoes.forEach((secao, i) => {
      saida.push({ onde: `${doc.slug}.secoes[${i}].titulo`, f: secao.titulo });
      secao.paragrafos.forEach((p, j) =>
        saida.push({ onde: `${doc.slug}.secoes[${i}].paragrafos[${j}]`, f: p }),
      );
      (secao.itens ?? []).forEach((p, j) =>
        saida.push({ onde: `${doc.slug}.secoes[${i}].itens[${j}]`, f: p }),
      );
    });
  }
  return saida;
}

describe("os documentos legais são alcançáveis sem sessão", () => {
  it("todo documento tem entrada em PUBLIC_PATHS", () => {
    const fechados = DOCUMENTOS_LEGAIS.filter((d) => !isPublicPath(`/legal/${d.slug}`)).map(
      (d) => d.slug,
    );
    expect(
      fechados,
      `${fechados.length} documento(s) só abrem com sessão — o visitante anônimo recebe 307 para o login`,
    ).toEqual([]);
  });

  it("o índice e a página de contato são públicos", () => {
    expect(isPublicPath("/legal")).toBe(true);
    expect(isPublicPath("/contato")).toBe(true);
    expect(isPublicPath("/api/v1/site/contato")).toBe(true);
  });

  it("a âncora não deixa sub-path futuro nascer público de carona", () => {
    // Mesma doutrina da entrada `/^\/legal\/(terms|privacy)$/` que já existia.
    expect(isPublicPath("/legal/rascunho-interno")).toBe(false);
    expect(isPublicPath("/legal/cookies/editar")).toBe(false);
    expect(isPublicPath("/api/v1/site/contato/exportar")).toBe(false);
  });
});

describe("a estrutura dos documentos", () => {
  it("nenhum slug repete", () => {
    const slugs = DOCUMENTOS_LEGAIS.map((d) => d.slug);
    expect(slugs).toEqual([...new Set(slugs)]);
  });

  it("todo slug é minúsculo e sem acento — ele vira URL", () => {
    const tortos = DOCUMENTOS_LEGAIS.map((d) => d.slug).filter((s) => !/^[a-z][a-z0-9-]*$/.test(s));
    expect(tortos).toEqual([]);
  });

  it("documentoPorSlug acha o que existe e recusa o que não existe", () => {
    for (const doc of DOCUMENTOS_LEGAIS) {
      expect(documentoPorSlug(doc.slug)?.slug).toBe(doc.slug);
    }
    expect(documentoPorSlug("nao-existe")).toBeNull();
  });

  it("nenhuma seção está vazia", () => {
    const vazias: string[] = [];
    for (const doc of DOCUMENTOS_LEGAIS) {
      doc.secoes.forEach((s, i) => {
        if (s.paragrafos.length === 0 && (s.itens ?? []).length === 0) {
          vazias.push(`${doc.slug}.secoes[${i}]`);
        }
      });
    }
    expect(vazias, "seção com título e sem conteúdo").toEqual([]);
  });

  it("a data de atualização é uma data ISO", () => {
    for (const doc of DOCUMENTOS_LEGAIS) {
      expect(doc.atualizadoEm, doc.slug).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });
});

describe("os três idiomas estão realmente escritos", () => {
  it("nenhum campo de idioma está vazio", () => {
    const faltando = todasAsFrases()
      .filter(({ f }) => !f.pt.trim() || !f.es.trim() || !f.en.trim())
      .map(({ onde }) => onde);
    expect(faltando).toEqual([]);
  });

  it("nenhuma tradução é o português copiado", () => {
    // Copiar o pt nos três campos compila e passa no teste de cima. É o atalho
    // que produz um contrato em português servido a quem lê inglês.
    const copiadas = todasAsFrases()
      .filter(({ f }) => f.es.trim() === f.pt.trim() || f.en.trim() === f.pt.trim())
      .map(({ onde }) => onde)
      .filter((onde) => !(onde in IDENTICO_DE_PROPOSITO));
    expect(copiadas, `${copiadas.length} frase(s) com "tradução" igual ao português`).toEqual([]);
  });

  it("a lista de exceções não guarda frase que já divergiu", () => {
    // O contrário da regra acima. Uma exceção que sobra depois de o texto ser
    // reescrito é permissão viva para copiar o português naquele campo.
    const mapa = new Map(todasAsFrases().map(({ onde, f }) => [onde, f]));
    const desnecessarias = Object.keys(IDENTICO_DE_PROPOSITO).filter((onde) => {
      const f = mapa.get(onde);
      return !f || (f.es.trim() !== f.pt.trim() && f.en.trim() !== f.pt.trim());
    });
    expect(desnecessarias, "exceção que não é mais necessária").toEqual([]);
  });

  it("os três idiomas usam os MESMOS marcadores", () => {
    // `{operador}` presente só no português produz um parágrafo em espanhol
    // que fala do operador sem nomeá-lo — ou, pior, sobra na tela como chave.
    const marcadores = (s: string) => (s.match(/\{[a-z]+\}/g) ?? []).slice().sort().join(",");
    const divergentes = todasAsFrases()
      .filter(({ f }) => {
        const pt = marcadores(f.pt);
        return marcadores(f.es) !== pt || marcadores(f.en) !== pt;
      })
      .map(({ onde }) => onde);
    expect(divergentes).toEqual([]);
  });

  it("só existem os dois marcadores que a renderização conhece", () => {
    const desconhecidos = new Set<string>();
    for (const { f } of todasAsFrases()) {
      for (const texto of [f.pt, f.es, f.en]) {
        for (const m of texto.match(/\{[a-z]+\}/g) ?? []) {
          if (m !== "{sistema}" && m !== "{operador}") desconhecidos.add(m);
        }
      }
    }
    expect([...desconhecidos]).toEqual([]);
  });
});

describe("a substituição dos marcadores", () => {
  const nomes = { sistema: "Sistema X", operador: "Empresa Y Ltda." };

  it("resolve os dois marcadores, em qualquer idioma", () => {
    const f: Frase = {
      pt: "O {sistema} é operado por {operador}, e {sistema} não decide nada.",
      es: "{sistema} es operado por {operador}.",
      en: "{sistema} is run by {operador}.",
    };
    for (const idioma of ["pt-BR", "es", "en"] as const) {
      const saida = frase(f, idioma, nomes);
      expect(saida).not.toContain("{sistema}");
      expect(saida).not.toContain("{operador}");
      expect(saida).toContain("Empresa Y Ltda.");
    }
  });

  it("o nome do operador não é interpretado como padrão de substituição", () => {
    // `String.replace` trata `$&` no substituto como "o trecho casado". Se a
    // substituição usasse expressão regular, uma razão social com `$&` — que é
    // texto válido num campo de banco — se reescreveria dentro do contrato.
    const saida = frase(
      { pt: "Operado por {operador}.", es: "Operado por {operador}.", en: "Run by {operador}." },
      "pt-BR",
      { sistema: "S", operador: "A$&B $1 Ltda." },
    );
    expect(saida).toBe("Operado por A$&B $1 Ltda..");
  });

  it("nenhum documento nomeia pessoa, marca ou domínio", () => {
    // A doutrina de marca própria vale aqui com força extra: um contrato que
    // nomeia o software inverte os papéis de controlador e operador.
    const proibido = /deskcomm|atenza|\.com\b|\.online\b|https?:\/\//i;
    const vazando = todasAsFrases()
      .filter(({ f }) => proibido.test(f.pt) || proibido.test(f.es) || proibido.test(f.en))
      .map(({ onde }) => onde);
    expect(vazando).toEqual([]);
  });
});
