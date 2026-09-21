/**
 * POST /api/v1/site/lead — o e-mail que um ESTRANHO deixa no site.
 *
 * ─── A mesma natureza de `/api/v1/site/contato`, e o mesmo conjunto ────────
 *
 * Não há sessão nem organização: quem digita ainda não é cliente. O que
 * substitui a autenticação é o mesmo de lá — Zod com teto de tamanho, limite
 * por IP, campo-armadilha —, e o raciocínio de cada peça está escrito no
 * cabeçalho daquele arquivo.
 *
 * ─── A resposta é a MESMA para novo, conhecido e descadastrado ─────────────
 *
 * Um formulário aberto que diga "este e-mail já está na lista" é um oráculo de
 * enumeração: com ele qualquer pessoa descobre, um endereço por vez, quem se
 * inscreveu aqui. E dizer "você se descadastrou" contaria a um estranho uma
 * decisão que não é dele. Os três casos devolvem `{ inscrito: true }`.
 *
 * O que muda entre eles acontece no banco, e está em `lib/marketing/lead.ts`:
 * só o caso NOVO cria linha e, com ela, o cursor que faz a sequência de
 * e-mails começar. Quem se descadastrou continua fora — um formulário em que
 * qualquer um digita qualquer endereço não pode desfazer um ato legal.
 */
import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { authRateLimited } from "@/lib/auth/rate-limit";
import { fail, ok } from "@/lib/api/wrappers";
import { instalacaoCobra } from "@/lib/billing/planos";
import { registrarLead } from "@/lib/marketing/lead";
import { COOKIE_DO_VISITANTE } from "@/lib/mercado/visitante";

export const dynamic = "force-dynamic";

const schema = z.object({
  email: z.string().trim().email().max(200),
  nome: z.string().trim().max(120).optional().default(""),
  /** Só `popup` e `rodape` entram por aqui: as outras origens são de dentro. */
  origem: z.enum(["popup", "rodape"]).optional().default("rodape"),
  idioma: z.string().trim().max(10).optional().default(""),
  moeda: z.string().trim().max(10).optional().default(""),
  /** Campo-armadilha. Tem de chegar vazio. */
  empresa_site: z.string().max(200).optional().default(""),
});

/**
 * 5 inscrições por IP a cada 10 minutos.
 *
 * Bem mais apertado que o beacon de visita (60), e por outro motivo: cada
 * linha criada aqui vira DESTINATÁRIO de uma sequência de quinze e-mails. Um
 * roteiro que despeje mil endereços não custa banco, custa reputação de
 * domínio — e reputação queimada não volta com um deploy.
 */
const LIMITE = { ip: 5, windowSec: 600 } as const;

const GEO = {
  country: ["x-vercel-ip-country", "cf-ipcountry"],
  region: ["x-vercel-ip-country-region", "x-vercel-ip-region"],
  city: ["x-vercel-ip-city"],
} as const;

function cabecalho(h: Headers, nomes: readonly string[]): string | null {
  for (const nome of nomes) {
    const valor = h.get(nome)?.trim();
    if (valor) {
      try {
        return decodeURIComponent(valor).slice(0, 120);
      } catch {
        return valor.slice(0, 120);
      }
    }
  }
  return null;
}

export async function POST(req: NextRequest): Promise<Response> {
  const requestId = randomUUID();

  // Mesmo interruptor da página de vendas e do beacon: um clone self-host não
  // vende assinatura e não deve colher e-mail de ninguém.
  if (!instalacaoCobra()) {
    return fail("not_found", "Não existe nesta instalação.", 404, { requestId });
  }

  let corpo: unknown;
  try {
    corpo = await req.json();
  } catch {
    return fail("validation_failed", "Confira o e-mail digitado.", 422, { requestId });
  }

  const parsed = schema.safeParse(corpo);
  if (!parsed.success) {
    return fail("validation_failed", "Confira o e-mail digitado.", 422, { requestId });
  }
  const dados = parsed.data;

  // Robô. Responde como se tivesse dado certo e não escreve nada.
  if (dados.empresa_site.trim() !== "") return ok({ inscrito: true }, { requestId });

  if (await authRateLimited("site_lead", null, LIMITE)) {
    return fail("rate_limited", "Muitas tentativas. Tente de novo em alguns minutos.", 429, {
      requestId,
      headers: { "Retry-After": String(LIMITE.windowSec) },
    });
  }

  const resultado = await registrarLead({
    email: dados.email,
    nome: dados.nome,
    origem: dados.origem,
    visitorId: req.cookies.get(COOKIE_DO_VISITANTE)?.value ?? null,
    country: cabecalho(req.headers, GEO.country),
    region: cabecalho(req.headers, GEO.region),
    city: cabecalho(req.headers, GEO.city),
    idioma: dados.idioma || null,
    moeda: dados.moeda || null,
  });

  // `sem_banco` é a única que vira erro visível: significa que a inscrição NÃO
  // aconteceu, e dizer "pronto" a quem não foi inscrito é a pior das saídas —
  // a pessoa vai embora esperando um e-mail que nunca vem.
  if (resultado.tipo === "sem_banco") {
    return fail("service_unavailable", "Não foi possível inscrever agora.", 503, { requestId });
  }

  return ok({ inscrito: true }, { requestId });
}
