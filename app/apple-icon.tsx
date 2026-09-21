import { ImageResponse } from "next/og";

import { CACHE_DO_LADRILHO, LadrilhoDaMarca } from "@/lib/branding/ladrilho";
import { marcaDaSaida } from "@/lib/branding/saida";

/**
 * O ícone de 180px — e ele não é só do iPhone.
 *
 * ─── Os dois buracos que ele fecha ─────────────────────────────────────────
 *
 * 1. **"Adicionar à Tela de Início" no iOS.** Sem `apple-icon`, o Safari
 *    captura um retrato da PÁGINA e usa como atalho. Numa ferramenta de
 *    atendimento — que a dona da loja abre do celular o dia inteiro — o atalho
 *    fica sendo uma miniatura ilegível da caixa de entrada. O `/icon` de 64px
 *    não serve: o iOS pede 180.
 *
 * 2. **O cabeçalho dos e-mails.** Cliente de e-mail não renderiza `<svg>`
 *    inline — o Gmail descarta a tag inteira —, então o logo de um e-mail tem
 *    de ser uma URL de imagem RASTER. Esta rota é essa URL
 *    (`lib/email/marca.ts` a monta), e ela resolve a marca em runtime pelo
 *    mesmo caminho da aba. A alternativa seria um PNG em `public/`, que é a
 *    marca do produto vazando para o e-mail de todo revendedor — o modo de
 *    falha que `app/icon.tsx` documenta por extenso.
 *
 * ─── Por que não basta apontar o e-mail para `/icon` ───────────────────────
 *
 * 64px num cabeçalho de e-mail em tela retina sai borrado, e ampliar por
 * atributo `width` não recupera pixel que não foi desenhado. 180 é o mesmo
 * número que o iOS já pede, então os dois consumidores cabem numa rota só em
 * vez de duas.
 *
 * ⚠️ `/apple-icon` precisa estar em `PUBLIC_PATHS` (`lib/auth/public-paths.ts`)
 * pelo mesmo motivo de `/icon`: o matcher do proxy só dispensa caminho COM
 * extensão. Sem a entrada, o logo do e-mail responde 307 para `/login` e chega
 * quebrado na caixa de entrada de quem ainda nem tem conta.
 */

export const dynamic = "force-dynamic";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default async function AppleIcon() {
  const marca = await marcaDaSaida(null);
  return new ImageResponse(<LadrilhoDaMarca marca={marca} lado={size.width} />, {
    ...size,
    headers: CACHE_DO_LADRILHO,
  });
}
