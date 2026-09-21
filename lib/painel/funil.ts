import { createAdminClient } from "@/lib/supabase/admin";

/**
 * AS CONSULTAS DO PAINEL — separadas da tela de propósito.
 *
 * ─── Por que um módulo e não consultas dentro do componente ────────────────
 *
 * Duas razões, e a segunda é a que importa. A primeira é que a tela fica
 * legível. A segunda é que estas funções usam a SERVICE ROLE, que bypassa RLS:
 * concentrá-las num arquivo só torna auditável, de uma olhada, o conjunto
 * inteiro do que o painel é capaz de ler. Espalhadas pelo JSX, uma consulta
 * nova entraria sem ninguém notar.
 *
 * ─── Por que tudo degrada para vazio em vez de lançar ──────────────────────
 *
 * Um clone sem as tabelas de 0240, ou uma instalação sem service role, faria
 * cada consulta lançar — e um throw aqui é 500 na tela inteira. O painel
 * mostrando "nenhuma visita ainda" é uma resposta; a tela de erro não é.
 */

export interface Janela {
  /** Quantos dias para trás. O painel oferece 1, 7 e 30. */
  readonly dias: number;
}

export interface LinhaContada {
  readonly chave: string;
  readonly total: number;
}

export interface VisitaResumida {
  readonly quando: string;
  readonly path: string;
  readonly origem: string | null;
  readonly pais: string | null;
  readonly cidade: string | null;
  readonly cep: string | null;
  readonly dispositivo: string | null;
  readonly campanha: string | null;
}

export interface LeadResumido {
  readonly quando: string;
  readonly email: string;
  readonly nome: string | null;
  readonly origem: string;
  readonly status: string;
  readonly pais: string | null;
  readonly cidade: string | null;
  readonly plano: string | null;
  readonly assinouEm: string | null;
  readonly enviados: number;
  readonly abertos: number;
}

export interface Painel {
  readonly visitas: number;
  readonly visitantes: number;
  readonly leads: number;
  readonly clientes: number;
  readonly checkoutsAbertos: number;
  readonly emailsEnviados: number;
  readonly emailsAbertos: number;
  readonly porPais: readonly LinhaContada[];
  readonly porCidade: readonly LinhaContada[];
  readonly porOrigem: readonly LinhaContada[];
  readonly porCampanha: readonly LinhaContada[];
  readonly porPagina: readonly LinhaContada[];
  readonly ultimasVisitas: readonly VisitaResumida[];
  readonly ultimosLeads: readonly LeadResumido[];
  /** Verdadeiro quando NENHUMA consulta respondeu — tabela ausente, service role ausente. */
  readonly semBanco: boolean;
}

const VAZIO: Painel = {
  visitas: 0,
  visitantes: 0,
  leads: 0,
  clientes: 0,
  checkoutsAbertos: 0,
  emailsEnviados: 0,
  emailsAbertos: 0,
  porPais: [],
  porCidade: [],
  porOrigem: [],
  porCampanha: [],
  porPagina: [],
  ultimasVisitas: [],
  ultimosLeads: [],
  semBanco: true,
};

/**
 * Agrupa e ordena em MEMÓRIA, não no Postgres.
 *
 * Um `group by` verdadeiro exigiria uma RPC nova — mais uma `security definer`
 * em `public`, com os dois `revoke` que a doutrina cobra, para responder a uma
 * pergunta sobre algumas milhares de linhas. A janela é curta (dias, não anos)
 * e o teto de linhas é explícito; quando o volume justificar uma view
 * materializada, ela substitui isto sem mudar a tela.
 */
function contar(
  linhas: readonly Record<string, unknown>[],
  coluna: string,
  teto = 12,
): LinhaContada[] {
  const mapa = new Map<string, number>();
  for (const linha of linhas) {
    const bruto = linha[coluna];
    const chave = typeof bruto === "string" && bruto.trim().length > 0 ? bruto.trim() : null;
    if (chave === null) continue;
    mapa.set(chave, (mapa.get(chave) ?? 0) + 1);
  }
  return [...mapa.entries()]
    .map(([chave, total]) => ({ chave, total }))
    .sort((a, b) => b.total - a.total || a.chave.localeCompare(b.chave))
    .slice(0, teto);
}

/**
 * Teto de linhas lidas por janela.
 *
 * Existe para que uma rajada — um post que viralizou, um robô que passou pelo
 * limite — não transforme a abertura do painel numa leitura de milhões de
 * linhas. Quando o teto morde, os totais ficam subestimados, e é por isso que
 * a tela mostra `≥` na contagem em vez de fingir precisão.
 */
