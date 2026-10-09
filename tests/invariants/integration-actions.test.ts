import { invariantConnection } from "../db/test-connection";
import pg from "pg";
import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";

/** 0244 — RLS/RBAC, RPC atômica e seleção de capacidades no SQL real.
 * Não importa executor HTTP, não decifra segredo real, não acessa serviço externo.
 * Seeds canônicos em transação, rollback por caso: nenhuma dependência de ordem.
 */
const pool = new pg.Pool(invariantConnection());
let db: pg.PoolClient;
const A = "02440000-0000-4000-8000-000000000001";
const B = "02440000-0000-4000-8000-000000000002";
const MANAGER_A = "02440000-1000-4000-8000-000000000001";
const MANAGER_B = "02440000-1000-4000-8000-000000000002";
const AGENT_A = "02440000-1000-4000-8000-000000000003";
const VIEWER_A = "02440000-1000-4000-8000-000000000004";
const ACTION_A = "02440000-2000-4000-8000-000000000001";
const ACTION_B = "02440000-2000-4000-8000-000000000002";
const ACTION_A2 = "02440000-2000-4000-8000-000000000003";
const DISABLED_A = "02440000-2000-4000-8000-000000000004";
const MISSING = "02440000-2000-4000-8000-000000000099";
const SESSION_A = "02440000-3000-4000-8000-000000000001";
const AI_A = "02440000-4000-4000-8000-000000000001";
const EXEC_A = "02440000-5000-4000-8000-000000000001";
const EXEC_B = "02440000-5000-4000-8000-000000000002";

function config(name = "Consultar pedido", enabled = true) {
  return { name, description: "Consulta sintética de teste", method: "GET",
    url_template: "https://orders.example.test/status", enabled, mutating: false,
    input_schema: { type: "object", properties: {}, additionalProperties: false },
    allowed_context_keys: [], public_headers: {}, body_template: null,
    result_mapping: {}, timeout_ms: 1000, max_response_bytes: 1024 };
}
async function scalar<T>(query: string, args: unknown[] = []): Promise<T> {
  const row = (await db.query(query, args)).rows[0];
  if (!row) throw new Error("Consulta de prova não retornou linha.");
  return Object.values(row)[0] as T;
}
async function asUser(user: string) {
  await db.query("set local role authenticated");
  await db.query("select set_config('request.jwt.claims',$1,true)", [JSON.stringify({ sub: user })]);
}
async function service() { await db.query("set local role service_role"); }
async function owner() { await db.query("reset role"); }
async function denied(query: string, args: unknown[], code: string, message?: string) {
  await db.query("savepoint negative_probe");
  let failure: unknown;
  try { await db.query(query, args); } catch (error) { failure = error; }
  await db.query("rollback to savepoint negative_probe");
  await db.query("release savepoint negative_probe");
  expect(failure).toMatchObject({ code });
  if (message) expect(failure).toMatchObject({ message: expect.stringContaining(message) });
}
async function save(id: string, configuration: object, headers: string[] | null, encrypted: Buffer | null, create = false, org = A) {
  return scalar<string>("select public.fn_save_integration_action($1,$2,$3::jsonb,$4::text[],$5::bytea,$6)",
    [org,id,JSON.stringify(configuration),headers,encrypted,create]);
}
async function version(ids: (string | null)[] = [], status = "draft") {
  return scalar<string>(`insert into public.ai_agent_versions
    (organization_id,agent_id,version_number,system_prompt,provider,model,channel_session_id,status,integration_action_ids)
    values($1,$2,1,'Prompt sintético','anthropic','claude-sonnet-4-6',$3,$4,$5::uuid[]) returning id`,
    [A,AI_A,SESSION_A,status,ids]);
}

