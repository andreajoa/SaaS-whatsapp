import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { ok, fail } from "@/lib/api/wrappers";
import { audit } from "@/lib/audit";
import { requireRole } from "@/lib/auth/require-role";
import { requireSupportWrite } from "@/lib/impersonate/support";
import { createClient } from "@/lib/supabase/server";
import { policySchema } from "@/lib/service-quality/contracts";
import { qualityDatabase } from "@/lib/service-quality/database";
import { qualityFailure } from "@/lib/service-quality/http";
import { qualityText } from "@/lib/service-quality/text";
export async function PUT(req: NextRequest) {
  const requestId = randomUUID();
  const auth = await requireRole("manager", { requestId, resource: "service_quality_policies" });
  if (!auth.ok) return auth.response;
  const denied = await requireSupportWrite(auth.org.orgId);
  if (denied) return denied;
  const text = qualityText(auth.user.idioma);
  try {
    const input = policySchema.safeParse(await req.json());
    if (!input.success) return fail("validation_error", text.invalid, 422, { requestId });
    const db = qualityDatabase(await createClient());
    const { data, error } = await db
      .from("service_quality_policies")
      .upsert(
        { ...input.data, organization_id: auth.org.orgId, updated_at: new Date().toISOString() },
        { onConflict: "organization_id" },
      )
      .select("enabled,first_response_target_seconds,resolution_target_seconds,clock_mode")
      .eq("organization_id", auth.org.orgId)
      .single();
    if (error) return qualityFailure(requestId, text, error.code);
    void audit({
      action: "org.updated",
      actorUserId: auth.user.id,
      organizationId: auth.org.orgId,
      resourceType: "service_quality_policies",
      resourceId: auth.org.orgId,
      requestId,
      metadata: { service_quality_action: "policy.updated", ...input.data },
    });
    return ok(data, { requestId });
  } catch (e) {
    return e instanceof SyntaxError
      ? fail("validation_error", text.invalid, 422, { requestId })
      : qualityFailure(requestId, text);
  }
}
