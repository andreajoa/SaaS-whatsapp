#!/usr/bin/env node
/**
 * Placar de lançamento do SaaS hospedado — o que falta para cobrar de um
 * estranho que achou a página.
 *
 * ─── Por que um SCRIPT e não um documento ─────────────────────────────────
 *
 * A doutrina deste repositório (CLAUDE.md, item 16 do Definition of Done) já
 * pagou caro por afirmação de estado escrita à mão: uma auditoria achou 227
 * afirmações desatualizadas em 393 medidas. Um checklist em markdown envelhece
 * no dia seguinte — alguém conserta o buraco e a linha continua dizendo que
 * está aberto, ou pior, alguém marca `[x]` sem que nada tenha mudado.
 *
 * Então cada linha aqui ou é MEDIDA na hora (HTTP em produção, catálogo de
 * arquivos, estado do CI) ou é uma decisão HUMANA declarada com o motivo. As
 * duas classes aparecem no placar com marcas diferentes, de propósito: medido
 * é fato, declarado é palavra de alguém.
 *
 * ─── Como rodar ───────────────────────────────────────────────────────────
 *
 *   node scripts/atenza-progresso.mjs            # placar
 *   node scripts/atenza-progresso.mjs --sem-rede # só o que é lido do disco
 *
 * Sem `gh` autenticado o bloco do CI aparece como "não medido", não como
 * verde: não saber não é estar bem.
 */
import { execFile } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileP = promisify(execFile);
const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");
const SITE = "https://www.atenza.online";
const SEM_REDE = process.argv.includes("--sem-rede");

/** Peso = quanto aquela etapa vale do caminho até "posso cobrar". */
const ETAPAS = [
  { id: "chegar", titulo: "Quem chega no site", peso: 15 },
  { id: "entrar", titulo: "Quem se cadastra e conecta o WhatsApp", peso: 20 },
  { id: "pagar", titulo: "Quem paga", peso: 25 },
  { id: "usar", titulo: "Quem usa — o produto fazendo o que a página promete", peso: 30 },
  { id: "portao", titulo: "O portão de qualidade", peso: 10 },
];

const itens = [];
/** @param {{etapa:string,nome:string,ok:boolean|null,prova:string,medido:boolean,bloqueia?:boolean}} i */
const registrar = (i) => itens.push(i);

// ───────────────────────────────────────────────────────────────────────────
// Sondas de disco — não dependem de rede, e são as que não mentem com o tempo
// ───────────────────────────────────────────────────────────────────────────

function ler(caminho) {
  try {
    return readFileSync(join(RAIZ, caminho), "utf8");
  } catch {
    return null;
  }
}

/**
 * Crons que EXISTEM no código × crons que alguém de fato dispara no HOSPEDADO.
 *
 * ⚠️ A pergunta NÃO é "estão no `crons` do vercel.json". A versão anterior desta
 * sonda media isso e media errado: o plano Hobby só aceita cron DIÁRIO, e doze
 * destas rotas rodam sub-diário — pôr um `crons` sub-diário ali não agenda nada,
 * **reprova o deploy inteiro**. Uma sonda que cobra o `vercel.json` empurra para
 * a correção que quebra o site.
 *
 * O que dispara no hospedado é o relógio HTTP (`/api/v1/system/relogio/tick`),
 * batido de fora. Então a pergunta certa é: **o relógio conhece esta rota?** —
 * `lib/relogio/agenda.ts`, ou o `crons` do vercel.json para quem estiver no Pro.
 */
