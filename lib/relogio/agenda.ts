/**
 * A AGENDA COMPLETA — as 22 rotas de cron e quando cada uma deve rodar.
 *
 * ─── Por que este arquivo existe ────────────────────────────────────────────
 *
 * O self-host tem o contêiner `deskcomm-scheduler`, que escreve um crontab de
 * verdade (`docker/scheduler/entrypoint.sh`) e chama as 22 rotas. O deploy
 * hospedado NÃO tem esse contêiner, e o plano Hobby da Vercel só aceita cron
 * DIÁRIO — doze destas rotas rodam sub-diário, então declarar `crons` no
 * `vercel.json` sem estar no Pro **reprova o deploy inteiro**, não degrada
 * (o argumento longo está em `tests/unit/cron-routes-scheduled.test.ts`).
 *
 * O relógio HTTP (`/api/v1/system/relogio/tick`) era a saída, e cobria QUATRO
 * tarefas: dreno de eventos, follow-up, roteamento e envio travado. As outras
 * dezoito — `agent-dispatcher` inclusive, que é a IA responder — não tinham
 * quem as chamasse no hospedado. E o modo de falha é o de sempre: não dá erro,
 * a feature só não acontece.
 *
 * ─── Por que a régua é "desde a última ocorrência", e não "case o minuto" ───
 *
 * Quem bate o relógio de graça (GitHub Actions) ATRASA: 5 a 15 minutos é
 * normal. Uma verificação do tipo "o minuto atual casa com a cadência?" perderia
 * quase tudo, e `17 * * * *` não rodaria praticamente nunca.
 *
 * Então a pergunta aqui é outra: **qual foi a última hora em que esta tarefa
 * DEVERIA ter rodado, e ela rodou depois disso?** Se não, está vencida. Isso
 * torna o atraso do agendador inofensivo, faz a tarefa se recuperar sozinha
 * depois de uma queda, e — o que importa — garante que ela roda UMA vez por
 * janela, não uma vez por batida.
 *
 * ─── Fuso ───────────────────────────────────────────────────────────────────
 *
 * Tudo em UTC, nos dois lados. A imagem do `scheduler` não define `TZ`, então
 * o `crond` do busybox já roda em UTC; a Vercel também. As quatro tarefas
 * diárias (`0 12`, `30 3`, `15 4`, `40 4`) caem no mesmo horário nos dois
 * arranjos por acidente feliz, e este comentário existe para que continue
 * sendo por decisão.
 */

export interface TarefaAgendada {
  /** O nome do diretório em `app/api/v1/cron/`. */
  readonly rota: string;
  /** A MESMA expressão de `docker/scheduler/entrypoint.sh`. */
  readonly cadencia: string;
  /** Segundos que o crontab do self-host dá à rota. Aqui vira o timeout do fetch. */
  readonly timeoutS: number;
  /** Query string, quando a rota tem uma (`storage-redaction?limit=50`). */
  readonly query?: string;
  /**
   * `true` = o tick faz este trabalho DENTRO do próprio processo, chamando a
   * função, sem HTTP. São as quatro que já eram assim antes deste arquivo, e
   * continuam: uma chamada de função custa zero invocação e zero latência de
   * rede, e elas rodam todo minuto.
   */
  readonly emProcesso?: true;
}

/**
 * Espelho fiel do bloco `CRONS="…"` de `docker/scheduler/entrypoint.sh`.
 *
 * Fiel não por disciplina: `tests/unit/relogio-agenda-bate-com-scheduler.test.ts`
 * compara os dois nas duas direções, rota a rota e cadência a cadência. Rota
 * nova sem linha aqui reprova o CI do mesmo jeito que reprova sem linha lá.
 */
export const AGENDA: readonly TarefaAgendada[] = [
  { rota: "agent-dispatcher", cadencia: "* * * * *", timeoutS: 25 },
  { rota: "followup-flow-worker", cadencia: "* * * * *", timeoutS: 25, emProcesso: true },
  { rota: "event-log-drain", cadencia: "* * * * *", timeoutS: 45, emProcesso: true },
  { rota: "routing-worker", cadencia: "* * * * *", timeoutS: 25, emProcesso: true },
  { rota: "recover-stuck-messages", cadencia: "* * * * *", timeoutS: 25, emProcesso: true },
  { rota: "storage-redaction", cadencia: "*/5 * * * *", timeoutS: 25, query: "limit=50" },
  { rota: "snooze-watcher", cadencia: "*/5 * * * *", timeoutS: 25 },
  { rota: "attendant-heartbeat", cadencia: "*/5 * * * *", timeoutS: 25 },
  { rota: "webhook-log-retention", cadencia: "*/5 * * * *", timeoutS: 60 },
  { rota: "channel-health", cadencia: "*/5 * * * *", timeoutS: 45 },
  { rota: "contact-avatars", cadencia: "*/10 * * * *", timeoutS: 60 },
  { rota: "agenda-google-refresh", cadencia: "*/10 * * * *", timeoutS: 60 },
  { rota: "agenda-google-sync", cadencia: "*/15 * * * *", timeoutS: 90 },
  { rota: "agenda-google-push", cadencia: "*/5 * * * *", timeoutS: 60 },
  { rota: "agenda-reminder", cadencia: "*/5 * * * *", timeoutS: 45 },
  { rota: "risk-watcher", cadencia: "*/15 * * * *", timeoutS: 60 },
  { rota: "contact-phones", cadencia: "*/30 * * * *", timeoutS: 60 },
  { rota: "contact-proposals-watcher", cadencia: "17 * * * *", timeoutS: 60 },
  { rota: "marketing-sequencia", cadencia: "37 * * * *", timeoutS: 120 },
  { rota: "lgpd-sla-watcher", cadencia: "0 12 * * *", timeoutS: 60 },
  { rota: "kb-conversations-batch", cadencia: "30 3 * * *", timeoutS: 120 },
  { rota: "sync-model-catalog", cadencia: "15 4 * * *", timeoutS: 60 },
  { rota: "data-retention", cadencia: "40 4 * * *", timeoutS: 120 },
] as const;

