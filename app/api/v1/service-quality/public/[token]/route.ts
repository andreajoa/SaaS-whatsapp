import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { ok, fail } from "@/lib/api/wrappers";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizarIdioma } from "@/lib/i18n/idiomas";
import { feedbackSchema, surveyTokenSchema } from "@/lib/service-quality/contracts";
import { qualityDatabase } from "@/lib/service-quality/database";
import { guardPublicFeedback } from "@/lib/service-quality/public-guard";
import { hashSurveyToken } from "@/lib/service-quality/token";
import { qualityText } from "@/lib/service-quality/text";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ token: string }> };
const headers = { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" };
export async function GET(req: NextRequest, ctx: Context) {
  const requestId = randomUUID();
  const { token } = await ctx.params;
  try {
    const denied = await guardPublicFeedback(req, token, requestId);
    if (denied) return denied;
    if (!surveyTokenSchema.safeParse(token).success)
      return fail("not_found", qualityText("pt-BR").unavailable, 404, { requestId, headers });
    const db = qualityDatabase(createAdminClient());
    // Bootstrap de tenant via hash secreto (não há organization_id externo).
    const { data: survey, error } = await db
      .from("service_quality_surveys")
      .select("organization_id,expires_at,responded_at")
      .eq("token_hash", hashSurveyToken(token))
      .maybeSingle();
    if (error)
      return fail("internal_error", qualityText("pt-BR").error, 500, { requestId, headers });
    if (!survey || survey.responded_at || Date.parse(survey.expires_at) <= Date.now())
      return fail("not_found", qualityText("pt-BR").unavailable, 404, { requestId, headers });
    const { data: org, error: orgError } = await db
      .from("organizations")
      .select("locale")
      .eq("id", survey.organization_id)
      .single();
    if (orgError)
      return fail("internal_error", qualityText("pt-BR").error, 500, { requestId, headers });
    return ok({ available: true, locale: normalizarIdioma(org?.locale) }, { requestId, headers });
  } catch {
    return fail("internal_error", qualityText("pt-BR").error, 500, { requestId, headers });
  }
}
export async function POST(req: NextRequest, ctx: Context) {
  const requestId = randomUUID();
  const { token } = await ctx.params;
  try {
    const denied = await guardPublicFeedback(req, token, requestId);
    if (denied) return denied;
    if (!surveyTokenSchema.safeParse(token).success)
      return fail("not_found", qualityText("pt-BR").unavailable, 404, { requestId, headers });
    const input = feedbackSchema.safeParse(await req.json());
    if (!input.success)
      return fail("validation_error", qualityText("pt-BR").invalid, 422, { requestId, headers });
    const db = qualityDatabase(createAdminClient());
    const { data, error } = await db.rpc("fn_service_quality_respond", {
      p_hash: hashSurveyToken(token),
      p_score: input.data.score,
      p_comment: input.data.comment,
    });
    if (error)
      return fail("internal_error", qualityText("pt-BR").error, 500, { requestId, headers });
    if (!data)
      return fail("not_found", qualityText("pt-BR").unavailable, 404, { requestId, headers });
    z.object({ id: z.string().uuid() }).parse(data);
    // Nenhum ID/tenant/comentário é exposto ao visitante depois do uso.
    return ok({ accepted: true }, { requestId, headers });
  } catch (e) {
    return fail(
      e instanceof SyntaxError ? "validation_error" : "internal_error",
      qualityText("pt-BR").error,
      e instanceof SyntaxError ? 422 : 500,
      { requestId, headers },
    );
  }
}
