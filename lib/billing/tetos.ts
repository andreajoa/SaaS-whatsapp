/**
 * Os tetos que o catálogo de planos VENDE, aplicados.
 *
 * ─── O defeito ──────────────────────────────────────────────────────────────
 *
 * `lib/billing/planos.ts` declara `canais: 1, membros: 3` para o Essencial, a
 * página de vendas imprime "1 número de WhatsApp / até 3 pessoas no time" — e
 * ninguém lia esses números fora da vitrine. Quem assinava o Essencial conectava
 * quantos números quisesse e convidava quantas pessoas quisesse. Não é só
 * receita perdida: some o MOTIVO de subir de plano, e com ele a razão de o
 * catálogo ter três degraus.
 *
 * ─── O que é teto e o que NÃO é ─────────────────────────────────────────────
 *
 * Isto barra o ATO DE CRIAR, e nunca tira nada que já existe. A diferença é o
 * caso que importa: uma organização que já tem 5 canais (porque o teto não
 * existia, ou porque desceu de plano) continua com os 5 — só não ganha o sexto.
 * Desconectar o número de alguém para cobrar mais é o tipo de "aplicação de
 * regra" que faz o cliente descobrir a mudança pelo cliente DELE.
 *
 * ─── Por que o self-host não tem teto ───────────────────────────────────────
 *
 * A doutrina do produto é *"monetização = self-host em VPS, não assinatura"*.
 * Sem `STRIPE_SECRET_KEY` não há plano, e `cabeMaisUm` devolve liberado ANTES
 * de qualquer consulta — nem uma ida ao banco a mais numa instalação que não
 * vende plano nenhum. É o mesmo interruptor de `instalacaoCobra()` que já
 * desliga o gate de cobrança e a tela de billing.
 *
 * ─── O trial vale o degrau de entrada, e isso é deliberado ──────────────────
 *
 * Organização sem linha em `org_subscriptions` está em trial (ver o cabeçalho
 * da migration 0239) e recebe o teto do Essencial. A alternativa — trial sem
 * teto — cria o pior momento possível: a pessoa conecta 5 números durante a
 * avaliação, assina o plano de 1, e ou perde 4 números no dia em que decidiu
 * pagar, ou fica com 5 pagando por 1 para sempre. Com o teto de entrada valendo
 * desde o primeiro dia, o limite é descoberto ANTES do cartão, que é quando ele
 * custa menos e quando ele de fato vende o degrau de cima.
 *
 * ─── Falha ABERTA, sempre ───────────────────────────────────────────────────
 *
 * Erro de leitura — do plano ou da contagem — libera. É a mesma escolha de
 * `estadoDaCobranca()`, pelo mesmo motivo: no pior caso alguém conecta um canal
 * a mais; no outro extremo, um soluço do banco impede um cliente pagante de
 * ligar o número dele. Um teto não é um controle de segurança, e tratá-lo como
 * se fosse inverte o custo dos dois erros.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import { PROVIDERS_DE_MENSAGEM } from "@/lib/channels/capabilities";

import { ehPlanoConhecido, instalacaoCobra, PLANOS, type PlanoId } from "./planos";

/** Os dois tetos vendidos. Os nomes são os campos de `Plano`, de propósito. */
export type RecursoComTeto = "canais" | "membros";

export interface Veredito {
  permitido: boolean;
  /** `null` = sem teto (self-host, plano ilimitado, ou não deu para saber). */
  teto: number | null;
  emUso: number;
  plano: PlanoId | null;
}

const LIBERADO: Veredito = { permitido: true, teto: null, emUso: 0, plano: null };

/**
 * O plano que vale AGORA para efeito de teto.
 *
 * Ausência de linha é trial, e trial vale Essencial (ver o cabeçalho). Erro de
 * leitura e plano que este código não conhece devolvem `null` — que o chamador
 * lê como "sem teto", nunca como "teto zero".
 */
async function planoVigente(
  admin: SupabaseClient,
  organizationId: string,
): Promise<PlanoId | null> {
  try {
    const { data, error } = await admin
      .from("org_subscriptions")
      .select("plan")
      .eq("organization_id", organizationId)
      .maybeSingle();
    if (error) return null;
    if (!data) return "essencial";
    const plano = String((data as { plan?: unknown }).plan ?? "");
    return ehPlanoConhecido(plano) ? plano : null;
  } catch {
    return null;
  }
}

