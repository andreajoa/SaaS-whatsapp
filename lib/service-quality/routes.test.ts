import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  support: vi.fn(),
  client: vi.fn(),
  admin: vi.fn(),
  audit: vi.fn(),
  rate: vi.fn(),
}));
vi.mock("@/lib/auth/require-role", () => ({ requireRole: mocks.auth }));
vi.mock("@/lib/impersonate/support", () => ({ requireSupportWrite: mocks.support }));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.client }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: mocks.admin }));
vi.mock("@/lib/audit", () => ({ audit: mocks.audit }));
vi.mock("@/lib/ai/dispatcher/rate-limit", () => ({ checkRateLimit: mocks.rate }));
import { GET as snapshot } from "@/app/api/v1/service-quality/route";
import { PUT as updatePolicy } from "@/app/api/v1/service-quality/policy/route";
import { POST as requestSurvey } from "@/app/api/v1/service-quality/surveys/route";
import {
  GET as checkSurvey,
  POST as respondSurvey,
} from "@/app/api/v1/service-quality/public/[token]/route";
import { hashSurveyToken } from "./token";
const org = "aaaaaaaa-0000-4000-8000-000000000001",
  conversation = "aaaaaaaa-2222-4000-8000-000000000001",
  survey = "aaaaaaaa-3333-4000-8000-000000000001",
  token = "A".repeat(43);
