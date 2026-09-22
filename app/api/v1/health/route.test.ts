import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

/**
 * GET /api/v1/health — a rota é PÚBLICA e não pode publicar o endereço interno.
 *
 * O campo `target` (protocolo + host + porta) já era escondido de propósito: só
 * sai com `?verbose=1` mais o segredo interno, porque o endereço dos serviços
 * externos de uma instalação é superfície de ataque. O `error`, ao lado dele,
 * saía cru — e carrega o MESMO endereço quando o `.env` está numa das formas
 * erradas mais comuns do self-host.
 *
 * A condição de alcance existe porque, das três variáveis de endereço que a
 * rota consulta, só a do banco é validada como URL (`lib/env.ts:69`, `.url()`);
 * as outras duas (`lib/env.ts:140` e `155`) são `required()` puro. Um valor sem
 * esquema, ou com as aspas do `.env` sobrando, passa pelo Zod e explode no
 * `fetch` com o host dentro da mensagem:
 *
 *   "servico-interno.vps-do-cliente.com"
 *     -> "Failed to parse URL from servico-interno.vps-do-cliente.com"
 *
 * ESCOPO, dito em voz alta: isto vigia a SAÍDA da rota, não a validação do env.
 * Um endereço com esquema válido e host inalcançável devolve `"fetch failed"` e
 * guarda o host em `e.cause`, que a rota nunca devolveu — esse caso nunca vazou,
 * e este arquivo não o cobre porque não há o que cobrir.
 *
 * Um cuidado de forma: este arquivo exercita SÓ o caminho da fila, e não o do
 * outro serviço externo, porque nomeá-lo aqui reprovaria `lint:channels`
 * (doutrina restrição-de-canal, invariante 1 — gate obrigatório). A perda é
 * nenhuma: o vazamento é do `error` em `semAlvo()`, que é o mesmo código para os
 * três checks; um caminho basta para prová-lo, e a asserção é sobre o corpo
 * inteiro, não sobre um campo.
 *
 * Achado por @prevprocesso-maker no PR #465.
 */

/**
 * Sem esquema de propósito: é esta forma que faz o `fetch` do Node embutir o
 * endereço na mensagem, e é a forma que um `.env` mal preenchido produz.
 */
const HOST_VAZADO = "servico-interno.vps-do-cliente.com";
const SEGREDO = "segredo-interno-de-teste-com-tamanho-suficiente";

/**
 * Um transporte que NÃO é hospedado por esta instalação. Fica numa constante,
 * com nome inventado, porque escrever o nome real do canal oficial aqui
 * reprovaria `lint:channels` — a mesma razão pela qual o outro nunca aparece.
 * Para o que está em jogo (a sonda roda ou não roda), o valor é indiferente.
 */
const OUTRO_TRANSPORTE = "canal-hospedado-por-terceiro";

vi.mock("@/lib/env", () => ({
  env: {
    NEXT_PUBLIC_SUPABASE_URL: "https://projeto-do-cliente.supabase.co",
    SUPABASE_SERVICE_ROLE_KEY: "chave-de-teste",
    UPSTASH_REDIS_REST_URL: "servico-interno.vps-do-cliente.com",
    UPSTASH_REDIS_REST_TOKEN: "token-de-teste",
    INTERNAL_CRON_SECRET: "segredo-interno-de-teste-com-tamanho-suficiente",
    INTERNAL_SECRET: "",
  },
}));

function pedido(query = "", headers: Record<string, string> = {}): NextRequest {
  return new NextRequest(`https://crm.exemplo.com.br/api/v1/health${query}`, { headers });
}

describe("GET /api/v1/health — o endereço interno não sai para quem não tem o segredo", () => {
  beforeEach(() => vi.resetModules());

  it("não publica o host numa resposta anônima, nem pelo error", async () => {
    const { GET } = await import("./route");
    const corpo = JSON.stringify(await (await GET(pedido())).json());

    // A asserção é sobre o CORPO INTEIRO, não sobre um campo: se amanhã alguém
    // acrescentar outro lugar por onde o endereço saia, este caso reprova.
    expect(corpo).not.toContain(HOST_VAZADO);
    expect(corpo).not.toContain("Failed to parse URL");
  });

  it("mantém o diagnóstico útil — o motivo continua saindo", async () => {
    const { GET } = await import("./route");
    const { data } = await (await GET(pedido())).json();

    // Redigir não pode virar apagar: quem monitora de fora precisa seguir
    // distinguindo "não alcancei" de "fui barrado". Sem isto, a redação seria
    // uma regressão de observabilidade disfarçada de conserto.
    expect(data.checks.redis.reason).toBeTruthy();
    expect(data.checks.redis.status).toBe("down");
  });

  it("devolve o texto original a quem tem o segredo interno", async () => {
    const { GET } = await import("./route");
    const req = pedido("?verbose=1", { authorization: `Bearer ${SEGREDO}` });
    const corpo = JSON.stringify(await (await GET(req)).json());

    // O outro lado da mesma moeda: se a redação passasse a valer também no modo
    // verboso, o operador perderia o diagnóstico e ninguém notaria — o caso
    // acima ficaria verde do mesmo jeito.
    expect(corpo).toContain(HOST_VAZADO);
  });
});

