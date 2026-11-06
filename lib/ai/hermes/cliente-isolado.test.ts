import { describe, expect, it, vi } from "vitest";

import {
  consultarHermesIsolado,
  identidadeHermesPorConversa,
  HermesIsolamentoError,
} from "./cliente-isolado";

const ORG_A = "11111111-1111-4111-8111-111111111111";
const ORG_B = "22222222-2222-4222-8222-222222222222";
const CONVERSA_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const CONVERSA_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const TURNO = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const SEGREDO = "segredo-exclusivo-de-escopo-do-atenza-mais-de-32-caracteres";
const config = {
  baseUrl: "http://hermes-atenza:8642/v1",
  apiKey: "chave-de-teste-nao-real",
  scopeSecret: SEGREDO,
};

function turno(organizationId = ORG_A, conversationId = CONVERSA_A) {
  return {
    organizationId,
    conversationId,
    turnId: TURNO,
    instrucoesDaEmpresa: `Atenda somente a empresa ${organizationId}`,
    mensagens: [{ role: "user" as const, content: "Quero agendar" }],
  };
}
function resposta(content = "Posso ajudar com seu agendamento.") {
  return new Response(JSON.stringify({
    choices: [{ finish_reason: "stop", message: { role: "assistant", content } }],
  }), { status: 200, headers: { "content-type": "application/json" } });
}

describe("Hermes isolado por tenant + conversa", () => {
  it("mantém o identificador estável apenas para a mesma empresa e conversa", () => {
    const a = identidadeHermesPorConversa(ORG_A, CONVERSA_A, TURNO, SEGREDO);
    expect(a).toEqual(identidadeHermesPorConversa(ORG_A, CONVERSA_A, TURNO, SEGREDO));
    const outraOrg = identidadeHermesPorConversa(ORG_B, CONVERSA_A, TURNO, SEGREDO);
    const outroContato = identidadeHermesPorConversa(ORG_A, CONVERSA_B, TURNO, SEGREDO);
    expect(a.sessionId).not.toEqual(outraOrg.sessionId);
    expect(a.sessionId).not.toEqual(outroContato.sessionId);
    expect(a.sessionKey).not.toEqual(outraOrg.sessionKey);
    expect(a.sessionKey).not.toEqual(outroContato.sessionKey);
    expect(a.idempotencyKey).not.toEqual(outraOrg.idempotencyKey);
    expect(a.sessionKey).not.toContain(ORG_A);
    expect(a.sessionKey).not.toContain(CONVERSA_A);
  });

  it("envia somente contexto do tenant recebido, sem tools ou histórico compartilhado", async () => {
    const requests: { url: string; init: RequestInit }[] = [];
    const mockFetch = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      requests.push({ url: String(url), init: init! });
      return resposta();
    }) as unknown as typeof fetch;

    expect(await consultarHermesIsolado(turno(ORG_A), config, mockFetch))
      .toBe("Posso ajudar com seu agendamento.");
    expect(await consultarHermesIsolado(turno(ORG_B), config, mockFetch))
      .toBe("Posso ajudar com seu agendamento.");
    expect(requests).toHaveLength(2);
    expect(requests[0]!.url).toBe("http://hermes-atenza:8642/v1/chat/completions");

    const ha = new Headers(requests[0]!.init.headers);
    const hb = new Headers(requests[1]!.init.headers);
    expect(ha.get("X-Hermes-Session-Key")).not.toEqual(hb.get("X-Hermes-Session-Key"));
    expect(ha.get("X-Hermes-Session-Id")).not.toEqual(hb.get("X-Hermes-Session-Id"));
    expect(ha.get("Idempotency-Key")).not.toEqual(hb.get("Idempotency-Key"));

    const corpoA = JSON.parse(String(requests[0]!.init.body));
    const corpoB = JSON.parse(String(requests[1]!.init.body));
    expect(corpoA.messages).toHaveLength(2);
    expect(corpoB.messages).toHaveLength(2);
    expect(JSON.stringify(corpoA)).not.toContain(ORG_B);
    expect(JSON.stringify(corpoB)).not.toContain(ORG_A);
    expect(corpoA.tools).toBeUndefined();
  });

  it("recusa identidade incompleta e segredo fraco antes de requisitar", async () => {
    const mockFetch = vi.fn() as unknown as typeof fetch;
    await expect(consultarHermesIsolado(turno("org-qualquer"), config, mockFetch))
      .rejects.toMatchObject({ code: "identidade_invalida" });
    await expect(consultarHermesIsolado(turno(), { ...config, scopeSecret: "fraco" }, mockFetch))
      .rejects.toMatchObject({ code: "segredo_fraco" });
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("não permite endpoint HTTP na internet nem endpoint enviado com credenciais", async () => {
    const mockFetch = vi.fn() as unknown as typeof fetch;
    await expect(consultarHermesIsolado(turno(), {
      ...config, baseUrl: "http://site-publico.example/v1",
    }, mockFetch)).rejects.toMatchObject({ code: "endpoint_nao_privado" });
    await expect(consultarHermesIsolado(turno(), {
      ...config, baseUrl: "http://usuario:senha@hermes-atenza:8642/v1",
    }, mockFetch)).rejects.toMatchObject({ code: "endpoint_invalido" });
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("recusa erro e respostas interrompidas em vez de enviar mensagens parciais", async () => {
    const errorFetch = vi.fn(async () => new Response("internal", { status: 503 })) as unknown as typeof fetch;
    await expect(consultarHermesIsolado(turno(), config, errorFetch))
      .rejects.toMatchObject({ code: "hermes_http_503" });
    const partial = vi.fn(async () => new Response(JSON.stringify({
      choices: [{ finish_reason: "length", message: { content: "Comecei..." } }],
    }), { status: 200 })) as unknown as typeof fetch;
    await expect(consultarHermesIsolado(turno(), config, partial))
      .rejects.toMatchObject({ code: "resposta_incompleta" });
  });

  it("não permite prosseguir sem última mensagem do cliente", async () => {
    const mockFetch = vi.fn() as unknown as typeof fetch;
    await expect(consultarHermesIsolado({
      ...turno(), mensagens: [{ role: "assistant", content: "Ola" }],
    }, config, mockFetch)).rejects.toBeInstanceOf(HermesIsolamentoError);
    expect(mockFetch).not.toHaveBeenCalled();
  });
});
