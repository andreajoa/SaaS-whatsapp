/**
 * A função que decide se uma empresa ainda entra no sistema.
 *
 * Os dois erros possíveis aqui não são simétricos. Liberar um dia a mais de
 * graça custa centavos; trancar quem pagou desliga o WhatsApp de uma empresa
 * inteira, e ela descobre pelos clientes dela. Por isso metade destes casos
 * existe para provar que o gate FALHA ABERTO.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { estadoDaCobranca } from "@/lib/billing/assinatura";

type Linha = Record<string, unknown> | null;

/** Um `SupabaseClient` de mentira que só sabe responder UMA consulta. */
function bancoQueDevolve(linha: Linha, explode = false) {
  return {
    from() {
      return {
        select() {
          return {
            eq() {
              return {
                async maybeSingle() {
                  if (explode) throw new Error("conexão caiu");
                  return { data: linha, error: null };
                },
              };
            },
          };
        },
      };
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

const AGORA = new Date("2026-03-01T12:00:00Z");
const ORG = "11111111-1111-4111-8111-111111111111";

const CHAVE_ORIGINAL = process.env.STRIPE_SECRET_KEY;

beforeEach(() => {
  process.env.STRIPE_SECRET_KEY = "sk_test_para_ligar_o_interruptor";
});
afterEach(() => {
  if (CHAVE_ORIGINAL === undefined) delete process.env.STRIPE_SECRET_KEY;
  else process.env.STRIPE_SECRET_KEY = CHAVE_ORIGINAL;
});

describe("estadoDaCobranca — o interruptor do self-host", () => {
  it("sem STRIPE_SECRET_KEY nada é cobrado e o banco nem é consultado", async () => {
    // O caso mais importante do arquivo: é o estado de TODA instalação que
    // clonou este repo. Um `vencido` aqui trancaria a instalação inteira de
    // alguém que nunca comprou nada.
    delete process.env.STRIPE_SECRET_KEY;
    const estado = await estadoDaCobranca(
      bancoQueDevolve(null, true), // explodiria se fosse consultado
      ORG,
      "2020-01-01T00:00:00Z",
      AGORA,
    );
    expect(estado.acesso).toBe("nao_cobra");
    expect(estado.plano).toBeNull();
  });
});

/**
 * Banco de mentira que responde POR TABELA: `org_subscriptions` devolve a linha
 * da assinatura e `messages` devolve a 1ª resposta da IA (ou nada).
 */
function bancoPorTabela(assinatura: Linha, primeiraRespostaDaIA: string | null) {
  const cadeia = (resposta: Linha) => {
    const no = {
      select: () => no,
      eq: () => no,
      order: () => no,
      limit: () => no,
      async maybeSingle() {
        return { data: resposta, error: null };
      },
    };
    return no;
  };
  return {
    from(tabela: string) {
      return tabela === "messages"
        ? cadeia(primeiraRespostaDaIA ? { sent_at: primeiraRespostaDaIA } : null)
        : cadeia(assinatura);
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

describe("estadoDaCobranca — sem assinatura: o teste sem cartão (24/10/2026)", () => {
  /**
   * O teste voltou a ser sem cartão, mas o relógio só começa na 1ª resposta da
   * IA a uma conversa real (o onboarding não come dias), e quem nunca põe a IA
   * para responder recebe a tela de cobrança depois de 14 dias — não existe
   * teste eterno. `vencido` continua reservado para quem já assinou.
   */
  it("⭐ conta nova, IA ainda não respondeu: tudo liberado e o relógio parado", async () => {
    const estado = await estadoDaCobranca(bancoPorTabela(null, null), ORG, "2026-02-25T12:00:00Z", AGORA);
    expect(estado.acesso).toBe("teste_nao_iniciado");
    expect(estado.jaAssinou).toBe(false);
    expect(estado.expiraEm).toBeNull();
  });

  it("⭐ a IA respondeu há 2 dias: teste sem cartão com 5 dias restantes", async () => {
    const estado = await estadoDaCobranca(
      bancoPorTabela(null, "2026-02-27T12:00:00Z"),
      ORG,
      "2026-02-20T12:00:00Z",
      AGORA,
    );
    expect(estado.acesso).toBe("teste_sem_cartao");
    expect(estado.diasRestantes).toBe(5);
    expect(estado.expiraEm?.toISOString()).toBe("2026-03-06T12:00:00.000Z");
  });

  it("⭐ teste acabou sem cartão: vai para a cobrança, com a data do fim", async () => {
    const estado = await estadoDaCobranca(
      bancoPorTabela(null, "2026-02-20T12:00:00Z"),
      ORG,
      "2026-02-10T12:00:00Z",
      AGORA,
    );
    expect(estado.acesso).toBe("sem_cartao");
    expect(estado.expiraEm?.toISOString()).toBe("2026-02-27T12:00:00.000Z");
  });

  it("⭐ sem resposta da IA por mais de 14 dias: pede cartão (sem teste eterno)", async () => {
    const estado = await estadoDaCobranca(bancoPorTabela(null, null), ORG, "2026-02-01T12:00:00Z", AGORA);
    expect(estado.acesso).toBe("sem_cartao");
    expect(estado.expiraEm).toBeNull();
  });

  it("sem saber quando a organização nasceu e sem resposta da IA: liberado", async () => {
    const estado = await estadoDaCobranca(bancoPorTabela(null, null), ORG, null, AGORA);
    expect(estado.acesso).toBe("teste_nao_iniciado");
  });

  it("⭐ quem nunca assinou nunca é tratado como inadimplente", async () => {
    for (const ia of [null, "2026-02-27T12:00:00Z", "2026-02-01T12:00:00Z"]) {
      const estado = await estadoDaCobranca(bancoPorTabela(null, ia), ORG, "2026-01-01T12:00:00Z", AGORA);
      expect(estado.acesso).not.toBe("vencido");
      expect(estado.acesso).not.toBe("trial");
    }
  });
});

describe("estadoDaCobranca — com assinatura", () => {
  const base = {
    plan: "pro",
    status: "active",
    stripe_customer_id: "cus_1",
    stripe_subscription_id: "sub_1",
    current_period_end: "2026-03-20T12:00:00Z",
    cancel_at_period_end: false,
  };

  it("active libera e traz o plano", async () => {
    const estado = await estadoDaCobranca(bancoQueDevolve(base), ORG, null, AGORA);
    expect(estado.acesso).toBe("em_dia");
    expect(estado.plano).toBe("pro");
    expect(estado.diasRestantes).toBe(19);
    expect(estado.jaAssinou).toBe(true);
  });

  it("trialing libera, e se anuncia como trial — nao como assinatura em dia", async () => {
    const estado = await estadoDaCobranca(
      bancoQueDevolve({ ...base, status: "trialing" }),
      ORG,
      null,
      AGORA,
    );
    expect(estado.acesso).toBe("trial");
  });

  it("past_due CONTINUA liberado", async () => {
    // A decisão que mais importa da lista. O Stripe fica em `past_due` durante
    // toda a régua de novas tentativas, que dura dias. Cortar no primeiro
    // cartão recusado desliga o atendimento de uma empresa por causa de um
    // cartão que venceu — e quem corta de fato é `unpaid`/`canceled`, que só
    // chegam depois de o Stripe ter tentado e avisado.
    const estado = await estadoDaCobranca(
      bancoQueDevolve({ ...base, status: "past_due" }),
      ORG,
      null,
      AGORA,
    );
    expect(estado.acesso).toBe("em_dia");
  });

  it("canceled, unpaid e paused trancam", async () => {
    for (const status of ["canceled", "unpaid", "paused", "incomplete_expired"]) {
      const estado = await estadoDaCobranca(
        bancoQueDevolve({ ...base, status }),
        ORG,
        null,
        AGORA,
      );
      expect(estado.acesso, `status=${status}`).toBe("vencido");
    }
  });

  it("cancelamento agendado mantém o acesso e é VISÍVEL", async () => {
    // Sem este campo na saída, "cancelou" e "cancelado" ficam iguais na tela e
    // o cliente acha que perdeu o mês que já pagou.
    const estado = await estadoDaCobranca(
      bancoQueDevolve({ ...base, cancel_at_period_end: true }),
      ORG,
      null,
      AGORA,
    );
    expect(estado.acesso).toBe("em_dia");
    expect(estado.cancelaNoFimDoCiclo).toBe(true);
  });

  it("plano fora do vocabulário vira null em vez de derrubar a tela", async () => {
    const estado = await estadoDaCobranca(
      bancoQueDevolve({ ...base, plan: "plano_que_nao_existe" }),
      ORG,
      null,
      AGORA,
    );
    expect(estado.plano).toBeNull();
    expect(estado.acesso).toBe("em_dia");
  });

  it("falha do banco NÃO tranca ninguém", async () => {
    // Esta função roda no layout de toda tela. Um soluço do Postgres virando
    // paywall para a base inteira é o pior resultado possível deste arquivo.
    const estado = await estadoDaCobranca(bancoQueDevolve(null, true), ORG, null, AGORA);
    expect(estado.acesso).toBe("em_dia");
  });
});
