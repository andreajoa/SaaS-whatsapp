"use server";

import { cookies, headers } from "next/headers";
import { revalidatePath } from "next/cache";

import { audit } from "@/lib/audit";
import { marcaDaSaida } from "@/lib/branding/saida";
import { env } from "@/lib/env";
import { automacaoSchema, type Automacao } from "@/lib/marketing/automacoes-catalogo";
import { lerAutomacoes } from "@/lib/marketing/automacoes";
import { montarEmail, montarEmailTransacional } from "@/lib/marketing/molde";
import { COOKIE_DO_PAINEL, cookieVale, painelHabilitado } from "@/lib/painel/sessao";
import { createAdminClient } from "@/lib/supabase/admin";

export type EstadoDoEditor = { ok: boolean; mensagem: string; preview?: string; saved?: Automacao };

export async function editarAutomacao(
  _anterior: EstadoDoEditor,
  form: FormData,
): Promise<EstadoDoEditor> {
  const jar = await cookies();
  if (!painelHabilitado() || !cookieVale(jar.get(COOKIE_DO_PAINEL)?.value))
    return { ok: false, mensagem: "Entre no painel novamente." };
  const hdrs = await headers();
  const origin = hdrs.get("origin");
  if (!origin || origin !== new URL(env.NEXT_PUBLIC_APP_URL).origin)
    return { ok: false, mensagem: "Origem da solicitação inválida." };
  const bruto = form.get("automacao");
  if (typeof bruto !== "string" || bruto.length > 60000)
    return { ok: false, mensagem: "Conteúdo inválido." };
  let input: unknown;
  try {
    input = JSON.parse(bruto);
  } catch {
    return { ok: false, mensagem: "Conteúdo inválido." };
  }
  const parsed = automacaoSchema.safeParse(input);
  if (!parsed.success)
    return { ok: false, mensagem: parsed.error.issues[0]?.message ?? "Confira os campos." };
  const mode = form.get("modo");
  if (!["preview", "salvar", "ativar", "pausar"].includes(String(mode)))
    return { ok: false, mensagem: "Ação inválida." };
  const campanha = parsed.data;
  if (mode === "preview") {
    const marca = await marcaDaSaida(null);
    const language = form.get("idioma");
    const idioma = language === "en" || language === "es" ? language : "pt-BR";
    const texto = campanha.textos[idioma];
    const montado =
      campanha.audience === "transacional"
        ? montarEmailTransacional(texto.corpo, idioma, marca.nome)
        : montarEmail(texto.corpo, idioma, "preview-sem-destinatario", marca.nome);
    return {
      ok: true,
      mensagem: "Prévia local. Nenhum e-mail foi enviado.",
      preview: montado.html,
    };
  }
  campanha.enabled = mode === "ativar";
  if (campanha.enabled && campanha.audience !== "transacional") {
    if (!campanha.ends_at || new Date(campanha.ends_at) <= new Date())
      return { ok: false, mensagem: "Esta janela terminou. Revise as datas antes de ativar." };
    const existentes = await lerAutomacoes();
    if (existentes.semBanco)
      return {
        ok: false,
        mensagem: "Não foi possível ler as automações. Confira a migration 0248.",
      };
    const sazonal = ["black-friday", "natal", "ano-novo"];
    if (
      sazonal.includes(campanha.id) &&
      existentes.automacoes.some(
        (a) =>
          a.id !== campanha.id &&
          sazonal.includes(a.id) &&
          a.enabled &&
          a.starts_at &&
          a.ends_at &&
          a.starts_at < campanha.ends_at! &&
          a.ends_at > campanha.starts_at!,
      )
    )
      return {
        ok: false,
        mensagem:
          "As janelas de Black Friday, Natal e Ano Novo devem ser consecutivas, sem sobreposição.",
      };
  }
  try {
    const { error } = await createAdminClient()
      .from("marketing_automacoes")
      .upsert(campanha, { onConflict: "id" });
    if (error)
      return {
        ok: false,
        mensagem: "Não foi possível salvar. Confira a migration 0248 e tente novamente.",
      };
    void audit({
      action: "marketing.automacao_updated",
      organizationId: null,
      bypassedRls: true,
      resourceType: "marketing_automacoes",
      metadata: { id: campanha.id, enabled: campanha.enabled, audience: campanha.audience },
      requestId: hdrs.get("x-request-id"),
    });
    revalidatePath("/dashboard/automacoes");
    return {
      ok: true,
      mensagem: campanha.enabled
        ? "Automação ativada. O próximo ciclo respeitará público e datas."
        : "Rascunho salvo. O envio está pausado.",
      saved: campanha,
    };
  } catch {
    return { ok: false, mensagem: "Não foi possível salvar. Tente novamente." };
  }
}
