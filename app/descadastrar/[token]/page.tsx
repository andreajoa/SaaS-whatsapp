import type { Metadata } from "next";
import Link from "next/link";

import { branding } from "@/lib/branding";
import { urlDeDescadastroUmClique } from "@/lib/marketing/descadastro";
import { textoDoSite } from "@/lib/mercado/textos";
import { visitanteAtual } from "@/lib/mercado/visitante";

export const dynamic = "force-dynamic";

/**
 * A tela de saída da lista — e ela NÃO dá baixa em nada.
 *
 * ─── Por que esta página é só um botão ────────────────────────────────────
 *
 * Todo `GET` de link de e-mail é visitado por três programas que ninguém
 * convidou: o antivírus do provedor, a pré-visualização de link e o robô de
 * segurança corporativo. Se abrir a página desse baixa, eles esvaziariam a
 * lista sozinhos, antes de qualquer pessoa ler o e-mail. Então o GET MOSTRA e
 * o POST EXECUTA — e o POST é o `<form>` abaixo, sem uma linha de JavaScript,
 * para que funcione também em navegador antigo e em modo de leitura.
 *
 * ─── Por que `noindex` ────────────────────────────────────────────────────
 *
 * A URL carrega um token que é uma credencial de uso único. Indexada, ela
 * viraria resultado de busca — e um buscador seguindo o link é o caso do
 * parágrafo acima com público maior.
 */
export const metadata: Metadata = {
  title: "Descadastrar",
  robots: { index: false, follow: false },
};

export default async function DescadastrarPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ estado?: string }>;
}) {
  const { token } = await params;
  const { estado } = await searchParams;
  const { idioma } = await visitanteAtual();
  const t = (texto: string) => textoDoSite(texto, idioma);
  const marca = branding();

  // `estado` chega do 303 da rota — é o resultado do POST contado de volta em
  // voz de tela. Sem ele, ninguém apertou nada ainda.
  const concluido = estado === "fora";
  const invalido = estado === "invalido";
  const falhou = estado === "erro";

  return (
    <div className="min-h-screen bg-muted/40">
      <header className="border-b bg-background">
        <div className="mx-auto flex w-full max-w-xl items-center justify-between gap-4 px-6 py-4">
          <Link href="/" className="text-xs tracking-wider text-muted-foreground uppercase">
            {marca.name}
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-xl px-6 py-16">
        <div className="space-y-6 rounded-lg border bg-background p-8 text-sm leading-relaxed">
          {concluido ? (
            <>
              <h1 className="text-2xl font-semibold tracking-tight">{t("Pronto, você saiu.")}</h1>
              <p className="text-muted-foreground">
                {t(
                  "Seu e-mail foi removido da lista. Nenhuma mensagem nova será enviada para ele.",
                )}
              </p>
            </>
          ) : invalido ? (
            <>
              <h1 className="text-2xl font-semibold tracking-tight">
                {t("Este link não vale mais.")}
              </h1>
              <p className="text-muted-foreground">
                {t(
                  "Pode ter sido cortado pelo seu programa de e-mail. Abra o link mais recente que recebeu, ou escreva para a gente que tiramos você da lista à mão.",
                )}
              </p>
            </>
          ) : falhou ? (
            <>
              <h1 className="text-2xl font-semibold tracking-tight">
                {t("Não deu para concluir agora.")}
              </h1>
              <p className="text-muted-foreground">
                {t(
                  "Você continua na lista. Tente de novo em instantes — e se insistir em falhar, escreva para a gente.",
                )}
              </p>
              <Formulario token={token} rotulo={t("Tentar de novo")} />
            </>
          ) : (
            <>
              <h1 className="text-2xl font-semibold tracking-tight">{t("Sair da lista")}</h1>
              <p className="text-muted-foreground">
                {t(
                  "Ao confirmar, seu e-mail deixa de receber as nossas mensagens. Não é preciso entrar em conta nenhuma.",
                )}
              </p>
              <Formulario token={token} rotulo={t("Confirmar saída")} />
            </>
          )}

          <footer className="border-t pt-4 text-muted-foreground">
            <Link href="/contato" className="underline underline-offset-2">
              {t("Fale com a gente")}
            </Link>
            {" · "}
            <Link href="/legal" className="underline underline-offset-2">
              {t("Documentos")}
            </Link>
          </footer>
        </div>
      </main>
    </div>
  );
}

/**
 * `method="post"` e `action` absoluta: o formulário nativo do HTML é o que faz
 * esta tela funcionar sem JavaScript. Um botão que dependesse de `fetch` seria
 * inerte para quem lê e-mail num cliente que abre links num navegador podado —
 * e essa pessoa, sem saída, clica em spam.
 */
function Formulario({ token, rotulo }: { readonly token: string; readonly rotulo: string }) {
  return (
    <form method="post" action={urlDeDescadastroUmClique(token)}>
      <button
        type="submit"
        className="inline-flex h-10 items-center justify-center rounded-md border bg-foreground px-5 text-sm font-medium text-background"
      >
        {rotulo}
      </button>
    </form>
  );
}
