import Link from "next/link";

import { LinksLegais } from "@/components/site/LinksLegais";
import { branding } from "@/lib/branding";
import { DOCUMENTOS_LEGAIS, frase } from "@/lib/legal/documentos";
import { resolverOperador } from "@/lib/legal/operador";
import { textoDoSite } from "@/lib/mercado/textos";
import { visitanteAtual } from "@/lib/mercado/visitante";

/**
 * A CASA DOS DOCUMENTOS — duas colunas no desktop, empilhado no celular.
 *
 * ─── O que estava errado ───────────────────────────────────────────────────
 *
 * Era um cartão de 768px centralizado num fundo cinza. Num monitor de 1440px
 * isso deixa mais de 600px de vazio dos dois lados, e o documento parecia uma
 * folha solta em vez de parte de um site. Pior: para ir de um documento a
 * outro era preciso voltar ao índice, o que num conjunto de OITO documentos
 * legais transforma uma comparação simples (o que a política de reembolso diz
 * sobre o que os termos prometem?) numa sucessão de idas e voltas.
 *
 * ─── O que entrou ──────────────────────────────────────────────────────────
 *
 * Uma coluna de navegação fixa à esquerda com os oito documentos, e o texto à
 * direita. É o formato de toda documentação boa, e não é moda: ele resolve as
 * duas coisas de uma vez — ocupa a tela e diz, o tempo todo, onde a pessoa
 * está dentro de um conjunto.
 *
 * A medida do TEXTO não muda com a tela. `max-w-2xl` no artigo, sempre: linha
 * de leitura confortável tem 60 a 75 caracteres, e esticar o parágrafo até a
 * borda de um monitor largo é o jeito mais rápido de tornar um contrato
 * ilegível. Quem ocupa a tela é o LAYOUT, não a linha.
 *
 * ─── No celular ────────────────────────────────────────────────────────────
 *
 * A coluna vira uma tira que rola na horizontal, acima do texto. Não vira
 * menu escondido: documento legal é lido por quem está com uma dúvida
 * específica, e esconder os outros sete atrás de um clique é exatamente o que
 * faz a pessoa desistir e escrever para o suporte.
 */
export default async function LegalLayout({ children }: { children: React.ReactNode }) {
  const marca = branding();
  const { idioma } = await visitanteAtual();
  const op = await resolverOperador();
  const t = (texto: string) => textoDoSite(texto, idioma);
  const nomes = {
    sistema: op.sistema,
    operador: op.razaoSocial ?? op.nome ?? t("o operador desta instalação"),
  };

  // Os dois antigos são `.tsx` escritos antes de `lib/legal/documentos.ts` e
  // entram à mão — trocá-los de forma agora seria reescrever contrato
  // publicado por um ganho de arrumação. Mesma decisão do índice.
  const documentos = [
    { href: "/legal/terms", titulo: t("Termos de uso") },
    { href: "/legal/privacy", titulo: t("Política de Privacidade") },
    ...DOCUMENTOS_LEGAIS.map((d) => ({
      href: `/legal/${d.slug}`,
      titulo: frase(d.titulo, idioma, nomes),
    })),
  ];

  return (
    <div className="flex min-h-screen flex-col bg-bg">
      <header className="sticky top-0 z-20 border-b border-border bg-bg/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link href="/" className="text-sm font-semibold tracking-tight text-text">
            {marca.name}
          </Link>
          {/*
            Volta para a RAIZ, e não para `/login` como antes. Quem lê a
            política de privacidade antes de assinar ainda não tem conta —
            mandá-lo ao formulário de senha é oferecer a porta errada.
          */}
          <Link
            href="/"
            className="link-sublinha text-sm text-text-muted transition-colors hover:text-text"
          >
            {t("Voltar")}
          </Link>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-7xl flex-1 gap-10 px-4 py-8 sm:px-6 lg:gap-14 lg:py-12">
        <LinksLegais documentos={documentos} rotulo={t("Documentos")} />
        <main className="min-w-0 flex-1">
          <article className="max-w-2xl space-y-8 text-[15px] leading-relaxed text-text-muted">
            {children}
          </article>
        </main>
      </div>

      <footer className="border-t border-border">
        <div className="mx-auto w-full max-w-7xl px-4 py-6 text-xs text-text-subtle sm:px-6">
          {marca.name}
        </div>
      </footer>
    </div>
  );
}
