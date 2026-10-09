import { invariantConnection } from "../db/test-connection";
import pg from "pg";
import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";

/**
 * 0246 — banco real, sem API de loja nem credenciais reais.
 * Cada caso semeia os mesmos dois tenants dentro de BEGIN/ROLLBACK. Os papéis
 * e JWTs abaixo percorrem a RLS de produção; postgres só prepara/verifica dados.
 * Claims concorrentes são reproduzidos com o mesmo UPDATE condicional do worker,
 * sem sleeps nem processos paralelos no banco compartilhado pelo harness.
 */
const pool = new pg.Pool(invariantConnection());
let db: pg.PoolClient;
const A = "02430000-0000-4000-8000-000000000001";
const B = "02430000-0000-4000-8000-000000000002";
const USER_A = "02430000-1000-4000-8000-000000000001";
const USER_B = "02430000-1000-4000-8000-000000000002";
const SHOP_A = "02430000-2000-4000-8000-000000000001";
const SHOP_B = "02430000-2000-4000-8000-000000000002";
const WOO_A = "02430000-2000-4000-8000-000000000003";
const LOCK = "2035-01-01T00:00:00.000Z";
const NEW_LOCK = "2035-01-01T00:03:00.000Z";

async function scalar<T>(query: string, args: unknown[] = []): Promise<T> {
  const result = await db.query(query, args);
  const row = result.rows[0];
  if (!row) throw new Error("Consulta de prova não retornou linha.");
  return Object.values(row)[0] as T;
}
async function asUser(user: string) {
  await db.query("set local role authenticated");
  await db.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: user })]);
}
async function service() { await db.query("set local role service_role"); }

/** SAVEPOINT mantém a transação útil após uma negação; erros errados reprovam. */
async function denied(query: string, args: unknown[], code: string, message?: string) {
  await db.query("savepoint negative_probe");
  let failure: unknown;
  try { await db.query(query, args); } catch (error) { failure = error; }
  await db.query("rollback to savepoint negative_probe");
  await db.query("release savepoint negative_probe");
  expect(failure).toMatchObject({ code });
  if (message) expect(failure).toMatchObject({ message: expect.stringContaining(message) });
}
async function begin(org = A, integration = SHOP_A): Promise<string> {
  await service();
  return scalar<string>("select public.fn_commerce_begin_sync($1,$2)", [org, integration]);
}
async function claim(run: string, lock = LOCK): Promise<number> {
  return (await db.query(`update public.commerce_sync_runs set status='running',locked_until=$3
    where organization_id=$1 and id=$2 and status in ('queued','running')
      and (locked_until is null or locked_until < now()) returning id`, [A, run, lock])).rowCount ?? 0;
}
function product(id: string, price = 12990) {
  return { external_id: id, sku: `SKU-${id}`, name: `Produto sintético ${id}`,
    description: "Fixture de teste", brand: null, category: null, price_cents: price,
    currency: "BRL", tracks_inventory: true, quantity: 3, active: true,
    image_url: null, url: null };
}
async function page(run: string, products: unknown[] = [], phase = "orders", lock = LOCK, orders: unknown[] = []) {
  await db.query("select public.fn_commerce_store_page($1,$2,$3,$4::jsonb,$5::jsonb,$6,null)",
    [A, run, lock, JSON.stringify(products), JSON.stringify(orders), phase]);
}

beforeEach(async () => {
  db = await pool.connect();
  await db.query("begin");
  await db.query(`
    insert into auth.users(id,email) values
      ('${USER_A}','commerce-a@invariant.test'),('${USER_B}','commerce-b@invariant.test');
    insert into public.organizations(id,slug,legal_name,display_name) values
      ('${A}','commerce-0243-a','Comércio sintético A','Comércio A'),
      ('${B}','commerce-0243-b','Comércio sintético B','Comércio B');
    insert into public.user_organizations(user_id,organization_id,role,accepted_at) values
      ('${USER_A}','${A}','manager',now()),('${USER_B}','${B}','manager',now());
    insert into public.tenant_integrations
      (id,organization_id,provider,status,oauth_access_token_encrypted,oauth_refresh_token_encrypted,webhook_secret_encrypted,store_metadata)
      values
      ('${SHOP_A}','${A}','shopify','healthy','\\x01','\\x02','\\x03','{"store_url":"https://synthetic-a.myshopify.com"}'),
      ('${SHOP_B}','${B}','shopify','healthy','\\x01','\\x02','\\x03','{"store_url":"https://synthetic-b.myshopify.com"}'),
      ('${WOO_A}','${A}','woocommerce','healthy','\\x01','\\x02','\\x03','{"store_url":"https://synthetic-woo.example"}');
    insert into public.catalog_products
      (organization_id,codigo,nome,preco_cents,external_provider,external_id,commerce_synced_at)
      values
      ('${A}','manual','Manual A',700,null,null,null),
      ('${A}','shopify:old','Removido da Shopify',100,'shopify','old',now()-interval '1 day'),
      ('${A}','woocommerce:old','Produto Woo A',200,'woocommerce','old',now()-interval '1 day'),
      ('${B}','shopify:old','Produto Shopify B',300,'shopify','old',now()-interval '1 day');
    insert into public.orders(organization_id,external_id,external_provider,status,total_cents,ordered_at)
      values ('${A}','history','shopify','paid',500,now()),('${B}','history','shopify','paid',600,now());
  `);
});
afterEach(async () => { if (db) { try { await db.query("rollback"); } finally { db.release(); } } });
afterAll(async () => { await pool.end(); });

