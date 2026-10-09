import { assertSafeOutboundUrl } from "@/lib/automation/outbound-url";
import { assertDestinoResolvidoSeguro } from "@/lib/automation/outbound-ip";
import { parsePublicUrl, resolvePublicAddress, requestPinned } from "@/lib/integration-actions/network";

export class CommerceError extends Error {
  constructor(public code: string, public status: number = 502) { super(code); }
}
export async function validateStoreUrl(value: string, provider: "shopify" | "woocommerce"): Promise<string> {
  const url = new URL(value);
  if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash || url.port) {
    throw new CommerceError("Informe a URL HTTPS pública da loja, sem credenciais ou parâmetros.", 422);
  }
  if (provider === "shopify" && (!/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(url.hostname) || url.pathname !== "/")) {
    throw new CommerceError("Use o domínio original da loja: sua-loja.myshopify.com.", 422);
  }
  assertSafeOutboundUrl(url.toString());
  await assertDestinoResolvidoSeguro(url.hostname);
  return url.toString().replace(/\/$/, "");
}

/** Resposta limitada inclusive quando o servidor não fornece Content-Length. */
export async function readBoundedJson(res: Response, maxBytes = 4_000_000): Promise<unknown> {
  if (Number(res.headers.get("content-length") ?? 0) > maxBytes) {
    await res.body?.cancel(); throw new CommerceError("remote_response_too_large");
  }
  if (!res.body) throw new CommerceError("remote_response_empty");
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = []; let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) { await reader.cancel(); throw new CommerceError("remote_response_too_large"); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  try { return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown; }
  catch { throw new CommerceError("remote_response_invalid"); }
}
export async function commerceRequest(url: string, init: RequestInit): Promise<unknown> {
  const parsed = parsePublicUrl(url);
  const address = await resolvePublicAddress(parsed);
  const headers = Object.fromEntries(new Headers(init.headers).entries());
  headers["accept-encoding"] = "identity";
  const res = await requestPinned({ url: parsed, address, method: init.method ?? "GET", headers, body: typeof init.body === "string" ? init.body : undefined, maxBytes: 4_000_000, signal: AbortSignal.timeout(15_000) });
  if (res.status < 200 || res.status >= 300) {
    throw new CommerceError(res.status === 401 ? "Credencial inválida ou expirada." : res.status === 403 ? "A loja não autorizou as permissões necessárias." : res.status === 429 ? "A loja atingiu o limite de consultas. Tente novamente em alguns minutos." : "A loja não respondeu à consulta. Tente novamente.", res.status === 429 ? 429 : 502);
  }
  try { return JSON.parse(res.body) as unknown; } catch { throw new CommerceError("Resposta inválida da loja."); }
}
