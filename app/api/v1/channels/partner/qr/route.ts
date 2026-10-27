import { requireSupportWrite } from "@/lib/impersonate/support";
/**
 * GET  /api/v1/channels/partner/qr — a instalação oferece conexão por QR? E já
 *      há número conectado por ela nesta organização?
 * POST /api/v1/channels/partner/qr — devolve o link da janela de conexão.
 *
 * É a porta do "Conectar meu WhatsApp": o cliente não tem conta no provedor,
 * quem tem é a instalação. Ele escaneia um QR com o app WhatsApp Business e
 * volta por `./retorno`. Quem é o provedor e como se fala com ele moram em
 * `lib/channels/conexao-por-qr` — esta rota não sabe (`lint:channels`).
 */
import { randomUUID } from "node:crypto";
import type { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { fail, ok } from "@/lib/api/wrappers";
import { audit } from "@/lib/audit";
import { requireRole } from "@/lib/auth/require-role";
import { cabeMaisUm, frasePrimeiraPessoa } from "@/lib/billing/tetos";
import { marcaDaSaida } from "@/lib/branding/saida";
import {
  conexaoPorQrDisponivel,
  ErroDaConexaoPorQr,
  iniciarConexaoPorQr,
} from "@/lib/channels/conexao-por-qr";
import { findPartnerSession } from "@/lib/channels/connect";
import { env } from "@/lib/env";
import { traduzir } from "@/lib/i18n/dicionario";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const iniciarSchema = z.object({
  origem: z.enum(["onboarding", "conexoes"]).default("conexoes"),
});

/**
 * Endereço público desta instalação — para onde o provedor devolve o navegador
 * e entrega os eventos. Mesmo critério de `../route.ts`: `env.*` em runtime, e o
 * host da requisição só quando a variável não presta.
 */
function enderecoPublico(req: NextRequest): string {
  const configurada = env.NEXT_PUBLIC_APP_URL;
  const usavel =
    configurada && !configurada.includes("placeholder.invalid") && !configurada.includes("localhost")
      ? configurada
      : null;
  return (usavel ?? req.headers.get("origin") ?? `${req.nextUrl.protocol}//${req.nextUrl.host}`).replace(
    /\/+$/,
    "",
  );
}

export async function GET(): Promise<NextResponse> {
  const requestId = randomUUID();
  const authz = await requireRole("admin", { requestId, resource: "channels_partner" });
  if (!authz.ok) return authz.response;

  const disponivel = conexaoPorQrDisponivel(env.INTERNAL_SECRET);
  const sessao = disponivel ? await findPartnerSession(createAdminClient(), authz.org.orgId) : null;
  const conectado = !!sessao && !sessao.archivedAt;

  return ok(
    {
      disponivel,
      conectado,
      phone_number: conectado ? sessao.phoneNumber : null,
      display_name: conectado ? sessao.displayName : null,
      status: conectado ? sessao.status : null,
    },
    { requestId },
  );
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const supportDenied = await requireSupportWrite();
  if (supportDenied) return supportDenied;

  const requestId = randomUUID();
  // Conectar um canal move dinheiro e expõe a conta da empresa: decisão de
  // dono, não de quem atende — o mesmo papel das outras conexões.
  const authz = await requireRole("admin", { requestId, resource: "channels_partner" });
  if (!authz.ok) return authz.response;
  const t = (texto: string) => traduzir(texto, authz.user.idioma);
  const orgId = authz.org.orgId;

  if (!conexaoPorQrDisponivel(env.INTERNAL_SECRET)) {
    return fail("not_found", t("A conexão por QR não está disponível nesta instalação."), 404, { requestId });
  }

  const parsed = iniciarSchema.safeParse((await req.json().catch(() => ({}))) ?? {});
  if (!parsed.success) {
    return fail("invalid_request", t("Origem inválida."), 422, { requestId });
  }

  const admin = createAdminClient();

  // O teto só pesa quando a conexão ACRESCENTA um canal: trocar o número que a
  // organização já tem não aumenta a conta (lib/billing/tetos.ts).
  const existente = await findPartnerSession(admin, orgId);
  if (!existente || existente.archivedAt) {
    const cabe = await cabeMaisUm(admin, orgId, "canais");
    if (!cabe.permitido) {
      return fail("teto_do_plano", t(frasePrimeiraPessoa("canais", cabe)), 402, { requestId });
    }
  }

  const { data: org } = await admin
    .from("organizations")
    .select("display_name, legal_name")
    .eq("id", orgId)
    .maybeSingle();
  // A janela mostra a marca da INSTALAÇÃO (quem o cliente contratou), não a da
  // organização dele.
  const marca = await marcaDaSaida(null);

  try {
    const authUrl = await iniciarConexaoPorQr({
      organizationId: orgId,
      userId: authz.user.id,
      nomeDaOrganizacao: (org?.display_name as string) || (org?.legal_name as string) || "",
      baseUrl: enderecoPublico(req),
      origem: parsed.data.origem,
      idioma: authz.user.idioma === "es" ? "es" : "pt-BR",
      marca: marca.nome,
      corPrimaria: marca.accent,
      segredoDoServidor: env.INTERNAL_SECRET,
      agora: new Date(),
    });

    void audit({
      action: "channel.qr_connect_started",
      actorUserId: authz.user.id,
      organizationId: orgId,
      resourceType: "channel_session",
      requestId,
      metadata: { origem: parsed.data.origem },
    });

    return ok({ auth_url: authUrl }, { requestId });
  } catch (err) {
    const motivo = err instanceof ErroDaConexaoPorQr ? err.motivo : "provedor";
    void audit({
      action: "channel.qr_connect_failed",
      actorUserId: authz.user.id,
      organizationId: orgId,
      resourceType: "channel_session",
      requestId,
      metadata: { etapa: "inicio", motivo, detalhe: err instanceof Error ? err.message : null },
    });
    return fail(
      "upstream_unavailable",
      t("Não consegui abrir a conexão agora. Tente de novo em alguns minutos."),
      502,
      { requestId },
    );
  }
}
