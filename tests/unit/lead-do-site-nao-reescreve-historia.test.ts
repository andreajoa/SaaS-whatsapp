import { beforeEach, describe, expect, it, vi } from "vitest";

import { normalizarEmail, registrarLead } from "@/lib/marketing/lead";

/**
 * O QUE ESTE ARQUIVO PROVA — e por que ele existe.
 *
 * O cabeçalho de `lib/marketing/lead.ts` promete três coisas que um `upsert`
 * quebraria, e as três só dariam sinal SEMANAS depois de quebradas: a sequência
 * de quinze e-mails reiniciada, alguém que pediu para sair recebendo de novo, e
 * o nome de quem comprou apagado por quem voltou pelo rodapé. Nenhuma delas
 * aparece em typecheck, em lint ou olhando a tela — a primeira notícia seria
 * uma reclamação de spam, que não tem volta.
 *
 * Por isso a prova é aqui, no nível da função: um cliente falso registra TUDO
 * que ela pediria ao banco, e os casos abaixo medem o que ela NÃO escreveu.
 */

/** O que a leitura devolve, em ordem. A última resposta se repete. */
type Leitura = { data: Record<string, unknown> | null; error: { code?: string } | null };

const estado: {
  semServiceRole: boolean;
  leituras: Leitura[];
  erroInsert: { code?: string } | null;
} = { semServiceRole: false, leituras: [], erroInsert: null };

const registro: {
  atualizacoes: Record<string, unknown>[];
  insercoes: Record<string, unknown>[];
} = { atualizacoes: [], insercoes: [] };

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => {
    if (estado.semServiceRole) throw new Error("SUPABASE_SERVICE_ROLE_KEY ausente");
    return {
      from: () => ({
        select: () => {
          const q = {
            eq: () => q,
            maybeSingle: async () =>
              estado.leituras.length > 1
                ? (estado.leituras.shift() as Leitura)
                : (estado.leituras[0] ?? { data: null, error: null }),
          };
          return q;
        },
        update: (remendo: Record<string, unknown>) => {
          registro.atualizacoes.push(remendo);
          return { eq: async () => ({ error: null }) };
        },
        insert: (linha: Record<string, unknown>) => {
          registro.insercoes.push(linha);
          return {
            select: () => ({
              maybeSingle: async () =>
                estado.erroInsert
                  ? { data: null, error: estado.erroInsert }
                  : { data: { id: "id-novo" }, error: null },
            }),
          };
        },
      }),
    };
  },
}));

/**
 * As colunas que contam a HISTÓRIA da pessoa. Um formulário público não
 * reescreve nenhuma delas — e é a lista inteira que este arquivo vigia, não só
 * as que hoje têm caso próprio: coluna nova de histórico que entre em
 * `ENRIQUECIVEIS` por engano cai aqui.
 */
const INTOCAVEIS = ["status", "proximo_passo", "descadastrado_em", "origem", "token_descadastro"];

beforeEach(() => {
  estado.semServiceRole = false;
  estado.leituras = [];
  estado.erroInsert = null;
  registro.atualizacoes = [];
  registro.insercoes = [];
});

describe("normalizarEmail", () => {
  it("apara e baixa a caixa — é assim que o índice único enxerga", () => {
    expect(normalizarEmail("  Ana@Exemplo.COM  ")).toBe("ana@exemplo.com");
  });
});

