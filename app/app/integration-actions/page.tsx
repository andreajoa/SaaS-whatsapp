import { redirect } from "next/navigation";
import { requireAuth, resolveActiveOrg } from "@/lib/auth/server";
import { roleAtLeast } from "@/lib/auth/types";
import { traduzir } from "@/lib/i18n/dicionario";
import { IntegrationActionsClient } from "./_components/IntegrationActionsClient";

export const dynamic = "force-dynamic";
export default async function IntegrationActionsPage() {
  const user = await requireAuth();
  const org = await resolveActiveOrg(user);
  if (!org || !roleAtLeast(org.role, "manager")) redirect("/app/inbox");
  return <div className="space-y-6 p-4 md:p-6">
    <header>
      <h1 className="text-2xl font-semibold tracking-tight">{traduzir("Ações de integração", user.idioma)}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{traduzir("Conecte seus agentes a APIs externas para consultar informações e concluir operações durante o atendimento.", user.idioma)}</p>
    </header>
    <IntegrationActionsClient />
  </div>;
}
