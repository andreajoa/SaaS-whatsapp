import { describe, expect, it } from "vitest";

import { montarEmail, montarEmailTransacional } from "@/lib/marketing/molde";
import { MENSAGENS, mensagemPorId, proximaMensagem } from "@/lib/marketing/sequencia";
import { TRANSACIONAIS } from "@/lib/marketing/transacionais";
import { IDIOMAS_DO_SITE, type IdiomaDoSite } from "@/lib/mercado/paises";

/**
 * O E-MAIL QUE CHEGA — medido no HTML que sai, não no molde que o produz.
 *
 * Todo caso aqui RENDERIZA as vinte mensagens nos três idiomas e olha o texto
 * final. É de propósito: ler o `molde.ts` e ver que ele não escreve `<img>`
 * prova que o molde não escreve — não prova que nenhuma das sessenta
 * combinações de conteúdo escreveu, e é o conteúdo que muda toda semana.
 *
 * A doutrina inteira está no cabeçalho de `lib/marketing/molde.ts`. O que
 * segue é ela em forma executável.
 */

const TOKEN = "a1b2c3d4e5f60718293a4b5c6d7e8f90";
const MARCA = "Atenza";

interface Renderizado {
  readonly quem: string;
  readonly html: string;
  readonly text: string;
  readonly headers: Record<string, string>;
  readonly ehPropaganda: boolean;
}

function tudo(): Renderizado[] {
  const saida: Renderizado[] = [];
  for (const idioma of IDIOMAS_DO_SITE) {
    for (const m of MENSAGENS) {
      const montado = montarEmail(m.texto[idioma].corpo, idioma, TOKEN, MARCA);
      saida.push({ quem: `${m.id}/${idioma}`, ...montado, ehPropaganda: true });
    }
    for (const t of TRANSACIONAIS) {
      const corpo = t.texto[idioma].corpo;
      const montado = t.ehPropaganda
        ? montarEmail(corpo, idioma, TOKEN, MARCA)
        : montarEmailTransacional(corpo, idioma, MARCA);
      saida.push({ quem: `${t.id}/${idioma}`, ...montado, ehPropaganda: t.ehPropaganda });
    }
  }
  return saida;
}

const RENDERIZADOS = tudo();

// Controle positivo. Sem ele, um `tudo()` que devolvesse lista vazia deixaria
// todos os `for` abaixo passarem sem ter olhado nada — o modo de falha que já
// custou caro neste repo (ver `suporte-cobertura-de-efeitos.test.ts`).
it("a varredura renderiza as vinte mensagens nos três idiomas", () => {
  expect(MENSAGENS.length).toBe(15);
  expect(TRANSACIONAIS.length).toBe(5);
  expect(RENDERIZADOS.length).toBe(20 * IDIOMAS_DO_SITE.length);
});

describe("o que o cliente de e-mail bloqueia", () => {
  it("nenhuma imagem, em nenhuma das sessenta", () => {
    // Gmail, Outlook e Apple Mail bloqueiam imagem remota de remetente
    // desconhecido — que é o que somos no primeiro e-mail. Um cabeçalho
    // desenhado como imagem chega como retângulo vazio, e é a PRIMEIRA coisa
    // que a pessoa vê. Cor sólida chega sempre.
    for (const r of RENDERIZADOS) {
      expect(r.html, `${r.quem} tem <img>`).not.toMatch(/<img\b/i);
      expect(r.html, `${r.quem} tem background-image`).not.toMatch(/background-image/i);
    }
  });

  it("nenhum data: URI — nem como imagem, nem escondido no CSS", () => {
    // `data:` não é a saída para o bloqueio acima: o Gmail o descarta por
    // política e o Outlook desktop idem. O e-mail fica maior, mais lento e
    // mais suspeito para o filtro, e continua sem aparecer.
    for (const r of RENDERIZADOS) {
      expect(r.html, `${r.quem} tem data: URI`).not.toMatch(/data:[a-z]+\/[a-z0-9.+-]+;base64/i);
    }
  });

  it("toda cor de fundo vem no atributo E no CSS", () => {
    // O Outlook 2016–2021 renderiza por Word, que ignora `background-color`
    // em `<td>` numa boa parte dos casos e obedece ao atributo `bgcolor`.
    // Quem escreve só o CSS vê o layout certo no Gmail e um e-mail
    // branco-em-branco no cliente que boa parte de quem paga usa no trabalho.
    for (const r of RENDERIZADOS) {
      const comAtributo = [
        ...r.html.matchAll(/<(?:td|body|table)\b[^>]*\bbgcolor="([^"]+)"[^>]*>/gi),
      ];
      expect(comAtributo.length, `${r.quem} não tem bgcolor nenhum`).toBeGreaterThan(0);
      for (const tag of comAtributo) {
        expect(tag[0], `${r.quem}: bgcolor sem background-color`).toMatch(
          new RegExp(`background-color:\\s*${tag[1]}`, "i"),
        );
      }
    }
  });

  it("layout em tabela, nunca em div", () => {
    // Mesmo motivo: o Word não tem flexbox nem grid, e `max-width` em `<div>`
    // ele ignora. Tabela de largura fixa dentro de tabela de 100% é o único
    // layout que atravessa os três clientes.
    for (const r of RENDERIZADOS) {
      expect(r.html, `${r.quem} usa <div>`).not.toMatch(/<div\b/i);
    }
  });

  it("o botão é tabela com bgcolor, não uma âncora com background", () => {
    // O Word ignora `background` em âncora: o botão some e vira um link azul
    // solto no meio do parágrafo — que é a diferença entre uma taxa de clique
    // e nenhuma.
    for (const r of RENDERIZADOS.filter((x) => /<a [^>]*padding/i.test(x.html))) {
      expect(r.html, `${r.quem}: âncora pintada`).not.toMatch(
        /<a\b[^>]*style="[^"]*background(?!-)/i,
      );
    }
  });
});

