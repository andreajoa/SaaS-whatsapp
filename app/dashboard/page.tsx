import type { Metadata } from "next";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";

import { PortaDoPainel } from "@/components/painel/PortaDoPainel";
import { COOKIE_DO_PAINEL, cookieVale, painelHabilitado } from "@/lib/painel/sessao";
import { lerPainel, type LinhaContada, type Painel } from "@/lib/painel/funil";

/**
 * O PAINEL DO FUNIL — quem chegou, de onde, e o que virou.
 *
 * ─── Por que esta tela não está em `app/app/` ──────────────────────────────
 *
 * Tudo sob `app/app/` pressupõe sessão do produto e organização resolvida, e
 * o que se lê aqui não pertence a organização nenhuma: é o livro-razão do
 * operador sobre TODOS os visitantes. A porta é `lib/painel/sessao.ts`, e o
 * raciocínio inteiro de por que ela é separada está no cabeçalho de lá.
 *
 * Fora de `app/app/` ela também fica fora da varredura de
 * `tests/unit/navegacao-completude.test.ts`, que só olha para lá — o que é
 * correto e não é escape: esta tela NÃO deve ter porta no menu do produto.
 * Um item "Funil" na navegação de um cliente seria um link para uma senha que
 * não é dele.
 *
 * ─── Fail-closed em três degraus ───────────────────────────────────────────
 *
 *  1. Sem `PAINEL_SENHA` → `notFound()`. Não existe, nem como tela de senha.
 *  2. Com painel e sem cookie válido → só o formulário. Nenhuma consulta ao
 *     banco acontece antes disso: `lerPainel()` está DEPOIS do `return`, e
 *     não antes com um `if` na renderização. A ordem é a proteção.
 *  3. Com cookie válido → os dados.
 *
 * ─── `noindex`, e por que não basta o `robots.txt` ─────────────────────────
 *
 * O caminho é público no proxy (é o que permite a porta própria), então ele é
 * rastreável. `robots.txt` pede; a meta `noindex` é o que de fato tira a
 * página do índice se alguma coisa já a apontou.
 */

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Funil",
  robots: { index: false, follow: false },
};

const JANELAS = [1, 7, 30] as const;

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  if (!painelHabilitado()) notFound();

  const jar = await cookies();
  if (!cookieVale(jar.get(COOKIE_DO_PAINEL)?.value)) {
    return <PortaDoPainel />;
  }

  const params = await searchParams;
  const pedido = Number(Array.isArray(params.dias) ? params.dias[0] : params.dias);
  const dias = (JANELAS as readonly number[]).includes(pedido) ? pedido : 7;

  const painel = await lerPainel({ dias });

  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-10">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Funil</h1>
          <p className="mt-1 text-sm text-text-muted">
            Quem chegou ao site, de onde veio e o que virou.
          </p>
        </div>
        <nav className="flex items-center gap-1 rounded-lg border border-border p-1 text-sm">
          {JANELAS.map((j) => (
            <a
              key={j}
              href={`/dashboard?dias=${j}`}
              className={
                j === dias
                  ? "rounded-md bg-text px-3 py-1.5 font-medium text-bg"
                  : "rounded-md px-3 py-1.5 text-text-muted transition-colors hover:text-text"
              }
            >
              {j === 1 ? "24 h" : `${j} dias`}
            </a>
          ))}
        </nav>
      </header>

      {painel.semBanco ? (
        <p className="rounded-lg border border-border bg-surface p-6 text-sm text-text-muted">
          Não foi possível ler o funil. Falta a chave de serviço do banco, ou este banco ainda não
          recebeu a migration <code>0240</code>.
        </p>
      ) : (
        <>
          <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Numero titulo="Visitas" valor={painel.visitas} />
            <Numero titulo="Pessoas" valor={painel.visitantes} nota="visitantes distintos" />
            <Numero titulo="Leads" valor={painel.leads} nota="todos os tempos" />
            <Numero titulo="Clientes" valor={painel.clientes} nota="assinaram" />
            <Numero titulo="Checkouts abertos" valor={painel.checkoutsAbertos} />
            <Numero titulo="E-mails enviados" valor={painel.emailsEnviados} />
            <Numero titulo="E-mails abertos" valor={painel.emailsAbertos} />
            <Numero
              titulo="Conversão"
              valor={
                painel.visitantes > 0 ? Math.round((painel.leads / painel.visitantes) * 100) : 0
              }
              sufixo="%"
              nota="lead por pessoa"
            />
          </section>

          <section className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <Ranking titulo="Países" linhas={painel.porPais} />
            <Ranking titulo="Cidades" linhas={painel.porCidade} />
            <Ranking titulo="De onde vieram" linhas={painel.porOrigem} vazio="Tráfego direto" />
            <Ranking titulo="Campanhas" linhas={painel.porCampanha} vazio="Nenhuma campanha" />
            <Ranking titulo="Páginas" linhas={painel.porPagina} />
          </section>

          <UltimasVisitas painel={painel} />
          <UltimosLeads painel={painel} />
        </>
      )}
    </main>
  );
}

