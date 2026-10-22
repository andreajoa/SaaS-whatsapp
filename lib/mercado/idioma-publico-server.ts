import { cookies, headers } from "next/headers";
import { mercadoInglesDoVisitante, COOKIE_MERCADO_PUBLICO } from "./idioma-publico-en";
/** Server-only resolution for visitors entering /login or /signup directly. */
export async function idiomaPublicoDoAcesso() {
  const [h, c] = await Promise.all([headers(), cookies()]);
  return mercadoInglesDoVisitante(
    h.get("x-vercel-ip-country") ?? h.get("cf-ipcountry"),
    c.get(COOKIE_MERCADO_PUBLICO)?.value ?? null,
    h.get("accept-language"),
  );
}
