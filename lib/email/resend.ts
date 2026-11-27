/**
 * Resend wrapper. Usado por: convites de team, LGPD (export + alarme de SLA).
 *
 * ── O remetente é do OPERADOR; o nome de exibição é da MARCA ─────────────────
 *
 * `RESEND_FROM_EMAIL` é um endereço de um domínio que precisa estar VERIFICADO
 * na conta Resend de quem instalou — é do operador, e nenhuma resolução de
 * marca muda isso. O que a marca resolve é o NOME de exibição (`fromName`),
 * que é o que o destinatário lê na caixa de entrada. É aqui que o white-label
 * do remetente acontece, e é só aqui.
 *
 * ── Por que vazio significa NÃO CONFIGURADO ─────────────────────────────────
 *
 * O fallback antigo era `"Deskcomm <noreply@deskcomm.app>"`. Num clone isso é
 * PIOR que nada: o domínio não está verificado na conta Resend do revendedor,
 * então TODO envio falha lá na Resend e volta como `send_failed` com mensagem
 * opaca — o operador vai caçar rede, contêiner e chave, quando o problema é uma
 * variável em branco. Tratar como não-configurado joga o fluxo no caminho que
 * JÁ existe e JÁ é bom: `EmailNotConfigured` → `pending_review` no worker de
 * LGPD (`workers/lgpd-export-worker.ts:254-289`) e o convite mostrando o
 * `accept_url` na tela (`app/api/v1/team/invite/route.ts`).
 *
 * As duas chaves saíram do `process.env` cru e entraram no Zod (`lib/env.ts`).
 * Fora dele elas ficavam fora do `.env.example` e fora do `install.sh`, e o
 * `.env` é escrito com truncamento: chave posta à mão sumia no update seguinte.
 */
import { Resend } from "resend";

import { env } from "@/lib/env";

interface SendArgs {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
  tags?: { name: string; value: string }[];
  /**
   * Nome de exibição do remetente — a marca resolvida (`marcaDaSaida().nome`).
   * Ausente usa o endereço puro: quem não passa marca não ganha a nossa.
   */
  fromName?: string;
  /**
   * Cabeçalhos SMTP crus. Existe por UM motivo concreto: `List-Unsubscribe` e
   * `List-Unsubscribe-Post` (RFC 8058), os dois que fazem o Gmail desenhar o
   * botão nativo de "Cancelar inscrição" ao lado do remetente.
   *
   * Sem esse botão, quem quer sair de uma sequência de propaganda usa o que
   * está à mão — "marcar como spam" —, e esse clique não atinge a mensagem:
   * atinge a reputação do DOMÍNIO, para todos os destinatários seguintes.
   * `lib/marketing/descadastro.ts` monta o par; aqui é só o cano.
   */
  headers?: Record<string, string>;
  /**
   * Follow-up (passo da sequência de marketing): sai pelo NovaMail e só volta
   * para a Resend se o NovaMail falhar. Primeiro contato e avisos: Resend →
   * (limite) Brevo → (limite) NovaMail.
   */
  followUp?: boolean;
}

interface SendResult {
  ok: boolean;
  id?: string;
  provider?: "resend" | "brevo" | "novamail";
  error?: "not_configured" | "send_failed" | "rate_limited" | "dominio_nao_verificado";
  details?: string;
}

let _client: Resend | null = null;

function getClient(): Resend | null {
  if (_client) return _client;
  const key = env.RESEND_API_KEY;
  if (!key || key.length < 10) return null;
  _client = new Resend(key);
  return _client;
}

/**
 * `null` = não há remetente utilizável. Nunca inventa um domínio nosso.
 *
 * O nome de exibição é sanitizado: `<`, `>`, `"` e quebra de linha dentro do
 * cabeçalho `From:` são injeção de cabeçalho SMTP, e a marca vem de um campo
 * que o operador digita numa tela.
 */
