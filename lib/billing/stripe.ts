/**
 * Cliente mínimo da API do Stripe — `fetch` + `node:crypto`, sem dependência nova.
 *
 * ─── Por que não o pacote `stripe` ─────────────────────────────────────────
 *
 * O repo evita dependência que faz pouco (a doutrina recusou Inngest/Trigger
 * pelo mesmo motivo: fila é `event_log` + cron). O que precisamos do Stripe são
 * TRÊS chamadas (criar checkout, criar portal, ler assinatura) e uma
 * verificação de HMAC — e a verificação de HMAC com `timingSafeEqual` já é
 * padrão daqui (`lib/webhooks/`). O SDK traria ~50 mil linhas e um segundo
 * modelo de tipos para manter alinhado com o nosso.
 *
 * A API do Stripe é `application/x-www-form-urlencoded` na entrada e JSON na
 * saída, e a versão é fixada no header — nada disso muda sob nossos pés.
 *
 * ─── Versão fixada, e por quê ──────────────────────────────────────────────
 *
 * `Stripe-Version` é enviado em TODA chamada. Sem ele o Stripe usa a versão
 * gravada na conta, que muda quando o dono clica em "upgrade" no dashboard — e
 * o payload do webhook muda junto, em produção, sem deploy nenhum do nosso
 * lado. Fixar aqui é o que torna o comportamento reproduzível.
 */
import { createHmac, timingSafeEqual } from "node:crypto";

const API = "https://api.stripe.com/v1";

/**
 * Fixada de propósito. Subir isto é uma mudança de código, revisada, não um
 * clique no dashboard de terceiro.
 */
export const STRIPE_VERSION = "2025-08-27.basil";

/** 15s: o Stripe responde em ~300ms; passar disso é rede, não lentidão dele. */
const TIMEOUT_MS = 15_000;

export class StripeError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string | null,
  ) {
    super(message);
    this.name = "StripeError";
  }
}

/**
 * Serializa no formato que o Stripe espera: `a[b]=1&c[0][d]=2`.
 *
 * `undefined` e `null` são OMITIDOS (não viram a string "undefined"), porque no
 * Stripe mandar um campo vazio e não mandar o campo são coisas diferentes —
 * `trial_period_days=` zeraria o trial em vez de deixá-lo no padrão.
 */
function achatar(valor: unknown, prefixo: string, saida: string[][]): void {
  if (valor === undefined || valor === null) return;
  if (Array.isArray(valor)) {
    valor.forEach((item, i) => achatar(item, `${prefixo}[${i}]`, saida));
    return;
  }
  if (typeof valor === "object") {
    for (const [k, v] of Object.entries(valor as Record<string, unknown>)) {
      achatar(v, `${prefixo}[${k}]`, saida);
    }
    return;
  }
  saida.push([prefixo, String(valor)]);
}

export function formEncode(corpo: Record<string, unknown>): string {
  const pares: string[][] = [];
  for (const [k, v] of Object.entries(corpo)) achatar(v, k, pares);
  return new URLSearchParams(pares).toString();
}

function chave(): string {
  const k = (process.env.STRIPE_SECRET_KEY ?? "").trim();
  if (!k) {
    // Alcançável só por bug: toda rota de billing é gateada por
    // `instalacaoCobra()` antes de chegar aqui. Lançar alto é melhor que uma
    // chamada anônima ao Stripe, que voltaria 401 com mensagem dele.
    throw new StripeError("STRIPE_SECRET_KEY ausente nesta instalação", 500, null);
  }
  return k;
}