function Numero({
  titulo,
  valor,
  sufixo,
  nota,
}: {
  readonly titulo: string;
  readonly valor: number;
  readonly sufixo?: string;
  readonly nota?: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <p className="text-xs font-medium tracking-wide text-text-muted uppercase">{titulo}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">
        {valor.toLocaleString("pt-BR")}
        {sufixo ?? ""}
      </p>
      {nota ? <p className="mt-0.5 text-xs text-text-muted">{nota}</p> : null}
    </div>
  );
}

function Ranking({
  titulo,
  linhas,
  vazio = "Nada ainda",
}: {
  readonly titulo: string;
  readonly linhas: readonly LinhaContada[];
  readonly vazio?: string;
}) {
  const maior = linhas[0]?.total ?? 1;
  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <p className="mb-3 text-xs font-medium tracking-wide text-text-muted uppercase">{titulo}</p>
      {linhas.length === 0 ? (
        <p className="text-sm text-text-muted">{vazio}</p>
      ) : (
        <ul className="space-y-1.5">
          {linhas.map((l) => (
            <li key={l.chave} className="relative flex items-center justify-between gap-3 text-sm">
              <span
                aria-hidden
                className="absolute inset-y-0 left-0 rounded-md bg-text/5"
                style={{ width: `${Math.round((l.total / maior) * 100)}%` }}
              />
              <span className="relative truncate px-1">{l.chave}</span>
              <span className="relative px-1 text-text-muted tabular-nums">{l.total}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function UltimasVisitas({ painel }: { readonly painel: Painel }) {
  if (painel.ultimasVisitas.length === 0) return null;
  return (
    <section className="mt-8">
      <h2 className="mb-3 text-sm font-medium tracking-wide text-text-muted uppercase">
        Últimas visitas
      </h2>
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-left text-sm">
          <thead className="bg-surface text-xs tracking-wide text-text-muted uppercase">
            <tr>
              <Th>Quando</Th>
              <Th>Página</Th>
              <Th>Origem</Th>
              <Th>País</Th>
              <Th>Cidade</Th>
              {/* CEP, e não "bairro": a borda não entrega bairro, e um rótulo
                  que promete precisão que o dado não tem faz decidir sobre ruído. */}
              <Th>CEP</Th>
              <Th>Aparelho</Th>
            </tr>
          </thead>
          <tbody>
            {painel.ultimasVisitas.map((v, i) => (
              <tr key={`${v.quando}-${i}`} className="border-t border-border/60">
                <Td>{quando(v.quando)}</Td>
                <Td>{v.path}</Td>
                <Td>{v.origem ?? "direto"}</Td>
                <Td>{v.pais ?? "—"}</Td>
                <Td>{v.cidade ?? "—"}</Td>
                <Td>{v.cep ?? "—"}</Td>
                <Td>{v.dispositivo ?? "—"}</Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function UltimosLeads({ painel }: { readonly painel: Painel }) {
  if (painel.ultimosLeads.length === 0) return null;
  return (
    <section className="mt-8">
      <h2 className="mb-3 text-sm font-medium tracking-wide text-text-muted uppercase">
        Leads e clientes
      </h2>
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-left text-sm">
          <thead className="bg-surface text-xs tracking-wide text-text-muted uppercase">
            <tr>
              <Th>Quando</Th>
              <Th>E-mail</Th>
              <Th>Origem</Th>
              <Th>Situação</Th>
              <Th>Onde</Th>
              <Th>E-mails</Th>
              <Th>Plano</Th>
            </tr>
          </thead>
          <tbody>
            {painel.ultimosLeads.map((l) => (
              <tr key={l.email} className="border-t border-border/60">
                <Td>{quando(l.quando)}</Td>
                <Td>
                  <span className="font-medium">{l.email}</span>
                  {l.nome ? <span className="text-text-muted"> · {l.nome}</span> : null}
                </Td>
                <Td>{l.origem}</Td>
                <Td>{l.status}</Td>
                <Td>{[l.cidade, l.pais].filter(Boolean).join(", ") || "—"}</Td>
                <Td>{l.enviados > 0 ? `${l.abertos}/${l.enviados} abertos` : "—"}</Td>
                <Td>{l.plano ?? (l.assinouEm ? "assinante" : "—")}</Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Th({ children }: { readonly children: React.ReactNode }) {
  return <th className="px-3 py-2 font-medium whitespace-nowrap">{children}</th>;
}

function Td({ children }: { readonly children: React.ReactNode }) {
  return <td className="px-3 py-2 whitespace-nowrap">{children}</td>;
}

/**
 * A data no fuso de quem opera, não em UTC.
 *
 * O banco guarda `timestamptz` e o servidor da borda roda em UTC. Imprimir o
 * valor cru mostraria "03:00" para uma visita da meia-noite, e quem lê o
 * painel decide sobre horário de anúncio olhando exatamente essa coluna.
 */
function quando(iso: string): string {
  try {
    return new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "America/Sao_Paulo",
    }).format(new Date(iso));
  } catch {
    return iso.slice(0, 16).replace("T", " ");
  }
}
