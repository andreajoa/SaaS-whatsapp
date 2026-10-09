import { requireRole } from "@/lib/auth/require-role";
import { redirect } from "next/navigation";
import CampaignManager from "./campaign-manager";
export default async function CampaignsPage() {
  const auth=await requireRole("viewer",{resource:"customer_campaign"});
  if(!auth.ok) redirect("/app/inbox");
  const canManage=["manager","admin"].includes(auth.org.role) && (!auth.user.support || auth.user.support.access_mode==="full");
  return <CampaignManager canManage={canManage}/>;
}
