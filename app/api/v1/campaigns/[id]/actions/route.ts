import { z } from "zod";
import { campaignApi,ok } from "@/lib/campaigns/api";
import { actionSchema } from "@/lib/campaigns/model";
import { campaignAction } from "@/lib/campaigns/service";
export const runtime="nodejs";
export async function POST(req:Request,route:{params:Promise<{id:string}>}) { return campaignApi(true,async ctx=>{
  const id=z.string().uuid().parse((await route.params).id);
  return ok(await campaignAction(ctx,id,actionSchema.parse(await req.json())),{requestId:ctx.requestId});
}); }
