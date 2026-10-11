import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { PAGES_SEO } from "./conteudo-seo";
import { ilustracaoDaPagina } from "./ilustracoes";
import { montarMenu } from "./menu";

const publico = (src: string) => path.join(process.cwd(), "public", src);

describe("cada página tem a sua ilustração", () => {
  it("toda página editorial tem ilustração, o arquivo existe e nenhuma se repete", () => {
    const srcs = PAGES_SEO.map((p) => ilustracaoDaPagina(p.slug)?.src ?? `FALTA:${p.slug}`);
    expect(srcs.filter((s) => s.startsWith("FALTA:"))).toEqual([]);
    expect(srcs.filter((s) => !fs.existsSync(publico(s)))).toEqual([]);
    expect(new Set(srcs).size).toBe(srcs.length);
  });

  it("as imagens dos cartões de segmento do menu existem", () => {
    const menu = montarMenu((t) => t, true);
    const imagens = menu.grupos.flatMap((g) => [
      ...g.itens.map((i) => i.imagem).filter((i): i is string => Boolean(i)),
      g.destaque.imagem,
    ]);
    expect(imagens.filter((s) => !fs.existsSync(publico(s)))).toEqual([]);
  });
});
