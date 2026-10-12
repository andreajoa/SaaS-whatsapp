import { createAdminClient } from "@/lib/supabase/admin";
import { cookieVale } from "@/lib/painel/sessao";
import { agregarPainel, type Fontes, type Linha, type Painel } from "@/lib/painel/metricas";
export type { Painel, LinhaContada, LeadResumido, VisitaResumida } from "@/lib/painel/metricas";
export interface Janela {
  readonly dias: number;
  readonly cookie: string | undefined;
}
const TAMANHO = 1000;
/** Hoje (24 h), semana, mês, trimestre, semestre e ano. */
export const JANELAS_DO_PAINEL: readonly number[] = [1, 7, 30, 90, 180, 365];
/** O guard se repete na fronteira de leitura: nem chamada interna pode bypassar a porta. */
export async function lerPainel({ dias, cookie }: Janela): Promise<Painel> {
  if (!cookieVale(cookie)) throw new Error("Acesso ao painel recusado.");
  const ate = new Date().toISOString();
  const desde = new Date(
    Date.now() - (JANELAS_DO_PAINEL.includes(dias) ? dias : 7) * 86400000,
  ).toISOString();
  const fontes: Fontes = {
    visitas: null,
    leads: null,
    checkouts: null,
    envios: null,
    cliques: null,
    assinaturas: null,
  };
  const limitados: string[] = [];
  let admin: ReturnType<typeof createAdminClient>;
  try {
    admin = createAdminClient();
  } catch {
    return agregarPainel(fontes, desde, ate);
  }
  const ler = async (
    nome: keyof Fontes,
    tabela: string,
    colunas: string,
    teto: number,
    janela: boolean,
  ): Promise<void> => {
    const linhas: Linha[] = [];
    try {
      for (let inicio = 0; inicio < teto; inicio += TAMANHO) {
        let consulta = admin
          .from(tabela)
          .select(colunas)
          .order("created_at", { ascending: false })
          .range(inicio, Math.min(inicio + TAMANHO - 1, teto - 1));
        if (janela) consulta = consulta.gte("created_at", desde).lte("created_at", ate);
        const { data, error } = await consulta;
        if (error || !Array.isArray(data)) return;
        linhas.push(...(data as unknown as Linha[]));
        if (data.length < TAMANHO) break;
        if (inicio + TAMANHO >= teto) limitados.push(nome);
      }
      fontes[nome] = linhas;
    } catch {
      /* Ausente difere de zero; a interface declara a fonte indisponível. */
    }
  };
  await Promise.all([
    ler(
      "visitas",
      "site_visits",
      "created_at,visitor_id,session_id,path,referrer_host,utm_source,utm_medium,utm_campaign,country,region,city,postal_code,device,segundos_na_pagina",
      50000,
      true,
    ),
    ler(
      "leads",
      "site_leads",
      "id,created_at,email,nome,empresa,origem,status,visitor_id,country,city,plano,assinou_em,user_id,organization_id,virou_usuario_em,confirmado_em,marketing_opt_in_em,marketing_opt_in_origem,descadastrado_em,ultimo_envio_em",
      5000,
      false,
    ),
    ler(
      "checkouts",
      "checkout_tentativas",
      "created_at,status,lead_id,organization_id,concluido_em",
      10000,
      true,
    ),
    ler(
      "envios",
      "email_envios",
      "created_at,lead_id,status,enviado_em,entregue_em,aberto_em,clicado_em",
      20000,
      false,
    ),
    ler("cliques", "site_clicks", "created_at,visitor_id,session_id,path,alvo", 50000, true),
  ]);
  // A leitura de billing fica limitada aos tenants que o CRM do operador já vinculou.
  const orgs = [
    ...new Set(
      (fontes.leads ?? [])
        .map((x) => x.organization_id)
        .filter((x): x is string => typeof x === "string"),
    ),
  ];
  try {
    if (fontes.leads === null) throw new Error("Contatos indisponíveis");
    const assinaturas: Linha[] = [];
    for (let inicio = 0; inicio < orgs.length; inicio += 200) {
      const { data, error } = await admin
        .from("org_subscriptions")
        .select("organization_id,plan,status,cancel_at_period_end,current_period_end,canceled_at")
        .in("organization_id", orgs.slice(inicio, inicio + 200));
      if (error || !Array.isArray(data)) throw new Error("Fonte indisponível");
      assinaturas.push(...(data as Linha[]));
    }
    fontes.assinaturas = assinaturas;
  } catch {
    /* A ausência de billing não vira assinatura ativa inventada. */
  }
  return agregarPainel(fontes, desde, ate, limitados);
}
