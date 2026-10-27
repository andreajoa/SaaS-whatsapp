import { supportCallbackWriteAllowed } from "@/lib/impersonate/support";
/**
 * GET /api/v1/channels/partner/qr/retorno — a volta da janela de conexão por QR.
 *
 * ─── Por que esta rota é pública ────────────────────────────────────────────
 *
 * O provedor devolve o NAVEGADOR para cá, numa navegação vinda de outro site, e
 * o cookie de sessão é `sameSite: "strict"`: ele não viaja nela. É o mesmo caso
 * da volta do Google Agenda (`app/api/v1/agenda/google/callback`), medido em
 * produção: com a rota atrás do proxy, a volta dava 401 e a conexão nunca
 * completava. Por isso ela está em `lib/auth/public-paths.ts`, ancorada com `$`,
 * e a identidade vem de outro lugar:
 *
 *   1. o `estado` assinado com `INTERNAL_SECRET` diz a organização e quem
 *      iniciou (`lib/channels/conexao-por-qr-estado.ts`);
 *   2. o PROVEDOR confirma que a conta está no perfil daquela organização
 *      (`concluirConexaoPorQr`). Um `accountId` da barra de endereços nunca é
 *      gravado sem essa confirmação.
 *
 * ─── Por que a resposta é uma página e não um redirect ──────────────────────
 *
 * Um 302 daqui para `/app/...` continuaria sendo a mesma navegação cross-site,
 * e o cookie strict continuaria sem viajar: a pessoa cairia no login com a
 * conexão já feita. A página faz `location.replace`, que é uma navegação NOSSA
 * — aí o cookie vai junto. Mesma ponte da volta do Google.
 */
import { randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";

import { publicarAgenteQueEsperavaCanal } from "@/app/actions/onboarding/_agente-que-esperava-canal";
import { patchOnboardingState } from "@/app/actions/onboarding/_shared";
import { audit } from "@/lib/audit";
import { concluirConexaoPorQr, ErroDaConexaoPorQr } from "@/lib/channels/conexao-por-qr";
import {
  lerOrigemQr,
  verificarEstadoQr,
  type OrigemDaConexaoPorQr,
} from "@/lib/channels/conexao-por-qr-estado";
import { env } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** O que a tela sabe explicar. Qualquer outra coisa vira `falhou`. */
type Motivo =
  | "cancelado"
  | "numero_em_uso"
  | "expirado"
  | "indisponivel"
  | "retorno_invalido"
  | "falhou";

/** Os erros que o provedor devolve na volta, traduzidos para o que a tela sabe dizer. */
function motivoDoProvedor(erro: string): Motivo {
  switch (erro) {
    case "connection_cancelled":
      return "cancelado";
    case "whatsapp_number_already_connected":
    case "whatsapp_number_pinned_to_profile":
    case "one_whatsapp_per_profile":
      return "numero_em_uso";
    case "session_expired":
      return "expirado";
    case "payment_required":
      return "indisponivel";
    default:
      return "falhou";
  }
}

function destino(origem: OrigemDaConexaoPorQr, resultado: { ok: true } | { ok: false; motivo: Motivo }): string {
  if (origem === "onboarding") {
    // Deu certo: `/onboarding` decide o próximo passo sozinho, e o do WhatsApp
    // já está marcado. Deu errado: de volta à tela do QR, com o motivo.
    return resultado.ok ? "/onboarding" : `/onboarding/connect-whatsapp?qr=erro&motivo=${resultado.motivo}`;
  }
  return resultado.ok
    ? "/app/connections?qr=ok"
    : `/app/connections?qr=erro&motivo=${resultado.motivo}`;
}

function voltar(origem: OrigemDaConexaoPorQr, resultado: { ok: true } | { ok: false; motivo: Motivo }): NextResponse {
  const base = env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const url = new URL(destino(origem, resultado), base).toString();
  // Escapado mesmo sendo montado de literais nossos: a ponte é genérica, e o
  // dia em que alguém passar algo de fora por aqui não deve ser o dia em que
  // isto vira injeção.
  const seguro = url
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
  return new NextResponse(
    `<!doctype html><html lang="pt-br"><head><meta charset="utf-8">` +
      `<meta name="robots" content="noindex">` +
      `<meta name="viewport" content="width=device-width, initial-scale=1">` +
      `<noscript><meta http-equiv="refresh" content="0;url=${seguro}"></noscript>` +
      `<title>Voltando…</title></head><body style="font-family:system-ui,sans-serif;padding:24px">` +
      `<p>${resultado.ok ? "WhatsApp conectado. Voltando…" : "Voltando…"}</p>` +
      `<script>location.replace(${JSON.stringify(url)})</script>` +
      `<noscript><p><a href="${seguro}">Continuar</a></p></noscript>` +
      `</body></html>`,
    { status: 200, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } },
  );
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const requestId = randomUUID();
  const url = new URL(req.url);
  const p = url.searchParams;
  const origem = lerOrigemQr(p.get("d"));

  // 1. Quem está voltando? Sob `try`: `verificarEstadoQr` LANÇA com o segredo
  //    curto demais, e um throw aqui seria um 500 com stack arrancável por
  //    qualquer anônimo — a rota é pública.
  let estado: ReturnType<typeof verificarEstadoQr> = null;
  try {
    estado = verificarEstadoQr(
      { o: p.get("o"), u: p.get("u"), x: p.get("x"), s: p.get("s") },
      { segredo: env.INTERNAL_SECRET, agora: new Date() },
    );
  } catch {
    return voltar(origem, { ok: false, motivo: "retorno_invalido" });
  }
  // Um motivo só para assinatura, prazo e formato: distinguir na URL daria a
  // quem ataca a diferença que ele precisa para calibrar. Sem auditar: antes de
  // o estado valer, qualquer anônimo escreveria em tabela append-only em laço.
  if (!estado) return voltar(origem, { ok: false, motivo: "retorno_invalido" });
  const { organizationId, userId } = estado;

  // 2. A pessoa desistiu ou o provedor recusou: nada a gravar.
  const erro = p.get("error");
  if (erro) {
    const motivo = motivoDoProvedor(erro);
    await audit({
      action: "channel.qr_connect_failed",
      actorUserId: userId,
      organizationId,
      resourceType: "channel_session",
      requestId,
      metadata: { etapa: "volta", motivo, erro_do_provedor: erro.slice(0, 80) },
    });
    return voltar(origem, { ok: false, motivo });
  }

  const accountId = p.get("accountId")?.trim() ?? "";
  if (!accountId || accountId.length > 100) {
    return voltar(origem, { ok: false, motivo: "falhou" });
  }

  // Sessão de suporte (impersonação) não grava por aqui — mesma regra das
  // outras voltas de consentimento.
  if (!(await supportCallbackWriteAllowed(organizationId, userId))) {
    return voltar(origem, { ok: false, motivo: "falhou" });
  }

  const admin = createAdminClient();
  const { data: org } = await admin
    .from("organizations")
    .select("display_name, legal_name")
    .eq("id", organizationId)
    .maybeSingle();
  if (!org) return voltar(origem, { ok: false, motivo: "retorno_invalido" });

  // 3. O provedor confirma a conta, e a sessão é gravada.
  let conexao: Awaited<ReturnType<typeof concluirConexaoPorQr>>;
  try {
    conexao = await concluirConexaoPorQr(admin, {
      organizationId,
      nomeDaOrganizacao: (org.display_name as string) || (org.legal_name as string) || "",
      accountId,
      profileIdDaVolta: p.get("profileId"),
      segredoDoServidor: env.INTERNAL_SECRET,
      nomePadrao: "WhatsApp",
    });
  } catch (err) {
    const motivo = err instanceof ErroDaConexaoPorQr ? err.motivo : "provedor";
    await audit({
      action: "channel.qr_connect_failed",
      actorUserId: userId,
      organizationId,
      resourceType: "channel_session",
      requestId,
      metadata: { etapa: "gravacao", motivo, detalhe: err instanceof Error ? err.message.slice(0, 200) : null },
    });
    return voltar(origem, { ok: false, motivo: motivo === "indisponivel" ? "indisponivel" : "falhou" });
  }

  await audit({
    action: "channel.qr_connected",
    actorUserId: userId,
    organizationId,
    resourceType: "channel_session",
    resourceId: conexao.channelSessionId,
    requestId,
    metadata: { phone_number: conexao.telefone, nova: conexao.nova, origem },
  });

  // 4. O passo do onboarding fica cumprido — vindo de lá ou não: quem conectou
  //    por Conexões antes de terminar o assistente também não deve ver o passo
  //    do WhatsApp de novo.
  try {
    await patchOnboardingState(organizationId, {
      whatsapp: { session_id: conexao.channelSessionId, status: "WORKING" },
    });
  } catch {
    // O número está conectado; o assistente só mostraria o passo de novo, e a
    // tela do QR já diz que há número.
  }

  // 5. O agente que nasceu sem canal vai ao ar agora. Nunca lança.
  await publicarAgenteQueEsperavaCanal(admin, organizationId, userId);

  return voltar(origem, { ok: true });
}