describe("0246 — isolamento e privilégios", () => {
  it("membros leem apenas seus syncs, catálogo e pedidos; controle positivo nos dois tenants", async () => {
    const runA = await begin();
    const runB = await begin(B, SHOP_B);
    for (const [user, own, other, run] of [[USER_A,A,B,runA],[USER_B,B,A,runB]]) {
      await asUser(user!);
      expect(await scalar("select count(*)::int from public.commerce_sync_runs where id=$1", [run])).toBe(1);
      for (const table of ["commerce_sync_runs", "catalog_products", "orders"]) {
        expect(await scalar(`select count(*)::int from public.${table} where organization_id=$1`, [own])).toBeGreaterThan(0);
        expect(await scalar(`select count(*)::int from public.${table} where organization_id=$1`, [other])).toBe(0);
      }
    }
  });

  it("authenticated não forja execução de sync nem acessa nonce OAuth/recibo interno", async () => {
    const run = await begin();
    await asUser(USER_A);
    await denied("update public.commerce_sync_runs set status='completed' where id=$1", [run], "42501");
    await denied("insert into public.commerce_sync_runs(organization_id,integration_id) values($1,$2)", [A,SHOP_A], "42501");
    for (const table of ["commerce_oauth_states", "commerce_webhook_receipts"]) {
      await denied(`select * from public.${table}`, [], "42501");
    }
  });

  it.each(["commerce_sync_runs", "commerce_oauth_states", "commerce_webhook_receipts"])("anon não lê %s", async (table) => {
    await db.query("set local role anon");
    await denied(`select * from public.${table}`, [], "42501");
  });

  it("todas as RPCs commerce são service-only, inclusive grants herdados de PUBLIC", async () => {
    const signatures = [
      "fn_commerce_oauth_allowed(uuid,uuid,uuid)", "fn_commerce_begin_sync(uuid,uuid,uuid)",
      "fn_commerce_checkpoint(uuid,uuid,text,text,integer,integer)",
      "fn_commerce_store_page(uuid,uuid,timestamp with time zone,jsonb,jsonb,text,text)",
      "fn_commerce_webhook(uuid,uuid,text,text)", "fn_commerce_disconnect(uuid,text)",
    ];
    const permissions = (await db.query(`select p, has_function_privilege('anon','public.'||p,'execute') as anon,
      has_function_privilege('authenticated','public.'||p,'execute') as authenticated,
      has_function_privilege('service_role','public.'||p,'execute') as service
      from unnest($1::text[]) p`, [signatures])).rows;
    expect(permissions).toHaveLength(signatures.length);
    for (const row of permissions) expect(row).toMatchObject({ anon: false, authenticated: false, service: true });
    for (const role of ["anon", "authenticated"]) {
      await db.query(`set local role ${role}`);
      await denied("select public.fn_commerce_begin_sync($1,$2)", [A,SHOP_A], "42501");
      await denied("select public.fn_commerce_disconnect($1,'shopify')", [A], "42501");
    }
    expect(await begin()).toMatch(/^[\da-f-]{36}$/);
  });

  it("service_role não cruza a organização informada com uma conexão vizinha", async () => {
    await service();
    await denied("select public.fn_commerce_begin_sync($1,$2)", [A,SHOP_B], "P0001", "commerce_integration_unavailable");
    await denied("select public.fn_commerce_webhook($1,$2,'cross-org','products/update')", [A,SHOP_B], "P0001", "commerce_integration_unavailable");
    expect(await scalar("select count(*)::int from public.commerce_webhook_receipts")).toBe(0);
  });
});

