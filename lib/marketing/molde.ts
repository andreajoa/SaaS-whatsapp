import { env } from "@/lib/env";
import { cabecalhosDeDescadastro, urlDeDescadastro } from "@/lib/marketing/descadastro";
import type { IdiomaDoSite } from "@/lib/mercado/paises";

/**
 * O CASCO DE TODO E-MAIL DE PROPAGANDA — e as quatro coisas que ele não faz.
 *
 * ─── 1. Nenhuma `<img>`, em lugar nenhum ──────────────────────────────────
 *
 * Gmail, Outlook e Apple Mail bloqueiam imagem remota por padrão em remetente
 * desconhecido — que é exatamente o que somos no primeiro e-mail. Um cabeçalho
 * desenhado como imagem chega como retângulo vazio com um alt em cinza, e é a
 * PRIMEIRA coisa que a pessoa vê de nós. Cor sólida chega sempre.
 *
 * E `data:` não é a saída: Gmail descarta `data:` dentro de `<img>` por
 * política, Outlook desktop idem. O e-mail fica maior, mais lento, mais
 * suspeito para o filtro — e continua sem aparecer.
 *
 * ─── 2. `bgcolor` E `background-color`, sempre os dois ────────────────────
 *
 * Outlook 2016–2021 renderiza por Word, que ignora `background-color` em
 * `<td>` numa boa parte dos casos e obedece ao atributo `bgcolor`. Quem escreve
 * só o CSS vê o layout certo no Gmail e um e-mail branco-em-branco no cliente
 * que boa parte de quem paga usa no trabalho. Escrever os dois custa nada.
 *
 * ─── 3. Tabela, não `<div>` ───────────────────────────────────────────────
 *
 * Pelo mesmo motivo: o Word não tem flexbox nem grid, e `max-width` em `<div>`
 * ele ignora. Uma tabela de largura fixa dentro de uma tabela de 100% é o
 * único layout que atravessa os três.
 *
 * ─── 4. O rodapé de saída não é opcional ──────────────────────────────────
 *
 * Todo e-mail daqui sai com endereço físico do operador, o motivo de a pessoa
 * estar recebendo, e o link de descadastro — e com o par da RFC 8058 nos
 * CABEÇALHOS, que é o que faz o Gmail desenhar o botão nativo. Sem ele, quem
 * quer sair usa o que está à mão: "marcar como spam". Esse clique não atinge a
 * mensagem, atinge a reputação do domínio para todos os destinatários
 * seguintes.
 *
 * O molde EXIGE o token no tipo. Não há caminho para montar um e-mail de
 * propaganda sem porta de saída — a ausência é erro de compilação, não algo
 * que se descobre lendo uma denúncia de spam.
 */

/** Tinta do e-mail. Tema claro sempre — e-mail não tem `prefers-color-scheme`. */
const TINTA = {
  tela: "#f4f5f4",
  papel: "#ffffff",
  borda: "#e3e5e3",
  texto: "#1b1d1b",
  leve: "#6a6f6a",
  acento: "#2f5d3a",
  acentoFg: "#ffffff",
  destaque: "#eef3ef",
} as const;

export interface CorpoDoEmail {
  /** Chamada grande, no alto. Uma frase — vira `<h1>`. */
  readonly titulo: string;
  /** Parágrafos do corpo, na ordem. Texto puro; o molde escapa. */
  readonly paragrafos: readonly string[];
  /**
   * O botão. Ausente = e-mail sem pedido, o que é legítimo em alguns passos.
   *
   * `caminho` é RELATIVO (`/#precos`, `/signup`) e o molde resolve contra
   * `NEXT_PUBLIC_APP_URL`. O texto de uma campanha não pode saber o host: a
   * mesma sequência roda em `localhost` no desenvolvimento e no domínio em
   * produção, e um host escrito à mão dentro do texto manda quem clicou para a
   * instalação errada — sem erro, sem log, com o e-mail bonito.
   */
  readonly acao?: { readonly rotulo: string; readonly caminho: string };
  /** Linhas curtas num bloco destacado (lista de ganhos, números). Opcional. */
  readonly destaques?: readonly string[];
  /** Fecho pequeno, depois do botão. Opcional. */
  readonly posEscrito?: string;
}