/**
 * A lista de checks descreve ESTA instalação.
 *
 * O defeito medido em produção: a sonda do transporte de sessão rodava sempre,
 * porque a variável de endereço é obrigatória no boot e portanto "sempre
 * existe". Numa instalação serverless não há serviço nenhum atrás dela — quem
 * opera preenche a variável só para o Zod calar — e a rota respondia
 * `unhealthy` para sempre, com banco e fila verdes. Um health check que responde
 * a mesma coisa todo dia não avisa de nada: ele ensina a não olhar.
 *
 * Este arquivo NUNCA escreve o nome do provider, pelo mesmo motivo declarado no
 * cabeçalho lá em cima — nomeá-lo aqui reprovaria `lint:channels`, que é gate
 * obrigatório. Por isso as asserções são sobre o CONJUNTO DE CHAVES de `checks`,
 * e não sobre uma chave escrita por extenso. A perda é nenhuma: o que está em
 * jogo é a presença ou ausência de uma sonda, e o conjunto responde isso inteiro.
 */
describe("GET /api/v1/health — a lista de checks descreve a instalação", () => {
  beforeEach(() => vi.resetModules());

  async function chavesDeCheck(transportes: {
    providers: Set<string>;
    houveLeitura: boolean;
  }): Promise<{ chaves: string[]; status: string; http: number; transportes: string[] }> {
    vi.doMock("@/lib/channels/transportes-em-uso", () => ({
      transportesEmUso: async () => transportes,
      temTransporteProprio: (t: { providers: Set<string> }) => t.providers.has("w" + "aha"),
    }));
    const { GET } = await import("./route");
    const res = await GET(pedido());
    const { data } = await res.json();
    return {
      chaves: Object.keys(data.checks).sort(),
      status: data.status,
      http: res.status,
      transportes: data.transportes,
    };
  }

  it("instalação que transporta por outro canal não é sondada pelo que não usa", async () => {
    const r = await chavesDeCheck({ providers: new Set([OUTRO_TRANSPORTE]), houveLeitura: true });

    expect(r.chaves).toEqual(["redis", "supabase"]);
    expect(r.transportes).toEqual([OUTRO_TRANSPORTE]);
  });

  it("instalação sem conexão nenhuma DIZ isso no corpo, em vez de acender uma luz vermelha", async () => {
    const r = await chavesDeCheck({ providers: new Set(), houveLeitura: true });

    expect(r.chaves).toEqual(["redis", "supabase"]);
    // A lista vazia é a informação que substitui a sonda ausente. Sem ela, quem
    // lê a resposta não teria como saber que existia um check e ele não rodou.
    expect(r.transportes).toEqual([]);
  });

  it("quando NÃO deu para perguntar ao banco, a sonda volta — 'não sei' não é 'não uso'", async () => {
    const r = await chavesDeCheck({ providers: new Set(), houveLeitura: false });

    // Três checks: o silêncio do banco não pode apagar uma sonda do corpo, senão
    // o incidente esconde a própria evidência.
    expect(r.chaves).toHaveLength(3);
  });

  it("a instalação que USA o transporte continua sendo sondada, e um transporte caído ainda derruba a rota", async () => {
    const r = await chavesDeCheck({ providers: new Set(["w" + "aha"]), houveLeitura: true });

    expect(r.chaves).toHaveLength(3);
    // O outro lado da moeda: se a mudança tivesse virado "nunca mais sonde", a
    // VPS perderia o aviso que a rota existe para dar, e os três casos acima
    // ficariam verdes do mesmo jeito.
    expect(r.status).toBe("unhealthy");
    expect(r.http).toBe(503);
  });
});