describe("a porta de saída", () => {
  it("propaganda leva o par da RFC 8058 e o link no rodapé", () => {
    // Sem o par de cabeçalhos o Gmail não desenha o botão nativo de cancelar
    // inscrição, e quem quer sair usa o que está à mão: "marcar como spam".
    // Esse clique não atinge a mensagem, atinge a reputação do DOMÍNIO.
    const propaganda = RENDERIZADOS.filter((r) => r.ehPropaganda);
    const esperados = MENSAGENS.length + TRANSACIONAIS.filter((t) => t.ehPropaganda).length;
    expect(propaganda.length).toBe(esperados * IDIOMAS_DO_SITE.length);
    for (const r of propaganda) {
      // A URL de um clique é a que o Gmail POSTa, e é ela que não pode
      // faltar nunca. O `mailto:` que a antecede é opcional por construção —
      // `cabecalhosDeDescadastro` só o escreve quando `SUPPORT_EMAIL` existe,
      // e ele não existe num ambiente de teste nem numa VPS recém-instalada.
      // Cobrá-lo aqui reprovaria o CI por uma variável de ambiente, que é o
      // tipo de vermelho que ensina a ignorar vermelho.
      expect(r.headers["List-Unsubscribe"], `${r.quem}`).toMatch(
        new RegExp(`<[a-z]+://[^>]*/api/v1/site/descadastrar\\?t=${TOKEN}>$`),
      );
      expect(r.headers["List-Unsubscribe-Post"]).toBe("List-Unsubscribe=One-Click");
      expect(r.html, `${r.quem} sem link de saída`).toContain(`/descadastrar/${TOKEN}`);
      expect(r.text, `${r.quem} sem link de saída no texto`).toContain(`/descadastrar/${TOKEN}`);
    }
  });

  it("transacional NÃO leva saída — não se descadastra de um cartão recusado", () => {
    // Oferecer descadastro de "seu pagamento falhou" é oferecer a alguém a
    // opção de não ser avisado de que vai perder o acesso. E o Gmail conta o
    // descadastro como engajamento negativo: misturar os dois canais faz a
    // lista de propaganda contaminar a reputação dos avisos que PRECISAM
    // chegar.
    const transacional = RENDERIZADOS.filter((r) => !r.ehPropaganda);
    const esperados = TRANSACIONAIS.filter((t) => !t.ehPropaganda).length;
    expect(transacional.length).toBe(esperados * IDIOMAS_DO_SITE.length);
    for (const r of transacional) {
      expect(Object.keys(r.headers), `${r.quem}`).toEqual([]);
      expect(r.html, `${r.quem} oferece saída`).not.toContain("/descadastrar/");
    }
  });

  it("os dois avisos que respondem a dinheiro são os que não têm saída", () => {
    // Congelado de propósito: mover `assinatura-ativa` ou `pagamento-falhou`
    // para o lado da propaganda é a mudança que ninguém percebe no diff.
    const semSaida = TRANSACIONAIS.filter((t) => !t.ehPropaganda).map((t) => t.id);
    expect(semSaida.sort()).toEqual(["assinatura-ativa", "pagamento-falhou"]);
  });
});

