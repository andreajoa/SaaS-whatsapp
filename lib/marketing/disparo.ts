/**
 * O DISPARO DE UM E-MAIL QUE RESPONDE A UM ATO — e a chave que o repete.
 *
 * ─── Por que isto não mora no cron ─────────────────────────────────────────
 *
 * A sequência de propaganda tem UM chamador (o cron de :37). Os cinco avisos
 * têm TRÊS, e nenhum deles é um cron: o webhook do Stripe (assinatura ativa,
 * cartão recusado), a inscrição no site (boas-vindas) e a varredura de
 * checkout largado. Copiar a ordem "grava, manda, marca" em três lugares é
 * copiar TAMBÉM o jeito de errá-la — e o erro aqui não aparece como exceção,
 * aparece como e-mail em dobro na caixa de quem paga.
 *
 * ─── A diferença que obrigou este arquivo a existir ────────────────────────
 *
 * Na sequência, `unique (lead_id, mensagem)` quer dizer "este passo sai UMA
 * vez na vida", e é exatamente o certo: ninguém recebe "o que é o Atenza" duas
 * vezes.
 *
 * Nos avisos, a MESMA regra está errada, e erra em silêncio. O cartão de
 * alguém pode ser recusado em março e outra vez em julho; a pessoa pode largar
 * o checkout hoje e voltar a largar semana que vem. Gravando `mensagem =
 * "pagamento-falhou"`, o índice único barra o segundo aviso PARA SEMPRE — e o
 * modo de falha é o pior que existe: ninguém vê erro, o Stripe cancela a
 * assinatura no fim das retentativas, e a pessoa perde o acesso sem nunca ter
 * sido avisada. Um índice que protege virou um índice que esconde.
 *
 * A saída não é abrir mão do índice — é dar a ele a CHAVE CERTA. Quando o
 * evento se repete, quem chama passa `chave` com o id do fato no Stripe (a
 * fatura, a sessão de checkout), e o que vai para o banco é
 * `pagamento-falhou#in_1PabcXYZ`. Aí o índice diz o que se quer que ele diga:
 * **uma vez por fatura**, não uma vez por pessoa. Duas entregas do mesmo
 * webhook — que o Stripe faz de propósito — colidem e a segunda não manda
 * nada; uma fatura nova em julho é outra chave e o aviso sai.
 *
 * Quem lê `email_envios.mensagem` depois (o painel) separa com
 * `idBaseDaMensagem()`, e é por isso que o separador é `#`: nenhum id da série
 * o contém, então a divisão nunca é ambígua.
 *
 * ─── Descadastro não cala aviso de cobrança ────────────────────────────────
 *
 * Quem saiu da lista não recebe propaganda — isso é lei e está checado aqui.
 * Mas "seu cartão foi recusado" não é propaganda, e silenciá-lo por causa de
 * um descadastro faria alguém perder o acesso que pagou por ter clicado, meses
 * antes, num link que prometia parar a PROPAGANDA. Por isso a consulta do
 * descadastro só acontece no ramo de propaganda, e o outro ramo nem a faz.
 */
import { marcaDaSaida } from "@/lib/branding/saida";
import { sendEmail } from "@/lib/email/resend";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { normalizarEmail, registrarLead, type OrigemDoLead } from "@/lib/marketing/lead";
import { montarEmail, montarEmailTransacional } from "@/lib/marketing/molde";
import { transacionalPorId } from "@/lib/marketing/transacionais";
import { ehIdiomaDoSite, IDIOMA_DO_SITE_PADRAO } from "@/lib/mercado/paises";
import { createAdminClient } from "@/lib/supabase/admin";

/** O que separa o id do aviso da chave do fato que o provocou. */
const SEPARADOR = "#";

/**
 * O id do aviso, sem a chave.
 *
 * `"pagamento-falhou#in_1Pabc"` → `"pagamento-falhou"`. Quem mostra o histórico
 * precisa do nome da mensagem, não do número da fatura; e um `mensagem` da
 * sequência, que nunca tem chave, atravessa isto intacto.
 */
