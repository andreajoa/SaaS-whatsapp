import { describe, expect, it } from "vitest";

import { isPublicPath } from "@/lib/auth/public-paths";

describe("mídia da vitrine antes do cadastro", () => {
  it.each([
    "/media/atenza/atendimento-loop.mp4",
    "/media/atenza/atenza-explica.mp4",
    "/media/atenza/atenza-explica.vtt",
  ])("visitante anônimo pode carregar %s", (pathname) => {
    expect(isPublicPath(pathname)).toBe(true);
  });

  it.each([
    "/media/atenza/cliente.mp4",
    "/media/atenza/atenza-explica.mp4/editar",
    "/media/atenza/atenza-explica.vtt/interno",
    "/media/privado/atenza-explica.mp4",
    "/app/inbox/atendimento-loop.mp4",
    "/api/v1/messages/atenza-explica.vtt",
  ])("a mídia pública não libera %s", (pathname) => {
    expect(isPublicPath(pathname)).toBe(false);
  });
});
