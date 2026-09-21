import { createHmac, timingSafeEqual } from "node:crypto";

import { env } from "@/lib/env";

/**
 * A PORTA DO PAINEL DO FUNIL — uma senha só, sem conta, sem tabela.
 *
 * ─── Por que este painel NÃO usa a sessão do produto ────────────────────────
 *
 * `/dashboard` mostra o livro-razão do OPERADOR: o e-mail, a cidade e o plano
 * de todo mundo que passou pelo site. Isso não é dado de tenant — é dado de
 * TODOS os tenants ao mesmo tempo, e as cinco tabelas de 0240 são deny-all por
 * isso. Pendurá-lo no login do produto o colocaria atrás de uma credencial que
 * existe para outra coisa: qualquer `admin` de organização que virasse platform
 * admin por engano leria a lista de clientes inteira. A separação é o ponto.
 *
 * ─── Por que não há tabela de usuários do painel ────────────────────────────
 *
 * Porque há UMA pessoa. Uma tabela traria cadastro, recuperação de senha,
 * e-mail de confirmação e uma segunda superfície de auth para manter — tudo
 * para servir um único login. A senha mora em `PAINEL_SENHA`, que é onde já
 * moram os outros segredos do deploy, e trocá-la é trocar uma variável de
 * ambiente. O cookie é assinado e não guarda nada: não há sessão para invalidar
 * porque não há sessão gravada em lugar nenhum. Trocar `PAINEL_SENHA` derruba
 * todos os cookies existentes de uma vez, que é exatamente o comportamento que
 * se quer de um "sair de todos os dispositivos".
 *
 * ─── Falha FECHADA, e o clone não ganha porta nenhuma ───────────────────────
 *
 * Sem `PAINEL_SENHA`, ou com senha curta demais, `painelHabilitado()` é falso e
 * a tela responde 404 — não "digite a senha". Um clone self-host que aplicou as
 * migrations tem as cinco tabelas (vazias) e NÃO deve ganhar de brinde uma
 * segunda tela de login exposta na internet. Tela de senha que existe em toda
 * instalação é alvo de força bruta em toda instalação, inclusive nas que nunca
 * vão usá-la.
 *
 * ─── Por que 24 caracteres e não 8 ──────────────────────────────────────────
 *
 * A senha é também a CHAVE do HMAC. Um segredo de 8 caracteres protegendo uma
 * assinatura é uma assinatura falsificável offline por quem já tem um cookie
 * válido. O piso é alto de propósito: quem opera isto tem um gerenciador de
 * senhas, não digita de cabeça.
 */

const COOKIE = "painel_funil";
const PISO_DA_SENHA = 24;
/** 12 horas. Um dia de trabalho, e o cookie morre antes do dia seguinte. */
const VALIDADE_SEG = 12 * 60 * 60;

export const COOKIE_DO_PAINEL = COOKIE;

/** A instalação tem painel? Sem isto verdadeiro, a tela não existe (404). */
export function painelHabilitado(): boolean {
  return env.PAINEL_SENHA.trim().length >= PISO_DA_SENHA;
}

/**
 * Compara duas strings em tempo constante.
 *
 * `a === b` em JavaScript sai no primeiro caractere diferente, e a diferença de
 * tempo entre "errou no primeiro" e "errou no último" é medível pela rede com
 * amostras suficientes. Com senha longa isso é academia; com o HMAC abaixo não
 * é, porque ali o atacante controla o valor comparado e pode iterar.
 */
function igualEmTempoConstante(a: string, b: string): boolean {
  const ba = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  // `timingSafeEqual` LANÇA quando os tamanhos diferem — e o próprio lançamento
  // vaza o tamanho. Comparar o hash de cada lado torna os dois sempre do mesmo
  // tamanho, e o tamanho do segredo deixa de ser observável.
  const ha = createHmac("sha256", "comparacao").update(ba).digest();
  const hb = createHmac("sha256", "comparacao").update(bb).digest();
  return timingSafeEqual(ha, hb);
}

/** A senha digitada é a senha da instalação? Falso quando não há painel. */
export function senhaConfere(digitada: string): boolean {
  if (!painelHabilitado()) return false;
  return igualEmTempoConstante(digitada, env.PAINEL_SENHA.trim());
}

function assinar(expiraEm: number): string {
  return createHmac("sha256", env.PAINEL_SENHA.trim())
    .update(`painel_funil|${expiraEm}`)
    .digest("hex");
}

/** O valor do cookie a gravar depois de a senha conferir. */
export function emitirCookie(agoraSeg: number = Math.floor(Date.now() / 1000)): {
  valor: string;
  maxAge: number;
} {
  const expiraEm = agoraSeg + VALIDADE_SEG;
  return { valor: `${expiraEm}.${assinar(expiraEm)}`, maxAge: VALIDADE_SEG };
}

/**
 * O cookie é nosso e ainda vale?
 *
 * A validade é conferida DEPOIS da assinatura, nunca antes: conferir primeiro o
 * prazo responderia "expirado" a um cookie forjado, contando ao atacante que o
 * formato dele está certo e que só falta a data.
 */
export function cookieVale(
  valor: string | undefined | null,
  agoraSeg: number = Math.floor(Date.now() / 1000),
): boolean {
  if (!painelHabilitado()) return false;
  const bruto = (valor ?? "").trim();
  const corte = bruto.indexOf(".");
  if (corte <= 0) return false;

  const expiraEm = Number(bruto.slice(0, corte));
  const assinatura = bruto.slice(corte + 1);
  if (!Number.isSafeInteger(expiraEm) || assinatura.length === 0) return false;
  if (!igualEmTempoConstante(assinatura, assinar(expiraEm))) return false;

  return expiraEm > agoraSeg;
}