beforeEach(async () => {
  db = await pool.connect();
  await db.query("begin");
  await db.query(`
    insert into auth.users(id,email) values
      ('${MANAGER_A}','action-manager-a@invariant.test'),('${MANAGER_B}','action-manager-b@invariant.test'),
      ('${AGENT_A}','action-agent-a@invariant.test'),('${VIEWER_A}','action-viewer-a@invariant.test');
    insert into public.organizations(id,slug,legal_name,display_name) values
      ('${A}','actions-0244-a','Ações sintéticas A','Ações A'),
      ('${B}','actions-0244-b','Ações sintéticas B','Ações B');
    insert into public.user_organizations(user_id,organization_id,role,accepted_at) values
      ('${MANAGER_A}','${A}','manager',now()),('${MANAGER_B}','${B}','manager',now()),
      ('${AGENT_A}','${A}','agent',now()),('${VIEWER_A}','${A}','viewer',now());
    insert into public.channel_sessions(id,organization_id,waha_session_name,webhook_secret_encrypted)
      values('${SESSION_A}','${A}','actions-0244-synthetic','\\x01');
    insert into public.ai_agents(id,organization_id,name,system_prompt)
      values('${AI_A}','${A}','Agente sintético','Prompt sintético');
  `);
  await service();
  await save(ACTION_A,config(),["Authorization"],Buffer.from([1,2,3]),true);
  await save(ACTION_A2,config("Consultar estoque"),[],null,true);
  await save(DISABLED_A,config("Ação desativada",false),[],null,true);
  await save(ACTION_B,config("Pedido do tenant B"),["X-Api-Key"],Buffer.from([4,5,6]),true,B);
  await db.query(`insert into public.integration_action_executions
    (id,organization_id,action_id,action_name,request_id,source,state,result)
    values($1,$2,$3,'Consultar pedido',gen_random_uuid(),'agent','succeeded','{"status":"paid"}'),
      ($4,$5,$6,'Pedido B',gen_random_uuid(),'agent','succeeded','{"status":"pending"}')`,
    [EXEC_A,A,ACTION_A,EXEC_B,B,ACTION_B]);
  await owner();
});
afterEach(async () => { if (db) { try { await db.query("rollback"); } finally { db.release(); } } });
afterAll(async () => { await pool.end(); });