/** As que o tick despacha por HTTP — todas menos as quatro em processo. */
export const AGENDA_POR_HTTP = AGENDA.filter((t) => !t.emProcesso);

/** O caminho completo que o tick chama. */
export function caminhoDaTarefa(t: TarefaAgendada): string {
  return `/api/v1/cron/${t.rota}${t.query ? `?${t.query}` : ""}`;
}

/**
 * A última hora em que esta cadência DEVERIA ter disparado, em UTC.
 *
 * Aceita de propósito só as quatro formas que o crontab do scheduler usa —
 * a cada minuto, a cada N minutos, de hora em hora num minuto fixo, e uma vez
 * por dia. Qualquer outra LANÇA em vez de adivinhar: um cron de dia-da-semana
 * interpretado errado roda na hora errada em silêncio, e silêncio é exatamente
 * o que este módulo existe para acabar. O teste de paridade garante que o
 * crontab não ganhou uma quinta forma sem ninguém notar.
 */
export function ultimaOcorrencia(cadencia: string, agora: Date): Date {
  const campos = cadencia.trim().split(/\s+/);
  if (campos.length !== 5) throw new Error(`cadência inválida: "${cadencia}"`);
  const [min, hora, dia, mes, semana] = campos as [string, string, string, string, string];
  if (dia !== "*" || mes !== "*" || semana !== "*") {
    throw new Error(`cadência com dia/mês/semana não suportada: "${cadencia}"`);
  }

  const d = new Date(
    Date.UTC(
      agora.getUTCFullYear(),
      agora.getUTCMonth(),
      agora.getUTCDate(),
      agora.getUTCHours(),
      agora.getUTCMinutes(),
      0,
      0,
    ),
  );

  if (hora === "*") {
    if (min === "*") return d;
    const passo = min.startsWith("*/") ? Number(min.slice(2)) : null;
    if (passo !== null) {
      if (!Number.isInteger(passo) || passo < 1 || passo > 59) {
        throw new Error(`passo de minuto inválido: "${cadencia}"`);
      }
      d.setUTCMinutes(Math.floor(d.getUTCMinutes() / passo) * passo);
      return d;
    }
    const m = Number(min);
    if (!Number.isInteger(m) || m < 0 || m > 59) throw new Error(`minuto inválido: "${cadencia}"`);
    d.setUTCMinutes(m);
    if (d.getTime() > agora.getTime()) d.setUTCHours(d.getUTCHours() - 1);
    return d;
  }

  const h = Number(hora);
  const m = Number(min);
  if (!Number.isInteger(h) || h < 0 || h > 23) throw new Error(`hora inválida: "${cadencia}"`);
  if (!Number.isInteger(m) || m < 0 || m > 59) throw new Error(`minuto inválido: "${cadencia}"`);
  d.setUTCHours(h, m, 0, 0);
  if (d.getTime() > agora.getTime()) d.setUTCDate(d.getUTCDate() - 1);
  return d;
}

/**
 * Esta tarefa está vencida?
 *
 * `null` em `ultimaExecucao` é "nunca rodou", e vence: numa instalação nova
 * tudo roda na primeira batida, que é o comportamento certo — é a diferença
 * entre o produto começar a trabalhar no minuto um e começar quando o relógio
 * calhar de bater na janela exata.
 */
export function estaVencida(cadencia: string, ultimaExecucao: Date | null, agora: Date): boolean {
  if (ultimaExecucao === null) return true;
  return ultimaExecucao.getTime() < ultimaOcorrencia(cadencia, agora).getTime();
}

/** Há quantos minutos esta tarefa deveria ter rodado. Ordena o mais atrasado primeiro. */
export function atrasoEmMinutos(
  cadencia: string,
  ultimaExecucao: Date | null,
  agora: Date,
): number {
  const devido = ultimaOcorrencia(cadencia, agora).getTime();
  const base = ultimaExecucao === null ? devido : Math.max(ultimaExecucao.getTime(), devido);
  return Math.max(0, Math.round((agora.getTime() - base) / 60_000));
}
