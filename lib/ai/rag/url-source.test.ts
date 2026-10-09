// @vitest-environment node
import { EventEmitter } from "node:events";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { lookup } from "node:dns/promises";
import { request, type RequestOptions } from "node:https";
import {
  extrairTextoDaUrl,
  extrairTextoHtml,
  decodificarPagina,
  ipPublicoParaFonteUrl,
  validarUrlDeFonte,
  URL_SOURCE_MAX_BYTES,
} from "./url-source";

vi.mock("node:dns/promises", () => ({ lookup: vi.fn() }));
vi.mock("node:https", () => ({ request: vi.fn() }));

function pagina(
  {
    status = 200,
    headers = {},
    partes = ["<p>Trocas em 30 dias &amp; frete grátis.</p>"],
    pendente = false,
  } = {} as {
    status?: number;
    headers?: Record<string, string>;
  partes?: Array<string | Buffer>;
    pendente?: boolean;
  },
) {
  const req = new EventEmitter() as EventEmitter & {
    destroy: ReturnType<typeof vi.fn>;
    end: ReturnType<typeof vi.fn>;
  };
  req.destroy = vi.fn();
  vi.mocked(request).mockImplementation(((
    _url: URL,
    _opts: RequestOptions,
    callback: (res: unknown) => void,
  ) => {
    req.end = vi.fn(() => {
      if (pendente) return;
      const res = Object.assign(new EventEmitter(), {
        statusCode: status,
        headers: { "content-type": "text/html; charset=utf-8", ...headers },
      });
      callback(res);
      queueMicrotask(() => {
          for (const p of partes) res.emit("data", Buffer.isBuffer(p) ? p : Buffer.from(p));
        res.emit("end");
      });
    });
    return req;
  }) as never);
  return req;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(lookup).mockResolvedValue([{ address: "93.184.215.14", family: 4 }] as never);
});
afterEach(() => vi.useRealTimers());

describe("fonte URL — sem acesso à rede interna", () => {
  it.each([
    "http://site.com",
    "https://user:secret@site.com",
    "https://site.com:8443",
    "file:///etc/passwd",
    "https://localhost",
    "https://service.internal",
    "https://127.1",
    "https://2130706433",
    "https://0x7f000001",
    "https://169.254.169.254/latest/meta-data",
    "https://[::ffff:127.0.0.1]",
    "https://[::1]",
  ])("recusa %s sem DNS nem request", async (url) => {
    await expect(extrairTextoDaUrl(url)).rejects.toThrow();
    expect(lookup).not.toHaveBeenCalled();
    expect(request).not.toHaveBeenCalled();
  });
  it.each([
    "10.0.0.1",
    "100.64.0.1",
    "172.31.1.1",
    "192.168.1.1",
    "198.18.0.1",
    "192.88.99.1",
    "::ffff:7f00:1",
    "fe90::1",
    "fc00::1",
    "64:ff9b::a00:1",
    "2002:a00:1::",
    "2001::1",
    "2001:db8::1",
    "3fff::1",
  ])("recusa resolução para %s antes de buscar", async (ip) => {
    vi.mocked(lookup).mockResolvedValue([
      { address: ip, family: ip.includes(":") ? 6 : 4 },
    ] as never);
    await expect(extrairTextoDaUrl("https://public.site/policy")).rejects.toThrow(
      /interna ou reservada/,
    );
    expect(request).not.toHaveBeenCalled();
  });
  it("recusa DNS misto público e privado", async () => {
    vi.mocked(lookup).mockResolvedValue([
      { address: "93.184.215.14", family: 4 },
      { address: "10.0.0.1", family: 4 },
    ] as never);
    await expect(extrairTextoDaUrl("https://public.site")).rejects.toThrow();
    expect(request).not.toHaveBeenCalled();
  });
  it("fixa o IP validado no socket sem repassar cookies/chaves ou seguir recursos", async () => {
    pagina({
      partes: [
        '<script src="https://secrets.internal"></script><img src="https://169.254.169.254/"><form action="https://secret.internal">senha</form><p>Trocas &amp; prazo</p>',
      ],
    });
    const resultado = await extrairTextoDaUrl("https://public.site/policy#section");
    expect(resultado).toEqual({ texto: "Trocas & prazo", url: "https://public.site/policy" });
    expect(request).toHaveBeenCalledTimes(1);
    expect(lookup).toHaveBeenCalledTimes(1);
    const options = vi.mocked(request).mock.calls[0]![1] as RequestOptions;
    expect(options.headers).toEqual({
      Accept: "text/html, text/plain",
      "Accept-Encoding": "identity",
    });
    expect(options.agent).toBe(false);
    const cb = vi.fn();
    const pinnedLookup = options.lookup as (
      host: string,
      opts: { all: boolean },
      cb: (...args: unknown[]) => void,
    ) => void;
    pinnedLookup("public.site", { all: false }, cb);
    expect(cb).toHaveBeenCalledWith(null, "93.184.215.14", 4);
    pinnedLookup("public.site", { all: true }, cb);
    expect(cb).toHaveBeenLastCalledWith(null, [{ address: "93.184.215.14", family: 4 }]);
  });
  it("aceita IPv6 global e normaliza o fragmento", () => {
    expect(ipPublicoParaFonteUrl("2606:4700:4700::1111")).toBe(true);
    expect(validarUrlDeFonte("https://public.site/p#x")).toBe("https://public.site/p");
  });
  it("DNS inexistente falha fechado", async () => {
    vi.mocked(lookup).mockRejectedValue(new Error("resolver secret details"));
    await expect(extrairTextoDaUrl("https://public.site")).rejects.toThrow(/resolver o endereço/);
    expect(request).not.toHaveBeenCalled();
  });
});

