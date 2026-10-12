"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Activity,
  ArrowDownToLine,
  ArrowUpRight,
  ChartNoAxesCombined,
  ChevronRight,
  CircleCheck,
  Clock3,
  Eye,
  Fingerprint,
  Globe2,
  LogOut,
  Mail,
  MousePointer2,
  PlayCircle,
  Search,
  ShieldCheck,
  Users,
} from "lucide-react";
import { LogotipoDoProduto, SimboloDaMarca } from "@/components/branding/MarcaDoProduto";
import { marcaEhADoProduto } from "@/lib/branding";
import { tagDeIdioma } from "@/lib/i18n/datas";
import type { LeadResumido, LinhaContada, Painel, Segmento } from "@/lib/painel/metricas";
import styles from "./painel.module.css";
const NUMERO = new Intl.NumberFormat("pt-BR");
// O painel do dono é só em português; a tag sai da camada de data, não fixa aqui.
const DATA = new Intl.DateTimeFormat(tagDeIdioma("pt-BR"), {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "America/Sao_Paulo",
});
const ROTULOS: Record<Segmento, string> = {
  inscrito: "Lead do site",
  cadastrado: "Cadastro sem assinatura",
  ativo: "Assinatura ativa",
  inadimplente: "Pagamento pendente",
  cancelado: "Assinatura cancelada",
  pagou: "Já assinou · status indisponível",
  descadastrado: "Descadastrado",
  bloqueado: "Bloqueado",
  indisponivel: "Assinatura indisponível",
};
const NOMES_DE_PAIS = new Intl.DisplayNames(["pt-BR"], { type: "region" });
/** "MX" → "México (MX)"; o que não for código de país volta como veio. */
function nomeDoPais(codigo: string) {
  if (!/^[A-Z]{2}$/.test(codigo)) return codigo;
  try {
    return `${NOMES_DE_PAIS.of(codigo) ?? codigo} (${codigo})`;
  } catch {
    return codigo;
  }
}
function formatarData(valor: string | null) {
  if (!valor || !Number.isFinite(new Date(valor).getTime())) return "Não registrado";
  return DATA.format(new Date(valor));
}
function contagem(n: number | null) {
  return n === null ? "Indisponível" : NUMERO.format(n);
}
function taxa(n: number | null, d: number | null) {
  if (n === null || d === null) return "Indisponível";
  return d ? `${((100 * n) / d).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%` : "—";
}
function duracao(n: number | null) {
  if (n === null) return "Não medido";
  return n < 60 ? `${Math.round(n)} s` : `${Math.floor(n / 60)} min ${Math.round(n % 60)} s`;
}
function celulaCSV(valor: string | number) {
  const texto = String(valor);
  return `"${(/^[\s]*[=+@-]/.test(texto) ? "\u0027" : "") + texto.replaceAll('"', '""')}"`;
}
function exportar(leads: LeadResumido[]) {
  const linhas = [
    [
      "Nome",
      "Email",
      "Empresa",
      "Etapa",
      "Status da assinatura",
      "Consentimento",
      "Plano",
      "Cadastro",
      "Primeira assinatura",
      "Origem",
    ],
    ...leads.map((l) => [
      l.nome ?? "",
      l.email,
      l.empresa ?? "",
      ROTULOS[l.segmento],
      l.assinatura ?? "",
      l.consentimento,
      l.plano ?? "",
      l.cadastradoEm ?? "",
      l.assinouEm ?? "",
      l.origem,
    ]),
  ];
  const blob = new Blob(["\uFEFF" + linhas.map((l) => l.map(celulaCSV).join(";")).join("\r\n")], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "crm-proprietario.csv";
  a.click();
  URL.revokeObjectURL(url);
}
function Card({
  titulo,
  valor,
  nota,
  icone: Icon,
}: {
  titulo: string;
  valor: string;
  nota: string;
  icone: typeof Eye;
}) {
  return (
    <article className={styles.kpi}>
      <div className={styles.kpiLabel}>
        {titulo}
        <Icon size={17} aria-hidden />
      </div>
      <div className={styles.kpiValue}>{valor}</div>
      <p>{nota}</p>
    </article>
  );
}
function Lista({
  titulo,
  linhas,
  base,
}: {
  titulo: string;
  linhas: LinhaContada[] | null;
  base: number | null;
}) {
  return (
    <section className={styles.card}>
      <div className={styles.cardHead}>
        <h2>{titulo}</h2>
        <span>Visitas · {contagem(base)}</span>
      </div>
      {linhas === null ? (
        <p className={styles.empty}>Dados indisponíveis para este detalhamento.</p>
      ) : !linhas.length ? (
        <p className={styles.empty}>Nenhum registro no período.</p>
      ) : (
        <div className={styles.ranking}>
          {linhas.slice(0, 8).map((l) => (
            <div key={l.chave}>
              <div className={styles.rankLabel}>
                <span title={l.chave}>{l.chave}</span>
                <strong>
                  {NUMERO.format(l.total)} <small>{taxa(l.total, base)}</small>
                </strong>
              </div>
              <div className={styles.bar}>
                <span style={{ width: taxa(l.total, base) }} />
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
function Grafico({ serie, indisponiveis }: { serie: Painel["serie"]; indisponiveis: string[] }) {
  const [metrica, setMetrica] = useState<"visitas" | "plays" | "leads" | "clientes">("visitas");
  const fonteIndisponivel = indisponiveis.includes(
    metrica === "visitas" ? "visitas" : metrica === "plays" ? "cliques" : "leads",
  );
  const teto = Math.max(1, ...serie.map((x) => x[metrica] ?? 0));
  const pontos = serie.map((x, i) => ({
    x: 36 + (i * 720) / Math.max(1, serie.length - 1),
    y: 190 - ((x[metrica] ?? 0) / teto) * 150,
    dado: x,
  }));
  const path = pontos.map((p, i) => `${i ? "L" : "M"}${p.x},${p.y}`).join(" ");
  return (
    <section className={styles.card}>
      <div className={styles.cardHead}>
        <div>
          <h2>Movimento do site</h2>
          <span>Eventos por dia · UTC</span>
        </div>
        <div className={styles.switcher}>
          {(["visitas", "plays", "leads", "clientes"] as const).map((m) => (
            <button
              type="button"
              key={m}
              aria-pressed={m === metrica}
              onClick={() => setMetrica(m)}
            >
              {m === "clientes"
                ? "Novas assinaturas"
                : m === "leads"
                  ? "Leads"
                  : m === "plays"
                    ? "Plays do vídeo"
                    : "Visitas"}
            </button>
          ))}
        </div>
      </div>
      {fonteIndisponivel ? (
        <p className={styles.empty}>A fonte deste gráfico está indisponível.</p>
      ) : (
        <div className={styles.chart}>
          <svg
            viewBox="0 0 790 230"
            role="img"
            aria-label={`${metrica} por dia. ${serie.reduce((n, x) => n + (x[metrica] ?? 0), 0)} registros no período.`}
          >
            {[0, 0.5, 1].map((fracao) => (
              <g key={fracao}>
                <line
                  x1="36"
                  x2="756"
                  y1={190 - fracao * 150}
                  y2={190 - fracao * 150}
                  stroke="currentColor"
                  opacity=".13"
                />
                <text x="5" y={194 - fracao * 150} fontSize="11" fill="currentColor">
                  {Math.round(teto * fracao)}
                </text>
              </g>
            ))}
            <path d={`${path} L756,190 L36,190 Z`} fill="var(--color-accent)" opacity=".08" />
            <path d={path} stroke="var(--color-accent)" strokeWidth="2.5" fill="none" />
            {pontos.map((p) => (
              <circle key={p.dado.dia} cx={p.x} cy={p.y} r="3" fill="var(--color-accent)">
                <title>{`${p.dado.dia}: ${p.dado[metrica]} ${metrica}`}</title>
              </circle>
            ))}
            {[0, Math.floor((serie.length - 1) / 2), serie.length - 1].map((i, j) => (
              <text
                key={j}
                x={pontos[i]?.x ?? 36}
                y="218"
                textAnchor={j === 0 ? "start" : j === 2 ? "end" : "middle"}
                fill="currentColor"
                fontSize="11"
              >
                {serie[i]?.dia.slice(5).split("-").reverse().join("/")}
              </text>
            ))}
          </svg>
        </div>
      )}
      {!fonteIndisponivel ? (
        <details className={styles.chartData}>
          <summary>Ver os valores do gráfico</summary>
          <div className={styles.tableWrap}>
            <table>
              <thead>
                <tr>
                  <th>Dia UTC</th>
                  <th>Visitas</th>
                  <th>Leads</th>
                  <th>Novas assinaturas</th>
                </tr>
              </thead>
              <tbody>
                {serie.map((d) => (
                  <tr key={d.dia}>
                    <td>{d.dia}</td>
                    <td>{contagem(d.visitas)}</td>
                    <td>{contagem(d.leads)}</td>
                    <td>{contagem(d.clientes)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      ) : null}
    </section>
  );
}
export function PainelDoDono({
  painel: p,
  dias,
  nome,
  sair,
}: {
  painel: Painel;
  dias: number;
  nome: string;
  sair: () => Promise<void>;
}) {
  const [aba, setAba] = useState<"visao" | "crm" | "jornadas" | "email">("visao");
  const [busca, setBusca] = useState("");
  const [segmento, setSegmento] = useState("todos");
  const [ordem, setOrdem] = useState<"recente" | "nome" | "engajamento">("recente");
  const [consentimento, setConsentimento] = useState("todos");
  const [periodoCRM, setPeriodoCRM] = useState("todos");
  const [selecionado, setSelecionado] = useState<LeadResumido | null>(null);
  const filtrados = useMemo(
    () =>
      (p.ultimosLeads ?? [])
        .filter(
          (l) =>
            (segmento === "todos" || l.segmento === segmento) &&
            (consentimento === "todos" || l.consentimento === consentimento) &&
            (periodoCRM === "todos" || Date.parse(l.quando) >= Date.parse(p.desde)) &&
            `${l.nome ?? ""} ${l.email} ${l.empresa ?? ""} ${l.cidade ?? ""}`
              .toLocaleLowerCase("pt-BR")
              .includes(busca.toLocaleLowerCase("pt-BR")),
        )
        .sort((a, b) =>
          ordem === "nome"
            ? (a.nome ?? a.email).localeCompare(b.nome ?? b.email)
            : ordem === "engajamento"
              ? (b.clicados ?? 0) * 3 +
                (b.abertos ?? 0) -
                ((a.clicados ?? 0) * 3 + (a.abertos ?? 0))
              : Date.parse(b.quando) - Date.parse(a.quando),
        ),
    [p.ultimosLeads, p.desde, busca, segmento, consentimento, periodoCRM, ordem],
  );
  const nav = [
    { id: "visao" as const, label: "Visão geral", Icon: ChartNoAxesCombined },
    { id: "crm" as const, label: "CRM de clientes", Icon: Users },
    { id: "jornadas" as const, label: "Visitas e jornadas", Icon: Fingerprint },
    { id: "email" as const, label: "Saúde dos e-mails", Icon: Mail },
  ];
  const disponivel = !p.semBanco && !p.indisponiveis.includes("visitas");
  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        <Link href="/dashboard" className={styles.brand}>
          {marcaEhADoProduto({ name: nome, logoUrl: null }) ? (
            <LogotipoDoProduto nome={nome} className="h-7 w-auto" />
          ) : (
            <span className="flex items-center gap-2 text-xl font-semibold tracking-tight">
              <SimboloDaMarca nome={nome} className="h-7 w-7" decorativo />
              <span>{nome}</span>
            </span>
          )}
        </Link>
        <div className={styles.owner}>
          <ShieldCheck size={16} /> Proprietário <span>Privado</span>
        </div>
        <nav aria-label="Painel do proprietário">
          {nav.map(({ id, label, Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => {
                setAba(id);
                setSelecionado(null);
              }}
              aria-current={aba === id ? "page" : undefined}
            >
              <Icon size={18} />
              {label}
            </button>
          ))}
          <Link href="/dashboard/automacoes">
            <Activity size={18} /> Automações <ArrowUpRight size={14} />
          </Link>
        </nav>
        <div className={styles.sideBottom}>
          <p>
            Dados exclusivos do proprietário.
            <br />
            Sessão protegida por senha.
          </p>
          <form action={sair}>
            <button type="submit">
              <LogOut size={16} /> Sair do painel
            </button>
          </form>
        </div>
      </aside>
      <main className={styles.main}>
        <header className={styles.header}>
          <div>
            <div className={styles.eyebrow}>
              GESTÃO DO NEGÓCIO <ChevronRight size={12} /> {nav.find((n) => n.id === aba)?.label}
            </div>
            <h1>
              {aba === "visao"
                ? "Da primeira visita ao cliente"
                : aba === "crm"
                  ? "Uma visão de cada cliente"
                  : aba === "jornadas"
                    ? "O caminho de quem chegou"
                    : "Acompanhe cada entrega"}
            </h1>
            <p>
              {aba === "crm"
                ? "Cadastros, assinaturas e consentimento em uma única lista."
                : "Registros reais do site e da cobrança, com a régua de cada número."}
            </p>
          </div>
          <div className={styles.headerRight}>
            <span className={styles.private}>
              <ShieldCheck size={14} /> Acesso exclusivo
            </span>
            <div className={styles.period} aria-label="Período">
              {[
                [1, "Hoje"],
                [7, "7 dias"],
                [30, "30 dias"],
                [90, "90 dias"],
                [180, "6 meses"],
                [365, "1 ano"],
              ].map(([n, rotulo]) => (
                <Link
                  key={n}
                  href={`/dashboard?dias=${n}`}
                  aria-current={dias === n ? "true" : undefined}
                >
                  {rotulo}
                </Link>
              ))}
            </div>
          </div>
        </header>
        <div className={styles.freshness}>
          <span>
            <span className={styles.dot} /> Leitura em {formatarData(p.ate)} · horário de Brasília
          </span>
          <span>{dias === 1 ? "Últimas 24 horas" : `Janela móvel de ${dias} dias`}</span>
        </div>
        {p.semBanco ? (
          <div role="status" className={styles.warning}>
            Não foi possível ler os dados. Verifique a conexão e as migrations; os números abaixo
            estão indisponíveis.
          </div>
        ) : null}
        {p.indisponiveis.length && !p.semBanco ? (
          <div role="status" className={styles.warning}>
            Leitura parcial. Fontes indisponíveis: {p.indisponiveis.join(", ")}. Indicadores e
            vínculos que dependem delas podem estar incompletos.
          </div>
        ) : null}
        {p.limitados.length ? (
          <div role="status" className={styles.warning}>
            A amostra atingiu o limite de leitura em {p.limitados.join(", ")}. Totais, taxas e
            segmentos podem estar incompletos; o CSV exporta somente esta amostra.
          </div>
        ) : null}
        {aba === "visao" ? (
          <>
            <div className={styles.kpis}>
              <Card
                titulo="Visitantes únicos"
                valor={disponivel ? contagem(p.visitantes) : "—"}
                nota={`${contagem(p.visitas)} visitas · ${contagem(p.revisitantes)} retornaram em outra sessão`}
                icone={Eye}
              />
              <Card
                titulo="Conversão em lead"
                valor={
                  disponivel && !p.indisponiveis.includes("leads")
                    ? taxa(p.leadsDaCoorte, p.visitantes)
                    : "—"
                }
                nota={`${contagem(p.leadsDaCoorte)} visitantes deixaram dados após visitar`}
                icone={Users}
              />
              <Card
                titulo="Primeira assinatura"
                valor={p.indisponiveis.includes("leads") ? "—" : contagem(p.clientes)}
                nota={`${taxa(p.clientesDaCoorte, p.visitantes)} dos visitantes do período`}
                icone={CircleCheck}
              />
              <Card
                titulo="Plays do vídeo"
                valor={p.plays === null ? "—" : contagem(p.plays)}
                nota={`${contagem(p.visitantesQueDeramPlay)} visitantes · ${taxa(p.visitantesQueDeramPlay, p.visitantes)} de quem visitou`}
                icone={PlayCircle}
              />
              <Card
                titulo="Tempo visível mediano"
                valor={disponivel ? duracao(p.segundosMedios) : "—"}
                nota={`Medido em ${taxa(p.duracoesMedidas, p.visitas)} das visitas`}
                icone={Clock3}
              />
            </div>
            <Grafico serie={p.serie} indisponiveis={p.indisponiveis} />
            <div className={styles.twoColumns}>
              <section className={styles.card}>
                <div className={styles.cardHead}>
                  <h2>O funil observado</h2>
                  <span>Mesma coorte de visitantes</span>
                </div>
                <div className={styles.funnel}>
                  {[
                    ["Visitantes únicos", p.visitantes],
                    ["Deixaram dados após visitar", p.leadsDaCoorte],
                    ["Assinaram após entrar como lead", p.clientesDaCoorte],
                  ].map(([label, n]) => (
                    <div key={String(label)}>
                      <span>{label}</span>
                      <strong>{contagem(n as number | null)}</strong>
                      <small>{taxa(n as number | null, p.visitantes)}</small>
                    </div>
                  ))}
                </div>
                <p className={styles.footnote}>
                  Conversão exige visitor_id persistido e evento posterior à primeira visita da
                  janela. Cadastros sem vínculo não entram nessa taxa.{" "}
                  {p.identificados === null
                    ? "Identificação indisponível: não é possível distinguir visitantes anônimos e vinculados."
                    : `${contagem(p.identificados)} visitantes têm identidade associada; os demais são anônimos.`}
                </p>
              </section>
              <section className={styles.card}>
                <div className={styles.cardHead}>
                  <h2>Intenção e retorno</h2>
                  <MousePointer2 size={17} />
                </div>
                <div className={styles.fact}>
                  <span>Cliques registrados</span>
                  <strong>{contagem(p.cliques)}</strong>
                </div>
                <div className={styles.fact}>
                  <span>Visitantes que clicaram</span>
                  <strong>{taxa(p.visitantesQueClicaram, p.visitantes)}</strong>
                </div>
                <div className={styles.fact}>
                  <span>Retornaram em outra sessão</span>
                  <strong>{taxa(p.revisitantes, p.visitantes)}</strong>
                </div>
                <div className={styles.fact}>
                  <span>Checkouts ainda abertos na janela</span>
                  <strong>{contagem(p.checkoutsAbertos)}</strong>
                </div>
                <p className={styles.footnote}>
                  Taxas de clique e retorno usam visitantes únicos. Checkout aberto é o estado
                  informado pela cobrança.
                </p>
              </section>
            </div>
            <div className={styles.twoColumns}>
              <Lista titulo="De onde vieram" linhas={p.porOrigem} base={p.visitas} />
              <Lista titulo="Páginas visitadas" linhas={p.porPagina} base={p.visitas} />
              <Lista titulo="Campanhas" linhas={p.porCampanha} base={p.visitas} />
              <Lista titulo="Dispositivos" linhas={p.porDispositivo} base={p.visitas} />
              <Lista titulo="Países" linhas={p.porPais} base={p.visitas} />
              <Lista titulo="Estados e regiões" linhas={p.porRegiao} base={p.visitas} />
              <Lista titulo="Cidades aproximadas" linhas={p.porCidade} base={p.visitas} />
              <Lista titulo="Plays do vídeo por país" linhas={p.playsPorPais} base={p.plays} />
            </div>
            <section className={styles.card}>
              <div className={styles.cardHead}>
                <h2>Por país</h2>
                <span>Visitas, plays e leads de cada mercado na janela</span>
              </div>
              {p.geografia === null ? (
                <p className={styles.empty}>Dados de visitas indisponíveis.</p>
              ) : p.geografia.length ? (
                <div className={styles.tableWrap}>
                  <table>
                    <thead>
                      <tr>
                        <th scope="col">País</th>
                        <th scope="col">Visitas</th>
                        <th scope="col">Visitantes</th>
                        <th scope="col">Plays do vídeo</th>
                        <th scope="col">Leads</th>
                        <th scope="col">Principais regiões</th>
                        <th scope="col">Principais cidades</th>
                      </tr>
                    </thead>
                    <tbody>
                      {p.geografia.map((g) => (
                        <tr key={g.pais}>
                          <th scope="row">{nomeDoPais(g.pais)}</th>
                          <td>{g.visitas}</td>
                          <td>{g.visitantes}</td>
                          <td>{g.plays ?? "—"}</td>
                          <td>{g.leads ?? "—"}</td>
                          <td>{g.regioes.map((r) => `${r.chave} (${r.total})`).join(", ")}</td>
                          <td>{g.cidades.map((c) => `${c.chave} (${c.total})`).join(", ")}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className={styles.empty}>Nenhuma visita registrada na janela.</p>
              )}
            </section>
            <section className={styles.card}>
              <div className={styles.cardHead}>
                <h2>Onde clicaram</h2>
                <span>{contagem(p.cliques)} eventos de clique</span>
              </div>
              {p.porClique === null ? (
                <p className={styles.empty}>Dados de cliques indisponíveis.</p>
              ) : p.porClique.length ? (
                <div className={styles.clickGrid}>
                  {(p.porClique ?? []).map((c) => (
                    <div key={c.chave}>
                      <MousePointer2 size={15} />
                      <span>{c.chave}</span>
                      <strong>{c.total}</strong>
                      <small>{taxa(c.total, p.cliques)} dos cliques</small>
                    </div>
                  ))}
                </div>
              ) : (
                <p className={styles.empty}>Nenhum clique registrado na janela.</p>
              )}
            </section>
          </>
        ) : null}
        {aba === "crm" && p.ultimosLeads === null ? (
          <section className={styles.card}>
            <p className={styles.empty}>
              Dados de contatos indisponíveis. Não foi possível carregar o CRM.
            </p>
          </section>
        ) : aba === "crm" ? (
          <>
            <div className={styles.segmentStrip}>
              {(["inscrito", "cadastrado", "ativo", "inadimplente", "cancelado"] as const).map(
                (s) => (
                  <button
                    key={s}
                    aria-pressed={segmento === s}
                    onClick={() => setSegmento(segmento === s ? "todos" : s)}
                  >
                    <span>{ROTULOS[s]}</span>
                    <strong>
                      {p.indisponiveis.includes("assinaturas")
                        ? "Indisponível"
                        : (p.ultimosLeads ?? []).filter((l) => l.segmento === s).length}
                    </strong>
                  </button>
                ),
              )}
            </div>
            <section className={styles.card}>
              <div className={styles.cardHead}>
                <div>
                  <h2>Contatos do negócio</h2>
                  <span>
                    {NUMERO.format(filtrados.length)} de{" "}
                    {NUMERO.format((p.ultimosLeads ?? []).length)} contatos lidos · histórico do CRM
                  </span>
                </div>
                <button
                  className={styles.outlineButton}
                  onClick={() => exportar(filtrados)}
                  disabled={!filtrados.length}
                >
                  <ArrowDownToLine size={15} /> Exportar lista filtrada
                </button>
              </div>
              <div className={styles.filters}>
                <label className={styles.search}>
                  <Search size={16} />
                  <input
                    aria-label="Buscar contatos"
                    value={busca}
                    onChange={(e) => setBusca(e.target.value)}
                    placeholder="Buscar nome, e-mail, empresa ou cidade"
                  />
                </label>
                <select
                  aria-label="Filtrar etapa"
                  value={segmento}
                  onChange={(e) => setSegmento(e.target.value)}
                >
                  <option value="todos">Todas as etapas</option>
                  {Object.entries(ROTULOS).map(([s, r]) => (
                    <option value={s} key={s}>
                      {r}
                    </option>
                  ))}
                </select>
                <select
                  aria-label="Filtrar consentimento"
                  value={consentimento}
                  onChange={(e) => setConsentimento(e.target.value)}
                >
                  <option value="todos">Todo consentimento</option>
                  {["Confirmado", "Não verificado", "Descadastrado", "Bloqueado"].map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
                <select
                  aria-label="Período dos contatos"
                  value={periodoCRM}
                  onChange={(e) => setPeriodoCRM(e.target.value)}
                >
                  <option value="todos">Todo o histórico</option>
                  <option value="janela">Novos nos últimos {dias} dias</option>
                </select>
                <select
                  aria-label="Ordenar contatos"
                  value={ordem}
                  onChange={(e) => setOrdem(e.target.value as typeof ordem)}
                >
                  <option value="recente">Mais recentes</option>
                  <option value="nome">Nome: A–Z</option>
                  <option value="engajamento" disabled={p.indisponiveis.includes("envios")}>
                    Mais engajados
                  </option>
                </select>
              </div>
              <div className={styles.tableWrap}>
                <table>
                  <thead>
                    <tr>
                      <th>Contato</th>
                      <th>Etapa</th>
                      <th>Consentimento</th>
                      <th>Plano / assinatura</th>
                      <th>E-mails</th>
                      <th>Entrada</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtrados.slice(0, 250).map((l) => (
                      <tr key={l.id}>
                        <td>
                          <button className={styles.contact} onClick={() => setSelecionado(l)}>
                            <strong>{l.nome ?? l.email}</strong>{" "}
                            <span>{l.nome ? l.email : (l.empresa ?? l.origem)}</span>
                          </button>
                        </td>
                        <td>
                          <span
                            className={styles.badge}
                            data-tone={
                              l.segmento === "ativo"
                                ? "green"
                                : l.segmento === "inadimplente"
                                  ? "amber"
                                  : "neutral"
                            }
                          >
                            {ROTULOS[l.segmento]}
                          </span>
                        </td>
                        <td>{l.consentimento}</td>
                        <td>
                          {l.plano ?? "—"}
                          <small className={styles.cellSub}>
                            {!l.assinaturaDisponivel
                              ? "Assinatura indisponível"
                              : (l.assinatura ??
                                (l.cadastradoEm
                                  ? "Sem assinatura vinculada"
                                  : "Sem conta vinculada"))}
                            {l.cancelaNoFim ? " · cancelamento agendado" : ""}
                          </small>
                        </td>
                        <td>
                          {l.enviados === null ? "Envios indisponíveis" : `${l.enviados} enviados`}
                          <small className={styles.cellSub}>
                            {l.abertos === null || l.clicados === null
                              ? "Engajamento indisponível"
                              : `${l.abertos} abertos · ${l.clicados} clicados`}
                          </small>
                        </td>
                        <td>{formatarData(l.quando)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!filtrados.length ? (
                  <p className={styles.empty}>Nenhum contato corresponde aos filtros.</p>
                ) : null}
              </div>
              {filtrados.length > 250 ? (
                <p className={styles.footnote}>
                  Mostrando os 250 primeiros resultados. Refine a busca ou exporte todos os
                  resultados filtrados.
                </p>
              ) : null}
              <p className={styles.footnote}>
                Etapa comercial e consentimento são independentes. Assinatura ativa vem de billing;
                “já assinou” indica registro histórico de assinatura. Cadastro e checkout não
                autorizam campanhas.
              </p>
            </section>
            {selecionado ? (
              <section className={styles.card} aria-label="Detalhes do contato">
                <div className={styles.cardHead}>
                  <h2>{selecionado.nome ?? selecionado.email}</h2>
                  <button className={styles.outlineButton} onClick={() => setSelecionado(null)}>
                    Fechar detalhes
                  </button>
                </div>
                <div className={styles.detailGrid}>
                  {[
                    ["E-mail", selecionado.email],
                    ["Empresa", selecionado.empresa ?? "Não informada"],
                    ["Etapa", ROTULOS[selecionado.segmento]],
                    ["Consentimento", selecionado.consentimento],
                    ["Cadastro", formatarData(selecionado.cadastradoEm)],
                    ["Primeira assinatura", formatarData(selecionado.assinouEm)],
                    ["Último e-mail", formatarData(selecionado.ultimoEnvio)],
                    [
                      "Localização aproximada",
                      [selecionado.cidade, selecionado.pais].filter(Boolean).join(", ") ||
                        "Não informada",
                    ],
                  ].map(([k, v]) => (
                    <div key={k}>
                      <span>{k}</span>
                      <strong>{v === null ? "Indisponível" : v}</strong>
                    </div>
                  ))}
                </div>
              </section>
            ) : null}
          </>
        ) : null}
        {aba === "jornadas" ? (
          <>
            <div className={styles.kpis}>
              <Card
                titulo="Visitantes identificados"
                valor={contagem(p.identificados)}
                nota="Vínculo persistido com um lead"
                icone={Users}
              />
              <Card
                titulo="Visitantes anônimos"
                valor={
                  p.visitantes === null || p.identificados === null
                    ? "Indisponível"
                    : contagem(p.visitantes - p.identificados)
                }
                nota="Identificador do navegador, sem nome"
                icone={Fingerprint}
              />
              <Card
                titulo="Cobertura de duração"
                valor={taxa(p.duracoesMedidas, p.visitas)}
                nota={`${contagem(p.duracoesMedidas)} visitas com tempo visível`}
                icone={Clock3}
              />
              <Card
                titulo="Sessões exibidas"
                valor={p.jornadas === null ? "Indisponível" : String(p.jornadas.length)}
                nota="Até 30 sessões recentes persistidas"
                icone={Globe2}
              />
            </div>
            <section className={styles.card}>
              <div className={styles.cardHead}>
                <h2>Jornadas por sessão</h2>
                <span>Ordem de páginas e cliques registrados</span>
              </div>
              {p.jornadas === null ? (
                <p className={styles.empty}>Dados de jornadas indisponíveis.</p>
              ) : p.jornadas.length ? (
                <div className={styles.journeys}>
                  {(p.jornadas ?? []).map((j) => (
                    <article key={j.sessao}>
                      <div>
                        <strong>{j.sessao}</strong>
                        <span className={styles.badge}>
                          {j.identificado === null
                            ? "Identificação indisponível"
                            : j.identificado
                              ? "Vinculada a lead"
                              : "Anônima"}
                        </span>
                        <span>{formatarData(j.quando)}</span>
                        <small>{duracao(j.segundos)} de tempo registrado</small>
                      </div>
                      <p>
                        {j.paginas.map((pagina, i) => (
                          <span key={i}>
                            {i ? <ChevronRight size={12} /> : null}
                            <code>{pagina}</code>
                          </span>
                        ))}
                      </p>
                      <small>
                        Cliques:{" "}
                        {j.cliques === null
                          ? "Indisponíveis"
                          : j.cliques.join(" → ") || "Nenhum registrado"}
                      </small>
                    </article>
                  ))}
                </div>
              ) : (
                <p className={styles.empty}>
                  Não há sessões persistidas para reconstruir uma jornada.
                </p>
              )}
              <p className={styles.footnote}>
                A localização é uma aproximação fornecida pela borda da rede, não identifica uma
                pessoa nem seu endereço. Aba visível não significa leitura. Páginas e cliques são
                ordenados dentro de cada tipo de evento.
              </p>
            </section>
            <section className={styles.card}>
              <div className={styles.cardHead}>
                <h2>Últimas visitas</h2>
                <span>Até 100 registros</span>
              </div>
              {p.ultimasVisitas === null ? (
                <p className={styles.empty}>Histórico de visitas indisponível.</p>
              ) : (
                <div className={styles.tableWrap}>
                  <table>
                    <thead>
                      <tr>
                        <th>Quando</th>
                        <th>Página</th>
                        <th>Origem / campanha</th>
                        <th>Localização aproximada</th>
                        <th>Dispositivo</th>
                        <th>Tempo visível</th>
                        <th>Vínculo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(p.ultimasVisitas ?? []).map((v, i) => (
                        <tr key={`${v.quando}-${i}`}>
                          <td>{formatarData(v.quando)}</td>
                          <td>{v.path}</td>
                          <td>
                            {v.origem ?? "Direto / não informado"}
                            <small className={styles.cellSub}>{v.campanha ?? "Sem campanha"}</small>
                          </td>
                          <td>
                            {[v.cidade, v.pais].filter(Boolean).join(", ") || "Não informada"}
                          </td>
                          <td>{v.dispositivo ?? "Não informado"}</td>
                          <td>{duracao(v.segundos)}</td>
                          <td>
                            {v.identificado === null
                              ? "Identificação indisponível"
                              : v.identificado
                                ? "Lead associado"
                                : "Anônimo"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </>
        ) : null}
        {aba === "email" ? (
          <>
            <div className={styles.kpis}>
              <Card
                titulo="Aceitos pelo provedor"
                valor={p.indisponiveis.includes("envios") ? "—" : contagem(p.emailsEnviados)}
                nota="Envios aceitos na janela escolhida"
                icone={Mail}
              />
              <Card
                titulo="Abertura observada"
                valor={
                  p.indisponiveis.includes("envios") ? "—" : taxa(p.emailsAbertos, p.emailsEnviados)
                }
                nota={`${contagem(p.emailsAbertos)} mensagens com abertura registrada`}
                icone={Eye}
              />
              <Card
                titulo="Clique observado"
                valor={
                  p.indisponiveis.includes("envios")
                    ? "—"
                    : taxa(p.emailsClicados, p.emailsEnviados)
                }
                nota={`${contagem(p.emailsClicados)} mensagens com clique registrado`}
                icone={MousePointer2}
              />
              <Card
                titulo="Falhas de envio"
                valor={p.indisponiveis.includes("envios") ? "—" : contagem(p.emailsFalhos)}
                nota={`${contagem(p.emailsBounce)} bounces · ${contagem(p.emailsReclamados)} reclamações`}
                icone={Activity}
              />
            </div>
            <div className={styles.twoColumns}>
              <section className={styles.card}>
                <div className={styles.cardHead}>
                  <h2>Entrega e reputação</h2>
                  <ShieldCheck size={17} />
                </div>
                {[
                  ["Entrega registrada", p.emailsEntregues],
                  ["Bounces", p.emailsBounce],
                  ["Reclamações", p.emailsReclamados],
                  ["Agendados na janela", p.emailsAgendados],
                  [
                    "Contatos com consentimento confirmado",
                    p.ultimosLeads === null
                      ? null
                      : p.ultimosLeads.filter((l) => l.consentimento === "Confirmado").length,
                  ],
                  [
                    "Descadastrados ou bloqueados",
                    p.ultimosLeads === null
                      ? null
                      : p.ultimosLeads.filter((l) =>
                          ["Descadastrado", "Bloqueado"].includes(l.consentimento),
                        ).length,
                  ],
                ].map(([k, v]) => (
                  <div key={String(k)} className={styles.fact}>
                    <span>{k}</span>
                    <strong>{v === null ? "Indisponível" : v}</strong>
                  </div>
                ))}
                <p className={styles.footnote}>
                  Taxas usam mensagens aceitas na janela, uma vez por mensagem. Aberturas podem
                  incluir proteção de privacidade e não garantem leitura humana.
                </p>
              </section>
              <section className={styles.card}>
                <div className={styles.cardHead}>
                  <h2>Seu próximo contato, no momento certo</h2>
                </div>
                <p className={styles.bodyText}>
                  Use as etapas do CRM para acompanhar cadastros sem assinatura, pagamentos
                  pendentes e cancelamentos. Campanhas exigem consentimento confirmado e respeitam
                  descadastro.
                </p>
                <Link className={styles.primaryLink} href="/dashboard/automacoes">
                  Abrir automações de e-mail <ArrowUpRight size={16} />
                </Link>
                <p className={styles.footnote}>
                  As regras e o estado de ativação ficam na página de automações. Esta visão
                  acompanha o que foi registrado.
                </p>
              </section>
            </div>
            <section className={styles.card}>
              <div className={styles.cardHead}>
                <h2>Engajamento por contato</h2>
                <span>Histórico lido · até 100 contatos com envio</span>
              </div>
              {p.ultimosLeads === null || p.indisponiveis.includes("envios") ? (
                <p className={styles.empty}>
                  Engajamento por contato indisponível: faltam dados de contatos ou envios.
                </p>
              ) : (
                <div className={styles.tableWrap}>
                  <table>
                    <thead>
                      <tr>
                        <th>Contato</th>
                        <th>Consentimento</th>
                        <th>Enviados</th>
                        <th>Abertos</th>
                        <th>Clicados</th>
                        <th>Último envio</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(p.ultimosLeads ?? [])
                        .filter((l) => l.enviados !== null && l.enviados > 0)
                        .slice(0, 100)
                        .map((l) => (
                          <tr key={l.id}>
                            <td>
                              {l.nome ?? l.email}
                              <small className={styles.cellSub}>{l.nome ? l.email : ""}</small>
                            </td>
                            <td>{l.consentimento}</td>
                            <td>{l.enviados}</td>
                            <td>{l.abertos}</td>
                            <td>{l.clicados}</td>
                            <td>{formatarData(l.ultimoEnvio)}</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                  {!(p.ultimosLeads ?? []).some((l) => l.enviados) ? (
                    <p className={styles.empty}>Nenhum envio registrado para os contatos lidos.</p>
                  ) : null}
                </div>
              )}
            </section>
          </>
        ) : null}
        <footer className={styles.footer}>
          Dados pessoais aparecem somente nesta sessão do proprietário. Identificação depende de
          dados voluntariamente fornecidos; nenhum nome é inferido de uma visita.
        </footer>
      </main>
    </div>
  );
}
