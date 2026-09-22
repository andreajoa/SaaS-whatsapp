/**
 * GET/POST /api/v1/cron/marketing-sequencia — o disparo da sequência de 15.
 *
 * ─── O que ele NÃO faz, e por que é isso que o mantém correto ──────────────
 *
 * **Não manda a fila inteira.** No máximo UM passo por pessoa por rodada, e
 * no máximo `TETO_POR_RODADA` pessoas. Uma instalação que ficou dois dias fora
 * do ar não despeja seis e-mails na caixa de ninguém quando volta: despeja um,
 * e no dia seguinte o próximo. Seis e-mails do mesmo remetente no mesmo minuto
 * é a assinatura de spam que o Gmail conhece melhor — e o preço não é o
 * e-mail ir para a lixeira, é o DOMÍNIO ir junto, para todos os destinatários
 * seguintes.
 *
 * **Não pergunta antes de gravar.** A ordem é INSERT em `email_envios`,
 * DEPOIS Resend, DEPOIS avançar o cursor. O `unique (lead_id, mensagem)` é o
 * que torna isso seguro: duas rodadas concorrentes — ou uma que expirou
 * depois de o Resend aceitar e antes de gravar — colidem no índice em vez de
 * mandarem o mesmo e-mail duas vezes. `23505` não é erro aqui, é resposta.
 *
 * **Não avança o cursor quando o envio falha.** Um `rate_limited` é passageiro
 * e a mensagem tem de sair amanhã; avançar por cima dele apagaria um passo da
 * sequência em silêncio. A linha fica em `falhou`, e a rodada seguinte a
 * reconhece pelo status e tenta de novo na MESMA linha — o índice único
 * continua barrando o envio em dobro, e o registro do erro não se perde.
 *
 * ─── Por que o cursor é índice e a idempotência é o id de texto ────────────
 *
 * `site_leads.proximo_passo` é um inteiro: é barato de filtrar em SQL e é o
 * que faz o índice parcial de 0240 servir para alguma coisa. Mas ele é só um
 * PALPITE — quem decide o que já saiu é `email_envios.mensagem`, que guarda o
 * id estável (`"o-silencio-custa"`). Inserir uma mensagem no meio da série
 * desloca todos os índices; o id não desloca. Quando as duas leituras
 * discordam, o índice único ganha, e o cursor é corrigido sem mandar nada.
 *
 * ─── Por que ele é inofensivo numa VPS ─────────────────────────────────────
 *
 * `site_leads` existe no baseline, mas o funil público só tem gente onde a
 * instalação VENDE assinatura. No self-host a varredura devolve zero linhas,
 * não audita (rodada sem efeito não é mutação) e custa uma consulta. Sem
 * `RESEND_API_KEY` ele nem chega à consulta.
 */
import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";

import { fail, ok } from "@/lib/api/wrappers";
import { audit } from "@/lib/audit";
import { marcaDaSaida } from "@/lib/branding/saida";
import { sendEmail } from "@/lib/email/resend";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { montarEmail } from "@/lib/marketing/molde";
import { MENSAGENS, mensagemPorId } from "@/lib/marketing/sequencia";
import { ehIdiomaDoSite, IDIOMA_DO_SITE_PADRAO } from "@/lib/mercado/paises";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/**
 * Quantas pessoas recebem por rodada.
 *
 * Teto de tempo, não de política: a rodada roda numa função serverless com
 * limite de segundos, e trinta envios sequenciais com a pausa abaixo cabem
 * com folga. Na cadência de hora em hora isso é um teto de 720 e-mails por
 * dia, o que é muito mais do que a lista precisa antes de este número ter de
 * virar uma fila de verdade.
 */
const TETO_POR_RODADA = 30;

/**
 * Pausa entre envios.
 *
 * A Resend limita a 2 requisições por segundo na conta padrão, e estourar não
 * devolve fila: devolve 429, que aqui vira passo não-enviado. 600 ms deixa
 * margem para a latência variar sem encostar no limite.
 */
const PAUSA_MS = 600;

/**
 * A distância mínima entre dois e-mails para a MESMA pessoa.
 *
 * Vinte horas, e não vinte e quatro, porque o relógio que bate esta rota
 * atrasa (5 a 15 minutos é normal no agendador de graça). Com 24 h exatas, uma
 * rodada que chegasse atrasada empurraria o passo para o dia seguinte, e o
 * atraso se acumularia até a sequência de 45 dias virar uma de 60. Com 20 h, a
 * pessoa nunca recebe dois no mesmo dia e a série não escorrega.
 */
