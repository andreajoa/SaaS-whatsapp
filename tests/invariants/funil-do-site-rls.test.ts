/**
 * O FUNIL DO SITE NÃO É DADO DE TENANT — E ISSO SE MEDE.
 *
 * ## O que se pagaria
 *
 * As cinco tabelas da migration 0240 guardam a lista de vendas do OPERADOR DA
 * PLATAFORMA: e-mail, telefone, cidade, o que a pessoa leu, quantas vezes abriu
 * qual e-mail, que plano assinou e por quanto. Isso não pertence a nenhum
 * tenant — pertence a quem vende o produto.
 *
 * O vazamento aqui não é "o cliente A vê o cliente B": é **o cliente A vê a
 * carteira inteira de clientes e de prospectos do operador**, com contato e
 * valor. Quem opera uma instalação que cobra tem concorrentes entre os próprios
 * clientes, e a `anon` key está no browser de todos eles — um `GET` no
 * PostgREST bastaria.
 *
 * Por isso a postura não é policy de tenant, é DENY-ALL: RLS ligada, zero
 * policies, privilégio revogado de `anon` E de `authenticated`, tudo para
 * `service_role`. A mesma de `billing_webhook_events` (0239) e de
 * `platform_google_oauth` (0201).
 *
 * ## Por que este arquivo existe em vez de cinco linhas em `TABLES`
 *
 * `TABLES` (`rls-isolation.test.ts`) sabe fazer uma prova só: "o usuário da org
 * A conta ZERO linhas da org B". Numa tabela sem privilégio, esse `countAs`
 * recebe `permission denied` em vez de `0`, o caso fica vermelho POR ACERTO, e
 * a correção natural de quem for consertar é criar uma policy — isto é, passar
 * a SERVIR pelo PostgREST justamente a tabela que não é de ninguém. A prova que
 * cabe aqui é a oposta: que `authenticated` não alcança a tabela **de jeito
 * nenhum**.
 *
 * Duas delas — `site_leads` e `checkout_tentativas` — carregam
 * `organization_id`, e é isso que as põe na varredura de completude
 * (`rls-completude-varredura.test.ts`). As outras três entram junto porque a
 * prova é a mesma e separá-las esconderia que o regime é único.
 *
 * ## A coluna `organization_id` aqui é PONTEIRO, não dono
 *
 * Ela existe para fechar o funil ("quem virou cliente, e de que organização"),
 * e é nullable com `on delete set null` justamente porque a maioria das linhas
 * nunca terá uma: o lead que não assinou é o caso comum. Uma policy por tenant
 * deixaria de fora exatamente essas linhas — as que contam o funil inteiro — e
 * serviria as outras a quem não devia vê-las. O pior dos dois mundos.
 *
 * ## Por que o controle positivo de existência vem primeiro
 *
 * Sem ele, uma tabela que nunca chegou ao apêndice do `baseline.sql` faria todo
 * caso abaixo passar por ausência: `privilegiosDe` devolveria `NENHUM` sobre o
 * nada, e nós leríamos isso como segurança. O `information_schema` é o
 * controle, e ele reprova a migration que esqueceu o baseline — que é o arquivo
 * que o self-hoster realmente aplica.
 */
import { describe, expect, it } from "vitest";

import { motivoDoErro, sql } from "./psql-transporte";

/**
 * As cinco da 0240. Todas com o MESMO regime, de propósito: qualquer uma que
 * precise de exceção um dia terá de sair desta lista à mão, e sair daqui é um
 * diff que quem revisa enxerga.
 */
const TABELAS_DO_FUNIL = [
  {
    tabela: "site_visits",
    guarda: "visita à página pública: origem, campanha, cidade e CEP de quem chegou",
  },
  {
    tabela: "site_leads",
    guarda: "a PESSOA: e-mail, telefone, empresa, cidade, plano assinado",
  },
  {
    tabela: "email_envios",
    guarda: "que e-mail foi para quem, e se abriu",
  },
  {
    tabela: "email_eventos",
    guarda: "cada abertura e cada clique, com o payload do provedor",
  },
  {
    tabela: "checkout_tentativas",
    guarda: "quem começou a pagar, por qual plano, em que moeda e quanto",
  },
] as const;

