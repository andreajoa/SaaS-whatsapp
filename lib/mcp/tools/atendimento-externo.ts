/**
 * ATENDENTE EXTERNO — o Claude Code ou o Codex do dono atendendo pelo MCP.
 *
 * O dono liga o próprio agente de código ao Atenza com um token e deixa ele num
 * ciclo (`/loop 1m atenda os clientes do Atenza`). Cada volta do ciclo precisa
 * responder UMA pergunta: "quem está esperando resposta?". Com as tools que já
 * existiam, o agente teria de listar conversas e abrir o histórico de cada uma
 * para descobrir onde o cliente falou por último — N+1 chamadas por minuto, e
 * o modelo decidindo sozinho o que é "esperando". Aqui a régua é do servidor:
 * a última mensagem recebida é mais nova que a última enviada.
 *
 * Devolve junto as mensagens recentes de cada conversa, para que uma volta do
 * ciclo seja: esta chamada + uma `crm_send_whatsapp_message` por cliente.
 *
 * O AVISO DE RESPOSTA EM DOBRO: a IA interna responde sozinha sempre que há um
 * agente no ar (`agenteAtende`). Se o dono ligar o Claude Code sem pausar o
 * agente interno, o cliente recebe duas respostas. Não existe flag "modo
 * externo" no banco — pausar o agente interno É o modo externo —, então a tool
 * informa `ia_interna_no_ar` e o modelo é instruído a avisar o dono em vez de
 * responder por cima.
 */
import { z } from "zod";

import { orgTemAutomatico } from "@/lib/ai/agents/org-tem-automatico";
import type { McpToolDefinition } from "../types";

const inputShape = {
  limit: z.number().int().min(1).max(20).default(10),
  recent_messages: z.number().int().min(1).max(20).default(8),
  include_human_owned: z.boolean().default(false),
};

interface ConversaRow {
  id: string;
  contact_id: string;
  status: string;
  last_inbound_at: string | null;
  last_outbound_at: string | null;
  assignee_kind: string | null;
  assigned_to_user_name: string | null;
}

interface MensagemRow {
  conversation_id: string;
  direction: string;
  type: string;
  body: string | null;
  media_derived_text: string | null;
  sent_at: string;
}

/** A régua de "esperando": o cliente falou por último. Exportada para teste. */
export function clienteFalouPorUltimo(c: {
  last_inbound_at: string | null;
  last_outbound_at: string | null;
}): boolean {
  if (!c.last_inbound_at) return false;
  if (!c.last_outbound_at) return true;
  return Date.parse(c.last_inbound_at) > Date.parse(c.last_outbound_at);
}

export const crmListAwaitingReply: McpToolDefinition<typeof inputShape> = {
  name: "crm_list_awaiting_reply",
  description:
    "Lista as conversas de WhatsApp em que o CLIENTE falou por último e ainda não recebeu resposta, da espera mais antiga para a mais nova, já com as mensagens recentes de cada uma. " +
    "Use no início de cada volta de atendimento: para cada item, leia `recent_messages` e responda com `crm_send_whatsapp_message` usando o `conversation_id`. " +
    "Por padrão omite conversas que uma pessoa da equipe assumiu (`include_human_owned=false`). " +
    "Se `ia_interna_no_ar` vier true, a IA interna do Atenza também está respondendo esses clientes: NÃO responda, avise o dono que ele precisa pausar o agente interno em Agentes de IA antes, senão o cliente recebe duas respostas.",
  inputSchema: inputShape,
  category: "read",
  requiresRole: "agent",
  requiresScope: "mcp:read",
  handler: async (input, ctx) => {
    const { data: conversas, error } = await ctx.supabase
      .from("conversations")
      .select(
        "id, contact_id, status, last_inbound_at, last_outbound_at, assignee_kind, assigned_to_user_name",
      )
      .eq("organization_id", ctx.organizationId)
      .eq("is_group", false)
      .not("status", "in", "(closed,archived)")
      .not("last_inbound_at", "is", null)
      .order("last_inbound_at", { ascending: true })
      // A comparação inbound > outbound é entre colunas; o PostgREST não filtra
      // isso. Puxa uma janela folgada e decide aqui.
      .limit(200);
    if (error) throw new Error(`Falha ao listar conversas: ${error.message}`);

    const esperando = ((conversas ?? []) as ConversaRow[])
      .filter(clienteFalouPorUltimo)
      .filter((c) => input.include_human_owned || c.assignee_kind !== "user")
      .slice(0, input.limit);

    const iaInterna = await orgTemAutomatico(ctx.supabase, ctx.organizationId);
    // `undefined` = não deu para saber. Assume que há, pela convenção de
    // `orgTemAutomatico`: errar para o lado de não responder em dobro.
    const iaInternaNoAr = iaInterna !== false;

    if (esperando.length === 0) {
      return { ia_interna_no_ar: iaInternaNoAr, conversations: [] };
    }

    const contatoIds = [...new Set(esperando.map((c) => c.contact_id))];
    const { data: contatos } = await ctx.supabase
      .from("contacts")
      .select("id, display_name, name, phone_number")
      .eq("organization_id", ctx.organizationId)
      .in("id", contatoIds);
    const contatoPorId = new Map(
      ((contatos ?? []) as Array<{
        id: string;
        display_name: string | null;
        name: string | null;
        phone_number: string | null;
      }>).map((c) => [c.id, c]),
    );

    const conversations = await Promise.all(
      esperando.map(async (c) => {
        const { data: msgs } = await ctx.supabase
          .from("messages")
          .select("conversation_id, direction, type, body, media_derived_text, sent_at")
          .eq("organization_id", ctx.organizationId)
          .eq("conversation_id", c.id)
          .is("revoked_at", null)
          .order("sent_at", { ascending: false })
          .limit(input.recent_messages);
        const contato = contatoPorId.get(c.contact_id);
        const esperaMin = Math.max(
          0,
          Math.round((Date.now() - Date.parse(c.last_inbound_at as string)) / 60000),
        );
        return {
          conversation_id: c.id,
          contact_name: contato?.display_name ?? contato?.name ?? null,
          contact_phone: contato?.phone_number ?? null,
          waiting_since: c.last_inbound_at,
          minutes_waiting: esperaMin,
          owned_by_human: c.assignee_kind === "user" ? c.assigned_to_user_name : null,
          recent_messages: ((msgs ?? []) as MensagemRow[]).reverse().map((m) => ({
            from: m.direction === "inbound" ? "cliente" : "empresa",
            type: m.type,
            text: m.body ?? m.media_derived_text ?? null,
            sent_at: m.sent_at,
          })),
        };
      }),
    );

    return { ia_interna_no_ar: iaInternaNoAr, conversations };
  },
};
