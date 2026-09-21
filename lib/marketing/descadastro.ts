import { createAdminClient } from "@/lib/supabase/admin";
import { env } from "@/lib/env";

/**
 * A SAÍDA DA LISTA — escrita ANTES do primeiro e-mail, e não depois.
 *
 * ─── Por que esta peça vem primeiro ────────────────────────────────────────
 *
 * Uma sequência de quinze e-mails sem porta de saída não é uma campanha com um
 * defeito: é spam, pela definição que o Gmail usa. Quem não acha o link de
 * descadastro clica em "marcar como spam", e isso não atinge o e-mail — atinge
 * o DOMÍNIO, para sempre e para todos os destinatários seguintes. Reputação
 * queimada não volta com um deploy. Por isso este arquivo existe antes de
 * qualquer texto de propaganda estar escrito.
 *
 * ─── Por que sair NUNCA acontece num GET ───────────────────────────────────
 *
 * O link do rodapé é visitado por gente, e também por três programas que
 * ninguém convidou: o antivírus do provedor, a pré-visualização de link e o
 * robô de segurança corporativo. Os três seguem TODO `GET` do e-mail, antes de
 * a pessoa abrir. Um `/descadastrar/<token>` que desse baixa no próprio GET
 * esvaziaria a lista sozinho, e o log diria que cada um deles pediu para sair.
 *
 * Então: o GET só MOSTRA, e a baixa acontece num POST. A porta de uma linha do
 * Gmail (o "Cancelar inscrição" nativo, RFC 8058) também é POST — é por isso
 * que ela é segura, e é por isso que ela é a mesma rota.
 *
 * ─── Por que o token não é o e-mail, nem um hash dele ──────────────────────
 *
 * `token_descadastro` é aleatório e tem índice único próprio. Derivá-lo do
 * e-mail deixaria qualquer pessoa descadastrar qualquer outra só por saber o
 * endereço — e uma URL que carrega o endereço legível vaza quem está na lista
 * para todo log de proxy por onde ela passar.
 */

export type ResultadoDoDescadastro =
  /** Saiu agora, ou já estava fora. Os dois são sucesso para quem clicou. */
  | { readonly tipo: "fora" }
  /** Token que não existe. Link velho, link truncado pelo cliente de e-mail. */
  | { readonly tipo: "nao_encontrado" }
  | { readonly tipo: "sem_banco" };

/** O token cabe na URL e nada mais: 32 hex do `uuid` sem hífen (migration 0240). */
const FORMATO_DO_TOKEN = /^[a-f0-9]{16,64}$/i;

export function urlDeDescadastro(token: string): string {
  return `${env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "")}/descadastrar/${encodeURIComponent(token)}`;
}

/**
 * O endereço que o cabeçalho `List-Unsubscribe` anuncia ao Gmail.
 *
 * Separado da URL humana de propósito: esta recebe POST e não desenha nada;
 * aquela recebe GET e não muda nada. Uma só URL para os dois papéis obrigaria
 * a decidir pelo método, e um dia alguém trocaria o método sem perceber o que
 * estava trocando junto.
 */
export function urlDeDescadastroUmClique(token: string): string {
  return `${env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "")}/api/v1/site/descadastrar?t=${encodeURIComponent(token)}`;
}

/**
 * Os dois cabeçalhos que fazem o Gmail desenhar o botão nativo de saída.
 *
 * Ter o botão nativo é o que evita o clique em "marcar como spam": quando sair
 * é mais fácil que reclamar, a pessoa sai — e sair não machuca o domínio.
 *
 * O `mailto:` entra junto porque cliente antigo não implementa a versão de um
 * clique e só sabe responder por e-mail. Sem ele, quem usa esses clientes fica
 * sem saída nenhuma no cabeçalho.
 */
export function cabecalhosDeDescadastro(token: string): Record<string, string> {
  const suporte = env.SUPPORT_EMAIL.trim();
  const url = `<${urlDeDescadastroUmClique(token)}>`;
  return {
    "List-Unsubscribe": suporte ? `<mailto:${suporte}?subject=unsubscribe>, ${url}` : url,
    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
  };
}

/**
 * Dá baixa. Idempotente: quem já saiu recebe `fora` de novo, sem segundo UPDATE.
 *
 * `status` e `descadastrado_em` andam juntos — um sem o outro deixaria a pessoa
 * invisível para uma consulta e visível para a outra, e a consulta que a
 * enxergasse é a que manda e-mail.
 */
export async function descadastrarPorToken(token: string): Promise<ResultadoDoDescadastro> {
  const limpo = token.trim();
  // Formato errado nem chega ao banco: é link truncado ou varredura, e uma
  // consulta por requisição dessas é superfície que não precisa existir.
  if (!FORMATO_DO_TOKEN.test(limpo)) return { tipo: "nao_encontrado" };

  let admin: ReturnType<typeof createAdminClient>;
  try {
    admin = createAdminClient();
  } catch {
    return { tipo: "sem_banco" };
  }

  const { data: lead, error } = await admin
    .from("site_leads")
    .select("id, descadastrado_em")
    .eq("token_descadastro", limpo)
    .maybeSingle();

  if (error) return { tipo: "sem_banco" };
  if (!lead) return { tipo: "nao_encontrado" };
  if (lead.descadastrado_em) return { tipo: "fora" };

  const { error: erroUpdate } = await admin
    .from("site_leads")
    .update({ status: "descadastrado", descadastrado_em: new Date().toISOString() })
    .eq("id", lead.id as string);

  // Falha de escrita NÃO pode virar "pronto, você saiu": a pessoa fecharia a
  // aba achando que saiu e receberia o próximo e-mail na semana seguinte. Aí
  // ela não clica em sair de novo — clica em spam.
  if (erroUpdate) return { tipo: "sem_banco" };

  return { tipo: "fora" };
}
