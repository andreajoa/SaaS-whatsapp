import type { MetadataRoute } from "next";

import { instalacaoCobra } from "@/lib/billing/planos";
import { env } from "@/lib/env";

// Runtime dinâmico obrigatório: a imagem Docker genérica é buildada sem
// STRIPE_SECRET_KEY. Sem `force-dynamic`, o Next pré-renderiza `Disallow: /`
// no build e bloqueia 100% da indexação em produção.
export const dynamic = "force-dynamic";

const DISALLOW_PRIVADO = [
  "/app",
  "/api",
  "/admin",
  "/onboarding",
  "/get-started",
  "/login",
  "/signup",
  "/reset-password",
];

/**
 * Crawlers de busca tradicional e busca generativa (GEO) explicitamente
 * autorizados na vitrine comercial (ChatGPT, Claude, Perplexity, Gemini, Bing, Google).
 */
const AI_AND_SEARCH_CRAWLERS = [
  "Googlebot",
  "Bingbot",
  "GPTBot",
  "OAI-SearchBot",
  "ChatGPT-User",
  "ClaudeBot",
  "Claude-SearchBot",
  "anthropic-ai",
  "PerplexityBot",
  "Google-Extended",
  "Applebot-Extended",
];

export default function robots(): MetadataRoute.Robots {
  if (!instalacaoCobra()) {
    return { rules: [{ userAgent: "*", disallow: "/" }] };
  }

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: DISALLOW_PRIVADO,
      },
      ...AI_AND_SEARCH_CRAWLERS.map((userAgent) => ({
        userAgent,
        allow: "/",
        disallow: DISALLOW_PRIVADO,
      })),
    ],
    sitemap: new URL("/sitemap.xml", env.NEXT_PUBLIC_APP_URL).toString(),
  };
}
