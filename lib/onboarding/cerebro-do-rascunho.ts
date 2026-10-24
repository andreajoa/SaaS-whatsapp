/**
 * O CÉREBRO DO FUNCIONÁRIO ANTES DE ELE TER NÚMERO.
 *
 * `ai_agent_versions.channel_session_id` é `not null`: sem WhatsApp conectado não
 * existe versão, e sem versão o onboarding não tinha com que mostrar a IA
 * respondendo. Com o WhatsApp no fim do onboarding (conversão, 24/10), é esse o
 * estado de TODA conta nova nos passos "Onde ele organiza" e "Ver ele atender".
 *
 * Aqui o par provedor/modelo sai de onde a versão o tiraria na publicação —
 * `organizations.settings.llm` (gravado no nascimento pela instalação) e, sem
 * modelo lá, a escolha do catálogo — e a chave segue a mesma ordem do turno:
 * credencial validada da organização, senão a chave da instalação.
 */
import type { createAdminClient } from "@/lib/supabase/admin";
import { chaveDePlataforma } from "@/lib/ai/runtime/agent";
import { loadCredential } from "@/lib/ai/credentials";
import { escolherModeloDoProvedor, type ModeloDoCatalogo } from "@/lib/ai/agents/escolher-modelo";

export type CerebroDoRascunho =
  | { provider: string; model: string; apiKey: string }
  | { erro: string };

/** `settings` é jsonb livre: leitura defensiva, igual à de `first-publication`. */
function llmDaOrganizacao(settings: unknown): { provider: string; model: string | null } {
  const llm = (settings as { llm?: unknown } | null)?.llm as
    | { provider?: unknown; default_model?: unknown }
    | null
    | undefined;
  const provider =
    typeof llm?.provider === "string" && llm.provider.trim() !== "" ? llm.provider : "anthropic";
  const model =
    typeof llm?.default_model === "string" && llm.default_model.trim() !== ""
      ? llm.default_model
      : null;
  return { provider, model };
}

export async function cerebroDoRascunho(
  admin: ReturnType<typeof createAdminClient>,
  orgId: string,
): Promise<CerebroDoRascunho> {
  const { data: org, error } = await admin
    .from("organizations")
    .select("settings")
    .eq("id", orgId)
    .maybeSingle();
  if (error || !org) return { erro: "não consegui ler a configuração de IA da sua conta" };

  const { provider, model: doNascimento } = llmDaOrganizacao(org.settings);

  let model = doNascimento;
  if (!model) {
    const { data: modelos } = await admin
      .from("ai_models")
      .select(
        "model_id, is_default_for_provider, supports_tools, input_price_per_million_cents, output_price_per_million_cents",
      )
      .eq("provider", provider)
      .is("deprecated_at", null);
    const escolha = escolherModeloDoProvedor((modelos ?? []) as ModeloDoCatalogo[]);
    if (!escolha.escolhido) return { erro: "não achei um modelo para o seu funcionário" };
    model = escolha.modelId;
  }

  const { data: credencial } = await admin
    .from("ai_provider_credentials")
    .select("id")
    .eq("organization_id", orgId)
    .eq("provider", provider)
    .eq("is_active", true)
    .not("validated_at", "is", null)
    .limit(1)
    .maybeSingle();
  if (credencial?.id) {
    try {
      const cred = await loadCredential(credencial.id as string, orgId);
      return { provider, model, apiKey: cred.apiKey };
    } catch {
      return { erro: "não consegui usar a chave cadastrada" };
    }
  }

  const daInstalacao = chaveDePlataforma(provider);
  if (!daInstalacao) return { erro: `esta instalação não tem chave de ${provider}` };
  return { provider, model, apiKey: daInstalacao };
}
