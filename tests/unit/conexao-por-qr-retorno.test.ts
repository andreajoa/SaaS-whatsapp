/**
 * A volta da conexão por QR (`app/api/v1/channels/partner/qr/retorno`).
 *
 * A rota é PÚBLICA (o cookie strict não viaja na volta de outro site), então o
 * que ela grava depende só de duas provas: o estado assinado e a confirmação do
 * provedor. Estes casos vigiam que nenhuma das duas é pulada, e que o sucesso
 * deixa o passo do onboarding cumprido e o agente no ar.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import type * as ModuloDaConexao from "@/lib/channels/conexao-por-qr";

const SEGREDO = "segredo-do-servidor-com-mais-de-16";
const ORG = "11111111-2222-4333-8444-555555555555";
const USER = "66666666-7777-4888-9999-aaaaaaaaaaaa";

vi.mock("@/lib/env", () => ({
  env: { INTERNAL_SECRET: "segredo-do-servidor-com-mais-de-16", NEXT_PUBLIC_APP_URL: "https://www.exemplo.com.br" },
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({ maybeSingle: async () => ({ data: { display_name: "Clínica", legal_name: "" }, error: null }) }),
      }),
    }),
  }),
}));

vi.mock("@/lib/impersonate/support", () => ({ supportCallbackWriteAllowed: async () => true }));

const auditados: { action: string; metadata?: Record<string, unknown> }[] = [];
vi.mock("@/lib/audit", () => ({
  audit: async (e: { action: string; metadata?: Record<string, unknown> }) => {
    auditados.push(e);
  },
}));

const concluidas: unknown[] = [];
let falharConclusao: Error | null = null;
vi.mock("@/lib/channels/conexao-por-qr", async (importOriginal) => {
  const real = await importOriginal<typeof ModuloDaConexao>();
  return {
    ...real,
    concluirConexaoPorQr: async (_admin: unknown, dados: unknown) => {
      if (falharConclusao) throw falharConclusao;
      concluidas.push(dados);
      return { channelSessionId: "sessao-1", accountId: "conta-1", telefone: "+5511999999999", nome: "Clínica", nova: true };
    },
  };
});

const patches: unknown[] = [];
vi.mock("@/app/actions/onboarding/_shared", () => ({
  patchOnboardingState: async (_org: string, patch: unknown) => {
    patches.push(patch);
  },
}));
const publicados: string[] = [];
vi.mock("@/app/actions/onboarding/_agente-que-esperava-canal", () => ({
  publicarAgenteQueEsperavaCanal: async (_a: unknown, org: string) => {
    publicados.push(org);
  },
}));

import { emitirEstadoQr } from "@/lib/channels/conexao-por-qr-estado";
import { ErroDaConexaoPorQr } from "@/lib/channels/conexao-por-qr";
import { GET } from "@/app/api/v1/channels/partner/qr/retorno/route";

function volta(extra: Record<string, string>, estado = emitirEstadoQr({ organizationId: ORG, userId: USER }, { segredo: SEGREDO, agora: new Date() })) {
  const u = new URL("https://www.exemplo.com.br/api/v1/channels/partner/qr/retorno");
  for (const [k, v] of Object.entries({ ...estado, ...extra })) u.searchParams.set(k, v);
  return { url: u.toString() } as never;
}

async function destino(r: Response): Promise<string> {
  const html = await r.text();
  const m = html.match(/location\.replace\("([^"]+)"\)/);
  return m?.[1] ?? "";
}

beforeEach(() => {
  auditados.length = 0;
  concluidas.length = 0;
  patches.length = 0;
  publicados.length = 0;
  falharConclusao = null;
});

describe("GET /api/v1/channels/partner/qr/retorno", () => {
  it("estado forjado não grava nada e não audita (rota pública)", async () => {
    const r = await GET(volta({ s: "0".repeat(32), d: "o", connected: "whatsapp", accountId: "conta-1" }));
    expect(await destino(r)).toContain("motivo=retorno_invalido");
    expect(concluidas).toHaveLength(0);
    expect(auditados).toHaveLength(0);
  });

  it("cancelamento na janela volta com o motivo, sem gravar", async () => {
    const r = await GET(volta({ d: "c", error: "connection_cancelled", platform: "whatsapp" }));
    expect(await destino(r)).toBe("https://www.exemplo.com.br/app/connections?qr=erro&motivo=cancelado");
    expect(concluidas).toHaveLength(0);
    expect(auditados[0]).toMatchObject({ action: "channel.qr_connect_failed" });
  });

  it("número já usado em outra conta vira 'numero_em_uso'", async () => {
    const r = await GET(volta({ d: "o", error: "whatsapp_number_already_connected" }));
    expect(await destino(r)).toBe(
      "https://www.exemplo.com.br/onboarding/connect-whatsapp?qr=erro&motivo=numero_em_uso",
    );
  });

  it("sucesso: confere com o provedor, cumpre o passo e põe o agente no ar", async () => {
    const r = await GET(volta({ d: "o", connected: "whatsapp", accountId: "conta-1", profileId: "perfil-1" }));
    expect(await destino(r)).toBe("https://www.exemplo.com.br/onboarding");
    expect(concluidas).toEqual([
      expect.objectContaining({ organizationId: ORG, accountId: "conta-1", profileIdDaVolta: "perfil-1" }),
    ]);
    expect(patches).toEqual([{ whatsapp: { session_id: "sessao-1", status: "WORKING" } }]);
    expect(publicados).toEqual([ORG]);
    expect(auditados.map((a) => a.action)).toContain("channel.qr_connected");
  });

  it("provedor não confirma a conta: nada de passo cumprido nem agente publicado", async () => {
    falharConclusao = new ErroDaConexaoPorQr("conta_nao_encontrada", "não é deste perfil");
    const r = await GET(volta({ d: "c", connected: "whatsapp", accountId: "conta-de-outro" }));
    expect(await destino(r)).toBe("https://www.exemplo.com.br/app/connections?qr=erro&motivo=falhou");
    expect(patches).toHaveLength(0);
    expect(publicados).toHaveLength(0);
  });
});
