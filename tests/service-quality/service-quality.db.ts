/** Banco descartável COPIADO do molde do harness central. Nenhuma mudança no
 * baseline nem no banco compartilhado. Rodar após template instalado:
 * TEST_DB_PORT=<porta> TEST_DB_TEMPLATE=deskcomm_baseline
 * ./node_modules/.bin/vitest run --config tests/service-quality/vitest.db.config.ts --maxWorkers=1
 * A ausência do ambiente falha, não gera falso verde/skip de RLS.
 */
import { randomBytes } from "node:crypto";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
const template = process.env.TEST_DB_TEMPLATE;
if (!template || !process.env.TEST_DB_PORT || !/^[a-z0-9_]+$/.test(template))
  throw new Error(
    "SLA/CSAT DB: exporte TEST_DB_PORT e TEST_DB_TEMPLATE do harness central (banco descartável).",
  );
const database = `service_quality_${randomBytes(6).toString("hex")}`;
const base = {
  host: "127.0.0.1",
  port: Number(process.env.TEST_DB_PORT),
  user: "postgres",
  password: "postgres",
  max: 2,
};
const root = new pg.Pool({ ...base, database: "template1" });
// Limite no próprio servidor: um timeout do runner não deixa SQL em execução.
const db = new pg.Pool({ ...base, database, statement_timeout: 90000 });
let created = false;
const orgA = "aaaaaaaa-0000-4000-8000-000000000001",
  orgB = "bbbbbbbb-0000-4000-8000-000000000002";
const userA = "aaaaaaaa-1111-4000-8000-000000000001",
  userB = "bbbbbbbb-1111-4000-8000-000000000002",
  viewer = "cccccccc-1111-4000-8000-000000000003";
const convA = "aaaaaaaa-3333-4000-8000-000000000001",
  convB = "bbbbbbbb-3333-4000-8000-000000000002";
const hashA = "a".repeat(64),
  hashB = "b".repeat(64);
