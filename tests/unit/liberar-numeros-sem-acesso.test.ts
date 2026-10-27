/**
 * O vigia que tira da conta da instalação o número de quem perdeu o acesso.
 *
 * O erro caro aqui é um só: desconectar o WhatsApp de quem PAGA. Por isso os
 * casos vigiam, antes de tudo, o que ele NÃO toca — acesso em dia, falha de
 * leitura (que a cobrança devolve como `em_dia`), folga ainda correndo e número
 * conectado com a conta do próprio cliente.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const CHAVE = "sk_da_instalacao";
const DIA = 86_400_000;
const AGORA = new Date("2026-11-30T12:00:00Z");

vi.mock("@/lib/webhooks/secrets", () => ({
  decryptWebhookSecret: async (_a: unknown, v: string) => v.replace(/^cifrado:/, ""),
  encryptWebhookSecret: async (_a: unknown, v: string) => `cifrado:${v}`,
}));

let sessoes: Record<string, unknown>[] = [];
const atualizacoes: Record<string, unknown>[] = [];

function admin() {
  return {
    from: (tabela: string) => {
      const q: Record<string, unknown> = {};
      for (const m of ["select", "eq", "neq", "not", "is", "limit"]) q[m] = () => q;
      q.maybeSingle = async () => ({ data: { created_at: "2026-09-01T00:00:00Z" }, error: null });
      q.update = (patch: Record<string, unknown>) => {
        atualizacoes.push(patch);
        return q;
      };
      q.then = (resolve: (v: unknown) => void) =>
        resolve({ data: tabela === "channel_sessions" ? sessoes : [], error: null });
      return q;
    },
  } as never;
}

const desconectadas: string[] = [];

beforeEach(() => {
  sessoes = [];
  atualizacoes.length = 0;
  desconectadas.length = 0;
  process.env.ZERNIO_API_KEY = CHAVE;
  vi.stubGlobal("fetch", async (url: string, init: RequestInit = {}) => {
    if (init.method === "DELETE") desconectadas.push(url.split("/").pop() ?? "");
    return new Response(JSON.stringify({ message: "ok" }), { status: 200 });
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.ZERNIO_API_KEY;
});

import { liberarNumerosSemAcesso, semAcessoDesde } from "@/lib/channels/conexao-por-qr";

const sessao = (id: string, chave = CHAVE) => ({
  id,
  organization_id: `org-${id}`,
  zernio_account_id: `conta-${id}`,
  zernio_token_encrypted: `cifrado:${chave}`,
  status: "WORKING",
});

describe("semAcessoDesde", () => {
  it("só os dois estados explícitos contam", () => {
    for (const acesso of ["em_dia", "trial", "teste_sem_cartao", "teste_nao_iniciado", "nao_cobra"]) {
      expect(semAcessoDesde({ acesso, expiraEm: new Date(0) }, null)).toBeNull();
    }
    expect(semAcessoDesde({ acesso: "vencido", expiraEm: new Date(5) }, null)).toEqual(new Date(5));
  });

  it("sem_cartao sem data conta do prazo de começar o teste", () => {
    const criada = new Date("2026-09-01T00:00:00Z");
    expect(semAcessoDesde({ acesso: "sem_cartao", expiraEm: null }, criada)).toEqual(
      new Date(criada.getTime() + 14 * DIA),
    );
  });
});

describe("liberarNumerosSemAcesso", () => {
  it("quem paga nunca é tocado", async () => {
    sessoes = [sessao("a")];
    const r = await liberarNumerosSemAcesso(admin(), {
      agora: AGORA,
      estadoDaOrganizacao: async () => ({ acesso: "em_dia", expiraEm: null }),
    });
    expect(r.liberados).toHaveLength(0);
    expect(desconectadas).toHaveLength(0);
    expect(atualizacoes).toHaveLength(0);
  });

  it("dentro da folga de 14 dias, o número fica", async () => {
    sessoes = [sessao("a")];
    const r = await liberarNumerosSemAcesso(admin(), {
      agora: AGORA,
      estadoDaOrganizacao: async () => ({ acesso: "vencido", expiraEm: new Date(AGORA.getTime() - 13 * DIA) }),
    });
    expect(r.liberados).toHaveLength(0);
  });

  it("número da conta PRÓPRIA do cliente não é custo nosso e não é tocado", async () => {
    sessoes = [sessao("a", "sk_do_cliente")];
    const r = await liberarNumerosSemAcesso(admin(), {
      agora: AGORA,
      estadoDaOrganizacao: async () => ({ acesso: "vencido", expiraEm: new Date(0) }),
    });
    expect(r.liberados).toHaveLength(0);
    expect(desconectadas).toHaveLength(0);
  });

  it("passada a folga: desconecta no provedor e deixa o canal PARADO", async () => {
    sessoes = [sessao("a")];
    const r = await liberarNumerosSemAcesso(admin(), {
      agora: AGORA,
      estadoDaOrganizacao: async () => ({ acesso: "sem_cartao", expiraEm: new Date(AGORA.getTime() - 15 * DIA) }),
    });
    expect(r.liberados).toEqual([{ organizationId: "org-a", channelSessionId: "a" }]);
    expect(desconectadas).toEqual(["conta-a"]);
    expect(atualizacoes).toEqual([expect.objectContaining({ status: "STOPPED", status_reason: "sem_acesso_ao_plano" })]);
  });

  it("sem a chave da instalação a rodada não consulta nada", async () => {
    delete process.env.ZERNIO_API_KEY;
    sessoes = [sessao("a")];
    const r = await liberarNumerosSemAcesso(admin(), {
      agora: AGORA,
      estadoDaOrganizacao: async () => ({ acesso: "vencido", expiraEm: new Date(0) }),
    });
    expect(r).toEqual({ conferidos: 0, liberados: [] });
  });
});
