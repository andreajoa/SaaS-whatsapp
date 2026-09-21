import { recoverStuckMessages } from "@/app/api/v1/cron/recover-stuck-messages/route";
import { idsDoContatoEGemeos } from "@/lib/channels/contato-por-telefone";
import { drainEventLog } from "@/lib/event-log/drain";
import { ensureHandlersRegistered } from "@/lib/event-log/register-handlers";
import { createSupabaseFollowupGateDb } from "@/lib/followup/agent-followup-gate";
import { inboundEhDestaPergunta } from "@/lib/followup/aplicar-inbound";
import {
  aplicarRespostaInbound,
  createSupabaseAdminClient,
  runFollowupTick,
  type FollowupJobRequest,
  type TickDeps,
} from "@/lib/followup/engine";
import { enviarTextoFixoPendente } from "@/lib/followup/enviar-texto-fixo";
import type { EnrollmentRow } from "@/lib/followup/node-handlers";
import { createSupabaseSilenceSweepDb, runSilenceSweep } from "@/lib/followup/silence-sweep";
import { logger } from "@/lib/logger";
import {
  AGENDA_POR_HTTP,
  atrasoEmMinutos,
  caminhoDaTarefa,
  estaVencida,
  type TarefaAgendada,
} from "@/lib/relogio/agenda";
import { runRoutingWorker } from "@/lib/routing/worker";
import { createAdminClient } from "@/lib/supabase/admin";
import { env } from "@/lib/env";
import type { SupabaseClient } from "@supabase/supabase-js";

export type ResultadoDeTarefa = {
  id: string;
  ok: boolean;
  detalhe?: string;
};

/**
 * Quanto tempo o tick tem para despachar as tarefas vencidas.
 *
 * A rota declara `maxDuration = 60`. Quarenta segundos deixa margem para o
 * trabalho em processo que vem antes e para a escrita das marcas que vem
 * depois. O que não couber NÃO se perde: fica vencido e o próximo tick o pega
 * primeiro, porque a fila é ordenada pelo mais atrasado. É por isso que a
 * régua é "desde a última ocorrência" e não "case o minuto" — um orçamento
 * estourado vira atraso, nunca buraco.
 */
const ORCAMENTO_MS = 40_000;

/** Quantas rotas o tick chama ao mesmo tempo. */
const EM_PARALELO = 3;

async function enfileirarFollowup(job: FollowupJobRequest): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin.from("job_queue").insert({
    organization_id: job.organization_id,
    contact_id: job.contact_id,
    kind: "followup_turn",
    payload: job.payload,
  });
  if (error) throw new Error(error.message);
}

/**
 * O claim do worker só pega `next_eval_at <= agora`. `match_reply` estaciona
 * com 15 min de graça — o SIM do lead chega ANTES disso e o relógio passava
 * batido. Aqui lemos a última inbound (gêmeos de telefone inclusive) e
 * avançamos quem já respondeu.
 */
