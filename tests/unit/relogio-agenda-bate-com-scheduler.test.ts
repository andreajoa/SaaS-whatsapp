import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { AGENDA, estaVencida, ultimaOcorrencia } from "@/lib/relogio/agenda";

/**
 * A AGENDA DO HOSPEDADO TEM DE SER A MESMA DA VPS.
 *
 * Existem duas listas do que roda e quando: o crontab do contêiner
 * `deskcomm-scheduler` (`docker/scheduler/entrypoint.sh`, que é o self-host) e
 * `lib/relogio/agenda.ts` (que é o deploy hospedado, onde não há contêiner
 * nenhum e o Hobby da Vercel só aceita cron diário).
 *
 * Duas listas é uma a mais, e a segunda existe porque a primeira é um arquivo
 * `sh` que não roda na Vercel. Então o que impede a divergência não é
 * disciplina: é este arquivo, que as compara nas DUAS direções, rota a rota e
 * cadência a cadência.
 *
 * O defeito que ele impede é o mesmo que `cron-routes-scheduled.test.ts`
 * descreve e que já custou meses: rota que existe, tem teste, tem doc — e
 * ninguém a chama. Não dá erro. A feature só não acontece.
 */

const RAIZ = join(__dirname, "..", "..");
const CRONTAB = join(RAIZ, "docker", "scheduler", "entrypoint.sh");
const DIR_CRON = join(RAIZ, "app", "api", "v1", "cron");

/** Lê o bloco `CRONS="…"` estruturalmente: `quando|timeout|rota[?query]`. */
function doScheduler(): { rota: string; cadencia: string; timeoutS: number; query?: string }[] {
  const sh = readFileSync(CRONTAB, "utf8");
  const bloco = sh.match(/CRONS="\n([\s\S]*?)\n"/)?.[1] ?? "";
  const linhas: { rota: string; cadencia: string; timeoutS: number; query?: string }[] = [];
  for (const bruta of bloco.split("\n")) {
    const l = bruta.trim();
    if (!l || l.startsWith("#")) continue;
    const [quando, timeout, caminho] = l.split("|");
    const m = caminho?.match(/api\/v1\/cron\/([a-z0-9-]+)(?:\?(.*))?$/);
    if (!m || !quando || !timeout) continue;
    linhas.push({
      rota: m[1]!,
      cadencia: quando.trim(),
      timeoutS: Number(timeout.trim()),
      ...(m[2] ? { query: m[2] } : {}),
    });
  }
  return linhas;
}

describe("agenda do relógio × crontab do scheduler", () => {
  it("o apparato enxerga as duas listas (controle positivo)", () => {
    // Sem isto, um regex que não casasse nada faria todos os testes abaixo
    // passarem por vacuidade — "nenhuma divergência" seria verdade e não
    // significaria coisa nenhuma.
    expect(doScheduler().length).toBeGreaterThan(10);
    expect(AGENDA.length).toBeGreaterThan(10);
  });

  it("as duas listas cobrem exatamente as mesmas rotas", () => {
    const vps = doScheduler()
      .map((l) => l.rota)
      .sort();
    const hospedado = AGENDA.map((t) => t.rota).sort();
    expect(
      hospedado,
      `A agenda do hospedado (lib/relogio/agenda.ts) divergiu do crontab do self-host. ` +
        `Só na VPS: [${vps.filter((r) => !hospedado.includes(r)).join(", ")}]. ` +
        `Só no hospedado: [${hospedado.filter((r) => !vps.includes(r)).join(", ")}].`,
    ).toEqual(vps);
  });

  it("e cobrem todas as rotas que existem no disco", () => {
    // A terceira lista, que é a autoridade: o diretório. `cron-routes-scheduled`
    // já compara o disco com o crontab; aqui a comparação é com a agenda do
    // hospedado, senão uma rota nova poderia entrar nos dois primeiros e ficar
    // de fora justamente do deploy que paga a conta.
    const noDisco = readdirSync(DIR_CRON, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => e.name)
      .sort();
    const naAgenda = AGENDA.map((t) => t.rota).sort();
    expect(naAgenda, `Rota(s) sem linha em lib/relogio/agenda.ts — no deploy hospedado elas NUNCA rodam.`).toEqual(
      noDisco,
    );
  });

  it("cadência, timeout e query são os mesmos dos dois lados", () => {
    const vps = new Map(doScheduler().map((l) => [l.rota, l]));
    const divergentes: string[] = [];
    for (const t of AGENDA) {
      const v = vps.get(t.rota);
      if (!v) continue;
      if (v.cadencia !== t.cadencia) divergentes.push(`${t.rota}: cadência VPS "${v.cadencia}" ≠ "${t.cadencia}"`);
      if (v.timeoutS !== t.timeoutS) divergentes.push(`${t.rota}: timeout VPS ${v.timeoutS}s ≠ ${t.timeoutS}s`);
      if ((v.query ?? "") !== (t.query ?? "")) {
        divergentes.push(`${t.rota}: query VPS "${v.query ?? ""}" ≠ "${t.query ?? ""}"`);
      }
    }
    expect(divergentes, `Divergência:\n  ${divergentes.join("\n  ")}`).toEqual([]);
  });

  it("toda cadência do crontab é de uma forma que `ultimaOcorrencia` entende", () => {
    // `ultimaOcorrencia` LANÇA em vez de adivinhar, de propósito. Esta é a
    // cerca que garante que o crontab não ganhou uma quinta forma (um
    // dia-da-semana, por exemplo) sem ninguém notar — o sintoma em produção
    // seria o tick inteiro estourando, todas as tarefas paradas.
    const agora = new Date();
    for (const l of doScheduler()) {
      expect(() => ultimaOcorrencia(l.cadencia, agora), `cadência "${l.cadencia}" (${l.rota})`).not.toThrow();
    }
  });
});

