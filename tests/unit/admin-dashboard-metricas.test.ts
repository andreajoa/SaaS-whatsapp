import { describe, expect, it } from "vitest";
import { agregarPainel, mediana, type Fontes, type Linha } from "@/lib/painel/metricas";
const desde = "2026-10-01T00:00:00.000Z",
  ate = "2026-10-08T00:00:00.000Z";
function dados(overrides: Partial<Fontes> = {}): Fontes {
  return {
    visitas: [],
    leads: [],
    checkouts: [],
    envios: [],
    cliques: [],
    assinaturas: [],
    ...overrides,
  };
}
const visita = (visitor_id: string, created_at = "2026-10-02T12:00:00.000Z"): Linha => ({
  visitor_id,
  created_at,
  path: "/",
  session_id: "s-" + visitor_id,
});
const lead = (id: string, extra: Linha = {}): Linha => ({
  id,
  email: id + "@example.test",
  created_at: "2026-10-02T13:00:00.000Z",
  origem: "signup",
  status: "inscrito",
  ...extra,
});
describe("painel do proprietário: régua das métricas", () => {
  it("conversão usa visitantes vinculados e fatos posteriores, sem leads antigos ou sem vínculo", () => {
    const p = agregarPainel(
      dados({
        visitas: [visita("a"), visita("a"), visita("b"), visita("c")],
        leads: [
          lead("novo", { visitor_id: "a", assinou_em: "2026-10-03T12:00:00.000Z" }),
          lead("antigo", {
            visitor_id: "b",
            created_at: "2026-09-01T00:00:00.000Z",
            assinou_em: "2026-09-05T00:00:00.000Z",
          }),
          lead("sem-vinculo", { assinou_em: "2026-10-03T12:00:00.000Z" }),
        ],
      }),
      desde,
      ate,
    );
    expect(p.visitantes).toBe(3);
    expect(p.visitas).toBe(4);
    expect(p.leadsDaCoorte).toBe(1);
    expect(p.clientesDaCoorte).toBe(1);
    expect(p.leads).toBe(2);
    expect(p.clientes).toBe(2);
    expect(p.identificados).toBe(2);
    expect(p.revisitantes).toBe(0);
  });
  it("não identifica visitante ausente nem inventa duração ausente; calcula mediana par", () => {
    const p = agregarPainel(
      dados({
        visitas: [
          { ...visita("a"), segundos_na_pagina: 10 },
          { ...visita("b"), segundos_na_pagina: 30 },
          { ...visita("c"), segundos_na_pagina: null },
        ],
      }),
      desde,
      ate,
    );
    expect(p.segundosMedios).toBe(20);
    expect(p.duracoesMedidas).toBe(2);
    expect(p.identificados).toBe(0);
    expect(mediana([])).toBeNull();
  });
  it("conta clique uma vez por visitante para taxa e separa eventos de pessoas", () => {
    const p = agregarPainel(
      dados({
        visitas: [visita("a"), visita("b")],
        cliques: [
          { ...visita("a"), alvo: "cta-hero" },
          { ...visita("a"), alvo: "cta-hero" },
          { ...visita("ausente"), alvo: "plano-pro" },
        ],
      }),
      desde,
      ate,
    );
    expect(p.cliques).toBe(3);
    expect(p.visitantesQueClicaram).toBe(1);
    expect(p.porClique?.[0]).toEqual({ chave: "cta-hero", total: 2 });
  });
  it("billing prevalece sobre pagamento histórico e consentimento exige confirmação", () => {
    const p = agregarPainel(
      dados({
        leads: [
          lead("cancelado", { organization_id: "org-c", assinou_em: "2026-09-01T00:00:00.000Z" }),
          lead("ativo", {
            organization_id: "org-a",
            marketing_opt_in_em: "2026-10-01T00:00:00.000Z",
          }),
          lead("optout", {
            organization_id: "org-a",
            marketing_opt_in_em: "2026-10-01T00:00:00.000Z",
            descadastrado_em: "2026-10-02T00:00:00.000Z",
          }),
          lead("cadastro", { user_id: "user-1", confirmado_em: "2026-10-01T00:00:00.000Z" }),
        ],
        assinaturas: [
          { organization_id: "org-c", status: "canceled", plan: "pro" },
          { organization_id: "org-a", status: "active", plan: "essencial" },
        ],
      }),
      desde,
      ate,
    );
    expect(p.ultimosLeads?.map((x) => x.segmento)).toEqual([
      "cancelado",
      "ativo",
      "ativo",
      "cadastrado",
    ]);
    expect(p.ultimosLeads?.map((x) => x.consentimento)).toEqual([
      "Não verificado",
      "Confirmado",
      "Descadastrado",
      "Não verificado",
    ]);
  });
  it("falhas e agendamentos não inflam enviados nem abertura; recorta envios pela janela", () => {
    const p = agregarPainel(
      dados({
        envios: [
          { created_at: "2026-10-02T00:00:00.000Z", status: "falhou" },
          { created_at: "2026-10-02T00:00:00.000Z", status: "agendado" },
          {
            created_at: "2026-10-02T00:00:00.000Z",
            status: "aberto",
            enviado_em: "2026-10-02T00:00:00.000Z",
            aberto_em: "2026-10-03T00:00:00.000Z",
          },
          {
            created_at: "2026-09-01T00:00:00.000Z",
            status: "aberto",
            aberto_em: "2026-10-03T00:00:00.000Z",
          },
        ],
      }),
      desde,
      ate,
    );
    expect(p.emailsEnviados).toBe(1);
    expect(p.emailsAbertos).toBe(1);
    expect(p.emailsFalhos).toBe(1);
    expect(p.emailsAgendados).toBe(1);
  });
  it("jornada não mistura session_id iguais de visitantes diferentes; conserva ordem", () => {
    const p = agregarPainel(
      dados({
        visitas: [
          { ...visita("a", "2026-10-02T14:00:00.000Z"), session_id: "igual", path: "/precos" },
          { ...visita("a"), session_id: "igual" },
          { ...visita("b"), session_id: "igual", path: "/en" },
        ],
        cliques: [{ ...visita("a"), session_id: "igual", alvo: "cta-hero" }],
      }),
      desde,
      ate,
    );
    expect(p.jornadas).toHaveLength(2);
    expect(p.jornadas?.[0]?.paginas).toEqual(["/", "/precos"]);
    expect(p.jornadas?.[0]?.cliques).toEqual(["cta-hero"]);
    expect(p.jornadas?.[1]?.cliques).toEqual([]);
  });
  it("não achata fonte ausente em sucesso e declara teto da amostra", () => {
    const p = agregarPainel(dados({ visitas: null, assinaturas: null }), desde, ate, ["leads"]);
    expect(p.semBanco).toBe(false);
    expect(p.indisponiveis).toEqual(["visitas", "assinaturas"]);
    expect(p.limitados).toEqual(["leads"]);
  });
});

