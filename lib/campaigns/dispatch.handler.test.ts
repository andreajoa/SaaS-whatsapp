import type pg from "pg";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Message } from "@/lib/types/messaging";
import type { EventRow } from "@/lib/event-log/dispatcher";
import { StaleServiceBoundaryError } from "@/lib/atendimento/fronteira";
import { createCampaignDispatchHandler, type DispatchDependencies } from "./dispatch.handler";
import { campaignAction, type CampaignRow } from "./service";
import { snapshotHash } from "./snapshot";
import type { TemplateSnapshot } from "./model";
import { CHANNEL_PROVIDER_META } from "@/lib/channels/capabilities";

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));
vi.mock("@/lib/audit", () => ({ audit: vi.fn(async () => {}) }));
vi.mock("@/app/api/v1/messages/_handler", () => ({ sendMessageHandler: vi.fn() }));
vi.mock("@/lib/env", () => ({ env: {} }));
vi.mock("@/lib/agent-engine/guardrails/before-send", () => ({ runBeforeSend: vi.fn() }));
const ORG="11111111-1111-4111-8111-111111111111", CAMPAIGN="22222222-2222-4222-8222-222222222222";
const RECIPIENT="33333333-3333-4333-8333-333333333333", CONTACT="44444444-4444-4444-8444-444444444444";
const CONVERSATION="55555555-5555-4555-8555-555555555555", SESSION="66666666-6666-4666-8666-666666666666";
const ACTOR="77777777-7777-4777-8777-777777777777";
const template:TemplateSnapshot={id:"88888888-8888-4888-8888-888888888888",name:"hello",language:"pt_BR",status:"APPROVED",contract_hash:"h",parameter_format:"POSITIONAL",components:[{type:"BODY",text:"Olá {{1}}"}]};
const now=new Date("2026-10-09T03:00:00Z");
interface Attempt {attempt_id:string;recipient_id:string;state:string;started_at:Date;message_id:string|null;message_status:string|null}

/** Fault model de persistência: linhas fornecidas pelo cenário e captura de writes.
 * Não implementa guards, lease, snapshot, escolha de destinatário ou classificação
 * de recibos: essas decisões são executadas exclusivamente pelos módulos reais.
 * Não é motor SQL; FKs/RLS/concorrência precisam do gate de banco do pai.
 */
