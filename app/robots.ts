import type { MetadataRoute } from "next";

import { instalacaoCobra } from "@/lib/billing/planos";
import { env } from "@/lib/env";

/**
 * O que os buscadores podem ler.
 *
 * ─── Por que existe, se o layout raiz já diz `noindex` ─────────────────────
 *
 * `<meta name="robots">` só é lido DEPOIS de baixar a página: o robô entra,
 * gasta a visita e então descobre que não devia indexar. `robots.txt` é lido
 * antes de qualquer requisição. Sem ele — o estado até agora — o Googlebot
 * rastreia `/app/...` inteiro para no fim jogar fora, e o orçamento de rastreio
 * que devia ir para a única página que queremos indexada vai para telas de
 * conversa de cliente.
 *
 * ─── O mesmo interruptor de sempre ─────────────────────────────────────────
 *
 * `instalacaoCobra() === false` → a instalação não tem página pública nenhuma
 * (a raiz redireciona), então `Disallow: /` é a resposta inteira e honesta. Uma
 * VPS de cliente não quer o próprio CRM em resultado de busca.
 *
 * A URL do sitemap precisa ser ABSOLUTA — é a única exigência do formato que
 * não é opcional. Ela sai de `NEXT_PUBLIC_APP_URL`, a mesma que o OAuth do
 * Google Agenda usa para montar o endereço de retorno; se essa variável estiver
 * errada, o sintoma aparece muito antes daqui.
 */
export default function robots(): MetadataRoute.Robots {
  if (!instalacaoCobra()) {
    return { rules: [{ userAgent: "*", disallow: "/" }] };
  }

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // O produto em si nunca entra: `/app` é a área logada, `/api` não tem
        // nada legível, e `/login`/`/signup` indexados competem com a raiz pela
        // mesma busca — e perdem, porque não explicam nada.
        disallow: ["/app", "/api", "/login", "/signup", "/reset-password"],
      },
    ],
    sitemap: new URL("/sitemap.xml", env.NEXT_PUBLIC_APP_URL).toString(),
  };
}
