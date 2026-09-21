/**
 * POST /api/v1/site/descadastrar?t=<token> — a saída da lista.
 *
 * ─── Três clientes diferentes, uma rota ───────────────────────────────────
 *
 *  1. **O Gmail**, pelo botão nativo de "Cancelar inscrição" (RFC 8058). Ele
 *     manda um POST com corpo `List-Unsubscribe=One-Click` e espera 2xx. Não
 *     lê nada da resposta.
 *  2. **O formulário da página** `/descadastrar/<token>`, que é HTML puro, sem
 *     JavaScript nenhum. Ele espera ser levado de volta a uma tela legível.
 *  3. **Qualquer chamada programática**, que espera o envelope JSON do resto
 *     da `/api/v1/`.
 *
 * O desempate é o `Accept`: quem pede HTML é levado de volta à página; os
 * outros dois recebem JSON. É o mesmo ato, contado na língua de quem pergunta.
 *
 * ─── Por que não há GET aqui ──────────────────────────────────────────────
 *
 * Porque antivírus de provedor, pré-visualização de link e robô de segurança
 * corporativa seguem todo GET que encontram num e-mail. Uma baixa em GET
 * esvaziaria a lista sozinha. O raciocínio inteiro está em
 * `lib/marketing/descadastro.ts`.
 *
 * ─── Por que não há limite por IP ─────────────────────────────────────────
 *
 * Deliberado, e é o contrário do resto das rotas públicas. O que um limite
 * barraria aqui é alguém tentando adivinhar tokens — e o token é aleatório com
 * 32 hex, o que torna a adivinhação inviável muito antes de o limite importar.
 * O que um limite QUEBRARIA é o caso normal: o Gmail dispara o one-click do
 * datacenter dele, e muitas pessoas saindo no mesmo dia chegam pelo mesmo
 * punhado de IPs. Barrar isso é transformar quem queria sair em quem clica em
 * spam — exatamente o dano que esta rota existe para evitar.
 */
import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";

import { fail, ok } from "@/lib/api/wrappers";
import { descadastrarPorToken, urlDeDescadastro } from "@/lib/marketing/descadastro";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest): Promise<Response> {
  const requestId = randomUUID();
  const token = req.nextUrl.searchParams.get("t")?.trim() ?? "";
  const querHtml = (req.headers.get("accept") ?? "").includes("text/html");

  const resultado = await descadastrarPorToken(token);

  if (resultado.tipo === "sem_banco") {
    // Nunca dizer "pronto" a quem não saiu: a pessoa fecharia a aba confiante
    // e o próximo e-mail chegaria mesmo assim — e aí ela clica em spam.
    if (querHtml) return paraAPagina(token, "erro");
    return fail("service_unavailable", "Não foi possível concluir agora.", 503, { requestId });
  }

  if (resultado.tipo === "nao_encontrado") {
    if (querHtml) return paraAPagina(token, "invalido");
    return fail("not_found", "Link inválido ou expirado.", 404, { requestId });
  }

  if (querHtml) return paraAPagina(token, "fora");
  return ok({ descadastrado: true }, { requestId });
}

/**
 * 303 e não 302: depois de um POST, o 303 obriga o navegador a voltar com GET.
 * Com 302 o "atualizar" da pessoa reenviaria o POST, e o navegador perguntaria
 * se ela quer reenviar o formulário — um susto no fim de um ato que já era
 * desconfortável.
 */
function paraAPagina(token: string, estado: "fora" | "invalido" | "erro"): Response {
  const url = `${urlDeDescadastro(token)}?estado=${estado}`;
  return new Response(null, { status: 303, headers: { Location: url } });
}