export interface MontagemDoEmail {
  readonly html: string;
  readonly text: string;
  readonly headers: Record<string, string>;
}

const RODAPE: Record<IdiomaDoSite, { porque: string; sair: string; ver: string }> = {
  "pt-BR": {
    porque: "Você recebe este e-mail porque deixou seu endereço em nosso site.",
    sair: "Sair da lista",
    ver: "Ver no navegador não é necessário: este e-mail é texto.",
  },
  en: {
    porque: "You are receiving this because you left your address on our site.",
    sair: "Leave the list",
    ver: "No need to view in a browser: this email is text.",
  },
  es: {
    porque: "Recibe este correo porque dejó su dirección en nuestro sitio.",
    sair: "Salir de la lista",
    ver: "No hace falta verlo en el navegador: este correo es texto.",
  },
};

/** O rodapé do e-mail que a pessoa provocou. Sem saída, porque não há de quê. */
const TRANSACIONAL: Record<IdiomaDoSite, string> = {
  "pt-BR":
    "Você recebe este aviso porque ele faz parte de uma compra ou de uma conta sua. Ele não é propaganda e não tem descadastro.",
  en: "You are receiving this notice because it is part of a purchase or an account of yours. It is not marketing and has no unsubscribe.",
  es: "Recibe este aviso porque forma parte de una compra o de una cuenta suya. No es publicidad y no tiene baja.",
};

/**
 * O rodapé de um e-mail que a pessoa NÃO pediu, e do qual ela pode sair.
 *
 * `token` é o de descadastro (`site_leads.token_descadastro`), e é obrigatório
 * de propósito — ver o item 4 do cabeçalho.
 */
export function montarEmail(
  corpo: CorpoDoEmail,
  idioma: IdiomaDoSite,
  token: string,
  nomeDoProduto: string,
): MontagemDoEmail {
  const r = RODAPE[idioma] ?? RODAPE["pt-BR"];
  const saida = urlDeDescadastro(token);
  return montar(corpo, idioma, nomeDoProduto, {
    html: `<p style="margin:0 0 6px;font-size:12px;line-height:1.6;color:${TINTA.leve}">${esc(r.porque)}</p>
        <p style="margin:0;font-size:12px;line-height:1.6;color:${TINTA.leve}">
          <a href="${esc(saida)}" style="color:${TINTA.leve};text-decoration:underline">${esc(r.sair)}</a>
        </p>`,
    texto: [r.porque, `${r.sair}: ${saida}`],
    headers: cabecalhosDeDescadastro(token),
  });
}

/**
 * O e-mail que responde a um ATO da pessoa — e que por isso não se descadastra.
 *
 * "Seu cartão foi recusado" e "sua assinatura está ativa" não são propaganda:
 * são a outra metade de uma transação que a própria pessoa começou. Dar a eles
 * o `List-Unsubscribe` seria oferecer a alguém a opção de não ser avisado de
 * que o acesso dela vai cair — e o Gmail conta o descadastro como sinal de
 * engajamento negativo, então misturar os dois canais faz a lista de
 * propaganda contaminar a reputação dos avisos que PRECISAM chegar.
 *
 * É por isso que são duas funções e não um parâmetro opcional: um parâmetro
 * que se pode esquecer acaba esquecido nos dois sentidos — propaganda sem
 * saída, que queima o domínio, e aviso de cobrança com saída, que faz alguém
 * perder o acesso sem saber por quê.
 */