function privilegiosDe(papel: string, tabela: string): string {
  return sql(`
    select coalesce(string_agg(distinct privilege_type, ',' order by privilege_type), 'NENHUM')
      from information_schema.role_table_grants
     where table_schema = 'public' and table_name = '${tabela}' and grantee = '${papel}';
  `).trim();
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

describe.each(TABELAS_DO_FUNIL)("$tabela — deny-all ($guarda)", ({ tabela }) => {
  it("existe no baseline — controle positivo da sonda", () => {
    const existe = sql(`
      select count(*) from information_schema.tables
       where table_schema = 'public' and table_name = '${tabela}';
    `).trim();
    expect(
      existe,
      `${tabela} não está no supabase/baseline.sql — o kit self-host não a cria, ` +
        "e todo caso abaixo passaria sobre o nada",
    ).toBe("1");
  });

  it("`anon` não tem privilégio NENHUM", () => {
    expect(
      privilegiosDe("anon", tabela),
      `${tabela} ganhou privilégio para anon — a chave anônima está no browser de todo visitante`,
    ).toBe("NENHUM");
  });

  it("`authenticated` também não — nenhuma tela de tenant lê o funil do operador", () => {
    expect(
      privilegiosDe("authenticated", tabela),
      `${tabela} ganhou privilégio para authenticated — qualquer cliente logado lê a ` +
        "carteira de prospectos do operador, contato incluído",
    ).toBe("NENHUM");
  });

  it("`authenticated` é BARRADO ao ler — permission denied, não zero linhas", () => {
    // A diferença importa: "zero linhas" seria compatível com uma policy que
    // hoje não casa e amanhã casa. `permission denied` é o privilégio ausente,
    // que nenhuma policy nova ressuscita sozinha.
    const erro = erroSob("authenticated", `select * from public.${tabela} limit 1`);
    expect(erro, `\`authenticated\` leu ${tabela} sem erro`).not.toBeNull();
    expect(erro).toContain("permission denied");
  });

  it("`anon` é BARRADO ao ler", () => {
    const erro = erroSob("anon", `select * from public.${tabela} limit 1`);
    expect(erro, `\`anon\` leu ${tabela} sem erro`).not.toBeNull();
    expect(erro).toContain("permission denied");
  });

  it("`authenticated` é BARRADO ao ESCREVER", () => {
    // O eixo que o molde de `TABLES` não exercita. Numa tabela de captação, a
    // escrita é tão cara quanto a leitura pelo motivo oposto: quem insere
    // linha falsa envenena o funil e dispara e-mail nosso para endereço alheio
    // — o caminho mais curto para o domínio ser marcado como spam.
    const erro = erroSob("authenticated", `delete from public.${tabela}`);
    expect(erro, `\`authenticated\` apagou ${tabela} sem erro`).not.toBeNull();
    expect(erro).toContain("permission denied");
  });

  it("a RLS está LIGADA — o segundo degrau, para o dia em que o grant voltar", () => {
    // O `ALTER DEFAULT PRIVILEGES ... GRANT ALL ON TABLES TO authenticated` do
    // baseline alcança tabela criada depois dele. Se um apêndice futuro
    // esquecer o `revoke`, é a RLS sem policy que segura.
    expect(
      sql(`select relrowsecurity from pg_class where oid = 'public.${tabela}'::regclass;`).trim(),
      `RLS desligada em ${tabela}: o revoke vira a única defesa`,
    ).toBe("t");
  });

  it("não há policy nenhuma — servir esta tabela nunca foi a intenção", () => {
    const quantas = sql(`
      select count(*) from pg_policies
       where schemaname = 'public' and tablename = '${tabela}';
    `).trim();
    expect(
      quantas,
      `apareceu policy em ${tabela}: a tabela passa a ser servida pelo PostgREST, e ` +
        "o deny-all que este arquivo prova deixa de valer",
    ).toBe("0");
  });

  it("`service_role` continua escrevendo — controle positivo de quem usa", () => {
    // Sem este caso, o jeito mais fácil de deixar o arquivo verde seria revogar
    // tudo de todos — e o produto pararia de registrar visita, lead e envio em
    // silêncio, que é a falha que este funil existe para não ter.
    const privilegios = privilegiosDe("service_role", tabela);
    expect(privilegios).toContain("SELECT");
    expect(privilegios).toContain("INSERT");
    expect(privilegios).toContain("UPDATE");
  });
});

describe("o funil é reentrante por construção", () => {
  it("email_envios tem o unique (lead_id, mensagem) que torna o disparo idempotente", () => {
    // Não é detalhe de performance: é o que permite ao cron tentar o INSERT e
    // tratar `23505` como "já enviado". Sem ele, duas rodadas concorrentes —
    // ou uma que morreu depois do provedor aceitar e antes de gravar — mandam
    // o mesmo e-mail duas vezes para a mesma pessoa.
    const existe = sql(`
      select count(*) from pg_indexes
       where schemaname = 'public' and tablename = 'email_envios'
         and indexdef ilike '%unique%' and indexdef ilike '%lead_id%' and indexdef ilike '%mensagem%';
    `).trim();
    expect(
      existe,
      "sumiu o unique (lead_id, mensagem): o disparo deixa de ser idempotente e a " +
        "sequência de 15 e-mails passa a duplicar na primeira rodada concorrente",
    ).not.toBe("0");
  });

  it("email_eventos tem o unique do id do provedor — webhook reentregue não conta duas vezes", () => {
    const existe = sql(`
      select count(*) from pg_indexes
       where schemaname = 'public' and tablename = 'email_eventos'
         and indexdef ilike '%unique%' and indexdef ilike '%provider_event_id%';
    `).trim();
    expect(
      existe,
      "sumiu o unique de provider_event_id: o provedor reentrega webhook não " +
        "confirmado, e uma abertura vira três no painel",
    ).not.toBe("0");
  });

  it("site_leads tem o unique de e-mail em lower() — a mesma pessoa não entra duas vezes", () => {
    // Em `lower()` e não na coluna crua: quem digita `Joao@x.com` no pop-up e
    // `joao@x.com` no rodapé é a MESMA pessoa, e duas linhas significam a
    // sequência inteira em dobro na caixa dela.
    const existe = sql(`
      select count(*) from pg_indexes
       where schemaname = 'public' and tablename = 'site_leads'
         and indexdef ilike '%unique%' and indexdef ilike '%lower%';
    `).trim();
    expect(existe, "sumiu o unique de lower(email) em site_leads").not.toBe("0");
  });

  it("site_leads.token_descadastro é NOT NULL e único — o link de um clique nunca nasce quebrado", () => {
    // `List-Unsubscribe` de um clique é exigência do Gmail para remetente em
    // volume. Um token nullable produz, no primeiro lead semeado sem ele, um
    // link quebrado — e link de descadastro quebrado é a via mais rápida para
    // a reclamação de spam, que custa o domínio inteiro.
    const nulo = sql(`
      select is_nullable from information_schema.columns
       where table_schema = 'public' and table_name = 'site_leads'
         and column_name = 'token_descadastro';
    `).trim();
    expect(nulo, "token_descadastro virou nullable — link de descadastro quebrado").toBe("NO");

    const unico = sql(`
      select count(*) from pg_indexes
       where schemaname = 'public' and tablename = 'site_leads'
         and indexdef ilike '%unique%' and indexdef ilike '%token_descadastro%';
    `).trim();
    expect(unico, "token_descadastro sem unique: um token descadastraria duas pessoas").not.toBe("0");
  });

  it("checkout_tentativas tem o unique da sessão do Stripe — o webhook reencontra a linha", () => {
    const existe = sql(`
      select count(*) from pg_indexes
       where schemaname = 'public' and tablename = 'checkout_tentativas'
         and indexdef ilike '%unique%' and indexdef ilike '%stripe_session_id%';
    `).trim();
    expect(
      existe,
      "sumiu o unique de stripe_session_id: o webhook passa a criar uma linha nova " +
        "a cada reentrega, e o lembrete de carrinho sai para quem já pagou",
    ).not.toBe("0");
  });
});

describe("site_visits não guarda dado pessoal que não precisa guardar", () => {
  it("não existe coluna de IP", () => {
    // IP é dado pessoal pela LGPD: traz retenção, direito de acesso e dever de
    // eliminação atrelados — para responder "de que cidade veio?", que `city`
    // já responde sem nada disso. A ausência é a decisão, e este caso é o que
    // impede alguém de "completar o schema" um dia sem perceber o que aceita.
    const colunas = sql(`
      select coalesce(string_agg(column_name, ',' order by column_name), 'NENHUMA')
        from information_schema.columns
       where table_schema = 'public' and table_name = 'site_visits'
         and (column_name ilike '%ip%' or column_name ilike '%user_agent%');
    `).trim();
    expect(
      colunas,
      "site_visits ganhou coluna de IP ou user-agent: dado pessoal com dever legal " +
        "atrelado, para uma pergunta que city/country já respondem",
    ).toBe("NENHUMA");
  });

  it("não existe coluna de e-mail — o vínculo com a pessoa mora em site_leads", () => {
    const colunas = sql(`
      select coalesce(string_agg(column_name, ',' order by column_name), 'NENHUMA')
        from information_schema.columns
       where table_schema = 'public' and table_name = 'site_visits'
         and column_name ilike '%email%';
    `).trim();
    expect(
      colunas,
      "site_visits ganhou e-mail: a tabela é expurgável por idade, e o expurgo da " +
        "visita passaria a apagar o contato do lead junto",
    ).toBe("NENHUMA");
  });
});
