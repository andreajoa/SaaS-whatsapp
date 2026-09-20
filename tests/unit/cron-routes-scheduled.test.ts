import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * TODA ROTA DE CRON EXISTE PARA SER CHAMADA POR ALGUÉM.
 *
 * O defeito que este teste existe para impedir já aconteceu e passou meses:
 * `risk-watcher`, `routing-worker` e `attendant-heartbeat` existiam, tinham
 * teste, tinham doc — e NINGUÉM AS AGENDAVA no self-host. O `risk-watcher` até
 * documentava a própria ausência no cabeçalho ("o kit precisa agendar esta
 * rota"), e a nota ficou lá sem virar linha de crontab.
 *
 * E o modo de falha é o pior: NÃO DÁ ERRO. A rota responde 200 quando alguém a
 * chama à mão, o teste unitário passa, o build passa — e a feature simplesmente
 * nunca acontece sozinha em produção. "Nada esfria" é indistinguível de "nada
 * esfriou ainda".
 *
 * A cerca é mecânica de propósito: compara o DIRETÓRIO (fonte da verdade do que
 * existe) com o CRONTAB do serviço `scheduler` (fonte da verdade do que roda).
 * Não pede disciplina de ninguém — quem criar uma rota nova sem agendá-la
 * descobre no CI, não seis meses depois pela ausência de um comportamento.
 */

const RAIZ = join(__dirname, "..", "..");
const DIR_CRON = join(RAIZ, "app", "api", "v1", "cron");
const VERCEL_JSON = join(RAIZ, "vercel.json");
// O crontab saiu do `command:` inline do compose e virou o entrypoint da imagem
// `deskcomm-scheduler` — o `apk add curl tzdata` a cada start amarrava a volta
// do cron à internet da VPS. A cerca continua a mesma; só a fonte da verdade do
// "o que roda" mudou de arquivo.
const CRONTAB = join(RAIZ, "docker", "scheduler", "entrypoint.sh");

/** As rotas que existem, lidas do disco — não de uma lista mantida à mão. */
function rotasNoCodigo(): string[] {
  return readdirSync(DIR_CRON, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort();
}

/** As rotas que o `scheduler` chama, extraídas do crontab embutido no compose. */
function rotasAgendadas(): string[] {
  const sh = readFileSync(CRONTAB, "utf8");
  const achadas = sh.matchAll(/api\/v1\/cron\/([a-z0-9-]+)/g);
  return [...new Set([...achadas].map((m) => m[1]!))].sort();
}

/**
 * Rota → cadência, como o crontab do `scheduler` a declara.
 *
 * Lê só as linhas do bloco `CRONS="…"` no formato `quando|timeout|rota`, e não
 * o arquivo inteiro: o entrypoint cita `api/v1/cron/` em prosa de comentário, e
 * `rotasAgendadas()` acima tolera isso porque só quer o conjunto. Aqui a
 * cadência importa, então a leitura é estrutural.
 */
function cadenciasDoScheduler(): Record<string, string> {
  const sh = readFileSync(CRONTAB, "utf8");
  const bloco = sh.match(/CRONS="\n([\s\S]*?)\n"/)?.[1] ?? "";
  const mapa: Record<string, string> = {};
  for (const linha of bloco.split("\n")) {
    const l = linha.trim();
    if (!l || l.startsWith("#")) continue;
    const [quando, , rota] = l.split("|");
    const nome = rota?.match(/api\/v1\/cron\/([a-z0-9-]+)/)?.[1];
    if (nome && quando) mapa[nome] = quando.trim();
  }
  return mapa;
}

/** Rota → cadência, como a Vercel a declara. */
function cadenciasDaVercel(): Record<string, string> {
  const v = JSON.parse(readFileSync(VERCEL_JSON, "utf8")) as {
    crons?: { path: string; schedule: string }[];
  };
  const mapa: Record<string, string> = {};
  for (const c of v.crons ?? []) {
    const nome = c.path.match(/\/api\/v1\/cron\/([a-z0-9-]+)/)?.[1];
    if (nome) mapa[nome] = c.schedule;
  }
  return mapa;
}

describe("rotas de cron × agendamento no self-host", () => {
  it("o apparato consegue enxergar as duas listas (controle positivo)", () => {
    // Sem isto, um `readdir` que devolvesse [] ou um regex que não casasse nada
    // fariam o teste principal passar por vacuidade — "zero rotas não agendadas"
    // seria verdade e não significaria nada.
    expect(rotasNoCodigo().length).toBeGreaterThan(0);
    expect(rotasAgendadas().length).toBeGreaterThan(0);
  });

  it("toda rota de cron do código está agendada no scheduler", () => {
    const naoAgendadas = rotasNoCodigo().filter((r) => !rotasAgendadas().includes(r));
    expect(
      naoAgendadas,
      `Rota(s) de cron sem linha no crontab de docker/scheduler/entrypoint.sh: ` +
        `${naoAgendadas.join(", ")}. Num self-host elas NUNCA rodam, e a feature não dá erro — ` +
        `só não acontece. Adicione a linha (ou apague a rota, se ela morreu).`,
    ).toEqual([]);
  });

  it("todo agendamento aponta para uma rota que existe", () => {
    // A direção contrária: linha de crontab para rota apagada bate 404 a cada
    // minuto, em silêncio, porque o `curl -fsS` manda tudo para /dev/null.
    const orfas = rotasAgendadas().filter((r) => !rotasNoCodigo().includes(r));
    expect(
      orfas,
      `Crontab agenda rota(s) que não existem mais: ${orfas.join(", ")}. ` +
        `O curl silencia o 404 e ninguém percebe.`,
    ).toEqual([]);
  });
});

/**
 * O MESMO CONJUNTO DE ROTAS, NO DEPLOY HOSPEDADO (Vercel).
 *
 * Aqui existem DOIS jeitos válidos de os crons rodarem, e exatamente um jeito
 * de eles não rodarem em silêncio:
 *
 *   (a) **Agendador externo** — o contêiner `deskcomm-scheduler` aponta o seu
 *       `APP_ORIGIN` para o domínio hospedado e chama as rotas por HTTP, igual
 *       faz na VPS. `vercel.json` NÃO declara `crons`. É o estado atual, e é o
 *       estado que o plano Hobby obriga (ver abaixo).
 *
 *   (b) **Vercel Cron** — `vercel.json` declara `crons`, e aí eles têm de bater
 *       com o crontab do scheduler rota a rota e cadência a cadência. Exige
 *       plano Pro.
 *
 * **Por que o Hobby obriga (a):** o Hobby aceita 100 cron jobs, mas o intervalo
 * mínimo é UMA VEZ POR DIA — e uma expressão mais frequente não é ignorada nem
 * degradada, ela REPROVA O DEPLOY ("Hobby accounts are limited to daily cron
 * jobs"). Doze das 22 rotas deste projeto rodam sub-diário. Declarar `crons` no
 * `vercel.json` sem estar no Pro, portanto, não quebra os crons: quebra o site
 * inteiro, no próximo push.
 *
 * O que esta cerca impede, então, é alguém "completar" o `vercel.json` com o
 * bloco `crons` — que parece a coisa certa e óbvia a fazer — e descobrir pelo
 * deploy vermelho. E, se o projeto subir para o Pro e o bloco passar a existir,
 * ela volta a cobrar a paridade com o scheduler, que é o defeito que o primeiro
 * bloco deste arquivo descreve.
 */
describe("crons no deploy hospedado (Vercel)", () => {
  /** Cadências que rodam mais de uma vez por dia — as que o Hobby reprova. */
  function subDiarias(mapa: Record<string, string>): string[] {
    return Object.entries(mapa)
      .filter(([, quando]) => {
        const [min, hora] = quando.split(/\s+/);
        // Roda >1×/dia se o minuto OU a hora tiverem curinga/passo.
        return /[*/,-]/.test(min ?? "") || /[*/,-]/.test(hora ?? "");
      })
      .map(([rota, quando]) => `${rota} ("${quando}")`);
  }

  it("o apparato enxerga o crontab do scheduler (controle positivo)", () => {
    // Sem isto, um regex que não casasse nada faria os testes abaixo passarem
    // por vacuidade — e "nenhuma divergência" seria verdade sem significar nada.
    expect(Object.keys(cadenciasDoScheduler()).length).toBeGreaterThan(0);
    expect(subDiarias(cadenciasDoScheduler()).length).toBeGreaterThan(0);
  });

  it("se vercel.json declara crons, eles batem com o scheduler rota a rota", () => {
    const vercel = cadenciasDaVercel();
    if (Object.keys(vercel).length === 0) return; // modo (a) — agendador externo
    const naVps = Object.keys(cadenciasDoScheduler()).sort();
    const naVercel = Object.keys(vercel).sort();
    expect(
      naVercel,
      `O 'crons' do vercel.json divergiu de docker/scheduler/entrypoint.sh. ` +
        `Só na VPS: [${naVps.filter((r) => !naVercel.includes(r)).join(", ")}]. ` +
        `Só na Vercel: [${naVercel.filter((r) => !naVps.includes(r)).join(", ")}].`,
    ).toEqual(naVps);
  });

  it("se vercel.json declara crons, a cadência é a mesma dos dois lados", () => {
    const vercel = cadenciasDaVercel();
    if (Object.keys(vercel).length === 0) return; // modo (a)
    const vps = cadenciasDoScheduler();
    const divergentes = Object.keys(vps)
      .filter((r) => vercel[r] && vercel[r] !== vps[r])
      .map((r) => `${r}: VPS "${vps[r]}" ≠ Vercel "${vercel[r]}"`);
    expect(divergentes, `Cadência divergente:\n  ${divergentes.join("\n  ")}`).toEqual([]);
  });

  it("vercel.json não declara cron sub-diário (reprovaria o deploy no Hobby)", () => {
    const proibidas = subDiarias(cadenciasDaVercel());
    expect(
      proibidas,
      `vercel.json declara cron(s) que rodam mais de 1×/dia: ${proibidas.join(", ")}.\n` +
        `No plano Hobby isso NÃO degrada — reprova o deploy inteiro com ` +
        `"Hobby accounts are limited to daily cron jobs".\n` +
        `Ou suba o projeto para o Pro, ou deixe o contêiner 'deskcomm-scheduler' ` +
        `com APP_ORIGIN apontando para o domínio (que é o arranjo atual).`,
    ).toEqual([]);
  });

  it("todo maxDuration do vercel.json aponta para um route.ts que existe", () => {
    // `functions` casa pelo caminho do ARQUIVO-FONTE, com o prefixo `app/`. Uma
    // chave errada não quebra o build: a Vercel só não aplica o limite, e a
    // rota volta ao padrão — silenciosamente, e só se nota no timeout em prod.
    const v = JSON.parse(readFileSync(VERCEL_JSON, "utf8")) as {
      functions?: Record<string, { maxDuration?: number }>;
    };
    const entradas = Object.entries(v.functions ?? {});
    expect(entradas.length, "vercel.json perdeu o bloco 'functions'").toBeGreaterThan(0);
    const orfas = entradas.map(([p]) => p).filter((p) => !existsSync(join(RAIZ, p)));
    expect(
      orfas,
      `vercel.json declara maxDuration para arquivo(s) inexistente(s): ${orfas.join(", ")}. ` +
        `A Vercel ignora a chave em silêncio e a rota volta ao timeout padrão.`,
    ).toEqual([]);
  });

  it("nenhum maxDuration passa do teto de 300s do Hobby", () => {
    const v = JSON.parse(readFileSync(VERCEL_JSON, "utf8")) as {
      functions?: Record<string, { maxDuration?: number }>;
    };
    const acima = Object.entries(v.functions ?? {})
      .filter(([, f]) => (f.maxDuration ?? 0) > 300)
      .map(([p, f]) => `${p} (${f.maxDuration}s)`);
    expect(acima, `Acima do teto de 300s do Hobby: ${acima.join(", ")}`).toEqual([]);
  });
});