export function montarEmailTransacional(
  corpo: CorpoDoEmail,
  idioma: IdiomaDoSite,
  nomeDoProduto: string,
): MontagemDoEmail {
  const r = TRANSACIONAL[idioma] ?? TRANSACIONAL["pt-BR"];
  return montar(corpo, idioma, nomeDoProduto, {
    html: `<p style="margin:0;font-size:12px;line-height:1.6;color:${TINTA.leve}">${esc(r)}</p>`,
    texto: [r],
    headers: {},
  });
}

interface Rodape {
  readonly html: string;
  readonly texto: readonly string[];
  readonly headers: Record<string, string>;
}

function montar(
  corpo: CorpoDoEmail,
  idioma: IdiomaDoSite,
  nomeDoProduto: string,
  rodape: Rodape,
): MontagemDoEmail {
  const alvo = corpo.acao
    ? `${env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "")}${corpo.acao.caminho}`
    : "";

  const paragrafos = corpo.paragrafos
    .map(
      (p) =>
        `<p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:${TINTA.texto}">${esc(p)}</p>`,
    )
    .join("");

  const destaques = corpo.destaques?.length
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px">
         <tr>
           <td bgcolor="${TINTA.destaque}" style="background-color:${TINTA.destaque};border-radius:8px;padding:18px 20px">
             ${corpo.destaques
               .map(
                 (d) =>
                   `<p style="margin:0 0 8px;font-size:15px;line-height:1.5;color:${TINTA.texto}">${esc(d)}</p>`,
               )
               .join("")}
           </td>
         </tr>
       </table>`
    : "";

  // O botão é uma TABELA com `bgcolor`, e não um `<a>` com `background`: o Word
  // ignora `background` em âncora e o botão some, virando um link azul solto.
  const acao = corpo.acao
    ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px">
         <tr>
           <td bgcolor="${TINTA.acento}" style="background-color:${TINTA.acento};border-radius:8px">
             <a href="${esc(alvo)}" style="display:inline-block;padding:13px 26px;font-size:16px;font-weight:600;color:${TINTA.acentoFg};text-decoration:none">${esc(corpo.acao.rotulo)}</a>
           </td>
         </tr>
       </table>`
    : "";

  const posEscrito = corpo.posEscrito
    ? `<p style="margin:0 0 8px;font-size:14px;line-height:1.6;color:${TINTA.leve}">${esc(corpo.posEscrito)}</p>`
    : "";

  const html = `<!doctype html>
<html lang="${idioma}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width">
<title>${esc(corpo.titulo)}</title></head>
<body style="margin:0;padding:0;background-color:${TINTA.tela}" bgcolor="${TINTA.tela}">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${TINTA.tela}" style="background-color:${TINTA.tela}">
  <tr><td align="center" style="padding:32px 12px">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:100%">

      ${cabecalho(nomeDoProduto, base)}

      <tr><td bgcolor="${TINTA.papel}" style="background-color:${TINTA.papel};border:1px solid ${TINTA.borda};border-top:0;border-radius:0 0 10px 10px;padding:32px 28px">
        <h1 style="margin:0 0 20px;font-size:24px;line-height:1.3;font-weight:700;color:${TINTA.texto}">${esc(corpo.titulo)}</h1>
        ${paragrafos}
        ${destaques}
        ${acao}
        ${posEscrito}
      </td></tr>

      ${pesDePagina(base, rodape.html)}

    </table>
  </td></tr>
</table>
</body></html>`;

  const text = [
    corpo.titulo,
    "",
    ...corpo.paragrafos,
    ...(corpo.destaques?.length ? ["", ...corpo.destaques.map((d) => `- ${d}`)] : []),
    ...(corpo.acao ? ["", `${corpo.acao.rotulo}: ${alvo}`] : []),
    ...(corpo.posEscrito ? ["", corpo.posEscrito] : []),
    "",
    "—",
    ...rodape.texto,
  ].join("\n");

  return { html, text, headers: rodape.headers };
}

