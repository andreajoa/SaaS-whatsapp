import { z } from "zod";
import { campaignApi,ok,fail } from "@/lib/campaigns/api";
import { campaignDetail } from "@/lib/campaigns/service";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function GET(_req:Request,route:{params:Promise<{id:string}>}) { return campaignApi(false,async ctx=>{
  const id=z.string().uuid().parse((await route.params).id);
  const data=await campaignDetail(ctx.organizationId,id);
  return data?ok(data,{requestId:ctx.requestId}):fail("not_found","Campanha não encontrada.",404,{requestId:ctx.requestId});
}); }
