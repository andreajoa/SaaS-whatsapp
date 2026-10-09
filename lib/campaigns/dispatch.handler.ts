import { randomUUID } from "node:crypto";
import type pg from "pg";
import type { EventHandler, EventRow, HandlerResult } from "@/lib/event-log/dispatcher";
import { getRequestPool } from "@/lib/agent-engine/db/request-pool";
import { runBeforeSend } from "@/lib/agent-engine/guardrails/before-send";
import { deriveLgpdFromContact, type LgpdContactFields } from "@/lib/agent-engine/guardrails/lgpd/legal-basis";
import type { Queryable } from "@/lib/agent-engine/queue/queue";
import { withServiceBoundary, readCurrentServiceBoundary } from "@/lib/atendimento/fronteira-server";
import { StaleServiceBoundaryError } from "@/lib/atendimento/fronteira";
import { sendMessageHandler } from "@/app/api/v1/messages/_handler";
import { createAdminClient } from "@/lib/supabase/admin";
import { logger } from "@/lib/logger";
import { audit } from "@/lib/audit";
import { audienceExclusion, validateTemplate, type AudienceContact } from "./model";
import { assertSnapshot } from "./snapshot";
import { transaction, loadTemplate, ensureSession, reconcileCampaignReceipts, CAMPAIGN_SEND_LEASE_MS, type CampaignRow, CONTACT_COLUMNS, AUDIENCE_JOIN } from "./service";
import type { Message } from "@/lib/types/messaging";

const KEY = "customer-campaign-dispatch";
const LEASE_MS = CAMPAIGN_SEND_LEASE_MS;
interface Claim { campaign: CampaignRow; recipient_id: string; contact_id: string; conversation_id: string; attempt_id: string; message_id: string }
interface Settlement { state:"sent"|"failed"|"needs_review"; safe:boolean; error:string|null; messageId?:string }
export interface DispatchDependencies {
  pool: () => pg.Pool;
  send: typeof sendMessageHandler;
  admin: typeof createAdminClient;
  beforeSend: typeof runBeforeSend;
}
function retry(at: Date): HandlerResult { return {consumer_key:KEY,status:"retry",retry_at:at.toISOString()}; }
function done(): HandlerResult { return {consumer_key:KEY,status:"ok"}; }

