/**
 * AS DUAS TABELAS DE COBRANÇA SÃO ISOLADAS — E ISSO SE MEDE.
 *
 * ## O que se pagaria
 *
 * `org_subscriptions` diz quem pagou, quanto e até quando. Duas coisas podem
 * dar errado, e são opostas:
 *
 *   - **vazar para o lado**: o cliente A lendo o plano, o `stripe_customer_id`
 *     e a data de vencimento do cliente B. Num SaaS multi-tenant isso é a
 *     carteira de clientes do operador aberta para qualquer um deles;
 *   - **vazar para cima**: o admin de um tenant ESCREVENDO na própria linha.
 *     A anon key vai para o browser, e um `PATCH` no PostgREST trocando
 *     `plan` para `ilimitado` e `status` para `active` é uma assinatura de
 *     graça — sem passar pelo Stripe, sem passar pelo nosso servidor.
 *
 * `billing_webhook_events` é registro de PLATAFORMA, não dado de tenant: a
 * fila de eventos do Stripe do operador inteiro, com `event.id` e tipo. Nenhum
 * cliente tem o que ler ali, então a postura é deny-all — a mesma de
 * `platform_google_oauth` (0201) e das três tabelas de anúncio.
 *
 * ## Por que este arquivo existe em vez de duas linhas em `TABLES`
 *
 * Porque as duas tabelas pedem provas de tipos DIFERENTES, e `TABLES`
 * (`rls-isolation.test.ts`) só sabe fazer uma: "o usuário da org A conta ZERO
 * linhas da org B". Isso cabe em `org_subscriptions`, mas é METADE do que ela
 * precisa — o eixo perigoso dela é a ESCRITA, que aquele molde não exercita. E
 * não cabe de jeito nenhum em `billing_webhook_events`: sem privilégio, o
 * `countAs` de lá recebe `permission denied` em vez de `0`, o caso fica
 * vermelho, e a "correção" natural seria criar uma policy — isto é, passar a
 * servir pelo PostgREST justamente a tabela que não é de ninguém.
 *
 * Declarado em `PROVA_PROPRIA` de `rls-completude-varredura.test.ts`, que é o
 * que impede as duas de passarem sem prova nenhuma.
 *
 * ## Por que a escrita é medida pelo ESTADO, e não pelo erro
 *
 * A tentativa de escrita pode ser barrada de dois jeitos — `permission denied`
 * (o privilégio não existe) ou silêncio da RLS (o privilégio existe, nenhuma
 * policy permite, zero linhas afetadas) —, e qual dos dois depende de o
 * `ALTER DEFAULT PRIVILEGES ... GRANT ALL ON TABLES TO authenticated` do
 * baseline ter alcançado a tabela. Um teste que exigisse UM dos dois textos
 * ficaria vermelho no dia em que a outra defesa fosse a que segurou — vermelho
 * por MUDANÇA DE CAMADA, não por exposição. O que importa é invariável e é o
 * que se mede aqui: depois da tentativa, a linha continua a mesma.
 */
import { beforeAll, describe, expect, it } from "vitest";

import { motivoDoErro, sql } from "./psql-transporte";

// Namespace próprio (`eeeeeeee-`): `rls-isolation.test.ts` usa aaaa/bbbb e
// `gov-helpers.ts` usa cccc. O harness dá um banco novo por ARQUIVO, então não
// há corrida — a separação é para o dia em que alguém ler dois seeds juntos.
const ORG_A = "eeeeeeee-0000-4000-8000-00000000000a";
const ORG_B = "eeeeeeee-0000-4000-8000-00000000000b";
const MEMBRO_A = "eeeeeeee-1111-4000-8000-00000000000a";
const MEMBRO_B = "eeeeeeee-1111-4000-8000-00000000000b";

/** Conta linhas como `authenticated`, com o JWT de um usuário — o caminho do PostgREST. */
function contaComo(usuario: string, consulta: string): number {
  const saida = sql(`
    set role authenticated;
    select set_config('request.jwt.claims', '{"sub":"${usuario}"}', false);
    ${consulta}
  `);
  const ultima = saida.split("\n").at(-1)?.trim() ?? "";
  if (!/^\d+$/.test(ultima)) throw new Error(`saída inesperada do psql: ${saida}`);
  return Number(ultima);
}

