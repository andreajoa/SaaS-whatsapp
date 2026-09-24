import { Check, X } from "lucide-react";

/**
 * O ANTES E O DEPOIS, LADO A LADO.
 *
 * ─── Por que as linhas são PAREADAS, e não duas listas ─────────────────────
 *
 * A versão fácil desta seção são duas colunas de bullets independentes: cinco
 * queixas de um lado, cinco elogios do outro. Ela não funciona, e o motivo é
 * mecânico: o olho não sabe qual elogio responde a qual queixa, então lê dez
 * frases soltas e não guarda nenhuma.
 *
 * Aqui cada linha é UM par — a mesma dor, os dois desfechos. A comparação
 * acontece na horizontal, que é como o olho compara de graça. É também o que
 * torna a seção honesta: não dá para escrever um "com" que não responda ao
 * "sem" que está do lado, porque a falta de resposta fica visível.
 *
 * ─── O lado "sem" não caricatura ninguém ───────────────────────────────────
 *
 * As frases da esquerda descrevem o que acontece hoje numa empresa que atende
 * bem, com gente dedicada — não numa empresa relapsa. "A pessoa pergunta às
 * 22h e é atendida no dia seguinte" não é falha de caráter, é o limite de um
 * humano que dorme. Caricaturar o presente do leitor faz ele se defender em
 * vez de se reconhecer, e quem se defende não compra.
 *
 * ─── No celular a ordem importa ────────────────────────────────────────────
 *
 * Empilhado, o "sem" vem primeiro e o "com" logo abaixo, par a par — e não os
 * cinco "sem" seguidos dos cinco "com". Separados por uma tela de rolagem, a
 * comparação se perde e viram duas listas de novo, que é exatamente o que esta
 * estrutura existe para evitar.
 *
 * Server Component: nenhum JavaScript.
 */
export interface ParDeComparacao {
  readonly sem: string;
  readonly com: string;
}

export function ComESem({
  tituloSem,
  tituloCom,
  pares,
}: {
  readonly tituloSem: string;
  readonly tituloCom: string;
  readonly pares: readonly ParDeComparacao[];
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-border">
      {/* Cabeçalho das duas colunas. Some no celular, onde cada par carrega o
          próprio rótulo — sem isso, rolar três pares para baixo faz esquecer
          qual coluna é qual. */}
      <div className="hidden md:grid md:grid-cols-2">
        <div className="border-b border-border bg-surface-elevated px-6 py-4">
          <p className="text-sm font-semibold text-text-subtle">{tituloSem}</p>
        </div>
        <div className="border-b border-l border-border bg-accent-soft px-6 py-4">
          <p className="text-sm font-semibold text-accent-700">{tituloCom}</p>
        </div>
      </div>

      <div className="divide-y divide-border">
        {pares.map((par, i) => (
          <div key={i} className="md:grid md:grid-cols-2">
            <div className="flex gap-3 bg-surface-elevated px-6 py-5">
              <X aria-hidden className="mt-0.5 size-4 shrink-0 text-text-subtle" />
              <div className="min-w-0">
                <p className="mb-1 text-xs font-semibold text-text-subtle md:hidden">{tituloSem}</p>
                <p className="text-sm leading-relaxed text-text-muted">{par.sem}</p>
              </div>
            </div>
            <div className="flex gap-3 border-t border-border bg-accent-soft px-6 py-5 md:border-t-0 md:border-l">
              <Check aria-hidden className="mt-0.5 size-4 shrink-0 text-accent-700" />
              <div className="min-w-0">
                <p className="mb-1 text-xs font-semibold text-accent-700 md:hidden">{tituloCom}</p>
                <p className="text-sm leading-relaxed text-text">{par.com}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
