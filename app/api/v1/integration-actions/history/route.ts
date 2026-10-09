import { actionHistory } from "@/lib/integration-actions/service";
import { withActionAuth } from "../_http";
export const dynamic = "force-dynamic";
export async function GET() { return withActionAuth("agent", false, (db, ctx) => actionHistory(db, ctx)); }