/** Roda um comando sob um papel; devolve o erro do Postgres, ou `null` se passou. */
function erroSob(papel: string, comando: string): string | null {
  try {
    sql(`set role ${papel};\n${comando};\nreset role;`);
    return null;
  } catch (err) {
    return motivoDoErro(err);
  }
}

/** Tenta uma escrita como `authenticated` e ignora a recusa — quem julga é o estado depois. */
function tentaEscrever(usuario: string, dml: string): void {
  try {
    sql(`
      set role authenticated;
      select set_config('request.jwt.claims', '{"sub":"${usuario}"}', false);
      ${dml};
    `);
  } catch {
    // Barrado por privilégio ou por RLS. As duas contam como "não escreveu", e
    // é a asserção seguinte, sobre a linha, que diz se é verdade.
  }
}

/** O plano gravado hoje, lido sem papel nenhum (superusuário) — a verdade de controle. */
function planoDe(org: string): string {
  return sql(`select plan from public.org_subscriptions where organization_id = '${org}';`).trim();
}

function privilegiosDe(papel: string, tabela: string): string {
  return sql(`
    select coalesce(string_agg(distinct privilege_type, ',' order by privilege_type), 'NENHUM')
      from information_schema.role_table_grants
     where table_schema = 'public' and table_name = '${tabela}' and grantee = '${papel}';
  `).trim();
}

beforeAll(() => {
  sql(`
    insert into auth.users (id, email) values
      ('${MEMBRO_A}', 'assinatura-a@invariant.test'),
      ('${MEMBRO_B}', 'assinatura-b@invariant.test')
      on conflict do nothing;

    insert into public.organizations (id, slug, legal_name, display_name) values
      ('${ORG_A}', 'assinatura-a', 'Assinatura Invariant A', 'Assin A'),
      ('${ORG_B}', 'assinatura-b', 'Assinatura Invariant B', 'Assin B')
      on conflict do nothing;

    -- \`admin\`, de propósito: é o papel MAIS forte que um tenant tem. Se nem
    -- ele escreve, ninguém abaixo escreve — provar com \`agent\` deixaria o
    -- caminho de escalada justamente de quem tem motivo para tentar.
    insert into public.user_organizations (user_id, organization_id, role, accepted_at) values
      ('${MEMBRO_A}', '${ORG_A}', 'admin', now()),
      ('${MEMBRO_B}', '${ORG_B}', 'admin', now())
      on conflict do nothing;

    -- Só a org A assina. A B é o controle negativo: ela EXISTE, tem membro
    -- ativo, e ainda assim não pode ver nem tocar a assinatura da vizinha.
    insert into public.org_subscriptions
      (organization_id, plan, status, stripe_customer_id, stripe_subscription_id, current_period_end)
      values ('${ORG_A}', 'essencial', 'active', 'cus_invariant_a', 'sub_invariant_a', now() + interval '30 days')
      on conflict (organization_id) do update
        set plan = 'essencial', status = 'active';

    insert into public.billing_webhook_events (stripe_event_id, type, organization_id)
      values ('evt_invariant_a', 'customer.subscription.updated', '${ORG_A}')
      on conflict do nothing;
  `);
});

