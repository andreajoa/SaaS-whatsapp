/**
 * GET/POST /api/v1/cron/checkout-abandonado — os dois e-mails de quem parou.
 *
 * ─── Por que isto é um cron e não um webhook ───────────────────────────────
 *
 * Porque não existe o evento. Uma sessão de checkout que a pessoa abandona não
 * produz NADA no Stripe: ela expira calada 24 h depois, e
 * `checkout.session.expired` só cobre as que o Stripe mesmo expira — o que não
 * inclui quem fechou a aba no minuto seguinte, que é a maioria. "Parar" é a
 * ausência de um ato, e ausência não emite evento: alguém tem de ir olhar.
 *
 * ─── Os dois são estágios diferentes, e a ordem entre eles importa ─────────
 *
 * `checkout-abandonado` é de quem ABRIU a tela de pagamento (tem linha em
 * `checkout_tentativas`). `carrinho-abandonado` é de quem chegou à tabela de
 * preço e não abriu nada — mede-se pelo marco `/planos` em `site_visits`, que
 * o beacon grava quando a seção entra na tela.
 *
 * Quem abriu o checkout recebe SÓ o primeiro. Ele necessariamente passou pela
 * tabela de preço antes, então sem a exclusão receberia os dois — "você olhou
 * os planos e não seguiu" um dia depois de "você abriu o pagamento e não
 * terminou", contando à mesma pessoa duas versões do mesmo fato, a segunda
 * menos informada que a primeira.
 *
 * ─── A espera de uma hora não é delicadeza ────────────────────────────────
 *
 * É o tempo de a pessoa TERMINAR. Boleto e Pix levam minutos; cartão recusado
 * é retentado na hora. Mandar "você não terminou" para quem estava terminando
 * é o e-mail mais caro que existe — e o webhook do Stripe, que fecha a
 * tentativa em `concluido`, corre no mesmo intervalo.
 */
import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";

import { fail, ok } from "@/lib/api/wrappers";
import { audit } from "@/lib/audit";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { CAMINHO_DO_PRECO } from "@/lib/marketing/caminhos";
import { dispararTransacional } from "@/lib/marketing/disparo";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/** Teto por rodada, somando os dois e-mails. Mesma razão do cron da sequência. */
const TETO = 25;

/** Tempo mínimo desde a abertura. Abaixo disto a pessoa ainda pode estar pagando. */
const ESPERA_MS = 60 * 60 * 1000;

/**
 * Teto de idade. Um checkout largado há duas semanas não é um carrinho quente,
 * é um assunto encerrado — e escrever sobre ele é propaganda fora de contexto.
 */
const VALIDADE_MS = 7 * 24 * 60 * 60 * 1000;

