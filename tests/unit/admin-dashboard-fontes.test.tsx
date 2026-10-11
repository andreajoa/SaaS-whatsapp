import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { PainelDoDono } from "@/components/painel/PainelDoDono";
import { agregarPainel, type Fontes } from "@/lib/painel/metricas";
const desde = "2026-10-01T00:00:00.000Z",
  ate = "2026-10-08T00:00:00.000Z";
const visita = {
  created_at: "2026-10-02T12:00:00.000Z",
  visitor_id: "fixture-a",
  session_id: "fixture-s",
  path: "/",
};
function abrir(overrides: Partial<Fontes> = {}) {
  const fontes: Fontes = {
    visitas: [],
    leads: [],
    cliques: [],
    checkouts: [],
    envios: [],
    assinaturas: [],
    ...overrides,
  };
  const painel = agregarPainel(fontes, desde, ate);
  return render(
    <PainelDoDono painel={painel} dias={7} nome="Produto de teste" sair={async () => {}} />,
  );
}
function sessao(titulo: string) {
  return screen.getByRole("heading", { name: titulo }).closest("section")!;
}
function fato(rotulo: string) {
  return screen.getByText(rotulo, { exact: true }).parentElement!;
}
afterEach(cleanup);
describe("painel: estados de falha visíveis e distintos de zero", () => {
  it("uma fonte falha não apaga visitas válidas nem vira clique, checkout ou conversão zero", () => {
    abrir({ visitas: [visita], leads: null, cliques: null, checkouts: null, envios: null });
    expect(fato("Cliques registrados").querySelector("strong")).toHaveTextContent("Indisponível");
    expect(fato("Checkouts ainda abertos na janela").querySelector("strong")).toHaveTextContent(
      "Indisponível",
    );
    const funil = sessao("O funil observado");
    expect([...funil.querySelectorAll("strong")].map((n) => n.textContent)).toEqual([
      "1",
      "Indisponível",
      "Indisponível",
    ]);
    expect(
      within(sessao("Onde clicaram")).queryByText("Nenhum clique registrado na janela."),
    ).toBeNull();
    expect(
      within(sessao("Onde clicaram")).getByText("Dados de cliques indisponíveis."),
    ).toBeVisible();
  });
  it("falha de visitas mostra rankings e gráfico indisponíveis, nunca nenhuma visita", () => {
    abrir({ visitas: null });
    expect(
      within(sessao("De onde vieram")).getByText("Dados indisponíveis para este detalhamento."),
    ).toBeVisible();
    expect(within(sessao("De onde vieram")).queryByText("Nenhum registro no período.")).toBeNull();
    expect(
      within(sessao("Movimento do site")).getByText("A fonte deste gráfico está indisponível."),
    ).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Visitas e jornadas" }));
    expect(screen.getByText("Dados de jornadas indisponíveis.")).toBeVisible();
    expect(screen.getByText("Histórico de visitas indisponível.")).toBeVisible();
  });
  it("CRM indisponível não apresenta segmentos com contagem zero nem lista vazia", () => {
    abrir({ leads: null });
    fireEvent.click(screen.getByRole("button", { name: "CRM de clientes" }));
    expect(
      screen.getByText("Dados de contatos indisponíveis. Não foi possível carregar o CRM."),
    ).toBeVisible();
    expect(screen.queryByText("Nenhum contato corresponde aos filtros.")).toBeNull();
    expect(screen.queryByRole("button", { name: "Exportar lista filtrada" })).toBeNull();
  });
  it("billing e envio indisponíveis preservam contato sem presumir que não assinou ou não recebeu", () => {
    abrir({
      leads: [
        {
          id: "fixture-lead",
          email: "fixture@example.test",
          created_at: visita.created_at,
          organization_id: "fixture-org",
          origem: "signup",
          status: "inscrito",
        },
      ],
      assinaturas: null,
      envios: null,
    });
    fireEvent.click(screen.getByRole("button", { name: "CRM de clientes" }));
    const row = screen.getByRole("button", { name: "fixture@example.test signup" }).closest("tr")!;
    expect(row).toHaveTextContent("Assinatura indisponível");
    expect(row).toHaveTextContent("Envios indisponíveis");
    expect(row).not.toHaveTextContent("Cadastro sem assinatura");
    expect(row).not.toHaveTextContent("0 enviados");
  });
  it("email sem fonte não mostra zero entregas, bounces ou ausência de engajamento", () => {
    abrir({ envios: null, leads: null });
    fireEvent.click(screen.getByRole("button", { name: "Saúde dos e-mails" }));
    for (const rotulo of [
      "Entrega registrada",
      "Bounces",
      "Reclamações",
      "Agendados na janela",
      "Contatos com consentimento confirmado",
      "Descadastrados ou bloqueados",
    ])
      expect(fato(rotulo).querySelector("strong")).toHaveTextContent("Indisponível");
    expect(
      screen.getByText("Engajamento por contato indisponível: faltam dados de contatos ou envios."),
    ).toBeVisible();
    expect(screen.queryByText("Nenhum envio registrado para os contatos lidos.")).toBeNull();
  });
  it("jornada com identidade e cliques desconhecidos não apresenta anônimo nem nenhum clique", () => {
    abrir({ visitas: [visita], leads: null, cliques: null });
    fireEvent.click(screen.getByRole("button", { name: "Visitas e jornadas" }));
    expect(
      within(sessao("Jornadas por sessão")).getByText("Identificação indisponível"),
    ).toBeVisible();
    expect(within(sessao("Jornadas por sessão")).getByText("Cliques: Indisponíveis")).toBeVisible();
    expect(within(sessao("Jornadas por sessão")).queryByText("Anônima")).toBeNull();
  });
  it("consultas vazias com sucesso ainda apresentam zeros reais e estados vazios normais", () => {
    abrir();
    expect(fato("Cliques registrados").querySelector("strong")).toHaveTextContent(/^0$/);
    expect(fato("Checkouts ainda abertos na janela").querySelector("strong")).toHaveTextContent(
      /^0$/,
    );
    expect(screen.getByText("Nenhum clique registrado na janela.")).toBeVisible();
    expect(within(sessao("De onde vieram")).getByText("Nenhum registro no período.")).toBeVisible();
  });
});
