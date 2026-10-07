/**
 * CONFIGURAR A EMPRESA PELO MCP — o Claude Code ou o Codex do dono monta o
 * atendente conversando, em vez de o dono preencher tela por tela.
 *
 * Três ferramentas, na ordem em que o agente de código as usa (a 1ª mora em
 * `configuracao-status.ts`, porque o gate `tool-read-nao-muta` lê o arquivo):
 *   1. `crm_get_setup_status` — o que falta: chave de IA, WhatsApp, atendentes
 *      (e por que um não está no ar), roteador.
 *   2. `crm_upsert_agent` — cria ou atualiza UM atendente a partir do que o dono
 *      contou (negócio, tom, serviços e preços, perguntas frequentes, regras) e
 *      PUBLICA, pelos mesmos caminhos das telas.
 *   3. `crm_upsert_router` — um número, vários atendentes: cada um com o assunto
 *      que atende.
 *
 * POR QUE O CONTEÚDO VAI NAS INSTRUÇÕES, E NÃO NA BASE DE CONHECIMENTO: a base
 * só indexa com chave de embedding (OpenAI). Quem cadastrou só a chave da
 * Anthropic ficaria com o material parado e o atendente sem saber o preço.
 * Serviços, preços e perguntas frequentes de um pequeno negócio cabem no
 * prompt e funcionam com qualquer provedor.
 *
 * PUBLICAR NUNCA FINGE: sem canal, sem chave ou sem modelo, a ferramenta devolve
 * `publicado: false` com o motivo e o que o dono precisa fazer — o mesmo
 * contrato do onboarding (`publishFirstVersion`). Um atendente "salvo" que não
 * responde ninguém é o pior desfecho do produto.
 *
 * Todas exigem `manager` e são `apenasHumano` no catálogo: o atendente interno
 * não reconfigura a si mesmo.
 */
import { z } from "zod";

// `import type`: os valores são carregados na chamada. `first-publication`
// (via `capacidades-padrao`) e `publish` (via `lib/ai/runtime`) chegam ao índice
// de tools que importa ESTE arquivo — import estático fecha o ciclo e
// `allTools` nasce com `undefined`.
import type { PublishOutcome } from "@/lib/ai/agents/first-publication";
import { listSelectableChannels } from "@/lib/channels/selectable";
import type { McpContext, McpToolDefinition } from "../types";

// ---------------------------------------------------------------------------
// Instruções do atendente
// ---------------------------------------------------------------------------

export interface FichaDoAtendente {
  negocio: string;
  o_que_faz?: string;
  tom?: string;
  servicos_e_precos?: string;
  perguntas_frequentes?: Array<{ pergunta: string; resposta: string }>;
  horario_e_contato?: string;
  regras?: string;
}

/** Monta as instruções a partir da ficha. Exportada para teste. */
export function montarInstrucoes(f: FichaDoAtendente): string {
  const partes: string[] = [];
  partes.push(
    f.o_que_faz
      ? `Você atende os clientes de ${f.negocio}, que é: ${f.o_que_faz}.`
      : `Você atende os clientes de ${f.negocio}.`,
  );
  partes.push(
    f.tom?.trim()
      ? `Jeito de falar: ${f.tom.trim()}`
      : "Fale de forma calorosa, clara e objetiva, em mensagens curtas de WhatsApp.",
  );
  if (f.servicos_e_precos?.trim()) {
    partes.push(`## Serviços e preços\n${f.servicos_e_precos.trim()}`);
  }
  if (f.perguntas_frequentes?.length) {
    partes.push(
      "## Perguntas frequentes\n" +
        f.perguntas_frequentes
          .map((p) => `P: ${p.pergunta.trim()}\nR: ${p.resposta.trim()}`)
          .join("\n\n"),
    );
  }
  if (f.horario_e_contato?.trim()) {
    partes.push(`## Horário e contato\n${f.horario_e_contato.trim()}`);
  }
  if (f.regras?.trim()) partes.push(`## Regras\n${f.regras.trim()}`);
  partes.push(
    "Use só as informações acima para falar de preço, prazo e condição. Se o cliente pedir algo que não está aqui, diga que vai confirmar com a equipe e chame uma pessoa — nunca invente valor.",
  );
  return partes.join("\n\n");
}