async function handle(req: NextRequest): Promise<Response> {
  const requestId = randomUUID();

  const auth = req.headers.get("authorization") ?? "";
  const provided = auth.startsWith("Bearer ") ? auth.slice("Bearer ".length).trim() : "";
  const aceitos = [env.INTERNAL_CRON_SECRET, env.INTERNAL_SECRET].filter(Boolean);
  if (aceitos.length === 0 || !provided || !aceitos.includes(provided)) {
    return fail("forbidden", "Cron secret missing or invalid.", 403, { requestId });
  }

  if (!env.RESEND_API_KEY || env.RESEND_FROM_EMAIL.trim().length === 0) {
    return ok({ enviados: 0, motivo: "email_nao_configurado" }, { requestId });
  }

  const admin = createAdminClient();
  const agora = Date.now();
  const teto = new Date(agora - ESPERA_MS).toISOString();
  const piso = new Date(agora - VALIDADE_MS).toISOString();

  let checkout = 0;
  let carrinho = 0;
  let falhas = 0;

  // ─── 1. Quem abriu o pagamento e não terminou ──────────────────────────
  const { data: tentativas, error: erroT } = await admin
    .from("checkout_tentativas")
    .select("id, email, stripe_session_id")
    .eq("status", "aberto")
    .is("lembrete_enviado_em", null)
    .lt("created_at", teto)
    .gt("created_at", piso)
    .not("email", "is", null)
    .limit(TETO);

  if (erroT) {
    logger.error("[checkout-abandonado] consulta de tentativas falhou", {
      error: erroT.message,
      requestId,
    });
    return fail("internal_error", "Failed to query attempts.", 500, { requestId });
  }

  const comCheckout = new Set<string>();

  for (const t of tentativas ?? []) {
    const email = t.email as string;
    comCheckout.add(email.toLowerCase());

    const r = await dispararTransacional({
      email,
      transacionalId: "checkout-abandonado",
      // Uma sessão, um lembrete. A pessoa que abre o checkout três vezes em
      // semanas diferentes é lembrada das três — são três desistências.
      chave: t.stripe_session_id as string,
      origem: "checkout",
    });

    // O carimbo vai SEMPRE que a decisão foi tomada, inclusive quando o disparo
    // devolveu `ja_enviado` ou `descadastrado`. Ele não quer dizer "o e-mail
    // saiu", quer dizer "esta tentativa já foi considerada" — sem isso, uma
    // tentativa de alguém descadastrado seria reexaminada de hora em hora para
    // sempre, ocupando o teto da rodada e empurrando quem nunca foi avisado
    // para o fim da fila.
    if (r.tipo !== "falhou") {
      await admin
        .from("checkout_tentativas")
        .update({ lembrete_enviado_em: new Date().toISOString() })
        .eq("id", t.id as string);
    }

    if (r.tipo === "enviado") checkout++;
    else if (r.tipo === "falhou") falhas++;
  }

  // ─── 2. Quem chegou ao preço e não abriu nada ──────────────────────────
  //
  // O caminho é `site_visits` → `visitor_id` → `site_leads`: só quem deixou o
  // e-mail pode receber e-mail. Quem viu o preço e nunca se inscreveu não tem
  // como ser escrito, e é isso mesmo.
  const restante = TETO - (tentativas?.length ?? 0);
  if (restante > 0) {
    const { data: visitas } = await admin
      .from("site_visits")
      .select("visitor_id")
      .eq("path", CAMINHO_DO_PRECO)
      .lt("created_at", teto)
      .gt("created_at", piso)
      .limit(200);

    const ids = [...new Set((visitas ?? []).map((v) => v.visitor_id as string))];

    if (ids.length > 0) {
      const { data: leads } = await admin
        .from("site_leads")
        .select("email")
        .in("visitor_id", ids)
        .is("descadastrado_em", null)
        .is("assinou_em", null)
        .limit(restante * 3);

      for (const lead of leads ?? []) {
        if (carrinho >= restante) break;
        const email = lead.email as string;
        // Quem abriu o checkout já foi tratado acima e não recebe os dois.
        if (comCheckout.has(email.toLowerCase())) continue;

        // Sem `chave`: este é o e-mail de "você olhou e parou", e olhar de novo
        // semana que vem não é um fato novo — é a mesma hesitação. Uma vez na
        // vida da pessoa, que é o que o índice único dá de graça.
        const r = await dispararTransacional({
          email,
          transacionalId: "carrinho-abandonado",
          origem: "popup",
        });
        if (r.tipo === "enviado") carrinho++;
        else if (r.tipo === "falhou") falhas++;
      }
    }
  }

  if (checkout > 0 || carrinho > 0 || falhas > 0) {
    void audit({
      action: "marketing.abandono_run",
      organizationId: null,
      bypassedRls: true,
      metadata: { checkout, carrinho, falhas },
      requestId,
    });
  }

  return ok({ checkout, carrinho, falhas }, { requestId });
}

export async function GET(req: NextRequest): Promise<Response> {
  return handle(req);
}

export async function POST(req: NextRequest): Promise<Response> {
  return handle(req);
}