describe("0244 — RLS e RBAC sem bypass de service_role", () => {
  it("gestores veem suas ações/execuções e nenhuma da organização vizinha", async () => {
    for (const [user, own, other] of [[MANAGER_A,A,B],[MANAGER_B,B,A]]) {
      await asUser(user!);
      for (const table of ["integration_actions", "integration_action_executions"]) {
        expect(await scalar(`select count(*)::int from public.${table} where organization_id=$1`, [own])).toBeGreaterThan(0);
        expect(await scalar(`select count(*)::int from public.${table} where organization_id=$1`, [other])).toBe(0);
      }
    }
  });

  it("gestor edita ação própria, mas não edita, apaga, transfere ou insere ação no vizinho", async () => {
    await asUser(MANAGER_A);
    expect((await db.query("update public.integration_actions set configuration=$1 where id=$2 returning id", [config("Editada na própria org"),ACTION_A])).rowCount).toBe(1);
    expect((await db.query("update public.integration_actions set configuration=$1 where id=$2 returning id", [config("Ataque"),ACTION_B])).rowCount).toBe(0);
    expect((await db.query("delete from public.integration_actions where id=$1 returning id", [ACTION_B])).rowCount).toBe(0);
    await denied("update public.integration_actions set organization_id=$1 where id=$2", [B,ACTION_A], "42501");
    await denied("insert into public.integration_actions(organization_id,configuration) values($1,$2)", [B,config()], "42501");
    await owner();
    expect(await scalar("select configuration->>'name' from public.integration_actions where id=$1", [ACTION_B])).toBe("Pedido do tenant B");
  });

  it("atendente lê execução própria, mas não configuração; viewer não lê nenhuma das duas", async () => {
    await asUser(AGENT_A);
    expect(await scalar("select count(*)::int from public.integration_action_executions where id=$1", [EXEC_A])).toBe(1);
    expect(await scalar("select count(*)::int from public.integration_action_executions where id=$1", [EXEC_B])).toBe(0);
    expect(await scalar("select count(*)::int from public.integration_actions")).toBe(0);
    expect((await db.query("update public.integration_actions set configuration=$1 where id=$2 returning id", [config("Não permitida"),ACTION_A])).rowCount).toBe(0);
    await denied("insert into public.integration_actions(organization_id,configuration) values($1,$2)", [A,config()], "42501");
    await asUser(VIEWER_A);
    expect(await scalar("select count(*)::int from public.integration_actions")).toBe(0);
    expect(await scalar("select count(*)::int from public.integration_action_executions")).toBe(0);
  });

  it("nem gestor lê credencial cifrada ou forja prova de execução", async () => {
    await asUser(MANAGER_A);
    await denied("select * from public.integration_action_credentials", [], "42501");
    await denied("update public.integration_action_executions set state='failed' where id=$1", [EXEC_A], "42501");
    await denied("insert into public.integration_action_executions(organization_id,action_name,request_id,source,state) values($1,'Forjada',gen_random_uuid(),'manual','succeeded')", [A], "42501");
    await owner();
    expect(await scalar("select state from public.integration_action_executions where id=$1", [EXEC_A])).toBe("succeeded");
  });

  it.each(["integration_actions", "integration_action_credentials", "integration_action_executions"])("anon não lê %s", async (table) => {
    await db.query("set local role anon");
    await denied(`select * from public.${table}`, [], "42501");
  });

  it("RPC de salvamento só pode ser executada pelo serviço; triggers não são RPC pública", async () => {
    const signature = "public.fn_save_integration_action(uuid,uuid,jsonb,text[],bytea,boolean)";
    for (const role of ["anon", "authenticated"]) {
      expect(await scalar("select has_function_privilege($1,$2,'execute')", [role,signature])).toBe(false);
      expect(await scalar("select has_function_privilege($1,'public.fn_validate_agent_integration_actions()','execute')", [role])).toBe(false);
      await db.query(`set local role ${role}`);
      await denied("select public.fn_save_integration_action($1,$2,$3,null,null,false)", [A,ACTION_A,config()], "42501");
      await owner();
    }
    expect(await scalar("select has_function_privilege('service_role',$1,'execute')", [signature])).toBe(true);
    await service();
    expect(await save(ACTION_A,config("Serviço autorizado"),null,null)).toBe(ACTION_A);
  });
});

