import { requireSupportWrite } from "@/lib/impersonate/support";
/**
 * GET   /api/v1/settings/teste-consigo-mesmo — a opção está ligada? (admin)
 * PATCH /api/v1/settings/teste-consigo-mesmo — liga/desliga (admin)
 *
 * A configuração está em `lib/channels/teste-consigo-mesmo.ts`. Admin, e não
 * manager, porque muda o que conta como CLIENTE na ingestão — é decisão do dono
 * da conta, como o perfil da organização.
 *
 * Escrita pelo admin client pela mesma razão documentada em
 * `app/api/v1/settings/routing/route.ts`: a policy de escrita de
 * `organizations` só casa para platform admin, e pelo client de sessão o UPDATE
 * de um admin comum casaria zero linhas e devolveria "sucesso".
 */
import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { ok, fail } from "@/lib/api/wrappers";
import { audit } from "@/lib/audit";
import { requireRole } from "@/lib/auth/require-role";
import { createAdminClient } from "@/lib/supabase/admin";
import { testeConsigoMesmoLigado } from "@/lib/channels/teste-consigo-mesmo";

export const dynamic = "force-dynamic";

const patchSchema = z.object({ ligado: z.boolean() }).strict();

export async function GET(_req: NextRequest): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requireRole("admin", { requestId, resource: "settings_teste_consigo_mesmo" });
  if (!authz.ok) return authz.response;

  const { data, error } = await createAdminClient()
    .from("organizations")
    .select("settings")
    .eq("id", authz.org.orgId)
    .maybeSingle();
  if (error) return fail("internal_error", error.message, 500, { requestId });
  return ok({ ligado: testeConsigoMesmoLigado(data?.settings) }, { requestId });
}

export async function PATCH(req: NextRequest): Promise<Response> {
  const supportDenied = await requireSupportWrite();
  if (supportDenied) return supportDenied;

  const requestId = randomUUID();
  const authz = await requireRole("admin", { requestId, resource: "settings_teste_consigo_mesmo" });
  if (!authz.ok) return authz.response;
  const { user, org } = authz;

  const parsed = patchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return fail("validation_failed", "Corpo esperado: { ligado: boolean }.", 400, { requestId });
  }
  const { ligado } = parsed.data;

  const admin = createAdminClient();
  const { data: orgRow, error: readErr } = await admin
    .from("organizations")
    .select("settings")
    .eq("id", org.orgId)
    .maybeSingle();
  if (readErr) return fail("internal_error", readErr.message, 500, { requestId });

  const atuais = (orgRow?.settings as Record<string, unknown> | null) ?? {};
  const { error: updErr } = await admin
    .from("organizations")
    .update({ settings: { ...atuais, teste_consigo_mesmo: ligado } })
    .eq("id", org.orgId);
  if (updErr) return fail("internal_error", updErr.message, 500, { requestId });

  void audit({
    action: "settings.teste_consigo_mesmo_changed",
    actorUserId: user.id,
    organizationId: org.orgId,
    resourceType: "organization",
    resourceId: org.orgId,
    requestId,
    metadata: { ligado },
  });

  return ok({ ligado }, { requestId });
}