async function asRole(
  role: "authenticated" | "service_role",
  user: string | null,
  sql: string,
  params: unknown[] = [],
) {
  const client = await db.connect();
  try {
    await client.query("begin");
    await client.query(`set local role ${role}`);
    await client.query("select set_config('request.jwt.claims',$1,true)", [
      JSON.stringify({ sub: user }),
    ]);
    const result = await client.query(sql, params);
    await client.query("commit");
    return result;
  } catch (e) {
    await client.query("rollback");
    throw e;
  } finally {
    client.release();
  }
}
function asUser(user: string, sql: string, params: unknown[] = []) {
  return asRole("authenticated", user, sql, params);
}
function asService(sql: string, params: unknown[] = []) {
  return asRole("service_role", null, sql, params);
}
beforeAll(async () => {
  await root.query(`create database ${database} template ${template}`);
  created = true;
  // O template já contém o schema entregue pelo baseline. Não instalar aqui
  // uma migration avulsa: isso esconderia uma ausência no artefato integrado.
  await db.query("select organization_id from public.service_quality_policies limit 0");
  for (const [org, user, conv, tag] of [
    [orgA, userA, convA, "a"],
    [orgB, userB, convB, "b"],
  ]) {
    await db.query(
      "insert into organizations(id,legal_name,display_name,slug) values($1,$2,$2,$3)",
      [org, `Quality synthetic ${tag}`, `quality-${tag}`],
    );
    await db.query("insert into auth.users(id,email) values($1,$2)", [
      user,
      `quality-${tag}@example.invalid`,
    ]);
    await db.query(
      "insert into user_organizations(user_id,organization_id,role,accepted_at) values($1,$2,'manager',now())",
      [user, org],
    );
    const sess = (
      await db.query(
        "insert into channel_sessions(organization_id,waha_session_name,webhook_secret_encrypted) values($1,$2,'\\x00'::bytea) returning id",
        [org, `quality-${tag}`],
      )
    ).rows[0].id;
    const contact = (
      await db.query(
        "insert into contacts(organization_id,display_name) values($1,'Quality synthetic') returning id",
        [org],
      )
    ).rows[0].id;
    await db.query(
      "insert into conversations(id,organization_id,contact_id,channel_session_id,created_at,service_started_at) values($1,$2,$3,$4,'2026-10-08 12:00Z','2026-10-08 12:00Z')",
      [conv, org, contact, sess],
    );
    await db.query(
      "insert into service_quality_policies(organization_id,enabled,first_response_target_seconds,resolution_target_seconds) values($1,true,300,3600)",
      [org],
    );
    for (const [direction, status, at] of [
      ["outbound", "sent", "2026-10-08T11:59:00Z"],
      ["inbound", "sent", "2026-10-08T12:00:00Z"],
      ["outbound", "queued", "2026-10-08T12:01:00Z"],
      ["outbound", "failed", "2026-10-08T12:02:00Z"],
      ["outbound", "sent", "2026-10-08T12:04:00Z"],
      ["outbound", "delivered", "2026-10-08T12:05:00Z"],
    ]) {
      await db.query(
        "insert into messages(organization_id,conversation_id,contact_id,channel_session_id,type,direction,status,sent_at,body) values($1,$2,$3,$4,'text',$5,$6,$7,'Quality synthetic')",
        [org, conv, contact, sess, direction, status, at],
      );
    }
    // Revogação posterior torna a mensagem inelegível.
    await db.query(
      "insert into messages(organization_id,conversation_id,contact_id,channel_session_id,type,direction,status,sent_at,revoked_at,body) values($1,$2,$3,$4,'text','outbound','sent','2026-10-08 12:03Z',now(),'Quality revoked')",
      [org, conv, contact, sess],
    );
    await db.query(
      "insert into service_quality_surveys(organization_id,conversation_id,token_hash,expires_at) values($1,$2,$3,now()+interval '1 day')",
      [org, conv, tag === "a" ? hashA : hashB],
    );
  }
  await db.query("insert into auth.users(id,email) values($1,'quality-viewer@example.invalid')", [
    viewer,
  ]);
  await db.query(
    "insert into user_organizations(user_id,organization_id,role,accepted_at) values($1,$2,'viewer',now())",
    [viewer, orgA],
  );
});
afterAll(async () => {
  // Cancelar apenas consultas do nosso clone impede que um teste expirado
  // bloqueie pool.end(). Conexões ociosas são fechadas normalmente pelo pool.
  try {
    if (created)
      await root.query(
        "select pg_cancel_backend(pid) from pg_stat_activity where datname=$1 and state='active'",
        [database],
      );
    await db.end();
    if (created) await root.query(`drop database ${database} with (force)`);
  } finally {
    await root.end();
  }
});
describe("SLA/CSAT no Postgres real", () => {
  it("RLS não vaza metas/surveys entre organizações", async () => {
    expect(
      (await asUser(userA, "select organization_id from service_quality_policies")).rows,
    ).toEqual([{ organization_id: orgA }]);
    expect(
      (await asUser(userA, "select organization_id from service_quality_surveys")).rows,
    ).toEqual([{ organization_id: orgA }]);
    expect(
      (await asUser(userB, "select organization_id from service_quality_surveys")).rows,
    ).toEqual([{ organization_id: orgB }]);
    await expect(
      asUser(userA, "insert into service_quality_policies(organization_id) values($1)", [orgB]),
    ).rejects.toMatchObject({ code: "42501" });
  });
  it("viewer não altera política, não cria survey nem lê hashes", async () => {
    expect(
      (
        await asUser(
          viewer,
          "update service_quality_policies set enabled=false returning organization_id",
        )
      ).rowCount,
    ).toBe(0);
    await expect(
      asUser(viewer, "select fn_service_quality_request($1,$2,$3,now()+interval '1 day')", [
        orgA,
        convA,
        "c".repeat(64),
      ]),
    ).rejects.toMatchObject({ code: "42501" });
    await expect(
      asUser(userA, "select token_hash from service_quality_surveys"),
    ).rejects.toMatchObject({ code: "42501" });
  });
  it("nega vínculo cross-tenant em RPC e em escrita service role/FK", async () => {
    await expect(
      asUser(userA, "select fn_service_quality_request($1,$2,$3,now()+interval '1 day')", [
        orgA,
        convB,
        "d".repeat(64),
      ]),
    ).rejects.toMatchObject({ code: "P0002" });
    await expect(
      asService(
        "insert into service_quality_surveys(organization_id,conversation_id,token_hash,expires_at) values($1,$2,$3,now()+interval '1 day')",
        [orgA, convB, "e".repeat(64)],
      ),
    ).rejects.toMatchObject({ code: "23503" });
  });
  it("RPC de fatos respeita tenant e primeira resposta real não é fila/falha/revogada", async () => {
    const rows = (await asUser(userA, "select fn_service_quality_facts($1) as facts", [orgA]))
      .rows[0].facts;
    expect(rows).toHaveLength(1);
    expect(rows[0].conversation_id).toBe(convA);
    expect(Date.parse(rows[0].first_inbound_at)).toBe(Date.parse("2026-10-08T12:00:00Z"));
    expect(Date.parse(rows[0].first_response_at)).toBe(Date.parse("2026-10-08T12:04:00Z"));
    expect(
      (await asUser(userA, "select fn_service_quality_facts($1) as facts", [orgB])).rows[0].facts,
    ).toEqual([]);
  });
  it("agrega >1000 mensagens e reabertura exclui resposta de atendimento anterior", async () => {
    // Histórico volumoso de mensagens ainda na fila: não são resposta efetiva.
    // Mantém todos os triggers habilitados, sem reexecutar a abertura de demanda
    // a cada linha de uma fixture cujo objetivo é a agregação do relógio.
    await db.query(
      `insert into messages(organization_id,conversation_id,channel_session_id,contact_id,type,direction,status,sent_at,body)
   select c.organization_id,c.id,c.channel_session_id,c.contact_id,'text','outbound','queued',timestamptz '2026-10-08 12:00Z'+(n||' milliseconds')::interval,'Quality volume'
   from conversations c cross join generate_series(1,1005) n where c.id=$1`,
      [convA],
    );
    expect(
      Number(
        (await db.query("select count(*) as total from messages where conversation_id=$1", [convA]))
          .rows[0].total,
      ),
    ).toBeGreaterThan(1000);
    expect(
      Date.parse(
        (await asUser(userA, "select fn_service_quality_facts($1) as f", [orgA])).rows[0].f[0]
          .first_response_at,
      ),
    ).toBe(Date.parse("2026-10-08T12:04:00Z"));
    await db.query(
      "update conversations set service_started_at='2026-10-08 13:00Z',service_closed_at='2026-10-08 12:10Z' where id=$1",
      [convA],
    );
    const row = (await asUser(userA, "select fn_service_quality_facts($1) as f", [orgA])).rows[0]
      .f[0];
    expect(row.first_inbound_at).toBeNull();
    expect(row.first_response_at).toBeNull();
    expect(row.closed_at).toBeNull();
    await db.query("update conversations set service_started_at='2026-10-08 12:00Z' where id=$1", [
      convA,
    ]);
    // Somente este caso prepara >1000 mensagens com triggers reais. Mantém
    // os demais em 30s; SQL continua limitado a 90s pelo servidor.
  }, 120000);
  it("EXECUTE e tabelas fechados para anon; resgate só service_role", async () => {
    const row = (
      await db.query(`select has_function_privilege('anon','fn_service_quality_respond(text,integer,text)','EXECUTE') as anon,
   has_function_privilege('authenticated','fn_service_quality_respond(text,integer,text)','EXECUTE') as auth,
   has_function_privilege('service_role','fn_service_quality_respond(text,integer,text)','EXECUTE') as service,
   has_function_privilege('anon','fn_service_quality_request(uuid,uuid,text,timestamptz)','EXECUTE') as request,
   has_table_privilege('anon','service_quality_surveys','SELECT') as read`)
    ).rows[0];
    expect(row).toEqual({ anon: false, auth: false, service: true, request: false, read: false });
  });
  it("respostas concorrentes consomem uma única vez e só auditam o tenant do hash", async () => {
    const [a, b] = await Promise.all([
      asService("select fn_service_quality_respond($1,5,'synthetic') as r", [hashA]),
      asService("select fn_service_quality_respond($1,1,'replay') as r", [hashA]),
    ]);
    const accepted = [a.rows[0].r, b.rows[0].r].filter(Boolean);
    expect(accepted).toHaveLength(1);
    expect(accepted[0].organization_id).toBe(orgA);
    const stored = (
      await db.query(
        "select score,comment,responded_at from service_quality_surveys where token_hash=$1",
        [hashA],
      )
    ).rows[0];
    expect(stored.score).toBe(accepted[0].score);
    expect(stored.comment).toBe(accepted[0].score === 5 ? "synthetic" : "replay");
    expect(stored.responded_at).not.toBeNull();
    const audit = (
      await db.query(
        "select organization_id,metadata from api_audit_log where metadata->>'service_quality_action'='csat.responded'",
      )
    ).rows;
    expect(audit).toHaveLength(1);
    expect(audit[0].organization_id).toBe(orgA);
    expect(JSON.stringify(audit)).not.toContain("synthetic");
    expect(
      (await db.query("select score from service_quality_surveys where organization_id=$1", [orgB]))
        .rows[0].score,
    ).toBeNull();
  });
  it("não resgata expirado nem aceita score fora de 1..5 via RPC direta", async () => {
    await db.query(
      "update service_quality_surveys set created_at=now()-interval '2 days',expires_at=now()-interval '1 day' where organization_id=$1",
      [orgB],
    );
    expect(
      (await asService("select fn_service_quality_respond($1,5,null) as r", [hashB])).rows[0].r,
    ).toBeNull();
    await expect(
      asService("select fn_service_quality_respond($1,6,null)", [hashB]),
    ).rejects.toMatchObject({ code: "22023" });
  });
  it("resumo e feedback de conversa refletem a avaliação consumida", async () => {
    const result = (
      await asUser(userA, "select fn_service_quality_surveys($1,$2) as h", [orgA, [convA]])
    ).rows[0].h;
    expect(result.summary.csat_responses).toBe(1);
    expect(result.surveys[0].responded_at).not.toBeNull();
    expect(result.surveys[0].conversation_id).toBe(convA);
  });
});
