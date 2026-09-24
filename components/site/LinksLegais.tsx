"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * A COLUNA DE NAVEGAÇÃO DOS DOCUMENTOS.
 *
 * ─── Por que ela é `"use client"` ──────────────────────────────────────────
 *
 * Por uma linha só: `usePathname`. Marcar o documento ATUAL é o que transforma
 * uma lista de links numa navegação — sem isso a pessoa lê oito títulos iguais
 * e não sabe qual deles está aberto. É a única informação que o servidor não
 * tem como passar ao layout, porque o layout não recebe a rota filha.
 *
 * ─── No celular ela rola na horizontal ─────────────────────────────────────
 *
 * E não vira menu escondido atrás de um botão. Documento legal é lido por quem
 * chegou com uma dúvida específica — "posso cancelar?", "quem vê meus dados?"
 * —, e esconder os outros sete atrás de um clique é o que faz a pessoa
 * desistir e escrever para o suporte. Uma tira que rola mostra que existem
 * outros e custa um gesto que todo mundo já faz.
 *
 * `scrollbar-none` não entra: a barra fina do sistema é o que ANUNCIA que há
 * mais coisa à direita. Escondê-la deixa a tira parecendo uma lista completa
 * que termina onde a tela termina.
 */
export function LinksLegais({
  documentos,
  rotulo,
}: {
  readonly documentos: ReadonlyArray<{ href: string; titulo: string }>;
  readonly rotulo: string;
}) {
  const atual = usePathname();

  return (
    <nav
      aria-label={rotulo}
      className="
        -mx-4 mb-6 shrink-0 overflow-x-auto px-4 pb-3
        sm:-mx-6 sm:px-6
        lg:mx-0 lg:mb-0 lg:w-64 lg:overflow-visible lg:px-0 lg:pb-0
      "
    >
      <p className="mb-3 hidden text-xs font-medium tracking-wide text-text-subtle uppercase lg:block">
        {rotulo}
      </p>
      {/*
        `sticky` só a partir de `lg`: numa tela estreita a tira já está no topo
        do fluxo, e grudá-la roubaria altura de leitura justamente onde ela é
        mais escassa.
      */}
      <ul className="flex gap-2 lg:sticky lg:top-24 lg:flex-col lg:gap-0.5">
        {documentos.map((doc) => {
          const aberto = atual === doc.href;
          return (
            <li key={doc.href} className="shrink-0">
              <Link
                href={doc.href}
                // `aria-current` é o que conta a mesma coisa a quem não vê a
                // cor. Sem ele, o destaque existe só para quem enxerga.
                aria-current={aberto ? "page" : undefined}
                className={[
                  "block rounded-md px-3 py-2 text-sm transition-colors",
                  "whitespace-nowrap lg:whitespace-normal",
                  aberto
                    ? "bg-accent-soft font-medium text-accent-700"
                    : "text-text-muted hover:bg-surface-elevated hover:text-text",
                ].join(" ")}
              >
                {doc.titulo}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
