import type { sendEmail } from "@/lib/email/resend";
import type { createAdminClient } from "@/lib/supabase/admin";

export async function reivindicarEnvio(
  admin: ReturnType<typeof createAdminClient>,
  pedido: {
    leadId: string;
    mensagem: string;
    assunto: string;
    marketing: boolean;
    campanha?: string;
  },
): Promise<string | null> {
  const { data, error } = await admin.rpc("fn_claim_marketing_envio", {
    p_lead_id: pedido.leadId,
    p_mensagem: pedido.mensagem,
    p_assunto: pedido.assunto,
    p_marketing: pedido.marketing,
    ...(pedido.campanha ? { p_campanha: pedido.campanha } : {}),
  });
  return error ? null : data;
}

export async function registrarResultadoEnvio(
  admin: ReturnType<typeof createAdminClient>,
  envioId: string,
  resultado: Awaited<ReturnType<typeof sendEmail>>,
): Promise<boolean> {
  if (!resultado.ok) {
    // Rede/timeout é resultado desconhecido: permanece agendado e NÃO reenvia.
    const conhecido = resultado.error === "rate_limited";
    await admin
      .from("email_envios")
      .update({
        status: conhecido ? "falhou" : "agendado",
        erro: `${resultado.error ?? "resultado_desconhecido"}: ${resultado.details ?? ""}`.trim(),
      })
      .eq("id", envioId);
    return false;
  }
  const { error } = await admin
    .from("email_envios")
    .update({
      status: "enviado",
      provider_id: resultado.id ?? null,
      enviado_em: new Date().toISOString(),
      erro: null,
    })
    .eq("id", envioId);
  return !error;
}
