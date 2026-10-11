import { z } from "zod";

import { dispararTransacional, idBaseDaMensagem } from "@/lib/marketing/disparo";
import { createAdminClient } from "@/lib/supabase/admin";

const filaSchema = z.array(
  z.object({
    mensagem: z.string(),
    site_leads: z.object({ email: z.string().email(), idioma: z.string().nullable() }).nullable(),
  }),
);
/** Recupera somente uma recusa 429 conhecida. Não abre retry de resultado ambíguo. */
export async function retentarAvisosDeCobranca(agora: Date, teto: number) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("email_envios")
    .select("mensagem,site_leads(email,idioma)")
    .eq("status", "falhou")
    .like("erro", "rate_limited:%")
    .like("mensagem", "pagamento-%#%")
    .lt("tentativas", 3)
    .gt("created_at", new Date(agora.getTime() - 23 * 3600000).toISOString())
    .lte("ultima_tentativa_em", new Date(agora.getTime() - 10 * 60000).toISOString())
    .order("created_at", { ascending: true })
    .limit(teto);
  const parsed = filaSchema.safeParse(data);
  if (error || !parsed.success) return { tentados: 0, enviados: 0, falhas: 0 };
  let tentados = 0,
    enviados = 0,
    falhas = 0;
  for (const row of parsed.data) {
    if (!row.site_leads) continue;
    const id = idBaseDaMensagem(row.mensagem);
    if (id !== "pagamento-falhou" && id !== "pagamento-recebido") continue;
    const result = await dispararTransacional({
      email: row.site_leads.email,
      idioma: row.site_leads.idioma,
      transacionalId: id,
      chave: row.mensagem.slice(id.length + 1),
    });
    if (result.tipo !== "enviado" && result.tipo !== "falhou") continue;
    tentados++;
    if (result.tipo === "enviado") enviados++;
    else falhas++;
    await new Promise((resolve) => setTimeout(resolve, 600));
  }
  return { tentados, enviados, falhas };
}
