#!/usr/bin/env node
/**
 * A sonda que responde: ESTA conta do Stripe consegue cobrar NESTA moeda?
 *
 * ─── Por que a pergunta não é óbvia ───────────────────────────────────────
 *
 * A conta é brasileira. A documentação e todo artigo de blog dizem que
 * Colômbia, Chile, Peru e Argentina "não são suportados" — e dizem a verdade
 * sobre ABRIR uma conta lá, que é outra pergunta. Cobrar um cartão colombiano
 * em pesos colombianos com uma conta brasileira é permitido; a liquidação cai
 * em BRL com conversão. As duas frases convivem, e confundir uma com a outra
 * fecha mercado que estava aberto — foi o que quase aconteceu aqui.
 *
 * ─── Por que criar um Price NÃO responde ──────────────────────────────────
 *
 * `POST /v1/prices` com `currency=mxn` aceita em contas que depois RECUSAM a
 * cobrança: o catálogo é metadado, e a regra de moeda mora no momento da
 * cobrança. A única sonda honesta é um `PaymentIntent` — é o objeto que a
 * cobrança de verdade cria. Ele nasce `requires_payment_method`, sem cartão
 * nenhum encostado, e é CANCELADO na linha seguinte. Nada é cobrado de
 * ninguém, e nenhum objeto sobra: o cancelamento é verificado, não suposto.
 *
 * ─── Por que o valor não é 1 ──────────────────────────────────────────────
 *
 * O valor de cada sonda é o preço REAL do plano essencial naquele mercado,
 * lido de `lib/mercado/paises.ts`. Uma sonda de 1 centavo passaria por baixo
 * do mínimo de cobrança de várias moedas e devolveria erro de valor onde a
 * moeda estava boa — e, pior, passaria onde o valor real seria recusado.
 * Sondar com o número que vai ser cobrado é o que faz o verde valer.
 *
 * ─── Como rodar ───────────────────────────────────────────────────────────
 *
 *   STRIPE_SECRET_KEY=sk_... node scripts/stripe-moedas.mjs
 *   node scripts/stripe-moedas.mjs --sem-rede          # só a tabela do disco
 *   node scripts/stripe-moedas.mjs --moedas=cop,clp    # recorte
 *
 * Saída de processo: 0 se toda moeda pedida passou, 1 se alguma falhou.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");
const TABELA = join(RAIZ, "lib/mercado/paises.ts");
const SEM_REDE = process.argv.includes("--sem-rede");
const RECORTE = (process.argv.find((a) => a.startsWith("--moedas=")) ?? "")
  .slice("--moedas=".length)
  .split(",")
  .map((m) => m.trim().toLowerCase())
  .filter(Boolean);

/**
 * Lê os mercados do MESMO arquivo que a aplicação usa.
 *
 * Por regex e não por `import`: este arquivo é `.mjs` justamente para rodar sem
 * passar por compilador — o `tsx` não sobe neste macOS (dyld/_SecTrust…), e uma
 * sonda que depende do que está quebrado não é sonda. Uma cópia da lista aqui
 * dentro seria pior: ela divergiria da tabela no primeiro mercado novo, e a
 * sonda passaria a medir um mundo que não existe mais.
 */
function mercadosDoDisco() {
  const fonte = readFileSync(TABELA, "utf8");
  const bloco = fonte.slice(
    fonte.indexOf("export const MERCADOS"),
    fonte.indexOf("export const MERCADO_INTERNACIONAL"),
  );
  const achados = [
    ...bloco.matchAll(
      /pais:\s*"([A-Z]{2})"[\s\S]*?moeda:\s*"([A-Z]{3})"[\s\S]*?essencial:\s*(\d+)/g,
    ),
  ].map(([, pais, moeda, essencial]) => ({
    pais,
    moeda,
    essencial: Number(essencial),
  }));
  if (achados.length === 0) {
    throw new Error(
      `Nenhum mercado lido de ${TABELA}. A forma da tabela mudou — conserte a sonda antes de confiar nela.`,
    );
  }
  // Uma sonda por MOEDA, não por país: Portugal, Espanha e Itália são o mesmo
  // euro, e três PaymentIntents idênticos não medem nada a mais.
  const porMoeda = new Map();
  for (const m of achados) {
    if (!porMoeda.has(m.moeda)) porMoeda.set(m.moeda, { ...m, paises: [m.pais] });
    else porMoeda.get(m.moeda).paises.push(m.pais);
  }
  return [...porMoeda.values()];
}

