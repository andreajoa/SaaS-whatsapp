import type { Metadata } from "next";
import Link from "next/link";

import { FormularioDeContato } from "@/components/site/FormularioDeContato";
import { branding } from "@/lib/branding";
import { env } from "@/lib/env";
import { textoDoSite } from "@/lib/mercado/textos";
import { visitanteAtual } from "@/lib/mercado/visitante";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Contato" };

/**
 * A porta de entrada de quem ainda não é cliente.
 *
 * Sem `SUPPORT_EMAIL` configurado a página NÃO mostra formulário: um campo de
 * texto que aceita a mensagem e não tem para onde mandá-la é pior que a
 * ausência dele, porque quem escreveu vai embora achando que foi atendido.
 * Numa instalação de terceiro esse é o estado normal, não um defeito.
 */
export default async function ContatoPage() {
  const { idioma } = await visitanteAtual();
  const t = (texto: string) => textoDoSite(texto, idioma);
  const marca = branding();
  const temDestino = env.SUPPORT_EMAIL.trim().length > 0;

  return (
    <div className="flex min-h-screen flex-col bg-bg">
      <header className="sticky top-0 z-20 border-b border-border bg-bg/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link href="/" className="text-sm font-semibold tracking-tight text-text">
            {marca.name}
          </Link>
          <Link
            href="/login"
            className="link-sublinha text-sm text-text-muted transition-colors hover:text-text"
          >
            {t("Entrar")}
          </Link>
        </div>
      </header>

      {/*
        Duas colunas no desktop: à esquerda o que esta página PROMETE (quem lê,
        em quanto tempo, e o endereço direto para quem prefere o próprio
        e-mail); à direita o formulário. Antes era tudo numa coluna de 768px, e
        o contexto empurrava o formulário para baixo da dobra — numa página
        cujo único objetivo é ser preenchida.
      */}
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-10 sm:px-6 lg:py-16">
        <div className="grid gap-10 lg:grid-cols-[1fr_1.1fr] lg:gap-16">
          <header className="space-y-4">
            <h1 className="text-3xl font-semibold tracking-tight text-text sm:text-4xl">
              {t("Fale com a gente")}
            </h1>
            <p className="text-base leading-relaxed text-text-muted">
              {t(
                "Dúvida sobre planos, pedido de demonstração, problema com a conta ou relato de falha de segurança — tudo chega no mesmo lugar e é lido por gente.",
              )}
            </p>
          </header>

          {temDestino ? (
            <FormularioDeContato
              textos={{
                nome: t("Seu nome"),
                email: t("Seu e-mail"),
                assunto: t("Assunto"),
                mensagem: t("Mensagem"),
                enviar: t("Enviar mensagem"),
                enviando: t("Enviando..."),
                sucesso: t("Mensagem recebida. A resposta vai para o e-mail que você informou."),
                erro: t("Não foi possível enviar agora. Tente de novo em instantes."),
              }}
            />
          ) : (
            <p className="rounded-md border border-border p-4 text-sm text-text-muted">
              {t(
                "Esta instalação ainda não tem endereço de suporte configurado. Procure quem administra o sistema.",
              )}
            </p>
          )}
        </div>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto flex w-full max-w-7xl flex-wrap gap-x-6 gap-y-2 px-4 py-6 text-sm sm:px-6">
          <Link href="/legal" className="link-sublinha text-text-muted hover:text-text">
            {t("Documentos")}
          </Link>
        </div>
      </footer>
    </div>
  );
}
