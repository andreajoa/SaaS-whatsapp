/**
 * O que acontece com um webhook DEPOIS de saber de qual sessão ele é.
 *
 * Duas rotas chegam aqui por caminhos diferentes — a de token
 * (`/api/v1/webhooks/channel/[token]`, o token da URL diz a sessão) e a da
 * instalação (`/api/v1/webhooks/channel/plataforma`, a conta do evento diz a
 * sessão). Daqui em diante o trabalho é o mesmo, e era a rota de token que o
 * fazia inline. Duas cópias divergiriam no primeiro conserto — e a que ficasse
 * para trás seria a que perde mensagem de cliente.
 *
 * O desenho é o que estava na rota de token, sem mudança de comportamento:
 * corpo cru arquivado ANTES de processar, 200 para evento sem interesse (o
 * provedor reentrega o que não recebe 200), 401 só para assinatura, 500 só
 * para falha de ESCRITA (aí a reentrega é o que queremos).
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import { fail, ok } from "@/lib/api/wrappers";
import { decryptWebhookSecret } from "@/lib/webhooks/secrets";

import { abrirArquivoDoWebhook, fecharArquivoDoWebhook } from "./arquivo-de-webhook";
import { acceptsInboundWebhook, handleInboundWebhook } from "./inbound";

export interface SessaoDeEntrada {
  id: string;
  organization_id: string;
  provider: string;
  display_name: string | null;
  phone_number: string | null;
  webhook_secret_encrypted: unknown;
  archived_at?: string | null;
}

export async function processarEntradaDaSessao(
  admin: SupabaseClient,
  sessao: SessaoDeEntrada,
  entrada: { rawBody: string; headers: Headers; requestId: string },
): Promise<Response> {
  const { rawBody, headers, requestId } = entrada;

  // Canal arquivado não ingere: o usuário mandou excluí-lo, e aceitar evento em
  // voo ressuscitaria a conversa no inbox com o operador sem poder responder.
  if (sessao.archived_at) {
    return ok({ status: "ignored", reason: "canal_arquivado" }, { requestId });
  }

  if (!acceptsInboundWebhook(sessao.provider)) {
    return fail("invalid_request", "provider_mismatch", 400, { requestId });
  }

  const cifrado = sessao.webhook_secret_encrypted;
  const secret = cifrado ? await decryptWebhookSecret(admin, cifrado as string) : null;

  // ─── O corpo cru vai para o arquivo ANTES de qualquer processamento ────────
  //
  // Se o processo morrer no meio — exceção, OOM, deploy no instante errado — o
  // payload continua gravado, que é justamente quando alguém vai querer lê-lo.
  const arquivo = await abrirArquivoDoWebhook(admin, {
    organizationId: sessao.organization_id,
    channelSessionId: sessao.id,
    provider: sessao.provider,
    rawBody,
    headers,
  });

  try {
    const r = await handleInboundWebhook(admin, {
      session: sessao,
      rawBody,
      headers,
      secret,
    });

    if (r.ok) {
      await fecharArquivoDoWebhook(admin, arquivo, {
        status: "processed",
        validSignature: true,
        // O desfecho do seam vai junto: é ele que distingue "ingerido" de
        // "ignorado por falta de identidade" quando alguém for contar depois.
        erro: typeof r.body.reason === "string" ? r.body.reason : null,
      });
      return ok(r.body, { requestId });
    }

    const status = r.code === "unauthorized" ? 401 : 400;
    await fecharArquivoDoWebhook(admin, arquivo, {
      status: "error",
      // `false` SÓ quando a recusa foi por assinatura. Um payload bem assinado
      // que o parser recusou não é problema de segredo, e marcá-lo como se
      // fosse mandaria quem investiga procurar no lugar errado.
      validSignature: r.code === "unauthorized" ? false : null,
      erro: r.message,
    });
    return fail(
      r.code === "unauthorized" ? "unauthorized" : "invalid_request",
      r.message,
      status,
      { requestId },
    );
  } catch (err) {
    const detalhe = err instanceof Error ? err.message : "ingest_failed";
    await fecharArquivoDoWebhook(admin, arquivo, {
      status: "error",
      validSignature: null,
      erro: detalhe,
    });
    return fail("internal_error", detalhe, 500, { requestId });
  }
}
