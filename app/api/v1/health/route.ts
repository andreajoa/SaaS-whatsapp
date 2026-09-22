/**
 * GET /api/v1/health — Supabase, Redis e WAHA respondem?
 *
 * ─── Por que cada check diz a CAUSA, e não só "down" ─────────────────────────
 * A versão anterior devolvia `error: "fetch failed"` — a mensagem que o `fetch`
 * dá para causas opostas. Com ela, produção passou semanas indistinguível entre
 * "o endereço configurado não existe" e "o serviço caiu", e a leitura que
 * prevaleceu foi a segunda: o dono reiniciava, toda vez, um container que nunca
 * havia caído (medido: `restarts=0`). Um diagnóstico que não separa configuração
 * de disponibilidade manda metade das pessoas para o lugar errado — e sempre a
 * mesma metade, porque "o serviço caiu" é a hipótese que não acusa quem
 * configurou.
 *
 * `reason` é a classificação (ver `lib/net/alcance`), e é o que basta para saber
 * ONDE mexer.
 *
 * ─── Por que a lista de checks MUDA de instalação para instalação ────────────
 * O transporte de mensagem só é sondado onde a instalação de fato o usa, e quem
 * responde isso é `channel_sessions`, não o `.env` (o argumento inteiro está em
 * `lib/channels/transportes-em-uso.ts`). Enquanto a sonda era incondicional, a
 * instalação serverless — que não tem contêiner de WAHA nenhum — respondia 503
 * para sempre, com Supabase e Redis verdes. Um health check que sempre responde
 * a mesma coisa não avisa de nada: ele treina quem o lê a não olhar.
 *
 * `transportes` sai no corpo justamente para que a AUSÊNCIA do check seja
 * visível. Lista vazia quer dizer "esta instalação ainda não transporta nada", e
 * é uma frase melhor do que uma luz vermelha sobre um serviço que ninguém pareou.
 *
 * ─── Por que o ENDEREÇO só sai autenticado ───────────────────────────────────
 * Esta rota é pública — é o que permite um monitor externo bater nela. O endereço
 * do Redis e do WAHA é superfície de ataque: publicá-lo entrega a quem varre a
 * internet o alvo exato de dois serviços que falam com o WhatsApp do cliente.
 * Então `target` só sai com `?verbose=1` mais o mesmo segredo interno dos crons:
 * quem opera o sistema vê para onde ele tentou ir; quem só passa na frente, não.
 */
import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";

import { transportesEmUso, temTransporteProprio } from "@/lib/channels/transportes-em-uso";
import { env } from "@/lib/env";
import { alvoDe, classificarFalhaDeAlcance, type FalhaDeAlcance } from "@/lib/net/alcance";
import { validarConfigRedisRest } from "@/lib/redis-config";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type CheckStatus = "ok" | "degraded" | "down";

/** Por que o check não passou. `credencial_recusada` é o 401/403 — chegamos lá, e fomos barrados. */
type MotivoDeFalha =
  | FalhaDeAlcance
  | "credencial_recusada"
  | "resposta_inesperada"
  | "nao_configurado"
  | "configuracao_invalida";

type Check = {
  status: CheckStatus;
  latency_ms: number;
  error?: string;
  reason?: MotivoDeFalha;
  /** Protocolo + host + porta que tentamos. Só com `?verbose=1` autenticado. */
  target?: string;
};

const TIMEOUT_MS = 3_000;

async function withTimeout<T>(p: Promise<T>, ms = TIMEOUT_MS): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`timeout after ${ms}ms`)), ms)),
  ]);
}

/** Chegamos ao serviço, ele respondeu, e a resposta não serve. */
function motivoDoStatusHttp(status: number): MotivoDeFalha {
  return status === 401 || status === 403 ? "credencial_recusada" : "resposta_inesperada";
}

async function checkSupabase(): Promise<Check> {
  const t0 = Date.now();
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  try {
    // Ping leve via REST com anon key — não precisa de service_role pra health check.
    // Se chegar 200/401/empty body, conexão e API key estão OK.
    const key = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const res = await withTimeout(
      fetch(`${url}/rest/v1/organizations?select=id&limit=1`, {
        headers: { apikey: key, Authorization: `Bearer ${key}` },
        cache: "no-store",
      }),
    );
    // 200 (lista vazia por RLS) ou 401/403 (auth ok mas RLS bloqueia anon) → conexão OK
    if (res.status === 200 || res.status === 401 || res.status === 403) {
      return { status: "ok", latency_ms: Date.now() - t0, target: alvoDe(url) };
    }
    return {
      status: "down",
      latency_ms: Date.now() - t0,
      error: `http_${res.status}`,
      reason: motivoDoStatusHttp(res.status),
      target: alvoDe(url),
    };
  } catch (e) {
    return {
      status: "down",
      latency_ms: Date.now() - t0,
      error: e instanceof Error ? e.message : String(e),
      reason: classificarFalhaDeAlcance(e),
      target: alvoDe(url),
    };
  }
}

