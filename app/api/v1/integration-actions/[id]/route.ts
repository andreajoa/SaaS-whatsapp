import { deleteAction, loadAction, saveAction } from "@/lib/integration-actions/service";
import { actionId, readJson, withActionAuth } from "../_http";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
type Params = { params: Promise<{ id: string }> };
export async function GET(_req: Request, { params }: Params) { return withActionAuth("manager", false, async (db, ctx) => loadAction(db, ctx, await actionId(params))); }
export async function PATCH(req: Request, { params }: Params) { return withActionAuth("manager", true, async (db, ctx) => saveAction(db, ctx, await readJson(req), await actionId(params))); }
export async function DELETE(_req: Request, { params }: Params) { return withActionAuth("manager", true, async (db, ctx) => { await deleteAction(db, ctx, await actionId(params)); return { deleted: true }; }); }
