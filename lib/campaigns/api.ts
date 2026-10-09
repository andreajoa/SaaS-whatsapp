import { randomUUID } from "node:crypto";
import { requireRole } from "@/lib/auth/require-role";
import { requireSupportWrite } from "@/lib/impersonate/support";
import { fail, ok } from "@/lib/api/wrappers";
import type { CampaignContext } from "./service";
import type { NextResponse } from "next/server";
import { ZodError } from "zod";

export async function campaignApi(write: boolean, fn:(ctx:CampaignContext)=>Promise<NextResponse>) {
  const requestId=randomUUID();
  const auth=await requireRole(write?"manager":"viewer",{requestId,resource:"customer_campaign"});
  if(!auth.ok) return auth.response;
  if(write) { const denied=await requireSupportWrite(auth.org.orgId); if(denied) return denied; }
  try { return await fn({organizationId:auth.org.orgId,actorUserId:auth.user.id,requestId,support:auth.user.support}); }
  catch(error) {
    if(error instanceof ZodError) return fail("validation_error","Confira os campos da campanha.",422,{requestId,details:error.flatten()});
    if(error instanceof SyntaxError) return fail("invalid_payload","JSON inválido.",400,{requestId});
    // Erros de domínio são legíveis; mensagens de SQL nunca chegam ao cliente.
    const dbError=typeof error==="object" && error!==null && "code" in error;
    return fail(dbError?"internal_error":"invalid_request",dbError?"Não foi possível acessar as campanhas.":error instanceof Error?error.message:"Campanhas indisponíveis.",dbError?503:409,{requestId});
  }
}
export { ok, fail };
