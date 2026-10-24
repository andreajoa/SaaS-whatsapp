"use server";

/**
 * Server Action: finalize onboarding — stamps `onboarded_at`, audits, and
 * emits the `tenant.onboarded` domain event. Idempotent: only fires the
 * event the first time `onboarded_at` flips from NULL.
 */
import { redirect } from "next/navigation";

import { audit } from "@/lib/audit";
import { createAdminClient } from "@/lib/supabase/admin";
import { publishFirstVersion } from "@/lib/ai/agents/first-publication";
import { loadOnboardingState, requireOnboardingCtx, OnboardingError } from "./_shared";

export type FinishOnboardingResult =
  | { ok: true; alreadyOnboarded: boolean }
  | { ok: false; error: "auth_required" | "no_active_org" | "db_error"; details?: unknown };

export async function finishOnboarding(): Promise<FinishOnboardingResult> {
  let ctx;
  try {
    ctx = await requireOnboardingCtx();
  } catch (err) {
    if (err instanceof OnboardingError) return { ok: false, error: err.code as never };
    throw err;
  }

  const admin = createAdminClient();

  const { data: existing } = await admin
    .from("organizations")
    .select("onboarded_at")
    .eq("id", ctx.orgId)
    .maybeSingle();

  const alreadyOnboarded = Boolean(existing?.onboarded_at);

  if (!alreadyOnboarded) {
    const { error } = await admin
      .from("organizations")
      .update({ onboarded_at: new Date().toISOString() })
      .eq("id", ctx.orgId)
      .is("onboarded_at", null);
    if (error) return { ok: false, error: "db_error", details: error.message };

    await admin.from("event_log").insert({
      organization_id: ctx.orgId,
      event_type: "tenant.onboarded",
      payload: { completed_by: ctx.userId },
    });

    await audit({
      action: "onboarding.completed",
      actorUserId: ctx.userId,
      organizationId: ctx.orgId,
    });
    await audit({
      action: "tenant.onboarded",
      actorUserId: ctx.userId,
      organizationId: ctx.orgId,
    });
  }

  // Desde 24/10/2026 o WhatsApp vem DEPOIS de treinar (lib/onboarding/passos.ts):
  // o agente nasce em "Treinar" sem canal e fica rascunho (`no_channel`). Se o
  // número foi conectado no caminho, é aqui que ele vai ao ar — sem isso a IA
  // nunca responderia, e o teste sem cartão (que começa na 1ª resposta dela)
  // nunca começaria. `publishFirstVersion` nunca lança e não republica.
  await publicarAgenteQueEsperavaCanal(admin, ctx.orgId, ctx.userId);

  redirect("/app/inbox");
}

async function publicarAgenteQueEsperavaCanal(
  admin: ReturnType<typeof createAdminClient>,
  orgId: string,
  userId: string,
): Promise<void> {
  try {
    const { state } = await loadOnboardingState(orgId);
    const agentId = state.ai?.agent_id;
    if (!agentId) return;
    const { data: agent } = await admin
      .from("ai_agents")
      .select("id, system_prompt, published_version_id, archived_at")
      .eq("organization_id", orgId)
      .eq("id", agentId)
      .maybeSingle();
    if (!agent || agent.published_version_id || agent.archived_at) return;
    const publicacao = await publishFirstVersion(admin, orgId, agent, agent.system_prompt ?? "", userId);
    if (publicacao.published) {
      await audit({
        action: "onboarding.ai_published_after_channel",
        actorUserId: userId,
        organizationId: orgId,
        resourceType: "ai_agent",
        resourceId: agent.id,
      });
    }
  } catch {
    // O onboarding termina mesmo assim: o agente segue rascunho e a lista de
    // agentes já mostra "Rascunho" com o botão de publicar.
  }
}