describe("registrarLead: quem já está na lista", () => {
  it("não reinicia a sequência de e-mails de quem já recebeu", async () => {
    estado.leituras = [
      { data: { id: "id-1", proximo_passo: 9, nome: "Ana", city: "Santos" }, error: null },
    ];

    const r = await registrarLead({ email: "ana@exemplo.com", origem: "rodape" });

    expect(r).toEqual({ tipo: "conhecido", id: "id-1" });
    expect(registro.insercoes).toHaveLength(0);
    for (const remendo of registro.atualizacoes) {
      for (const coluna of INTOCAVEIS) expect(Object.keys(remendo)).not.toContain(coluna);
    }
  });

  it("preenche a lacuna sem escrever por cima do que já se sabia", async () => {
    estado.leituras = [{ data: { id: "id-1", nome: "Ana", city: null }, error: null }];

    await registrarLead({
      email: "ana@exemplo.com",
      origem: "popup",
      nome: "ana (digitado com pressa)",
      city: "Santos",
    });

    expect(registro.atualizacoes).toEqual([{ city: "Santos" }]);
  });

  it("não escreve nada quando não há lacuna a preencher", async () => {
    estado.leituras = [{ data: { id: "id-1", nome: "Ana", city: "Santos" }, error: null }];

    await registrarLead({ email: "ana@exemplo.com", origem: "rodape", nome: "Ana" });

    expect(registro.atualizacoes).toHaveLength(0);
  });

  it('trata "" e "   " como ausência, e não como dado que preenche lacuna', async () => {
    estado.leituras = [{ data: { id: "id-1", nome: null }, error: null }];

    await registrarLead({ email: "ana@exemplo.com", origem: "rodape", nome: "   " });

    expect(registro.atualizacoes).toHaveLength(0);
  });
});

describe("registrarLead: quem pediu para sair", () => {
  it("continua fora — o formulário aberto não desfaz o descadastro", async () => {
    estado.leituras = [
      {
        data: { id: "id-1", descadastrado_em: "2026-09-01T00:00:00Z", nome: null },
        error: null,
      },
    ];

    const r = await registrarLead({
      email: "ana@exemplo.com",
      origem: "popup",
      nome: "Ana",
      city: "Santos",
    });

    expect(r).toEqual({ tipo: "descadastrado" });
    // Nem sequer enriquece: tocar na linha de quem saiu é tratá-la como ativa.
    expect(registro.atualizacoes).toHaveLength(0);
    expect(registro.insercoes).toHaveLength(0);
  });
});

describe("registrarLead: quem é novo", () => {
  it("grava o e-mail normalizado e devolve a linha nova", async () => {
    const r = await registrarLead({ email: "  Ana@Exemplo.COM ", origem: "rodape" });

    expect(r).toEqual({ tipo: "novo", id: "id-novo" });
    expect(registro.insercoes[0]?.email).toBe("ana@exemplo.com");
  });

  it("não inventa `proximo_passo` nem `status` — o default do banco manda", async () => {
    await registrarLead({ email: "ana@exemplo.com", origem: "rodape" });

    for (const coluna of INTOCAVEIS) {
      if (coluna === "origem") continue; // a origem da PRIMEIRA entrada é dado, não história
      expect(Object.keys(registro.insercoes[0] ?? {})).not.toContain(coluna);
    }
  });

  it("23505 é corrida entre duas abas, não falha", async () => {
    estado.leituras = [
      { data: null, error: null }, // a busca, antes da outra aba inserir
      { data: { id: "id-1" }, error: null }, // a re-busca, depois do 23505
    ];
    estado.erroInsert = { code: "23505" };

    const r = await registrarLead({ email: "ana@exemplo.com", origem: "popup" });

    expect(r).toEqual({ tipo: "conhecido", id: "id-1" });
  });
});

describe("registrarLead: quando o banco não responde", () => {
  it('erro de leitura é "não sei", nunca "não existe" — e não vira INSERT', async () => {
    estado.leituras = [{ data: null, error: { code: "42P01" } }];

    const r = await registrarLead({ email: "ana@exemplo.com", origem: "rodape" });

    expect(r).toEqual({ tipo: "sem_banco" });
    expect(registro.insercoes).toHaveLength(0);
  });

  it("clone sem service role não quebra a página de vendas", async () => {
    estado.semServiceRole = true;

    const r = await registrarLead({ email: "ana@exemplo.com", origem: "rodape" });

    expect(r).toEqual({ tipo: "sem_banco" });
  });

  it("e-mail vazio não chega ao banco", async () => {
    const r = await registrarLead({ email: "   ", origem: "rodape" });

    expect(r).toEqual({ tipo: "sem_banco" });
    expect(registro.insercoes).toHaveLength(0);
  });
});