async function stripe(chave, caminho, corpo) {
  const resposta = await fetch(`https://api.stripe.com/v1/${caminho}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${chave}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams(corpo ?? {}),
  });
  const dados = await resposta.json();
  return { ok: resposta.ok, dados };
}

/**
 * Cria e cancela. O cancelamento NÃO é `finally` decorativo: o `status` de
 * volta é conferido, e um cancelamento que não confirmou vira aviso na tela.
 * Objeto de sonda esquecido numa conta de produção é lixo que alguém acha
 * daqui a um ano sem saber o que é.
 */
async function sondar(chave, { moeda, essencial, paises }) {
  const { ok, dados } = await stripe(chave, "payment_intents", {
    amount: String(essencial),
    currency: moeda.toLowerCase(),
    "payment_method_types[]": "card",
    description: `sonda de moeda (${paises.join("/")}) — cancelada em seguida`,
    "metadata[sonda]": "atenza-moedas",
  });

  if (!ok) {
    return { moeda, paises, essencial, passou: false, detalhe: dados?.error?.message ?? "erro sem mensagem" };
  }

  const cancelamento = await stripe(chave, `payment_intents/${dados.id}/cancel`);
  const limpo = cancelamento.ok && cancelamento.dados?.status === "canceled";
  return {
    moeda,
    paises,
    essencial,
    passou: true,
    detalhe: limpo ? "" : `⚠ NÃO cancelou: ${dados.id} ficou em ${cancelamento.dados?.status ?? "?"}`,
  };
}

function dinheiro(valor, moeda) {
  const semCentavos = moeda === "CLP";
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: moeda,
    maximumFractionDigits: semCentavos ? 0 : 2,
  }).format(semCentavos ? valor : valor / 100);
}

async function main() {
  let mercados = mercadosDoDisco();
  if (RECORTE.length > 0) {
    mercados = mercados.filter((m) => RECORTE.includes(m.moeda.toLowerCase()));
    if (mercados.length === 0) {
      console.error(`Nenhuma moeda da tabela casa com --moedas=${RECORTE.join(",")}`);
      process.exit(1);
    }
  }

  console.log(`\nMercados em ${TABELA.replace(`${RAIZ}/`, "")}: ${mercados.length} moedas\n`);
  for (const m of mercados) {
    console.log(`  ${m.moeda}  ${m.paises.join(" ").padEnd(11)} essencial ${dinheiro(m.essencial, m.moeda)}`);
  }

  if (SEM_REDE) {
    console.log("\n--sem-rede: nada foi perguntado ao Stripe.\n");
    return;
  }

  const chave = process.env.STRIPE_SECRET_KEY;
  if (!chave) {
    console.error(
      "\nSTRIPE_SECRET_KEY ausente. Sem ela esta sonda não tem o que medir —" +
        " e um verde por ausência de teste é pior que um vermelho.\n",
    );
    process.exit(1);
  }
  console.log(
    `\nSondando com chave ${chave.startsWith("sk_live") ? "LIVE" : "de teste"}.` +
      " Cada moeda cria um PaymentIntent sem cartão e o cancela.\n",
  );

  let falhas = 0;
  for (const m of mercados) {
    const r = await sondar(chave, m);
    if (!r.passou) falhas += 1;
    const marca = r.passou ? "✓" : "✗";
    console.log(`  ${marca} ${r.moeda}  ${r.detalhe}`);
  }

  console.log(
    falhas === 0
      ? `\n${mercados.length} moedas: todas cobráveis por esta conta.\n`
      : `\n${falhas} de ${mercados.length} moedas RECUSADAS — tire-as de lib/mercado/paises.ts ou o checkout quebra na hora da venda.\n`,
  );
  process.exit(falhas === 0 ? 0 : 1);
}

main().catch((erro) => {
  console.error(erro);
  process.exit(1);
});
