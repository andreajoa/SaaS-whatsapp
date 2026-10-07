/**
 * `crm_get_setup_status` — o que falta para o atendimento automático funcionar.
 * Só leitura; separada de `configuracao.ts` porque o gate `tool-read-nao-muta`
 * olha o arquivo do handler, e lá moram as ferramentas que gravam.
 */
import { orgTemAutomatico } from "@/lib/ai/agents/org-tem-automatico";
import { estadoDoAgente } from "@/lib/ai/agents/no-ar";
import { listSelectableChannels } from "@/lib/channels/selectable";
import type { McpToolDefinition } from "../types";

// ---------------------------------------------------------------------------

const statusShape = {};

export const crmGetSetupStatus: McpToolDefinition<typeof statusShape> = {
  name: "crm_get_setup_status",
  description:
    "Mostra o que já está pronto e o que falta para o atendimento automático funcionar nesta empresa: chaves de IA cadastradas, WhatsApp conectado, atendentes (publicados ou não, e o motivo), roteador do número e se a IA interna está respondendo. " +
    "Chame PRIMEIRO, antes de configurar, e de novo no fim para confirmar.",
  inputSchema: statusShape,
  category: "read",
  requiresRole: "manager",
  requiresScope: "mcp:read",
  handler: async (_input, ctx) => {
    const org = ctx.organizationId;
    const [canais, credenciais, agentes, roteadores, iaNoAr] = await Promise.all([
      listSelectableChannels(ctx.supabase, org).catch(() => []),
      ctx.supabase
        .from("ai_provider_credentials")
        .select("provider, validated_at, is_active")
        .eq("organization_id", org)
        .eq("is_active", true),
      ctx.supabase
        .from("ai_agents")
        .select("id, name, is_default, paused_at, published_version_id, archived_at, kind, is_active")
        .eq("organization_id", org)
        .is("archived_at", null),
      ctx.supabase
        .from("ai_routers")
        .select("id, name, channel_session_id, is_active, fallback_agent_id")
        .eq("organization_id", org),
      orgTemAutomatico(ctx.supabase, org),
    ]);

    const chaves = ((credenciais.data ?? []) as Array<{ provider: string; validated_at: string | null }>).map(
      (c) => ({ provedor: c.provider, validada: c.validated_at != null }),
    );
    const lista = (agentes.data ?? []) as Array<{
      id: string;
      name: string;
      is_default: boolean;
      paused_at: string | null;
      published_version_id: string | null;
      archived_at: string | null;
    }>;

    const pendencias: string[] = [];
    if (canais.length === 0) pendencias.push("Conectar um número de WhatsApp em Conexões (QR).");
    if (!chaves.some((c) => c.validada))
      pendencias.push("Cadastrar a chave de IA da empresa em Agentes de IA › Provedores.");
    if (!lista.some((a) => estadoDoAgente(a) === "no_ar"))
      pendencias.push("Publicar ao menos um atendente (crm_upsert_agent).");

    return {
      whatsapp: canais.map((c) => ({ id: c.id, status: c.status, numero: c.phone_number })),
      chaves_de_ia: chaves,
      atendentes: lista.map((a) => ({
        id: a.id,
        nome: a.name,
        padrao: a.is_default,
        estado: estadoDoAgente(a),
      })),
      roteadores: (roteadores.data ?? []).map((r) => ({
        id: r.id,
        nome: r.name,
        canal: r.channel_session_id,
        ativo: r.is_active,
        atendente_padrao: r.fallback_agent_id,
      })),
      ia_interna_no_ar: iaNoAr !== false,
      pendencias,
      pronto: pendencias.length === 0,
    };
  },
};

