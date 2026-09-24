/**
 * POST /api/v1/site/pulso — quanto tempo a pessoa ficou, e onde ela clicou.
 *
 * ─── Por que uma rota SEPARADA da visita ───────────────────────────────────
 *
 * A visita é escrita quando a página aparece; isto é escrito quando ela
 * DESAPARECE. São dois momentos, e só o segundo sabe a duração — juntar os
 * dois numa rota significaria segurar a linha da visita até a saída, e quem
 * fecha a aba na força bruta nunca chegaria a ser contado. Escrever cedo e
 * complementar depois conta todo mundo, e quem sai sem avisar fica com a
 * duração nula, que é o estado honesto disso.
 *
 * ─── O que chega aqui, e o que NÃO chega ───────────────────────────────────
 *
 * Chega: o id da visita, os segundos e uma lista de RÓTULOS de elementos
 * clicados. Não chega — nem por acidente — coordenada de clique, texto de
 * elemento, conteúdo de campo, IP ou e-mail.
 *
 * O rótulo é validado contra um vocabulário FECHADO (`ALVOS`). Isso não é
 * zelo: uma rota que aceitasse rótulo livre viraria, no primeiro dia em que
 * alguém instrumentasse um campo, o lugar onde o que a pessoa digitou é
 * gravado. Um enum não tem como escorregar para isso, e o custo é uma linha
 * nova aqui a cada elemento novo que se queira medir — que é exatamente a
 * revisão que se quer ter.
 *
 * ─── Por que `sendBeacon`, e o que isso obriga ─────────────────────────────
 *
 * O cliente envia com `navigator.sendBeacon`, a única API que o navegador
 * promete entregar depois de a aba fechar. Ela manda o corpo e IGNORA a
 * resposta — então esta rota devolve 204 em tudo, inclusive no erro: não há
 * ninguém para ler um 4xx, e um erro no console de quem só estava navegando
 * parece defeito do site.
 */
import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { authRateLimited } from "@/lib/auth/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import { COOKIE_DO_VISITANTE } from "@/lib/mercado/visitante";

export const dynamic = "force-dynamic";

/**
 * O VOCABULÁRIO FECHADO dos elementos que se pode medir.
 *
 * Cada entrada é um lugar da vitrine em que o clique responde a uma pergunta
 * de negócio. `cta-hero` e `cta-final` são o mesmo botão em posições
 * diferentes: saber QUAL deles converte diz se a página precisa ser mais curta.
 * `plano-*` diz qual plano atrai antes de qualquer assinatura existir.
 */
const ALVOS = [
  "cta-hero",
  "cta-final",
  "cta-menu",
  "plano-essencial",
  "plano-pro",
  "plano-ilimitado",
  "ver-planos",
  "como-funciona",
  "recursos",
  "perguntas",
  "contato",
  "login",
] as const;

const schema = z.object({
  /** O id devolvido por `POST /api/v1/site/visita`. */
  visita: z.string().uuid(),
  /**
   * Teto de 2 horas. Aba esquecida aberta a noite inteira produziria uma média
   * que não descreve leitor nenhum — e uma média envenenada é pior que um dado
   * ausente, porque parece confiável.
   */
  segundos: z.number().int().min(0).max(7200).optional(),
  path: z.string().max(300).optional(),
  cliques: z.array(z.enum(ALVOS)).max(40).optional(),
});

/** 30 pulsos por IP a cada 10 min: a pessoa navega, não bombardeia. */
const LIMITE = { ip: 30, windowSec: 600 } as const;

export async function POST(req: NextRequest): Promise<Response> {
  const requestId = randomUUID();
  void requestId;

  let corpo: unknown;
  try {
    corpo = await req.json();
  } catch {
    return new Response(null, { status: 204 });
  }

  const parsed = schema.safeParse(corpo);
  if (!parsed.success) return new Response(null, { status: 204 });
  const dados = parsed.data;

  if (await authRateLimited("site_pulso", null, LIMITE)) {
    return new Response(null, { status: 204 });
  }

  const visitorId = req.cookies.get(COOKIE_DO_VISITANTE)?.value?.trim();

  try {
    const admin = createAdminClient();

    if (typeof dados.segundos === "number") {
      // `update` e não `upsert`: se o id não existir (visita expurgada, ou
      // beacon de uma aba muito antiga), o certo é não fazer nada. Criar a
      // linha aqui inventaria uma visita sem origem, sem país e sem caminho.
      await admin
        .from("site_visits")
        .update({ segundos_na_pagina: dados.segundos })
        .eq("id", dados.visita);
    }

    const cliques = dados.cliques ?? [];
    if (cliques.length > 0 && visitorId) {
      // Um INSERT com todas as linhas, e não um por clique: o beacon manda o
      // lote acumulado da sessão, e N requisições ao banco por uma saída de
      // página é o tipo de custo que só aparece quando o tráfego chega.
      await admin.from("site_clicks").insert(
        cliques.map((alvo) => ({
          visitor_id: visitorId,
          session_id: dados.visita,
          path: (dados.path ?? "/").slice(0, 300),
          alvo,
        })),
      );
    }
  } catch {
    // Sem chave de serviço, ou clone sem a migration 0243. Quem estava
    // navegando não tem nada a ver com isso.
  }

  return new Response(null, { status: 204 });
}
