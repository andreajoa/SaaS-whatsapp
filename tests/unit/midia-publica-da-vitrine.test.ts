import { existsSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { guiaNoIdioma } from "@/lib/ajuda/guia-chave-ia";
import { DEFAULT_APP_NAME } from "@/lib/branding";

import { isPublicPath } from "@/lib/auth/public-paths";

describe("mídia da vitrine antes do cadastro", () => {
  it.each([
    "/media/atenza/atendimento-loop.mp4",
    "/media/atenza/atenza-explica.mp4",
    "/media/atenza/atenza-explica.vtt",
    "/media/atenza/atenza-explica-es-mx.mp4",
    "/media/atenza/atenza-explica-de-de.mp4",
    "/media/atenza/atenza-explica-en-us.mp4",
    "/media/atenza/chave-openai.mp4",
    "/media/atenza/chave-openrouter.mp4",
    "/media/atenza/chave-google-es.mp4",
    "/media/atenza/chave-anthropic-en.mp4",
  ])("visitante anônimo pode carregar %s", (pathname) => {
    expect(isPublicPath(pathname)).toBe(true);
  });

  it.each([
    "/media/atenza/cliente.mp4",
    "/media/atenza/atenza-explica-xx-yy.mp4",
    "/media/atenza/chave-qualquer.mp4",
    "/media/atenza/chave-openai-de.mp4",
    "/media/atenza/atenza-explica.mp4/editar",
    "/media/atenza/atenza-explica.vtt/interno",
    "/media/privado/atenza-explica.mp4",
    "/app/inbox/atendimento-loop.mp4",
    "/api/v1/messages/atenza-explica.vtt",
  ])("a mídia pública não libera %s", (pathname) => {
    expect(isPublicPath(pathname)).toBe(false);
  });

  it.each(["pt-BR", "es"])("todo vídeo que o guia da chave em %s aponta existe em public/ e é público", (idioma) => {
    const guia = guiaNoIdioma(idioma, DEFAULT_APP_NAME);
    const videos = guia.provedores.flatMap((p) => (p.video ? [p.video.src, p.video.poster] : []));
    expect(videos.length).toBeGreaterThan(0);
    for (const arquivo of videos) {
      expect(existsSync(join(process.cwd(), "public", arquivo)), arquivo).toBe(true);
    }
    for (const p of guia.provedores) expect(isPublicPath(p.video!.src)).toBe(true);
  });

  it("inglês aguarda os quatro vídeos antes de expor links", () => {
    expect(guiaNoIdioma("en", DEFAULT_APP_NAME).provedores.some((p) => p.video)).toBe(false);
  });

  it.each(["pt-BR", "es", "en"])("marca própria em %s não recebe o vídeo que fala o nome do produto", (idioma) => {
    expect(guiaNoIdioma(idioma, "Outra Marca").provedores.some((p) => p.video)).toBe(false);
  });
});