const TETO_VISITAS = 20000;

export async function lerPainel({ dias }: Janela): Promise<Painel> {
  const desde = new Date(Date.now() - dias * 24 * 60 * 60 * 1000).toISOString();

  let admin: ReturnType<typeof createAdminClient>;
  try {
    admin = createAdminClient();
  } catch {
    return VAZIO;
  }

  const visitas = await tentar(() =>
    admin
      .from("site_visits")
      .select(
        "created_at, visitor_id, path, referrer_host, utm_campaign, country, city, postal_code, device",
      )
      .gte("created_at", desde)
      .order("created_at", { ascending: false })
      .limit(TETO_VISITAS),
  );

  const leads = await tentar(() =>
    admin
      .from("site_leads")
      .select("created_at, email, nome, origem, status, country, city, plano, assinou_em, id")
      .order("created_at", { ascending: false })
      .limit(500),
  );

  const checkouts = await tentar(() =>
    admin.from("checkout_tentativas").select("status").gte("created_at", desde).limit(5000),
  );

  const envios = await tentar(() =>
    admin.from("email_envios").select("lead_id, status, aberto_em").limit(20000),
  );

  if (visitas === null && leads === null && checkouts === null && envios === null) {
    return VAZIO;
  }

  const v = visitas ?? [];
  const l = leads ?? [];
  const c = checkouts ?? [];
  const e = envios ?? [];

  const porLead = new Map<string, { enviados: number; abertos: number }>();
  for (const envio of e) {
    const id = typeof envio.lead_id === "string" ? envio.lead_id : null;
    if (id === null) continue;
    const atual = porLead.get(id) ?? { enviados: 0, abertos: 0 };
    atual.enviados += 1;
    if (envio.aberto_em) atual.abertos += 1;
    porLead.set(id, atual);
  }

  return {
    visitas: v.length,
    visitantes: new Set(v.map((x) => String(x.visitor_id))).size,
    leads: l.length,
    clientes: l.filter((x) => x.assinou_em !== null && x.assinou_em !== undefined).length,
    checkoutsAbertos: c.filter((x) => x.status === "aberto").length,
    emailsEnviados: e.filter((x) => x.status !== "agendado").length,
    emailsAbertos: e.filter((x) => x.aberto_em !== null && x.aberto_em !== undefined).length,
    porPais: contar(v, "country"),
    porCidade: contar(v, "city"),
    porOrigem: contar(v, "referrer_host"),
    porCampanha: contar(v, "utm_campaign"),
    porPagina: contar(v, "path"),
    ultimasVisitas: v.slice(0, 50).map((x) => ({
      quando: String(x.created_at),
      path: String(x.path ?? "/"),
      origem: texto(x.referrer_host),
      pais: texto(x.country),
      cidade: texto(x.city),
      cep: texto(x.postal_code),
      dispositivo: texto(x.device),
      campanha: texto(x.utm_campaign),
    })),
    ultimosLeads: l.slice(0, 50).map((x) => {
      const contagem = porLead.get(String(x.id)) ?? { enviados: 0, abertos: 0 };
      return {
        quando: String(x.created_at),
        email: String(x.email),
        nome: texto(x.nome),
        origem: String(x.origem ?? "?"),
        status: String(x.status ?? "?"),
        pais: texto(x.country),
        cidade: texto(x.city),
        plano: texto(x.plano),
        assinouEm: texto(x.assinou_em),
        enviados: contagem.enviados,
        abertos: contagem.abertos,
      };
    }),
    semBanco: false,
  };
}

function texto(valor: unknown): string | null {
  return typeof valor === "string" && valor.trim().length > 0 ? valor.trim() : null;
}

/**
 * Roda a consulta e devolve `null` em vez de lançar.
 *
 * `null` e `[]` significam coisas diferentes e a tela usa a diferença: `[]` é
 * "não houve movimento", `null` é "não deu para perguntar". Achatar os dois em
 * `[]` faria uma instalação sem banco exibir um painel de zeros convincente.
 */
async function tentar(
  consulta: () => PromiseLike<{ data: unknown; error: unknown }>,
): Promise<Record<string, unknown>[] | null> {
  try {
    const { data, error } = await consulta();
    if (error || !Array.isArray(data)) return null;
    return data as Record<string, unknown>[];
  } catch {
    return null;
  }
}
