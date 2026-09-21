/**
 * POST /api/v1/site/contato — a mensagem que um ESTRANHO manda pelo site.
 *
 * ─── Por que esta rota não parece com as outras de `/api/v1` ───────────────
 *
 * Todas as demais exigem sessão e resolvem organização. Esta não tem nenhuma
 * das duas coisas por definição: quem escreve ainda não é cliente. O que
 * substitui a autenticação é o conjunto abaixo, e cada peça tapa um buraco
 * diferente:
 *
 *  - **Zod com teto de tamanho** — um corpo de 2 MB de texto num e-mail é um
 *    ataque barato contra a cota do serviço de envio, não uma mensagem.
 *  - **Limite por IP** — a mesma função que segura força bruta no login.
 *  - **Campo-armadilha** (`empresa_site`) — invisível na tela; robô preenche,
 *    gente não. Quem preenche recebe `200`: devolver erro ensina o robô a
 *    contornar, devolver sucesso o faz ir embora achando que funcionou.
 *  - **`replyTo` do visitante, nunca `from`** — pôr o endereço do visitante no
 *    remetente faria o domínio mandar e-mail se passando por terceiro, e o
 *    SPF do destinatário jogaria tudo no spam. O remetente é o domínio; a
 *    resposta vai para quem escreveu.
 *
 * ─── Sem `SUPPORT_EMAIL`, a rota não existe ────────────────────────────────
 *
 * Numa VPS de terceiro nada aqui deve acontecer em silêncio: sem endereço de
 * destino configurado a resposta é um erro explícito, e a tela nem mostra o
 * formulário. Aceitar a mensagem e não ter para onde mandá-la é a pior das
 * três opções — o visitante acha que foi atendido.
 */
import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { authRateLimited } from "@/lib/auth/rate-limit";
import { env } from "@/lib/env";
import { fail, ok } from "@/lib/api/wrappers";
import { sendEmail } from "@/lib/email/resend";
import { registrarLead } from "@/lib/marketing/lead";
import { paisDosCabecalhos } from "@/lib/mercado/visitante";

export const dynamic = "force-dynamic";

const schema = z.object({
  nome: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(200),
  assunto: z.string().trim().min(2).max(160),
  mensagem: z.string().trim().min(10).max(4000),
  /** Campo-armadilha. Tem de chegar vazio. */
  empresa_site: z.string().max(200).optional().default(""),
});

/** 5 mensagens por IP a cada 10 minutos. */
const LIMITE = { ip: 5, windowSec: 600 } as const;

function escaparHtml(texto: string): string {
  return texto
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function POST(req: NextRequest): Promise<Response> {
  const requestId = randomUUID();

  const destino = env.SUPPORT_EMAIL.trim();
  if (!destino) {
    return fail("not_configured", "Esta instalação não tem endereço de suporte configurado.", 503, {
      requestId,
    });
  }

  let corpo: unknown;
  try {
    corpo = await req.json();
  } catch {
    return fail("validation_failed", "Corpo inválido.", 422, { requestId });
  }

  const parsed = schema.safeParse(corpo);
  if (!parsed.success) {
    return fail("validation_failed", "Confira os campos do formulário.", 422, {
      requestId,
      details: parsed.error.flatten(),
    });
  }
  const dados = parsed.data;

  // Robô. Responde como se tivesse dado certo e não gasta envio nenhum.
  if (dados.empresa_site.trim() !== "") return ok({ enviado: true }, { requestId });

  if (await authRateLimited("site_contato", null, LIMITE)) {
    return fail(
      "rate_limited",
      "Muitas mensagens em pouco tempo. Tente de novo em alguns minutos.",
      429,
      {
        requestId,
        headers: { "Retry-After": String(LIMITE.windowSec) },
      },
    );
  }

  const pais = paisDosCabecalhos(req.headers) ?? "?";
  const linhas = [
    `Nome: ${dados.nome}`,
    `E-mail: ${dados.email}`,
    `País: ${pais}`,
    "",
    dados.mensagem,
  ].join("\n");

  const resultado = await sendEmail({
    to: destino,
    subject: `[site] ${dados.assunto}`,
    text: linhas,
    html: `<pre style="font:14px/1.6 ui-monospace,monospace;white-space:pre-wrap">${escaparHtml(linhas)}</pre>`,
    replyTo: dados.email,
    tags: [{ name: "origem", value: "site_contato" }],
  });

  if (!resultado.ok) {
    return fail("send_failed", "Não foi possível enviar agora. Tente de novo em instantes.", 502, {
      requestId,
      details: { motivo: resultado.error },
    });
  }

  await registrarNoFunil(dados.nome, dados.email, dados.mensagem, pais);
  return ok({ enviado: true }, { requestId });
}

/**
 * A mesma pessoa, agora no funil — e por que isto NÃO pode derrubar a resposta.
 *
 * `site_leads.origem` já previa `'contato'` (migration 0240): quem escreve pelo
 * site é exatamente o lead que o painel precisa ver. Mas o e-mail JÁ FOI — se
 * a escrita falhar, devolver erro faria o visitante mandar tudo de novo e o
 * suporte receber duas vezes. Falha aqui é perda de registro, não de mensagem.
 *
 * ─── O `upsert` que estava aqui NUNCA gravou uma linha ────────────────────
 *
 * Era um `.upsert()` com o alvo de conflito apontado para a coluna `email`
 * (e `ignoreDuplicates`), e o índice da tabela é `unique (lower(email))` —
 * FUNCIONAL. (A citação vai em prosa, e não no formato real, porque o próprio
 * invariante abaixo varre o repo por regex e leria um exemplo em comentário
 * como um uso de verdade.) O Postgres casa
 * `ON CONFLICT` por expressão, e `(email)` não é `(lower(email))`: toda
 * chamada voltava com "there is no unique or exclusion constraint matching the
 * ON CONFLICT specification". Como o retorno era ignorado e o `catch` só pega
 * throw (o supabase-js devolve o erro, não lança), a falha era total e
 * silenciosa: cada mensagem do formulário saía por e-mail e sumia do funil.
 *
 * Quem achou não foi teste de unidade nem revisão — foi
 * `tests/invariants/on-conflict-aponta-para-constraint-real.test.ts`, que
 * confere todo `onConflict` do repo contra os índices do banco de verdade.
 *
 * A troca não é por um `onConflict` certo: é por `registrarLead()`, que faz
 * busca-e-insere justamente porque um `upsert` aqui reiniciaria a sequência de
 * e-mails e ressuscitaria quem se descadastrou — o raciocínio inteiro está no
 * cabeçalho de `lib/marketing/lead.ts`.
 */
async function registrarNoFunil(
  nome: string,
  email: string,
  mensagem: string,
  pais: string,
): Promise<void> {
  await registrarLead({
    email,
    nome,
    mensagem,
    origem: "contato",
    country: pais === "?" ? null : pais,
  });
}