export function fromAddress(fromName?: string): string | null {
  const endereco = env.RESEND_FROM_EMAIL.trim();
  if (endereco.length === 0) return null;
  const nome = (fromName ?? "").replace(/[<>"\r\n]/g, "").trim();
  return nome.length > 0 ? `${nome} <${endereco}>` : endereco;
}

/**
 * A Resend recusa domínio não verificado com uma mensagem própria, e o ramo
 * genérico `send_failed` a apagava. Classificar aqui é o que faz a diferença
 * entre "reinicie o container" e "verifique seu domínio na Resend" — a lição
 * já paga neste projeto: erro que não nomeia a causa vira caça ao fantasma.
 */
function classificar(nome: string, mensagem: string): NonNullable<SendResult["error"]> {
  if (nome.toLowerCase().includes("rate") || /quota|limit|exceeded|too many/i.test(`${nome} ${mensagem}`)) return "rate_limited";
  if (/not verified|domain is not verified|não verificad/i.test(mensagem)) {
    return "dominio_nao_verificado";
  }
  return "send_failed";
}

async function viaResend(args: SendArgs): Promise<SendResult> {
  const client = getClient();
  const from = fromAddress(args.fromName);

  if (!client || !from) {
    if (process.env.NODE_ENV !== "production") {
      console.warn(
        "[email] envio desligado — falta RESEND_API_KEY ou RESEND_FROM_EMAIL. Payload:",
        {
          to: args.to,
          subject: args.subject,
          preview: args.text?.slice(0, 200) ?? args.html.slice(0, 200),
          tem_chave: client !== null,
          tem_remetente: from !== null,
        },
      );
    }
    return { ok: false, error: "not_configured" };
  }

  try {
    const { data, error } = await client.emails.send({
      from,
      to: args.to,
      subject: args.subject,
      html: args.html,
      text: args.text,
      replyTo: args.replyTo,
      tags: args.tags,
      headers: args.headers,
    });

    if (error) {
      return {
        ok: false,
        error: classificar(String(error.name || ""), error.message ?? ""),
        details: error.message,
      };
    }
    return { ok: true, id: data?.id, provider: "resend" };
  } catch (err) {
    return {
      ok: false,
      error: "send_failed",
      details: err instanceof Error ? err.message : String(err),
    };
  }
}

// ── Transbordo ────────────────────────────────────────────────────────────────

const NOVAMAIL_URL = () => (env.NOVAMAIL_API_URL || "https://api.novamail.nexaclouds.online").replace(/\/$/, "");

/** Remetente no NovaMail: o configurado, ou o da Resend com o domínio em `mail.`. */
export function novamailFrom(fromName?: string): string | null {
  const configured = env.NOVAMAIL_FROM_EMAIL.trim();
  let endereco = configured;
  if (!endereco) {
    const base = env.RESEND_FROM_EMAIL.trim();
    const m = base.match(/^([^@\s]+)@(.+)$/);
    if (!m) return null;
    endereco = m[2]!.startsWith("mail.") ? base : `${m[1]}@mail.${m[2]}`;
  }
  const nome = (fromName ?? "").replace(/[<>"\r\n]/g, "").trim();
  return nome.length > 0 ? `${nome} <${endereco}>` : endereco;
}

async function viaNovaMail(args: SendArgs): Promise<SendResult> {
  const key = env.NOVAMAIL_API_KEY;
  const from = novamailFrom(args.fromName);
  if (!key || !from) return { ok: false, error: "not_configured" };
  try {
    const res = await fetch(`${NOVAMAIL_URL()}/emails`, {
      method: "POST",
      headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify({
        from,
        to: Array.isArray(args.to) ? args.to : [args.to],
        subject: args.subject,
        html: args.html,
        text: args.text,
        reply_to: args.replyTo ? [args.replyTo] : undefined,
        headers: args.headers,
        tags: args.tags?.map((t) => ({ name: t.name.replace(/[^A-Za-z0-9_-]/g, "_"), value: t.value.replace(/[^A-Za-z0-9_-]/g, "_") })),
      }),
    });
    const data = (await res.json().catch(() => ({}))) as { id?: string; message?: string; name?: string };
    if (!res.ok || !data.id) return { ok: false, error: classificar(String(data.name ?? (res.status === 429 ? "rate" : "")), data.message ?? ""), details: data.message ?? String(res.status) };
    return { ok: true, id: `nm:${data.id}`, provider: "novamail" };
  } catch (err) {
    return { ok: false, error: "send_failed", details: err instanceof Error ? err.message : String(err) };
  }
}

function brevoAddress(v: string) {
  const m = v.match(/^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/);
  return m ? { name: m[1]!.trim() || undefined, email: m[2]!.trim() } : { email: v.trim() };
}

async function viaBrevo(args: SendArgs): Promise<SendResult> {
  const key = env.BREVO_API_KEY;
  const from = fromAddress(args.fromName);
  if (!key || !from) return { ok: false, error: "not_configured" };
  try {
    const res = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: { "api-key": key, "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({
        sender: brevoAddress(from),
        to: (Array.isArray(args.to) ? args.to : [args.to]).map((email) => ({ email })),
        replyTo: args.replyTo ? brevoAddress(args.replyTo) : undefined,
        subject: args.subject,
        htmlContent: args.html,
        textContent: args.text,
        headers: args.headers,
        tags: args.tags?.map((t) => `${t.name}:${t.value}`),
      }),
    });
    const data = (await res.json().catch(() => ({}))) as { messageId?: string; message?: string; code?: string };
    if (!res.ok || !data.messageId) return { ok: false, error: classificar(res.status === 429 ? "rate" : String(data.code ?? ""), data.message ?? ""), details: data.message ?? String(res.status) };
    return { ok: true, id: `brevo:${data.messageId}`, provider: "brevo" };
  } catch (err) {
    return { ok: false, error: "send_failed", details: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Ordem (pedido do André, 27/11/2026): follow-up → NovaMail (volta à Resend se
 * falhar). Resto → Resend; no limite → Brevo; no limite → NovaMail. A Resend e o
 * Brevo nunca são desligados — o NovaMail só soma.
 */
export async function sendEmail(args: SendArgs): Promise<SendResult> {
  if (args.followUp && env.NOVAMAIL_API_KEY) {
    const nm = await viaNovaMail(args);
    if (nm.ok) return nm;
    console.warn("[email] NovaMail falhou num follow-up; usando a Resend:", nm.details);
  }
  const first = await viaResend(args);
  if (first.ok || first.error !== "rate_limited") return first;
  const brevo = await viaBrevo(args);
  if (brevo.ok) return brevo;
  if (brevo.error !== "rate_limited" && brevo.error !== "not_configured") return brevo;
  const nm = await viaNovaMail(args);
  return nm.ok || nm.error !== "not_configured" ? nm : first;
}

/**
 * Chave E remetente. Só a chave não basta: com `RESEND_FROM_EMAIL` vazio todo
 * envio devolve `not_configured`, e uma tela que dissesse "e-mail configurado"
 * mandaria o operador esperar uma mensagem que nunca sai.
 */
export function isEmailConfigured(): boolean {
  return getClient() !== null && fromAddress() !== null;
}
