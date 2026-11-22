import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { isPublicPath } from "@/lib/auth/public-paths";

const RAIZ = process.cwd();

describe("logo PNG público para e-mails e PWA (/logo-512.png)", () => {
  it("/logo-512.png e /apple-icon são caminhos públicos", () => {
    expect(isPublicPath("/logo-512.png")).toBe(true);
    expect(isPublicPath("/apple-icon")).toBe(true);
    expect(isPublicPath("/logo-512.png/extra")).toBe(false);
    expect(isPublicPath("/apple-icon-secret")).toBe(false);
  });

  it("a rota app/logo-512.png/route.ts existe e é dinâmica (force-dynamic)", () => {
    const rota = path.join(RAIZ, "app/logo-512.png/route.ts");
    expect(fs.existsSync(rota)).toBe(true);
    const fonte = fs.readFileSync(rota, "utf8");
    expect(fonte).toMatch(/export const dynamic\s*=\s*"force-dynamic"/);
    expect(fonte).toMatch(/marcaDaSaida\(null\)/);
  });
});
