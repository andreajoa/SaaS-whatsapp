/** Uma página pública vira texto; nenhum recurso, formulário ou script é executado. */
import { lookup } from "node:dns/promises";
import { request } from "node:https";
import { isIP } from "node:net";
import { ipEhEspecial } from "@/lib/automation/outbound-ip";

export const URL_SOURCE_MAX_BYTES = 1_000_000;
const TIMEOUT_MS = 10_000;

export class ErroDeFonteUrl extends Error {}

/** IPv6 só unicast global, sem túneis/intervalos de atribuição especial. */
export function ipPublicoParaFonteUrl(ip: string): boolean {
  if (isIP(ip) === 4) return !ipEhEspecial(ip) && !ip.startsWith("192.88.99.");
  if (isIP(ip) !== 6) return false;
  const normal = new URL(`https://[${ip}]/`).hostname.slice(1, -1);
  const palavras = normal.split(":");
  const blocoEspecial =
    palavras[0] === "2001" && (parseInt(palavras[1] || "0", 16) <= 0x1ff || palavras[1] === "db8");
  return (
    /^[23][0-9a-f]{3}:/.test(normal) &&
    !blocoEspecial &&
    !normal.startsWith("2002:") &&
    !normal.startsWith("3fff:")
  );
}

/** Não faz rede. O worker valida o DNS novamente em CADA tentativa. */
export function validarUrlDeFonte(bruto: unknown): string {
  if (typeof bruto !== "string" || bruto.length > 2048) {
    throw new ErroDeFonteUrl("Informe o endereço HTTPS de uma página pública.");
  }
  let url: URL;
  try {
    url = new URL(bruto.trim());
  } catch {
    throw new ErroDeFonteUrl("Informe o endereço HTTPS de uma página pública.");
  }
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    (url.port && url.port !== "443")
  ) {
    throw new ErroDeFonteUrl("Use HTTPS, sem senha no endereço, na porta padrão.");
  }
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (
    isIP(host)
      ? !ipPublicoParaFonteUrl(host)
      : !host.includes(".") ||
        /(?:^|\.)(?:localhost|local|internal|lan|home|test|invalid|example)\.?$/i.test(host)
  ) {
    throw new ErroDeFonteUrl(
      "O endereço deve apontar para uma página pública, fora da rede interna.",
    );
  }
  url.hash = "";
  return url.href;
}

const OMITIR = new Set([
  "head",
  "script",
  "style",
  "form",
  "template",
  "noscript",
  "iframe",
  "object",
  "svg",
  "canvas",
  "button",
  "select",
  "textarea",
]);
const VAZIOS = new Set([
  "area",
  "base",
  "br",
  "col",
  "embed",
  "hr",
  "img",
  "input",
  "link",
  "meta",
  "param",
  "source",
  "track",
  "wbr",
]);
const BLOCOS =
  /^(?:p|div|section|article|main|header|footer|nav|aside|h[1-6]|li|ul|ol|table|tr|td|th|br|hr)$/;

function entidades(texto: string): string {
  const nomes: Record<string, string> = {
    amp: "&",
    lt: "<",
    gt: ">",
    quot: '"',
    apos: "'",
    nbsp: " ",
    ndash: "–",
    mdash: "—",
    hellip: "…",
    copy: "©",
    reg: "®",
    trade: "™",
  };
  for (const [letra, entidade] of Object.entries({
    á: "aacute",
    à: "agrave",
    â: "acirc",
    ã: "atilde",
    ä: "auml",
    é: "eacute",
    è: "egrave",
    ê: "ecirc",
    ë: "euml",
    í: "iacute",
    ì: "igrave",
    î: "icirc",
    ï: "iuml",
    ó: "oacute",
    ò: "ograve",
    ô: "ocirc",
    õ: "otilde",
    ö: "ouml",
    ú: "uacute",
    ù: "ugrave",
    û: "ucirc",
    ü: "uuml",
    ç: "ccedil",
    ñ: "ntilde",
  })) {
    nomes[entidade] = letra;
    nomes[entidade[0]!.toUpperCase() + entidade.slice(1)] = letra.toUpperCase();
  }
  return texto.replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi, (original, nome: string) => {
    if (!nome.startsWith("#")) return nomes[nome] ?? original;
    const n =
      nome[1]?.toLowerCase() === "x" ? parseInt(nome.slice(2), 16) : parseInt(nome.slice(1), 10);
    return n > 0 && n <= 0x10ffff && !(n >= 0xd800 && n <= 0xdfff) ? String.fromCodePoint(n) : " ";
  });
}

