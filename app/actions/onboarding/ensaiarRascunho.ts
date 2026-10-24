"use server";

/**
 * O ENSAIO DE QUEM AINDA NÃO TEM NÚMERO.
 *
 * O ensaio normal (`/api/v1/ai/agents/:id/versions/:vid/test`) roda o runtime
 * real sobre a versão publicada — e versão exige canal. Com o WhatsApp no fim do
 * onboarding, a conta nova chegava em "Ver ele atender" com o funcionário em
 * rascunho e a tela dizia que não havia o que ensaiar: justamente quem mais
 * precisava ver a IA respondendo antes de enfrentar a Meta não via nada.
 *
 * Aqui a mesma instrução do funcionário (`ai_agents.system_prompt`) responde com
 * o cérebro que a versão vai usar (`cerebroDoRascunho`). Sem ferramentas: criar
 * lead e mover cartão dependem do canal, e a tela diz isso.
 */
import { generateText } from "ai";

import { buildModel } from "@/lib/ai/runtime/agent";
import { createAdminClient } from "@/lib/supabase/admin";
import { cerebroDoRascunho } from "@/lib/onboarding/cerebro-do-rascunho";
import { requireOnboardingCtx } from "./_shared";

export type DesfechoDoRascunho = { ok: true; texto: string } | { ok: false; erro: string };

/** O mesmo teto do campo da tela: mensagem de cliente, não um documento. */
const LIMITE_DA_MENSAGEM = 4000;

export async function ensaiarRascunho(mensagem: string): Promise<DesfechoDoRascunho> {
  const ctx = await requireOnboardingCtx();
  const texto = String(mensagem ?? "").trim().slice(0, LIMITE_DA_MENSAGEM);
  if (!texto) return { ok: false, erro: "escreva uma mensagem para ele responder" };

  const admin = createAdminClient();
  const { data: agente } = await admin
    .from("ai_agents")
    .select("system_prompt")
    .eq("organization_id", ctx.orgId)
    .eq("is_default", true)
    .maybeSingle();
  if (!agente) return { ok: false, erro: "você ainda não montou seu funcionário" };

  const cerebro = await cerebroDoRascunho(admin, ctx.orgId);
  if ("erro" in cerebro) return { ok: false, erro: cerebro.erro };

  try {
    const r = await generateText({
      model: buildModel(cerebro.provider, cerebro.apiKey, cerebro.model),
      system: (agente.system_prompt as string | null) ?? "",
      prompt: texto,
      // Uma resposta de WhatsApp. O teto protege a chave da instalação de quem
      // resolver pedir um texto longo no ensaio.
      maxOutputTokens: 600,
    });
    const resposta = r.text.trim();
    return resposta
      ? { ok: true, texto: resposta }
      : { ok: false, erro: "ele executou, mas não devolveu texto nenhum" };
  } catch (err) {
    return { ok: false, erro: err instanceof Error ? err.message : String(err) };
  }
}
