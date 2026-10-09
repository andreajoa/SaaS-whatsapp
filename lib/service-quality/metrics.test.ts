import { describe, expect, it } from "vitest";
import {
  DISABLED_POLICY,
  policySchema,
  feedbackSchema,
  requestSurveySchema,
  surveyTokenSchema,
} from "./contracts";
import type { QualityFact, QualitySurvey } from "./contracts";
import { conversationMetrics, pageSummary } from "./metrics";
import { newSurveyToken, hashSurveyToken } from "./token";
import { qualityText } from "./text";
const policy = {
  enabled: true,
  first_response_target_seconds: 300,
  resolution_target_seconds: 3600,
  clock_mode: "elapsed" as const,
};
const first = "2026-10-08T12:00:00Z";
const now = Date.parse("2026-10-08T14:00:00Z");
const fact: QualityFact = {
  conversation_id: "11111111-1111-4111-8111-111111111111",
  status: "open",
  service_started_at: first,
  first_inbound_at: first,
  first_response_at: null,
  closed_at: null,
};
describe("qualidade: metas explícitas e relógio real", () => {
  it("não inventa SLA na ausência de política e mantém observação de tempo", () => {
    const result = conversationMetrics(fact, DISABLED_POLICY, now);
    expect(result.first_response).toMatchObject({
      elapsed_seconds: 7200,
      state: "unconfigured",
      target_seconds: null,
    });
    expect(pageSummary([result], []).alerts).toEqual([]);
    expect(DISABLED_POLICY.enabled).toBe(false);
  });
  it("opt-in exige pelo menos uma meta positiva; rejeita calendário comercial e tenant do body", () => {
    expect(policySchema.safeParse({ ...DISABLED_POLICY, enabled: true }).success).toBe(false);
    expect(policySchema.safeParse({ ...policy, first_response_target_seconds: 0 }).success).toBe(
      false,
    );
    expect(policySchema.safeParse({ ...policy, clock_mode: "worktime" }).success).toBe(false);
    expect(policySchema.safeParse({ ...policy, organization_id: "attacker" }).success).toBe(false);
    expect(policySchema.safeParse({ ...policy, resolution_target_seconds: null }).success).toBe(
      true,
    );
  });
  it("usa timestamp da primeira resposta e status resolved para os dois tempos", () => {
    const row = conversationMetrics(
      {
        ...fact,
        status: "resolved",
        first_response_at: "2026-10-08T12:04:00Z",
        closed_at: "2026-10-08T12:45:00Z",
      },
      policy,
      now,
    );
    expect(row.first_response).toMatchObject({
      elapsed_seconds: 240,
      state: "met",
      completed: true,
    });
    expect(row.resolution).toMatchObject({ elapsed_seconds: 2700, state: "met", completed: true });
    expect(row.inbox_url).toBe(`/app/inbox/${fact.conversation_id}`);
  });
  it("prazo exato é atendido; atraso de 1 segundo excede a meta", () => {
    expect(
      conversationMetrics({ ...fact, first_response_at: "2026-10-08T12:05:00Z" }, policy, now)
        .first_response.state,
    ).toBe("met");
    expect(
      conversationMetrics({ ...fact, first_response_at: "2026-10-08T12:05:01Z" }, policy, now)
        .first_response.state,
    ).toBe("breached");
  });
  it.each(["snoozed", "awaiting_lead", "awaiting_human", "claimed"])(
    "%s não suspende tempo corrido",
    (status) => {
      const result = conversationMetrics({ ...fact, status }, policy, now);
      expect(result.first_response).toMatchObject({ elapsed_seconds: 7200, state: "breached" });
      expect(result.resolution).toMatchObject({ elapsed_seconds: 7200, state: "breached" });
    },
  );
  it("inclui noites/fim de semana (não é SLA de jornada)", () => {
    const row = conversationMetrics(
      { ...fact, first_inbound_at: "2026-10-09T20:00:00Z" },
      policy,
      Date.parse("2026-10-12T08:00:00Z"),
    );
    expect(row.first_response.elapsed_seconds).toBe(60 * 3600);
    expect(qualityText("pt-BR").clock).toContain("inclusive noites");
  });
  it("sem inbound não conta outbound-first como atendimento nem dispara prazo", () => {
    const row = conversationMetrics({ ...fact, first_inbound_at: null }, policy, now);
    expect(row.first_response).toMatchObject({ state: "not_started", elapsed_seconds: null });
    expect(pageSummary([row], []).alerts).toEqual([]);
  });
  it.each(["closed", "archived"])("%s termina relógio sem fingir resolução", (status) => {
    const row = conversationMetrics(
      { ...fact, status, closed_at: "2026-10-08T12:10:00Z" },
      policy,
      now,
    );
    expect(row.first_response.elapsed_seconds).toBe(600);
    expect(row.resolution.elapsed_seconds).toBe(600);
    const summary = pageSummary([row], []);
    expect(summary.resolution_samples).toBe(0);
    expect(summary.resolution_average_seconds).toBeNull();
    expect(summary.ended_without_resolution).toBe(1);
    expect(summary.alerts.map((a) => a.kind)).toContain("ended_without_resolution");
  });
  it("reabertura ignora closed_at anterior e mede desde novo inbound", () => {
    const row = conversationMetrics(
      {
        ...fact,
        status: "open",
        first_inbound_at: "2026-10-08T13:00:00Z",
        closed_at: "2026-10-08T12:10:00Z",
      },
      policy,
      now,
    );
    expect(row.resolution.elapsed_seconds).toBe(3600);
    expect(row.resolved).toBe(false);
  });
  it("dados impossíveis e relógio futuro não viram duração negativa", () => {
    expect(
      conversationMetrics({ ...fact, first_response_at: "2026-10-08T11:00:00Z" }, policy, now)
        .first_response.elapsed_seconds,
    ).toBeNull();
    expect(
      conversationMetrics({ ...fact, first_inbound_at: "invalid" }, policy, now).first_response
        .elapsed_seconds,
    ).toBeNull();
  });
  it("médias excluem atendimentos ainda abertos e mostram CSAT/nota baixa junto com velocidade", () => {
    const resolved = conversationMetrics(
      {
        ...fact,
        status: "resolved",
        first_response_at: "2026-10-08T12:02:00Z",
        closed_at: "2026-10-08T12:10:00Z",
      },
      policy,
      now,
    );
    const pending = conversationMetrics(fact, policy, now);
    const survey = {
      id: fact.conversation_id,
      conversation_id: fact.conversation_id,
      created_at: first,
      expires_at: first,
      responded_at: first,
      score: 1,
      comment: "Sintético",
    } satisfies QualitySurvey;
    const summary = pageSummary([resolved, pending], [survey]);
    expect(summary).toMatchObject({
      first_response_samples: 1,
      first_response_average_seconds: 120,
      resolution_samples: 1,
      resolution_average_seconds: 600,
      csat_average: 1,
      csat_low_scores: 1,
      csat_responses: 1,
    });
    expect(summary.alerts).toHaveLength(2);
  });
});
describe("CSAT contrato e segredo", () => {
  it.each([0, 6, 1.5, null, "5"])("rejeita nota %s", (score) =>
    expect(feedbackSchema.safeParse({ score }).success).toBe(false),
  );
  it.each([1, 2, 3, 4, 5])("aceita nota %s e comentário opcional", (score) =>
    expect(feedbackSchema.safeParse({ score }).success).toBe(true),
  );
  it("rejeita campo de tenant e comentário grande; normaliza espaços", () => {
    expect(
      feedbackSchema.safeParse({ score: 5, organization_id: fact.conversation_id }).success,
    ).toBe(false);
    expect(feedbackSchema.safeParse({ score: 5, comment: "x".repeat(2001) }).success).toBe(false);
    expect(feedbackSchema.parse({ score: 5, comment: "  ótimo  " }).comment).toBe("ótimo");
  });
  it("validade é explícita e limitada, não inventa prazo comercial", () => {
    expect(requestSurveySchema.safeParse({ conversation_id: fact.conversation_id }).success).toBe(
      false,
    );
    expect(
      requestSurveySchema.safeParse({ conversation_id: fact.conversation_id, expires_hours: 721 })
        .success,
    ).toBe(false);
    expect(
      requestSurveySchema.safeParse({ conversation_id: fact.conversation_id, expires_hours: 1 })
        .success,
    ).toBe(true);
  });
  it("gera 256 bits aleatórios; armazena só hash e não normaliza case", () => {
    const a = newSurveyToken(),
      b = newSurveyToken();
    expect(surveyTokenSchema.safeParse(a.token).success).toBe(true);
    expect(a.hash).toMatch(/^[a-f0-9]{64}$/);
    expect(a.hash).toBe(hashSurveyToken(a.token));
    expect(a.token).not.toBe(b.token);
    expect(hashSurveyToken("A".repeat(43))).not.toBe(hashSurveyToken("a".repeat(43)));
  });
  it("as duas línguas têm mesma superfície e instruem ação explícita", () => {
    const pt = qualityText("pt-BR"),
      es = qualityText("es");
    expect(Object.keys(pt).sort()).toEqual(Object.keys(es).sort());
    expect(es.linkHelp).toContain("no envía mensajes");
  });
});