async function checkRedis(): Promise<Check> {
  const t0 = Date.now();
  const url = env.UPSTASH_REDIS_REST_URL;
  const token = env.UPSTASH_REDIS_REST_TOKEN;

  /**
   * A FORMA do valor vem antes da ida à rede, e o motivo é o que quem opera faz
   * a seguir.
   *
   * Um `.env` com as aspas sobrando (`URL="https://srh:80"`) hoje chega até o
   * `fetch`, falha, e o `reason` que sai é o de alcance — indistinguível do
   * contêiner do Redis realmente parado. As duas leituras mandam o operador
   * para lugares opostos: uma para reiniciar um serviço que está de pé, a outra
   * para o editor. `configuracao_invalida` separa as duas SEM ida à rede.
   *
   * Só "não configurado" segue `degraded`: é integração que ninguém contratou.
   * Configurado errado é `down` — o produto conta com o Redis e não o tem.
   *
   * O texto continua carregando o endereço de propósito: `semAlvo()` o redige
   * para quem não tem o segredo interno, e quem tem precisa ver QUAL valor está
   * malformado — dizer só "inválido" sem dizer qual não conserta nada.
   */
  const config = validarConfigRedisRest(url, token);
  if (!config.ok) {
    if (config.reason === "nao_configurado") {
      return {
        status: "degraded",
        latency_ms: 0,
        error: "not_configured",
        reason: "nao_configurado",
      };
    }
    return {
      status: "down",
      latency_ms: 0,
      error: `configuracao_invalida: UPSTASH_REDIS_REST_URL=${url}`,
      reason: "configuracao_invalida",
      target: alvoDe(url),
    };
  }
  try {
    // Protocolo REST do Upstash (compatível com serverless-redis-http): comando no
    // corpo via POST na raiz. NÃO existe GET /ping — daria 404 no SRH self-host.
    const res = await withTimeout(
      fetch(url, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(["PING"]),
        cache: "no-store",
      }),
    );
    if (!res.ok) {
      return {
        status: "down",
        latency_ms: Date.now() - t0,
        error: `http_${res.status}`,
        reason: motivoDoStatusHttp(res.status),
        target: alvoDe(url),
      };
    }
    return { status: "ok", latency_ms: Date.now() - t0, target: alvoDe(url) };
  } catch (e) {
    return {
      status: "down",
      latency_ms: Date.now() - t0,
      error: e instanceof Error ? e.message : String(e),
      reason: classificarFalhaDeAlcance(e),
      target: alvoDe(url),
    };
  }
}

async function checkWaha(): Promise<Check> {
  const t0 = Date.now();
  const base = env.WAHA_API_BASE_URL;
  if (!base) {
    return {
      status: "degraded",
      latency_ms: 0,
      error: "not_configured",
      reason: "nao_configurado",
    };
  }
  try {
    // /api/sessions valida conectividade E autenticação num tiro só. O WAHA Core não
    // expõe /api/health (daria 404 mesmo autenticado).
    const res = await withTimeout(
      fetch(`${base.replace(/\/$/, "")}/api/sessions`, {
        headers: env.WAHA_API_KEY ? { "X-Api-Key": env.WAHA_API_KEY } : {},
        cache: "no-store",
      }),
    );
    if (!res.ok) {
      return {
        status: "down",
        latency_ms: Date.now() - t0,
        error: `http_${res.status}`,
        reason: motivoDoStatusHttp(res.status),
        target: alvoDe(base),
      };
    }
    return { status: "ok", latency_ms: Date.now() - t0, target: alvoDe(base) };
  } catch (e) {
    return {
      status: "down",
      latency_ms: Date.now() - t0,
      error: e instanceof Error ? e.message : String(e),
      reason: classificarFalhaDeAlcance(e),
      target: alvoDe(base),
    };
  }
}

/**
 * O segredo interno dos crons também abre o modo verboso. Mesmo contrato de
 * `/api/v1/system/agent`: Bearer, comparação em tempo constante, e segredo vazio
 * nunca vira credencial válida.
 */
function segredoInternoConfere(req: NextRequest): boolean {
  const auth = req.headers.get("authorization") ?? "";
  const bearer = auth.startsWith("Bearer ") ? auth.slice("Bearer ".length).trim() : "";
  const fornecido = bearer || (req.headers.get("x-cron-secret")?.trim() ?? "");
  if (!fornecido) return false;
  const aceitos = [env.INTERNAL_CRON_SECRET, env.INTERNAL_SECRET].filter(Boolean);
  return aceitos.some((esperado) => {
    const a = Buffer.from(fornecido);
    const b = Buffer.from(esperado);
    // timingSafeEqual LANÇA se os tamanhos diferirem.
    return a.length === b.length && timingSafeEqual(a, b);
  });
}