describe("0244 — RPC atômica e credencial vinculada ao tenant", () => {
  it("edição com header_names null preserva nomes e credencial; array vazio remove ambos", async () => {
    await service();
    await save(ACTION_A,config("Nova descrição"),null,null);
    expect(await scalar("select credential_header_names from public.integration_actions where id=$1", [ACTION_A])).toEqual(["Authorization"]);
    expect(await scalar("select encode(headers_encrypted,'hex') from public.integration_action_credentials where action_id=$1", [ACTION_A])).toBe("010203");
    await save(ACTION_A,config("Sem autenticação"),[],null);
    expect(await scalar("select credential_header_names from public.integration_actions where id=$1", [ACTION_A])).toEqual([]);
    expect(await scalar("select count(*)::int from public.integration_action_credentials where action_id=$1", [ACTION_A])).toBe(0);
  });

  it("troca de configuração e credencial é atômica: credencial ausente não deixa edição parcial", async () => {
    await service();
    await denied("select public.fn_save_integration_action($1,$2,$3,$4,null,false)",
      [A,ACTION_A,config("Edição que deve reverter"),["X-New-Key"]], "23514", "encrypted_credentials_required");
    expect(await scalar("select configuration->>'name' from public.integration_actions where id=$1", [ACTION_A])).toBe("Consultar pedido");
    expect(await scalar("select credential_header_names from public.integration_actions where id=$1", [ACTION_A])).toEqual(["Authorization"]);
    expect(await scalar("select encode(headers_encrypted,'hex') from public.integration_action_credentials where action_id=$1", [ACTION_A])).toBe("010203");
    await save(ACTION_A,config("Rotacionada"),["X-New-Key"],Buffer.from([7,8,9]));
    expect(await scalar("select encode(headers_encrypted,'hex') from public.integration_action_credentials where action_id=$1", [ACTION_A])).toBe("070809");
  });

  it("falha de credencial na criação reverte a própria ação", async () => {
    await service();
    await denied("select public.fn_save_integration_action($1,$2,$3,$4,null,true)", [A,MISSING,config(),["Authorization"]], "23514", "encrypted_credentials_required");
    expect(await scalar("select count(*)::int from public.integration_actions where id=$1", [MISSING])).toBe(0);
  });

  it("RPC de edição não altera ação/credencial de outro tenant mesmo com service_role", async () => {
    await service();
    await denied("select public.fn_save_integration_action($1,$2,$3,$4,$5,false)",
      [A,ACTION_B,config("Vazamento"),["Authorization"],Buffer.from([9])], "P0002", "integration_action_not_found");
    expect(await scalar("select configuration->>'name' from public.integration_actions where id=$1", [ACTION_B])).toBe("Pedido do tenant B");
    expect(await scalar("select encode(headers_encrypted,'hex') from public.integration_action_credentials where action_id=$1", [ACTION_B])).toBe("040506");
  });

  it("FK composta veta credencial e execução apontando para ação de outro tenant", async () => {
    await service();
    await denied("insert into public.integration_action_credentials(action_id,organization_id,headers_encrypted) values($1,$2,$3)", [ACTION_A2,B,Buffer.from([1])], "23503");
    await denied("insert into public.integration_action_executions(organization_id,action_id,action_name,request_id,source,state) values($1,$2,'Ataque',gen_random_uuid(),'agent','running')", [A,ACTION_B], "23503");
  });

  it("apagar ação remove credencial, preserva prova histórica e sua organização", async () => {
    await service();
    await db.query("delete from public.integration_actions where id=$1 and organization_id=$2", [ACTION_A,A]);
    expect(await scalar("select count(*)::int from public.integration_action_credentials where action_id=$1", [ACTION_A])).toBe(0);
    expect((await db.query("select organization_id,action_id,action_name,state from public.integration_action_executions where id=$1", [EXEC_A])).rows).toEqual([
      { organization_id: A, action_id: null, action_name: "Consultar pedido", state: "succeeded" },
    ]);
  });
});

