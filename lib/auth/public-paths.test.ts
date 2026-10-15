/**
 * PUBLIC_PATHS decide quem atravessa o proxy sem sessão em toda a aplicação
 * (`proxy.ts`). Sem teste, uma âncora `$` trocada por prefixo, ou uma entrada
 * larga demais, some em silêncio do CI — foi exatamente o bug achado provando
 * a Task 6 (heartbeat do agente bloqueado por faltar aqui).
 */
import { describe, it, expect } from "vitest";

import { isPublicPath } from "@/lib/auth/public-paths";

describe("isPublicPath", () => {
  it("serve o vídeo comercial francês sem expor outros recursos", () => {
    expect(isPublicPath("/videos/atenza-fr.mp4")).toBe(true);
    expect(isPublicPath("/videos/atenza-fr-v2.mp4")).toBe(true);
    expect(isPublicPath("/videos/atenza-fr-private.mp4")).toBe(false);
    expect(isPublicPath("/videos/private.mp4")).toBe(false);
  });

  it("libera apenas as seis vitrines internacionais públicas", () => {
    for (const locale of ["fr", "de", "es", "mx", "en-us", "en-gb"]) {
      expect(isPublicPath(`/${locale}`)).toBe(true);
      expect(isPublicPath(`/${locale}/private`)).toBe(false);
    }
  });

  it("libera o heartbeat do agente do host (bearer, sem cookie)", () => {
    expect(isPublicPath("/api/v1/system/agent")).toBe(true);
  });

  it("libera o tick do relógio Hobby (bearer, sem cookie)", () => {
    expect(isPublicPath("/api/v1/system/relogio/tick")).toBe(true);
    expect(isPublicPath("/api/v1/system/relogio")).toBe(false);
    expect(isPublicPath("/api/v1/system/relogio/tick/extra")).toBe(false);
  });

  it("a âncora `$` impede que um sub-path passe de carona", () => {
    expect(isPublicPath("/api/v1/system/agent/qualquer")).toBe(false);
  });

  it("não libera a rota de pedido de atualização (exige sessão do dono)", () => {
    expect(isPublicPath("/api/v1/system/update")).toBe(false);
  });

  it("não libera a rota de estado da versão (exige sessão)", () => {
    expect(isPublicPath("/api/v1/system/version")).toBe(false);
  });

  /**
   * Os documentos legais são linkados do checkbox OBRIGATÓRIO da primeira tela
   * do produto (`/onboarding/welcome`). Fora daqui, `proxy.ts` manda o visitante
   * para `/login?next=/legal/terms` — e um aceite de termos que só se lê depois
   * de ter conta é um aceite que ninguém pode conferir antes de aceitar.
   */
  it("libera os documentos legais — o aceite acontece antes de existir conta", () => {
    expect(isPublicPath("/legal/terms")).toBe(true);
    expect(isPublicPath("/legal/privacy")).toBe(true);
  });

  /**
   * `/legal` passou a ser público, e a mudança é de FATO, não de política.
   *
   * Esta linha afirmava `false`, e estava certa: `/legal` não era página
   * nenhuma — era só um prefixo, e prefixo aberto sem tela por trás é
   * superfície de graça. Hoje `/legal` é o índice dos contratos, escrito para
   * quem ainda não tem conta; mantê-lo fechado daria 307 para o login
   * exatamente na página que existe para ser lida antes de haver login.
   *
   * O que NÃO mudou é o que este caso realmente protege: cada documento é
   * liberado pelo NOME, com `$` no fim. Trocar a lista por `/^\/legal/` abriria
   * qualquer `/legal/<coisa>` futura — inclusive um rascunho — sem que ninguém
   * precisasse decidir isso.
   */
  it("mas por nome, um a um: /legal não vira prefixo aberto", () => {
    expect(isPublicPath("/legal")).toBe(true);
    expect(isPublicPath("/legal/terms/interno")).toBe(false);
    expect(isPublicPath("/legal/qualquer-outra")).toBe(false);
    expect(isPublicPath("/legal/cookies/rascunho")).toBe(false);
  });
});

describe("vitrines recuperadas e vídeos públicos", () => {
  it.each([
    "/",
    "/en",
    "/us",
    "/en-us",
    "/en-gb",
    "/es",
    "/mx",
    "/de",
    "/fr",
    "/es/mexico",
    "/es/colombia",
    "/es/argentina",
    "/es/chile",
    "/es/peru",
    "/es/espana",
    "/precos",
    "/demonstracao",
    "/de/impressum",
    "/recursos/agentes-ia",
    "/ajuda/chave-de-ia",
    "/es/ayuda/clave-de-ia",
    "/en/help/ai-key",
  ])("abre %s sem sessão", (path) => {
    expect(isPublicPath(path)).toBe(true);
  });
  it.each([
    "atenza-explica.mp4",
    "atendimento-loop.mp4",
    ...["es-mx", "es-co", "es-ar", "es-cl", "es-pe", "es-es", "en-us", "de-de"].map(
      (locale) => `atenza-explica-${locale}.mp4`,
    ),
  ])("libera o vídeo %s", (file) => {
    expect(isPublicPath(`/media/atenza/${file}`)).toBe(true);
  });
  it.each([
    "/app",
    "/api/v1/settings",
    "/es/interno/segredo",
    "/media/atenza/privado.mp4",
    "/media/atenza/atenza-explica-es-fr.mp4",
    "/videos/privado.mp4",
  ])("mantém %s protegido", (path) => {
    expect(isPublicPath(path)).toBe(false);
  });
});