/**
 * Sem o segredo, o endereço não sai — nem pelo `target`, nem pelo `error`.
 *
 * O `target` sempre foi escondido de propósito: esta rota é PÚBLICA (o `GET` não
 * exige nada; o segredo interno só destrava o `?verbose=1`), e o cabeçalho deste
 * arquivo chama o endereço de WAHA e Redis do cliente de superfície de ataque.
 * Mas o `error` saía cru ao lado dele, e ele carrega o mesmo endereço numa das
 * formas mais comuns de configuração errada.
 *
 * Medido, com valores que passam pelo Zod de `lib/env.ts` — porque só
 * `NEXT_PUBLIC_SUPABASE_URL` é `.url()` (linha 69); `WAHA_API_BASE_URL` (140) e
 * `UPSTASH_REDIS_REST_URL` (155) são `required()` puro, sem validação de forma:
 *
 *   "redis-interno.hostgator-vps.com"
 *     -> e.message = "Failed to parse URL from redis-interno.hostgator-vps.com"
 *   `"https://redis-interno.hostgator-vps.com"`  (aspas sobrando no .env)
 *     -> e.message = "Failed to parse URL from \"https://redis-interno...\""
 *
 * Ou seja: exatamente os dois serviços cujo endereço a rota esconde por decisão
 * escrita, e exatamente a instalação self-host que erra o `.env` — o caso já
 * catalogado nesta casa como ".env sem aspas". O `error` publicava pela porta
 * que a redação do `target` fechou.
 *
 * Contra-exemplo medido, para o escopo ficar honesto: um endereço com esquema
 * válido e host inalcançável devolve `"fetch failed"`, e o host mora em
 * `e.cause`, que esta rota nunca devolveu. O vazamento é da forma MALFORMADA,
 * não de toda falha — e é por isso que a troca é de redação, não de remoção.
 *
 * O que NÃO se perde: `reason` (`classificarFalhaDeAlcance`) continua saindo
 * inteiro, então quem monitora de fora segue distinguindo dns, recusa, tempo
 * esgotado e credencial recusada. E quem tem o segredo continua vendo o texto
 * original, porque `verbose=1` não passa por aqui.
 */
function semAlvo(check: Check): Check {
  const { target: _oculto, error, ...resto } = check;
  return error === undefined ? resto : { ...resto, error: "erro_ao_consultar" };
}

export async function GET(req: NextRequest) {
  const transportes = await transportesEmUso();

  /**
   * Sondar o transporte só quando ele é usado — e, quando não deu para
   * perguntar ao banco, sondar mesmo assim.
   *
   * O `|| !houveLeitura` é o que separa "não uso" de "não sei". Sem ele, um
   * banco momentaneamente inalcançável faria a sonda do transporte sumir do
   * corpo — e a ausência de um check lê como "está tudo bem com ele", que é a
   * conclusão exatamente oposta à disponível. Falha para o lado de informar
   * demais, que aqui é o lado barato.
   */
  const sondarTransporteProprio = temTransporteProprio(transportes) || !transportes.houveLeitura;

  const [supabase, redis, waha] = await Promise.all([
    checkSupabase(),
    checkRedis(),
    sondarTransporteProprio ? checkWaha() : Promise.resolve(null),
  ]);

  const verboso = req.nextUrl.searchParams.get("verbose") === "1" && segredoInternoConfere(req);
  const filtrar = verboso ? (c: Check) => c : semAlvo;
  const checks = {
    supabase: filtrar(supabase),
    redis: filtrar(redis),
    ...(waha ? { waha: filtrar(waha) } : {}),
  };

  const anyDown = Object.values(checks).some((c) => c.status === "down");
  const anyDegraded = Object.values(checks).some((c) => c.status === "degraded");
  const status: "healthy" | "degraded" | "unhealthy" = anyDown
    ? "unhealthy"
    : anyDegraded
      ? "degraded"
      : "healthy";

  const httpStatus = status === "unhealthy" ? 503 : 200;

  return NextResponse.json(
    {
      data: {
        status,
        // APP_VERSION é injetada no build da imagem (ARG no Dockerfile) e vale
        // "1.2.3" numa release, ou o SHA curto fora de tag.
        //
        // Antes isto era `process.env.npm_package_version ?? "0.1.0"`, e a
        // variável só existe quando o processo nasce de um `npm`/`pnpm run`. O
        // CMD da imagem é `node server.js`: TODA instalação do mundo reportava
        // "0.1.0". Um campo que responde o valor errado com confiança é pior que
        // um campo ausente — ele desliga a pergunta em vez de deixá-la aberta.
        // Por isso o fallback agora é "desconhecido", e não um número plausível.
        version: process.env.APP_VERSION || "desconhecido",
        timestamp: new Date().toISOString(),
        // Os transportes com conexão viva. Lista vazia é uma AFIRMAÇÃO ("esta
        // instalação ainda não transporta nada"), e é ela que explica por que
        // não há check de transporte em `checks`. Não carrega endereço nenhum —
        // é o nome do provider —, então não passa por `semAlvo`.
        transportes: [...transportes.providers].sort(),
        checks,
      },
    },
    { status: httpStatus },
  );
}
