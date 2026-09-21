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
    <div className="min-h-screen bg-muted/40">
      <header className="border-b bg-background">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-4 px-6 py-4">
          <Link href="/" className="text-xs tracking-wider text-muted-foreground uppercase">
            {marca.name}
          </Link>
          <Link href="/login" className="text-sm underline underline-offset-2">
            {t("Entrar")}
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl px-6 py-10">
        <div className="space-y-6 rounded-lg border bg-background p-8 text-sm leading-relaxed">
          <header className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight">{t("Fale com a gente")}</h1>
            <p className="text-muted-foreground">
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
            <p className="rounded-md border p-4 text-muted-foreground">
              {t(
                "Esta instalação ainda não tem endereço de suporte configurado. Procure quem administra o sistema.",
              )}
            </p>
          )}

          <footer className="border-t pt-4 text-muted-foreground">
            <Link href="/legal" className="underline underline-offset-2">
              {t("Documentos")}
            </Link>
          </footer>
        </div>
      </main>
    </div>
  );
}
