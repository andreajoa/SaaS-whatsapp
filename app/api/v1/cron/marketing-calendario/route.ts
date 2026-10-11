import { randomUUID, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import type { NextRequest } from "next/server";

import { fail, ok } from "@/lib/api/wrappers";
import { audit } from "@/lib/audit";
import { instalacaoCobra } from "@/lib/billing/planos";
import { marcaDaSaida } from "@/lib/branding/saida";
import { sendEmail } from "@/lib/email/resend";
import { env } from "@/lib/env";
import { lerAutomacoes } from "@/lib/marketing/automacoes";
import { chaveDaCampanha, estaNaJanela } from "@/lib/marketing/automacoes-catalogo";
import { reivindicarEnvio, registrarResultadoEnvio } from "@/lib/marketing/automacoes-envio";
import { retentarAvisosDeCobranca } from "@/lib/marketing/automacoes-retry";
import { montarEmail } from "@/lib/marketing/molde";
import { ehIdiomaDoSite, IDIOMA_DO_SITE_PADRAO } from "@/lib/mercado/paises";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
const TETO_POR_RODADA = 30;

async function handle(req: NextRequest): Promise<Response> {
  const requestId = randomUUID();
  const authorization = req.headers.get("authorization") ?? "";
  const provided = authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
  const autorizado = [env.INTERNAL_CRON_SECRET, env.INTERNAL_SECRET].some((secret) => {
    if (!secret || !provided) return false;
    const a = Buffer.from(secret),
      b = Buffer.from(provided);
    return a.length === b.length && timingSafeEqual(a, b);
  });
  if (!autorizado) return fail("forbidden", "Cron secret missing or invalid.", 403, { requestId });
  if (!instalacaoCobra() || !env.RESEND_API_KEY || !env.RESEND_FROM_EMAIL.trim())
    return ok({ enviados: 0, motivo: "envio_desligado" }, { requestId });
  const config = await lerAutomacoes();
  if (config.semBanco)
    return fail("service_unavailable", "Não foi possível ler as automações.", 503, { requestId });
  const agora = new Date();
  const campanhas = config.automacoes
    .filter((a) => a.audience !== "transacional" && estaNaJanela(a, agora))
    .sort((a, b) => a.starts_at!.localeCompare(b.starts_at!));
  const retry = await retentarAvisosDeCobranca(agora, TETO_POR_RODADA);
  if (!campanhas.length || retry.tentados >= TETO_POR_RODADA) {
    if (retry.tentados > 0)
      void audit({
        action: "marketing.calendario_run",
        organizationId: null,
        bypassedRls: true,
        requestId,
        metadata: retry,
      });
    return ok({ ...retry, motivo: "nenhuma_campanha_ativa" }, { requestId });
  }
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("fn_marketing_calendario_candidatos", {
    p_campanhas: campanhas.map((a) => a.id),
    p_limite: TETO_POR_RODADA - retry.tentados,
  });
  const parsed = z
    .array(
      z.object({
        id: z.string(),
        email: z.string().email(),
        idioma: z.string().nullable(),
        user_id: z.string().nullable(),
        token_descadastro: z.string(),
        campanha: z.string(),
      }),
    )
    .safeParse(data);
  if (error || !parsed.success)
    return fail("internal_error", "Não foi possível ler o público.", 500, { requestId });
  const marca = await marcaDaSaida(null);
  let enviados = retry.enviados,
    falhas = retry.falhas,
    tentados = retry.tentados;
  for (const lead of parsed.data) {
    if (tentados >= TETO_POR_RODADA) break;
    for (const campanha of campanhas.filter((a) => a.id === lead.campanha)) {
      if (!estaNaJanela(campanha, new Date())) continue;
      if (campanha.id === "cadastro-sem-assinatura" && !lead.user_id) continue;
      const idioma = ehIdiomaDoSite(lead.idioma ?? "")
        ? (lead.idioma as "pt-BR" | "en" | "es")
        : IDIOMA_DO_SITE_PADRAO;
      const conteudo = campanha.textos[idioma];
      const envioId = await reivindicarEnvio(admin, {
        leadId: lead.id,
        mensagem: chaveDaCampanha(campanha, lead.user_id),
        assunto: conteudo.assunto,
        marketing: true,
        campanha: campanha.id,
      });
      if (!envioId) continue;
      tentados++;
      const email = montarEmail(conteudo.corpo, idioma, lead.token_descadastro, marca.nome);
      const result = await sendEmail({
        to: lead.email,
        subject: conteudo.assunto,
        ...email,
        fromName: marca.nome,
        idempotencyKey: `email/${envioId}`,
        tags: [{ name: "campanha", value: campanha.id }],
      });
      if (await registrarResultadoEnvio(admin, envioId, result)) enviados++;
      else falhas++;
      await new Promise((resolve) => setTimeout(resolve, 600));
      break;
    }
  }
  if (tentados > 0)
    void audit({
      action: "marketing.calendario_run",
      organizationId: null,
      bypassedRls: true,
      requestId,
      metadata: { enviados, falhas, tentados },
    });
  return ok({ enviados, falhas, tentados }, { requestId });
}
export async function GET(req: NextRequest) {
  return handle(req);
}
export async function POST(req: NextRequest) {
  return handle(req);
}