describe("org_subscriptions: quem paga não enxerga a conta do vizinho", () => {
  it("a tabela existe no baseline — controle positivo da sonda", () => {
    // Sem isto, uma tabela que nunca chegou ao apêndice do baseline faria todo
    // caso abaixo contar zero e passar — afirmando isolamento sobre o nada.
    const existe = sql(`
      select count(*) from information_schema.tables
       where table_schema = 'public' and table_name = 'org_subscriptions';
    `).trim();
    expect(existe, "org_subscriptions não está no baseline — o kit self-host não a cria").toBe("1");
  });

  it("o membro da org A LÊ a própria assinatura — controle positivo", () => {
    // O caso que impede o teste de passar por engano. Sem ele, uma policy que
    // negasse TUDO (ou um seed que não gravou nada) deixaria o caso cruzado
    // verde por ausência de dado, e nós leríamos isso como isolamento.
    expect(
      contaComo(
        MEMBRO_A,
        `select count(*) from public.org_subscriptions where organization_id = '${ORG_A}';`,
      ),
      "o próprio membro não lê a assinatura da sua organização — o gate de cobrança quebra para todo mundo",
    ).toBe(1);
  });

  it("o membro da org B NÃO lê a assinatura da org A", () => {
    expect(
      contaComo(
        MEMBRO_B,
        `select count(*) from public.org_subscriptions where organization_id = '${ORG_A}';`,
      ),
      "vazamento cross-tenant: plano, stripe_customer_id e vencimento do cliente vizinho",
    ).toBe(0);
  });

  it("o membro da org B não alcança a assinatura de A nem sem filtro", () => {
    // O caso acima filtra por `organization_id` e mediria zero mesmo com a RLS
    // desligada, se o banco tivesse só a linha de B. Aqui a consulta é a que um
    // atacante escreveria: sem WHERE.
    expect(
      contaComo(MEMBRO_B, "select count(*) from public.org_subscriptions;"),
      "o membro de B vê linhas que não são dele numa leitura sem filtro",
    ).toBe(0);
  });

  it("o `admin` do tenant NÃO se promove a ilimitado", () => {
    // O eixo que `TABLES` não exercita, e o mais caro: a anon key está no
    // browser, então este UPDATE é um `PATCH` que qualquer cliente pode montar.
    tentaEscrever(
      MEMBRO_A,
      `update public.org_subscriptions set plan = 'ilimitado', status = 'active'
         where organization_id = '${ORG_A}'`,
    );
    expect(
      planoDe(ORG_A),
      "o admin do tenant reescreveu o próprio plano — assinatura de graça, sem passar pelo Stripe",
    ).toBe("essencial");
  });

  it("o `admin` do tenant NÃO cria assinatura para uma organização sem nenhuma", () => {
    // O irmão do caso acima pelo outro lado: onde não há linha, o gate lê
    // "trial". Um INSERT aqui fabrica um `active` que nunca foi pago.
    tentaEscrever(
      MEMBRO_B,
      `insert into public.org_subscriptions (organization_id, plan, status)
         values ('${ORG_B}', 'ilimitado', 'active')`,
    );
    const quantas = sql(
      `select count(*) from public.org_subscriptions where organization_id = '${ORG_B}';`,
    ).trim();
    expect(quantas, "o admin do tenant inseriu a própria assinatura").toBe("0");
  });

  it("o `admin` do tenant NÃO apaga a assinatura para voltar ao trial", () => {
    // Apagar a linha é indistinguível de "nunca assinou", e o trial é DERIVADO
    // de `organizations.created_at` — numa org velha o DELETE não devolveria
    // trial nenhum, mas em toda org nova devolve, de graça, quantas vezes
    // quiser. É upgrade por exclusão.
    tentaEscrever(
      MEMBRO_A,
      `delete from public.org_subscriptions where organization_id = '${ORG_A}'`,
    );
    const quantas = sql(
      `select count(*) from public.org_subscriptions where organization_id = '${ORG_A}';`,
    ).trim();
    expect(quantas, "o admin do tenant apagou a própria assinatura").toBe("1");
  });

  it("`anon` não alcança a tabela — a chave que está no browser", () => {
    const erro = erroSob("anon", "select organization_id from public.org_subscriptions");
    expect(erro, "`anon` leu org_subscriptions sem erro — a tabela está exposta").not.toBeNull();
    expect(erro).toContain("permission denied");
  });

  it("`service_role` continua escrevendo — controle positivo de quem usa", () => {
    // Quem grava aqui é o webhook do Stripe. Se este privilégio sumir, a
    // cobrança para de registrar pagamento e o produto degrada em silêncio.
    const privilegios = privilegiosDe("service_role", "org_subscriptions");
    expect(privilegios).toContain("INSERT");
    expect(privilegios).toContain("UPDATE");
  });

  it("a RLS está LIGADA", () => {
    expect(
      sql(
        "select relrowsecurity from pg_class where oid = 'public.org_subscriptions'::regclass;",
      ).trim(),
      "RLS desligada: a policy de leitura vira decoração",
    ).toBe("t");
  });

  it("não existe policy PERMISSIVA de escrita — a ausência é a decisão, não um esquecimento", () => {
    // Os casos de escrita acima medem o efeito; este mede a CAUSA. Sem ele, o
    // dia em que alguém criar uma policy de update permissiva quebraria três
    // casos com mensagens sobre plano e trial, e nenhuma delas diria onde
    // mexer.
    //
    // `permissive = 'PERMISSIVE'` não é detalhe: esta versão do caso cobrava
    // policy NENHUMA e ficou vermelha contra o baseline real, que tem
    // `support_write_insert/update/delete` em org_subscriptions — três
    // RESTRICTIVE que o laço de suporte temporário (migration 0220) põe em
    // TODA tabela com `organization_id`. Uma RESTRICTIVE só ESTREITA: ela não
    // concede escrita a ninguém, e sem uma permissiva ao lado o resultado
    // continua sendo zero linhas escritas. Cobrar a ausência das duas
    // naturezas confundia "o suporte não pode escrever aqui" com "o tenant
    // pode" — e teria obrigado a abrir uma exceção no laço de suporte para
    // calar um teste que media a coisa errada.
    const escrita = sql(`
      select coalesce(string_agg(policyname || ':' || cmd, ',' order by policyname), 'NENHUMA')
        from pg_policies
       where schemaname = 'public' and tablename = 'org_subscriptions'
         and cmd <> 'SELECT'
         and permissive = 'PERMISSIVE';
    `).trim();
    expect(
      escrita,
      "apareceu policy PERMISSIVA de escrita em org_subscriptions: quem escreve aqui é o webhook do Stripe " +
        "(service_role), e uma policy para `authenticated` devolve ao tenant a caneta que assina o próprio plano",
    ).toBe("NENHUMA");
  });

  it("CONTROLE: a sonda ENXERGA as restritivas que existem", () => {
    // Sem esta metade, um `permissive = 'PERMISSIVE'` digitado errado (ou um
    // `pg_policies` sem a coluna) devolveria 'NENHUMA' para tudo e o caso
    // acima passaria por não medir nada.
    const restritivas = sql(`
      select count(*) from pg_policies
       where schemaname = 'public' and tablename = 'org_subscriptions'
         and cmd <> 'SELECT' and permissive = 'RESTRICTIVE';
    `).trim();
    expect(Number(restritivas), "o laço de suporte da 0220 deveria ter posto 3 aqui").toBe(3);
  });
});