/** O que o dono precisa fazer quando a publicação não aconteceu. */
function proximoPasso(o: Exclude<PublishOutcome, { published: true }>): string {
  switch (o.reason) {
    case "no_channel":
      return "Conecte um número de WhatsApp em Conexões (QR) e rode esta ferramenta de novo.";
    case "sem_chave":
      return `Cadastre a chave de IA da empresa (${o.provider}) em Agentes de IA › Provedores e rode esta ferramenta de novo.`;
    case "no_model":
      return o.motivo === "catalogo_vazio"
        ? `A lista de modelos de ${o.provider} ainda não foi carregada nesta instalação. Tente de novo mais tarde ou cadastre outro provedor.`
        : `Nenhum modelo de ${o.provider} serve para atendimento (precisa usar ferramentas). Cadastre a chave de outro provedor.`;
    case "failed":
      return `Não deu para publicar: ${o.message}. Abra o atendente em Agentes de IA para revisar.`;
  }
}

// ---------------------------------------------------------------------------
// crm_upsert_agent
// ---------------------------------------------------------------------------

const agentShape = {
  agent_id: z.string().uuid().optional(),
  nome_do_atendente: z.string().trim().min(1).max(80),
  negocio: z.string().trim().min(1).max(160),
  o_que_faz: z.string().trim().max(600).optional(),
  tom: z.string().trim().max(600).optional(),
  servicos_e_precos: z.string().trim().max(8000).optional(),
  perguntas_frequentes: z
    .array(z.object({ pergunta: z.string().trim().min(1).max(500), resposta: z.string().trim().min(1).max(2000) }))
    .max(40)
    .optional(),
  horario_e_contato: z.string().trim().max(1000).optional(),
  regras: z.string().trim().max(3000).optional(),
  publicar: z.boolean().default(true),
};

async function publicarVersaoNova(
  ctx: McpContext,
  agentId: string,
  publicadaId: string,
  instrucoes: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  // Copia a versão no ar e troca só as instruções: modelo, chave, número,
  // capacidades e funil que o dono escolheu nas telas continuam valendo.
  const { data: base, error: baseErr } = await ctx.supabase
    .from("ai_agent_versions")
    .select("*")
    .eq("organization_id", ctx.organizationId)
    .eq("agent_id", agentId)
    .eq("id", publicadaId)
    .maybeSingle();
  if (baseErr || !base) return { ok: false, message: baseErr?.message ?? "version_not_found" };

  for (let tentativa = 0; tentativa < 3; tentativa++) {
    const { data: max } = await ctx.supabase
      .from("ai_agent_versions")
      .select("version_number")
      .eq("organization_id", ctx.organizationId)
      .eq("agent_id", agentId)
      .order("version_number", { ascending: false })
      .limit(1)
      .maybeSingle();
    const {
      id: _id,
      created_at: _c,
      published_at: _p,
      superseded_at: _s,
      updated_at: _u,
      version_number: _n,
      provisioning_origin: _o,
      ...copia
    } = base as Record<string, unknown>;
    const { data: nova, error } = await ctx.supabase
      .from("ai_agent_versions")
      .insert({
        ...copia,
        version_number: ((max?.version_number as number | undefined) ?? 0) + 1,
        system_prompt: instrucoes,
        status: "draft",
        created_by: ctx.actor.type === "user" ? ctx.actor.id : (copia.created_by ?? null),
      })
      .select("id")
      .single();
    if (error?.code === "23505") continue;
    if (error || !nova) return { ok: false, message: error?.message ?? "version_insert_failed" };
    const { publishAgentVersion } = await import("@/lib/ai/agents/publish");
    const pub = await publishAgentVersion(ctx.supabase, {
      orgId: ctx.organizationId,
      agentId,
      versionId: nova.id as string,
    });
    return pub.ok ? { ok: true } : { ok: false, message: pub.message };
  }
  return { ok: false, message: "conflito de versão — tente de novo" };
}

