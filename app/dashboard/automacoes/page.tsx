import type { Metadata } from "next";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { lerAutomacoes } from "@/lib/marketing/automacoes";
import { COOKIE_DO_PAINEL, cookieVale, painelHabilitado } from "@/lib/painel/sessao";
import { Editor } from "./Editor";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Automações de e-mail",
  robots: { index: false, follow: false },
};

export default async function AutomacoesPage() {
  if (!painelHabilitado()) notFound();
  const jar = await cookies();
  if (!cookieVale(jar.get(COOKIE_DO_PAINEL)?.value)) redirect("/dashboard");
  const { automacoes, semBanco } = await lerAutomacoes();
  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <a href="/dashboard" className="text-sm text-text-muted">
        ← Voltar ao CRM do site
      </a>
      <h1 className="mt-5 text-3xl font-semibold tracking-tight">Automações de e-mail</h1>
      <p className="mt-2 max-w-3xl text-sm text-text-muted">
        Revise o conteúdo, o público e as datas antes de ativar. Os novos modelos começam pausados.
        O preço do site continua sendo a referência; nenhuma oferta ou desconto foi criado.
      </p>
      <p className="mt-3 text-sm text-text-muted">
        Black Friday → Natal → Ano Novo. Datas inclusivas em America/Sao_Paulo. Janelas encerradas
        param os envios automaticamente; o calendário seguinte exige nova revisão.
      </p>
      {semBanco && (
        <p role="alert" className="mt-5 rounded-lg border border-border p-4 text-sm">
          O banco não disponibilizou as configurações. Os modelos podem ser vistos, mas salvar e
          ativar ficam indisponíveis. Confira a migration 0248.
        </p>
      )}
      <div className="mt-8 space-y-4">
        {automacoes.map((a) => (
          <Editor key={a.id} inicial={a} semBanco={semBanco} />
        ))}
      </div>
      <p className="mt-6 text-sm text-text-muted">
        Cadastro e compra não autorizam publicidade. Descadastro, devoluções permanentes e
        reclamações bloqueiam campanhas; os avisos de cobrança preservam sua finalidade
        transacional.
      </p>
    </main>
  );
}