async function chamar<T>(
  caminho: string,
  opts: { method: "GET" | "POST"; corpo?: Record<string, unknown>; idempotencyKey?: string },
): Promise<T> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${chave()}`,
    "Stripe-Version": STRIPE_VERSION,
  };
  if (opts.corpo) headers["Content-Type"] = "application/x-www-form-urlencoded";
  // O Stripe DEDUPLICA por esta chave por 24h. É o que impede um duplo-clique
  // em "Assinar" de abrir duas sessões de checkout para a mesma organização.
  if (opts.idempotencyKey) headers["Idempotency-Key"] = opts.idempotencyKey;

  let res: Response;
  try {
    res = await fetch(`${API}${caminho}`, {
      method: opts.method,
      headers,
      body: opts.corpo ? formEncode(opts.corpo) : undefined,
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
  } catch (e) {
    throw new StripeError(
      `Falha de rede ao falar com o Stripe: ${e instanceof Error ? e.message : String(e)}`,
      502,
      null,
    );
  }

  const texto = await res.text();
  let json: unknown = null;
  try {
    json = texto ? JSON.parse(texto) : null;
  } catch {
    /* resposta não-JSON só acontece em erro de borda do Stripe; cai no throw abaixo */
  }

  if (!res.ok) {
    const erro = (json as { error?: { message?: string; code?: string } } | null)?.error;
    throw new StripeError(
      erro?.message ?? `Stripe respondeu ${res.status}`,
      res.status,
      erro?.code ?? null,
    );
  }
  return json as T;
}

// ─────────────────────────────────────────────────────────────────────────────
// Os tipos que realmente lemos. Deliberadamente PARCIAIS: declarar o objeto
// inteiro do Stripe seria copiar o SDK que decidimos não instalar, e cada campo
// declarado e não lido é mais uma coisa para desalinhar na próxima versão deles.
// ─────────────────────────────────────────────────────────────────────────────

export interface StripeCheckoutSession {
  id: string;
  /**
   * O que o `<EmbeddedCheckout>` monta. No modo `embedded` o `url` vem NULO —
   * não existe página no stripe.com para onde mandar ninguém.
   */
  client_secret: string | null;
  url: string | null;
  /** `open` | `complete` | `expired` — o que a tela de retorno consulta. */
  status: string | null;
  customer: string | null;
  subscription: string | null;
  client_reference_id: string | null;
  metadata: Record<string, string> | null;
}

export interface StripeSubscription {
  id: string;
  status: string;
  customer: string;
  cancel_at_period_end: boolean;
  canceled_at: number | null;
  /**
   * Na API 2025-08-27 o fim do ciclo vive no ITEM, não na assinatura —
   * `subscription.current_period_end` foi removido. Lemos os dois: o do item
   * quando existe, o da raiz como retaguarda para contas ainda em versão
   * antiga. Ler só a raiz devolveria `undefined` silencioso, e o gate trataria
   * a assinatura como sem vencimento.
   */
  current_period_end?: number | null;
  items?: { data?: Array<{ current_period_end?: number | null; price?: { id?: string } }> };
  metadata: Record<string, string> | null;
}

export interface StripePortalSession {
  id: string;
  url: string;
}

/**
 * Cria a sessão EMBUTIDA — o formulário monta dentro da nossa tela.
 *
 * ─── `embedded` e não `hosted` ─────────────────────────────────────────────
 *
 * O modo `hosted` joga a pessoa em `checkout.stripe.com`: outro domínio, outra
 * marca, e o botão "voltar" do navegador no meio de um pagamento. O `embedded`
 * devolve um `client_secret` que o `<EmbeddedCheckout>` monta num iframe dentro
 * da nossa página — o PCI continua sendo do Stripe (o número do cartão nunca
 * toca o nosso DOM) e a moldura é nossa.
 *
 * ─── `redirect_on_completion: "if_required"` ───────────────────────────────
 *
 * As três opções não são equivalentes e a escolha custa dinheiro:
 *
 * - `always` — redireciona até no cartão aprovado na hora. Volta a ser um
 *   fluxo de navegação; perde metade da graça do embutido.
 * - `never` — nunca sai da tela, MAS o Stripe passa a oferecer só os meios de
 *   pagamento que não precisam de redirect. Nesta conta isso derrubaria
 *   **boleto** (que está ativo) — no Brasil, é conversão jogada fora.
 * - `if_required` — cartão completa sem sair da tela (o `onComplete` do
 *   provider dispara), e boleto/Pix redirecionam porque não têm escolha.
 *
 * Por isso o `return_url` é obrigatório aqui mesmo com o cartão nunca o
 * usando: ele é o caminho de volta de quem pagou por um meio que redireciona.
 */
export function criarCheckoutSession(params: {
  priceId: string;
  organizationId: string;
  email: string;
  customerId: string | null;
  returnUrl: string;
  trialDias: number | null;
  idempotencyKey: string;
}): Promise<StripeCheckoutSession> {
  return chamar<StripeCheckoutSession>("/checkout/sessions", {
    method: "POST",
    idempotencyKey: params.idempotencyKey,
    corpo: {
      mode: "subscription",
      ui_mode: "embedded",
      line_items: [{ price: params.priceId, quantity: 1 }],
      redirect_on_completion: "if_required",
      return_url: params.returnUrl,
      // `client_reference_id` E `metadata.organization_id`: o primeiro é o que
      // o Stripe mostra no dashboard e o segundo é o que sobrevive na
      // ASSINATURA depois que a sessão de checkout expira. O webhook de
      // renovação (meses depois) só enxerga a assinatura.
      client_reference_id: params.organizationId,
      metadata: { organization_id: params.organizationId },
      subscription_data: {
        metadata: { organization_id: params.organizationId },
        ...(params.trialDias && params.trialDias > 0
          ? { trial_period_days: params.trialDias }
          : {}),
      },
      // Reaproveitar o customer quando já existe é o que impede a mesma
      // empresa de virar dois clientes no Stripe (e duas cobranças) ao assinar
      // de novo depois de cancelar.
      ...(params.customerId
        ? { customer: params.customerId }
        : { customer_email: params.email, customer_creation: "always" }),
      allow_promotion_codes: true,
    },
  });
}

/**
 * Relê a sessão de checkout. É o que a tela de retorno consulta para saber se
 * o pagamento fechou sem ter de esperar o webhook chegar — ver
 * `app/api/v1/billing/checkout/status`.
 */
export function lerCheckoutSession(sessionId: string): Promise<StripeCheckoutSession> {
  return chamar<StripeCheckoutSession>(`/checkout/sessions/${encodeURIComponent(sessionId)}`, {
    method: "GET",
  });
}

export function criarPortalSession(params: {
  customerId: string;
  returnUrl: string;
}): Promise<StripePortalSession> {
  return chamar<StripePortalSession>("/billing_portal/sessions", {
    method: "POST",
    corpo: { customer: params.customerId, return_url: params.returnUrl },
  });
}

export function lerAssinatura(subscriptionId: string): Promise<StripeSubscription> {
  return chamar<StripeSubscription>(`/subscriptions/${encodeURIComponent(subscriptionId)}`, {
    method: "GET",
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Assinatura do webhook
// ─────────────────────────────────────────────────────────────────────────────

/** Rejeita entrega com mais de 5 minutos — a janela que o próprio Stripe usa. */
const TOLERANCIA_S = 300;

export type VerificacaoDeWebhook =
  | { ok: true; evento: StripeEvent }
  | { ok: false; motivo: string };

export interface StripeEvent {
  id: string;
  type: string;
  data: { object: Record<string, unknown> };
}

/**
 * Confere o header `Stripe-Signature` contra o CORPO CRU.
 *
 * O corpo tem de ser o texto exato recebido: `JSON.parse` + `JSON.stringify`
 * reordena chaves e muda o espaçamento, e a assinatura passa a nunca bater —
 * o modo de falha é 100% de rejeição com a configuração correta, que se lê
 * como "o segredo está errado" e manda quem depura para o lado errado.
 */
export function verificarWebhook(
  corpoCru: string,
  header: string | null,
  segredo: string,
  agoraS: number = Math.floor(Date.now() / 1000),
): VerificacaoDeWebhook {
  if (!header) return { ok: false, motivo: "assinatura ausente" };
  if (!segredo) return { ok: false, motivo: "STRIPE_WEBHOOK_SECRET ausente" };

  let timestamp: string | null = null;
  const assinaturas: string[] = [];
  for (const parte of header.split(",")) {
    const [k, v] = parte.split("=", 2);
    if (k?.trim() === "t") timestamp = v?.trim() ?? null;
    // `v1` pode repetir durante a rotação do segredo — o Stripe manda uma
    // assinatura por segredo ativo e basta UMA bater.
    if (k?.trim() === "v1" && v) assinaturas.push(v.trim());
  }
  if (!timestamp || assinaturas.length === 0) {
    return { ok: false, motivo: "assinatura malformada" };
  }

  const emitidoEm = Number(timestamp);
  if (!Number.isFinite(emitidoEm)) return { ok: false, motivo: "timestamp inválido" };
  if (Math.abs(agoraS - emitidoEm) > TOLERANCIA_S) {
    return { ok: false, motivo: "entrega fora da janela de 5 minutos" };
  }

  const esperado = createHmac("sha256", segredo)
    .update(`${timestamp}.${corpoCru}`, "utf8")
    .digest();

  const bate = assinaturas.some((a) => {
    let recebida: Buffer;
    try {
      recebida = Buffer.from(a, "hex");
    } catch {
      return false;
    }
    // `timingSafeEqual` LANÇA quando os tamanhos diferem — e é justamente o que
    // um atacante manda para descobrir se estamos comparando de fato. O guard
    // de tamanho não vaza nada: o comprimento do HMAC é público.
    return recebida.length === esperado.length && timingSafeEqual(recebida, esperado);
  });
  if (!bate) return { ok: false, motivo: "assinatura não confere" };

  let evento: StripeEvent;
  try {
    evento = JSON.parse(corpoCru) as StripeEvent;
  } catch {
    return { ok: false, motivo: "corpo não é JSON" };
  }
  if (!evento?.id || !evento?.type) return { ok: false, motivo: "evento sem id ou type" };

  return { ok: true, evento };
}