const INTERVALO_MINIMO_MS = 20 * 60 * 60 * 1000;

const DIA_MS = 24 * 60 * 60 * 1000;

interface LeadDaFila {
  id: string;
  email: string;
  idioma: string | null;
  created_at: string;
  proximo_passo: number;
  ultimo_envio_em: string | null;
  token_descadastro: string;
}

async function handle(req: NextRequest): Promise<Response> {
  const requestId = randomUUID();

  const auth = req.headers.get("authorization") ?? "";
  const provided = auth.startsWith("Bearer ") ? auth.slice("Bearer ".length).trim() : "";
  const aceitos = [env.INTERNAL_CRON_SECRET, env.INTERNAL_SECRET].filter(Boolean);
  if (aceitos.length === 0 || !provided || !aceitos.includes(provided)) {
    return fail("forbidden", "Cron secret missing or invalid.", 403, { requestId });
  }

  // Sem remetente não há o que tentar, e tentar seria pior que não tentar: o
  // INSERT em `email_envios` gravaria a linha, o envio falharia, e a rodada
  // seguinte encontraria a linha em `falhou` para reprocessar — quinze linhas
  // de lixo por lead numa instalação que nunca configurou e-mail.
  if (!env.RESEND_API_KEY || env.RESEND_FROM_EMAIL.trim().length === 0) {
    return ok({ varridos: 0, enviados: 0, motivo: "email_nao_configurado" }, { requestId });
  }

  const admin = createAdminClient();
  const agora = Date.now();
  const corteDoIntervalo = new Date(agora - INTERVALO_MINIMO_MS).toISOString();

  // O SQL corta o que é barato cortar — quem já terminou a série, quem saiu,
  // quem recebeu há pouco. A régua do `dia` fica no JS porque ela depende de
  // qual passo a pessoa está, e isso é uma tabela do TypeScript, não uma
  // coluna: pô-la no SQL exigiria replicar os quinze números no banco, que é
  // exatamente a duplicação que faz os dois divergirem.
  const { data, error } = await admin
    .from("site_leads")
    .select("id, email, idioma, created_at, proximo_passo, ultimo_envio_em, token_descadastro")
    .in("status", ["inscrito", "confirmado"])
    .is("descadastrado_em", null)
    .lt("proximo_passo", MENSAGENS.length)
    .or(`ultimo_envio_em.is.null,ultimo_envio_em.lte.${corteDoIntervalo}`)
    .order("ultimo_envio_em", { ascending: true, nullsFirst: true })
    .limit(TETO_POR_RODADA * 4);

  if (error) {
    logger.error("[marketing-sequencia] consulta falhou", { error: error.message, requestId });
    return fail("internal_error", "Failed to query leads.", 500, { requestId });
  }

  const fila = (data ?? []) as LeadDaFila[];
  const marca = await marcaDaSaida(null);

  let enviados = 0;
  let pulados = 0;
  let falhas = 0;

  for (const lead of fila) {
    if (enviados >= TETO_POR_RODADA) break;

    const passo = MENSAGENS[lead.proximo_passo];
    if (!passo) continue; // cursor além da série; a consulta já filtra, é cinto

    // O `dia` é ESPERA MÍNIMA desde a inscrição, não uma data. Quem se
    // inscreveu hoje recebe o passo 0 hoje; quem se inscreveu há 50 dias e
    // está no passo 3 recebe o passo 3 agora, não os três de uma vez — o teto
    // de um passo por rodada e o intervalo de 20 h cuidam disso.
    if (agora - new Date(lead.created_at).getTime() < passo.dia * DIA_MS) continue;

    const declarado = lead.idioma ?? "";
    const idioma = ehIdiomaDoSite(declarado) ? declarado : IDIOMA_DO_SITE_PADRAO;
    const conteudo = passo.texto[idioma];

    // ── 1. A linha ANTES do envio ─────────────────────────────────────────
    const { data: criado, error: erroInsert } = await admin
      .from("email_envios")
      .insert({
        lead_id: lead.id,
        mensagem: passo.id,
        assunto: conteudo.assunto,
        status: "agendado",
        agendado_para: new Date(agora).toISOString(),
      })
      .select("id")
      .maybeSingle();

    let envioId = criado?.id as string | undefined;

    if (erroInsert) {
      if (erroInsert.code !== "23505") {
        logger.error("[marketing-sequencia] insert falhou", {
          error: erroInsert.message,
          lead: lead.id,
          requestId,
        });
        falhas++;
        continue;
      }
      // Colidiu: este (lead, mensagem) já tem linha. Ou ela saiu — e o cursor
      // é que está atrasado, e corrigi-lo é a coisa certa a fazer sem mandar
      // nada —, ou ela FALHOU numa rodada anterior e a retentativa é devida.
      const { data: existente } = await admin
        .from("email_envios")
        .select("id, status")
        .eq("lead_id", lead.id)
        .eq("mensagem", passo.id)
        .maybeSingle();

      if (!existente || existente.status !== "falhou") {
        await avancar(admin, lead, passo.id, null);
        pulados++;
        continue;
      }
      envioId = existente.id as string;
    }

    if (!envioId) {
      falhas++;
      continue;
    }

    // ── 2. O envio ────────────────────────────────────────────────────────
    const email = montarEmail(conteudo.corpo, idioma, lead.token_descadastro, marca.nome);
    const resultado = await sendEmail({
      to: lead.email,
      subject: conteudo.assunto,
      html: email.html,
      text: email.text,
      headers: email.headers,
      fromName: marca.nome,
      tags: [{ name: "sequencia", value: passo.id }],
    });

    if (!resultado.ok) {
      // Fica em `falhou` DE PROPÓSITO, e o cursor não anda: a rodada seguinte
      // reencontra esta linha pelo status e tenta a mesma mensagem outra vez.
      await admin
        .from("email_envios")
        .update({ status: "falhou", erro: `${resultado.error}: ${resultado.details ?? ""}`.trim() })
        .eq("id", envioId);
      logger.warn("[marketing-sequencia] envio falhou", {
        erro: resultado.error,
        lead: lead.id,
        mensagem: passo.id,
        requestId,
      });
      falhas++;
      await pausa();
      continue;
    }

    // ── 3. Só agora o cursor anda ─────────────────────────────────────────
    await admin
      .from("email_envios")
      .update({
        status: "enviado",
        provider_id: resultado.id ?? null,
        enviado_em: new Date().toISOString(),
        erro: null,
      })
      .eq("id", envioId);

    await avancar(admin, lead, passo.id, new Date().toISOString());
    enviados++;
    await pausa();
  }

  // Rodada que não mandou nada não é mutação — mesma regra dos outros crons.
  if (enviados > 0 || falhas > 0) {
    void audit({
      action: "marketing.sequencia_run",
      organizationId: null,
      bypassedRls: true,
      metadata: { varridos: fila.length, enviados, pulados, falhas },
      requestId,
    });
  }

  return ok({ varridos: fila.length, enviados, pulados, falhas }, { requestId });
}