describe("a régua de vencimento", () => {
  const T = (iso: string) => new Date(iso);

  it("a cada N minutos: a janela é o múltiplo de N, não o relógio de quem bate", () => {
    // O ponto inteiro do módulo. Quem bate de graça atrasa: às 10:07 o tick
    // pergunta por `*/5` e a resposta tem de ser 10:05 — a janela que já
    // começou —, senão uma batida atrasada pula a janela em silêncio.
    expect(ultimaOcorrencia("*/5 * * * *", T("2026-09-20T10:07:41Z")).toISOString()).toBe("2026-09-20T10:05:00.000Z");
    expect(ultimaOcorrencia("*/15 * * * *", T("2026-09-20T10:59:59Z")).toISOString()).toBe("2026-09-20T10:45:00.000Z");
    expect(ultimaOcorrencia("*/30 * * * *", T("2026-09-20T10:00:00Z")).toISOString()).toBe("2026-09-20T10:00:00.000Z");
  });

  it("de hora em hora num minuto fixo: antes do minuto, a janela é a hora anterior", () => {
    expect(ultimaOcorrencia("17 * * * *", T("2026-09-20T10:16:00Z")).toISOString()).toBe("2026-09-20T09:17:00.000Z");
    expect(ultimaOcorrencia("17 * * * *", T("2026-09-20T10:17:00Z")).toISOString()).toBe("2026-09-20T10:17:00.000Z");
  });

  it("diária: antes da hora, a janela é a de ontem — e atravessa a virada do mês", () => {
    expect(ultimaOcorrencia("40 4 * * *", T("2026-09-20T03:00:00Z")).toISOString()).toBe("2026-09-19T04:40:00.000Z");
    expect(ultimaOcorrencia("40 4 * * *", T("2026-10-01T01:00:00Z")).toISOString()).toBe("2026-09-30T04:40:00.000Z");
  });

  it("recusa o que não entende em vez de adivinhar", () => {
    expect(() => ultimaOcorrencia("0 3 * * 1", new Date())).toThrow();
    expect(() => ultimaOcorrencia("* * *", new Date())).toThrow();
  });

  it("nunca rodou vence — instalação nova trabalha na primeira batida", () => {
    expect(estaVencida("0 12 * * *", null, T("2026-09-20T10:00:00Z"))).toBe(true);
  });

  it("rodar duas vezes na mesma janela não acontece, mesmo com duas batidas", () => {
    // Duas batidas em dois minutos seguidos numa cadência de 5 min: a segunda
    // tem de dizer "não". Sem isto, quem ligar o relógio no cron-job.org de
    // minuto a minuto rodaria a varredura de 5 min cinco vezes mais.
    const rodou = T("2026-09-20T10:05:10Z");
    expect(estaVencida("*/5 * * * *", rodou, T("2026-09-20T10:06:00Z"))).toBe(false);
    expect(estaVencida("*/5 * * * *", rodou, T("2026-09-20T10:10:00Z"))).toBe(true);
  });

  it("depois de uma queda longa, a tarefa se recupera — uma vez, não vinte", () => {
    // Doze horas parado. A diária tem de rodar UMA vez, não doze.
    const rodou = T("2026-09-19T04:40:05Z");
    expect(estaVencida("40 4 * * *", rodou, T("2026-09-20T16:00:00Z"))).toBe(true);
    const depois = T("2026-09-20T16:00:30Z");
    expect(estaVencida("40 4 * * *", depois, T("2026-09-20T16:01:00Z"))).toBe(false);
  });
});
