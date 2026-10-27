/**
 * Conexão do WhatsApp por QR pela conta da instalação.
 *
 * Os quatro lugares onde ela pode dar errado sem ninguém ver:
 *
 *   1. o estado da volta — se aceitar assinatura forjada, qualquer um grava
 *      número na organização de outro; se passar de 258 caracteres, o provedor
 *      recusa o link e o botão "não faz nada";
 *   2. a conversa com o provedor — perfil duplicado a cada clique, conta de
 *      OUTRO perfil gravada aqui, webhook que fica desligado;
 *   3. a entrada única — evento sem assinatura processado, ou conta de duas
 *      organizações entregue a uma delas por sorte;
 *   4. a volta — sessão gravada sem o provedor confirmar, ou o agente que
 *      esperava canal ficando rascunho para sempre.
 */
import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const SEGREDO = "segredo-do-servidor-com-mais-de-16";
const ORG = "11111111-2222-4333-8444-555555555555";
const USER = "66666666-7777-4888-9999-aaaaaaaaaaaa";

// ─── mocks compartilhados ────────────────────────────────────────────────────

vi.mock("@/lib/env", () => ({
  env: { INTERNAL_SECRET: "segredo-do-servidor-com-mais-de-16", NEXT_PUBLIC_APP_URL: "https://www.exemplo.com.br" },
}));

const sessoes: { linhas: unknown[] } = { linhas: [] };
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: () => {
      const q: Record<string, unknown> = {};
      const encadear = () => q;
      for (const m of ["select", "eq", "is", "limit"]) q[m] = encadear;
      q.maybeSingle = async () => ({ data: { display_name: "Clínica Sorriso", legal_name: "" }, error: null });
      q.then = (resolve: (v: unknown) => void) => resolve({ data: sessoes.linhas, error: null });
      return q;
    },
  }),
}));

const processados: unknown[] = [];
vi.mock("@/lib/channels/entrada-da-sessao", () => ({
  processarEntradaDaSessao: async (_admin: unknown, sessao: unknown) => {
    processados.push(sessao);
    return new Response(JSON.stringify({ data: { status: "ingested" } }), { status: 200 });
  },
}));

const auditados: { action: string; metadata?: Record<string, unknown> }[] = [];
vi.mock("@/lib/audit", () => ({
  audit: async (e: { action: string; metadata?: Record<string, unknown> }) => {
    auditados.push(e);
  },
}));

import {
  emitirEstadoQr,
  verificarEstadoQr,
  VALIDADE_DO_ESTADO_QR_MS,
} from "@/lib/channels/conexao-por-qr-estado";
import {
  contaDoPerfil,
  desconectarConta,
  garantirPerfil,
  garantirWebhook,
  linkDeConexao,
  segredoDoWebhookDaPlataforma,
} from "@/lib/channels/zernio/plataforma";

// ─── 1. o estado da volta ───────────────────────────────────────────────────

describe("o estado da volta", () => {
  const agora = new Date("2026-10-26T12:00:00Z");

  it("ida e volta: devolve a organização e quem iniciou", () => {
    const e = emitirEstadoQr({ organizationId: ORG, userId: USER }, { segredo: SEGREDO, agora });
    expect(verificarEstadoQr(e, { segredo: SEGREDO, agora })).toMatchObject({
      organizationId: ORG,
      userId: USER,
    });
  });

  it("recusa organização trocada, assinatura de outro segredo e prazo vencido", () => {
    const e = emitirEstadoQr({ organizationId: ORG, userId: USER }, { segredo: SEGREDO, agora });
    const outraOrg = "99999999-2222-4333-8444-555555555555";
    expect(verificarEstadoQr({ ...e, o: outraOrg }, { segredo: SEGREDO, agora })).toBeNull();
    expect(verificarEstadoQr({ ...e, u: outraOrg }, { segredo: SEGREDO, agora })).toBeNull();
    expect(verificarEstadoQr(e, { segredo: `${SEGREDO}-outro`, agora })).toBeNull();
    const depois = new Date(agora.getTime() + VALIDADE_DO_ESTADO_QR_MS + 1);
    expect(verificarEstadoQr(e, { segredo: SEGREDO, agora: depois })).toBeNull();
  });

  it("recusa formato estranho sem lançar", () => {
    expect(verificarEstadoQr({ o: null, u: null, x: null, s: null }, { segredo: SEGREDO, agora })).toBeNull();
    expect(verificarEstadoQr({ o: "x", u: USER, x: "zz", s: "a".repeat(32) }, { segredo: SEGREDO, agora })).toBeNull();
  });

  it("o link de volta cabe no teto de 258 caracteres do provedor", () => {
    // Medido na doc: `redirect_url` codificado acima de 258 → 400. Com um domínio
    // longo de self-host, a sobra precisa existir.
    const e = emitirEstadoQr({ organizationId: ORG, userId: USER }, { segredo: SEGREDO, agora });
    const volta = new URL("https://atendimento.empresa-cliente.com.br/api/v1/channels/partner/qr/retorno");
    for (const [k, v] of Object.entries({ o: e.o, u: e.u, x: e.x, s: e.s, d: "o" })) volta.searchParams.set(k, v);
    expect(encodeURIComponent(volta.toString()).length).toBeLessThanOrEqual(258);
  });
});

