import { randomUUID } from "node:crypto";
import type pg from "pg";
import { getRequestPool } from "@/lib/agent-engine/db/request-pool";
import { audit } from "@/lib/audit";
import { supportWriteError, type SupportContext } from "@/lib/impersonate/support";
import { audienceExclusion, nextCampaignState, templateFields, validateTemplate, type AudienceContact, type CampaignAction, type CampaignInput, type TemplateSnapshot } from "./model";
import { assertSnapshot, snapshotHash } from "./snapshot";
import { capabilitiesOf, type ChannelProvider } from "@/lib/channels/capabilities";
import { templateParameterSupportOf } from "@/lib/channels/template-parameter-support";

export interface CampaignContext { organizationId: string; actorUserId: string; requestId: string; support?: SupportContext | null }
export interface CampaignRow {
  id: string; organization_id: string; name: string; channel_session_id: string; status: string;
  template_snapshot: TemplateSnapshot; snapshot_hash: string; template_values: Record<string,string>;
  delay_seconds: number; scheduled_at: Date | null; next_dispatch_at: Date | null;
  created_by: string; launched_by: string | null;
}
export const TEMPLATE_COLUMNS = "id,name,language,status,contract_hash,parameter_format,components";
export const CONTACT_COLUMNS = `c.id,c.name,c.display_name,c.phone_number,c.is_blocked,c.is_anonymized,c.consent,v.id as conversation_id,v.status as conversation_status`;
export const AUDIENCE_JOIN = `from contacts c left join conversations v on v.organization_id=c.organization_id and v.contact_id=c.id and v.channel_session_id=$2 and not v.is_group`;
export const CAMPAIGN_SEND_LEASE_MS = 5 * 60_000;
/** O chamador mantém o lock da campanha; reconhecer recibo nunca autoriza POST. */
export async function reconcileCampaignReceipts(db: pg.PoolClient, org: string, id: string, now = new Date()) {
  const { rows } = await db.query<{ attempt_id: string; recipient_id: string; state: string; started_at: Date; message_id: string | null; message_status: string | null }>(`
    select a.id as attempt_id,r.id as recipient_id,a.state,a.started_at,m.id as message_id,m.status as message_status
    from customer_campaign_attempts a
    join customer_campaign_recipients r on r.organization_id=a.organization_id and r.id=a.recipient_id
    left join messages m on m.organization_id=a.organization_id and m.id=coalesce(a.message_id,a.intended_message_id)
    where a.organization_id=$1 and r.campaign_id=$2 and a.state in ('sending','needs_review')
    and not exists(select 1 from customer_campaign_attempts newer where newer.organization_id=a.organization_id and newer.recipient_id=a.recipient_id
      and (newer.started_at,newer.id)>(a.started_at,a.id))
    for update of a,r`, [org,id]);
  let waitUntil: Date | null = null;
  let needsReview = false;
  let recognized = false;
  for (const a of rows) {
    const received = a.message_status !== null && ["sent","delivered","read"].includes(a.message_status);
    const expires = new Date(new Date(a.started_at).getTime()+CAMPAIGN_SEND_LEASE_MS);
    if (received || (a.state === "sending" && expires <= now)) {
      const state = received ? "sent" : "needs_review";
      await db.query(`update customer_campaign_attempts set state=$3,safe_to_retry=false,message_id=$4,
        error_code=$5,finished_at=coalesce(finished_at,$6) where organization_id=$1 and id=$2`,
        [org,a.attempt_id,state,a.message_id,received?null:"interrupted_send",now]);
      await db.query(`update customer_campaign_recipients set status=$3,safe_to_retry=false,last_error=$4
        where organization_id=$1 and campaign_id=$5 and id=$2`, [org,a.recipient_id,state,received?null:"interrupted_send",id]);
      recognized ||= received;
      needsReview ||= !received;
    } else if (a.state === "sending") {
      if (!waitUntil || expires < waitUntil) waitUntil = expires;
    } else {
      // Revisão explicitamente encerrada pelo manager permanece sem reenvio.
      const current = await db.query("select id from customer_campaign_recipients where organization_id=$1 and campaign_id=$2 and id=$3 and status='needs_review'", [org,id,a.recipient_id]);
      needsReview ||= !!current.rowCount;
    }
  }
  if (recognized) await db.query(`update customer_campaigns set next_dispatch_at=greatest(next_dispatch_at,$3::timestamptz+delay_seconds*interval '1 second')
    where organization_id=$1 and id=$2`, [org,id,now]);
  return { waitUntil, needsReview };
}
export async function transaction<T>(pool: pg.Pool, fn: (db: pg.PoolClient) => Promise<T>): Promise<T> {
  const db = await pool.connect();
  try { await db.query("begin"); const result = await fn(db); await db.query("commit"); return result; }
  catch (error) { await db.query("rollback"); throw error; } finally { db.release(); }
}
export async function loadTemplate(db: pg.Pool | pg.PoolClient, org: string, session: string, id: string, lock = false) {
  const { rows } = await db.query<TemplateSnapshot>(`select ${TEMPLATE_COLUMNS} from meta_templates where organization_id=$1 and channel_session_id=$2 and id=$3${lock ? " for share" : ""}`, [org,session,id]);
  return rows[0] ?? null;
}
export async function ensureSession(db: pg.Pool | pg.PoolClient, org: string, id: string) {
  const { rows } = await db.query<{ id: string; provider: ChannelProvider }>("select id,provider from channel_sessions where organization_id=$1 and id=$2 and archived_at is null",[org,id]);
  if (!rows[0]) throw new Error("Canal indisponível nesta organização.");
  if (!capabilitiesOf(rows[0].provider).requiresTemplates) throw new Error("Este canal não envia modelos aprovados. Selecione um canal oficial conectado.");
  const support = templateParameterSupportOf(rows[0].provider);
  if (!support)
    throw new Error("O envio de componentes deste canal ainda não está disponível.");
  return support;
}
export async function previewAudience(db: pg.Pool | pg.PoolClient, org: string, input: Pick<CampaignInput,"channel_session_id"|"contact_ids"|"template_id"|"template_values">) {
  const support = await ensureSession(db,org,input.channel_session_id);
  const template = await loadTemplate(db,org,input.channel_session_id,input.template_id);
  if (!template) throw new Error("Modelo não encontrado neste canal.");
  const body = validateTemplate(template,input.template_values,support);
  const ids = [...new Set(input.contact_ids)];
  const { rows } = await db.query<AudienceContact>(`select ${CONTACT_COLUMNS} ${AUDIENCE_JOIN} where c.organization_id=$1 and c.id=any($3::uuid[]) order by c.id`,[org,input.channel_session_id,ids]);
  if (rows.length !== ids.length) throw new Error("A seleção contém contato fora desta organização.");
  const audience = rows.map(c => ({ ...c, exclusion: audienceExclusion(c) }));
  return { body, template, snapshot_hash: snapshotHash(template), audience, eligible_count: audience.filter(c => !c.exclusion).length, excluded_count: audience.filter(c => c.exclusion).length };
}
function canWrite(ctx: CampaignContext) {
  const denied = supportWriteError(ctx.support,ctx.organizationId);
  if (denied) throw new Error(denied);
}
function record(ctx: CampaignContext,id: string, operation: string) {
  void audit({ action:"org.updated",actorUserId:ctx.actorUserId,organizationId:ctx.organizationId,
    resourceType:"customer_campaign",resourceId:id,requestId:ctx.requestId,metadata:{operation} });
}
export async function createCampaign(ctx: CampaignContext,input: CampaignInput,pool = getRequestPool()) {
  canWrite(ctx);
  const id = randomUUID();
  const result = await transaction(pool,async db => {
    const preview = await previewAudience(db,ctx.organizationId,input);
    if (preview.excluded_count) throw new Error("Remova os contatos inelegíveis da seleção antes de salvar.");
    const { rows } = await db.query<CampaignRow>(`insert into customer_campaigns(id,organization_id,name,channel_session_id,template_snapshot,snapshot_hash,template_values,delay_seconds,created_by)
      values($1,$2,$3,$4,$5,$6,$7,$8,$9) returning *`,[id,ctx.organizationId,input.name,input.channel_session_id,JSON.stringify(preview.template),preview.snapshot_hash,JSON.stringify(input.template_values),input.delay_seconds,ctx.actorUserId]);
    await db.query(`insert into customer_campaign_recipients(organization_id,campaign_id,contact_id,conversation_id)
      select $1,$2,x.contact_id,x.conversation_id from jsonb_to_recordset($3::jsonb) x(contact_id uuid,conversation_id uuid)`,[ctx.organizationId,id,JSON.stringify(preview.audience.map(c => ({contact_id:c.id,conversation_id:c.conversation_id})))]);
    return rows[0]!;
  });
  record(ctx,id,"campaign.created"); return result;
}
export async function queueDispatch(db: pg.PoolClient,org: string,id: string) {
  await db.query(`select emit_event('campaign.dispatch_requested','customer_campaign',$2::uuid,'{}'::jsonb,'{}'::jsonb,$1::uuid)`,[org,id]);
}
export async function campaignAction(ctx: CampaignContext,id: string,action: CampaignAction,pool = getRequestPool()) {
  canWrite(ctx);
  const result = await transaction(pool,async db => {
    const { rows } = await db.query<CampaignRow>("select * from customer_campaigns where organization_id=$1 and id=$2 for update",[ctx.organizationId,id]);
    const c = rows[0]; if (!c) throw new Error("Campanha não encontrada.");
    const reconciliation = await reconcileCampaignReceipts(db,ctx.organizationId,id);
    if (action.action === "resolve_review") {
      if (!["paused","completed","cancelled"].includes(c.status)) throw new Error("Pause a campanha antes de conferir o envio incerto.");
      const resolved = await db.query(`update customer_campaign_recipients r set status='cancelled',safe_to_retry=false,last_error='reviewed_no_resend'
        where r.organization_id=$1 and r.campaign_id=$2 and r.id=$3 and r.status='needs_review' returning r.id`,[ctx.organizationId,id,action.recipient_id]);
      if (!resolved.rowCount) throw new Error("Este destinatário não está aguardando revisão. Atualize a campanha para conferir o recibo atual.");
      // Mantém o histórico incerto da tentativa, impedindo retry. Um recibo
      // posterior ainda pode reconhecer o envio sem mudar a pausa/cancelamento.
      return c;
    }
    if (action.action === "retry") {
      if (!["paused","completed"].includes(c.status)) throw new Error("Pause a campanha antes de preparar uma nova tentativa.");
      // Falha no transporte NÃO é retry seguro: o canal pode ter aceitado o POST.
      const retried = await db.query(`update customer_campaign_recipients r set status='pending',safe_to_retry=false,last_error=null
        where r.organization_id=$1 and r.campaign_id=$2 and r.id=$3 and r.status='failed' and r.safe_to_retry
        and not exists(select 1 from customer_campaign_attempts a where a.organization_id=r.organization_id and a.recipient_id=r.id and a.state in ('sending','sent','needs_review')) returning r.id`,[ctx.organizationId,id,action.recipient_id]);
      if (!retried.rowCount) throw new Error("Este envio não tem uma falha comprovadamente segura para repetir.");
      await db.query("update customer_campaigns set status='paused',updated_at=now() where organization_id=$1 and id=$2",[ctx.organizationId,id]);
      return {...c,status:"paused"};
    }
    const scheduledAt = action.action === "launch" && action.scheduled_at ? new Date(action.scheduled_at) : null;
    if (scheduledAt && scheduledAt <= new Date()) throw new Error("Escolha um horário futuro.");
    const state = nextCampaignState(c.status,action.action,!!scheduledAt);
    if (["launch","resume"].includes(action.action)) {
      if (reconciliation.needsReview) throw new Error("Confira e encerre os envios incertos antes de retomar os pendentes.");
      const pending = await db.query("select id from customer_campaign_recipients where organization_id=$1 and campaign_id=$2 and status='pending' limit 1",[ctx.organizationId,id]);
      if (!pending.rowCount) {
        if (action.action === "resume" && !reconciliation.waitUntil) {
          await db.query("update customer_campaigns set status='completed',updated_at=now() where organization_id=$1 and id=$2",[ctx.organizationId,id]);
          return {...c,status:"completed"};
        }
        if (!reconciliation.waitUntil) throw new Error("A campanha não possui destinatários pendentes.");
      }
      const support = await ensureSession(db,ctx.organizationId,c.channel_session_id);
      assertSnapshot(c.template_snapshot,c.snapshot_hash,await loadTemplate(db,ctx.organizationId,c.channel_session_id,c.template_snapshot.id,true));
      validateTemplate(c.template_snapshot,c.template_values,support);
    }
    const { rows: updated } = await db.query<CampaignRow>(`update customer_campaigns set status=$3,
      scheduled_at=case when $4::timestamptz is not null then $4 else scheduled_at end,
      next_dispatch_at=case when $3 in ('scheduled','running') then coalesce($4::timestamptz,greatest(next_dispatch_at,now())) else next_dispatch_at end,
      launched_by=case when $3 in ('scheduled','running') then $5::uuid else launched_by end,updated_at=now()
      where organization_id=$1 and id=$2 returning *`,[ctx.organizationId,id,state,scheduledAt,ctx.actorUserId]);
    if (state === "cancelled") await db.query("update customer_campaign_recipients set status='cancelled',safe_to_retry=false where organization_id=$1 and campaign_id=$2 and status='pending'",[ctx.organizationId,id]);
    if (["running","scheduled"].includes(state)) await queueDispatch(db,ctx.organizationId,id);
    return updated[0]!;
  });
  record(ctx,id,`campaign.${action.action}`); return result;
}
export async function campaignList(org: string,pool = getRequestPool()) {
  const { rows } = await pool.query(`select c.*, coalesce(jsonb_object_agg(t.status,t.n) filter(where t.status is not null),'{}') as counts
    from customer_campaigns c left join (select campaign_id,status,count(*)::int n from customer_campaign_recipients where organization_id=$1 group by campaign_id,status) t on t.campaign_id=c.id
    where c.organization_id=$1 group by c.id order by c.created_at desc limit 100`,[org]); return rows;
}
export async function campaignDetail(org: string,id: string,pool = getRequestPool()) {
  const campaign = await transaction(pool, async db => {
    const { rows } = await db.query<CampaignRow>("select * from customer_campaigns where organization_id=$1 and id=$2 for update",[org,id]);
    if (!rows[0]) return null;
    await reconcileCampaignReceipts(db,org,id);
    return rows[0];
  });
  if (!campaign) return null;
  const recipients = await pool.query(`select r.*,c.display_name,c.name,a.id as attempt_id,a.state as attempt_state,a.started_at,a.intended_message_id,
    m.id as message_id,m.status as delivery_status,m.error_code,m.error_message,m.delivered_at,m.read_at,
    (select count(*)::int from customer_campaign_attempts h where h.organization_id=r.organization_id and h.recipient_id=r.id) as attempts
    from customer_campaign_recipients r join contacts c on c.organization_id=r.organization_id and c.id=r.contact_id
    left join lateral(select * from customer_campaign_attempts h where h.organization_id=r.organization_id and h.recipient_id=r.id order by h.started_at desc,h.id desc limit 1) a on true
    left join messages m on m.organization_id=r.organization_id and m.id=coalesce(a.message_id,a.intended_message_id)
    where r.organization_id=$1 and r.campaign_id=$2 order by r.id`,[org,id]);
  const counts:Record<string,number> = {};
  for (const r of recipients.rows) { counts[r.status] = (counts[r.status]??0)+1; if (r.delivery_status) counts[`delivery_${r.delivery_status}`]=(counts[`delivery_${r.delivery_status}`]??0)+1; }
  return {...campaign,recipients:recipients.rows,counts};
}
export async function campaignOptions(org: string,session?: string,pool = getRequestPool()) {
  const { rows:sessions } = await pool.query("select id,display_name,status from channel_sessions where organization_id=$1 and archived_at is null order by created_at",[org]);
  if (!session) return {sessions,templates:[],contacts:[]};
  const support = await ensureSession(pool,org,session);
  const templates = await pool.query<TemplateSnapshot>(`select ${TEMPLATE_COLUMNS} from meta_templates where organization_id=$1 and channel_session_id=$2 and status='APPROVED' order by name,language`,[org,session]);
  const contacts = await pool.query<AudienceContact>(`select ${CONTACT_COLUMNS} ${AUDIENCE_JOIN} where c.organization_id=$1 order by coalesce(c.display_name,c.name),c.id limit 500`,[org,session]);
  return { sessions,templates:templates.rows.map(t => ({...t,fields:templateFields(t),parameter_support:support})),contacts:contacts.rows.map(c => ({...c,exclusion:audienceExclusion(c)})) };
}
