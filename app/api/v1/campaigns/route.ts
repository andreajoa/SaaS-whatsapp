import { campaignApi,ok } from "@/lib/campaigns/api";
import { campaignInputSchema } from "@/lib/campaigns/model";
import { campaignList,createCampaign } from "@/lib/campaigns/service";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function GET() { return campaignApi(false,async ctx=>ok(await campaignList(ctx.organizationId),{requestId:ctx.requestId})); }
export async function POST(req:Request) { return campaignApi(true,async ctx=>ok(await createCampaign(ctx,campaignInputSchema.parse(await req.json())),{status:201,requestId:ctx.requestId})); }