describe("fontes ausentes não são movimento zero", () => {
  it.each([
    [
      "visitas",
      [
        "visitas",
        "visitantes",
        "identificados",
        "duracoesMedidas",
        "revisitantes",
        "leadsDaCoorte",
        "clientesDaCoorte",
        "visitantesQueClicaram",
        "porPais",
        "porCidade",
        "porOrigem",
        "porCampanha",
        "porPagina",
        "porDispositivo",
        "ultimasVisitas",
        "jornadas",
      ],
    ],
    [
      "leads",
      ["leads", "clientes", "identificados", "leadsDaCoorte", "clientesDaCoorte", "ultimosLeads"],
    ],
    ["cliques", ["cliques", "visitantesQueClicaram", "porClique"]],
    ["checkouts", ["checkoutsAbertos"]],
    [
      "envios",
      [
        "emailsEnviados",
        "emailsAbertos",
        "emailsClicados",
        "emailsEntregues",
        "emailsFalhos",
        "emailsBounce",
        "emailsReclamados",
        "emailsAgendados",
      ],
    ],
  ] as const)(
    "falha em %s preserva valores desconhecidos na fronteira do módulo",
    (fonte, campos) => {
      const p = agregarPainel(dados({ [fonte]: null }), desde, ate);
      for (const campo of campos) expect(p[campo]).toBeNull();
    },
  );
  it("consultas bem-sucedidas vazias conservam zeros e detalhamentos vazios", () => {
    const p = agregarPainel(dados(), desde, ate);
    expect(p.visitantes).toBe(0);
    expect(p.cliques).toBe(0);
    expect(p.checkoutsAbertos).toBe(0);
    expect(p.emailsEnviados).toBe(0);
    expect(p.ultimosLeads).toEqual([]);
    expect(p.porPais).toEqual([]);
  });
  it("falha de billing não declara cadastro sem assinatura nem presume ausência de plano", () => {
    const p = agregarPainel(
      dados({
        leads: [lead("org", { organization_id: "org-1", plano: "pro" })],
        assinaturas: null,
        envios: null,
      }),
      desde,
      ate,
    );
    expect(p.ultimosLeads?.[0]).toMatchObject({
      segmento: "indisponivel",
      assinaturaDisponivel: false,
      plano: null,
      enviados: null,
      abertos: null,
      clicados: null,
    });
  });
  it("jornada com leads e cliques indisponíveis não identifica anonimamente nem inventa ausência de cliques", () => {
    const p = agregarPainel(
      dados({ visitas: [visita("a")], leads: null, cliques: null }),
      desde,
      ate,
    );
    expect(p.jornadas?.[0]?.identificado).toBeNull();
    expect(p.jornadas?.[0]?.cliques).toBeNull();
    expect(p.ultimasVisitas?.[0]?.identificado).toBeNull();
  });
  it("retorno exige sessões distintas; navegar por páginas na mesma sessão não é retorno", () => {
    const mesma = agregarPainel(
      dados({ visitas: [visita("a"), { ...visita("a"), path: "/precos" }] }),
      desde,
      ate,
    );
    const outra = agregarPainel(
      dados({ visitas: [visita("a"), { ...visita("a"), session_id: "segunda-sessao" }] }),
      desde,
      ate,
    );
    expect(mesma.revisitantes).toBe(0);
    expect(outra.revisitantes).toBe(1);
  });
  it("dias do gráfico preservam desconhecido por série sem inventar contagem zero", () => {
    const p = agregarPainel(dados({ leads: null }), desde, ate);
    expect(p.serie.every((d) => d.leads === null && d.clientes === null && d.visitas === 0)).toBe(
      true,
    );
  });
});