export const crmUpsertAgent: McpToolDefinition<typeof agentShape> = {
  name: "crm_upsert_agent",
  description:
    "Cria ou atualiza um atendente de IA da empresa e o coloca no ar. Passe o que o dono contou: nome do negócio, o que faz, tom, serviços e preços, perguntas frequentes, horário e regras — o atendente só fala de preço e condição com base nisto. " +
    "Sem `agent_id` cria um atendente novo (use para cada negócio ou setor diferente); com `agent_id` reescreve as instruções daquele atendente e publica uma versão nova. " +
    "Se `publicado` voltar false, mostre ao dono o `proximo_passo` — não diga que está funcionando.",
  inputSchema: agentShape,
  category: "write",
  requiresRole: "manager",
  requiresScope: "mcp:write",
  handler: async (input, ctx) => {
    const instrucoes = montarInstrucoes(input);
    const userId = ctx.actor.type === "user" ? ctx.actor.id : null;

    let agente: { id: string; published_version_id: string | null } | null = null;
    if (input.agent_id) {
      const { data, error } = await ctx.supabase
        .from("ai_agents")
        .update({ name: input.nome_do_atendente, system_prompt: instrucoes, is_active: true })
        .eq("organization_id", ctx.organizationId)
        .eq("id", input.agent_id)
        .is("archived_at", null)
        .select("id, published_version_id")
        .maybeSingle();
      if (error) throw new Error(`Falha ao atualizar o atendente: ${error.message}`);
      if (!data) throw new Error("Atendente não encontrado nesta empresa.");
      agente = data;
    } else {
      // O primeiro atendente da empresa vira o padrão — o mesmo papel do que o
      // onboarding cria. Os seguintes nascem comuns.
      const { data: padrao } = await ctx.supabase
        .from("ai_agents")
        .select("id")
        .eq("organization_id", ctx.organizationId)
        .eq("is_default", true)
        .is("archived_at", null)
        .maybeSingle();
      const { data, error } = await ctx.supabase
        .from("ai_agents")
        .insert({
          organization_id: ctx.organizationId,
          name: input.nome_do_atendente,
          system_prompt: instrucoes,
          kind: "mcp_agent",
          is_default: !padrao,
          is_active: true,
          created_by: userId,
        })
        .select("id, published_version_id")
        .single();
      if (error || !data) throw new Error(`Falha ao criar o atendente: ${error?.message}`);
      agente = data;
    }

    if (!input.publicar) {
      return { agent_id: agente.id, publicado: false, proximo_passo: "Salvo sem publicar, como pedido." };
    }

    if (agente.published_version_id) {
      const r = await publicarVersaoNova(ctx, agente.id, agente.published_version_id, instrucoes);
      return r.ok
        ? { agent_id: agente.id, publicado: true }
        : {
            agent_id: agente.id,
            publicado: false,
            proximo_passo: `Não deu para publicar a versão nova: ${r.message}. A versão anterior continua no ar.`,
          };
    }

    const { publishFirstVersion } = await import("@/lib/ai/agents/first-publication");
    const outcome = await publishFirstVersion(
      ctx.supabase as Parameters<typeof publishFirstVersion>[0],
      ctx.organizationId,
      agente,
      instrucoes,
      userId ?? "",
    );
    return outcome.published
      ? { agent_id: agente.id, publicado: true }
      : { agent_id: agente.id, publicado: false, motivo: outcome.reason, proximo_passo: proximoPasso(outcome) };
  },
};

// ---------------------------------------------------------------------------
// crm_upsert_router
// ---------------------------------------------------------------------------

