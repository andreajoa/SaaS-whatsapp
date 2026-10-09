import type { QualityFact, QualityPolicy, QualitySurvey } from "./contracts";

export type TargetState = "unconfigured" | "not_started" | "pending" | "met" | "breached";
export interface TargetMetric {
  elapsed_seconds: number | null;
  target_seconds: number | null;
  state: TargetState;
  completed: boolean;
}
function target(
  start: string | null,
  end: string | null,
  targetSeconds: number | null,
  now: number,
): TargetMetric {
  const startMs = start === null ? NaN : Date.parse(start);
  const endMs = end === null ? now : Date.parse(end);
  // Timestamps impossíveis não se transformam em bons resultados.
  const elapsed =
    Number.isFinite(startMs) && Number.isFinite(endMs) && startMs <= endMs
      ? (endMs - startMs) / 1000
      : null;
  const state: TargetState =
    targetSeconds === null
      ? "unconfigured"
      : elapsed === null
        ? "not_started"
        : elapsed > targetSeconds
          ? "breached"
          : end === null
            ? "pending"
            : "met";
  return {
    elapsed_seconds: elapsed,
    target_seconds: targetSeconds,
    state,
    completed: end !== null && elapsed !== null,
  };
}
/** Tempo corrido deliberado: snooze, bot pausado e awaiting_lead NÃO pausam o relógio.
 * Primeira resposta mede entrega técnica; não afirma utilidade nem resolução.
 * 'closed'/'archived' encerram o relógio, mas apenas 'resolved' conta como resolução.
 */
export function conversationMetrics(fact: QualityFact, policy: QualityPolicy, now = Date.now()) {
  const terminal = ["closed", "resolved", "archived"].includes(fact.status);
  const end = terminal ? fact.closed_at : null;
  return {
    ...fact,
    inbox_url: `/app/inbox/${fact.conversation_id}`,
    first_response: target(
      fact.first_inbound_at,
      fact.first_response_at,
      policy.enabled ? policy.first_response_target_seconds : null,
      end ? Date.parse(end) : now,
    ),
    resolution: target(
      fact.first_inbound_at,
      fact.status === "resolved" ? end : null,
      policy.enabled ? policy.resolution_target_seconds : null,
      end ? Date.parse(end) : now,
    ),
    resolved: fact.status === "resolved" && end !== null,
    ended_without_resolution: terminal && fact.status !== "resolved",
  };
}
export type ConversationMetric = ReturnType<typeof conversationMetrics>;
export function pageSummary(rows: ConversationMetric[], surveys: QualitySurvey[]) {
  const average = (values: number[]) =>
    values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
  const response = rows
    .filter((r) => r.first_response.completed)
    .map((r) => r.first_response.elapsed_seconds!);
  const resolved = rows
    .filter((r) => r.resolved && r.resolution.completed)
    .map((r) => r.resolution.elapsed_seconds!);
  const scored = surveys.filter((s) => s.responded_at !== null && s.score !== null);
  return {
    conversations: rows.length,
    first_response_samples: response.length,
    first_response_average_seconds: average(response),
    resolution_samples: resolved.length,
    resolution_average_seconds: average(resolved),
    ended_without_resolution: rows.filter((r) => r.ended_without_resolution).length,
    alerts: rows.flatMap((r) =>
      (r.ended_without_resolution ? ["ended_without_resolution"] : [])
        .concat(
          r.first_response.state === "breached" ? ["first_response"] : [],
          r.resolution.state === "breached" ? ["resolution"] : [],
        )
        .map((kind) => ({ conversation_id: r.conversation_id, inbox_url: r.inbox_url, kind })),
    ),
    csat_responses: scored.length,
    csat_average: average(scored.map((s) => s.score!)),
    csat_low_scores: scored.filter((s) => s.score! <= 2).length,
  };
}
export interface QualitySnapshot {
  policy: QualityPolicy;
  can_manage: boolean;
  rows: ConversationMetric[];
  surveys: QualitySurvey[];
  summary: ReturnType<typeof pageSummary> & {
    pending_surveys: number;
    expired_surveys: number;
    total: number;
  };
  survey_history_truncated: boolean;
  next_cursor: string | null;
  measured_at: string;
}