async function aplicarRespostasQueChegaram(admin: SupabaseClient, deps: TickDeps): Promise<number> {
  const { data, error } = await admin
    .from("followup_enrollments")
    .select("*")
    .in("status", ["waiting_reply"])
    .limit(40);
  if (error) throw new Error(error.message);
  let n = 0;
  for (const row of data ?? []) {
    const enrollment = row as EnrollmentRow;
    const ids = await idsDoContatoEGemeos(admin, enrollment.organization_id, enrollment.contact_id);
    const { data: msg, error: msgErr } = await admin
      .from("messages")
      .select("body, sent_at")
      .eq("organization_id", enrollment.organization_id)
      .in("contact_id", ids)
      .eq("direction", "inbound")
      .order("sent_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (msgErr) throw new Error(msgErr.message);
    const texto = typeof msg?.body === "string" ? msg.body.trim() : "";
    if (!texto) continue;
    const enviada = typeof msg?.sent_at === "string" ? msg.sent_at : "";
    if (enviada && !inboundEhDestaPergunta(enviada, enrollment.updated_at)) continue;
    await aplicarRespostaInbound(deps, enrollment, texto);
    n++;
  }
  return n;
}

/** O que a tabela `relogio_execucoes` devolve, reduzido ao que o tick usa. */
type MarcaDeExecucao = { tarefa: string; ultima_execucao: string; falhas_seguidas: number };

/**
 * Quando cada tarefa rodou pela última vez.
 *
 * Falha de leitura NÃO derruba o tick: devolve o mapa vazio, e mapa vazio
 * significa "tudo vencido". O comportamento degradado é rodar demais, nunca de
 * menos — e rodar demais é seguro porque cada rota já é idempotente por
 * construção (é o contrato de todas elas com o `crond` do self-host, que as
 * chama de novo a cada minuto).
 */
async function lerMarcas(admin: SupabaseClient): Promise<Map<string, MarcaDeExecucao>> {
  const { data, error } = await admin
    .from("relogio_execucoes")
    .select("tarefa, ultima_execucao, falhas_seguidas");
  if (error) {
    logger.warn("[relogio] não consegui ler relogio_execucoes", { error: error.message });
    return new Map();
  }
  const mapa = new Map<string, MarcaDeExecucao>();
  for (const linha of (data ?? []) as MarcaDeExecucao[]) mapa.set(linha.tarefa, linha);
  return mapa;
}

/**
 * Grava a marca — e avança `ultima_execucao` MESMO QUANDO A ROTA FALHOU.
 *
 * Parece errado e não é. Se a falha não avançasse a marca, uma rota quebrada
 * ficaria vencida para sempre e seria rechamada em TODA batida: o
 * `kb-conversations-batch`, que é diário e caro, viraria uma chamada a cada
 * cinco minutos durante as 24 horas em que estivesse com defeito — e ele é o
 * de 120 s de timeout. Uma rota quebrada tem de doer no painel, não na conta.
 *
 * Quem carrega o defeito é `falhas_seguidas`, que zera no primeiro sucesso: é
 * a diferença entre "falhou agora" e "está quebrada há 40 rodadas", e é o que
 * a tela do operador lê.
 */
async function marcarExecucao(
  admin: SupabaseClient,
  tarefa: string,
  ok: boolean,
  detalhe: string | undefined,
  duracaoMs: number,
  falhasAntes: number,
): Promise<void> {
  const { error } = await admin.from("relogio_execucoes").upsert(
    {
      tarefa,
      ultima_execucao: new Date().toISOString(),
      ultimo_status: ok ? "ok" : "falhou",
      ultimo_detalhe: detalhe?.slice(0, 500) ?? null,
      duracao_ms: Math.round(duracaoMs),
      falhas_seguidas: ok ? 0 : falhasAntes + 1,
      atualizado_em: new Date().toISOString(),
    },
    { onConflict: "tarefa" },
  );
  if (error) logger.warn("[relogio] não consegui gravar a marca", { tarefa, error: error.message });
}

/**
 * Chama uma rota de cron por HTTP, com o mesmo bearer que o `crond` do
 * self-host usa.
 *
 * ─── Por que HTTP e não importar o handler ──────────────────────────────────
 *
 * As quatro tarefas de minuto são chamadas como FUNÇÃO neste mesmo processo, e
 * está certo: são baratas e rodam sempre. Para as outras dezoito, importar os
 * handlers puxaria dezoito árvores de dependência para dentro do bundle do
 * tick — e o tick tem `maxDuration = 60`, enquanto `kb-conversations-batch`
 * declara 120 s no `vercel.json`. Pela rede, cada rota roda na PRÓPRIA função,
 * com o PRÓPRIO limite de tempo, a própria auditoria e o próprio isolamento de
 * falha: uma rota que estoure memória derruba a si mesma, não o relógio.
 */
async function chamarRota(t: TarefaAgendada, base: string, segredo: string): Promise<{ ok: boolean; detalhe: string }> {
  const url = `${base}${caminhoDaTarefa(t)}`;
  const controlador = new AbortController();
  const corte = setTimeout(() => controlador.abort(), t.timeoutS * 1000);
  try {
    const resposta = await fetch(url, {
      method: "GET",
      headers: { authorization: `Bearer ${segredo}`, "x-relogio": "tick" },
      signal: controlador.signal,
      cache: "no-store",
    });
    const corpo = (await resposta.text()).slice(0, 300);
    return { ok: resposta.ok, detalhe: `${resposta.status} ${corpo}` };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    // `AbortError` aqui não é "a rota falhou": é "a rota demorou mais que o
    // teto que o próprio crontab do self-host lhe dá". A distinção importa no
    // painel — timeout repetido é sinal de volume, erro é sinal de defeito.
    return { ok: false, detalhe: controlador.signal.aborted ? `timeout ${t.timeoutS}s` : msg };
  } finally {
    clearTimeout(corte);
  }
}

/**
 * Despacha as rotas vencidas, do mais atrasado para o menos, dentro do
 * orçamento de tempo.
 */
async function despacharVencidas(
  admin: SupabaseClient,
  marcas: Map<string, MarcaDeExecucao>,
  agora: Date,
  comecou: number,
): Promise<{ resultados: ResultadoDeTarefa[]; mexeu: boolean }> {
  const resultados: ResultadoDeTarefa[] = [];

  const base = (env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/$/, "");
  const segredo = (env.INTERNAL_CRON_SECRET || env.INTERNAL_SECRET || "").trim();
  if (!base || !segredo) {
    // Sem base ou sem segredo o despacho por HTTP não existe — e dizê-lo em
    // voz alta é o ponto. Um tick que devolvesse 200 com quatro tarefas e
    // nenhuma palavra sobre as dezoito seria indistinguível de um tick
    // saudável, que é exatamente o silêncio que este módulo existe para acabar.
    resultados.push({
      id: "despacho-http",
      ok: false,
      detalhe: !base
        ? "NEXT_PUBLIC_APP_URL vazio — as 18 rotas de cron não têm para onde ser chamadas."
        : "INTERNAL_CRON_SECRET/INTERNAL_SECRET vazios — as 18 rotas responderiam 403.",
    });
    return { resultados, mexeu: false };
  }

  const vencidas = AGENDA_POR_HTTP.filter((t) => {
    const marca = marcas.get(t.rota);
    return estaVencida(t.cadencia, marca ? new Date(marca.ultima_execucao) : null, agora);
  }).sort((a, b) => {
    const atraso = (t: TarefaAgendada) => {
      const m = marcas.get(t.rota);
      return atrasoEmMinutos(t.cadencia, m ? new Date(m.ultima_execucao) : null, agora);
    };
    return atraso(b) - atraso(a);
  });

  let mexeu = false;
  const fila = [...vencidas];

  const trabalhador = async (): Promise<void> => {
    for (;;) {
      if (Date.now() - comecou > ORCAMENTO_MS) return;
      const t = fila.shift();
      if (!t) return;
      const marca = marcas.get(t.rota);
      const t0 = Date.now();
      const r = await chamarRota(t, base, segredo);
      const duracao = Date.now() - t0;
      await marcarExecucao(admin, t.rota, r.ok, r.detalhe, duracao, marca?.falhas_seguidas ?? 0);
      resultados.push({ id: t.rota, ok: r.ok, detalhe: r.detalhe });
      if (r.ok) mexeu = true;
      else logger.warn("[relogio] rota de cron falhou", { rota: t.rota, detalhe: r.detalhe });
    }
  };

  await Promise.all(Array.from({ length: Math.min(EM_PARALELO, fila.length) }, trabalhador));

  const sobraram = fila.length;
  if (sobraram > 0) {
    // Não é erro: é o orçamento fazendo o que deve. Mas tem de aparecer, senão
    // uma instalação sobrecarregada pareceria saudável enquanto empurra as
    // mesmas tarefas para a frente indefinidamente.
    resultados.push({
      id: "orcamento",
      ok: true,
      detalhe: `${sobraram} tarefa(s) ficaram para o próximo tick (orçamento de ${ORCAMENTO_MS / 1000}s).`,
    });
  }

  return { resultados, mexeu };
}

/**
 * Uma batida do relógio: as quatro tarefas de minuto neste processo, e todas
 * as demais rotas de cron VENCIDAS por HTTP.
 *
 * Sem depender do crontab da VPS nem do cron pago da Vercel — que é o ponto
 * inteiro: no plano Hobby, cron sub-diário no `vercel.json` reprova o deploy.
 */
export async function executarTickDoRelogio(): Promise<{
  tarefas: ResultadoDeTarefa[];
  mexeu: boolean;
}> {
  const comecou = Date.now();
  const agora = new Date();
  const admin = createAdminClient();
  const tarefas: ResultadoDeTarefa[] = [];
  let mexeu = false;

  const marcas = await lerMarcas(admin);

  const uma = async (id: string, fn: () => Promise<unknown>): Promise<void> => {
    const t0 = Date.now();
    let ok = true;
    let detalhe: string | undefined;
    try {
      const r = await fn();
      detalhe = r === undefined ? undefined : JSON.stringify(r).slice(0, 400);
    } catch (err) {
      ok = false;
      detalhe = err instanceof Error ? err.message : String(err);
      logger.warn("[relogio] tarefa falhou", { id, error: detalhe });
    }
    tarefas.push({ id, ok, detalhe });
    // A marca das quatro em processo é gravada pelo mesmo motivo das outras
    // dezoito: é ela que a tela do operador lê para dizer "o dreno de eventos
    // rodou há 40 segundos". Sem a linha, as quatro que mais importam seriam
    // justamente as que aparecem como "nunca rodou".
    await marcarExecucao(admin, id, ok, detalhe, Date.now() - t0, marcas.get(id)?.falhas_seguidas ?? 0);
  };

  await uma("event-log-drain", async () => {
    ensureHandlersRegistered();
    const summary = await drainEventLog(admin);
    if (summary.done > 0 || summary.failed > 0 || summary.dead > 0) mexeu = true;
    return summary;
  });

  await uma("followup-flow-worker", async () => {
    const deps: TickDeps = {
      db: createSupabaseAdminClient(admin),
      clock: () => new Date(),
      enqueueJob: enfileirarFollowup,
    };
    const acordados = await aplicarRespostasQueChegaram(admin, deps);
    if (acordados > 0) {
      mexeu = true;
      // Sem esta linha o SIM que a ingestão do canal gravou e o Hobby não
      // processou some
      // do radar — o sintoma é "Aguardando resposta" com mensagem na inbox.
      logger.info("[relogio] follow-up avancou por resposta inbound", { acordados });
    }
    const summary = await runFollowupTick(deps);
    if (
      summary.claim_falhou ||
      summary.claimed ||
      summary.advanced ||
      summary.scheduled ||
      summary.failed ||
      summary.dead
    ) {
      mexeu = true;
    }
    try {
      const sweep = await runSilenceSweep({
        db: createSupabaseSilenceSweepDb(admin),
        gateDb: createSupabaseFollowupGateDb(admin),
        clock: () => new Date(),
      });
      if (sweep.enrolled || sweep.pointers_gated_out || sweep.skipped_existing) mexeu = true;
    } catch (err) {
      logger.warn("[relogio] silence sweep falhou", {
        error: err instanceof Error ? err.message : String(err),
      });
    }
    const enviados = await enviarTextoFixoPendente(admin);
    if (enviados > 0) mexeu = true;
    return summary;
  });

  await uma("routing-worker", async () => {
    const summary = await runRoutingWorker();
    return summary;
  });

  await uma("recover-stuck-messages", async () => {
    const summary = await recoverStuckMessages(admin, new Date(), "relogio");
    if (summary.failed > 0) mexeu = true;
    return summary;
  });

  const despacho = await despacharVencidas(admin, marcas, agora, comecou);
  tarefas.push(...despacho.resultados);
  if (despacho.mexeu) mexeu = true;

  return { tarefas, mexeu };
}