export function idBaseDaMensagem(mensagem: string): string {
  const corte = mensagem.indexOf(SEPARADOR);
  return corte === -1 ? mensagem : mensagem.slice(0, corte);
}

export type ResultadoDoDisparo =
  | { readonly tipo: "enviado"; readonly envioId: string }
  /** O índice único barrou: este aviso já saiu para este fato. */
  | { readonly tipo: "ja_enviado" }
  /** Instalação sem Resend. Não é erro — é self-host. */
  | { readonly tipo: "sem_email" }
  /** Propaganda para quem pediu para sair. Não sai, e isso é o certo. */
  | { readonly tipo: "descadastrado" }
  | { readonly tipo: "sem_lead" }
  | { readonly tipo: "falhou"; readonly erro: string };

export interface PedidoDeDisparo {
  /** Para quem. Normalizado aqui — o índice de `site_leads` é `lower(email)`. */
  readonly email: string;
  /** O id em `TRANSACIONAIS`. */
  readonly transacionalId: string;
  /**
   * O fato que provocou o aviso, quando ele PODE se repetir: o id da fatura,
   * o da sessão de checkout. Sem ela, o aviso sai uma vez na vida da pessoa —
   * que é o certo para `boas-vindas` e errado para todos os outros.
   */
  readonly chave?: string | null;
  readonly nome?: string | null;
  readonly idioma?: string | null;
  readonly moeda?: string | null;
  /** Como a pessoa entrou, se esta for a primeira vez que a vemos. */
  readonly origem?: OrigemDoLead;
}