describe("leitura limitada de páginas", () => {
  it("delimitador parecido com fim de script não expõe código", () => {
    const texto = extrairTextoHtml('<p>A</p><script>const s="</script-x>";SCRIPT_SECRET()</script><p>B</p>');
    expect(texto).toBe("A\n\nB");
  });
  it("fechamento de parágrafo não expõe formulário nem template", () => {
    expect(extrairTextoHtml('<p>Intro<form><p>FORM_SECRET</p></form><p>Public</p>')).not.toContain("SECRET");
    expect(extrairTextoHtml('<p>Intro<template><div>TEMPLATE_SECRET</div></template></p>')).not.toContain("SECRET");
    expect(extrairTextoHtml('<div><form></div>FORM_SECRET</form><p>Public</p>')).not.toContain("SECRET");
  });
  it("charset dentro de comentário ou script não altera a codificação", () => {
    const html = '<!-- <meta charset="iso-8859-1"> --><script>"<meta charset=iso-8859-1>"</script><meta charset="utf-8"><p>Preço</p>';
    expect(extrairTextoHtml(decodificarPagina(Buffer.from(html), "text/html"))).toBe("Preço");
  });
  it("resposta Latin-1 passa pelo decoder e extrator no caminho completo", async () => {
    pagina({ headers: { "content-type": "text/html; charset=iso-8859-1" }, partes: [Buffer.from("<p>Preços e condições</p>", "latin1")] });
    expect((await extrairTextoDaUrl("https://public.site")).texto).toBe("Preços e condições");
  });
  it("script com comentário HTML não engole o resto da página", () => {
    expect(extrairTextoHtml("<p>A</p><script><!-- comment\nconst x=1;</script><p>B</p>")).toBe(
      "A\n\nB",
    );
  });
  it("HTML com head e parágrafos sem fechamento explícito preserva o texto", () => {
    expect(
      extrairTextoHtml(
        "<html><head><title>Shop</title><body><p>Trocas em 30 dias</p></body></html>",
      ),
    ).toBe("Trocas em 30 dias");
    expect(extrairTextoHtml("<html><head><title>Shop</title><p>Trocas em 30 dias</p></html>")).toBe(
      "Trocas em 30 dias",
    );
    expect(extrairTextoHtml("<p>Prazo: 30 dias".repeat(257)).match(/Prazo/g)).toHaveLength(257);
  });
  it("charset do header e meta é respeitado, incluindo acentos", () => {
    const html = "<p>Preços e condições</p>";
    expect(decodificarPagina(Buffer.from(html, "latin1"), "text/html; charset=iso-8859-1")).toBe(
      html,
    );
    expect(
      decodificarPagina(Buffer.from('<meta charset="iso-8859-1">' + html, "latin1"), "text/html"),
    ).toContain(html);
    expect(() =>
      decodificarPagina(Buffer.from(html), "text/html; charset=invalid-encoding"),
    ).toThrow(/codificação/);
    expect(() =>
      decodificarPagina(Buffer.from(html, "latin1"), "text/html; charset=utf-8"),
    ).toThrow(/codificação/);
  });
  it("estrutura excessiva vira falha controlada, sem exceção no event listener", async () => {
    pagina({ partes: ["<div>".repeat(257) + "texto"] });
    await expect(extrairTextoDaUrl("https://public.site")).rejects.toThrow(/complexa demais/);
  });
  it.each([301, 302, 307, 308])("nega redirect %s sem acessar Location", async (status) => {
    const req = pagina({ status, headers: { location: "https://169.254.169.254/" } });
    await expect(extrairTextoDaUrl("https://public.site")).rejects.toThrow(/redireciona/);
    expect(request).toHaveBeenCalledTimes(1);
    expect(req.destroy).toHaveBeenCalled();
  });
  it.each([
    { "content-type": "application/pdf" },
    { "content-encoding": "gzip" },
    { "content-length": String(URL_SOURCE_MAX_BYTES + 1) },
  ] as Record<string, string>[])("recusa resposta incompatível %j", async (headers) => {
    pagina({ headers });
    await expect(extrairTextoDaUrl("https://public.site")).rejects.toThrow();
  });
  it("limita bytes mesmo sem Content-Length", async () => {
    const req = pagina({ partes: ["x".repeat(URL_SOURCE_MAX_BYTES), "extra"] });
    await expect(extrairTextoDaUrl("https://public.site")).rejects.toThrow(/1 MB/);
    expect(req.destroy).toHaveBeenCalled();
  });
  it("limita o tempo total incluindo um servidor silencioso", async () => {
    vi.useFakeTimers();
    const req = pagina({ pendente: true });
    const promessa = expect(extrairTextoDaUrl("https://public.site")).rejects.toThrow(/demorou/);
    await vi.advanceTimersByTimeAsync(10_001);
    await promessa;
    expect(req.destroy).toHaveBeenCalled();
  });
  it("limita espera por DNS e não abre conexão depois do timeout", async () => {
    vi.useFakeTimers();
    vi.mocked(lookup).mockImplementation(() => new Promise(() => {}) as never);
    const promessa = expect(extrairTextoDaUrl("https://public.site")).rejects.toThrow(/resolver/);
    await vi.advanceTimersByTimeAsync(10_001);
    await promessa;
    expect(request).not.toHaveBeenCalled();
  });
  it("conteúdo vazio falha e texto simples é aceito", async () => {
    pagina({ partes: ["<script>secret()</script>"] });
    await expect(extrairTextoDaUrl("https://public.site")).rejects.toThrow(/não contém texto/);
    pagina({ headers: { "content-type": "text/plain" }, partes: ["Preços: R$ 30"] });
    expect((await extrairTextoDaUrl("https://public.site")).texto).toBe("Preços: R$ 30");
  });
});

it("HTML extrai parágrafos e entidades sem scripts, formulários nem atributos", () => {
  const texto = extrairTextoHtml(
    '<head><title>HEAD SECRET</title></head><style>STYLE SECRET</style><!-- COMMENT SECRET --><h1>Trocas</h1><script>if (a < b) alert("SCRIPT SECRET")</script><form><p>FORM SECRET</p><input value="TOKEN"></form><template>TEMPLATE SECRET</template><p>At&eacute; &#51;&#48; dias &amp; frete.</p><div hidden>HIDDEN SECRET</div><p aria-hidden="true">HIDDEN SECRET</p><p>Fim</p>',
  );
  expect(texto).toContain("Trocas");
  expect(texto).toContain("30 dias & frete.");
  expect(texto).toContain("Até 30 dias");
  expect(texto).toContain("Fim");
  expect(texto).not.toMatch(/SECRET|TOKEN|alert|value=/);
});