/**
 * O CABEÇALHO, com o menu.
 *
 * ─── Por que um menu num e-mail ────────────────────────────────────────────
 *
 * Quem abre o quinto e-mail de uma sequência não quer necessariamente o que
 * aquele e-mail oferece — quer, muitas vezes, uma coisa que ele leu no
 * segundo. Sem menu, o único caminho de volta ao site é o botão da ação, que
 * leva a UM lugar. Com menu, o e-mail vira uma porta em vez de um beco.
 *
 * ─── Por que `<a>` dentro de `<td>`, e não uma `<nav>` ────────────────────
 *
 * Cliente de e-mail não é navegador. O Outlook para Windows renderiza com o
 * motor do Word, que ignora flexbox, ignora `gap` e trata `<nav>` como
 * desconhecido. Uma linha de `<a>` separados por um caractere, dentro de um
 * `<td>`, é o que funciona nos três que importam — Gmail, Outlook e Apple
 * Mail — sem fallback e sem hack condicional.
 */
function cabecalho(nomeDoProduto: string, base: string): string {
  const item = (href: string, texto: string) =>
    `<a href="${esc(base + href)}" style="color:${TINTA.acentoFg};text-decoration:none;opacity:0.85">${esc(texto)}</a>`;

  return `<tr><td bgcolor="${TINTA.acento}" style="background-color:${TINTA.acento};border-radius:10px 10px 0 0;padding:18px 28px">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td align="left" style="font-size:17px;font-weight:700;letter-spacing:-0.2px;color:${TINTA.acentoFg}">${esc(nomeDoProduto)}</td>
            <td align="right" style="font-size:13px;line-height:1.4;color:${TINTA.acentoFg}">
              ${item("/#como-funciona", "Como funciona")}
              &nbsp;·&nbsp;
              ${item("/#precos", "Planos")}
              &nbsp;·&nbsp;
              ${item("/contato", "Falar com a gente")}
            </td>
          </tr>
        </table>
      </td></tr>`;
}

/**
 * O RODAPÉ — os links do site, e depois o bloco legal.
 *
 * ─── Por que os dois blocos são separados ──────────────────────────────────
 *
 * O de cima são links úteis; o de baixo é o "por que você está recebendo" com
 * o descadastro, que vem de `rodape.html` e é obrigatório. Misturá-los
 * esconderia o descadastro no meio de uma lista de links — e descadastro
 * escondido é o que faz a pessoa marcar como spam em vez de sair, o que custa
 * reputação de domínio inteira em troca de um contato que já tinha ido embora.
 *
 * O separador é uma `<td>` com altura e cor de fundo, não um `<hr>`: o
 * Outlook desenha `<hr>` com uma borda 3D dos anos noventa que nenhum CSS
 * remove.
 */
function pesDePagina(base: string, legal: string): string {
  const link = (href: string, texto: string) =>
    `<a href="${esc(base + href)}" style="color:${TINTA.leve};text-decoration:underline">${esc(texto)}</a>`;

  return `<tr><td style="padding:20px 28px 0">
        <p style="margin:0 0 10px;font-size:12px;line-height:1.9;color:${TINTA.leve}">
          ${link("/", "Site")} &nbsp;·&nbsp;
          ${link("/#precos", "Planos")} &nbsp;·&nbsp;
          ${link("/contato", "Contato")} &nbsp;·&nbsp;
          ${link("/legal", "Documentos")} &nbsp;·&nbsp;
          ${link("/legal/privacy", "Privacidade")} &nbsp;·&nbsp;
          ${link("/legal/terms", "Termos")}
        </p>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr><td height="1" bgcolor="${TINTA.borda}" style="background-color:${TINTA.borda};height:1px;line-height:1px;font-size:0">&nbsp;</td></tr>
        </table>
        <div style="padding-top:12px">${legal}</div>
      </td></tr>`;
}

/**
 * Escapa o que vai para o HTML.
 *
 * O texto daqui é nosso, mas o nome do produto vem do banco (`platform_branding`
 * é texto livre) e as URLs carregam token. Escapar sempre custa nada e remove a
 * categoria inteira.
 */
function esc(bruto: string): string {
  return bruto
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
