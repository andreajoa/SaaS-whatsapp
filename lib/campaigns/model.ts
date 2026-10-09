import { z } from "zod";
import { deriveTemplateContract, describeAddress } from "@/lib/channels/meta/template-contract";
import { buildComponents, missingSlots, slotKey } from "@/lib/channels/meta/build-components";
import { renderTemplateBody } from "@/lib/channels/meta/render-template";

export const campaignInputSchema = z.object({
  name: z.string().trim().min(1).max(120),
  channel_session_id: z.string().uuid(),
  template_id: z.string().uuid(),
  template_values: z.record(z.string(), z.string().trim().min(1).max(4096)).default({}),
  contact_ids: z.array(z.string().uuid()).min(1).max(500),
  delay_seconds: z.number().int().min(5).max(3600).default(5),
}).strict();
export type CampaignInput = z.infer<typeof campaignInputSchema>;
export const previewInputSchema = campaignInputSchema.omit({ name: true, delay_seconds: true });
export const actionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("launch"), confirm: z.literal(true), scheduled_at: z.iso.datetime({ offset: true }).optional() }).strict(),
  z.object({ action: z.enum(["pause", "resume", "cancel"]) }).strict(),
  z.object({ action: z.literal("retry"), recipient_id: z.string().uuid(), confirm: z.literal(true) }).strict(),
  z.object({ action: z.literal("resolve_review"), recipient_id: z.string().uuid(), resolution: z.literal("skip"), confirm: z.literal(true) }).strict(),
]);
export type CampaignAction = z.infer<typeof actionSchema>;
export interface TemplateSnapshot {
  id: string; name: string; language: string; status: string; contract_hash: string;
  parameter_format: string; components: Parameters<typeof deriveTemplateContract>[0]["components"];
}
export interface AudienceContact {
  id: string; name: string | null; display_name: string | null; phone_number: string | null;
  is_blocked: boolean; is_anonymized: boolean; consent: unknown;
  conversation_id: string | null; conversation_status: string | null;
}
export function audienceExclusion(c: AudienceContact): string | null {
  if (c.is_blocked) return "Contato bloqueado";
  if (c.is_anonymized) return "Contato anonimizado";
  const consent = c.consent as { marketing?: { granted_at?: unknown; declined_at?: unknown } } | null;
  if (consent?.marketing?.declined_at) return "Consentimento revogado";
  const granted = consent?.marketing?.granted_at;
  if (typeof granted !== "string" || !Number.isFinite(Date.parse(granted))) return "Sem opt-in de marketing";
  if (!c.phone_number) return "Contato sem telefone";
  if (!c.conversation_id) return "Sem conversa neste canal";
  if (["closed", "resolved", "archived"].includes(c.conversation_status ?? "")) return "Conversa encerrada";
  return null;
}
export function templateContract(t: TemplateSnapshot) {
  return deriveTemplateContract({ ...t, parameter_format: t.parameter_format });
}
export function templateFields(t: TemplateSnapshot) {
  return templateContract(t).slots.map(s => ({ key: slotKey(s.address, s.key), expects: s.expects,
    label: `${describeAddress(s.address)} · ${s.contextBefore} {{${s.key}}} ${s.contextAfter}` }));
}
export type TemplateParameterSupport = "components" | "body-positional";
export function validateTemplate(t: TemplateSnapshot, values: Record<string, string>, support: TemplateParameterSupport = "components") {
  if (t.status !== "APPROVED") throw new Error("O modelo precisa estar aprovado.");
  // Escopo limitado a templates simples: o renderer canônico não renderiza cards.
  if (t.components?.some(c => String(c.type).toUpperCase() === "CAROUSEL"))
    throw new Error("Campanhas ainda não aceitam modelos de carrossel.");
  const contract = templateContract(t);
  if (support === "body-positional" && contract.parameterFormat !== "POSITIONAL")
    throw new Error("Este canal aceita somente parâmetros posicionais no corpo. Escolha um modelo com {{1}}, {{2}} ou use um canal que envie componentes completos.");
  if (support === "body-positional" && contract.slots.some(s => s.address.kind !== "body" || s.expects !== "text" || !/^\d+$/.test(s.key)))
    throw new Error("Este canal aceita somente parâmetros de texto no corpo. Escolha um modelo sem parâmetros no cabeçalho ou nos botões.");
  const keys = new Set(contract.slots.map(s => slotKey(s.address, s.key)));
  if (Object.keys(values).some(key => !keys.has(key))) throw new Error("Parâmetro fora do contrato aprovado.");
  if (missingSlots(contract, values).length) throw new Error("Preencha todos os parâmetros do modelo.");
  buildComponents(contract, values);
  // O renderer legado chaveia HEADER/BODY pelo placeholder. Barrar colisões que
  // renderizariam texto diferente do payload; não criar um segundo renderer.
  const byKey = new Map<string, string>();
  for (const s of contract.slots) {
    const value = values[slotKey(s.address, s.key)]!;
    if (byKey.has(s.key) && byKey.get(s.key) !== value) throw new Error("Este modelo usa a mesma variável com valores diferentes; escolha outro modelo.");
    byKey.set(s.key, value);
  }
  const body = renderTemplateBody(t.components, values, { name: t.name, language: t.language, parameterFormat: t.parameter_format });
  if (!body.trim() || body.length > 4096) throw new Error("O texto do modelo não pode ser usado nesta campanha.");
  return body;
}
export function nextCampaignState(current: string, action: "launch" | "pause" | "resume" | "cancel", scheduled = false) {
  if (action === "launch" && current === "draft") return scheduled ? "scheduled" : "running";
  if (action === "pause" && ["scheduled", "running"].includes(current)) return "paused";
  if (action === "resume" && current === "paused") return "running";
  if (action === "cancel" && ["draft", "scheduled", "running", "paused"].includes(current)) return "cancelled";
  throw new Error("Transição de campanha não permitida.");
}