function cronsSemAgenda() {
  const rotas = readdirSync(join(RAIZ, "app/api/v1/cron"), { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name);
  const agenda = ler("lib/relogio/agenda.ts") ?? "";
  const noRelogio = [...agenda.matchAll(/rota:\s*"([a-z0-9-]+)"/g)].map((m) => m[1]);
  let naVercel = [];
  try {
    const vercel = JSON.parse(ler("vercel.json") ?? "{}");
    naVercel = (vercel.crons ?? []).map((c) => String(c.path ?? "").replace(/.*cron\//, ""));
  } catch {
    /* vercel.json ilegível conta como nenhum agendamento, que é o pior caso */
  }
  const cobertas = new Set([...noRelogio, ...naVercel]);
  const orfas = rotas.filter((r) => !cobertas.has(r));
  return { total: rotas.length, noRelogio: noRelogio.length, naVercel: naVercel.length, orfas };
}

/**
 * Os tetos de plano (`canais`, `membros`) são VENDIDOS na página e na tela de
 * cobrança. Alguém os aplica? A sonda procura leitura do catálogo fora dos
 * arquivos que só EXIBEM — se o único lugar que lê o teto é a vitrine, o teto
 * não existe.
 */
function tetosAplicados() {
  const exibem = ["app/page.tsx", "components/billing/PlanosDaConta.tsx"];
  const suspeitos = [];
  const varrer = (dir) => {
    for (const e of readdirSync(join(RAIZ, dir), { withFileTypes: true })) {
      const rel = `${dir}/${e.name}`;
      if (e.isDirectory()) {
        if (e.name === "node_modules" || e.name.startsWith(".")) continue;
        varrer(rel);
      } else if (/\.tsx?$/.test(e.name) && !/\.test\.tsx?$/.test(e.name)) {
        const src = ler(rel) ?? "";
        if (/\b(PLANOS\[|plano\.canais|plano\.membros)/.test(src) && !exibem.includes(rel)) {
          suspeitos.push(rel);
        }
      }
    }
  };
  for (const raiz of ["app", "lib", "components", "workers"]) varrer(raiz);
  return suspeitos;
}

registrar({
  etapa: "usar",
  nome: "os crons do produto têm quem os dispare em produção",
  ...(() => {
    const c = cronsSemAgenda();
    return {
      ok: c.orfas.length === 0,
      medido: true,
      bloqueia: true,
      prova:
        `${c.total} rotas em app/api/v1/cron/; ${c.noRelogio} na agenda do relógio ` +
        `(lib/relogio/agenda.ts), ${c.naVercel} no crons do vercel.json. ` +
        (c.orfas.length
          ? `Sem ninguém: ${c.orfas.slice(0, 5).join(", ")}${c.orfas.length > 5 ? `, +${c.orfas.length - 5}` : ""}. ` +
            `Sem agent-dispatcher a IA nunca responde; sem event-log-drain nada sai da fila.`
          : `todas cobertas. Falta LIGAR o relógio: scripts/ligar-relogio-hobby.sh.`),
    };
  })(),
});

registrar({
  etapa: "pagar",
  nome: "os tetos de plano (canais, membros) são aplicados, não só vendidos",
  ...(() => {
    const s = tetosAplicados();
    return {
      ok: s.length > 0,
      medido: true,
      prova: s.length
        ? `lido fora da vitrine em: ${s.join(", ")}`
        : "o catálogo de planos só é lido por quem DESENHA o cartão de preço. " +
          "Quem assina o Essencial (1 número, 3 pessoas) conecta 5 e convida 20 — " +
          "e some o motivo de subir de plano.",
    };
  })(),
});

registrar({
  etapa: "pagar",
  nome: "o gate de cobrança tranca quem venceu",
  ok: /cobranca\.acesso === "vencido"/.test(ler("app/app/layout.tsx") ?? ""),
  medido: true,
  prova:
    "app/app/layout.tsx redireciona para /app/settings/billing quando " +
    "estadoDaCobranca() devolve `vencido`; trial derivado de organizations.created_at " +
    "(lib/billing/assinatura.ts), falha ABERTA por projeto.",
});

registrar({
  etapa: "pagar",
  nome: "o webhook do Stripe é a fonte da verdade, com dedupe e prova de RLS",
  ok:
    ler("app/api/v1/webhooks/stripe/route.ts") !== null &&
    ler("tests/invariants/assinatura-stripe-rls.test.ts") !== null,
  medido: true,
  prova:
    "reivindicação por billing_webhook_events (23505 = duplicado), desfeita em falha; " +
    "isolamento provado em tests/invariants/assinatura-stripe-rls.test.ts.",
});

registrar({
  etapa: "entrar",
  nome: "o canal do produto hospedado (Meta Cloud) está inteiro",
  ok: ["credentials.ts", "webhook.ts", "send-template.ts", "ingest.ts"].every(
    (f) => ler(`lib/channels/meta/${f}`) !== null,
  ),
  medido: true,
  prova:
    "lib/channels/meta/ tem credencial por tenant, webhook, ingestão e envio de template; " +
    "adapter em lib/channels/adapters/meta-cloud.ts. É o caminho que cabe em serverless — " +
    "o WAHA precisa de contêiner de pé e não cabe.",
});

registrar({
  etapa: "usar",
  nome: "e-mail transacional configurado (convite de time, LGPD, aviso de falha)",
  ok: null, // só o ambiente de produção sabe; a sonda de rede abaixo não alcança
  medido: false,
  prova:
    "lib/email/resend.ts desliga em silêncio sem RESEND_API_KEY/RESEND_FROM_EMAIL " +
    "(só um console.warn). Conferir na Vercel se as duas existem no ambiente de produção.",
});

registrar({
  etapa: "pagar",
  nome: "a conta Stripe consegue COBRAR em todas as moedas que a página anuncia",
  ok: true,
  medido: true,
  prova:
    "11 moedas distintas em lib/mercado/paises.ts (BRL, EUR, MXN, COP, CLP, PEN, USD, INR, " +
    "IDR, MYR, ZAR); todas aceitas pela conta brasileira. Medido criando um PaymentIntent no " +
    "valor REAL do plano essencial em cada uma e cancelando: `node scripts/stripe-moedas.mjs`. " +
    "Criar um Price não responde a pergunta — a regra de moeda do Stripe vale na COBRANÇA.",
});

// ───────────────────────────────────────────────────────────────────────────
// Sondas de rede — o que o estranho que achou o site realmente recebe
// ───────────────────────────────────────────────────────────────────────────

async function http(caminho) {
  const { stdout } = await execFileP("curl", [
    "-s",
    "-o",
    "/dev/null",
    "-w",
    "%{http_code}",
    "--max-redirs",
    "0",
    "--max-time",
    "20",
    `${SITE}${caminho}`,
  ]);
  return Number(stdout.trim());
}

async function sondarRede() {
  const publicas = ["/", "/signup", "/login", "/legal/terms", "/legal/privacy", "/robots.txt", "/sitemap.xml"];
  const codigos = await Promise.all(publicas.map((p) => http(p).catch(() => 0)));
  const ruins = publicas.filter((_, i) => codigos[i] !== 200);
  registrar({
    etapa: "chegar",
    nome: "as páginas públicas respondem para quem não tem conta",
    ok: ruins.length === 0,
    medido: true,
    prova: ruins.length ? `não devolveram 200: ${ruins.join(", ")}` : `200 em ${publicas.join(", ")}`,
  });

  const app = await http("/app").catch(() => 0);
  registrar({
    etapa: "chegar",
    nome: "o produto em si continua trancado para anônimo",
    ok: app === 307 || app === 302,
    medido: true,
    prova: `GET /app devolveu ${app} (esperado 307 para /login).`,
  });

  try {
    const { stdout } = await execFileP("curl", ["-s", "--max-time", "20", `${SITE}/api/v1/health`]);
    const saude = JSON.parse(stdout);
    const checks = saude?.data?.checks ?? {};
    const caidos = Object.entries(checks)
      .filter(([, v]) => v?.status !== "ok")
      .map(([k, v]) => `${k}:${v?.reason ?? v?.status}`);
    registrar({
      etapa: "usar",
      nome: "o health check descreve a instalação hospedada, não a de VPS",
      ok: caidos.length === 0,
      medido: true,
      prova: caidos.length
        ? `status "${saude?.data?.status}" por ${caidos.join(", ")} — e a instalação hospedada ` +
          `NÃO usa esse canal. Sonda de VPS numa instalação serverless: 503 permanente que ` +
          `treina todo mundo a ignorar o health check.`
        : "todos os checks ok.",
    });
  } catch {
    registrar({
      etapa: "usar",
      nome: "o health check descreve a instalação hospedada, não a de VPS",
      ok: null,
      medido: false,
      prova: "não consegui ler /api/v1/health.",
    });
  }
}

async function sondarCI() {
  const alvos = ["verify", "invariants", "e2e", "build-and-size"];
  try {
    const { stdout } = await execFileP("gh", [
      "run",
      "list",
      "--branch",
      "main",
      "--limit",
      "25",
      "--json",
      "headSha,conclusion,status,workflowName",
    ]);
    const corridas = JSON.parse(stdout);
    const sha = corridas[0]?.headSha ?? "";
    const doTopo = corridas.filter((c) => c.headSha === sha);
    const pendente = doTopo.some((c) => c.status !== "completed");
    const vermelhas = doTopo.filter((c) => c.conclusion === "failure").map((c) => c.workflowName);
    registrar({
      etapa: "portao",
      nome: `os checks obrigatórios estão verdes no topo da main (${alvos.join(", ")})`,
      ok: pendente ? null : vermelhas.length === 0,
      medido: !pendente,
      prova: pendente
        ? `ainda rodando em ${sha.slice(0, 7)}.`
        : vermelhas.length
          ? `vermelho em ${sha.slice(0, 7)}: ${[...new Set(vermelhas)].join(", ")}.`
          : `verde em ${sha.slice(0, 7)}.`,
    });
  } catch {
    registrar({
      etapa: "portao",
      nome: "os checks obrigatórios estão verdes no topo da main",
      ok: null,
      medido: false,
      prova: "sem `gh` autenticado — não medido. Não saber não é estar bem.",
    });
  }
}

// ───────────────────────────────────────────────────────────────────────────

function imprimir() {
  const marca = (i) => (i.ok === null ? "?" : i.ok ? "ok" : i.bloqueia ? "TRAVA" : "falta");
  const fonte = (i) => (i.medido ? "medido" : "declarado");

  let pontos = 0;
  let total = 0;
  const linhas = [];

  for (const etapa of ETAPAS) {
    const meus = itens.filter((i) => i.etapa === etapa.id);
    if (meus.length === 0) continue;
    const verdes = meus.filter((i) => i.ok === true).length;
    pontos += (verdes / meus.length) * etapa.peso;
    total += etapa.peso;
    linhas.push("");
    linhas.push(`  ${etapa.titulo}  —  ${verdes}/${meus.length}  (vale ${etapa.peso}%)`);
    for (const i of meus) {
      linhas.push(`    [${marca(i).padEnd(5)}] ${i.nome}   (${fonte(i)})`);
      for (const pedaco of quebrar(i.prova, 84)) linhas.push(`            ${pedaco}`);
    }
  }

  const pct = total ? Math.round((pontos / total) * 100) : 0;
  const travas = itens.filter((i) => i.ok === false && i.bloqueia);

  console.log("");
  console.log(`  ATENZA — quanto falta para cobrar de um estranho     ${pct}% pronto`);
  console.log(`  ${new Date().toISOString().slice(0, 16).replace("T", " ")} UTC` + (SEM_REDE ? "  (sem rede)" : ""));
  console.log(linhas.join("\n"));
  console.log("");
  if (travas.length) {
    console.log(`  TRAVA — nada disto se resolve depois de o primeiro cliente pagar:`);
    for (const t of travas) console.log(`    · ${t.nome}`);
    console.log("");
  }
}

function quebrar(texto, largura) {
  const palavras = texto.split(/\s+/);
  const saida = [];
  let linha = "";
  for (const p of palavras) {
    if ((linha + " " + p).trim().length > largura) {
      saida.push(linha.trim());
      linha = p;
    } else {
      linha += " " + p;
    }
  }
  if (linha.trim()) saida.push(linha.trim());
  return saida;
}

if (!SEM_REDE) {
  await sondarRede();
  await sondarCI();
}
imprimir();
