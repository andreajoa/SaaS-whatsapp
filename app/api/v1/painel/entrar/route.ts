/**
 * POST /api/v1/painel/entrar — a única rota que emite o cookie do painel.
 *
 * ─── Ela é a peça de maior risco do funil, e por isso está sozinha ─────────
 *
 * Se esta rota falhar aberta, `/dashboard` publica o e-mail, a cidade e o
 * plano de todo lead. Ela não renderiza nada, não consulta o banco e não tem
 * segundo caminho de saída: ou a senha confere e sai o cookie, ou sai 401.
 *
 * ─── O limite é por IP e é apertado ────────────────────────────────────────
 *
 * Dez tentativas a cada dez minutos. A senha tem piso de 24 caracteres
 * (`painelHabilitado()`), então força bruta já é inviável pela entropia — o
 * limite existe contra a outra coisa: uma lista de senhas vazadas jogada
 * contra o endpoint gasta banda e log até parar. Quem passa do teto recebe o
 * MESMO 401 de quem errou a senha, sem `Retry-After`: dizer quanto falta
 * transforma o limite num relógio a esperar.
 */
import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { authRateLimited } from "@/lib/auth/rate-limit";
import { fail, ok } from "@/lib/api/wrappers";
import { cookieSecure } from "@/lib/supabase/cookie-secure";
import {
  COOKIE_DO_PAINEL,
  emitirCookie,
  painelHabilitado,
  senhaConfere,
} from "@/lib/painel/sessao";

export const dynamic = "force-dynamic";

const schema = z.object({ senha: z.string().min(1).max(200) });

const LIMITE = { ip: 10, windowSec: 600 } as const;

export async function POST(req: NextRequest): Promise<Response> {
  const requestId = randomUUID();

  // Sem painel não há rota — o mesmo 404 da tela, para que a existência do
  // painel não seja detectável pela diferença entre 404 e 401.
  if (!painelHabilitado()) {
    return fail("not_found", "Não existe nesta instalação.", 404, { requestId });
  }

  if (await authRateLimited("painel_entrar", null, LIMITE)) {
    return fail("unauthenticated", "Senha incorreta.", 401, { requestId });
  }

  let corpo: unknown;
  try {
    corpo = await req.json();
  } catch {
    return fail("unauthenticated", "Senha incorreta.", 401, { requestId });
  }

  const parsed = schema.safeParse(corpo);
  if (!parsed.success || !senhaConfere(parsed.data.senha)) {
    return fail("unauthenticated", "Senha incorreta.", 401, { requestId });
  }

  const { valor, maxAge } = emitirCookie();
  const resposta = ok({ entrou: true }, { requestId });
  resposta.headers.append(
    "set-cookie",
    [
      `${COOKIE_DO_PAINEL}=${valor}`,
      "Path=/",
      `Max-Age=${maxAge}`,
      // `Strict` e não `Lax`: nada legítimo navega para o painel a partir de
      // outro site, e `Strict` fecha CSRF sem precisar de token.
      "SameSite=Strict",
      "HttpOnly",
      ...(cookieSecure() ? ["Secure"] : []),
    ].join("; "),
  );
  return resposta;
}
