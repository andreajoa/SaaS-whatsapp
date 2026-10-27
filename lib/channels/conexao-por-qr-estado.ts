/**
 * O `estado` da conexão por QR — curto de propósito.
 *
 * A volta da janela de conexão chega de outro site, e o cookie de sessão
 * (`sameSite: "strict"`) não viaja nela: quem diz de qual organização é a
 * volta é este estado, assinado com `INTERNAL_SECRET`. Mesmo desenho de
 * `lib/agenda/google/estado.ts`, com uma diferença medida na documentação do
 * provedor: o `redirect_url` inteiro, já codificado, tem teto de 258
 * caracteres. O estado do Google (carga em base64 + HMAC cheio) estoura esse
 * teto sozinho — por isso aqui vão só a organização, quem iniciou, o prazo em
 * base 36 e o HMAC truncado em 128 bits (~190 caracteres no total).
 *
 * O que ele NÃO precisa provar: que a conta conectada é desta organização.
 * Isso quem prova é o provedor, na volta (`contaDoPerfil`) — a conta só existe
 * no perfil desta organização se alguém completou a janela aberta por ela.
 */
import { createHmac, timingSafeEqual } from "node:crypto";

/** O link do provedor vale 60 minutos; o estado não pode durar menos. */
export const VALIDADE_DO_ESTADO_QR_MS = 70 * 60 * 1000;

const TAMANHO_MINIMO_DO_SEGREDO = 16;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type OrigemDaConexaoPorQr = "onboarding" | "conexoes";

export interface EstadoDaConexaoPorQr {
  organizationId: string;
  /** Quem abriu a janela — vira o autor da publicação do agente e do audit. */
  userId: string;
  expiraEm: number;
}

function conferirSegredo(segredo: string): string {
  const s = segredo?.trim() ?? "";
  if (s.length < TAMANHO_MINIMO_DO_SEGREDO) {
    throw new Error("INTERNAL_SECRET ausente ou curto demais: a volta da conexão por QR não teria como ser verificada");
  }
  return s;
}

function assinar(organizationId: string, userId: string, prazo: string, segredo: string): string {
  return createHmac("sha256", segredo)
    .update(`conexao-por-qr.${organizationId}.${userId}.${prazo}`, "utf8")
    .digest("hex")
    .slice(0, 32);
}

/** Os parâmetros que vão na URL de volta. */
export function emitirEstadoQr(
  dados: { organizationId: string; userId: string },
  opcoes: { segredo: string; agora: Date },
): { o: string; u: string; x: string; s: string } {
  const segredo = conferirSegredo(opcoes.segredo);
  const { organizationId, userId } = dados;
  if (!UUID.test(organizationId) || !UUID.test(userId)) {
    throw new Error("organizationId/userId inválido para o estado da conexão por QR");
  }
  const x = (opcoes.agora.getTime() + VALIDADE_DO_ESTADO_QR_MS).toString(36);
  return { o: organizationId, u: userId, x, s: assinar(organizationId, userId, x, segredo) };
}

/** `null` para qualquer recusa — assinatura, prazo ou formato. */
export function verificarEstadoQr(
  params: { o: string | null; u: string | null; x: string | null; s: string | null },
  opcoes: { segredo: string; agora: Date },
): EstadoDaConexaoPorQr | null {
  const segredo = conferirSegredo(opcoes.segredo);
  const { o, u, x, s } = params;
  if (
    !o || !u || !x || !s ||
    !UUID.test(o) || !UUID.test(u) ||
    !/^[0-9a-z]{1,12}$/.test(x) || !/^[0-9a-f]{32}$/.test(s)
  ) {
    return null;
  }
  const esperado = Buffer.from(assinar(o, u, x, segredo), "hex");
  const recebido = Buffer.from(s, "hex");
  if (esperado.length !== recebido.length || !timingSafeEqual(esperado, recebido)) return null;
  const expiraEm = parseInt(x, 36);
  if (!Number.isFinite(expiraEm) || opcoes.agora.getTime() > expiraEm) return null;
  return { organizationId: o, userId: u, expiraEm };
}

export function lerOrigemQr(bruto: string | null): OrigemDaConexaoPorQr {
  return bruto === "o" ? "onboarding" : "conexoes";
}

export function codigoDaOrigemQr(origem: OrigemDaConexaoPorQr): "o" | "c" {
  return origem === "onboarding" ? "o" : "c";
}
