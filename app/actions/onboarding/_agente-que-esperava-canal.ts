/**
 * O agente criado no onboarding nasce sem canal e fica RASCUNHO (`no_channel`):
 * desde 24/10/2026 o WhatsApp vem depois de treinar. Ele vai ao ar quando o
 * primeiro número aparece — e isso acontece em dois lugares, que chamam esta
 * mesma função: o fim do onboarding (`finishOnboarding.ts`) e a volta da
 * conexão por QR (`app/api/v1/channels/partner/qr/retorno`), que pode chegar
 * DEPOIS de o onboarding ter terminado sem número.
 *
 * Nunca lança, e não republica (`publishFirstVersion` já é idempotente).
 * Sem "use server" de propósito: é helper de servidor, não ação exposta ao
 * navegador.
 */
import { audit } from "@/lib/audit";
import { publishFirstVersion } from "@/lib/ai/agents/first-publication";
import type { createAdminClient } from "@/lib/supabase/admin";

import { loadOnboardingState } from "./_shared";

export async function publicarAgenteQueEsperavaCanal(
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
