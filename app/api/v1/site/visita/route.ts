/**
 * POST /api/v1/site/visita — escreve UMA linha em `site_visits`.
 *
 * ─── Por que uma rota, e não um `insert` dentro do render da página ────────
 *
 * Gravar no render de `app/page.tsx` parece mais simples e tem dois defeitos
 * que só aparecem depois. O primeiro: o render acontece para TODO GET,
 * inclusive o do Googlebot, o do preview do WhatsApp e o do monitor de uptime
 * — e o painel passa a mostrar um movimento que nunca existiu, que é pior do
 * que não mostrar nada, porque leva a decidir sobre ruído. O segundo: uma
 * escrita no banco dentro do render põe a latência do Supabase na frente do
 * primeiro byte da página de vendas.
 *
 * O beacon do cliente resolve os dois: quem executa JavaScript e fica na
 * página é gente, e a escrita acontece DEPOIS de a página já estar na tela.
 *
 * ─── O que NÃO se guarda, e não é esquecimento ─────────────────────────────
 *
 * **IP.** É dado pessoal pela LGPD com retenção e direito de acesso atrelados,
 * e só responderia "de que cidade?" — que `city` já responde, resolvido pela
 * borda antes de o código rodar. **Bairro** não existe: o mais fino que a
 * borda entrega é o CEP, e a coluna se chama `postal_code` justamente para não
 * prometer precisão que o dado não tem.
 *
 * ─── A geolocalização vem do SERVIDOR, o resto vem do cliente ──────────────
 *
 * País, região, cidade e CEP são lidos dos cabeçalhos da requisição — o
 * cliente não tem como mentir sobre eles. Caminho, referrer e UTM vêm do corpo
 * porque só o navegador os conhece (o `referer` de um `fetch` é a própria
 * página, não a origem da visita), e por isso são tratados como texto de
 * estranho: cortados no tamanho e nunca interpolados em nada.
 */
import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { authRateLimited } from "@/lib/auth/rate-limit";
import { fail, ok } from "@/lib/api/wrappers";
import { instalacaoCobra } from "@/lib/billing/planos";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  COOKIE_DO_VISITANTE,
  VALIDADE_DO_VISITANTE_SEG,
  hostDaOrigem,
  utmDaUrl,
} from "@/lib/mercado/visitante";

export const dynamic = "force-dynamic";

const schema = z.object({
  /** O caminho VISITADO, não o desta rota. */
  path: z.string().trim().min(1).max(300),
  /** A URL inteira, só para extrair os `utm_*`. Ignorada se malformada. */
  url: z.string().trim().max(2000).optional().default(""),
  referrer: z.string().trim().max(2000).optional().default(""),
  idioma: z.string().trim().max(10).optional().default(""),
  moeda: z.string().trim().max(10).optional().default(""),
  dispositivo: z.enum(["celular", "tablet", "computador"]).optional(),
});

/**
 * 60 registros por IP a cada 10 minutos.
 *
 * Alto de propósito: o limite aqui não é contra abuso de recurso caro (a
 * escrita é uma linha), é contra alguém inflar o painel. Um teto baixo
 * apagaria a navegação real de quem lê cinco páginas seguidas — e o painel
 * existe justamente para enxergar essa pessoa.
 */
const LIMITE = { ip: 60, windowSec: 600 } as const;

const GEO = {
  country: ["x-vercel-ip-country", "cf-ipcountry"],
  region: ["x-vercel-ip-country-region", "x-vercel-ip-region"],
  city: ["x-vercel-ip-city"],
  postal_code: ["x-vercel-ip-postal-code"],
  latitude: ["x-vercel-ip-latitude"],
  longitude: ["x-vercel-ip-longitude"],
} as const;

function cabecalho(h: Headers, nomes: readonly string[]): string | null {
  for (const nome of nomes) {
    const valor = h.get(nome)?.trim();
    if (valor) {
      try {
        return decodeURIComponent(valor).slice(0, 120);
      } catch {
        // Cabeçalho com `%` solto: o valor cru ainda serve e é melhor que null.
        return valor.slice(0, 120);
      }
    }
  }
  return null;
}

export async function POST(req: NextRequest): Promise<Response> {
  const requestId = randomUUID();

  // Mesmo interruptor da página de vendas: um clone self-host não tem funil
  // para medir, e uma rota que escreve no banco de quem não pediu é passivo.
  if (!instalacaoCobra()) {
    return fail("not_found", "Não existe nesta instalação.", 404, { requestId });
  }

  let corpo: unknown;
  try {
    corpo = await req.json();
  } catch {
    return fail("validation_failed", "Corpo inválido.", 422, { requestId });
  }

  const parsed = schema.safeParse(corpo);
  if (!parsed.success) {
    return fail("validation_failed", "Corpo inválido.", 422, { requestId });
  }
  const dados = parsed.data;

  if (await authRateLimited("site_visita", null, LIMITE)) {
    // 204 e não 429: o beacon não tem tela para mostrar erro, e um 429 no
    // console de quem só estava navegando parece defeito do site.
    return new Response(null, { status: 204 });
  }

  const visitorId = req.cookies.get(COOKIE_DO_VISITANTE)?.value?.trim() || randomUUID();
  const utm = utmDaUrl(urlSegura(dados.url));
  const referrer = dados.referrer.slice(0, 2000) || null;

  try {
    const admin = createAdminClient();
    await admin.from("site_visits").insert({
      visitor_id: visitorId,
      path: dados.path.slice(0, 300),
      referrer,
      referrer_host: hostDaOrigem(referrer),
      ...utm,
      country: cabecalho(req.headers, GEO.country),
      region: cabecalho(req.headers, GEO.region),
      city: cabecalho(req.headers, GEO.city),
      postal_code: cabecalho(req.headers, GEO.postal_code),
      latitude: cabecalho(req.headers, GEO.latitude),
      longitude: cabecalho(req.headers, GEO.longitude),
      device: dados.dispositivo ?? null,
      idioma: dados.idioma || null,
      moeda: dados.moeda || null,
    });
  } catch {
    // Sem service role, ou clone sem a migration 0240. O visitante não tem
    // nada a ver com isso e a página dele não pode piscar por causa disto.
  }

  const resposta = ok({ registrado: true }, { requestId });
  resposta.headers.append(
    "set-cookie",
    [
      `${COOKIE_DO_VISITANTE}=${visitorId}`,
      "Path=/",
      `Max-Age=${VALIDADE_DO_VISITANTE_SEG}`,
      "SameSite=Lax",
      "HttpOnly",
      ...(req.nextUrl.protocol === "https:" ? ["Secure"] : []),
    ].join("; "),
  );
  return resposta;
}

/**
 * A URL que o cliente mandou, ou uma inócua.
 *
 * `utmDaUrl` precisa de uma `URL` de verdade. O cliente manda texto, e texto de
 * estranho pode ser qualquer coisa — inclusive vazio. Devolver uma URL sem
 * parâmetro nenhum faz os cinco `utm_*` saírem `null`, que é a resposta certa
 * para "não deu para saber".
 */
function urlSegura(bruta: string): URL {
  try {
    return new URL(bruta);
  } catch {
    return new URL("https://localhost/");
  }
}