// ─── 2. a conversa com o provedor ───────────────────────────────────────────

type Chamada = { url: string; method: string; body: unknown; headers: Record<string, string> };
let chamadas: Chamada[] = [];
let respostas: { status: number; json: unknown }[] = [];

function responder(...rs: { status: number; json: unknown }[]) {
  respostas = rs;
}

beforeEach(() => {
  chamadas = [];
  respostas = [];
  processados.length = 0;
  auditados.length = 0;
  sessoes.linhas = [];
  process.env.ZERNIO_API_KEY = "sk_teste_da_instalacao";
  vi.stubGlobal("fetch", async (url: string, init: RequestInit = {}) => {
    chamadas.push({
      url,
      method: init.method ?? "GET",
      body: init.body ? JSON.parse(String(init.body)) : undefined,
      headers: (init.headers ?? {}) as Record<string, string>,
    });
    const r = respostas.shift() ?? { status: 500, json: { error: "sem resposta programada" } };
    return new Response(JSON.stringify(r.json), { status: r.status });
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.ZERNIO_API_KEY;
});

describe("o perfil da organização", () => {
  it("reusa o perfil achado pelo id da organização — não cria outro a cada clique", async () => {
    responder({ status: 200, json: { profiles: [{ _id: "perfil-1", externalId: ORG }] } });
    await expect(garantirPerfil("k", ORG, "Clínica")).resolves.toBe("perfil-1");
    expect(chamadas).toHaveLength(1);
    expect(chamadas[0]!.url).toContain(`externalId=${ORG}`);
  });

  it("cria com externalId e chave de idempotência quando não existe", async () => {
    responder({ status: 200, json: { profiles: [] } }, { status: 201, json: { profile: { _id: "perfil-novo" } } });
    await expect(garantirPerfil("k", ORG, "Clínica Sorriso")).resolves.toBe("perfil-novo");
    expect(chamadas[1]!).toMatchObject({ method: "POST", body: { externalId: ORG } });
    expect(chamadas[1]!.headers["Idempotency-Key"]).toBe(`perfil-${ORG}`);
  });

  it("409 de corrida devolve o perfil que já existe", async () => {
    responder(
      { status: 200, json: { profiles: [] } },
      { status: 409, json: { error: "dup", details: { existingProfileId: "perfil-da-corrida" } } },
    );
    await expect(garantirPerfil("k", ORG, "X")).resolves.toBe("perfil-da-corrida");
  });
});

describe("o webhook único", () => {
  it("existente é ATUALIZADO e religado — o provedor desliga depois de 3 dias falhando", async () => {
    responder(
      { status: 200, json: { webhooks: [{ _id: "wh-1", url: "https://x/api/v1/webhooks/channel/plataforma", isActive: false }] } },
      { status: 200, json: { success: true } },
    );
    await garantirWebhook("k", "https://x/api/v1/webhooks/channel/plataforma", "seg");
    expect(chamadas[1]!).toMatchObject({ method: "PUT", body: { webhookId: "wh-1", isActive: true, secret: "seg" } });
  });

  it("ausente é criado com os eventos de mensagem e de conta", async () => {
    responder({ status: 200, json: { webhooks: [] } }, { status: 200, json: { success: true } });
    await garantirWebhook("k", "https://x/h", "seg");
    const corpo = chamadas[1]!.body as { events: string[] };
    expect(chamadas[1]!.method).toBe("POST");
    expect(corpo.events).toEqual(expect.arrayContaining(["message.received", "account.disconnected"]));
  });

  it("o segredo é derivado do segredo do servidor e não muda entre chamadas", () => {
    expect(segredoDoWebhookDaPlataforma(SEGREDO)).toBe(segredoDoWebhookDaPlataforma(SEGREDO));
    expect(segredoDoWebhookDaPlataforma(SEGREDO)).not.toBe(segredoDoWebhookDaPlataforma(`${SEGREDO}x`));
  });
});

describe("o link e a conta", () => {
  it("pede a janela hospedada, em coexistência, no idioma da pessoa", async () => {
    responder({ status: 200, json: { authUrl: "https://janela.exemplo/abc" } });
    const url = await linkDeConexao("k", {
      profileId: "perfil-1",
      redirectUrl: "https://x/volta",
      marca: "Atendimento",
      idioma: "es",
      corPrimaria: "#123abc",
    });
    expect(url).toBe("https://janela.exemplo/abc");
    const q = new URL(chamadas[0]!.url).searchParams;
    expect(Object.fromEntries(q)).toMatchObject({
      profileId: "perfil-1",
      signup: "hosted",
      onboarding: "business_app",
      language: "es",
      primaryColor: "#123abc",
    });
  });

  it("conta de OUTRO perfil nunca é aceita, mesmo que a lista a traga", async () => {
    responder({
      status: 200,
      json: { accounts: [{ _id: "conta-1", platform: "whatsapp", profileId: { _id: "perfil-de-outro" } }] },
    });
    await expect(contaDoPerfil("k", "perfil-1", "conta-1")).resolves.toBeNull();
  });

  it("conta do perfil volta com o telefone em E.164", async () => {
    responder({
      status: 200,
      json: {
        accounts: [
          {
            _id: "conta-1",
            platform: "whatsapp",
            profileId: { _id: "perfil-1" },
            displayName: "Clínica",
            metadata: { displayPhoneNumber: "+55 11 90000-1234" },
          },
        ],
      },
    });
    await expect(contaDoPerfil("k", "perfil-1", "conta-1")).resolves.toEqual({
      accountId: "conta-1",
      telefone: "+5511900001234",
      nome: "Clínica",
    });
  });

  it("desconectar trata 404 como feito", async () => {
    responder({ status: 404, json: { error: "not found" } });
    await expect(desconectarConta("k", "conta-1")).resolves.toBeUndefined();
  });
});

// ─── 3. a entrada única ─────────────────────────────────────────────────────

describe("POST /api/v1/webhooks/channel/plataforma", () => {
  const segredoDoWebhook = segredoDoWebhookDaPlataforma(SEGREDO);
  const pedido = (corpo: unknown, segredo = segredoDoWebhook) => {
    const cru = JSON.stringify(corpo);
    return {
      text: async () => cru,
      headers: new Headers({ "x-zernio-signature": createHmac("sha256", segredo).update(cru).digest("hex") }),
    } as never;
  };
  const evento = {
    event: "message.received",
    profiles: [{ id: "perfil-1", externalId: ORG }],
    account: { id: "conta-1" },
    message: { id: "m1" },
  };

  it("assinatura errada é 401, antes de qualquer consulta", async () => {
    const { POST } = await import("@/app/api/v1/webhooks/channel/plataforma/route");
    const r = await POST(pedido(evento, "outro-segredo"));
    expect(r.status).toBe(401);
    expect(processados).toHaveLength(0);
  });

  it("sem a chave da instalação a rota não existe (404)", async () => {
    delete process.env.ZERNIO_API_KEY;
    const { POST } = await import("@/app/api/v1/webhooks/channel/plataforma/route");
    expect((await POST(pedido(evento))).status).toBe(404);
  });

  it("evento sem conta e conta sem sessão respondem 200 sem processar", async () => {
    const { POST } = await import("@/app/api/v1/webhooks/channel/plataforma/route");
    expect((await POST(pedido({ event: "whatsapp.number.activated" }))).status).toBe(200);
    expect((await POST(pedido(evento))).status).toBe(200);
    expect(processados).toHaveLength(0);
  });

  it("evento sem o perfil da organização não é entregue (não há como saber o dono)", async () => {
    sessoes.linhas = [{ id: "sessao-1", organization_id: ORG, provider: "zernio" }];
    const { POST } = await import("@/app/api/v1/webhooks/channel/plataforma/route");
    const { profiles: _sem, ...semPerfil } = evento;
    expect((await POST(pedido(semPerfil))).status).toBe(200);
    expect(processados).toHaveLength(0);
  });

  it("conta em DUAS sessões ativas não é entregue a nenhuma", async () => {
    sessoes.linhas = [{ id: "a", organization_id: "o1" }, { id: "b", organization_id: "o2" }];
    const { POST } = await import("@/app/api/v1/webhooks/channel/plataforma/route");
    const r = await POST(pedido(evento));
    expect(r.status).toBe(200);
    expect(processados).toHaveLength(0);
  });

  it("conta com sessão vai para o miolo comum", async () => {
    sessoes.linhas = [{ id: "sessao-1", organization_id: ORG, provider: "zernio" }];
    const { POST } = await import("@/app/api/v1/webhooks/channel/plataforma/route");
    expect((await POST(pedido(evento))).status).toBe(200);
    expect(processados).toEqual([expect.objectContaining({ id: "sessao-1" })]);
  });
});
