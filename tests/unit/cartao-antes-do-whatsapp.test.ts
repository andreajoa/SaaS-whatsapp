/**
 * Cartão antes do WhatsApp (decisão do dono, 27/10/2026).
 *
 * A trava de cobrança do layout só tranca TELAS; o runtime do agente não
 * consulta cobrança. Então a garantia de "ninguém usa sem cartão" mora em dois
 * lugares, e os dois são vigiados aqui:
 *
 *   1. o passo "Plano" vem antes do telefone no onboarding;
 *   2. TODA rota que conecta número pergunta `precisaDeCartao` antes de
 *      conectar — uma rota nova que esquecer reabre a IA de graça.
 */
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { precisaDeCartao } from "@/lib/billing/assinatura";
import { passosVisiveis, proximoPasso } from "@/lib/onboarding/passos";

const ORG = "11111111-1111-4111-8111-111111111111";
const CHAVE_ORIGINAL = process.env.STRIPE_SECRET_KEY;

function banco(linha: Record<string, unknown> | null) {
  return {
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: linha, error: null }) }) }),
    }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

beforeEach(() => {
  process.env.STRIPE_SECRET_KEY = "sk_test_para_ligar_o_interruptor";
});
afterEach(() => {
  if (CHAVE_ORIGINAL === undefined) delete process.env.STRIPE_SECRET_KEY;
  else process.env.STRIPE_SECRET_KEY = CHAVE_ORIGINAL;
});

describe("o passo Plano", () => {
  it("existe só onde se cobra, e vem logo antes do telefone", () => {
    const comCobranca = passosVisiveis({ lojaLigada: false, cobra: true }).map((p) => p.segmento);
    expect(comCobranca.indexOf("plano")).toBe(comCobranca.indexOf("connect-whatsapp") - 1);
    expect(comCobranca.indexOf("plano")).toBeGreaterThan(comCobranca.indexOf("testar"));

    const selfHost = passosVisiveis({ lojaLigada: false, cobra: false }).map((p) => p.segmento);
    expect(selfHost).not.toContain("plano");
  });

  it("sem cartão o wizard para no Plano — não chega ao telefone", () => {
    const estado = {
      welcome: { accepted_at: "x", timezone: "x", display_name: "x" },
      ai: { agent_id: "a", prompt_template: "p" },
      funil: { skipped: true },
      teste: { skipped: true },
    };
    expect(proximoPasso(estado, { lojaLigada: false, cobra: true })?.segmento).toBe("plano");
    expect(
      proximoPasso({ ...estado, plano: { acesso: "trial", em: "x" } }, { lojaLigada: false, cobra: true })
        ?.segmento,
    ).toBe("connect-whatsapp");
  });
});

describe("precisaDeCartao", () => {
  it("sem assinatura: precisa", async () => {
    await expect(precisaDeCartao(banco(null), ORG)).resolves.toBe(true);
  });

  it("no trial do Stripe ou em dia: não precisa", async () => {
    for (const status of ["trialing", "active", "past_due"]) {
      const linha = {
        plan: "pro",
        status,
        stripe_customer_id: "cus_1",
        stripe_subscription_id: "sub_1",
        current_period_end: "2099-01-01T00:00:00Z",
        cancel_at_period_end: false,
      };
      await expect(precisaDeCartao(banco(linha), ORG)).resolves.toBe(false);
    }
  });

  it("instalação que não cobra (self-host): nunca precisa", async () => {
    delete process.env.STRIPE_SECRET_KEY;
    await expect(precisaDeCartao(banco(null), ORG)).resolves.toBe(false);
  });
});

describe("toda rota que conecta número exige o cartão", () => {
  const ROTAS = [
    "app/api/v1/channels/partner/qr/route.ts",
    "app/api/v1/channels/partner/route.ts",
    "app/api/v1/channels/official/route.ts",
    "app/api/v1/channel-sessions/route.ts",
    "app/api/v1/onboarding/whatsapp/session/route.ts",
  ];

  it.each(ROTAS)("%s pergunta precisaDeCartao no POST", (rota) => {
    const fonte = readFileSync(rota, "utf8");
    const post = fonte.slice(fonte.indexOf("export async function POST"));
    expect(post, `${rota} conecta número sem conferir o cartão`).toContain("await precisaDeCartao(");
  });
});