const routerShape = {
  channel_session_id: z.string().uuid().optional(),
  nome: z.string().trim().min(1).max(120).default("Roteador do número"),
  atendente_padrao_id: z.string().uuid(),
  atendentes: z
    .array(
      z.object({
        agent_id: z.string().uuid(),
        assunto: z.string().trim().min(1).max(120),
        quando_usar: z.string().trim().min(1).max(2000),
        exemplos: z.array(z.string().trim().min(1).max(300)).max(10).default([]),
      }),
    )
    .min(1)
    .max(20),
};

export const crmUpsertRouter: McpToolDefinition<typeof routerShape> = {
  name: "crm_upsert_router",
  description:
    "Faz um número de WhatsApp atender vários negócios ou setores: cada atendente recebe o assunto que atende (`quando_usar` + exemplos de frases de cliente) e o roteador manda cada conversa para o atendente certo. `atendente_padrao_id` responde quando o assunto não está claro. " +
    "Sem `channel_session_id` usa o primeiro número conectado. Substitui a lista inteira de atendentes do roteador daquele número. Os atendentes precisam estar publicados (crm_upsert_agent).",
  inputSchema: routerShape,
  category: "write",
  requiresRole: "manager",
  requiresScope: "mcp:write",
  handler: async (input, ctx) => {
    const org = ctx.organizationId;
    const canais = await listSelectableChannels(ctx.supabase, org);
    const canal = input.channel_session_id
      ? canais.find((c) => c.id === input.channel_session_id)
      : canais[0];
    if (!canal) throw new Error("Nenhum número de WhatsApp conectado nesta empresa (ou o id não é desta empresa).");

    const ids = [...new Set([input.atendente_padrao_id, ...input.atendentes.map((a) => a.agent_id)])];
    const { data: ags, error: agErr } = await ctx.supabase
      .from("ai_agents")
      .select("id")
      .eq("organization_id", org)
      .is("archived_at", null)
      .in("id", ids);
    if (agErr) throw new Error(agErr.message);
    const existentes = new Set((ags ?? []).map((a) => a.id as string));
    const faltando = ids.filter((id) => !existentes.has(id));
    if (faltando.length) throw new Error(`Atendente(s) não encontrado(s) nesta empresa: ${faltando.join(", ")}`);

    const { data: atual } = await ctx.supabase
      .from("ai_routers")
      .select("id")
      .eq("organization_id", org)
      .eq("channel_session_id", canal.id)
      .eq("is_active", true)
      .maybeSingle();

    let routerId = atual?.id as string | undefined;
    if (routerId) {
      const { error } = await ctx.supabase
        .from("ai_routers")
        .update({ name: input.nome, fallback_agent_id: input.atendente_padrao_id })
        .eq("organization_id", org)
        .eq("id", routerId);
      if (error) throw new Error(error.message);
    } else {
      const { data, error } = await ctx.supabase
        .from("ai_routers")
        .insert({
          organization_id: org,
          name: input.nome,
          channel_session_id: canal.id,
          fallback_agent_id: input.atendente_padrao_id,
          is_active: true,
          created_by: ctx.actor.type === "user" ? ctx.actor.id : null,
        })
        .select("id")
        .single();
      if (error || !data) throw new Error(error?.message ?? "router_insert_failed");
      routerId = data.id as string;
    }

    const { error: delErr } = await ctx.supabase
      .from("ai_router_members")
      .delete()
      .eq("organization_id", org)
      .eq("router_id", routerId);
    if (delErr) throw new Error(delErr.message);
    const { error: insErr } = await ctx.supabase.from("ai_router_members").insert(
      input.atendentes.map((a, i) => ({
        organization_id: org,
        router_id: routerId,
        agent_id: a.agent_id,
        intent_name: a.assunto,
        intent_description: a.quando_usar,
        examples: a.exemplos,
        position: i,
      })),
    );
    if (insErr) throw new Error(insErr.message);

    return { router_id: routerId, canal: canal.id, atendentes: input.atendentes.length };
  },
};
