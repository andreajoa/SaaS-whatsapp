/**
 * POST /api/v1/webhooks/channel/plataforma — entrada ÚNICA das conexões por QR.
 *
 * Os números conectados por QR moram na conta da INSTALAÇÃO no provedor, e
 * ela tem um teto de webhooks (50) que um endereço por organização estouraria
 * no 51º cliente. Então todos os eventos chegam aqui, assinados com o segredo
 * da instalação, e o PERFIL do evento (organização) mais a CONTA dizem de qual
 * sessão ele é. Daí em diante o
 * trabalho é exatamente o da rota de token (`../[token]/route.ts`), pela mesma
 * função.
 *
 * Ordem que não pode inverter: assinatura ANTES de qualquer consulta. A rota é
 * pública (`lib/auth/public-paths.ts` libera `/api/v1/webhooks/`), e um corpo
 * anônimo não pode nem fazer o banco trabalhar.
 *
 * Evento sem conta (números provisionados pelo provedor, teste do painel) e
 * conta sem sessão (o evento de "conectado" chega antes da volta do QR gravar)
 * respondem 200: são eventos que nunca vão servir, e qualquer outro código faria
 * o provedor reentregá-los para sempre.
 */
import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";

import { fail, ok } from "@/lib/api/wrappers";
import { lerEventoDaPlataforma, sessaoDaContaDaPlataforma } from "@/lib/channels/conexao-por-qr";
import { processarEntradaDaSessao } from "@/lib/channels/entrada-da-sessao";
import { env } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: NextRequest): Promise<Response> {
  const requestId = randomUUID();
  const rawBody = await req.text();

  const leitura = lerEventoDaPlataforma(rawBody, req.headers, env.INTERNAL_SECRET);
  if (!leitura.ok) {
    if (leitura.motivo === "indisponivel") {
      return fail("not_found", "not found", 404, { requestId });
    }
    if (leitura.motivo === "assinatura") {
      return fail("unauthorized", "bad_signature", 401, { requestId });
    }
    return fail("invalid_request", "invalid_json", 400, { requestId });
  }

  if (!leitura.accountId || !leitura.organizationId) {
    return ok({ status: "ignored", reason: "evento_sem_conta" }, { requestId });
  }

  const admin = createAdminClient();
  const { sessao, ambigua } = await sessaoDaContaDaPlataforma(
    admin,
    leitura.organizationId,
    leitura.accountId,
  );
  if (ambigua) {
    // Duas sessões ativas para a mesma conta: entregar a uma delas por sorte
    // seria escolher às cegas onde a conversa cai. 200 para não virar
    // reentrega infinita; o motivo fica no corpo para quem for investigar.
    return ok({ status: "ignored", reason: "conta_em_mais_de_uma_sessao" }, { requestId });
  }
  if (!sessao) {
    return ok({ status: "ignored", reason: "conta_sem_sessao" }, { requestId });
  }

  return processarEntradaDaSessao(admin, sessao, { rawBody, headers: req.headers, requestId });
}
