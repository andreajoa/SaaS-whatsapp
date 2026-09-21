/**
 * Trabalhos de MINUTO que o tick faz DENTRO do próprio processo.
 *
 * ⚠️ **Esta NÃO é a lista do que o relógio cobre.** A lista completa — as 22
 * rotas de `app/api/v1/cron/` com suas cadências — é `lib/relogio/agenda.ts`,
 * e é ela que tem paridade cobrada contra o crontab do self-host. Estas quatro
 * são apenas as que rodam por chamada de função, sem rede, porque são baratas
 * e rodam a cada minuto de qualquer forma.
 *
 * Por meses esta lista FOI a cobertura inteira, e dezoito rotas — incluindo o
 * `agent-dispatcher`, que é a IA responder — não tinham quem as chamasse no
 * deploy hospedado. O texto acima existe para que ninguém volte a ler estas
 * quatro como se fossem a história completa.
 */
export const TAREFAS_DO_RELOGIO = [
  {
    id: "event-log-drain",
    rotulo: "Ler a fila de eventos",
    porque: "Acorda automações e o follow-up quando chega mensagem.",
  },
  {
    id: "followup-flow-worker",
    rotulo: "Andar os follow-ups",
    porque: "É o passo que manda a próxima pergunta depois do SIM.",
  },
  {
    id: "routing-worker",
    rotulo: "Distribuir conversas",
    porque: "Conversa nova sem dono entra na fila do atendente certo.",
  },
  {
    id: "recover-stuck-messages",
    rotulo: "Destravar envios parados",
    porque: "Mensagem presa em «enviando» deixa de mentir progresso.",
  },
] as const;

export type IdDeTarefaDoRelogio = (typeof TAREFAS_DO_RELOGIO)[number]["id"];

export const CAMINHO_DO_TICK = "/api/v1/system/relogio/tick";

export function comandoCurlDoRelogio(appUrl: string): string {
  const base = appUrl.replace(/\/$/, "");
  return `curl -fsS -X POST -H "Authorization: Bearer $INTERNAL_SECRET" "${base}${CAMINHO_DO_TICK}"`;
}

/** URL absoluta do tick — para colar em cron-job.org / GitHub Actions. */
export function urlDoTickDoRelogio(appUrl: string): string {
  return `${appUrl.replace(/\/$/, "")}${CAMINHO_DO_TICK}`;
}
