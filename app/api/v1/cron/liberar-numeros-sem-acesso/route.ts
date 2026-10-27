/**
 * GET/POST /api/v1/cron/liberar-numeros-sem-acesso — números conectados por QR
 * pela conta da instalação, de quem perdeu o acesso há mais de 14 dias.
 *
 * Cada número conectado pela conta da instalação é cobrado dela todo mês. Uma
 * organização que terminou o teste sem cartão, ou cuja assinatura venceu, não
 * usa o número — e não há ninguém do outro lado para lembrar de desconectá-lo.
 * Sem este vigia o custo cresce com cada desistência, calado.
 *
 * O que ele faz é pouco e reversível: tira o número da conta da instalação e
 * deixa o canal PARADO (não excluído). Ao pagar, o cliente lê o QR de novo e a
 * mesma sessão volta, com o histórico. A regra de quem conta como "sem acesso"
 * e a folga moram em `lib/channels/conexao-por-qr.ts`.
 *
 * Audita só quando liberou algum número — rodada vazia não é mutação
 * (`tests/unit/cron-audita-so-quando-ha-efeito.test.ts`).
 */
import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";

import { fail, ok } from "@/lib/api/wrappers";
import { audit } from "@/lib/audit";
import { estadoDaCobranca } from "@/lib/billing/assinatura";
import { liberarNumerosSemAcesso } from "@/lib/channels/conexao-por-qr";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

async function handle(req: NextRequest): Promise<Response> {
  const requestId = randomUUID();

  const auth = req.headers.get("authorization") ?? "";
  const provided = auth.startsWith("Bearer ") ? auth.slice("Bearer ".length).trim() : "";
  const aceitos = [env.INTERNAL_CRON_SECRET, env.INTERNAL_SECRET].filter(Boolean);
  if (aceitos.length === 0 || !provided || !aceitos.includes(provided)) {
    return fail("forbidden", "Cron secret missing or invalid.", 403, { requestId });
  }

  const admin = createAdminClient();
  const agora = new Date();

  let resultado: Awaited<ReturnType<typeof liberarNumerosSemAcesso>>;
  try {
    resultado = await liberarNumerosSemAcesso(admin, {
      agora,
      estadoDaOrganizacao: (organizationId, criadaEm) =>
        estadoDaCobranca(admin, organizationId, criadaEm, agora),
    });
  } catch (err) {
    const detalhe = err instanceof Error ? err.message : "falha";
    logger.error("[liberar-numeros-sem-acesso] rodada falhou", { detail: detalhe, requestId });
    return fail("internal_error", detalhe, 500, { requestId });
  }

  // Só audita quando houve efeito: rodada sem número liberado não é mutação.
  if (resultado.liberados.length > 0) {
    for (const l of resultado.liberados) {
      await audit({
        action: "channel.qr_number_released",
        organizationId: l.organizationId,
        resourceType: "channel_session",
        resourceId: l.channelSessionId,
        requestId,
        metadata: { motivo: "sem_acesso_ao_plano" },
      });
    }
  }

  return ok(
    { conferidos: resultado.conferidos, liberados: resultado.liberados.length },
    { requestId },
  );
}

export async function GET(req: NextRequest): Promise<Response> {
  return handle(req);
}

export async function POST(req: NextRequest): Promise<Response> {
  return handle(req);
}
