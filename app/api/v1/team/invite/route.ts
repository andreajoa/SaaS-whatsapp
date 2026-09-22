import { requireSupportWrite } from "@/lib/impersonate/support";
import { issueInvite } from "@/lib/auth/issue-invite";
import { emitirConvite } from "@/lib/team/convites";
import { isServiceRoleConfigured } from "@/lib/audit";
/**
 * POST /api/v1/team/invite — bulk-invite up to 20 emails.
 *
 * O que viaja no e-mail é um token HMAC stateless (`lib/auth/invite-token.ts`).
 * Quando o service-role está configurado, cada convite também vira uma linha em
 * `team_invites` (migration 0238) — é o que a tela de Equipe lista e o que
 * torna a revogação possível. Reconvidar um e-mail com convite pendente RENOVA
 * a linha. Sem service-role, degrada para só-token (nada some, só não persiste).
 *
 * Se o e-mail já tem membership ATIVA na org, pula com `already_member`.
 *
 * Membership row is created at /accept-invite time (Server Action) — that's
 * also when audit emits `member.accepted`. Here we audit `member.invited`.
 */
import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";

import { ok, fail } from "@/lib/api/wrappers";
import { ApiError } from "@/lib/api/types";

import { requireRole } from "@/lib/auth/require-role";
import { cabeMaisUm, frasePrimeiraPessoa } from "@/lib/billing/tetos";
import { traduzir } from "@/lib/i18n/dicionario";
import { createAdminClient } from "@/lib/supabase/admin";
import { inviteMemberSchema, validateRequest } from "@/lib/schemas";

export const dynamic = "force-dynamic";

interface SentItem {
  email: string;
  invite_id: string;
  expires_at: string;
  email_dispatched: boolean;
  accept_url: string;
}
interface FailedItem {
  email: string;
  reason: string;
  /**
   * A frase pronta, quando o `reason` sozinho não diz o que fazer. Opcional
   * porque `already_member` se explica; `teto_do_plano` não — ele precisa dizer
   * quantas vagas o plano inclui e onde se muda de plano, ou a recusa vira um
   * nome de código na tela.
   */
  message?: string;
}

export async function POST(req: NextRequest): Promise<Response> {
  const supportDenied = await requireSupportWrite();
  if (supportDenied) return supportDenied;

  const requestId = randomUUID();
  const authz = await requireRole("admin", { requestId, resource: "team" });
  if (!authz.ok) return authz.response;
  const { user: authUser, org: activeOrg } = authz;

  let input;
  try {
    input = await validateRequest(inviteMemberSchema, req);
  } catch (err) {
    if (err instanceof ApiError) {
      return fail(err.code, err.message, err.status, {
        details: err.details as Record<string, unknown> | undefined,
        requestId,
      });
    }
    throw err;
  }

  const sent: SentItem[] = [];
  const failed: FailedItem[] = [];

  const admin = isServiceRoleConfigured() ? createAdminClient() : null;
  const inviterName = authUser.full_name ?? authUser.email ?? "Um colega";
  // Emails com membership ATIVA na org — para pular o reconvite de quem já é membro.
  // O schema `auth` NÃO é acessível via PostgREST (erro "Invalid schema: auth"), então
  // resolvemos email↔usuário pela GoTrue admin API (getUserById) — mesmo padrão de
  // app/api/v1/team/route.ts. N pequeno (poucos membros por org no perfil BPO).
  const memberEmails = new Set<string>();
  if (admin) {
    const { data: members } = await admin
      .from("user_organizations")
      .select("user_id")
      .eq("organization_id", activeOrg.orgId)
      .is("revoked_at", null);
    for (const m of members ?? []) {
      const { data: u } = await admin.auth.admin.getUserById(m.user_id as string);
      const memberEmail = u?.user?.email?.trim().toLowerCase();
      if (memberEmail) memberEmails.add(memberEmail);
    }
  }

  // Convites emitidos NESTA chamada. A pergunta do teto é feita por e-mail, e
  // não uma vez antes do laço, porque este endpoint emite até 20 de uma vez: as
  // linhas recém-escritas ainda não voltam na contagem a cada volta, e sem este
  // contador os 20 passariam por uma única vaga (lib/billing/tetos.ts).
  let emitidosAqui = 0;

  for (const inv of input.invitations) {
    const email = inv.email.trim().toLowerCase();

    // já é membro ativo → pula (não reenvia convite)
    if (memberEmails.has(email)) {
      failed.push({ email, reason: "already_member" });
      continue;
    }

    if (admin) {
      // Recusa POR E-MAIL, e não a chamada inteira: quem mandou 5 nomes com 2
      // vagas fica com os 2 primeiros convidados e lê no corpo por que os
      // outros 3 não saíram. Derrubar a requisição inteira desfaria trabalho
      // que já estava dentro do que a pessoa comprou.
      const cabe = await cabeMaisUm(admin, activeOrg.orgId, "membros", emitidosAqui);
      if (!cabe.permitido) {
        failed.push({
          email,
          reason: "teto_do_plano",
          message: traduzir(frasePrimeiraPessoa("membros", cabe), authUser.idioma),
        });
        continue;
      }
      emitidosAqui += 1;
      const { convite, accept_url, email_dispatched } = await emitirConvite(admin, {
        email,
        role: inv.role,
        interfaceSettings: inv.interface_settings,
        organizationId: activeOrg.orgId,
        orgName: activeOrg.name,
        inviterId: authUser.id,
        inviterName,
        requestId,
      });
      sent.push({
        email,
        invite_id: convite.id,
        expires_at: convite.expires_at,
        email_dispatched,
        accept_url,
      });
    } else {
      sent.push(
        await issueInvite({
          email,
          role: inv.role,
          interfaceSettings: inv.interface_settings,
          organizationId: activeOrg.orgId,
          orgName: activeOrg.name,
          inviterId: authUser.id,
          inviterName,
          requestId,
        }),
      );
    }
  }

  return ok({ sent, failed }, { status: 201, requestId });
}