function fixture(status="running", attempts:Attempt[]=[]) {
  const campaign:CampaignRow={id:CAMPAIGN,organization_id:ORG,name:"Oferta",channel_session_id:SESSION,status,template_snapshot:template,snapshot_hash:snapshotHash(template),template_values:{"1":"Ana"},delay_seconds:5,scheduled_at:null,next_dispatch_at:null,created_by:ACTOR,launched_by:ACTOR};
  let recipientStatus=attempts[0]?.state??"pending";
  const writes:Array<{sql:string;params:unknown[]}>=[];
  const query=vi.fn(async (sql:string,params:unknown[]=[]) => {
    const text=sql.trim();
    if (["begin","commit","rollback"].includes(text)) return {rows:[],rowCount:0};
    if (text.startsWith("update") || text.startsWith("insert") || text.startsWith("select emit_event")) {
      writes.push({sql:text,params});
      if (text.startsWith("insert into customer_campaign_attempts")) attempts.push({attempt_id:String(params[0]),recipient_id:String(params[2]),state:"sending",started_at:new Date(),message_id:null,message_status:null});
      if (text.startsWith("update customer_campaign_attempts")) {
        const a=attempts.find(a=>a.attempt_id===params[1]); if(a) { a.state=String(params[2]); }
      }
      if (text.startsWith("update customer_campaign_recipients r set status='cancelled'")) { recipientStatus="cancelled"; return {rows:[{id:RECIPIENT}],rowCount:1}; }
      if (text.startsWith("update customer_campaign_recipients set status='sending'")) recipientStatus="sending";
      else if (text.startsWith("update customer_campaign_recipients set status=$3")) recipientStatus=String(params[2]);
      return {rows:[],rowCount:1};
    }
    if (text.startsWith("select * from customer_campaigns")) return {rows:params[0]===ORG?[campaign]:[],rowCount:params[0]===ORG?1:0};
    if (text.startsWith("select a.id as attempt_id")) return {rows:attempts.filter(a=>["sending","needs_review"].includes(a.state)),rowCount:attempts.length};
    if (text.startsWith("select next_dispatch_at")) return {rows:[{next_dispatch_at:campaign.next_dispatch_at}],rowCount:1};
    if (text.startsWith("select id from customer_campaign_recipients")) return {rows:recipientStatus==="needs_review"?[{id:RECIPIENT}]:[],rowCount:recipientStatus==="needs_review"?1:0};
    if (text.startsWith("select id,contact_id,conversation_id from customer_campaign_recipients")) return {rows:recipientStatus==="pending"?[{id:RECIPIENT,contact_id:CONTACT,conversation_id:CONVERSATION}]:[],rowCount:recipientStatus==="pending"?1:0};
    if (text.startsWith("select p.status")) return {rows:[{status:campaign.status,session_status:"WORKING",archived_at:null,state:"sending",started_at:attempts.at(-1)?.started_at??now,recipient_status:"sending",contact_id:CONTACT,channel_session_id:SESSION}],rowCount:1};
    if (text.startsWith("select c.id,c.name")) return {rows:[{id:CONTACT,name:"Ana",display_name:null,phone_number:"+5511999999999",is_blocked:false,is_anonymized:false,consent:{marketing:{granted_at:"2026-10-01T00:00:00Z"}},conversation_id:CONVERSATION,conversation_status:"open",source:"manual",daily_message_limit:50}],rowCount:1};
    if (text.startsWith("select id,provider from channel_sessions")) return {rows:[{id:SESSION,provider:CHANNEL_PROVIDER_META}],rowCount:1};
    if (text.startsWith("select id,name,language,status,contract_hash")) return {rows:[template],rowCount:1};
    if (text.startsWith("select c.organization_id")) return {rows:[{organization_id:ORG,contact_id:CONTACT,conversation_id:CONVERSATION,service_revision:1,demanda_id:null,demanda_revision:null,status:"open",demanda_fechada_em:null}],rowCount:1};
    if (text.startsWith("select id from customer_campaigns")) return {rows:[{id:CAMPAIGN}],rowCount:1};
    if (text.startsWith("select id,status from messages")) return {rows:[],rowCount:0};
    throw new Error(`Consulta fora do fault model: ${text.slice(0,100)}`);
  });
  const pool={query,connect:async()=>({query,release:vi.fn()})} as unknown as pg.Pool;
  return {pool,campaign,writes,attempts,recipientStatus:()=>recipientStatus};
}
const event:EventRow={id:"event",organization_id:ORG,event_type:"campaign.dispatch_requested",entity_kind:"customer_campaign",entity_id:CAMPAIGN,payload:{},metadata:{},consumed_by:[],attempts:0};
function runner(f:ReturnType<typeof fixture>,send:DispatchDependencies["send"]) {
  return createCampaignDispatchHandler({pool:()=>f.pool,admin:vi.fn() as DispatchDependencies["admin"],send,
    beforeSend:async args=>({status:"sent",outcome:await args.send(args.body),trace:[]})});
}
afterEach(()=>vi.useRealTimers());
describe("campanhas: recibo incerto, pausa e revisão",()=>{
  it("veto com abertura futura mantém destinatário pendente e espera antes de um único envio",async()=>{
    vi.useFakeTimers();vi.setSystemTime(now);
    const f=fixture();const send=vi.fn(async()=>({id:"message",status:"sent"}) as Message);
    const opening=new Date(now.getTime()+3_600_000);
    const handler=createCampaignDispatchHandler({pool:()=>f.pool,admin:vi.fn() as DispatchDependencies["admin"],send,
      beforeSend:async()=>({status:"vetoed",gate:"window",code:"outside_window",message:"Aguardar janela",nextAllowedAt:opening,trace:[]})});
    const deferred=await handler.handle(event);
    expect(deferred).toMatchObject({status:"retry",retry_at:opening.toISOString()});
    expect(f.recipientStatus()).toBe("pending");expect(send).not.toHaveBeenCalled();
    const timing=f.writes.find(w=>w.sql.startsWith("update customer_campaigns set next_dispatch_at=$3"));
    expect(timing?.params[2]).toEqual(opening);
    // Releitura da persistência, sem implementar o cálculo de espera no dublê.
    f.campaign.next_dispatch_at=timing!.params[2] as Date;
    expect((await runner(f,send).handle(event)).status).toBe("retry");
    expect(send).not.toHaveBeenCalled();
    vi.setSystemTime(opening);
    await runner(f,send).handle(event);
    await runner(f,send).handle(event);
    expect(send).toHaveBeenCalledTimes(1);expect(f.recipientStatus()).toBe("sent");
  });
  it("queued após entrada no sink não autoriza retry",async()=>{
    vi.useFakeTimers();vi.setSystemTime(now);
    const f=fixture();const send=vi.fn(async()=>({id:"message",status:"queued"}) as Message);
    await runner(f,send).handle(event);
    expect(send).toHaveBeenCalledTimes(1);
    expect(f.recipientStatus()).toBe("needs_review");
    expect(f.writes.find(w=>w.sql.startsWith("update customer_campaign_attempts"))?.params.slice(2,4)).toEqual(["needs_review",false]);
  });
  it("erro de fronteira após entrada no sink também permanece incerto",async()=>{
    vi.useFakeTimers();vi.setSystemTime(now);
    const f=fixture();const send=vi.fn(async()=>{throw new StaleServiceBoundaryError();});
    await runner(f,send).handle(event);
    expect(f.recipientStatus()).toBe("needs_review");
  });
  it.each(["paused","cancelled"])("reconhece recibo tardio em %s sem mandar outro POST",async status=>{
    vi.useFakeTimers();vi.setSystemTime(now);
    const f=fixture(status,[{attempt_id:"attempt",recipient_id:RECIPIENT,state:"needs_review",started_at:new Date(now.getTime()-600_000),message_id:"receipt",message_status:"delivered"}]);
    const send=vi.fn();const result=await runner(f,send).handle(event);
    expect(result.status).toBe("ok");expect(send).not.toHaveBeenCalled();
    expect(f.attempts[0]?.state).toBe("sent");expect(f.recipientStatus()).toBe("sent");
    expect(f.campaign.status).toBe(status);
  });
  it("lease expirado do último destinatário pausado vira revisão, sem ficar sending",async()=>{
    vi.useFakeTimers();vi.setSystemTime(now);
    const f=fixture("paused",[{attempt_id:"attempt",recipient_id:RECIPIENT,state:"sending",started_at:new Date(now.getTime()-600_000),message_id:null,message_status:null}]);
    const send=vi.fn();const result=await runner(f,send).handle(event);
    expect(result.status).toBe("retry");expect(f.recipientStatus()).toBe("needs_review");expect(send).not.toHaveBeenCalled();
  });
  it("revisão manager encerra só o destinatário, mantendo tentativa incerta e sem fila de envio",async()=>{
    vi.useFakeTimers();vi.setSystemTime(now);
    const f=fixture("paused",[{attempt_id:"attempt",recipient_id:RECIPIENT,state:"needs_review",started_at:new Date(now.getTime()-600_000),message_id:null,message_status:null}]);
    await campaignAction({organizationId:ORG,actorUserId:ACTOR,requestId:"review"},CAMPAIGN,{action:"resolve_review",recipient_id:RECIPIENT,resolution:"skip",confirm:true},f.pool);
    expect(f.recipientStatus()).toBe("cancelled");expect(f.attempts[0]?.state).toBe("needs_review");
    expect(f.writes.some(w=>w.sql.startsWith("select emit_event"))).toBe(false);
    const send=vi.fn();expect((await runner(f,send).handle(event)).status).toBe("ok");expect(send).not.toHaveBeenCalled();
  });
  it("não encerra revisão de campanha de outro tenant",async()=>{
    const f=fixture("paused");
    await expect(campaignAction({organizationId:"other-org",actorUserId:ACTOR,requestId:"review"},CAMPAIGN,{action:"resolve_review",recipient_id:RECIPIENT,resolution:"skip",confirm:true},f.pool)).rejects.toThrow(/não encontrada/);
    expect(f.writes).toEqual([]);
  });
});
