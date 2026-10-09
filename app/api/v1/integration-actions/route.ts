import { listActions, saveAction } from "@/lib/integration-actions/service";
import { readJson, withActionAuth } from "./_http";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export async function GET() { return withActionAuth("manager", false, listActions); }
export async function POST(req: Request) { return withActionAuth("manager", true, async (db, ctx) => saveAction(db, ctx, await readJson(req)), true); }