export async function dispararTransacional(pedido: PedidoDeDisparo): Promise<ResultadoDoDisparo> {
  const aviso = transacionalPorId(pedido.transacionalId);
  if (!aviso)
    return { tipo: "falhou", erro: `transacional desconhecido: ${pedido.transacionalId}` };

  // Mesma porta do cron: sem remetente não há o que tentar, e tentar deixaria
  // uma linha `falhou` por trás para uma rodada futura reprocessar.
  if (!env.RESEND_API_KEY || env.RESEND_FROM_EMAIL.trim().length === 0) {
    return { tipo: "sem_email" };
  }

  const email = normalizarEmail(pedido.email);
  if (!email) return { tipo: "sem_lead" };

  let admin: ReturnType<typeof createAdminClient>;
  try {
    admin = createAdminClient();
  } catch {
    return { tipo: "sem_lead" };
  }

  // Quem paga pode nunca ter passado pelo pop-up. A linha em `site_leads` é o
  // que dá a ele um `token_descadastro` e um lugar no funil do painel — e
  // `registrarLead` já sabe não reiniciar a sequência de quem é conhecido.
  const lead = await acharOuCriarLead(admin, email, pedido);
  if (!lead) return { tipo: "sem_lead" };

  if (aviso.ehPropaganda && lead.descadastrado_em) return { tipo: "descadastrado" };

  const declarado = pedido.idioma ?? lead.idioma ?? "";
  const idioma = ehIdiomaDoSite(declarado) ? declarado : IDIOMA_DO_SITE_PADRAO;
  const conteudo = aviso.texto[idioma];
  const mensagem = pedido.chave ? `${aviso.id}${SEPARADOR}${pedido.chave}` : aviso.id;

  // ── 1. A linha ANTES do envio ───────────────────────────────────────────
  const { data: criado, error: erroInsert } = await admin
    .from("email_envios")
    .insert({
      lead_id: lead.id,
      mensagem,
      assunto: conteudo.assunto,
      status: "agendado",
      agendado_para: new Date().toISOString(),
    })
    .select("id")
    .maybeSingle();

  let envioId = criado?.id as string | undefined;

  if (erroInsert) {
    if ((erroInsert as { code?: string }).code !== "23505") {
      logger.error("[disparo] insert falhou", {
        erro: erroInsert.message,
        lead: lead.id,
        mensagem,
      });
      return { tipo: "falhou", erro: erroInsert.message };
    }
    // Já existe linha para (lead, este fato). Ou o aviso saiu — e a segunda
    // entrega do webhook não deve mandar nada —, ou falhou, e a retentativa é
    // devida na MESMA linha.
    const { data: existente } = await admin
      .from("email_envios")
      .select("id, status")
      .eq("lead_id", lead.id)
      .eq("mensagem", mensagem)
      .maybeSingle();

    if (!existente || existente.status !== "falhou") return { tipo: "ja_enviado" };
    envioId = existente.id as string;
  }

  if (!envioId) return { tipo: "falhou", erro: "sem id de envio" };

  // ── 2. O envio ──────────────────────────────────────────────────────────
  const marca = await marcaDaSaida(null);
  const montado = aviso.ehPropaganda
    ? montarEmail(conteudo.corpo, idioma, lead.token_descadastro, marca.nome)
    : montarEmailTransacional(conteudo.corpo, idioma, marca.nome);

  const resultado = await sendEmail({
    to: email,
    subject: conteudo.assunto,
    html: montado.html,
    text: montado.text,
    headers: montado.headers,
    fromName: marca.nome,
    tags: [{ name: "transacional", value: aviso.id }],
  });

  if (!resultado.ok) {
    await admin
      .from("email_envios")
      .update({ status: "falhou", erro: `${resultado.error}: ${resultado.details ?? ""}`.trim() })
      .eq("id", envioId);
    logger.warn("[disparo] envio falhou", { erro: resultado.error, lead: lead.id, mensagem });
    return { tipo: "falhou", erro: resultado.error ?? "envio recusado" };
  }

  const quando = new Date().toISOString();
  await admin
    .from("email_envios")
    .update({
      status: "enviado",
      provider_id: resultado.id ?? null,
      enviado_em: quando,
      erro: null,
    })
    .eq("id", envioId);

  // O relógio dos 20 h é da PESSOA, não do canal.
  //
  // Sem esta linha, alguém que se inscreve às 14h recebe "bem-vindo" na hora e
  // o passo 0 da sequência na batida das :37 — dois e-mails do mesmo remetente
  // dentro da mesma hora, que é a assinatura de spam que o Gmail conhece
  // melhor. O cron lê `ultimo_envio_em` para se espaçar; escrevê-lo aqui faz
  // ele se espaçar TAMBÉM do que não saiu por ele. Vale para o aviso de
  // cobrança pelo mesmo motivo: adiar uma propaganda porque o cartão de alguém
  // falhou é o lado certo de errar.
  await admin.from("site_leads").update({ ultimo_envio_em: quando }).eq("id", lead.id);

  return { tipo: "enviado", envioId };
}

interface LeadDoDisparo {
  readonly id: string;
  readonly token_descadastro: string;
  readonly idioma: string | null;
  readonly descadastrado_em: string | null;
}

/**
 * O lead, criando-o se for a primeira vez.
 *
 * A busca vem PRIMEIRO e é feita mesmo quando `registrarLead` acabou de dizer
 * "conhecido": o que ele devolve é um id, e aqui é preciso o
 * `token_descadastro` e o estado do descadastro, que só a linha tem.
 */
async function acharOuCriarLead(
  admin: ReturnType<typeof createAdminClient>,
  email: string,
  pedido: PedidoDeDisparo,
): Promise<LeadDoDisparo | null> {
  const buscar = async (): Promise<LeadDoDisparo | null> => {
    const { data } = await admin
      .from("site_leads")
      .select("id, token_descadastro, idioma, descadastrado_em")
      .eq("email", email)
      .maybeSingle();
    return (data as LeadDoDisparo | null) ?? null;
  };

  const achado = await buscar();
  if (achado) return achado;

  const registro = await registrarLead({
    email,
    nome: pedido.nome ?? null,
    origem: pedido.origem ?? "checkout",
    idioma: pedido.idioma ?? null,
    moeda: pedido.moeda ?? null,
  });
  if (registro.tipo === "sem_banco") return null;

  return buscar();
}
