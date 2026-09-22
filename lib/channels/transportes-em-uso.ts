/**
 * Por onde ESTA instalação transporta mensagem, perguntado ao banco.
 *
 * ─── O defeito que motivou o arquivo ────────────────────────────────────────
 *
 * `/api/v1/health` sondava o WAHA incondicionalmente, porque `WAHA_API_BASE_URL`
 * é `required()` em produção e portanto "sempre existe". Numa instalação
 * serverless não existe contêiner de WAHA nenhum — quem opera põe ali o nome do
 * serviço do compose só para o Zod parar de reclamar no boot, e o endereço nunca
 * resolve. Medido em produção: `status: "unhealthy"`, `waha.reason:
 * "endereco_nao_resolve"`, com Supabase e Redis verdes.
 *
 * Um health check que responde 503 para sempre não é um health check ruim: é um
 * health check DESLIGADO, porque a primeira coisa que todo mundo aprende é a
 * ignorá-lo. Quando o Supabase cair de verdade, a resposta será a mesma de
 * ontem e de anteontem, e ninguém vai olhar.
 *
 * ─── Por que o banco é a fonte, e não o `.env` ──────────────────────────────
 *
 * O `.env` diz o que alguém CONFIGUROU; `channel_sessions` diz o que a
 * instalação USA. Os dois discordam exatamente no caso que interessa — a
 * variável preenchida por obrigação do schema, apontando para um serviço que
 * não existe. A linha do banco não tem como mentir sobre isso: ela só está lá
 * se alguém pareou um número por aquele transporte.
 *
 * ─── O que se perde, dito em voz alta ───────────────────────────────────────
 *
 * Numa VPS recém-instalada, antes do primeiro pareamento, não há linha nenhuma —
 * então o health check deixa de sondar o transporte e o operador perde uma
 * verificação prévia do `.env` que antes tinha de graça. A troca é deliberada:
 * a verificação prévia volta como INFORMAÇÃO (`transportes: []` no corpo, que
 * diz "esta instalação ainda não transporta nada"), e não como luz vermelha. Um
 * alarme sobre um serviço que a instalação ainda não usa é o mesmo defeito de
 * cima, só que do outro lado.
 *
 * ─── A memória de 60 s não é economia, é superfície ─────────────────────────
 *
 * A rota é pública de propósito (é o que permite um monitor externo bater nela),
 * e sem memória cada batida de qualquer um do mundo vira uma consulta ao banco
 * com a service key. Sessenta segundos é mais curto que qualquer janela em que
 * alguém pareia um canal e vai olhar o health check, e curto o bastante para não
 * mascarar uma mudança real.
 */
import { createAdminClient } from "@/lib/supabase/admin";

import { CHANNEL_PROVIDER_WAHA } from "./capabilities";

/**
 * `providers` é o conjunto de transportes com pelo menos uma conexão VIVA.
 *
 * `houveLeitura: false` quer dizer "não consegui perguntar" — e é diferente de
 * conjunto vazio, que quer dizer "perguntei, e não há nenhum". Quem decide o que
 * sondar precisa dos dois separados: não perguntar não autoriza concluir nada.
 */
export interface TransportesEmUso {
  readonly providers: ReadonlySet<string>;
  readonly houveLeitura: boolean;
}

const VALIDADE_MS = 60_000;

let memoria: { em: number; valor: TransportesEmUso } | null = null;

/** Só para os testes: descarta a memória entre casos. */
export function esquecerTransportesEmUso(): void {
  memoria = null;
}

export async function transportesEmUso(agora = Date.now()): Promise<TransportesEmUso> {
  if (memoria && agora - memoria.em < VALIDADE_MS) return memoria.valor;

  let valor: TransportesEmUso;
  try {
    const admin = createAdminClient();
    // `archived_at is null` porque conexão aposentada foi desligada de propósito
    // — sondar o transporte dela é alarme sobre uma decisão que alguém tomou.
    const { data, error } = await admin
      .from("channel_sessions")
      .select("provider")
      .is("archived_at", null)
      .limit(200);

    valor = error
      ? { providers: new Set<string>(), houveLeitura: false }
      : {
          providers: new Set((data ?? []).map((l) => String(l.provider ?? ""))),
          houveLeitura: true,
        };
  } catch {
    // Sem service key, sem banco alcançável, ou `createAdminClient` recusando:
    // são todos "não consegui perguntar", e nenhum autoriza um veredito.
    valor = { providers: new Set<string>(), houveLeitura: false };
  }

  memoria = { em: agora, valor };
  return valor;
}

/**
 * Esta instalação transporta por um serviço que ela mesma hospeda?
 *
 * A pergunta é esta, e não "usa o provider X", por dois motivos que coincidem.
 * O primeiro é doutrina: o nome do provider não pode sair de `lib/channels/`
 * (invariante 1 da restrição de canal, cobrado por `scripts/lint-channels.ts`),
 * então quem sonda pergunta uma CAPACIDADE e nunca escreve qual serviço é.
 *
 * O segundo é que a capacidade é o critério certo por si só. O health check
 * sonda o que a instalação PÕE DE PÉ — se esse serviço morreu, é quem opera esta
 * máquina que conserta. O canal oficial da plataforma não entra: ele é
 * hospedado por terceiro, autenticado por credencial de cada organização, e
 * "fora do ar" ali não é fato desta instalação nem tem conserto por aqui.
 */
export function temTransporteProprio(t: TransportesEmUso): boolean {
  return t.providers.has(CHANNEL_PROVIDER_WAHA);
}
