import { campaignApi,ok } from "@/lib/campaigns/api";
import { previewInputSchema } from "@/lib/campaigns/model";
import { previewAudience } from "@/lib/campaigns/service";
import { getRequestPool } from "@/lib/agent-engine/db/request-pool";
export const runtime="nodejs";
export async function POST(req:Request) { return campaignApi(false,async ctx=>ok(await previewAudience(getRequestPool(),ctx.organizationId,previewInputSchema.parse(await req.json())),{requestId:ctx.requestId})); }