/**
 * Avança o cursor para DEPOIS da mensagem que acabou de sair.
 *
 * Não é `proximo_passo + 1`: quando a colisão do índice revelou que o cursor
 * estava atrasado, `+1` o deixaria atrasado de novo, um passo por rodada, e a
 * pessoa levaria semanas para voltar à série. A posição vem do id — que é o
 * que o banco realmente registrou —, e `+1` é só o empate quando o id some da
 * série (mensagem removida depois de enviada).
 */
async function avancar(
  admin: ReturnType<typeof createAdminClient>,
  lead: LeadDaFila,
  idEnviado: string,
  quando: string | null,
): Promise<void> {
  const onde = MENSAGENS.findIndex((m) => m.id === idEnviado);
  const destino = onde >= 0 ? onde + 1 : lead.proximo_passo + 1;
  const campos: Record<string, unknown> = {
    proximo_passo: Math.max(destino, lead.proximo_passo),
  };
  if (quando !== null) campos.ultimo_envio_em = quando;
  await admin.from("site_leads").update(campos).eq("id", lead.id);
}

function pausa(): Promise<void> {
  return new Promise((r) => setTimeout(r, PAUSA_MS));
}

export async function GET(req: NextRequest): Promise<Response> {
  return handle(req);
}

export async function POST(req: NextRequest): Promise<Response> {
  return handle(req);
}

// `mensagemPorId` é o caminho de leitura do painel e do webhook — reexportado
// daqui não; importado lá. Esta linha existe só para lembrar que o id de
// `email_envios.mensagem` é resolvível, e que nenhum leitor precisa do índice.
void mensagemPorId;
