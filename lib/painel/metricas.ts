/** Agregação pura: o visitante anônimo só ganha identidade com vínculo persistido. */
export type Linha = Record<string, unknown>;
export interface LinhaContada {
  chave: string;
  total: number;
}
export type Segmento =
  | "inscrito"
  | "cadastrado"
  | "ativo"
  | "inadimplente"
  | "cancelado"
  | "pagou"
  | "descadastrado"
  | "bloqueado"
  | "indisponivel";
export interface LeadResumido {
  id: string;
  quando: string;
  email: string;
  nome: string | null;
  empresa: string | null;
  origem: string;
  status: string;
  segmento: Segmento;
  pais: string | null;
  cidade: string | null;
  plano: string | null;
  assinouEm: string | null;
  cadastradoEm: string | null;
  assinatura: string | null;
  assinaturaDisponivel: boolean;
  cancelaNoFim: boolean;
  consentimento: string;
  enviados: number | null;
  abertos: number | null;
  clicados: number | null;
  ultimoEnvio: string | null;
}
export interface VisitaResumida {
  quando: string;
  path: string;
  origem: string | null;
  pais: string | null;
  cidade: string | null;
  cep: string | null;
  dispositivo: string | null;
  campanha: string | null;
  segundos: number | null;
  identificado: boolean | null;
}
export interface Jornada {
  sessao: string;
  paginas: string[];
  cliques: string[] | null;
  segundos: number | null;
  identificado: boolean | null;
  quando: string;
}
export interface Painel {
  visitas: number | null;
  visitantes: number | null;
  identificados: number | null;
  leads: number | null;
  clientes: number | null;
  leadsDaCoorte: number | null;
  clientesDaCoorte: number | null;
  checkoutsAbertos: number | null;
  segundosMedios: number | null;
  duracoesMedidas: number | null;
  revisitantes: number | null;
  cliques: number | null;
  visitantesQueClicaram: number | null;
  emailsEnviados: number | null;
  emailsAbertos: number | null;
  emailsClicados: number | null;
  emailsFalhos: number | null;
  emailsEntregues: number | null;
  emailsBounce: number | null;
  emailsReclamados: number | null;
  emailsAgendados: number | null;
  porPais: LinhaContada[] | null;
  porCidade: LinhaContada[] | null;
  porOrigem: LinhaContada[] | null;
  porCampanha: LinhaContada[] | null;
  porPagina: LinhaContada[] | null;
  porClique: LinhaContada[] | null;
  porDispositivo: LinhaContada[] | null;
  serie: { dia: string; visitas: number | null; leads: number | null; clientes: number | null }[];
  ultimasVisitas: VisitaResumida[] | null;
  ultimosLeads: LeadResumido[] | null;
  jornadas: Jornada[] | null;
  semBanco: boolean;
  indisponiveis: string[];
  limitados: string[];
  desde: string;
  ate: string;
}
export interface Fontes {
  visitas: Linha[] | null;
  leads: Linha[] | null;
  checkouts: Linha[] | null;
  envios: Linha[] | null;
  cliques: Linha[] | null;
  assinaturas: Linha[] | null;
}
export function texto(valor: unknown): string | null {
  return typeof valor === "string" && valor.trim() ? valor.trim() : null;
}
function numero(valor: unknown): number | null {
  return typeof valor === "number" && Number.isFinite(valor) && valor >= 0 ? valor : null;
}
export function mediana(valores: number[]): number | null {
  if (!valores.length) return null;
  const ordenados = [...valores].sort((a, b) => a - b);
  const meio = Math.floor(ordenados.length / 2);
  return ordenados.length % 2 ? ordenados[meio]! : (ordenados[meio - 1]! + ordenados[meio]!) / 2;
}
function contar(linhas: Linha[], coluna: string, vazio = "Não informado"): LinhaContada[] {
  const mapa = new Map<string, number>();
  for (const linha of linhas) {
    const chave = texto(linha[coluna]) ?? vazio;
    mapa.set(chave, (mapa.get(chave) ?? 0) + 1);
  }
  return [...mapa]
    .map(([chave, total]) => ({ chave, total }))
    .sort((a, b) => b.total - a.total || a.chave.localeCompare(b.chave));
}
const ACEITOS = new Set([
  "enviado",
  "entregue",
  "aberto",
  "clicado",
  "bounce",
  "reclamou",
  "descadastrou",
]);
function dentro(valor: unknown, desde: string, ate: string): boolean {
  const data = texto(valor);
  if (!data) return false;
  const instante = Date.parse(data);
  return Number.isFinite(instante) && instante >= Date.parse(desde) && instante <= Date.parse(ate);
}
function diaUTC(valor: unknown): string | null {
  const instante = typeof valor === "string" ? Date.parse(valor) : NaN;
  return Number.isFinite(instante) ? new Date(instante).toISOString().slice(0, 10) : null;
}
export function agregarPainel(
  fontes: Fontes,
  desde: string,
  ate: string,
  limitados: string[] = [],
): Painel {
  const observar = <T>(requeridas: (keyof Fontes)[], valor: T): T | null =>
    requeridas.some((fonte) => fontes[fonte] === null) ? null : valor;
  const v = (fontes.visitas ?? []).filter((x) => dentro(x.created_at, desde, ate));
  const l = fontes.leads ?? [];
  const c = fontes.checkouts ?? [];
  const e = fontes.envios ?? [];
  const cl = (fontes.cliques ?? []).filter((x) => dentro(x.created_at, desde, ate));
  const assinaturaPorOrg = new Map(
    (fontes.assinaturas ?? []).map((x) => [texto(x.organization_id), x]),
  );
  const visitantes = new Map<string, number>();
  for (const x of v) {
    const id = texto(x.visitor_id);
    if (id) visitantes.set(id, (visitantes.get(id) ?? 0) + 1);
  }
  const leadsPorVisitante = new Map<string, Linha[]>();
  for (const lead of l) {
    const id = texto(lead.visitor_id);
    if (id) leadsPorVisitante.set(id, [...(leadsPorVisitante.get(id) ?? []), lead]);
  }
  // A coorte usa a primeira visita observada e só conta fatos ocorridos depois dela.
  const primeiraVisita = new Map<string, string>();
  for (const x of v) {
    const id = texto(x.visitor_id),
      quando = texto(x.created_at);
    if (
      id &&
      quando &&
      (!primeiraVisita.has(id) || Date.parse(quando) < Date.parse(primeiraVisita.get(id)!))
    )
      primeiraVisita.set(id, quando);
  }
  const coorte = [...primeiraVisita].filter(([id, quando]) =>
    (leadsPorVisitante.get(id) ?? []).some((x) => dentro(x.created_at, quando, ate)),
  );
  const pagantesCoorte = coorte.filter(([id, quando]) =>
    (leadsPorVisitante.get(id) ?? []).some((x) => dentro(x.assinou_em, quando, ate)),
  );
  const duracoes = v
    .map((x) => numero(x.segundos_na_pagina))
    .filter((x): x is number => x !== null);
  const enviosJanela = e.filter((x) => dentro(x.enviado_em ?? x.created_at, desde, ate));
  const aceitos = enviosJanela.filter((x) => ACEITOS.has(String(x.status)) || !!x.enviado_em);
  const enviosPorLead = new Map<string, Linha[]>();
  for (const envio of e) {
    const id = texto(envio.lead_id);
    if (id && (ACEITOS.has(String(envio.status)) || !!envio.enviado_em)) {
      const lista = enviosPorLead.get(id) ?? [];
      lista.push(envio);
      enviosPorLead.set(id, lista);
    }
  }
  const leadsCRM = l.map((x): LeadResumido => {
    const sub = assinaturaPorOrg.get(texto(x.organization_id));
    const statusSub = texto(sub?.status);
    const enviado = enviosPorLead.get(String(x.id)) ?? [];
    const cadastrado = texto(x.virou_usuario_em);
    const temCadastro = !!(cadastrado || texto(x.user_id) || texto(x.organization_id));
    const bloqueado = ["bounce", "reclamou"].includes(String(x.status));
    const saiu = !!x.descadastrado_em || x.status === "descadastrado";
    let segmento: Segmento = temCadastro ? "cadastrado" : "inscrito";
    if (x.assinou_em) segmento = "pagou";
    if (statusSub === "active" || statusSub === "trialing")
      segmento = statusSub === "active" ? "ativo" : "cadastrado";
    if (
      ["past_due", "unpaid", "incomplete", "incomplete_expired", "paused"].includes(statusSub ?? "")
    )
      segmento = "inadimplente";
    if (statusSub === "canceled") segmento = "cancelado";
    if (fontes.assinaturas === null && temCadastro) segmento = "indisponivel";
    // O descadastro de marketing não apaga o estágio comercial de um cliente.
    if (segmento === "inscrito") {
      if (saiu) segmento = "descadastrado";
      else if (bloqueado) segmento = "bloqueado";
    }
    return {
      id: String(x.id),
      quando: String(x.created_at),
      email: String(x.email),
      nome: texto(x.nome),
      empresa: texto(x.empresa),
      origem: String(x.origem),
      status: String(x.status),
      segmento,
      pais: texto(x.country),
      cidade: texto(x.city),
      plano: fontes.assinaturas === null ? null : (texto(sub?.plan) ?? texto(x.plano)),
      assinouEm: texto(x.assinou_em),
      cadastradoEm: cadastrado,
      assinatura: statusSub,
      assinaturaDisponivel: fontes.assinaturas !== null,
      cancelaNoFim: sub?.cancel_at_period_end === true,
      consentimento: saiu
        ? "Descadastrado"
        : bloqueado
          ? "Bloqueado"
          : x.marketing_opt_in_em
            ? "Confirmado"
            : "Não verificado",
      enviados: observar(["envios"], enviado.length),
      abertos: observar(["envios"], enviado.filter((y) => !!y.aberto_em).length),
      clicados: observar(["envios"], enviado.filter((y) => !!y.clicado_em).length),
      ultimoEnvio: texto(x.ultimo_envio_em),
    };
  });
  const serie: Painel["serie"] = [];
  // Dias do gráfico em UTC. Nenhum preenchimento de tráfego sintético.
  const inicio = new Date(desde);
  inicio.setUTCHours(0, 0, 0, 0);
  for (let dia = inicio.getTime(); dia <= new Date(ate).getTime(); dia += 86400000) {
    const chave = new Date(dia).toISOString().slice(0, 10);
    serie.push({
      dia: chave,
      visitas: observar(["visitas"], v.filter((x) => diaUTC(x.created_at) === chave).length),
      leads: observar(
        ["leads"],
        l.filter((x) => dentro(x.created_at, desde, ate) && diaUTC(x.created_at) === chave).length,
      ),
      clientes: observar(
        ["leads"],
        l.filter((x) => dentro(x.assinou_em, desde, ate) && diaUTC(x.assinou_em) === chave).length,
      ),
    });
  }
  const sessoes = new Map<string, Linha[]>();
  const sessoesPorVisitante = new Map<string, Set<string>>();
  for (const x of v) {
    const id = texto(x.session_id),
      visitante = texto(x.visitor_id);
    if (id && visitante) {
      const ids = sessoesPorVisitante.get(visitante) ?? new Set<string>();
      ids.add(id);
      sessoesPorVisitante.set(visitante, ids);
      const chave = visitante + "|" + id;
      sessoes.set(chave, [...(sessoes.get(chave) ?? []), x]);
    }
  }
  const jornadas = [...sessoes].slice(0, 30).map(([chave, linhas], i): Jornada => {
    const ordem = [...linhas].sort(
      (a, b) => Date.parse(String(a.created_at)) - Date.parse(String(b.created_at)),
    );
    const x = ordem[0]!;
    const medidas = linhas
      .map((y) => numero(y.segundos_na_pagina))
      .filter((y): y is number => y !== null);
    return {
      sessao: `Sessão ${i + 1}`,
      paginas: ordem.map((y) => String(y.path)),
      cliques: observar(
        ["cliques"],
        cl
          .filter((y) => `${y.visitor_id}|${y.session_id}` === chave)
          .sort((a, b) => Date.parse(String(a.created_at)) - Date.parse(String(b.created_at)))
          .map((y) => String(y.alvo)),
      ),
      segundos: medidas.length ? medidas.reduce((a, b) => a + b, 0) : null,
      identificado: observar(["leads"], leadsPorVisitante.has(String(x.visitor_id))),
      quando: String(x.created_at),
    };
  });
  const resultado = {
    visitas: v.length,
    visitantes: visitantes.size,
    identificados: [...visitantes.keys()].filter((id) => leadsPorVisitante.has(id)).length,
    leads: l.filter((x) => dentro(x.created_at, desde, ate)).length,
    clientes: l.filter((x) => dentro(x.assinou_em, desde, ate)).length,
    leadsDaCoorte: coorte.length,
    clientesDaCoorte: pagantesCoorte.length,
    checkoutsAbertos: c.filter((x) => x.status === "aberto").length,
    segundosMedios: mediana(duracoes),
    duracoesMedidas: duracoes.length,
    revisitantes:
      v.length && !sessoes.size
        ? null
        : [...sessoesPorVisitante.values()].filter((ids) => ids.size > 1).length,
    cliques: cl.length,
    visitantesQueClicaram: new Set(
      cl.map((x) => texto(x.visitor_id)).filter((id): id is string => !!id && visitantes.has(id)),
    ).size,
    emailsEnviados: aceitos.length,
    emailsAbertos: aceitos.filter((x) => !!x.aberto_em).length,
    emailsClicados: aceitos.filter((x) => !!x.clicado_em).length,
    emailsEntregues: aceitos.filter((x) => !!x.entregue_em).length,
    emailsFalhos: enviosJanela.filter((x) => x.status === "falhou").length,
    emailsBounce: aceitos.filter((x) => x.status === "bounce").length,
    emailsReclamados: aceitos.filter((x) => x.status === "reclamou").length,
    emailsAgendados: enviosJanela.filter((x) => x.status === "agendado").length,
    porPais: contar(v, "country"),
    porCidade: contar(v, "city"),
    porOrigem: contar(v, "referrer_host", "Direto / não informado"),
    porCampanha: contar(v, "utm_campaign"),
    porPagina: contar(v, "path"),
    porClique: contar(cl, "alvo"),
    porDispositivo: contar(v, "device"),
    serie,
    ultimasVisitas: v.slice(0, 100).map((x) => ({
      quando: String(x.created_at),
      path: String(x.path),
      origem: texto(x.referrer_host),
      pais: texto(x.country),
      cidade: texto(x.city),
      cep: texto(x.postal_code),
      dispositivo: texto(x.device),
      campanha: texto(x.utm_campaign),
      segundos: numero(x.segundos_na_pagina),
      identificado: observar(["leads"], leadsPorVisitante.has(String(x.visitor_id))),
    })),
    ultimosLeads: leadsCRM,
    jornadas,
    semBanco: Object.values(fontes).every((x) => x === null),
    indisponiveis: Object.entries(fontes)
      .filter(([, valor]) => valor === null)
      .map(([nome]) => nome),
    limitados,
    desde,
    ate,
  };
  return {
    ...resultado,
    visitas: observar(["visitas"], resultado.visitas),
    visitantes: observar(["visitas"], resultado.visitantes),
    duracoesMedidas: observar(["visitas"], resultado.duracoesMedidas),
    revisitantes: observar(["visitas"], resultado.revisitantes),
    porPais: observar(["visitas"], resultado.porPais),
    porCidade: observar(["visitas"], resultado.porCidade),
    porOrigem: observar(["visitas"], resultado.porOrigem),
    porCampanha: observar(["visitas"], resultado.porCampanha),
    porPagina: observar(["visitas"], resultado.porPagina),
    porDispositivo: observar(["visitas"], resultado.porDispositivo),
    ultimasVisitas: observar(["visitas"], resultado.ultimasVisitas),
    jornadas: observar(["visitas"], resultado.jornadas),
    leads: observar(["leads"], resultado.leads),
    clientes: observar(["leads"], resultado.clientes),
    ultimosLeads: observar(["leads"], resultado.ultimosLeads),
    cliques: observar(["cliques"], resultado.cliques),
    porClique: observar(["cliques"], resultado.porClique),
    checkoutsAbertos: observar(["checkouts"], resultado.checkoutsAbertos),
    emailsEnviados: observar(["envios"], resultado.emailsEnviados),
    emailsAbertos: observar(["envios"], resultado.emailsAbertos),
    emailsClicados: observar(["envios"], resultado.emailsClicados),
    emailsEntregues: observar(["envios"], resultado.emailsEntregues),
    emailsFalhos: observar(["envios"], resultado.emailsFalhos),
    emailsBounce: observar(["envios"], resultado.emailsBounce),
    emailsReclamados: observar(["envios"], resultado.emailsReclamados),
    emailsAgendados: observar(["envios"], resultado.emailsAgendados),
    identificados: observar(["visitas", "leads"], resultado.identificados),
    leadsDaCoorte: observar(["visitas", "leads"], resultado.leadsDaCoorte),
    clientesDaCoorte: observar(["visitas", "leads"], resultado.clientesDaCoorte),
    visitantesQueClicaram: observar(["visitas", "cliques"], resultado.visitantesQueClicaram),
  };
}
