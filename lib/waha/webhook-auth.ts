/**
 * Autenticação dos webhooks do WAHA — fail-closed.
 *
 * O que existia antes era fail-OPEN: se o segredo não pudesse ser obtido
 * (`fn_decrypt_oauth` falhando, ou o campo trazendo um placeholder), a rota
 * marcava `hmacSkipped = true` e **processava o evento assim mesmo**. Como as
 * duas rotas que criam sessão gravam `webhook_secret_encrypted: Buffer.from([0])`
 * — um byte de enfeite —, esse "caso de exceção" era o estado PERMANENTE de toda
 * instalação: qualquer pessoa que soubesse a URL injetava mensagem falsa no CRM
 * alheio, escolhia o remetente e fazia o WhatsApp da vítima responder para um
 * número arbitrário (provado nesta VPS, com `curl` sem header nenhum).
 *
 * Três regras, nesta ordem:
 *
 *  1. Assinatura presente que NÃO confere ⇒ rejeita. Sempre. Não existe motivo
 *     legítimo para alguém assinar errado, e era o buraco mais óbvio.
 *  2. `WAHA_WEBHOOK_REQUIRE_SIGNATURE=true` ⇒ exige assinatura válida em tudo.
 *     Fica desligado por padrão porque o WAHA **Core** não assina: medido nesta
 *     VPS (2026.7.2 CORE), os eventos reais chegam sem header algum mesmo com
 *     `WHATSAPP_HOOK_HMAC` configurado no contêiner. Ligar isso por default
 *     derrubaria a ingestão de mensagens de todo mundo — remédio pior que a
 *     doença. Quem roda WAHA Plus (ou um proxy que assina) liga e ganha a
 *     verificação forte.
 *  3. Sem assinatura e sem exigência ⇒ aceita, mas devolve `signatureVerified:
 *     false` — e quem chama grava ESSA verdade no log. Antes o log registrava
 *     `valid_signature = true` para evento não verificado.
 *
 * A defesa que não depende do WAHA saber assinar é de rede: a rota global (sem
 * token) deixa de ser publicada pelo Caddy, porque o WAHA fala com o app pela
 * rede interna do Docker e nunca precisou dela pela internet. Ver Caddyfile.
 */
import { env } from "@/lib/env";

import { verifyHmacSha512 } from "./ingest";

/** Curto demais para ser segredo de verdade — é placeholder ou lixo de decrypt. */
const MIN_SECRET_LEN = 16;

export type WahaWebhookAuth =
  | { ok: true; signatureVerified: boolean }
  | { ok: false; reason: "bad_signature" | "signature_required" };

export interface WahaWebhookAuthInput {
  rawBody: string;
  signatureHeader: string | null;
  /** Segredo por sessão já decifrado (null quando não há/não decifrou). */
  sessionSecret: string | null;
}

export function authenticateWahaWebhook(input: WahaWebhookAuthInput): WahaWebhookAuth {
  const { rawBody, signatureHeader, sessionSecret } = input;

  const envSecret = (env.WAHA_HMAC_SECRET ?? "").trim();
  // AS DUAS chaves valem, e não "a da sessão, senão a global". O WAHA assina
  // com UMA chave só — `WHATSAPP_HOOK_HMAC`, global do contêiner — sempre que o
  // webhook é o global (`WHATSAPP_HOOK_URL`), que é como o kit o sobe. A sessão
  // nova ganha `webhook_secret_encrypted` próprio no connect, e com a
  // precedência antiga esse segredo, que o WAHA nunca conheceu, virava o único
  // aceito: toda mensagem chegava assinada com a global e voltava 401. Medido
  // em 07/10/2026 no Atenza online — sessão WORKING, zero evento ingerido.
  // Aceitar as duas não afrouxa nada: ambas são segredos nossos, e a regra 1
  // continua — assinatura que não confere com NENHUMA é rejeitada.
  const segredos = [sessionSecret ?? "", envSecret].filter(
    (s) => s.length >= MIN_SECRET_LEN,
  );

  const required = env.WAHA_WEBHOOK_REQUIRE_SIGNATURE === "true";

  if (signatureHeader) {
    // Assinou: tem que conferir. Sem segredo para conferir, não há como
    // confiar — e confiar no que não dá para verificar é o defeito original.
    if (segredos.length === 0) return { ok: false, reason: "bad_signature" };
    return segredos.some((s) => verifyHmacSha512(rawBody, signatureHeader, s))
      ? { ok: true, signatureVerified: true }
      : { ok: false, reason: "bad_signature" };
  }

  if (required) return { ok: false, reason: "signature_required" };
  return { ok: true, signatureVerified: false };
}
