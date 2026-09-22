/**
 * O teto de plano tem três eixos que só um teste segura, porque errar qualquer
 * um deles é invisível na tela de quem escreveu o código:
 *
 *  1. **O self-host não pode ganhar teto.** A doutrina do produto é venda de
 *     VPS, não assinatura. Um teto que vaze para lá tranca o número de alguém
 *     que nunca comprou plano nenhum — e essa pessoa não tem nem tela de
 *     cobrança onde descobrir o motivo.
 *  2. **Falha de leitura LIBERA.** O erro barato é um canal a mais; o caro é um
 *     cliente pagante impedido de ligar o número dele por um soluço do banco.
 *     Um teto não é controle de segurança, e tratá-lo como se fosse inverte o
 *     custo dos dois erros.
 *  3. **Barrar o próximo nunca é tirar o que existe.** Quem já passou do teto
 *     (porque ele não existia, ou porque desceu de plano) fica com o que tem.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import { cabeMaisUm, frasePrimeiraPessoa } from "./tetos";

/**
 * O banco em memória. `erro` por tabela para exercitar a falha aberta de cada
 * consulta separadamente — é no isolamento que se vê qual delas trava.
 */
const banco = {
  plano: "essencial" as string | null,
  canais: 0,
  membros: 0,
  convites: 0,
  erroEm: null as string | null,
};

function contagem(tabela: string, quanto: number) {
  const erro = banco.erroEm === tabela ? { message: "connection refused" } : null;
  const resposta = { count: erro ? null : quanto, error: erro, data: null };
  // Cada `.eq`/`.is`/`.in`/`.gt` devolve o mesmo objeto, que também é `thenable`
  // — assim a cadeia inteira do PostgREST funciona sem o teste precisar saber
  // quantos filtros a consulta real encadeia.
  const cadeia: Record<string, unknown> = {
    then: (ok: (v: unknown) => unknown) => Promise.resolve(resposta).then(ok),
  };
  for (const metodo of ["eq", "is", "in", "gt", "select", "maybeSingle"]) {
    cadeia[metodo] = () => cadeia;
  }
  return cadeia;
}

