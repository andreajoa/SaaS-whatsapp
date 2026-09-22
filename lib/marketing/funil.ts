/**
 * O FUNIL DO SITE VISTO DE DENTRO — quem tentou pagar, quem pagou.
 *
 * ─── Por que `checkout_tentativas` não é derivável do Stripe ───────────────
 *
 * A pergunta "quem abriu o pagamento e não terminou" não tem resposta no
 * Stripe: uma sessão aberta e abandonada não gera evento nenhum — ela expira
 * calada 24 h depois, e `checkout.session.expired` só existe para sessões que
 * o Stripe decide expirar, o que não cobre quem fechou a aba no minuto
 * seguinte. Quem quiser mandar "você parou no meio" precisa ter ANOTADO a
 * abertura, e é isso que a tabela é.
 *
 * ─── Por que pagar ENCERRA a sequência de propaganda ───────────────────────
 *
 * Quem assinou não pode continuar recebendo "o que é o Atenza" e "quanto
 * custa": é a propaganda mais cara que existe, porque ela conta a quem JÁ
 * pagou que ninguém do outro lado sabe que ele pagou.
 *
 * A forma de encerrar é mover o cursor para o fim da série, e não inventar um
 * status novo. `site_leads.status` tem CHECK com cinco valores — `inscrito`,
 * `confirmado`, `descadastrado`, `bounce`, `reclamou` — e nenhum deles é
 * "cliente". Acrescentar um sexto custaria uma migration, um apêndice no
 * baseline e uma constraint que o `update.sh` de todo clone teria de aplicar,
 * para descrever um estado que o cursor já descreve com precisão: `proximo_passo
 * = MENSAGENS.length` quer dizer "não há próxima mensagem", que é literalmente
 * verdade para quem assinou. A consulta do cron já filtra por ele.
 *
 * O `assinou_em` e o `plano` ficam gravados ao lado porque o cursor diz que a
 * série acabou, não POR QUE acabou — e a diferença entre "assinou" e "chegou
 * ao fim dos 45 dias" é a única coisa que o painel realmente quer saber.
 */
import { logger } from "@/lib/logger";
import { MENSAGENS } from "@/lib/marketing/sequencia";
import { normalizarEmail } from "@/lib/marketing/lead";
import { createAdminClient } from "@/lib/supabase/admin";

function admin(): ReturnType<typeof createAdminClient> | null {
  try {
    return createAdminClient();
  } catch {
    return null;
  }
}

export interface TentativaDeCheckout {
  readonly sessionId: string;
  readonly organizationId?: string | null;
  readonly email?: string | null;
  readonly plano?: string | null;
  readonly moeda?: string | null;
  readonly valorCents?: number | null;
}

/**
 * Anota que alguém ABRIU o pagamento.
 *
 * Nunca lança e nunca é esperada por quem chama: uma falha ao anotar não pode
 * impedir o checkout de abrir. O pior caso é não mandar um e-mail de carrinho
 * largado; o pior caso do contrário é não vender.
 */
export async function registrarTentativa(t: TentativaDeCheckout): Promise<void> {
  const cliente = admin();
  if (!cliente) return;

  const email = t.email ? normalizarEmail(t.email) : null;
  const { data: lead } = email
    ? await cliente.from("site_leads").select("id").eq("email", email).maybeSingle()
    : { data: null };

  const { error } = await cliente.from("checkout_tentativas").insert({
    stripe_session_id: t.sessionId,
    organization_id: t.organizationId ?? null,
    lead_id: (lead?.id as string | undefined) ?? null,
    email,
    plano: t.plano ?? null,
    moeda: t.moeda ?? null,
    valor_cents: t.valorCents ?? null,
    status: "aberto",
  });

  // `23505` é a mesma sessão anotada duas vezes (duplo-clique reaproveita a
  // sessão do Stripe pela chave de idempotência). Não é erro.
  if (error && (error as { code?: string }).code !== "23505") {
    logger.warn("[funil] não anotou a tentativa", { erro: error.message, sessao: t.sessionId });
  }
}

/** A sessão virou assinatura. Fecha a tentativa para o varredor não a cobrar. */
export async function concluirTentativa(sessionId: string): Promise<void> {
  const cliente = admin();
  if (!cliente) return;
  await cliente
    .from("checkout_tentativas")
    .update({ status: "concluido", concluido_em: new Date().toISOString() })
    .eq("stripe_session_id", sessionId);
}

export interface Assinatura {
  readonly email: string;
  readonly plano?: string | null;
  readonly organizationId?: string | null;
}

/**
 * Registra a conversão e ENCERRA a propaganda para esta pessoa.
 *
 * Não cria lead: quem assinou sem nunca ter passado pelo site simplesmente não
 * está no funil, e inventar a linha aqui só para marcá-la como convertida
 * encheria `site_leads` de gente que nunca foi lead. Quem cria a linha quando
 * ela falta é o disparo do "assinatura ativa", que precisa dela para ter a
 * quem mandar.
 */
export async function marcarAssinatura(a: Assinatura): Promise<void> {
  const cliente = admin();
  if (!cliente) return;

  const email = normalizarEmail(a.email);
  if (!email) return;

  const { data: lead } = await cliente
    .from("site_leads")
    .select("id, assinou_em")
    .eq("email", email)
    .maybeSingle();
  if (!lead) return;

  const campos: Record<string, unknown> = {
    plano: a.plano ?? null,
    proximo_passo: MENSAGENS.length,
  };
  if (a.organizationId) campos.organization_id = a.organizationId;
  // A PRIMEIRA assinatura é a que data a conversão. Uma renovação meses depois
  // não pode reescrever o dia em que a pessoa virou cliente — é esse intervalo
  // que responde "quanto tempo a lista leva para converter".
  if (!lead.assinou_em) campos.assinou_em = new Date().toISOString();

  await cliente.from("site_leads").update(campos).eq("id", lead.id);
}
