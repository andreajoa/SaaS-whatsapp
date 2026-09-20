import type { MetadataRoute } from "next";

import { instalacaoCobra } from "@/lib/billing/planos";
import { env } from "@/lib/env";

/**
 * As páginas que existem para quem ainda não tem conta.
 *
 * São três, e são todas: a que explica o produto e as duas que o contrato
 * obriga a publicar. Tudo o mais atrás de `/app` é conversa de cliente e está
 * barrado no `app/robots.ts` — sitemap e robots são o mesmo mapa visto dos dois
 * lados, e discordarem é o defeito clássico aqui.
 *
 * Sem cobrança ligada não há página pública nenhuma (a raiz redireciona), então
 * o sitemap é VAZIO e não uma lista de 404 — mesmo interruptor do `robots.ts`.
 *
 * Não há `lastModified`: a única data honesta seria a do deploy, e um sitemap
 * que jura "mudou hoje" a cada build ensina o buscador a ignorar o campo.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  if (!instalacaoCobra()) return [];

  const url = (caminho: string) => new URL(caminho, env.NEXT_PUBLIC_APP_URL).toString();

  return [
    { url: url("/"), changeFrequency: "weekly", priority: 1 },
    { url: url("/legal/terms"), changeFrequency: "yearly", priority: 0.3 },
    { url: url("/legal/privacy"), changeFrequency: "yearly", priority: 0.3 },
  ];
}
