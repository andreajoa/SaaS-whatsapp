/**
 * `transportesEmUso` decide se o health check sonda o transporte de sessão — e
 * a decisão tem três desfechos, não dois.
 *
 * O caso que este arquivo existe para travar é o do meio: **não consegui
 * perguntar** não é **não uso**. Se os dois colapsarem no mesmo valor, um banco
 * momentaneamente fora do ar faz a sonda do transporte SUMIR do corpo da
 * resposta — e check ausente lê como check verde, que é a conclusão oposta à
 * disponível. O defeito seria invisível justamente durante um incidente.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const linhas = vi.hoisted(() => ({ dados: [] as { provider: string }[], erro: null as unknown }));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: () => ({
      select: () => ({
        is: () => ({
          limit: async () => ({ data: linhas.dados, error: linhas.erro }),
        }),
      }),
    }),
  }),
}));

import {
  esquecerTransportesEmUso,
  temTransporteProprio,
  transportesEmUso,
} from "./transportes-em-uso";

beforeEach(() => {
  esquecerTransportesEmUso();
  linhas.dados = [];
  linhas.erro = null;
});

describe("transportesEmUso — o que a instalação USA, não o que alguém configurou", () => {
  it("lista os providers com conexão viva, sem repetir", async () => {
    linhas.dados = [{ provider: "waha" }, { provider: "waha" }, { provider: "meta_cloud" }];

    const t = await transportesEmUso();

    expect(t.houveLeitura).toBe(true);
    expect([...t.providers].sort()).toEqual(["meta_cloud", "waha"]);
    expect(temTransporteProprio(t)).toBe(true);
  });

  it("instalação que só transporta pelo canal oficial NÃO pede a sonda do outro", async () => {
    linhas.dados = [{ provider: "meta_cloud" }];

    const t = await transportesEmUso();

    expect(t.houveLeitura).toBe(true);
    expect(temTransporteProprio(t)).toBe(false);
  });

  it("zero conexões é uma AFIRMAÇÃO — perguntei, e esta instalação não transporta nada", async () => {
    const t = await transportesEmUso();

    expect(t.houveLeitura).toBe(true);
    expect(t.providers.size).toBe(0);
  });

  it("erro do banco NÃO vira 'não uso' — vira 'não sei'", async () => {
    linhas.erro = { message: "connection refused" };

    const t = await transportesEmUso();

    // O conjunto vazio aqui é igual ao do caso anterior de propósito: é
    // `houveLeitura` que os separa, e é por isso que ele existe. Quem sonda lê
    // os dois campos; ler só o conjunto apagaria a distinção inteira.
    expect(t.providers.size).toBe(0);
    expect(t.houveLeitura).toBe(false);
  });

  it("a memória evita uma consulta por batida — e a rota é pública", async () => {
    linhas.dados = [{ provider: "meta_cloud" }];
    const primeira = await transportesEmUso(1_000);

    // Troca o que o banco devolveria: se a segunda chamada fosse ao banco, o
    // resultado mudaria.
    linhas.dados = [{ provider: "waha" }];
    const segunda = await transportesEmUso(1_000 + 59_000);

    expect(segunda).toBe(primeira);
    expect(temTransporteProprio(segunda)).toBe(false);
  });

  it("passados os 60 s, volta a perguntar — senão um canal novo demoraria a aparecer", async () => {
    linhas.dados = [{ provider: "meta_cloud" }];
    await transportesEmUso(1_000);

    linhas.dados = [{ provider: "meta_cloud" }, { provider: "waha" }];
    const depois = await transportesEmUso(1_000 + 61_000);

    expect(temTransporteProprio(depois)).toBe(true);
  });
});
