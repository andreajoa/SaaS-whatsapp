import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { ok, fail } from "@/lib/api/wrappers";
import { audit } from "@/lib/audit";
import { requireRole } from "@/lib/auth/require-role";
import { requireSupportWrite } from "@/lib/impersonate/support";
import { createClient } from "@/lib/supabase/server";
import { requestSurveySchema } from "@/lib/service-quality/contracts";
import { qualityDatabase } from "@/lib/service-quality/database";
import { qualityFailure } from "@/lib/service-quality/http";
import { qualityText } from "@/lib/service-quality/text";
import { newSurveyToken } from "@/lib/service-quality/token";
export async function POST(req: NextRequest) {
  const requestId = randomUUID();
  const auth = await requireRole("manager", { requestId, resource: "service_quality_surveys" });
  if (!auth.ok) return auth.response;
  const denied = await requireSupportWrite(auth.org.orgId);
  if (denied) return denied;
  const text = qualityText(auth.user.idioma);
  try {
    const input = requestSurveySchema.safeParse(await req.json());
    if (!input.success) return fail("validation_error", text.invalid, 422, { requestId });
    const { token, hash } = newSurveyToken();
    const expires = new Date(Date.now() + input.data.expires_hours * 3600000).toISOString();
    const db = qualityDatabase(await createClient());
    const { data, error } = await db.rpc("fn_service_quality_request", {
      p_org: auth.org.orgId,
      p_conversation: input.data.conversation_id,
      p_hash: hash,
      p_expires: expires,
    });
    if (error) return qualityFailure(requestId, text, error.code);
    const survey = z
      .object({ id: z.string().uuid(), conversation_id: z.string().uuid(), expires_at: z.string() })
      .parse(data);
    void audit({
      action: "conversation.note_added",
      actorUserId: auth.user.id,
      organizationId: auth.org.orgId,
      resourceType: "service_quality_surveys",
      resourceId: survey.id,
      requestId,
      metadata: {
        service_quality_action: "csat.requested",
        conversation_id: survey.conversation_id,
        expires_at: survey.expires_at,
      },
    });
    // Caminho relativo evita confiar em Host/X-Forwarded-Host; o browser usa sua origem.
    // Token mostrado uma vez; nunca em auditoria, resposta de listagem ou logs.
    return ok(
      { ...survey, feedback_path: `/feedback/${token}`, sent: false },
      { status: 201, requestId, headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return e instanceof SyntaxError
      ? fail("validation_error", text.invalid, 422, { requestId })
      : qualityFailure(requestId, text);
  }
}
