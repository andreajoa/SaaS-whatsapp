import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { ok, fail } from "@/lib/api/wrappers";
import { requireRole } from "@/lib/auth/require-role";
import { roleAtLeast } from "@/lib/auth/types";
import { createClient } from "@/lib/supabase/server";
import {
  DISABLED_POLICY,
  factSchema,
  listQuerySchema,
  policySchema,
  surveyHistorySchema,
} from "@/lib/service-quality/contracts";
import { qualityDatabase } from "@/lib/service-quality/database";
import { qualityFailure } from "@/lib/service-quality/http";
import { conversationMetrics, pageSummary } from "@/lib/service-quality/metrics";
import { qualityText } from "@/lib/service-quality/text";
export const dynamic = "force-dynamic";
export async function GET(req: NextRequest) {
  const requestId = randomUUID();
  const auth = await requireRole("viewer", { requestId, resource: "service_quality" });
  if (!auth.ok) return auth.response;
  const text = qualityText(auth.user.idioma);
  const query = listQuerySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams));
  if (!query.success) return fail("validation_error", text.invalid, 422, { requestId });
  try {
    const db = qualityDatabase(await createClient());
    const p = query.data;
    const [policies, facts] = await Promise.all([
      db
        .from("service_quality_policies")
        .select("enabled,first_response_target_seconds,resolution_target_seconds,clock_mode")
        .eq("organization_id", auth.org.orgId)
        .maybeSingle(),
      db.rpc("fn_service_quality_facts", {
        p_org: auth.org.orgId,
        p_after: p.after,
        p_limit: p.limit + 1,
        p_conversation: p.conversation_id,
      }),
    ]);
    if (policies.error || facts.error)
      return qualityFailure(requestId, text, policies.error?.code ?? facts.error?.code);
    const policy = policySchema.parse(policies.data ?? DISABLED_POLICY);
    const parsed = z.array(factSchema).parse(facts.data);
    const hasMore = parsed.length > p.limit;
    const measured_at = new Date().toISOString();
    const rows = parsed
      .slice(0, p.limit)
      .map((f) => conversationMetrics(f, policy, Date.parse(measured_at)));
    // Survey histórico pertence à conversa, mesmo após reabrir atendimento.
    const surveyQuery = await db.rpc("fn_service_quality_surveys", {
      p_org: auth.org.orgId,
      p_conversations: rows.map((r) => r.conversation_id),
      p_limit: 100,
    });
    if (surveyQuery.error) return qualityFailure(requestId, text);
    const history = surveyHistorySchema.parse(surveyQuery.data);
    const surveys = history.surveys;

    return ok(
      {
        policy,
        can_manage: roleAtLeast(auth.org.role, "manager"),
        rows,
        surveys,
        summary: { ...pageSummary(rows, surveys), ...history.summary },
        survey_history_truncated: history.summary.total > surveys.length,
        measured_at,
        next_cursor: hasMore ? rows.at(-1)?.conversation_id : null,
      },
      {
        requestId,
        meta: {
          has_more: hasMore,
          survey_history_truncated: history.summary.total > surveys.length,
        },
      },
    );
  } catch {
    return qualityFailure(requestId, text);
  }
}
