import {
  automacoesPadrao,
  automacaoSchema,
  type Automacao,
  type AutomacaoId,
} from "@/lib/marketing/automacoes-catalogo";
import { createAdminClient } from "@/lib/supabase/admin";

/** Chamadores HTTP autenticam ANTES deste acesso global de serviço. */
export async function lerAutomacoes(): Promise<{ automacoes: Automacao[]; semBanco: boolean }> {
  const padrao = automacoesPadrao();
  try {
    const { data, error } = await createAdminClient()
      .from("marketing_automacoes")
      .select("id, enabled, audience, starts_at, ends_at, textos");
    if (error) return { automacoes: padrao, semBanco: true };
    const validos = (data ?? []).flatMap((row) => {
      const parsed = automacaoSchema.safeParse(row);
      return parsed.success ? [parsed.data] : [];
    });
    return {
      automacoes: padrao.map(
        (a) =>
          validos.find((v) => v.id === a.id) ??
          (data?.some((row) => row.id === a.id) ? { ...a, enabled: false } : a),
      ),
      semBanco: false,
    };
  } catch {
    return { automacoes: padrao, semBanco: true };
  }
}

export async function lerAutomacao(id: AutomacaoId): Promise<Automacao | null> {
  const result = await lerAutomacoes();
  // Migration ausente/configuração malformada: nova campanha não tem permissão.
  if (result.semBanco) return null;
  return result.automacoes.find((a) => a.id === id) ?? null;
}