/** Tokeniza somente texto/tags. Não carrega DOM, scripts, CSS nem URLs embutidas. */
export function extrairTextoHtml(html: string): string {
  const pilha: Array<{ tag: string; omitido: boolean }> = [];
  const saida: string[] = [];
  let omitidos = 0;
  let pos = 0;
  const fecharDesde = (i: number, permitirOmitidos = false) => {
    // Um fechamento implícito/ancestral não pode fazer script, form ou template vazar.
    if (!permitirOmitidos && i >= 0 && pilha.slice(i).some((p) => p.omitido)) return;
    if (i >= 0) for (const p of pilha.splice(i)) if (p.omitido) omitidos--;
  };
  // Varredura linear: regex de tag sobre entrada sem '>' pode custar O(n²).
  while (pos < html.length) {
    const topo = pilha.at(-1)?.tag;
    if (topo === "script" || topo === "style" || topo === "textarea") {
      // Comentário ou aspas de JS não mudam o fechamento HTML de raw text.
      const fechamento = new RegExp(`</${topo}(?=[\\t\\n\\f\\r />])[^>]*>`, "gi");
      fechamento.lastIndex = pos;
      const fim = fechamento.exec(html);
      if (!fim) break;
      fecharDesde(pilha.length - 1, true);
      pos = fechamento.lastIndex;
      continue;
    }
    if (html.startsWith("<!--", pos)) {
      const fim = html.indexOf("-->", pos + 4);
      pos = fim < 0 ? html.length : fim + 3;
      continue;
    }
    if (html[pos] !== "<") {
      const fim = html.indexOf("<", pos);
      const ate = fim < 0 ? html.length : fim;
      if (pilha.at(-1)?.tag === "head" && html.slice(pos, ate).trim())
        fecharDesde(pilha.length - 1, true);
      if (!omitidos) saida.push(html.slice(pos, ate));
      pos = ate;
      continue;
    }
    if (!/^<\/?[a-z]|^<!/i.test(html.slice(pos, pos + 3))) {
      if (!omitidos) saida.push("<");
      pos++;
      continue;
    }
    let fim = pos + 1;
    let aspas = "";
    for (; fim < html.length; fim++) {
      const c = html[fim]!;
      if (aspas) {
        if (c === aspas) aspas = "";
      } else if (c === '"' || c === "'") aspas = c;
      else if (c === ">") break;
    }
    if (fim === html.length) break;
    const token = html.slice(pos, fim + 1);
    pos = fim + 1;
    if (token.startsWith("<!")) continue;
    const tag = /^<(\/)?([a-z][\w:-]*)\b/i.exec(token);
    if (!tag) {
      if (!omitidos) saida.push(token);
      continue;
    }
    const nome = tag[2]!.toLowerCase();
    if (
      !tag[1] &&
      pilha.at(-1)?.tag === "head" &&
      ![
        "head",
        "title",
        "script",
        "style",
        "meta",
        "link",
        "noscript",
        "base",
        "template",
      ].includes(nome)
    ) {
      fecharDesde(pilha.length - 1, true);
    }
    if (tag[1]) {
      const i = pilha.findLastIndex((p) => p.tag === nome);
      fecharDesde(i, pilha[i]?.omitido === true);
    } else if (!VAZIOS.has(nome)) {
      // Fechamentos opcionais comuns do HTML: irmãos não são 257 níveis.
      if (nome === "body") fecharDesde(pilha.findLastIndex((p) => p.tag === "head"), true);
      if (BLOCOS.test(nome)) fecharDesde(pilha.findLastIndex((p) => p.tag === "p"));
      if (
        nome === "li" ||
        nome === "dt" ||
        nome === "dd" ||
        nome === "tr" ||
        nome === "td" ||
        nome === "th"
      ) {
        const grupo =
          nome === "dt" || nome === "dd"
            ? ["dt", "dd"]
            : nome === "td" || nome === "th"
              ? ["td", "th"]
              : [nome];
        const limite =
          nome === "li" ? ["ul", "ol"] : nome === "dt" || nome === "dd" ? ["dl"] : ["table"];
        for (let i = pilha.length - 1; i >= 0; i--) {
          if (limite.includes(pilha[i]!.tag)) break;
          if (grupo.includes(pilha[i]!.tag)) {
            fecharDesde(i);
            break;
          }
        }
      }
      if (pilha.length >= 256)
        throw new ErroDeFonteUrl(
          "A estrutura da página é complexa demais. Envie o texto como documento.",
        );
      const omitido =
        OMITIR.has(nome) || /\s(?:hidden|aria-hidden\s*=\s*["']?true)(?:\s|["'/>])/i.test(token);
      pilha.push({ tag: nome, omitido });
      if (omitido) omitidos++;
    }
    if (!omitidos && BLOCOS.test(nome)) saida.push("\n");
  }
  return entidades(saida.join(""))
    .replace(/[\t \r\f]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Charset declarado é respeitado; bytes incompatíveis nunca viram texto corrompido. */
export function decodificarPagina(bytes: Buffer, contentType: string): string {
  const charset = /charset\s*=\s*(?:"([^"]+)"|'([^']+)'|([^;\s]+))/i.exec(contentType);
  const prefixo = bytes.subarray(0, 1024).toString("latin1")
    .replace(/<!--[\s\S]*?(?:-->|$)/g, "")
    .replace(/<(script|style)\b[^>]*>[\s\S]*?(?:<\/\1(?=[\t\n\f\r />])[^>]*>|$)/gi, "");
  const sniff =
    !charset && /^text\/html/i.test(contentType)
      ? /<meta\b[^>]*charset\s*=\s*["']?([^\s"'/>;]+)/i.exec(
          prefixo,
        )
      : null;
  const encoding = charset?.[1] ?? charset?.[2] ?? charset?.[3] ?? sniff?.[1] ?? "utf-8";
  try {
    return new TextDecoder(encoding, { fatal: true }).decode(bytes);
  } catch {
    throw new ErroDeFonteUrl(
      "Não consegui ler a codificação da página. Envie o texto como documento.",
    );
  }
}

/** DNS validado e fixado no socket; Host/SNI continuam sendo o domínio original. */
export async function extrairTextoDaUrl(bruto: unknown): Promise<{ texto: string; url: string }> {
  const url = new URL(validarUrlDeFonte(bruto));
  const host = url.hostname.replace(/^\[|\]$/g, "");
  const inicio = Date.now();
  let dnsTimer: ReturnType<typeof setTimeout> | undefined;
  let enderecos: Array<{ address: string; family: number }>;
  try {
    enderecos = await Promise.race([
      isIP(host)
        ? Promise.resolve([{ address: host, family: isIP(host) }])
        : lookup(host, { all: true }),
      new Promise<never>((_, reject) => {
        dnsTimer = setTimeout(() => reject(new Error()), TIMEOUT_MS);
      }),
    ]);
  } catch {
    throw new ErroDeFonteUrl(
      "Não consegui resolver o endereço público da página. Tente novamente.",
    );
  } finally {
    clearTimeout(dnsTimer);
  }
  if (!enderecos.length || enderecos.some((e) => !ipPublicoParaFonteUrl(e.address))) {
    throw new ErroDeFonteUrl(
      "O endereço resolve para uma rede interna ou reservada. A página não foi acessada.",
    );
  }
  const destino = enderecos[0]!;
  const corpo = await new Promise<string>((resolve, reject) => {
    let terminado = false;
    const falhar = (mensagem: string) => {
      if (terminado) return;
      terminado = true;
      clearTimeout(timer);
      req.destroy();
      reject(new ErroDeFonteUrl(mensagem));
    };
    const req = request(
      url,
      {
        method: "GET",
        agent: false,
        maxHeaderSize: 16_384,
        headers: { Accept: "text/html, text/plain", "Accept-Encoding": "identity" },
        // Nenhuma segunda resolução (inclusive IPv6/autoSelectFamily) pode mudar o destino.
        lookup: (_hostname, options, callback) => {
          if (options.all) callback(null, [destino]);
          else callback(null, destino.address, destino.family);
        },
      },
      (res) => {
        const status = res.statusCode ?? 0;
        if (status >= 300 && status < 400) {
          falhar("A página redireciona. Informe o endereço HTTPS final para preparar o material.");
          return;
        }
        if (status < 200 || status >= 300) {
          falhar("A página não está disponível para leitura pública. Tente novamente.");
          return;
        }
        const tipo = res.headers["content-type"]?.split(";")[0]?.trim().toLowerCase();
        if (tipo !== "text/html" && tipo !== "text/plain") {
          falhar("A página precisa responder com HTML ou texto simples.");
          return;
        }
        if (res.headers["content-encoding"] && res.headers["content-encoding"] !== "identity") {
          falhar(
            "A página respondeu com conteúdo comprimido. Use uma página que permita leitura em texto.",
          );
          return;
        }
        if (Number(res.headers["content-length"]) > URL_SOURCE_MAX_BYTES) {
          falhar("A página excede o limite de 1 MB.");
          return;
        }
        const partes: Buffer[] = [];
        let bytes = 0;
        res.on("data", (parte: Buffer) => {
          if (terminado) return;
          bytes += parte.length;
          if (bytes > URL_SOURCE_MAX_BYTES) {
            falhar("A página excede o limite de 1 MB.");
            return;
          }
          partes.push(parte);
        });
        res.on("error", () => falhar("A leitura da página foi interrompida. Tente novamente."));
        res.on("end", () => {
          if (terminado) return;
          clearTimeout(timer);
          try {
            const texto = decodificarPagina(
              Buffer.concat(partes),
              res.headers["content-type"] ?? "",
            );
            const extraido = tipo === "text/html" ? extrairTextoHtml(texto) : texto.trim();
            terminado = true;
            resolve(extraido);
          } catch (err) {
            falhar(
              err instanceof ErroDeFonteUrl
                ? err.message
                : "A estrutura da página é complexa demais. Envie o texto como documento.",
            );
          }
        });
      },
    );
    const timer = setTimeout(
      () => falhar("A página demorou demais para responder. Tente novamente."),
      Math.max(1, TIMEOUT_MS - (Date.now() - inicio)),
    );
    req.on("error", () => falhar("Não consegui acessar a página com segurança. Tente novamente."));
    req.end();
  });
  if (!corpo)
    throw new ErroDeFonteUrl(
      "A página não contém texto para preparar. Páginas que dependem de scripts precisam ser enviadas como documento.",
    );
  return { texto: corpo, url: url.href };
}