describe("billing_webhook_events: registro de plataforma, de ninguém", () => {
  it("a tabela existe no baseline — controle positivo da sonda", () => {
    const existe = sql(`
      select count(*) from information_schema.tables
       where table_schema = 'public' and table_name = 'billing_webhook_events';
    `).trim();
    expect(existe, "billing_webhook_events não está no baseline").toBe("1");
  });

  it("`anon` não tem privilégio NENHUM", () => {
    expect(privilegiosDe("anon", "billing_webhook_events")).toBe("NENHUM");
  });

  it("`authenticated` também não — nenhuma tela lê a fila do Stripe", () => {
    // Deny-all e não policy de tenant: `organization_id` aqui é nullable de
    // propósito (o `event.id` chega ANTES de sabermos a organização), então uma
    // policy por tenant deixaria de fora justamente as linhas ainda não
    // resolvidas — que são as que contam o volume de assinaturas do operador.
    expect(privilegiosDe("authenticated", "billing_webhook_events")).toBe("NENHUM");
  });

  it("`authenticated` é BARRADO ao ler — permission denied, não zero linhas", () => {
    const erro = erroSob(
      "authenticated",
      "select stripe_event_id from public.billing_webhook_events",
    );
    expect(erro, "`authenticated` leu a fila de webhooks sem erro").not.toBeNull();
    expect(erro).toContain("permission denied");
  });

  it("`anon` é BARRADO ao ler", () => {
    const erro = erroSob("anon", "select stripe_event_id from public.billing_webhook_events");
    expect(erro, "`anon` leu a fila de webhooks sem erro").not.toBeNull();
    expect(erro).toContain("permission denied");
  });

  it("a RLS está LIGADA — o segundo degrau, para o dia em que o grant voltar", () => {
    expect(
      sql(
        "select relrowsecurity from pg_class where oid = 'public.billing_webhook_events'::regclass;",
      ).trim(),
      "RLS desligada: o revoke vira a única defesa",
    ).toBe("t");
  });

  it("não há policy nenhuma — servir esta tabela nunca foi a intenção", () => {
    const quantas = sql(`
      select count(*) from pg_policies
       where schemaname = 'public' and tablename = 'billing_webhook_events';
    `).trim();
    expect(quantas, "alguém criou policy: a fila passa a ser servida pelo PostgREST").toBe("0");
  });

  it("`service_role` continua com privilégio — é ele quem deduplica", () => {
    const privilegios = privilegiosDe("service_role", "billing_webhook_events");
    expect(privilegios).toContain("SELECT");
    expect(privilegios).toContain("INSERT");
    expect(privilegios).toContain("DELETE");
  });
});
