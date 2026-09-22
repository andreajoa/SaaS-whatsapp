/**
 * O SEGUNDO portão do opt-out: a INTENÇÃO, julgada pelo Jev (TypeSafe System One).
 *
 * ─── Por que existe, se `deteccao.ts` já decide ─────────────────────────────
 *
 * `ehPedidoDeOptOut` é determinístico e deve continuar sendo o primeiro portão:
 * palavra isolada ("SAIR") e frase com objeto de comunicação ("parar de me
 * mandar") são match exato, grátis e sem rede. O que ele não alcança é a frase
 * que pede para sair sem usar nenhum dos padrões escritos — cada uma que escapa
 * é alguém que pediu e continua recebendo, no canal onde denúncia de spam
 * derruba o quality rating do número.
 *
 * O Jev devolve uma PROBABILIDADE calibrada, não texto. Medido em 21/09/2026 no
 * conjunto dourado de `~/.agent/jev/specs/optout.json`: numa frase ele separa
 * com folga — "para de me mandar essas mensagens" 0.88 contra "tem como parar a
 * dor?" 0.03 — e a distribuição tem um vão vazio entre 0.56 e 0.82.
 * `LIMIAR_DE_BLOQUEIO` mora no MEIO desse vão, não na borda: rodadas diferentes
 * movem a probabilidade uns centésimos.
 *
 * Numa PALAVRA SOLTA ele empaca em ~0.77, e com razão: não há contexto para
 * julgar intenção. Por isso palavra solta nunca chega aqui (`merecePerguntarAoJev`).
 *
 * ─── Falha para o lado de NÃO bloquear ──────────────────────────────────────
 *
 * Sem chave, sem rede, resposta lenta ou malformada: `null`, e o chamador fica
 * com o que o portão determinístico decidiu. Bloquear é um estado que só uma
 * pessoa desfaz; um Jev fora do ar não pode silenciar ninguém.
 *
 * O texto da mensagem sai para o provedor do Jev — o mesmo tipo de operador que
 * já recebe a conversa inteira quando o agente responde. Nada vai para log.
 */
import { normalizarTexto } from "./deteccao";

/** p ≥ isto autoriza gravar `is_blocked` (meio do vão medido: 0.56 … 0.82). */
export const LIMIAR_DE_BLOQUEIO = 0.7;

/** O atendimento não espera o Jev além disto — ele responde em ~1 s. */
const TEMPO_MAXIMO_MS = 3_000;

/** A rubrica do spec `optout`, sem alteração: é onde a precisão mora. */
const PERGUNTAS = {
  quer_parar_de_receber: {
    type: "noul",
    instructions:
      "A pessoa está pedindo para PARAR DE RECEBER MENSAGENS deste remetente — ou seja, quer sair da lista de contato?",
    criteria: {
      true: "O objeto do pedido é a COMUNICAÇÃO: parar de mandar mensagem, sair da lista, descadastrar, não receber mais nada, bloquear o contato, remover o número ou o email do cadastro.",
      false:
        "A pessoa usa 'parar', 'sair', 'cancelar' ou 'chega' falando de QUALQUER OUTRA COISA da vida dela: parar uma dor, sair mais cedo de uma consulta, cancelar ou remarcar um agendamento, parar um tratamento, sair de um lugar. Reclamar do serviço, estar irritada ou não querer comprar também NÃO é pedido de descadastro.",
    },
  },
} as const;

/**
 * Pistas de que a mensagem PODE ser um pedido para parar. É um filtro de custo,
 * não de decisão: a esmagadora maioria das mensagens ("bom dia", "quanto
 * custa?") não tem nenhuma, e perguntar ao Jev sobre elas seria pagar por
 * `false`. Largo de propósito — um falso positivo aqui custa uma chamada; um
 * falso negativo, um pedido de saída ignorado.
 */
const PISTAS = new RegExp(
  [
    // "para" sozinho é preposição em quase toda frase; o verbo vem como
    // "parar", "pare(m)" ou "para de".
    "parar",
    "parem?\\b",
    "para\\s+de\\b",
    "sai(?:r|a)\\b",
    "me\\s+tir[ae]",
    "cancel",
    "chega\\b",
    "basta\\b",
    "receb",
    "lista\\b",
    "bloque",
    "remov",
    "descadastr",
    "stop\\b",
    "unsubscrib",
    // "manda o preço" é venda, não saída: só a negação conta.
    "nao\\s+(?:me\\s+)?(?:mand|envi)",
    "nao\\s+quero\\s+mais",
    "deix[ae]\\s+(?:me\\s+)?em\\s+paz",
    "incomod",
    "spam\\b",
    "baja\\b",
    "no\\s+quiero",
    "ya\\s+no\\b",
    "molest",
  ]
    .map((p) => `\\b${p}`)
    .join("|"),
  "u",
);

/** A mensagem merece a pergunta? Frase (≥ 2 palavras) com alguma pista. */
export function merecePerguntarAoJev(texto: string | null | undefined): boolean {
  if (!texto) return false;
  const normalizado = normalizarTexto(texto.trim());
  if (normalizado.length === 0 || normalizado.length > 1_000) return false;
  if (normalizado.split(/\s+/u).filter(Boolean).length < 2) return false;
  return PISTAS.test(normalizado);
}

type FonteDeAmbiente = Record<string, string | undefined>;

export interface DependenciasDoJev {
  fetch?: typeof fetch;
  env?: FonteDeAmbiente;
}

/** Endpoint nativo quando há chave da TypeSafe; senão o espelho dentro da OpenRouter. */
function destino(env: FonteDeAmbiente): { url: string; modelo: string; chave: string } | null {
  const typesafe = (env.TYPESAFE_API_KEY ?? "").trim();
  if (typesafe) {
    return { url: "https://api.typesafe.ai/v1/systemone", modelo: "jev-latest", chave: typesafe };
  }
  const openrouter = (env.OPENROUTER_API_KEY ?? "").trim();
  if (openrouter) {
    // O til no id é do próprio espelho da OpenRouter, não erro de digitação.
    return { url: "https://openrouter.ai/api/v1/systemone", modelo: "~typesafe/jev-latest", chave: openrouter };
  }
  return null;
}

/**
 * A probabilidade de a mensagem ser um pedido de descadastro, ou `null` quando
 * não deu para perguntar. Nunca lança.
 */
export async function probabilidadeDeOptOut(
  texto: string,
  deps: DependenciasDoJev = {},
): Promise<number | null> {
  const alvo = destino(deps.env ?? process.env);
  if (!alvo) return null;
  const chamar = deps.fetch ?? fetch;

  try {
    const resposta = await chamar(alvo.url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${alvo.chave}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ model: alvo.modelo, state: texto, questions: PERGUNTAS }),
      signal: AbortSignal.timeout(TEMPO_MAXIMO_MS),
    });
    if (!resposta.ok) return null;
    const corpo = (await resposta.json()) as {
      answers?: { quer_parar_de_receber?: { noul?: unknown } };
    };
    const p = corpo.answers?.quer_parar_de_receber?.noul;
    return typeof p === "number" && Number.isFinite(p) && p >= 0 && p <= 1 ? p : null;
  } catch {
    return null;
  }
}