/**
 * Quantos canais de MENSAGEM vivos a organização tem.
 *
 * O filtro por provider não é detalhe: a linha de chamada de voz (spec 18) mora
 * na mesma tabela, e sem ele parear voz comeria a única vaga de número de quem
 * está no Essencial — um teto cobrando por um recurso que ele não vende.
 *
 * `archived_at is null` porque canal excluído foi desligado de propósito;
 * a linha só sobrevive como âncora das FKs RESTRICT.
 */
async function canaisEmUso(admin: SupabaseClient, organizationId: string): Promise<number | null> {
  try {
    const { count, error } = await admin
      .from("channel_sessions")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .in("provider", [...PROVIDERS_DE_MENSAGEM])
      .is("archived_at", null);
    return error ? null : (count ?? 0);
  } catch {
    return null;
  }
}

/**
 * Quantas vagas de time estão tomadas: membros ativos MAIS convites pendentes.
 *
 * Contar o convite pendente é o que torna o teto um teto. Se só o membro
 * contasse, um admin com 2 vagas mandaria 20 convites de uma vez — a rota
 * aceita 20 por chamada — e os 20 seriam aceitos depois, um a um, sem passar
 * por lugar nenhum que pudesse recusar: o aceite é um Server Action com token
 * assinado, emitido quando ainda havia vaga.
 *
 * Convite expirado ou revogado NÃO conta: ele não vira membro nunca mais, e
 * segurar uma vaga por causa dele é cobrar por ninguém.
 */
async function membrosEmUso(admin: SupabaseClient, organizationId: string): Promise<number | null> {
  try {
    const membros = await admin
      .from("user_organizations")
      .select("user_id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .is("revoked_at", null);
    if (membros.error) return null;

    const convites = await admin
      .from("team_invites")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .is("accepted_at", null)
      .is("revoked_at", null)
      .gt("expires_at", new Date().toISOString());
    // Convite é a metade MENOS importante da conta: uma instalação sem a
    // migration 0238 não tem a tabela, e recusar a contagem inteira por causa
    // dela trancaria o teto num "não sei" permanente. Sem a tabela, o que se
    // sabe é o número de membros — que é a parte que sempre existiu.
    const pendentes = convites.error ? 0 : (convites.count ?? 0);

    return (membros.count ?? 0) + pendentes;
  } catch {
    return null;
  }
}

/**
 * Cabe mais um `recurso` nesta organização?
 *
 * `aMais` existe para o convite em lote: a rota emite até 20 e-mails numa
 * chamada, e uma única pergunta antes do laço deixaria os 20 passarem. Quem
 * chama em laço passa quantos JÁ emitiu nesta mesma requisição, porque as
 * linhas que ele acabou de escrever ainda não valem como resposta da contagem
 * a cada volta.
 */
export async function cabeMaisUm(
  admin: SupabaseClient,
  organizationId: string,
  recurso: RecursoComTeto,
  aMais = 0,
): Promise<Veredito> {
  if (!instalacaoCobra()) return LIBERADO;

  const plano = await planoVigente(admin, organizationId);
  if (!plano) return LIBERADO;

  const teto = PLANOS[plano][recurso];
  if (teto === null) return { permitido: true, teto: null, emUso: 0, plano };

  const emUso =
    recurso === "canais"
      ? await canaisEmUso(admin, organizationId)
      : await membrosEmUso(admin, organizationId);
  if (emUso === null) return { ...LIBERADO, plano };

  const total = emUso + aMais;
  return { permitido: total < teto, teto, emUso: total, plano };
}

/**
 * A frase que quem bate no teto lê.
 *
 * Diz o número vendido e para onde ir. "Limite atingido" sozinho não diz nem
 * qual é o limite nem o que fazer a respeito — e o que fazer a respeito é
 * justamente a coisa que o produto quer que a pessoa faça.
 */
export function frasePrimeiraPessoa(recurso: RecursoComTeto, v: Veredito): string {
  const nome = v.plano ? PLANOS[v.plano].nome : "atual";
  const coisa = recurso === "canais" ? "número de WhatsApp" : "pessoa no time";
  const plural = recurso === "canais" ? "números de WhatsApp" : "pessoas no time";
  const quantos = v.teto === 1 ? `1 ${coisa}` : `${v.teto} ${plural}`;
  return (
    `O plano ${nome} inclui ${quantos}, e esta conta já usa ${v.emUso}. ` +
    `Para adicionar mais, mude de plano em Configurações › Cobrança.`
  );
}