describe("0244 — seleção explícita e imutabilidade da versão", () => {
  it("versão sem seleção mantém allowlist vazia mesmo existindo ações habilitadas", async () => {
    const id = await scalar<string>(`insert into public.ai_agent_versions
      (organization_id,agent_id,version_number,system_prompt,provider,model,channel_session_id)
      values($1,$2,1,'Prompt sintético','anthropic','claude-sonnet-4-6',$3) returning id`, [A,AI_A,SESSION_A]);
    expect(await scalar("select integration_action_ids from public.ai_agent_versions where id=$1", [id])).toEqual([]);
  });

  it.each([
    ["tenant vizinho", [ACTION_B]], ["inexistente", [MISSING]],
    ["desabilitada", [DISABLED_A]], ["duplicada", [ACTION_A,ACTION_A]], ["null", [null]],
  ] as const)("inserção veta seleção %s", async (_name, ids) => {
    await denied(`insert into public.ai_agent_versions
      (organization_id,agent_id,version_number,system_prompt,provider,model,channel_session_id,integration_action_ids)
      values($1,$2,1,'Prompt sintético','anthropic','claude-sonnet-4-6',$3,$4::uuid[])`,
      [A,AI_A,SESSION_A,ids], "P0001", "integration_action_invalid");
    expect(await scalar("select count(*)::int from public.ai_agent_versions where agent_id=$1", [AI_A])).toBe(0);
  });

  it("draft permite trocar seleção própria; bloqueia troca por ação vizinha e preserva original", async () => {
    const id = await version([ACTION_A]);
    await db.query("update public.ai_agent_versions set integration_action_ids=$2 where id=$1", [id,[ACTION_A2]]);
    await denied("update public.ai_agent_versions set integration_action_ids=$2 where id=$1", [id,[ACTION_B]], "P0001", "integration_action_invalid");
    expect(await scalar("select integration_action_ids from public.ai_agent_versions where id=$1", [id])).toEqual([ACTION_A2]);
  });

  it("publicação revalida seleção sem alteração se a ação foi desativada depois do draft", async () => {
    const id = await version([ACTION_A]);
    await db.query("update public.integration_actions set configuration=jsonb_set(configuration,'{enabled}','false') where id=$1", [ACTION_A]);
    await denied("update public.ai_agent_versions set status='published' where id=$1", [id], "P0001", "integration_action_invalid");
    expect(await scalar("select status from public.ai_agent_versions where id=$1", [id])).toBe("draft");
  });

  it("publicação veta ação apagada depois de selecionada no draft", async () => {
    const id = await version([ACTION_A2]);
    await db.query("delete from public.integration_actions where id=$1", [ACTION_A2]);
    await denied("update public.ai_agent_versions set status='published' where id=$1", [id], "P0001", "integration_action_invalid");
    expect(await scalar("select status from public.ai_agent_versions where id=$1", [id])).toBe("draft");
  });

  it("troca de organização do draft também revalida ações mesmo com seleção inalterada", async () => {
    await service();
    const id = await version([ACTION_A]);
    // A guarda não pode retornar cedo só porque o array não mudou: o tenant
    // também faz parte da identidade de cada capacidade selecionada.
    await denied("update public.ai_agent_versions set organization_id=$2 where id=$1", [id,B], "P0001", "integration_action_invalid");
    expect(await scalar("select organization_id from public.ai_agent_versions where id=$1", [id])).toBe(A);
  });

  it("seleção rejeita mais de 25 ações habilitadas distintas (controle positivo com 25)", async () => {
    const ids = (await db.query("insert into public.integration_actions(organization_id,configuration) select $1,$2::jsonb from generate_series(1,26) returning id", [A,config()])).rows.map(row => row.id as string);
    const id = await version(ids.slice(0,25));
    await denied("update public.ai_agent_versions set integration_action_ids=$2 where id=$1", [id,ids], "P0001", "integration_action_invalid");
    expect(await scalar("select cardinality(integration_action_ids) from public.ai_agent_versions where id=$1", [id])).toBe(25);
  });

  it.each(["published", "superseded", "archived"])("%s não permite trocar nem limpar a seleção, inclusive via serviço", async (status) => {
    await service();
    const id = await version([ACTION_A],status);
    for (const ids of [[ACTION_A2],[]]) {
      await denied("update public.ai_agent_versions set integration_action_ids=$2 where id=$1", [id,ids], "P0001", "version_immutable");
    }
    expect(await scalar("select integration_action_ids from public.ai_agent_versions where id=$1", [id])).toEqual([ACTION_A]);
  });

  it("transição published→superseded→archived preserva seleção e não exige ação ainda habilitada", async () => {
    const id = await version([ACTION_A],"published");
    await db.query("update public.integration_actions set configuration=jsonb_set(configuration,'{enabled}','false') where id=$1", [ACTION_A]);
    for (const status of ["superseded", "archived"]) {
      await db.query("update public.ai_agent_versions set status=$2 where id=$1", [id,status]);
    }
    expect(await scalar("select integration_action_ids from public.ai_agent_versions where id=$1", [id])).toEqual([ACTION_A]);
  });

  it("seleção publicada não pode ser adulterada pelo desvio published→draft→editar", async () => {
    const id = await version([ACTION_A],"published");
    // Regressão de lifecycle: imutabilidade após publicação não pode depender
    // somente do status atual. Não desliga triggers nem corrige schema no teste.
    await denied(`do $probe$ begin
      update public.ai_agent_versions set status='draft' where id='${id}';
      update public.ai_agent_versions set integration_action_ids=array['${ACTION_A2}'::uuid] where id='${id}';
    end $probe$`, [], "P0001");
    expect(await scalar("select integration_action_ids from public.ai_agent_versions where id=$1", [id])).toEqual([ACTION_A]);
  });
});