async function acquire(pool:pg.Pool,row:EventRow):Promise<Claim|HandlerResult> {
  return transaction(pool,async db => {
    const {rows} = await db.query<CampaignRow>("select * from customer_campaigns where organization_id=$1 and id=$2 for update",[row.organization_id,row.entity_id]);
    const c=rows[0]; if(!c) return done();
    // Reconciliação independe de autorização para NOVOS envios. Até uma campanha
    // cancelada pode receber confirmação tardia de um POST anterior.
    const reconciliation=await reconcileCampaignReceipts(db,row.organization_id,c.id);
    if(reconciliation.waitUntil) return retry(reconciliation.waitUntil);
    if(reconciliation.needsReview) {
      if(["running","scheduled"].includes(c.status)) await db.query("update customer_campaigns set status='paused',updated_at=now() where organization_id=$1 and id=$2",[row.organization_id,c.id]);
      return retry(new Date(Date.now()+60_000));
    }
    if(!["scheduled","running"].includes(c.status)) return done();
    const {rows:timing}=await db.query<{next_dispatch_at:Date|null}>("select next_dispatch_at from customer_campaigns where organization_id=$1 and id=$2",[row.organization_id,c.id]);
    const due=timing[0]?.next_dispatch_at;
    if(due && due>new Date()) return retry(due);
    if(c.status==="scheduled") {
      await db.query("update customer_campaigns set status='running',updated_at=now() where organization_id=$1 and id=$2",[row.organization_id,c.id]);
      c.status="running";
    }
    const recipients=await db.query<{id:string;contact_id:string;conversation_id:string}>("select id,contact_id,conversation_id from customer_campaign_recipients where organization_id=$1 and campaign_id=$2 and status='pending' order by id limit 1 for update",[row.organization_id,c.id]);
    const r=recipients.rows[0];
    if(!r) { await db.query("update customer_campaigns set status='completed',updated_at=now() where organization_id=$1 and id=$2",[row.organization_id,c.id]);return done(); }
    const attempt=randomUUID(), message=randomUUID();
    await db.query("insert into customer_campaign_attempts(id,organization_id,recipient_id,intended_message_id) values($1,$2,$3,$4)",[attempt,row.organization_id,r.id,message]);
    await db.query("update customer_campaign_recipients set status='sending',safe_to_retry=false where organization_id=$1 and campaign_id=$2 and id=$3",[row.organization_id,c.id,r.id]);
    return {campaign:c,recipient_id:r.id,contact_id:r.contact_id,conversation_id:r.conversation_id,attempt_id:attempt,message_id:message};
  });
}
async function assertPermission(pool:pg.Pool,c:Claim) {
  const org=c.campaign.organization_id;
  const {rows} = await pool.query(`select p.status,s.status as session_status,s.archived_at,a.state,a.started_at,u.status as recipient_status,
    v.contact_id,v.channel_session_id from customer_campaigns p
    join customer_campaign_recipients u on u.organization_id=p.organization_id and u.campaign_id=p.id and u.id=$3
    join customer_campaign_attempts a on a.organization_id=u.organization_id and a.recipient_id=u.id and a.id=$4
    join channel_sessions s on s.organization_id=p.organization_id and s.id=p.channel_session_id
    join conversations v on v.organization_id=u.organization_id and v.id=u.conversation_id
    where p.organization_id=$1 and p.id=$2`,[org,c.campaign.id,c.recipient_id,c.attempt_id]);
  const current=rows[0];
  if(!current || current.status!=="running" || current.state!=="sending" || current.recipient_status!=="sending" ||
    current.session_status!=="WORKING" || current.archived_at || current.contact_id!==c.contact_id || current.channel_session_id!==c.campaign.channel_session_id ||
    new Date(current.started_at).getTime()+LEASE_MS<=Date.now()) throw new StaleServiceBoundaryError();
  const contacts=await pool.query<AudienceContact & LgpdContactFields & {daily_message_limit:number}>(`select ${CONTACT_COLUMNS},c.source,s.daily_message_limit ${AUDIENCE_JOIN}
    join channel_sessions s on s.organization_id=c.organization_id and s.id=$2 where c.organization_id=$1 and c.id=$3 and v.id=$4`,[org,c.campaign.channel_session_id,c.contact_id,c.conversation_id]);
  const contact=contacts.rows[0];
  if(!contact || audienceExclusion(contact)) throw new StaleServiceBoundaryError();
  assertSnapshot(c.campaign.template_snapshot,c.campaign.snapshot_hash,await loadTemplate(pool,org,c.campaign.channel_session_id,c.campaign.template_snapshot.id));
  const support=await ensureSession(pool,org,c.campaign.channel_session_id);
  validateTemplate(c.campaign.template_snapshot,c.campaign.template_values,support);
  return contact;
}
async function settle(pool:pg.Pool,c:Claim,s:Settlement) {
  await transaction(pool,async db => {
    // Mesma ordem de locks que acquire/action. Recibo reconhecido mesmo após pause/cancel.
    await db.query("select id from customer_campaigns where organization_id=$1 and id=$2 for update",[c.campaign.organization_id,c.campaign.id]);
    const receipt=await db.query<{id:string;status:string}>("select id,status from messages where organization_id=$1 and id=$2",[c.campaign.organization_id,c.message_id]);
    if(receipt.rows[0] && ["sent","delivered","read"].includes(receipt.rows[0].status))
      s={state:"sent",safe:false,error:null,messageId:receipt.rows[0].id};
    await db.query(`update customer_campaign_attempts set state=$3,safe_to_retry=$4,error_code=$5,message_id=$6,finished_at=now()
      where organization_id=$1 and id=$2 and (state<>'sent' or $3='sent')`,[c.campaign.organization_id,c.attempt_id,s.state,s.safe,s.error,s.messageId??null]);
    await db.query(`update customer_campaign_recipients set status=$3,safe_to_retry=$4,last_error=$5
      where organization_id=$1 and campaign_id=$6 and id=$2 and (status<>'sent' or $3='sent')
      and (last_error is distinct from 'reviewed_no_resend' or $3='sent')
      and not exists(select 1 from customer_campaign_attempts newer join customer_campaign_attempts own on own.organization_id=newer.organization_id and own.recipient_id=newer.recipient_id
        where own.organization_id=$1 and own.id=$7 and (newer.started_at,newer.id)>(own.started_at,own.id))`,[c.campaign.organization_id,c.recipient_id,s.state,s.safe,s.error,c.campaign.id,c.attempt_id]);
    await db.query(`update customer_campaigns set next_dispatch_at=now()+delay_seconds*interval '1 second',
      status=case when $3='needs_review' and status in ('running','scheduled') then 'paused' else status end,updated_at=now()
      where organization_id=$1 and id=$2`,[c.campaign.organization_id,c.campaign.id,s.state]);
  });
  void audit({action:"org.updated",organizationId:c.campaign.organization_id,resourceType:"customer_campaign",resourceId:c.campaign.id,
    metadata:{operation:"campaign.recipient_settled",recipient_id:c.recipient_id,attempt_id:c.attempt_id,state:s.state,safe_to_retry:s.safe}});
}
/** Um veto anterior ao transporte pode esperar sem consumir o destinatário. */
async function deferSend(pool:pg.Pool,c:Claim,until:Date,code:string) {
  await transaction(pool,async db=>{
    await db.query("select id from customer_campaigns where organization_id=$1 and id=$2 for update",[c.campaign.organization_id,c.campaign.id]);
    await db.query(`update customer_campaign_attempts set state=$3,safe_to_retry=true,error_code=$4,finished_at=now()
      where organization_id=$1 and id=$2 and state='sending'`,[c.campaign.organization_id,c.attempt_id,"failed",code]);
    await db.query(`update customer_campaign_recipients set status=$3,safe_to_retry=false,last_error=$4
      where organization_id=$1 and id=$2 and campaign_id=$5 and status='sending'
      and exists(select 1 from customer_campaigns p where p.organization_id=$1 and p.id=$5 and p.status<>'cancelled')`,
      [c.campaign.organization_id,c.recipient_id,"pending",code,c.campaign.id]);
    await db.query(`update customer_campaign_recipients set status='cancelled',safe_to_retry=false
      where organization_id=$1 and id=$2 and campaign_id=$3 and status='sending'
      and exists(select 1 from customer_campaigns p where p.organization_id=$1 and p.id=$3 and p.status='cancelled')`,
      [c.campaign.organization_id,c.recipient_id,c.campaign.id]);
    await db.query(`update customer_campaigns set next_dispatch_at=$3,updated_at=now()
      where organization_id=$1 and id=$2`,[c.campaign.organization_id,c.campaign.id,until]);
  });
  void audit({action:"org.updated",organizationId:c.campaign.organization_id,resourceType:"customer_campaign",resourceId:c.campaign.id,
    metadata:{operation:"campaign.recipient_deferred",recipient_id:c.recipient_id,attempt_id:c.attempt_id,code,retry_at:until.toISOString()}});
}
export function createCampaignDispatchHandler(deps:DispatchDependencies):EventHandler {
  return {key:KEY,events:["campaign.dispatch_requested"],async handle(row) {
    if(!row.entity_id || row.entity_kind!=="customer_campaign") return {...done(),status:"skipped"};
    const pool=deps.pool();
    const claim=await acquire(pool,row);
    if("consumer_key" in claim) return claim;
    const c=claim;
    let enteredSink=false;
    let receipt:Message|undefined;
    try {
      const contact=await assertPermission(pool,c);
      const body=validateTemplate(c.campaign.template_snapshot,c.campaign.template_values);
      const boundary=await readCurrentServiceBoundary(pool,c.campaign.organization_id,c.conversation_id);
      if(!boundary) throw new StaleServiceBoundaryError();
      // A guarda de serviço canônica é invocada pelo handler e pelo adapter's
      // beforeSend. O Queryable acrescenta a autorização revogável da campanha
      // nessa MESMA fronteira; não cria transporte nem pula o pipeline normal.
      const guardedDb:Queryable={async query(sql,params) { await assertPermission(pool,c);return pool.query(sql,params); }};
      const result=await deps.beforeSend({pool,log:logger,tenantId:c.campaign.organization_id,leadId:c.contact_id,
        channelSessionId:c.campaign.channel_session_id,body,optedOutThisTurn:false,crmDailyLimit:contact.daily_message_limit,
        now:new Date(),isTemplate:true,lgpd:deriveLgpdFromContact(contact,true),disclosureMode:"veto",
        // Copy aprovada é fixa. Pacing e cap continuam na cadeia; spinning não
        // pode alterar o template aprovado nem impedir todos os destinatários.
        enforceSpinning:false,
        send:async finalBody => {
          if(finalBody!==body) throw new Error("campaign_body_changed");
          await assertPermission(pool,c);
          return withServiceBoundary(guardedDb,boundary,async () => {
            enteredSink=true;
            receipt=await deps.send(deps.admin(),{organization_id:c.campaign.organization_id,
              actor:{type:"user",id:c.campaign.launched_by??c.campaign.created_by,role:"manager"},requestId:c.attempt_id,
              internalMessageId:c.message_id,serviceBoundary:boundary},
              {conversation_id:c.conversation_id,type:"template",body,template_name:c.campaign.template_snapshot.name,
                template_language:c.campaign.template_snapshot.language,template_values:c.campaign.template_values,
                metadata:{customer_campaign_id:c.campaign.id,customer_campaign_attempt_id:c.attempt_id}});
            if(["sent","delivered","read"].includes(receipt.status)) return {kind:"sent",idempotencyKey:c.attempt_id,messageId:receipt.id};
            if(receipt.status==="queued") return {kind:"queued",idempotencyKey:c.attempt_id,messageId:receipt.id};
            return {kind:"failed",idempotencyKey:c.attempt_id,messageId:receipt.id};
          });
        }});
      if(result.status==="vetoed") {
        if(!enteredSink && result.nextAllowedAt && Number.isFinite(result.nextAllowedAt.getTime())) {
          const until=new Date(Math.max(result.nextAllowedAt.getTime(),Date.now()+c.campaign.delay_seconds*1000));
          await deferSend(pool,c,until,result.code);
          return retry(until);
        }
        await settle(pool,c,{state:"failed",safe:true,error:result.code});
      } else if(result.outcome.kind==="sent" || result.outcome.kind==="already_sent") {
        await settle(pool,c,{state:"sent",safe:false,error:null,messageId:receipt?.id??undefined});
      } else if(result.outcome.kind==="queued") {
        // queued também pode significar POST aceito + falha de gravação do
        // recibo. Sem prova pré-POST, nunca liberar outra intenção de envio.
        await settle(pool,c,{state:"needs_review",safe:false,error:"send_outcome_uncertain",messageId:receipt?.id});
      } else {
        await settle(pool,c,{state:"needs_review",safe:false,error:receipt?.error_code??"send_outcome_uncertain",messageId:receipt?.id});
      }
    } catch {
      // Mesmo se uma escrita de recibo falhou, nunca fabricar nova intenção.
      const {rows:messages}=await pool.query<{id:string;status:string}>("select id,status from messages where organization_id=$1 and id=$2",[c.campaign.organization_id,c.message_id]);
      const m=messages[0];
      if(m && ["sent","delivered","read"].includes(m.status)) await settle(pool,c,{state:"sent",safe:false,error:null,messageId:m.id});
      else {
        const safe=!enteredSink;
        await settle(pool,c,{state:safe?"failed":"needs_review",safe,error:safe?"pre_send_guard":"send_outcome_uncertain",messageId:m?.id});
      }
    }
    // Um destinatário por aquisição; a espera é durável, sem sleep em worker.
    return retry(new Date(Date.now()+c.campaign.delay_seconds*1000));
  }};
}
export const campaignDispatchHandler=createCampaignDispatchHandler({pool:getRequestPool,send:sendMessageHandler,admin:createAdminClient,beforeSend:runBeforeSend});
