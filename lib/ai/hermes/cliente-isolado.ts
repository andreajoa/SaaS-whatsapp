/**
 * Ponte EXPERIMENTAL e inativa por padrão entre Atenza e um perfil Hermes dedicado.
 *
 * Esta ponte NÃO executa ferramentas do CRM. O endpoint Chat Completions do
 * Hermes executa suas próprias ferramentas e não substitui o contrato de
 * tool-calling de runModelCall. Não usar em agent_turn sem homologação E2E.
 *
 * organizationId, conversationId, turnId e mensagens devem vir de consultas
 * autenticadas e filtradas pelo organization_id, nunca diretamente do cliente.
 */
import { createHmac } from "node:crypto";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_MESSAGE_CHARS = 20_000;
const MAX_MESSAGES = 40;

export type MensagemIsolada = {
  role: "user" | "assistant";
  content: string;
};

export interface TurnoHermesIsolado {
  organizationId: string;
  conversationId: string;
  turnId: string;
  /** Instruções carregadas do tenant autenticado, sem dados de outras empresas. */
  instrucoesDaEmpresa: string;
  /** Histórico consultado com WHERE organization_id = organizationId. */
  mensagens: MensagemIsolada[];
}

export interface ConfigHermesDedicado {
  /** URL INTERNA controlada pelo operador; nunca recebida do navegador. */
  baseUrl: string;
  /** Chave da API do PERFIL dedicado ao Atenza, não a do Hermes pessoal. */
  apiKey: string;
  /** Segredo estável exclusivo desta integração, >= 32 caracteres. */
  scopeSecret: string;
  model?: string;
  timeoutMs?: number;
}

export class HermesIsolamentoError extends Error {
  constructor(readonly code: string) {
    super(code);
    this.name = "HermesIsolamentoError";
  }
}

function validarUuid(v: string): void {
  if (!UUID.test(v)) throw new HermesIsolamentoError("identidade_invalida");
}

function assinatura(secret: string, ...campos: string[]): string {
  return createHmac("sha256", secret)
    .update(campos.map((s) => `${s.length}:${s}`).join("|"))
    .digest("hex");
}

/** Identificadores opacos e estáveis; duas empresas nunca dividem uma sessão. */
export function identidadeHermesPorConversa(
  org: string,
  conversation: string,
  turn: string,
  scopeSecret: string,
): { sessionId: string; sessionKey: string; idempotencyKey: string } {
  validarUuid(org);
  validarUuid(conversation);
  validarUuid(turn);
  if (scopeSecret.length < 32) throw new HermesIsolamentoError("segredo_fraco");

  const scope = assinatura(scopeSecret, "atenza", "session", org, conversation);
  const idempotencia = assinatura(scopeSecret, "atenza", "turn", org, conversation, turn);
  return {
    sessionId: `atenza-${scope.slice(0, 32)}`,
    sessionKey: `atenza:tenant:${scope}`,
    idempotencyKey: `atenza-${idempotencia}`,
  };
}

function endpointInterno(baseUrl: string): URL {
  let url: URL;
  try {
    url = new URL(baseUrl);
  } catch {
    throw new HermesIsolamentoError("endpoint_invalido");
  }
  if (url.username || url.password || url.search || url.hash) {
    throw new HermesIsolamentoError("endpoint_invalido");
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new HermesIsolamentoError("endpoint_invalido");
  }
  // Sem HTTP público: só rede privada local ou nome de serviço no Docker.
  if (url.protocol === "http:" &&
    !/^(localhost|127\.0\.0\.1|hermes|hermes-atenza)$/i.test(url.hostname)) {
    throw new HermesIsolamentoError("endpoint_nao_privado");
  }
  url.pathname = `${url.pathname.replace(/\/$/, "")}/chat/completions`;
  return url;
}

export async function consultarHermesIsolado(
  turno: TurnoHermesIsolado,
  config: ConfigHermesDedicado,
  fetchImpl: typeof fetch = fetch,
): Promise<string> {
  const scope = identidadeHermesPorConversa(
    turno.organizationId,
    turno.conversationId,
    turno.turnId,
    config.scopeSecret,
  );
  if (!config.apiKey || !turno.instrucoesDaEmpresa.trim()) {
    throw new HermesIsolamentoError("configuracao_incompleta");
  }
  if (turno.mensagens.length < 1 || turno.mensagens.length > MAX_MESSAGES ||
    turno.mensagens.at(-1)?.role !== "user" ||
    turno.mensagens.some((m) => !["user", "assistant"].includes(m.role) ||
      !m.content.trim() || m.content.length > MAX_MESSAGE_CHARS)) {
    throw new HermesIsolamentoError("mensagens_invalidas");
  }

  const endpoint = endpointInterno(config.baseUrl);
  const identificacao = `Escopo de conversa: ${scope.sessionKey}. Não atenda outras organizações.`;
  const mensagens = [
    { role: "system", content: `${identificacao}\n${turno.instrucoesDaEmpresa}` },
    ...turno.mensagens,
  ];

  const res = await fetchImpl(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
      "X-Hermes-Session-Key": scope.sessionKey,
      "X-Hermes-Session-Id": scope.sessionId,
      "Idempotency-Key": scope.idempotencyKey,
    },
    body: JSON.stringify({
      model: config.model ?? "hermes-agent",
      messages: mensagens,
      stream: false,
      // Nenhuma ferramenta do CRM é entregue a este serviço.
    }),
    signal: AbortSignal.timeout(config.timeoutMs ?? 60_000),
  });
  if (!res.ok) throw new HermesIsolamentoError(`hermes_http_${res.status}`);

  const dados: unknown = await res.json();
  if (!dados || typeof dados !== "object" || !("choices" in dados) ||
    !Array.isArray(dados.choices) || !dados.choices[0]) {
    throw new HermesIsolamentoError("resposta_invalida");
  }
  const choice = dados.choices[0] as { finish_reason?: unknown; message?: { content?: unknown } };
  // Recusar resposta parcial/falha: o WhatsApp não pode receber um falso sucesso.
  if (choice.finish_reason !== "stop" ||
    typeof choice.message?.content !== "string" || !choice.message.content.trim()) {
    throw new HermesIsolamentoError("resposta_incompleta");
  }
  return choice.message.content;
}
