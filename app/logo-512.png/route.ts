import { ImageResponse } from "next/og";
import { createElement } from "react";

import { CACHE_DO_LADRILHO, LadrilhoDaMarca } from "@/lib/branding/ladrilho";
import { marcaDaSaida } from "@/lib/branding/saida";

// Imagem pública, sem dados de conta: usa a mesma marca pública da tela de login.
// Resolver em runtime preserva a identidade de quem instala a imagem Docker.
export const dynamic = "force-dynamic";

export async function GET() {
  const marca = await marcaDaSaida(null);
  return new ImageResponse(createElement(LadrilhoDaMarca, { marca, lado: 512 }), {
    width: 512,
    height: 512,
    headers: CACHE_DO_LADRILHO,
  });
}