describe("0246 — fila, lease e checkpoint atômico", () => {
  it("begin_sync duplicado retorna o mesmo run e emite apenas um evento; lojas distintas continuam independentes", async () => {
    const run = await begin();
    expect(await begin()).toBe(run);
    expect(await scalar("select count(*)::int from public.commerce_sync_runs where integration_id=$1", [SHOP_A])).toBe(1);
    expect(await scalar("select count(*)::int from public.event_log where event_type='commerce.sync_requested' and entity_id=$1", [run])).toBe(1);
    expect(await begin(A,WOO_A)).not.toBe(run);
    expect(await begin(B,SHOP_B)).not.toBe(run);
    await denied("insert into public.commerce_sync_runs(organization_id,integration_id) values($1,$2)", [A,SHOP_A], "23505");
  });

  it("lease ativo impede segunda claim; expirado permite recuperar com novo token", async () => {
    const run = await begin();
    expect(await claim(run)).toBe(1);
    expect(await claim(run,NEW_LOCK)).toBe(0);
    await db.query("update public.commerce_sync_runs set locked_until=now()-interval '1 second' where id=$1", [run]);
    expect(await claim(run,NEW_LOCK)).toBe(1);
    await denied("select public.fn_commerce_store_page($1,$2,$3,$4::jsonb,'[]'::jsonb,'orders',null)",
      [A,run,LOCK,JSON.stringify([product("stale")])], "P0001", "commerce_stale_claim");
    expect(await scalar("select count(*)::int from public.catalog_products where codigo='shopify:stale'")).toBe(0);
    await page(run,[product("current")],"orders",NEW_LOCK);
    expect(await scalar("select status||':'||phase||':'||product_count from public.commerce_sync_runs where id=$1", [run])).toBe("queued:orders:1");
  });

  it("page de outra org e replay de página já confirmada são negados sem produto nem contagem duplicada", async () => {
    const run = await begin();
    await claim(run);
    await denied("select public.fn_commerce_store_page($1,$2,$3,'[]','[]','orders',null)", [B,run,LOCK], "P0001", "commerce_stale_claim");
    await page(run,[product("once")]);
    await denied("select public.fn_commerce_store_page($1,$2,$3,$4::jsonb,'[]','orders',null)",
      [A,run,LOCK,JSON.stringify([product("once",1)])], "P0001", "commerce_stale_claim");
    expect(await scalar("select preco_cents::int from public.catalog_products where organization_id=$1 and codigo='shopify:once'", [A])).toBe(12990);
    expect(await scalar("select product_count from public.commerce_sync_runs where id=$1", [run])).toBe(1);
    expect(await scalar("select count(*)::int from public.event_log where event_type='commerce.sync_requested' and entity_id=$1", [run])).toBe(2);
  });

  it("falha no pedido reverte também produtos e checkpoint da mesma página", async () => {
    const run = await begin();
    await claim(run);
    await denied("select public.fn_commerce_store_page($1,$2,$3,$4::jsonb,$5::jsonb,'complete',null)",
      [A,run,LOCK,JSON.stringify([product("atomic")]),JSON.stringify([{external_id:"invalid",status:"paid",total_cents:-1,currency:"BRL",ordered_at:LOCK}])], "23514");
    expect(await scalar("select count(*)::int from public.catalog_products where codigo='shopify:atomic'")).toBe(0);
    expect(await scalar("select status||':'||product_count from public.commerce_sync_runs where id=$1", [run])).toBe("running:0");
  });

  it("remoção só ocorre no fim das páginas de produtos e preserva manuais, outro provedor e outro tenant", async () => {
    const run = await begin();
    await claim(run);
    await page(run,[product("new")],"products");
    expect(await scalar("select ativo from public.catalog_products where organization_id=$1 and codigo='shopify:old'", [A])).toBe(true);
    await claim(run,NEW_LOCK);
    await page(run,[product("last")],"orders",NEW_LOCK);
    expect(await scalar("select ativo from public.catalog_products where organization_id=$1 and codigo='shopify:old'", [A])).toBe(false);
    expect(await scalar("select count(*)::int from public.catalog_products where organization_id=$1 and codigo in ('manual','woocommerce:old','shopify:new','shopify:last') and ativo", [A])).toBe(4);
    expect(await scalar("select ativo from public.catalog_products where organization_id=$1 and codigo='shopify:old'", [B])).toBe(true);
  });

  it("código manual coincidente não é sobrescrito pelo importador", async () => {
    await db.query("insert into public.catalog_products(organization_id,codigo,nome,preco_cents) values($1,'shopify:collision','Manual protegido',799)", [A]);
    const run = await begin();
    await claim(run);
    await page(run,[product("collision",1)]);
    expect(await scalar("select nome||':'||preco_cents||':'||ativo from public.catalog_products where organization_id=$1 and codigo='shopify:collision'", [A])).toBe("Manual protegido:799:true");
  });

  it("não reescreve identidade da loja ao reconectar, preservando pedidos históricos", async () => {
    await denied("update public.tenant_integrations set store_metadata=jsonb_build_object('store_url','https://other.myshopify.com') where id=$1", [SHOP_A], "P0001", "commerce_store_change_requires_new_organization");
    expect(await scalar("select store_metadata->>'store_url' from public.tenant_integrations where id=$1", [SHOP_A])).toBe("https://synthetic-a.myshopify.com");
  });
});

