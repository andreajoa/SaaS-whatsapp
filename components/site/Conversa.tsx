import type { ReactNode } from "react";

/**
 * O VOCABULÁRIO VISUAL DE CONVERSA — a página como uma tela de mensagens.
 *
 * ─── A ideia, e o limite dela ──────────────────────────────────────────────
 *
 * Quem cai nesta página deve entender do que se trata ANTES de ler uma
 * palavra: o formato já conta. Um produto de atendimento por mensagem
 * apresentado como uma conversa é a coisa mais direta que esta página pode
 * fazer, e nenhum concorrente faz.
 *
 * O limite é onde o conteúdo deixa de ser FALA e vira DECISÃO. Preço em balão
 * fica ilegível e faz o produto parecer brincadeira no exato momento em que a
 * pessoa vai gastar dinheiro; pergunta frequente em balão dobra a altura da
 * página. Por isso a regra é:
 *
 *     conversa onde o conteúdo é fala · cartão onde o conteúdo é decisão
 *
 * Planos, perguntas e rodapé continuam sendo o que eram, dentro da mesma
 * paleta. Um site inteiro em balões é fantasia; um site que PARECE conversa e
 * continua usável é posicionamento.
 *
 * ─── Por que nada aqui copia o WhatsApp ────────────────────────────────────
 *
 * Nem o verde dele, nem os rabiscos do papel de parede, nem o logotipo. Duas
 * razões, e as duas bastam sozinhas: imitar identidade visual de outra empresa
 * é problema jurídico, e este produto é WHITE-LABEL — um revendedor de marca
 * azul teria uma página verde que não é dele. Tudo aqui sai dos tokens de
 * `app/globals.css`, então a página veste a marca de quem a instalou.
 *
 * O que se toma emprestado é a GRAMÁTICA, que não pertence a ninguém: balão
 * com rabinho, quem fala de um lado e quem responde do outro, etiqueta de data
 * separando os blocos, campo de escrever no fim.
 *
 * Tudo aqui é Server Component: nenhum byte de JavaScript.
 */

/**
 * A etiqueta que separa blocos, no lugar do título de seção.
 *
 * Numa conversa é a data ("HOJE"). Aqui é o assunto — e a troca é deliberada:
 * "HOJE" não informa nada sobre o produto, e a etiqueta é o único lugar desta
 * página em que cabe a palavra que a pessoa procurou no Google.
 */
export function EtiquetaDeAssunto({ children }: { readonly children: ReactNode }) {
  return (
    <div className="flex justify-center py-8">
      <span className="rounded-full border border-border bg-surface px-3.5 py-1 text-xs font-medium tracking-wide text-text-subtle uppercase shadow-xs">
        {children}
      </span>
    </div>
  );
}

/**
 * O balão. `lado="cliente"` é quem pergunta (esquerda, claro); `lado="empresa"`
 * é quem responde (direita, cor da marca).
 *
 * ─── Por que o conteúdo da página é do lado da EMPRESA ─────────────────────
 *
 * A página inteira é a empresa explicando o produto. Pôr isso à esquerda, no
 * lugar de quem chega, inverteria os papéis — e a inversão não é sutil: à
 * esquerda o texto lê como se o VISITANTE estivesse dizendo aquilo.
 *
 * As dores ficam à esquerda, e só elas, porque ali quem fala é de fato o
 * visitante: "a resposta demora", "a conversa se perde". É a única parte da
 * página escrita da boca dele.
 *
 * ─── O rabinho ────────────────────────────────────────────────────────────
 *
 * Um canto reto num dos quatro cantos — `rounded-bl-sm` ou `rounded-br-sm` —,
 * que é como todo mensageiro desenha. Não é adorno: é o que diz de que lado o
 * balão saiu, sem depender do alinhamento (que some quando a tela é estreita e
 * os dois lados ocupam a largura toda).
 */
export function Balao({
  lado,
  children,
  className,
}: {
  readonly lado: "cliente" | "empresa";
  readonly children: ReactNode;
  readonly className?: string;
}) {
  const daEmpresa = lado === "empresa";
  return (
    <div className={daEmpresa ? "flex justify-end" : "flex justify-start"}>
      <div
        className={[
          "max-w-2xl rounded-lg px-5 py-4 shadow-xs sm:px-6 sm:py-5",
          daEmpresa
            ? "rounded-br-sm border border-accent-200 bg-accent-soft"
            : "rounded-bl-sm border border-border bg-surface",
          className ?? "",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        {children}
      </div>
    </div>
  );
}

/**
 * O corpo da conversa: o papel de parede e a coluna de balões.
 *
 * O padrão do fundo é geométrico e nosso — pontos numa grade diagonal, em 3%
 * de opacidade sobre a cor de destaque da marca. Some no tema escuro sem
 * ajuste nenhum, porque a cor vem do token e não de um hex.
 *
 * `background-attachment` fica no padrão (rola junto). Fixo, o papel de parede
 * parece uma janela por onde a página passa — efeito bonito e errado aqui: a
 * conversa tem de parecer UM lugar, não uma câmera atravessando um cenário.
 */
export function CorpoDaConversa({
  children,
  className,
}: {
  readonly children: ReactNode;
  readonly className?: string;
}) {
  return (
    <div className={`fundo-de-conversa ${className ?? ""}`.trim()}>
      <div className="mx-auto w-full max-w-4xl space-y-4 px-4 py-6 sm:px-6">{children}</div>
    </div>
  );
}