const admin = {
  from(tabela: string) {
    if (tabela === "org_subscriptions") {
      const erro = banco.erroEm === tabela ? { message: "connection refused" } : null;
      const linha = banco.plano === null ? null : { plan: banco.plano };
      const cadeia: Record<string, unknown> = {
        maybeSingle: async () => ({ data: erro ? null : linha, error: erro }),
      };
      for (const metodo of ["select", "eq"]) cadeia[metodo] = () => cadeia;
      return cadeia;
    }
    if (tabela === "channel_sessions") return contagem(tabela, banco.canais);
    if (tabela === "user_organizations") return contagem(tabela, banco.membros);
    if (tabela === "team_invites") return contagem(tabela, banco.convites);
    throw new Error(`tabela inesperada: ${tabela}`);
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
} as any;

beforeEach(() => {
  banco.plano = "essencial";
  banco.canais = 0;
  banco.membros = 0;
  banco.convites = 0;
  banco.erroEm = null;
  vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_instalacao_que_cobra");
});

describe("cabeMaisUm — a instalação que NÃO cobra não tem teto nenhum", () => {
  it("libera sem sequer consultar o banco quando não há Stripe", async () => {
    vi.stubEnv("STRIPE_SECRET_KEY", "");
    const naoDeveriaSerChamado = {
      from: () => {
        throw new Error("o self-host consultou o banco para decidir um teto");
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;

    const v = await cabeMaisUm(naoDeveriaSerChamado, "org", "canais");

    expect(v.permitido).toBe(true);
    expect(v.teto).toBeNull();
  });
});

describe("cabeMaisUm — canais", () => {
  it("o primeiro canal do Essencial entra", async () => {
    const v = await cabeMaisUm(admin, "org", "canais");

    expect(v.permitido).toBe(true);
    expect(v.teto).toBe(1);
  });

  it("o segundo não — é o número que a página vende", async () => {
    banco.canais = 1;

    const v = await cabeMaisUm(admin, "org", "canais");

    expect(v.permitido).toBe(false);
    expect(v.emUso).toBe(1);
  });

  it("quem já está ACIMA do teto continua onde está, só não ganha mais um", async () => {
    // O caso de quem desceu de plano, ou de quem conectou antes de o teto
    // existir. A resposta é sobre o PRÓXIMO; nada aqui desconecta nada.
    banco.canais = 5;

    const v = await cabeMaisUm(admin, "org", "canais");

    expect(v.permitido).toBe(false);
    expect(v.emUso).toBe(5);
  });

  it("o plano sem teto não tem teto", async () => {
    banco.plano = "ilimitado";
    banco.canais = 40;

    const v = await cabeMaisUm(admin, "org", "canais");

    expect(v.permitido).toBe(true);
    expect(v.teto).toBeNull();
  });

  it("o Pro vale três", async () => {
    banco.plano = "pro";
    banco.canais = 2;

    expect((await cabeMaisUm(admin, "org", "canais")).permitido).toBe(true);
    banco.canais = 3;
    expect((await cabeMaisUm(admin, "org", "canais")).permitido).toBe(false);
  });
});

describe("cabeMaisUm — o trial vale o degrau de entrada", () => {
  it("organização sem linha de assinatura recebe o teto do Essencial", async () => {
    // A alternativa — trial sem teto — deixaria a pessoa conectar 5 números na
    // avaliação e perder 4 no dia em que decidisse pagar. O limite descoberto
    // ANTES do cartão é o que vende o degrau de cima.
    banco.plano = null;
    banco.canais = 1;

    const v = await cabeMaisUm(admin, "org", "canais");

    expect(v.plano).toBe("essencial");
    expect(v.permitido).toBe(false);
  });
});

describe("cabeMaisUm — membros", () => {
  it("convite pendente OCUPA vaga", async () => {
    // Sem isto o teto teria uma porta escancarada: a rota de convite emite até
    // 20 de uma vez, e o aceite é um Server Action com token já assinado — não
    // há onde recusar depois.
    banco.membros = 2;
    banco.convites = 1;

    const v = await cabeMaisUm(admin, "org", "membros");

    expect(v.emUso).toBe(3);
    expect(v.permitido).toBe(false);
  });

  it("`aMais` conta o que a própria requisição já emitiu", async () => {
    banco.membros = 1;

    expect((await cabeMaisUm(admin, "org", "membros", 1)).permitido).toBe(true);
    // Terceira vaga do Essencial tomada pelo segundo convite deste mesmo laço.
    expect((await cabeMaisUm(admin, "org", "membros", 2)).permitido).toBe(false);
  });

  it("sem a tabela de convites, o que se sabe (membros) ainda vale", async () => {
    // Clone sem a migration 0238. Recusar a contagem inteira por causa da
    // metade ausente deixaria o teto num "não sei" permanente.
    banco.membros = 3;
    banco.erroEm = "team_invites";

    const v = await cabeMaisUm(admin, "org", "membros");

    expect(v.emUso).toBe(3);
    expect(v.permitido).toBe(false);
  });
});

describe("cabeMaisUm — não saber nunca tranca", () => {
  it("banco fora do ar na leitura do plano LIBERA", async () => {
    banco.erroEm = "org_subscriptions";

    const v = await cabeMaisUm(admin, "org", "canais");

    expect(v.permitido).toBe(true);
    expect(v.teto).toBeNull();
  });

  it("banco fora do ar na CONTAGEM libera, e diz de qual plano estava falando", async () => {
    banco.erroEm = "channel_sessions";

    const v = await cabeMaisUm(admin, "org", "canais");

    expect(v.permitido).toBe(true);
    // O plano sobrevive à falha de contagem: quem loga a recusa (que não houve)
    // ainda sabe contra que régua a pergunta foi feita.
    expect(v.plano).toBe("essencial");
  });

  it("plano que este código não conhece libera, em vez de tratar como zero", async () => {
    // Uma imagem mais velha que o banco (o clone atualizou o schema antes da
    // imagem). Fechar aqui trancaria justamente quem acabou de pagar mais.
    banco.plano = "plano_que_ainda_nao_existe";

    expect((await cabeMaisUm(admin, "org", "canais")).permitido).toBe(true);
  });
});

describe("frasePrimeiraPessoa — a recusa diz o que fazer", () => {
  it("nomeia o plano, o número vendido e o caminho", async () => {
    banco.canais = 1;
    const v = await cabeMaisUm(admin, "org", "canais");

    const frase = frasePrimeiraPessoa("canais", v);

    expect(frase).toContain("Essencial");
    expect(frase).toContain("1 número de WhatsApp");
    // "Limite atingido" sozinho não diz nem qual é o limite nem o que fazer — e
    // o que fazer é justamente o que o produto quer que a pessoa faça.
    expect(frase).toContain("Cobrança");
  });
});
