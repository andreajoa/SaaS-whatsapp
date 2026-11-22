/**
 * Gate de assinatura em tempo de execução (workers, agent-engine, MCP).
 *
 * ─── Por que existe além de `app/app/layout.tsx` ───────────────────────────
 *
 * O gate do layout só protege TELAS: uma organização que assina o trial de 7
 * dias, conecta WhatsApp e cancela (ou falha o pagamento -> `canceled`/`unpaid`)
 * perdia o acesso ao painel mas continuava com o agente de IA respondendo
 * clientes 24/7 na chave de IA da instalação e com `/api/mcp` liberado.
 *
 * ─── Regra de ouro (mesma de `estadoDaCobranca`) ───────────────────────────
 *
 *  1. Sem `STRIPE_SECRET_KEY` (`!instalacaoCobra()`) -> SEMPRE liberado (0 I/O),
 *     preservando 100% das instalações self-host.
 *  2. Falha de leitura no banco -> FAIL-OPEN (`true`): um soluço do Postgres
 *     nunca pode derrubar o atendimento de um cliente pagante.
 *  3. Só bloqueia estado EXPLÍCITO sem acesso: sem linha em `org_subscriptions`
 *     (`sem_cartao`) ou `status` fora de `trialing | active | past_due`
 *     (`canceled`, `unpaid`, `incomplete`, `incomplete_expired`, `paused`).
 *  4. Cache TTL curto em memória (60s) para evitar consulta extra por mensagem,
 *     invalidado imediatamente por `limparCacheDeAcesso(orgId)` quando o
 *     webhook do Stripe ou o retorno do checkout atualizam a assinatura.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import { estadoDaCobranca } from "./assinatura";
import { instalacaoCobra } from "./planos";

const STATUS_ATIVOS: ReadonlySet<string> = new Set(["trialing", "active", "past_due"]);
const CACHE_TTL_MS = 60_000;

interface EntradaCache {
  permitido: boolean;
  expiraEm: number;
}

const cacheDeAcesso = new Map<string, EntradaCache>();

/** Invalida o cache de uma organização (ou de todas, sem argumento). */
export function limparCacheDeAcesso(organizationId?: string): void {
  if (organizationId) {
    cacheDeAcesso.delete(organizationId);
  } else {
    cacheDeAcesso.clear();
  }
}

function lerCache(organizationId: string, agora: number): boolean | null {
  const entrada = cacheDeAcesso.get(organizationId);
  if (!entrada) return null;
  if (agora >= entrada.expiraEm) {
    cacheDeAcesso.delete(organizationId);
    return null;
  }
  return entrada.permitido;
}

function gravarCache(organizationId: string, permitido: boolean, agora: number): void {
  // Limite defensivo para processos long-running com muitos tenants.
  if (cacheDeAcesso.size >= 2_000) {
    cacheDeAcesso.clear();
  }
  cacheDeAcesso.set(organizationId, { permitido, expiraEm: agora + CACHE_TTL_MS });
}

/**
 * Versão Supabase Admin (Next.js Route Handlers, MCP, legacy dispatcher).
 */
export async function organizacaoTemAcessoAtivo(
  admin: SupabaseClient,
  organizationId: string,
  agoraMs: number = Date.now(),
): Promise<boolean> {
  if (!instalacaoCobra()) return true;

  const emCache = lerCache(organizationId, agoraMs);
  if (emCache !== null) return emCache;

  const estado = await estadoDaCobranca(admin, organizationId, null, new Date(agoraMs));
  const permitido = estado.acesso !== "sem_cartao" && estado.acesso !== "vencido";
  // Não memoriza o fallback de erro de leitura (`acesso: "em_dia"` sem plano/customer).
  if (estado.stripeCustomerId !== null || estado.plano !== null || !permitido) {
    gravarCache(organizationId, permitido, agoraMs);
  }
  return permitido;
}

export interface PgQueryable {
  query(text: string, values?: unknown[]): Promise<{ rows: Array<{ status?: unknown }> }>;
}

/**
 * Versão `pg.Pool` (worker 24/7 do `agent-engine`, sem depender de supabase-js).
 * Fail-open em erro de query ou tabela ausente (ex.: banco de teste antigo).
 */
export async function organizacaoTemAcessoAtivoPg(
  pool: PgQueryable,
  organizationId: string,
  agoraMs: number = Date.now(),
): Promise<boolean> {
  if (!instalacaoCobra()) return true;

  const emCache = lerCache(organizationId, agoraMs);
  if (emCache !== null) return emCache;

  try {
    const { rows } = await pool.query(
      `select status from org_subscriptions where organization_id = $1 limit 1`,
      [organizationId],
    );
    const status = rows[0]?.status;
    const permitido = typeof status === "string" && STATUS_ATIVOS.has(status);
    gravarCache(organizationId, permitido, agoraMs);
    return permitido;
  } catch {
    // Fail-open: nunca derruba atendimento pagante por soluço do banco.
    return true;
  }
}
