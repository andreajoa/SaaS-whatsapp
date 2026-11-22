import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { isPublicPath } from "@/lib/auth/public-paths";
import { ehBotDeBusca } from "@/lib/mercado/visitante";

const RAIZ = process.cwd();

describe("rotas públicas de SEO, GEO e PWA nunca congelam no build Docker", () => {
  const rotas = [
    "app/robots.ts",
    "app/sitemap.ts",
    "app/llms.txt/route.ts",
    "app/llms-full.txt/route.ts",
    "app/manifest.ts",
    "app/logo-512.png/route.ts",
  ];

  it.each(rotas)("%s exporta `dynamic = \"force-dynamic\"`", (rel) => {
    const src = fs.readFileSync(path.join(RAIZ, rel), "utf8");
    expect(src).toMatch(/export const dynamic\s*=\s*"force-dynamic"/);
  });

  it("public/llms.txt estático não existe para sobrescrever app/llms.txt/route.ts", () => {
    expect(fs.existsSync(path.join(RAIZ, "public/llms.txt"))).toBe(false);
  });

  it("/llms.txt e /llms-full.txt atravessam o middleware sem exigir login", () => {
    expect(isPublicPath("/llms.txt")).toBe(true);
    expect(isPublicPath("/llms-full.txt")).toBe(true);
  });

  it("crawlers de busca e IA são identificados e protegidos contra geo-redirect na home", () => {
    expect(ehBotDeBusca("Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)")).toBe(true);
    expect(ehBotDeBusca("Mozilla/5.0 (compatible; bingbot/2.0)")).toBe(true);
    expect(ehBotDeBusca("GPTBot/1.0")).toBe(true);
    expect(ehBotDeBusca("ClaudeBot/1.0")).toBe(true);
    expect(ehBotDeBusca("PerplexityBot/1.0")).toBe(true);
    expect(ehBotDeBusca("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/130.0.0.0")).toBe(false);
  });
});
