import { randomUUID } from "node:crypto";
import pg from "pg";
import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import { invariantConnection } from "../db/test-connection";

const pool = new pg.Pool(invariantConnection());
let db: pg.PoolClient;
const tenants = [1, 2].map(n => ({
  org: `02470000-0000-4000-8000-00000000000${n}`,
  user: `02470000-1000-4000-8000-00000000000${n}`,
  session: `02470000-2000-4000-8000-00000000000${n}`,
  contact: `02470000-3000-4000-8000-00000000000${n}`,
  conversation: `02470000-4000-4000-8000-00000000000${n}`,
  campaign: `02470000-5000-4000-8000-00000000000${n}`,
  recipient: `02470000-6000-4000-8000-00000000000${n}`,
  attempt: `02470000-7000-4000-8000-00000000000${n}`,
  message: `02470000-8000-4000-8000-00000000000${n}`,
}));
const A = tenants[0]!, B = tenants[1]!;
const tables = ["customer_campaigns", "customer_campaign_recipients", "customer_campaign_attempts"] as const;

async function denied(sql: string, params: unknown[], code: string) {
  await db.query("savepoint campaign_probe");
  let error: unknown;
  try { await db.query(sql, params); } catch (failure) { error = failure; }
  await db.query("rollback to savepoint campaign_probe");
  await db.query("release savepoint campaign_probe");
  expect(error).toMatchObject({ code });
}

beforeEach(async () => {
  db = await pool.connect();
  await db.query("begin");
  for (const t of tenants) {
    await db.query("insert into auth.users(id,email) values($1,$2)", [t.user, `${t.user}@example.invalid`]);
    await db.query("insert into organizations(id,slug,legal_name,display_name) values($1,$2,'Campaign synthetic','Campaign synthetic')", [t.org, `campaign-${t.org}`]);
    await db.query("insert into user_organizations(user_id,organization_id,role,accepted_at) values($1,$2,'manager',now())", [t.user,t.org]);
    await db.query("insert into channel_sessions(id,organization_id,waha_session_name,webhook_secret_encrypted) values($1,$2,$3,'\\x00'::bytea)", [t.session,t.org,`campaign-${t.org}`]);
    await db.query("insert into contacts(id,organization_id,display_name) values($1,$2,'Campaign synthetic')", [t.contact,t.org]);
    await db.query("insert into conversations(id,organization_id,contact_id,channel_session_id) values($1,$2,$3,$4)", [t.conversation,t.org,t.contact,t.session]);
    await db.query("insert into messages(id,organization_id,conversation_id,contact_id,channel_session_id,type,direction,status,body) values($1,$2,$3,$4,$5,'text','outbound','sent','Synthetic fixture')", [t.message,t.org,t.conversation,t.contact,t.session]);
    await db.query("insert into customer_campaigns(id,organization_id,name,channel_session_id,template_snapshot,snapshot_hash,created_by) values($1,$2,'Synthetic campaign',$3,'{}','synthetic',$4)", [t.campaign,t.org,t.session,t.user]);
    await db.query("insert into customer_campaign_recipients(id,organization_id,campaign_id,contact_id,conversation_id) values($1,$2,$3,$4,$5)", [t.recipient,t.org,t.campaign,t.contact,t.conversation]);
    await db.query("insert into customer_campaign_attempts(id,organization_id,recipient_id,intended_message_id) values($1,$2,$3,$4)", [t.attempt,t.org,t.recipient,randomUUID()]);
  }
});
afterEach(async () => {
  if (db) { try { await db.query("rollback"); } finally { db.release(); } }
});
afterAll(async () => { await pool.end(); });

describe("0247 — isolamento e integridade de campanhas no Postgres", () => {
  it("cada membro lê somente sua campanha, destinatário e tentativa", async () => {
    for (const t of tenants) {
      await db.query("set local role authenticated");
      await db.query("select set_config('request.jwt.claims',$1,true)", [JSON.stringify({ sub:t.user })]);
      for (const table of tables) {
        const { rows } = await db.query(`select organization_id from public.${table}`);
        expect(rows).toEqual([{ organization_id:t.org }]);
      }
    }
  });
  it.each(tables)("anon não lê %s", async table => {
    await db.query("set local role anon");
    await denied(`select * from public.${table}`, [], "42501");
  });
  it.each(tables)("nem manager altera diretamente %s", async table => {
    await db.query("set local role authenticated");
    await db.query("select set_config('request.jwt.claims',$1,true)", [JSON.stringify({ sub:A.user })]);
    await denied(`delete from public.${table} where organization_id=$1`, [A.org], "42501");
  });
  it("service_role não vincula sessão ou destinatários de outro tenant", async () => {
    await db.query("set local role service_role");
    await denied("update customer_campaigns set channel_session_id=$1 where id=$2", [B.session,A.campaign], "23503");
    for (const [column,id] of [["campaign_id",B.campaign],["contact_id",B.contact],["conversation_id",B.conversation]]) {
      await denied(`update customer_campaign_recipients set ${column}=$1 where id=$2`, [id,A.recipient], "23503");
    }
    await denied("update customer_campaign_attempts set recipient_id=$1 where id=$2", [B.recipient,A.attempt], "23503");
    await denied("update customer_campaign_attempts set message_id=$1 where id=$2", [B.message,A.attempt], "23503");
  });
  it("destinatário e intenção de envio não podem ser duplicados", async () => {
    await db.query("set local role service_role");
    await denied("insert into customer_campaign_recipients(organization_id,campaign_id,contact_id,conversation_id) values($1,$2,$3,$4)", [A.org,A.campaign,A.contact,A.conversation], "23505");
    await denied("insert into customer_campaign_attempts(organization_id,recipient_id,intended_message_id) values($1,$2,$3)", [A.org,A.recipient,randomUUID()], "23505");
    await db.query("update customer_campaign_attempts set state='failed',safe_to_retry=true where id=$1", [A.attempt]);
    const old = (await db.query("select intended_message_id from customer_campaign_attempts where id=$1", [A.attempt])).rows[0].intended_message_id;
    await denied("insert into customer_campaign_attempts(organization_id,recipient_id,intended_message_id) values($1,$2,$3)", [A.org,A.recipient,old], "23505");
    const next = await db.query("insert into customer_campaign_attempts(organization_id,recipient_id,intended_message_id) values($1,$2,$3) returning id", [A.org,A.recipient,randomUUID()]);
    expect(next.rowCount).toBe(1);
  });
});
