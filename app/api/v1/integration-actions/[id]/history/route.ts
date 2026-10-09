import { actionHistory } from "@/lib/integration-actions/service";
import { actionId, withActionAuth } from "../../_http";
export const dynamic = "force-dynamic";
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) { return withActionAuth("agent", false, async (db, ctx) => actionHistory(db, ctx, await actionId(params))); }
