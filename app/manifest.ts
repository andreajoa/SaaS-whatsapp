import type { MetadataRoute } from "next";

import { marcaDaSaida } from "@/lib/branding/saida";

// Marca resolvida em runtime (banco + .env), nunca congelada no build Docker.
export const dynamic = "force-dynamic";

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const marca = await marcaDaSaida(null);
  return {
    name: marca.nome,
    short_name: marca.nome,
    display: "standalone",
    start_url: "/app",
    scope: "/",
    icons: [
      { src: "/icon", sizes: "64x64", type: "image/png" },
      { src: "/logo-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
