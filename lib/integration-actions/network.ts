import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { request } from "node:https";
import { IntegrationActionError } from "./schema";

export interface Address { address: string; family: number; }
export type Resolver = (hostname: string) => Promise<Address[]>;

/** Fail-closed: IPv6 só unicast global 2000::/3, sem túneis/transição. */
export function isPublicAddress(address: string): boolean {
  const family = isIP(address);
  if (family === 4) {
    const [a, b, c] = address.split(".").map(Number) as [number, number, number, number];
    return !(a === 0 || a === 10 || a === 127 || a >= 224 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && (b === 168 || b === 0 || (b === 88 && c === 99))) || (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) || (a === 203 && b === 0 && c === 113));
  }
  if (family === 6) {
    const lower = address.toLowerCase();
    const first = Number.parseInt(lower.split(":")[0]!, 16);
    const second = Number.parseInt(lower.split(":")[1] || "0", 16);
    return first >= 0x2000 && first <= 0x3fff && !(first === 0x2001 && (second <= 0x01ff || second === 0x0db8)) && first !== 0x2002 && first !== 0x3fff;
  }
  return false;
}

export function parsePublicUrl(template: string): URL {
  const authority = /^https:\/\/([^/?#]+)(?:[/?#]|$)/i.exec(template)?.[1];
  if (!authority || authority.includes("{{") || template.includes("\\")) throw new IntegrationActionError("unsafe_url", "Use uma URL HTTPS pública com domínio fixo.");
  let url: URL;
  try { url = new URL(template); } catch { throw new IntegrationActionError("unsafe_url", "URL inválida."); }
  const hostname = url.hostname.replace(/^\[|\]$/g, "");
  if (url.protocol !== "https:" || url.username || url.password || url.hash || (url.port && url.port !== "443") || hostname.endsWith(".") || /(^|\.)(localhost|local|internal|test|invalid|example|onion)$/.test(hostname) || (!isIP(hostname) && !hostname.includes("."))) throw new IntegrationActionError("unsafe_url", "Use uma URL HTTPS pública sem credenciais, fragmentos ou portas alternativas.");
  if (isIP(hostname) && !isPublicAddress(hostname)) throw new IntegrationActionError("unsafe_url", "Destinos privados ou reservados não são permitidos.");
  for (const key of url.searchParams.keys()) if (/token|secret|password|api[-_]?key|authorization/i.test(key)) throw new IntegrationActionError("unsafe_url", "Credenciais devem ficar em cabeçalhos protegidos, nunca na URL.");
  return url;
}

export async function resolvePublicAddress(url: URL, resolver: Resolver = h => lookup(h, { all: true, verbatim: true })): Promise<Address> {
  const hostname = url.hostname.replace(/^\[|\]$/g, "");
  const addresses = isIP(hostname) ? [{ address: hostname, family: isIP(hostname) }] : await resolver(hostname);
  if (!addresses.length || addresses.some(a => !isPublicAddress(a.address) || a.family !== isIP(a.address))) throw new IntegrationActionError("unsafe_dns", "O domínio precisa resolver somente para endereços públicos.");
  return addresses[0]!;
}

export interface SafeRequest { url: URL; address: Address; method: string; headers: Record<string, string>; body?: string; signal: AbortSignal; maxBytes: number; }
export interface SafeResponse { status: number; body: string; }
/** Sem redirect, proxy de ambiente ou nova resolução DNS: o socket usa o IP validado. */
export function requestPinned(input: SafeRequest): Promise<SafeResponse> {
  parsePublicUrl(input.url.href);
  if (!isPublicAddress(input.address.address) || input.address.family !== isIP(input.address.address)) return Promise.reject(new IntegrationActionError("unsafe_dns", "IP de conexão não permitido."));
  return new Promise((resolve, reject) => {
    const req = request(input.url, {
      method: input.method, headers: input.headers, signal: input.signal, agent: false, family: input.address.family,
      lookup: (_hostname, _opts, callback) => callback(null, input.address.address, input.address.family),
    }, res => {
      const status = res.statusCode ?? 502;
      if (status >= 300 && status < 400) { res.destroy(); reject(new IntegrationActionError("redirect_blocked", "Redirecionamento recusado. Configure o endereço final.")); return; }
      if (res.headers["content-encoding"] && res.headers["content-encoding"] !== "identity") { res.destroy(); reject(new IntegrationActionError("unsupported_response", "O fornecedor devolveu uma resposta comprimida não permitida.")); return; }
      if (Number(res.headers["content-length"] ?? 0) > input.maxBytes) { res.destroy(); reject(new IntegrationActionError("response_too_large", "Resposta excede o limite configurado.")); return; }
      let size = 0;
      const parts: Buffer[] = [];
      res.on("data", (chunk: Buffer) => {
        size += chunk.length;
        if (size > input.maxBytes) { res.destroy(); reject(new IntegrationActionError("response_too_large", "Resposta excede o limite configurado.")); }
        else parts.push(chunk);
      });
      res.on("end", () => resolve({ status, body: Buffer.concat(parts).toString("utf8") }));
      res.on("error", reject);
    });
    req.on("error", reject);
    req.end(input.body);
  });
}
