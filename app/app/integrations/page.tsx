import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/require-role";
import { IntegrationsClient } from "./_components/IntegrationsClient";

export const dynamic = "force-dynamic";
export default async function IntegrationsPage() {
  const auth = await requireRole("admin");
  if (!auth.ok) redirect("/app/inbox");
  return <IntegrationsClient />;
}
