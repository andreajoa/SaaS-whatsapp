import { afterEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { sendTemplateForSession } from "./send-template-for-session";

// O resolver e o montador são reais; só PostgREST/RPC e a rede são dublês.
function database(options: { missing?: boolean; decryptFails?: boolean; lookupFails?: boolean } = {}) {
  const filters: Array<{ table: string; fields: Record<string, unknown> }> = [];
  const db = {
    from(table: string) {
      const fields: Record<string, unknown> = {};
      filters.push({ table, fields });
      const q = {
        select: () => q, eq: (key: string, value: unknown) => { fields[key] = value; return q; },
        is: (key: string, value: unknown) => { fields[key] = value; return q; },
        maybeSingle: async () => {
          if (options.lookupFails) return { data: null, error: { code: "offline", message: "offline" } };
          if (fields.organization_id !== "org-a" || fields.channel_session_id === "session-b" || fields.id === "session-b") return { data: null, error: null };
          if (table === "channel_sessions") return { data: options.missing ? null : { id: "session-a", provider: "meta_cloud", meta_phone_number_id: "phone-a", meta_token_encrypted: "encrypted-fixture" }, error: null };
          return { data: { name: "hello", language: "pt_BR", status: "APPROVED", contract_hash: "h", components: [{ type: "BODY", text: "Olá {{1}}" }] }, error: null };
        },
      }; return q;
    },
    rpc: async () => ({ data: options.decryptFails ? null : "fixture-token-a", error: null }),
  };
  return { db: db as unknown as SupabaseClient, filters };
}
const input = { organizationId: "org-a", channelSessionId: "session-a", to: "5511999999999", name: "hello", language: "pt_BR", values: { "1": "Ana" } };
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
describe("template: sessão autorizada e falha fechada", () => {
  it("usa a credencial da sessão e filtra também a definição pelo canal", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>(async () => new Response(JSON.stringify({ messages: [{ id: "receipt-a" }] }), { status: 200 }));
    vi.stubGlobal("fetch", fetch);
    const { db, filters } = database();
    expect(await sendTemplateForSession(db, input)).toBe("receipt-a");
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(String(fetch.mock.calls[0]?.[0])).toContain("/phone-a/messages");
    expect(filters.find(f => f.table === "meta_templates")?.fields).toMatchObject({ organization_id: "org-a", channel_session_id: "session-a" });
  });
  it.each([{ missing: true }, { decryptFails: true }, { lookupFails: true }])("não usa fallback global se a sessão não resolve: %j", async options => {
    vi.stubEnv("META_PHONE_NUMBER_ID", "phone-other-org");
    vi.stubEnv("META_SYSTEM_USER_TOKEN", "fixture-other-org");
    const fetch = vi.fn(); vi.stubGlobal("fetch", fetch);
    await expect(sendTemplateForSession(database(options).db, input)).rejects.toThrow();
    expect(fetch).not.toHaveBeenCalled();
  });
  it("recusa sessão de outra organização antes de qualquer POST", async () => {
    const fetch = vi.fn(); vi.stubGlobal("fetch", fetch);
    await expect(sendTemplateForSession(database().db, { ...input, channelSessionId: "session-b" })).rejects.toThrow();
    expect(fetch).not.toHaveBeenCalled();
  });
});