describe("o conteúdo das vinte", () => {
  it("todo id é único e estável — é ele que vai para email_envios.mensagem", () => {
    // `email_envios.mensagem` guarda o id, e nunca um índice: inserir uma
    // mensagem no meio da série deslocaria todos os índices, e o
    // `unique (lead_id, mensagem)` passaria a suprimir envios legítimos em
    // silêncio.
    const ids = [...MENSAGENS.map((m) => m.id), ...TRANSACIONAIS.map((t) => t.id)];
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id, `${id} não é slug`).toMatch(/^[a-z0-9-]+$/);
  });

  it("os três idiomas estão completos — ninguém recebe em branco", () => {
    for (const m of [...MENSAGENS, ...TRANSACIONAIS]) {
      for (const idioma of IDIOMAS_DO_SITE) {
        const t = m.texto[idioma as IdiomaDoSite];
        expect(t?.assunto.trim().length, `${m.id}/${idioma} sem assunto`).toBeGreaterThan(0);
        expect(t?.corpo.titulo.trim().length, `${m.id}/${idioma} sem título`).toBeGreaterThan(0);
        expect(t?.corpo.paragrafos.length, `${m.id}/${idioma} sem corpo`).toBeGreaterThan(0);
      }
    }
  });

  it("a espera cresce, e nunca recua", () => {
    // `dia` é espera MÍNIMA desde a inscrição. Uma série fora de ordem faria
    // o cursor pular passos que já venceram e encavalar dois no mesmo dia.
    const dias = MENSAGENS.map((m) => m.dia);
    expect(dias).toEqual([...dias].sort((a, b) => a - b));
    expect(dias[0]).toBe(0);
  });

  it("a maioria dos quinze não pede nada", () => {
    // Uma sequência que pede em todos os quinze passos é descadastrada no
    // terceiro. O número exato não importa; que a maioria ensine sem pedir,
    // sim — e é isso que esta régua congela.
    const comPedido = MENSAGENS.filter((m) => m.texto["pt-BR"].corpo.acao).length;
    expect(comPedido).toBeLessThanOrEqual(5);
    expect(comPedido).toBeGreaterThan(0);
  });

  it("todo botão aponta para caminho relativo — o host é do ambiente", () => {
    // Host escrito dentro do texto manda quem clicou para a instalação errada
    // quando a mesma sequência roda em desenvolvimento: sem erro, sem log.
    for (const m of [...MENSAGENS, ...TRANSACIONAIS]) {
      for (const idioma of IDIOMAS_DO_SITE) {
        const acao = m.texto[idioma as IdiomaDoSite]?.corpo.acao;
        if (!acao) continue;
        expect(acao.caminho, `${m.id}/${idioma}`).toMatch(/^\//);
        expect(acao.caminho, `${m.id}/${idioma} tem host`).not.toMatch(/^https?:/);
      }
    }
  });
});

describe("o cursor da série", () => {
  it("sem nada enviado, começa pela primeira", () => {
    expect(proximaMensagem(null)?.id).toBe(MENSAGENS[0]!.id);
  });

  it("caminha até o fim e para — não recomeça", () => {
    let atual: string | null = null;
    const vistos: string[] = [];
    for (let i = 0; i < MENSAGENS.length + 3; i++) {
      const prox = proximaMensagem(atual);
      if (!prox) break;
      vistos.push(prox.id);
      atual = prox.id;
    }
    expect(vistos).toEqual(MENSAGENS.map((m) => m.id));
    expect(proximaMensagem(MENSAGENS.at(-1)!.id)).toBeNull();
  });

  it("id desconhecido PARA, em vez de recomeçar do zero", () => {
    // Um id que sumiu da série é uma mensagem removida DEPOIS de ter sido
    // enviada. Recomeçar do zero reenviaria os quinze para quem já os leu.
    expect(proximaMensagem("mensagem-que-foi-removida")).toBeNull();
  });

  it("todo id é resolvível de volta — o painel lê por id, não por índice", () => {
    for (const m of MENSAGENS) expect(mensagemPorId(m.id)?.dia).toBe(m.dia);
    expect(mensagemPorId("nao-existe")).toBeNull();
  });
});

describe("o que vem de fora", () => {
  it("o nome da marca é escapado — ele vem de um campo que alguém digita", () => {
    // `platform_branding` é texto livre numa tela do operador. Sem escape,
    // um `</style><script>` no nome da instalação viaja dentro do e-mail.
    const { html } = montarEmail(
      { titulo: "t", paragrafos: ["p"] },
      "pt-BR",
      TOKEN,
      '<script>alert(1)</script>"',
    );
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("o texto puro acompanha o HTML — nenhum cliente recebe só um deles", () => {
    for (const r of RENDERIZADOS) {
      expect(r.text.trim().length, `${r.quem} sem versão texto`).toBeGreaterThan(80);
      expect(r.text, `${r.quem}: HTML vazou para o texto`).not.toMatch(/<(td|table|p|a)\b/i);
    }
  });
});