describe("0246 — webhook, resync e desconexão", () => {
  it("dedup do webhook não cria outro run/evento nem marca resync para a mesma entrega", async () => {
    await service();
    expect(await scalar("select public.fn_commerce_webhook($1,$2,'delivery-1','products/update')", [A,SHOP_A])).toBe(true);
    expect(await scalar("select public.fn_commerce_webhook($1,$2,'delivery-1','products/update')", [A,SHOP_A])).toBe(false);
    expect(await scalar("select commerce_resync_requested from public.tenant_integrations where id=$1", [SHOP_A])).toBe(false);
    expect(await scalar("select count(*)::int from public.commerce_webhook_receipts where integration_id=$1", [SHOP_A])).toBe(1);
    expect(await scalar("select count(*)::int from public.commerce_sync_runs where integration_id=$1", [SHOP_A])).toBe(1);
  });

  it("webhooks distintos durante sync coalescem em um resync após checkpoint completo", async () => {
    const run = await begin();
    await claim(run);
    for (const delivery of ["delivery-2", "delivery-3"]) {
      expect(await scalar("select public.fn_commerce_webhook($1,$2,$3,'orders/updated')", [A,SHOP_A,delivery])).toBe(true);
    }
    expect(await scalar("select commerce_resync_requested from public.tenant_integrations where id=$1", [SHOP_A])).toBe(true);
    expect(await scalar("select count(*)::int from public.commerce_sync_runs where integration_id=$1", [SHOP_A])).toBe(1);
    await page(run,[],"complete");
    expect(await scalar("select count(*)::int from public.commerce_sync_runs where integration_id=$1", [SHOP_A])).toBe(2);
    expect(await scalar("select count(*)::int from public.commerce_sync_runs where integration_id=$1 and status='queued'", [SHOP_A])).toBe(1);
    expect(await scalar("select commerce_resync_requested from public.tenant_integrations where id=$1", [SHOP_A])).toBe(false);
    expect(await scalar("select last_sync_at is not null from public.tenant_integrations where id=$1", [SHOP_A])).toBe(true);
  });

  it.each(["rpc", "uninstall"])("desconexão %s cancela run, bloqueia página tardia e mantém histórico/manual/vizinhos", async (mode) => {
    const run = await begin();
    await claim(run);
    if (mode === "rpc") await db.query("select public.fn_commerce_disconnect($1,'shopify')", [A]);
    else await db.query("select public.fn_commerce_webhook($1,$2,'removed','app/uninstalled')", [A,SHOP_A]);
    expect(await scalar("select status||':'||octet_length(oauth_access_token_encrypted)||':'||(oauth_refresh_token_encrypted is null) from public.tenant_integrations where id=$1", [SHOP_A])).toBe("disconnected:0:true");
    expect(await scalar("select status||':'||(locked_until is null) from public.commerce_sync_runs where id=$1", [run])).toBe("cancelled:true");
    await denied("select public.fn_commerce_store_page($1,$2,$3,'[]','[]','complete',null)", [A,run,LOCK], "P0001", "commerce_disconnected");
    await denied("select public.fn_commerce_begin_sync($1,$2)", [A,SHOP_A], "P0001", "commerce_integration_unavailable");
    expect(await scalar("select ativo from public.catalog_products where organization_id=$1 and codigo='shopify:old'", [A])).toBe(false);
    expect(await scalar("select count(*)::int from public.catalog_products where organization_id=$1 and codigo in ('manual','woocommerce:old') and ativo", [A])).toBe(2);
    expect(await scalar("select ativo from public.catalog_products where organization_id=$1 and codigo='shopify:old'", [B])).toBe(true);
    expect(await scalar("select count(*)::int from public.orders where organization_id=$1 and external_id='history'", [A])).toBe(1);
    expect(await scalar("select status from public.tenant_integrations where id=$1", [SHOP_B])).toBe("healthy");
  });
});
