/**
 * POST /api/v1/webhooks/channel/[token] — entrada por token, para qualquer canal.
 *
 * ─── Por que o caminho NÃO cita o canal ─────────────────────────────────────
 *
 * A família de rotas do canal por QR carrega o nome do provider na URL, e está
 * na lista de dívida do `lint:channels` por isso — sair de lá exigiria mudar
 * uma URL que já está configurada em instalação de gente. Uma rota NOVA não
 * precisa nascer devendo: o token identifica a sessão, a sessão diz qual é o
 * canal, e o caminho fica neutro. Canal seguinte entra sem uma quarta família
 * de URLs.
 *
 * ─── Por que esta rota é tão curta ──────────────────────────────────────────
 *
 * Ela não sabe de quem é o payload. Resolve o token, decifra o segredo e
 * entrega tudo a `handleInboundWebhook` — a verificação de assinatura e a
 * leitura moram lá porque o esquema é do CANAL (header, algoritmo e formato
 * mudam por provider). A primeira versão desta rota fazia isso aqui e o
 * `lint:channels` reprovou, que é a catraca funcionando: uma rota que verifica
 * assinatura precisa perguntar qual provider é.
 *
 * ─── O 200 que evita a tempestade ──────────────────────────────────────────
 *
 * Evento que não interessa (outro tipo, eco do nosso próprio envio, outra
 * plataforma) responde 200, não 4xx: o provider reentrega o que não recebeu
 * 200, e recusar um payload que nunca vai servir faria a reentrega durar para
 * sempre. 500 fica reservado para falha de ESCRITA — aí a reentrega é o que
 * queremos, porque o evento era bom e nós é que não gravamos.
 */
import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";

import { fail } from "@/lib/api/wrappers";
import { ARCHIVED_AT, queryTolerantToMissingArchived } from "@/lib/channels/archived";
import { processarEntradaDaSessao } from "@/lib/channels/entrada-da-sessao";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ token: string }> },
): Promise<Response> {
  const requestId = randomUUID();
  const { token } = await ctx.params;

  // Token curto nunca foi emitido por nós. 404 e não 401: quem varre URLs não
  // precisa saber que a rota existe.
  if (!token || token.length < 8) {
    return fail("not_found", "unknown webhook token", 404, { requestId });
  }

  const rawBody = await req.text();
  const admin = createAdminClient();

  const { data } = await queryTolerantToMissingArchived(
    () =>
      admin
        .from("channel_sessions")
        .select(`id, organization_id, provider, display_name, phone_number, webhook_secret_encrypted, ${ARCHIVED_AT}`)
        .eq("webhook_path_token", token)
        .maybeSingle(),
    () =>
      admin
        .from("channel_sessions")
        .select("id, organization_id, provider, display_name, phone_number, webhook_secret_encrypted")
        .eq("webhook_path_token", token)
        .maybeSingle(),
  );

  const sessao = data as {
    id: string;
    organization_id: string;
    provider: string;
    display_name: string | null;
    phone_number: string | null;
    webhook_secret_encrypted: unknown;
    archived_at?: string | null;
  } | null;

  if (!sessao) return fail("not_found", "unknown webhook token", 404, { requestId });

  return processarEntradaDaSessao(admin, sessao, { rawBody, headers: req.headers, requestId });
}
