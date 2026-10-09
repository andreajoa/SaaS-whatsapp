import { z } from "zod";
import { campaignApi,ok } from "@/lib/campaigns/api";
import { campaignOptions } from "@/lib/campaigns/service";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function GET(req:Request) { return campaignApi(false,async ctx=>{
  const session=z.string().uuid().optional().parse(new URL(req.url).searchParams.get("channel_session_id")??undefined);
  return ok(await campaignOptions(ctx.organizationId,session),{requestId:ctx.requestId});
}); }
