import { redirect } from "next/navigation";
import { requireAuth, resolveActiveOrg } from "@/lib/auth/server";
import { QualityDashboard } from "./quality-dashboard";
export const dynamic = "force-dynamic";
export default async function ServiceQualityPage() {
  const user = await requireAuth();
  if (!(await resolveActiveOrg(user))) redirect("/app");
  return <QualityDashboard />;
}
