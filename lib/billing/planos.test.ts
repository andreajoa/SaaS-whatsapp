import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  PRECOS_LIVE_ATENZA_BRL,
  PRECOS_LIVE_ATENZA_POR_MOEDA,
  mercadoCobradoParaPlanos,
  planoDoPreco,
  precoDoPlano,
  precoResolvidoDoPlano,
} from "@/lib/billing/planos";
import { MERCADO_PADRAO, mercadoDoPais, moedasCobraveis } from "@/lib/mercado/paises";

const CHAVES = [
  "STRIPE_PRICE_ESSENCIAL",
  "STRIPE_PRICE_PRO",
  "STRIPE_PRICE_ILIMITADO",
  "STRIPE_PRICE_ESSENCIAL_USD",
  "STRIPE_PRICE_PRO_USD",
  "STRIPE_PRICE_ILIMITADO_USD",
  "STRIPE_PRICE_ESSENCIAL_GBP",
  "STRIPE_PRICE_PRO_GBP",
  "STRIPE_PRICE_ILIMITADO_GBP",
  "STRIPE_PRICE_PRO_EUR",
  "STRIPE_PRICES_POR_MOEDA",
  "STRIPE_MOEDAS",
] as const;

const originais = new Map<string, string | undefined>();

beforeEach(() => {
  for (const k of CHAVES) {
    originais.set(k, process.env[k]);
    delete process.env[k];
  }
  process.env.STRIPE_PRICE_ESSENCIAL = "price_br_ess";
  process.env.STRIPE_PRICE_PRO = "price_br_pro";
  process.env.STRIPE_PRICE_ILIMITADO = "price_br_ili";
});

afterEach(() => {
  for (const k of CHAVES) {
    const v = originais.get(k);
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
});

describe("preços multi-moeda do Stripe", () => {
  it("usa o preço padrão (BRL) quando não há preço específico da moeda", () => {
    expect(precoResolvidoDoPlano("pro", "USD")).toEqual({
      priceId: "price_br_pro",
      moedaCobrada: "BRL",
    });
    expect(precoDoPlano("essencial", "GBP")).toBe("price_br_ess");
  });

  it("usa STRIPE_PRICE_<PLANO>_<MOEDA> quando configurado", () => {
    process.env.STRIPE_PRICE_ESSENCIAL_USD = "price_us_ess";
    process.env.STRIPE_PRICE_PRO_USD = "price_us_pro";
    process.env.STRIPE_PRICE_ILIMITADO_USD = "price_us_ili";
    process.env.STRIPE_PRICE_PRO_GBP = "price_gb_pro";

    expect(precoResolvidoDoPlano("pro", "USD")).toEqual({
      priceId: "price_us_pro",
      moedaCobrada: "USD",
    });
    expect(precoResolvidoDoPlano("pro", "GBP")).toEqual({
      priceId: "price_gb_pro",
      moedaCobrada: "GBP",
    });
    expect(precoResolvidoDoPlano("pro", "BRL")).toEqual({
      priceId: "price_br_pro",
      moedaCobrada: "BRL",
    });
  });

  it("planoDoPreco resolve de volta tanto BRL quanto qualquer moeda estrangeira", () => {
    process.env.STRIPE_PRICE_ESSENCIAL_USD = "price_us_ess";
    process.env.STRIPE_PRICE_PRO_GBP = "price_gb_pro";
    process.env.STRIPE_PRICE_PRO_EUR = "price_eu_pro";

    expect(planoDoPreco("price_br_ess")).toBe("essencial");
    expect(planoDoPreco("price_us_ess")).toBe("essencial");
    expect(planoDoPreco("price_gb_pro")).toBe("pro");
    expect(planoDoPreco("price_eu_pro")).toBe("pro");
    expect(planoDoPreco("price_desconhecido")).toBeNull();
  });

  it("moedasCobraveis detecta automaticamente moedas com STRIPE_PRICE_*_<MOEDA>", () => {
    expect(moedasCobraveis().has("BRL")).toBe(true);
    expect(moedasCobraveis().has("USD")).toBe(false);

    process.env.STRIPE_PRICE_PRO_USD = "price_us_pro";
    process.env.STRIPE_PRICE_PRO_GBP = "price_gb_pro";

    const moedas = moedasCobraveis();
    expect(moedas.has("BRL")).toBe(true);
    expect(moedas.has("USD")).toBe(true);
    expect(moedas.has("GBP")).toBe(true);
  });

  it("mercadoCobradoParaPlanos exibe BRL quando os preços locais ainda não foram configurados", () => {
    const us = mercadoDoPais("US");
    expect(us.moeda).toBe("USD");
    expect(mercadoCobradoParaPlanos(us)).toEqual(MERCADO_PADRAO);

    process.env.STRIPE_PRICE_ESSENCIAL_USD = "price_us_ess";
    process.env.STRIPE_PRICE_PRO_USD = "price_us_pro";
    process.env.STRIPE_PRICE_ILIMITADO_USD = "price_us_ili";
    expect(mercadoCobradoParaPlanos(us)).toEqual(us);
  });

  it("resolve automaticamente todas as 12 moedas quando configurado com o catálogo live oficial da Atenza", () => {
    process.env.STRIPE_PRICE_ESSENCIAL = PRECOS_LIVE_ATENZA_BRL.essencial;
    process.env.STRIPE_PRICE_PRO = PRECOS_LIVE_ATENZA_BRL.pro;
    process.env.STRIPE_PRICE_ILIMITADO = PRECOS_LIVE_ATENZA_BRL.ilimitado;

    expect(precoResolvidoDoPlano("essencial", "USD")).toEqual({
      priceId: PRECOS_LIVE_ATENZA_POR_MOEDA.USD!.essencial,
      moedaCobrada: "USD",
    });
    expect(precoResolvidoDoPlano("pro", "GBP")).toEqual({
      priceId: PRECOS_LIVE_ATENZA_POR_MOEDA.GBP!.pro,
      moedaCobrada: "GBP",
    });
    expect(precoResolvidoDoPlano("ilimitado", "EUR")).toEqual({
      priceId: PRECOS_LIVE_ATENZA_POR_MOEDA.EUR!.ilimitado,
      moedaCobrada: "EUR",
    });
    expect(planoDoPreco(PRECOS_LIVE_ATENZA_POR_MOEDA.MXN!.pro)).toBe("pro");
    expect(moedasCobraveis().has("USD")).toBe(true);
    expect(moedasCobraveis().has("GBP")).toBe(true);
    expect(moedasCobraveis().has("EUR")).toBe(true);
    expect(moedasCobraveis().has("MXN")).toBe(true);
    expect(mercadoCobradoParaPlanos(mercadoDoPais("US"))).toEqual(mercadoDoPais("US"));
    expect(mercadoCobradoParaPlanos(mercadoDoPais("GB"))).toEqual(mercadoDoPais("GB"));
  });
});
