/**
 * A FAIXA DE BENEFÍCIOS QUE ANDA, NO TOPO DA PÁGINA.
 *
 * ─── Por que ela não é um componente de cliente ────────────────────────────
 *
 * Não há estado, não há evento, não há `useEffect`. O movimento inteiro é uma
 * `animation` de CSS sobre um `translateX`, então isto pode ser Server
 * Component — zero JavaScript enviado ao navegador por causa dela. Um efeito
 * decorativo que custasse bundle seria o pior negócio da página.
 *
 * ─── A lista vem DUPLICADA, e é isso que faz o laço ser invisível ──────────
 *
 * O trilho anda exatamente 50% da própria largura e volta ao zero. Com a lista
 * escrita uma vez só, a volta é um salto visível; com ela duplicada, o que
 * está em -50% é pixel a pixel igual ao que estava em 0. É o truque clássico
 * de esteira, e ele depende de a duplicação ser EXATA — mexer numa cópia e não
 * na outra produz um tranco a cada volta.
 *
 * A segunda cópia é `aria-hidden` porque é a MESMA informação: quem usa leitor
 * de tela ouviria os benefícios duas vezes seguidas, sem nenhum motivo.
 *
 * ─── O que ela promete tem de ser verdade ──────────────────────────────────
 *
 * Os itens chegam por prop, já traduzidos, de `app/page.tsx` — onde o guarda
 * de i18n varre o AST. Frase nova escrita aqui dentro nasceria fora do alcance
 * dele e viraria meia-tradução silenciosa.
 */
export function BarraDeBeneficios({ itens }: { readonly itens: readonly string[] }) {
  if (itens.length === 0) return null;

  const fita = (escondida: boolean) => (
    <ul
      aria-hidden={escondida || undefined}
      className="flex shrink-0 items-center gap-8 pr-8 text-sm font-medium"
    >
      {itens.map((item, i) => (
        <li key={`${i}-${item}`} className="flex shrink-0 items-center gap-2 whitespace-nowrap">
          <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-accent-700/60" />
          {item}
        </li>
      ))}
    </ul>
  );

  return (
    // A faixa usa a cor de DESTAQUE da marca, não o cinza do painel. Ela é a
    // primeira coisa acima de tudo na página: em `bg-surface-elevated` ela se
    // confundia com o cabeçalho logo abaixo e passava despercebida — uma faixa
    // que ninguém vê é peso morto no topo da página.
    <div className="border-b border-accent-200 bg-accent-soft text-accent-700">
      {/*
        As máscaras nas pontas existem para o texto não ser DECEPADO na borda.
        Sem elas, uma frase some no meio de uma palavra e o olho tenta lê-la —
        que é o oposto do que uma faixa de apoio deve fazer com a atenção.
      */}
      <div className="barra-beneficios mx-auto w-full max-w-6xl overflow-hidden px-6 py-2.5">
        <div className="barra-beneficios-trilho flex w-max items-center">
          {fita(false)}
          {fita(true)}
        </div>
      </div>
    </div>
  );
}
