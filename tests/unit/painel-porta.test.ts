import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * A PORTA DO PAINEL — o único lugar deste repositório onde falhar aberto
 * publica o e-mail, a cidade e o plano de TODOS os leads de uma vez.
 *
 * `/dashboard` é `PUBLIC_PATHS`, e tem de ser: ele não pertence a organização
 * nenhuma, então não pode depender da sessão do produto. O preço disso é que o
 * proxy deixou de ser a proteção — a proteção inteira é `lib/painel/sessao.ts`.
 * Cada caso abaixo corresponde a um jeito concreto de essa peça vazar:
 *
 *  1. Instalação sem `PAINEL_SENHA` que responde "digite a senha" em vez de
 *     404 — todo clone self-host ganharia uma tela de login exposta.
 *  2. Senha curta aceita — a senha é a CHAVE do HMAC, e 8 caracteres tornam a
 *     assinatura falsificável offline por quem já tem um cookie válido.
 *  3. Cookie com a data adulterada aceito — trivial de tentar, e o mais
 *     provável de alguém tentar primeiro.
 *  4. Cookie assinado com a senha ANTIGA continuar valendo depois da troca —
 *     trocar a senha tem de derrubar o que já estava aberto.
 */

const ENV: Record<string, string> = { PAINEL_SENHA: "" };

vi.mock("@/lib/env", () => ({
  get env() {
    return ENV;
  },
}));

const { COOKIE_DO_PAINEL, cookieVale, emitirCookie, painelHabilitado, senhaConfere } =
  await import("@/lib/painel/sessao");

/** 31 caracteres — acima do piso de 24. */
const SENHA = "9dVByk4-y7mwbPp-Tjk8u8g-Qqy6JS4";

beforeEach(() => {
  ENV.PAINEL_SENHA = SENHA;
});

afterEach(() => {
  ENV.PAINEL_SENHA = "";
});

describe("sem senha configurada, o painel NÃO EXISTE", () => {
  it("a instalação padrão não tem painel", () => {
    ENV.PAINEL_SENHA = "";
    expect(painelHabilitado()).toBe(false);
  });

  it("e nada passa: nem senha vazia, nem cookie válido de antes", () => {
    const { valor } = emitirCookie();
    ENV.PAINEL_SENHA = "";
    expect(senhaConfere("")).toBe(false);
    expect(senhaConfere(SENHA)).toBe(false);
    expect(cookieVale(valor)).toBe(false);
  });

  it("espaço em branco não é senha", () => {
    ENV.PAINEL_SENHA = "                                   ";
    expect(painelHabilitado()).toBe(false);
  });
});

describe("o piso de tamanho é do PAINEL, não do formulário", () => {
  it("senha curta não liga o painel — ela é a chave do HMAC", () => {
    ENV.PAINEL_SENHA = "trocar123";
    expect(painelHabilitado()).toBe(false);
    expect(senhaConfere("trocar123")).toBe(false);
  });

  it("23 caracteres ainda não, 24 já sim", () => {
    ENV.PAINEL_SENHA = "a".repeat(23);
    expect(painelHabilitado()).toBe(false);
    ENV.PAINEL_SENHA = "a".repeat(24);
    expect(painelHabilitado()).toBe(true);
  });
});

describe("a senha", () => {
  it("confere a certa e recusa a errada", () => {
    expect(senhaConfere(SENHA)).toBe(true);
    expect(senhaConfere(SENHA + "x")).toBe(false);
    expect(senhaConfere(SENHA.slice(0, -1))).toBe(false);
    expect(senhaConfere(SENHA.toLowerCase())).toBe(false);
    expect(senhaConfere("")).toBe(false);
  });

  it("um prefixo correto não é aceito — a comparação é do valor inteiro", () => {
    // `startsWith` disfarçado de igualdade é o jeito clássico de esta função
    // ser reescrita errada numa refatoração.
    for (let i = 1; i < SENHA.length; i += 5) {
      expect(senhaConfere(SENHA.slice(0, i))).toBe(false);
    }
  });
});

describe("o cookie", () => {
  it("o que acabou de ser emitido vale", () => {
    const { valor, maxAge } = emitirCookie();
    expect(cookieVale(valor)).toBe(true);
    expect(maxAge).toBeGreaterThan(0);
  });

  it("vence, e depois de vencido não volta a valer", () => {
    const agora = 1_800_000_000;
    const { valor, maxAge } = emitirCookie(agora);
    expect(cookieVale(valor, agora + maxAge - 60)).toBe(true);
    expect(cookieVale(valor, agora + maxAge + 1)).toBe(false);
  });

  it("empurrar a data para a frente invalida a assinatura", () => {
    // O ataque mais óbvio: pegar o próprio cookie e trocar o número da frente.
    const agora = 1_800_000_000;
    const { valor } = emitirCookie(agora);
    const assinatura = valor.slice(valor.indexOf(".") + 1);
    expect(cookieVale(`${agora + 999_999}.${assinatura}`, agora)).toBe(false);
  });

  it("lixo, vazio e formato torto não passam", () => {
    for (const tentativa of [
      "",
      "   ",
      ".",
      "abc",
      "abc.def",
      ".assinatura",
      "9999999999.",
      "9999999999.0",
      "NaN.0",
      `${Number.MAX_VALUE}.x`,
    ]) {
      expect(cookieVale(tentativa), `passou: ${JSON.stringify(tentativa)}`).toBe(false);
    }
    expect(cookieVale(undefined)).toBe(false);
    expect(cookieVale(null)).toBe(false);
  });

  it("trocar a senha derruba os cookies que já estavam abertos", () => {
    // É o "sair de todos os dispositivos" do painel, e ele é de graça porque a
    // senha é a chave do HMAC. Se um dia a chave passar a ser um segredo
    // separado, esta propriedade some sem ninguém perceber — por isso o caso.
    const { valor } = emitirCookie();
    expect(cookieVale(valor)).toBe(true);
    ENV.PAINEL_SENHA = "Outra-senha-bem-comprida-2026";
    expect(cookieVale(valor)).toBe(false);
  });

  it("o nome do cookie é estável — a tela e a rota leem o mesmo", () => {
    expect(COOKIE_DO_PAINEL).toBe("painel_funil");
  });
});
