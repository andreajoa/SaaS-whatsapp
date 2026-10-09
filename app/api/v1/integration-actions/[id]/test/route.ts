import { executeAction } from "@/lib/integration-actions/service";
import { executeSchema } from "@/lib/integration-actions/schema";
import { actionId, readJson, withActionAuth } from "../../_http";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return withActionAuth("manager", true, async (db, ctx) => {
    const input = executeSchema.parse(await readJson(req));
    return executeAction(db, ctx, { id: await actionId(params), inputs: input.inputs, confirmMutation: input.confirm_mutation, source: "test" });
  });
}