const auth = {
  ok: true,
  user: { id: "aaaaaaaa-1111-4000-8000-000000000001", idioma: "pt-BR" },
  org: { orgId: org, role: "manager" },
};
const disabled = {
  enabled: false,
  first_response_target_seconds: null,
  resolution_target_seconds: null,
  clock_mode: "elapsed",
};
function request(path: string, method = "GET", body?: unknown) {
  return new NextRequest(`http://localhost${path}`, {
    method,
    headers: { "Content-Type": "application/json", "x-real-ip": "127.0.0.1" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}
function query(data: unknown = null, error: unknown = null) {
  const q = {
    select: vi.fn(),
    eq: vi.fn(),
    upsert: vi.fn(),
    maybeSingle: vi.fn(),
    single: vi.fn(),
  };
  q.select.mockReturnValue(q);
  q.eq.mockReturnValue(q);
  q.upsert.mockReturnValue(q);
  q.maybeSingle.mockResolvedValue({ data, error });
  q.single.mockResolvedValue({ data, error });
  return q;
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.auth.mockResolvedValue(auth);
  mocks.support.mockResolvedValue(null);
  mocks.audit.mockResolvedValue(undefined);
  mocks.rate.mockResolvedValue({ allowed: true });
});
describe("API autenticada, tenant e suporte", () => {
  it("nega viewer e sessão ausente antes de criar qualquer dado", async () => {
    const response = new Response("denied", { status: 403 });
    mocks.auth.mockResolvedValue({ ok: false, response });
    expect(await requestSurvey(request("/api/v1/service-quality/surveys", "POST", {}))).toBe(
      response,
    );
    expect(mocks.client).not.toHaveBeenCalled();
    expect(mocks.auth).toHaveBeenCalledWith("manager", expect.anything());
  });
  it("nega acompanhamento readonly antes do cliente/efeito", async () => {
    mocks.support.mockResolvedValue(new Response("readonly", { status: 403 }));
    expect(
      (await updatePolicy(request("/api/v1/service-quality/policy", "PUT", disabled))).status,
    ).toBe(403);
    expect(mocks.client).not.toHaveBeenCalled();
    expect(mocks.support).toHaveBeenCalledWith(org);
  });
  it("política usa org confiável e audita sem novo SLA", async () => {
    const q = query(disabled);
    mocks.client.mockResolvedValue({ from: vi.fn(() => q) });
    const response = await updatePolicy(request("/api/v1/service-quality/policy", "PUT", disabled));
    expect(response.status).toBe(200);
    expect(q.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ organization_id: org, ...disabled }),
      expect.anything(),
    );
    expect(q.eq).toHaveBeenCalledWith("organization_id", org);
    expect(mocks.audit).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: org,
        metadata: expect.objectContaining({ service_quality_action: "policy.updated" }),
      }),
    );
  });
  it("Zod rejeita tenant externo sem chegar ao banco", async () => {
    expect(
      (
        await updatePolicy(
          request("/api/v1/service-quality/policy", "PUT", { ...disabled, organization_id: org }),
        )
      ).status,
    ).toBe(422);
    expect(mocks.client).not.toHaveBeenCalled();
  });
  it("cria link uma vez, guarda só hash e não chama messenger", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: { id: survey, conversation_id: conversation, expires_at: "2026-10-09T12:00:00Z" },
      error: null,
    });
    mocks.client.mockResolvedValue({ rpc });
    const response = await requestSurvey(
      request("/api/v1/service-quality/surveys", "POST", {
        conversation_id: conversation,
        expires_hours: 24,
      }),
    );
    const body = await response.json();
    expect(response.status).toBe(201);
    expect(body.data.sent).toBe(false);
    const emitted = body.data.feedback_path.split("/").at(-1);
    expect(rpc).toHaveBeenCalledWith(
      "fn_service_quality_request",
      expect.objectContaining({
        p_org: org,
        p_conversation: conversation,
        p_hash: hashSurveyToken(emitted),
      }),
    );
    expect(JSON.stringify(mocks.audit.mock.calls)).not.toContain(emitted);
    expect(JSON.stringify(mocks.audit.mock.calls)).not.toContain(hashSurveyToken(emitted));
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });
  it("snapshot pagina sem limite de mensagens e resumo CSAT não é truncado", async () => {
    const q = query(null);
    const rpc = vi.fn().mockImplementation((name: string) =>
      Promise.resolve(
        name === "fn_service_quality_facts"
          ? {
              data: [
                {
                  conversation_id: conversation,
                  status: "open",
                  service_started_at: null,
                  first_inbound_at: null,
                  first_response_at: null,
                  closed_at: null,
                },
              ],
              error: null,
            }
          : {
              data: {
                surveys: [],
                summary: {
                  total: 125,
                  csat_responses: 125,
                  csat_average: 4.1,
                  csat_low_scores: 3,
                  pending_surveys: 0,
                  expired_surveys: 0,
                },
              },
              error: null,
            },
      ),
    );
    mocks.client.mockResolvedValue({ from: vi.fn(() => q), rpc });
    const response = await snapshot(request("/api/v1/service-quality?limit=1"));
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.data.policy).toEqual(disabled);
    expect(body.data.summary.csat_responses).toBe(125);
    expect(body.data.survey_history_truncated).toBe(true);
    expect(rpc).toHaveBeenCalledWith(
      "fn_service_quality_facts",
      expect.objectContaining({ p_org: org, p_limit: 2 }),
    );
    expect(rpc).toHaveBeenCalledWith(
      "fn_service_quality_surveys",
      expect.objectContaining({ p_org: org, p_conversations: [conversation] }),
    );
  });
  it("falha de banco retorna wrapper sanitizado e request id", async () => {
    const rpc = vi
      .fn()
      .mockResolvedValue({ data: null, error: { code: "XX000", message: "sensitive_db_detail" } });
    mocks.client.mockResolvedValue({ rpc });
    const response = await requestSurvey(
      request("/api/v1/service-quality/surveys", "POST", {
        conversation_id: conversation,
        expires_hours: 1,
      }),
    );
    expect(response.status).toBe(500);
    expect(await response.text()).not.toContain("sensitive_db_detail");
    expect(response.headers.get("X-Request-Id")).toBeTruthy();
  });
});
describe("API pública tem guarda própria e uso único", () => {
  const context = { params: Promise.resolve({ token }) };
  it("limite aplicado antes de qualquer acesso service role, com retry", async () => {
    mocks.rate.mockResolvedValue({ allowed: false });
    const response = await respondSurvey(
      request(`/api/v1/service-quality/public/${token}`, "POST", { score: 5 }),
      context,
    );
    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("60");
    expect(mocks.admin).not.toHaveBeenCalled();
    expect(JSON.stringify(mocks.rate.mock.calls)).not.toContain(token);
  });
  it("token inválido não alcança banco", async () => {
    const response = await checkSurvey(request("/api/v1/service-quality/public/invalid"), {
      params: Promise.resolve({ token: "invalid" }),
    });
    expect(response.status).toBe(404);
    expect(mocks.admin).not.toHaveBeenCalled();
  });
  it("validação de score,comentário e tenant sem efeito", async () => {
    for (const body of [
      { score: 6 },
      { score: 5, organization_id: org },
      { score: 5, comment: "x".repeat(2001) },
    ])
      expect(
        (
          await respondSurvey(
            request(`/api/v1/service-quality/public/${token}`, "POST", body),
            context,
          )
        ).status,
      ).toBe(422);
    expect(mocks.admin).not.toHaveBeenCalled();
  });
  it("resgata somente pelo hash e resposta não expõe tenant nem conversa", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: { id: survey, organization_id: org, conversation_id: conversation, score: 4 },
      error: null,
    });
    mocks.admin.mockReturnValue({ rpc });
    const response = await respondSurvey(
      request(`/api/v1/service-quality/public/${token}`, "POST", {
        score: 4,
        comment: "  Sintético  ",
      }),
      context,
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ data: { accepted: true } });
    expect(rpc).toHaveBeenCalledWith("fn_service_quality_respond", {
      p_hash: hashSurveyToken(token),
      p_score: 4,
      p_comment: "Sintético",
    });
    expect(mocks.auth).not.toHaveBeenCalled();
  });
  it("expirado/usado/inexistente dão resposta genérica", async () => {
    mocks.admin.mockReturnValue({ rpc: vi.fn().mockResolvedValue({ data: null, error: null }) });
    expect(
      (
        await respondSurvey(
          request(`/api/v1/service-quality/public/${token}`, "POST", { score: 1 }),
          context,
        )
      ).status,
    ).toBe(404);
  });
  it("consulta pública expõe somente disponibilidade/idioma e deriva tenant do token", async () => {
    const s = query({
      organization_id: org,
      expires_at: new Date(Date.now() + 3600000).toISOString(),
      responded_at: null,
    });
    const o = query({ locale: "es" });
    mocks.admin.mockReturnValue({
      from: vi.fn((table: string) => (table === "organizations" ? o : s)),
    });
    const response = await checkSurvey(request(`/api/v1/service-quality/public/${token}`), context);
    expect(await response.json()).toEqual({ data: { available: true, locale: "es" } });
    expect(s.eq).toHaveBeenCalledWith("token_hash", hashSurveyToken(token));
    expect(o.eq).toHaveBeenCalledWith("id", org);
  });
  it("query pública não revela pesquisa já usada nem abre consulta da organização", async () => {
    const q = query({
      organization_id: org,
      expires_at: new Date(Date.now() + 3600000).toISOString(),
      responded_at: new Date().toISOString(),
    });
    const from = vi.fn(() => q);
    mocks.admin.mockReturnValue({ from });
    expect(
      (await checkSurvey(request(`/api/v1/service-quality/public/${token}`), context)).status,
    ).toBe(404);
    expect(from).toHaveBeenCalledTimes(1);
  });
});
