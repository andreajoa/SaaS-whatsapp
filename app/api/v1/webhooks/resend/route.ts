import type { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";

import { fail, ok } from "@/lib/api/wrappers";
import { logger } from "@/lib/logger";
import {
  aplicarEvento,
  assinaturaResendValida,
  type LinhaDeEnvio,
} from "@/lib/marketing/eventos-resend";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Entrega, abertura, clique, bounce e reclamação dos e-mails do funil.
 *
 * Sem `RESEND_WEBHOOK_SECRET` responde 404: endpoint sem segredo aceitaria
 * evento forjado marcando qualquer contato como bounce. E-mail que não é do
 * funil (transacional do produto, outra marca na mesma conta) não tem linha em
 * `email_envios` e recebe 200 sem efeito — o Resend não precisa reentregar.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  const requestId = randomUUID();
  const segredo = (process.env.RESEND_WEBHOOK_SECRET ?? "").trim();
  if (!segredo) return fail("not_found", "not_found", 404, { requestId });

  const corpo = await req.text();
  const valida = assinaturaResendValida(
    corpo,
    {
      id: req.headers.get("svix-id"),
      timestamp: req.headers.get("svix-timestamp"),
      assinatura: req.headers.get("svix-signature"),
    },
    segredo,
  );
  if (!valida) return fail("unauthorized", "assinatura inválida", 401, { requestId });

  let evento: { type?: string; created_at?: string; data?: Record<string, unknown> };
  try {
    evento = JSON.parse(corpo);
  } catch {
    return fail("bad_request", "corpo inválido", 400, { requestId });
  }
  const tipo = String(evento.type ?? "");
  const dados = (evento.data ?? {}) as {
    email_id?: string;
    created_at?: string;
    bounce?: { type?: string; message?: string };
  };
  if (!dados.email_id) return ok({ recebido: true, ignorado: tipo }, { requestId });

  const admin = createAdminClient();
  const { data: linha, error } = await admin
    .from("email_envios")
    .select("id,status,entregue_em,aberto_em,clicado_em,aberturas,cliques,erro")
    .eq("provider_id", dados.email_id)
    .maybeSingle();
  if (error) {
    logger.error("[resend.webhook] leitura falhou", { requestId, error: error.message });
    return fail("internal_error", "leitura falhou", 500, { requestId });
  }
  if (!linha) return ok({ recebido: true, fora_do_funil: true }, { requestId });

  const mudanca = aplicarEvento(linha as LinhaDeEnvio, tipo, {
    created_at: dados.created_at ?? evento.created_at,
    bounce: dados.bounce,
  });
  if (!mudanca) return ok({ recebido: true, ignorado: tipo }, { requestId });

  const { error: erroDeGravacao } = await admin
    .from("email_envios")
    .update({ ...mudanca, updated_at: new Date().toISOString() })
    .eq("id", (linha as { id: string }).id);
  if (erroDeGravacao) {
    logger.error("[resend.webhook] gravação falhou", { requestId, error: erroDeGravacao.message });
    return fail("internal_error", "gravação falhou", 500, { requestId });
  }
  return ok({ recebido: true, aplicado: tipo }, { requestId });
}
