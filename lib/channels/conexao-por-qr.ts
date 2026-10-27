/**
 * Conexão do WhatsApp por QR pela conta DA INSTALAÇÃO — o lado de dentro do
 * seam.
 *
 * As rotas (`app/api/v1/channels/partner/qr/*` e
 * `app/api/v1/webhooks/channel/plataforma`) e a tela não podem saber com quem
 * falam (`lint:channels`). Elas pedem "o link", "conclua", "desconecte" e "de
 * quem é este evento"; quem é o provedor e como se chamam as colunas dele
 * moram aqui.
 *
 * O ciclo inteiro:
 *
 *   1. `iniciarConexaoPorQr` — garante o perfil da organização e o webhook
 *      único, e devolve o link da janela de conexão.
 *   2. O cliente escaneia o QR com o app WhatsApp Business (coexistência).
 *   3. `concluirConexaoPorQr` — na volta, confere com o provedor que a conta é
 *      do perfil desta organização e grava a sessão como as conexões por
 *      credencial já gravam: a partir daí envio, recebimento, modelos e avisos
 *      são os que já existiam.
 *   4. `desconectarDaPlataforma` — ao excluir o canal, o número sai da conta da
 *      instalação e para de ser cobrado.
 */
import { randomBytes } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

import { decryptWebhookSecret, encryptWebhookSecret } from "@/lib/webhooks/secrets";

import { ARCHIVED_AT, queryTolerantToMissingArchived } from "./archived";
import { CHANNEL_PROVIDER_ZERNIO } from "./capabilities";
import {
  codigoDaOrigemQr,
  emitirEstadoQr,
  type OrigemDaConexaoPorQr,
} from "./conexao-por-qr-estado";
import { findPartnerSession, savePartnerSession, PARTNER_CHANNEL_PROVIDER } from "./connect";
import { lerEnvelopeZernio } from "./zernio/envelope";
import {
  chaveDaPlataforma,
  contaDoPerfil,
  desconectarConta,
  ErroDoProvedor,
  garantirPerfil,
  garantirWebhook,
  linkDeConexao,
  segredoDoWebhookDaPlataforma,
} from "./zernio/plataforma";
import { verifyZernioSignature } from "./zernio/webhook";

/** Caminhos públicos — os dois lados do fluxo que o provedor chama. */
export const CAMINHO_DA_VOLTA_QR = "/api/v1/channels/partner/qr/retorno";
export const CAMINHO_DO_WEBHOOK_DA_PLATAFORMA = "/api/v1/webhooks/channel/plataforma";

/**
 * A instalação oferece conexão por QR pela conta dela? Precisa da chave do
 * provedor E do segredo do servidor (sem ele a volta não é verificável e o
 * webhook não é assinável).
 */
export function conexaoPorQrDisponivel(segredoDoServidor: string | undefined | null): boolean {
  return !!chaveDaPlataforma() && (segredoDoServidor?.trim().length ?? 0) >= 16;
}

export type FalhaDaConexaoPorQr =
  | "indisponivel"
  | "provedor"
  | "conta_nao_encontrada"
  | "gravacao";

export class ErroDaConexaoPorQr extends Error {
  constructor(
    public readonly motivo: FalhaDaConexaoPorQr,
    message: string,
  ) {
    super(message);
    this.name = "ErroDaConexaoPorQr";
  }
}

function base(url: string): string {
  return url.replace(/\/+$/, "");
}

/** Passo 1: o link da janela de conexão. */
export async function iniciarConexaoPorQr(dados: {
  organizationId: string;
  userId: string;
  nomeDaOrganizacao: string;
  baseUrl: string;
  origem: OrigemDaConexaoPorQr;
  idioma: "pt-BR" | "es";
  marca: string;
  corPrimaria: string | null;
  segredoDoServidor: string;
  agora: Date;
}): Promise<string> {
  const chave = chaveDaPlataforma();
  if (!chave || !conexaoPorQrDisponivel(dados.segredoDoServidor)) {
    throw new ErroDaConexaoPorQr("indisponivel", "Conexão por QR não configurada nesta instalação.");
  }
  try {
    const profileId = await garantirPerfil(chave, dados.organizationId, dados.nomeDaOrganizacao);
    await garantirWebhook(
      chave,
      `${base(dados.baseUrl)}${CAMINHO_DO_WEBHOOK_DA_PLATAFORMA}`,
      segredoDoWebhookDaPlataforma(dados.segredoDoServidor),
    );
    const estado = emitirEstadoQr({ organizationId: dados.organizationId, userId: dados.userId }, {
      segredo: dados.segredoDoServidor,
      agora: dados.agora,
    });
    const volta = new URL(`${base(dados.baseUrl)}${CAMINHO_DA_VOLTA_QR}`);
    volta.searchParams.set("o", estado.o);
    volta.searchParams.set("u", estado.u);
    volta.searchParams.set("x", estado.x);
    volta.searchParams.set("s", estado.s);
    volta.searchParams.set("d", codigoDaOrigemQr(dados.origem));
    return await linkDeConexao(chave, {
      profileId,
      redirectUrl: volta.toString(),
      marca: dados.marca,
      idioma: dados.idioma,
      corPrimaria: dados.corPrimaria,
    });
  } catch (err) {
    if (err instanceof ErroDaConexaoPorQr) throw err;
    throw new ErroDaConexaoPorQr(
      "provedor",
      err instanceof Error ? err.message : "falha ao falar com o provedor",
    );
  }
}

export interface ConexaoConcluida {
  channelSessionId: string;
  accountId: string;
  telefone: string | null;
  nome: string;
  /** `false` quando a organização já tinha esta mesma conta gravada. */
  nova: boolean;
}

/**
 * Passo 3: confere a conta com o provedor e grava a sessão.
 *
 * O perfil é procurado pelo id da organização (`externalId`), nunca aceito da
 * URL: o `profileId` da barra de endereços só serve para conferir que bate.
 */
export async function concluirConexaoPorQr(
  admin: SupabaseClient,
  dados: {
    organizationId: string;
    nomeDaOrganizacao: string;
    accountId: string;
    profileIdDaVolta: string | null;
    segredoDoServidor: string;
    nomePadrao: string;
  },
): Promise<ConexaoConcluida> {
  const chave = chaveDaPlataforma();
  if (!chave || !conexaoPorQrDisponivel(dados.segredoDoServidor)) {
    throw new ErroDaConexaoPorQr("indisponivel", "Conexão por QR não configurada nesta instalação.");
  }

  let conta: Awaited<ReturnType<typeof contaDoPerfil>>;
  try {
    const profileId = await garantirPerfil(chave, dados.organizationId, dados.nomeDaOrganizacao);
    if (dados.profileIdDaVolta && dados.profileIdDaVolta !== profileId) {
      throw new ErroDaConexaoPorQr("conta_nao_encontrada", "perfil da volta não é o desta organização");
    }
    conta = await contaDoPerfil(chave, profileId, dados.accountId);
  } catch (err) {
    if (err instanceof ErroDaConexaoPorQr) throw err;
    throw new ErroDaConexaoPorQr(
      "provedor",
      err instanceof ErroDoProvedor ? err.message : "falha ao conferir a conta",
    );
  }
  if (!conta) {
    throw new ErroDaConexaoPorQr("conta_nao_encontrada", "a conta não pertence ao perfil desta organização");
  }

  const chaveCifrada = await encryptWebhookSecret(admin, chave);
  const segredoCifrado = await encryptWebhookSecret(
    admin,
    segredoDoWebhookDaPlataforma(dados.segredoDoServidor),
  );
  if (!chaveCifrada || !segredoCifrado) {
    throw new ErroDaConexaoPorQr("gravacao", "cifra indisponível nesta instalação");
  }

  const existente = await findPartnerSession(admin, dados.organizationId);
  const nova = !existente || !!existente.archivedAt || existente.accountId !== conta.accountId;
  const nome = conta.nome ?? dados.nomePadrao;

  // Trocar de número por cima de outro: o anterior sai da conta da instalação,
  // senão seguiria cobrado sem ninguém usá-lo.
  if (existente && !existente.archivedAt && existente.accountId && existente.accountId !== conta.accountId) {
    await desconectarConta(chave, existente.accountId).catch(() => undefined);
  }

  const { error } = await savePartnerSession(admin, {
    organizationId: dados.organizationId,
    existingId: existente?.id ?? null,
    accountId: conta.accountId,
    apiKeyEncrypted: chaveCifrada,
    // A URL por token continua existindo para a sessão (é o contrato da
    // tabela), mas quem entrega é o webhook único da instalação.
    webhookPathToken: existente?.webhookPathToken ?? randomBytes(16).toString("hex"),
    webhookSecretEncrypted: segredoCifrado,
    phoneNumber: conta.telefone,
    displayName: nome,
  });
  if (error) throw new ErroDaConexaoPorQr("gravacao", error);

  const gravada = await findPartnerSession(admin, dados.organizationId);
  if (!gravada) throw new ErroDaConexaoPorQr("gravacao", "a sessão não foi encontrada depois de gravada");

  return {
    channelSessionId: gravada.id,
    accountId: conta.accountId,
    telefone: conta.telefone,
    nome,
    nova,
  };
}

/**
 * Passo 4: tira o número da conta da instalação. Não lança — excluir o canal no
 * CRM não pode falhar porque o provedor está fora do ar; o pior caso é o número
 * seguir na conta até alguém desconectá-lo no painel dele.
 */
export async function desconectarDaPlataforma(
  admin: SupabaseClient,
  organizationId: string,
  channelSessionId: string,
): Promise<{ desconectado: boolean }> {
  const chave = chaveDaPlataforma();
  if (!chave) return { desconectado: false };
  const { data } = await admin
    .from("channel_sessions")
    .select("provider, zernio_account_id")
    .eq("organization_id", organizationId)
    .eq("id", channelSessionId)
    .maybeSingle();
  const accountId = data?.zernio_account_id as string | null | undefined;
  if (!data || data.provider !== PARTNER_CHANNEL_PROVIDER || !accountId) return { desconectado: false };
  try {
    await desconectarConta(chave, accountId);
    return { desconectado: true };
  } catch {
    return { desconectado: false };
  }
}

// ---------------------------------------------------------------------------
// Entrada pelo webhook único
// ---------------------------------------------------------------------------

export type LeituraDoEventoDaPlataforma =
  | {
      ok: true;
      accountId: string | null;
      /**
       * A organização dona do perfil do evento — o `externalId` que
       * `garantirPerfil` gravou. Confiável porque o corpo passou pelo HMAC da
       * instalação. `null` em evento sem perfil (número provisionado, teste).
       */
      organizationId: string | null;
    }
  | { ok: false; motivo: "indisponivel" | "assinatura" | "json_invalido" };

/**
 * Confere a assinatura com o segredo da instalação e diz de qual conta é o
 * evento. A assinatura vem ANTES de ler qualquer campo: o corpo de um anônimo
 * não pode nem disparar uma consulta ao banco.
 */
export function lerEventoDaPlataforma(
  rawBody: string,
  headers: Headers,
  segredoDoServidor: string | undefined | null,
): LeituraDoEventoDaPlataforma {
  if (!conexaoPorQrDisponivel(segredoDoServidor)) return { ok: false, motivo: "indisponivel" };
  const segredo = segredoDoWebhookDaPlataforma(segredoDoServidor as string);
  if (!verifyZernioSignature(rawBody, headers.get("x-zernio-signature"), segredo)) {
    return { ok: false, motivo: "assinatura" };
  }
  const leitura = lerEnvelopeZernio(rawBody);
  if (!leitura.ok) {
    // Assinado mas fora do contrato: sem conta não há para onde entregar.
    return leitura.motivo === "json_invalido"
      ? { ok: false, motivo: "json_invalido" }
      : { ok: true, accountId: null, organizationId: null };
  }
  const e = leitura.envelope;
  return {
    ok: true,
    accountId: e.accountId ?? e.account?.accountId ?? e.account?.id ?? null,
    organizationId: organizacaoDoEvento(rawBody),
  };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * `profiles[].externalId` do evento. Lido do corpo cru e não do envelope porque
 * o envelope (`./zernio/envelope.ts`) é o contrato da rota por token, que não
 * usa perfis. Só aceita UUID: o `externalId` é escrito por nós, então qualquer
 * outra forma é perfil que não nasceu por aqui.
 */
function organizacaoDoEvento(rawBody: string): string | null {
  try {
    const corpo = JSON.parse(rawBody) as { profiles?: unknown };
    if (!Array.isArray(corpo.profiles)) return null;
    const ids = new Set(
      corpo.profiles
        .map((p) => (p && typeof p === "object" ? (p as { externalId?: unknown }).externalId : null))
        .filter((v): v is string => typeof v === "string" && UUID.test(v)),
    );
    // Um evento atribuído a dois perfis nossos não tem dono único.
    return ids.size === 1 ? [...ids][0]! : null;
  } catch {
    return null;
  }
}

export interface SessaoDaPlataforma {
  id: string;
  organization_id: string;
  provider: string;
  display_name: string | null;
  phone_number: string | null;
  webhook_secret_encrypted: unknown;
}

/**
 * A sessão ATIVA desta organização que atende esta conta. Mais de uma é
 * recusado: entregar o evento a uma delas por sorte é exatamente o defeito que
 * o índice único da migration 0165 existe para impedir.
 */
export async function sessaoDaContaDaPlataforma(
  admin: SupabaseClient,
  organizationId: string,
  accountId: string,
): Promise<{ sessao: SessaoDaPlataforma | null; ambigua: boolean }> {
  const colunas =
    "id, organization_id, provider, display_name, phone_number, webhook_secret_encrypted";
  // `organization_id` À MÃO (service role bypassa RLS), vindo do perfil do
  // evento assinado — o mesmo recorte de `zernioCredsForAccountId` (issue #236).
  const base = () =>
    admin
      .from("channel_sessions")
      .select(colunas)
      .eq("organization_id", organizationId)
      .eq("provider", CHANNEL_PROVIDER_ZERNIO)
      .eq("zernio_account_id", accountId);
  const { data, error } = await queryTolerantToMissingArchived(
    () => base().is(ARCHIVED_AT, null).limit(2),
    () => base().limit(2),
  );
  if (error) throw new Error(`sessao_da_plataforma: ${error.message ?? "erro"}`);
  const linhas = (data ?? []) as unknown as SessaoDaPlataforma[];
  if (linhas.length > 1) return { sessao: null, ambigua: true };
  return { sessao: linhas[0] ?? null, ambigua: false };
}

// ---------------------------------------------------------------------------
// Números de quem perdeu o acesso
// ---------------------------------------------------------------------------

/**
 * Dias de folga depois de a conta perder o acesso, antes de o número sair da
 * conta da instalação. É o tempo de alguém pagar o boleto atrasado sem ter de
 * ler o QR de novo — e passar disso é pagar todo mês por um número que ninguém
 * usa, sem ninguém do outro lado para avisar.
 */
export const FOLGA_ANTES_DE_LIBERAR_DIAS = 14;

const DIA_MS = 86_400_000;

export type AcessoParaLiberar = {
  acesso: string;
  /** Quando o acesso acabou: fim do teste ou do ciclo pago. `null` = não se sabe. */
  expiraEm: Date | null;
};

/**
 * Desde quando esta organização está sem acesso — ou `null` se ela TEM acesso.
 * Só os dois estados explícitos contam: qualquer outro (inclusive a falha de
 * leitura, que `estadoDaCobranca` devolve como `em_dia`) deixa o número onde
 * está. Desconectar o WhatsApp de quem paga é o pior erro possível aqui.
 */
export function semAcessoDesde(estado: AcessoParaLiberar, orgCriadaEm: Date | null): Date | null {
  if (estado.acesso !== "sem_cartao" && estado.acesso !== "vencido") return null;
  if (estado.expiraEm) return estado.expiraEm;
  // `sem_cartao` sem data: nunca pôs a IA para responder e passou do prazo de
  // começar o teste (14 dias de conta). Conta-se a partir daí.
  return orgCriadaEm ? new Date(orgCriadaEm.getTime() + 14 * DIA_MS) : null;
}

export interface NumeroLiberado {
  organizationId: string;
  channelSessionId: string;
}

/**
 * Tira da conta da instalação os números das organizações sem acesso há mais
 * de `FOLGA_ANTES_DE_LIBERAR_DIAS`. O canal fica PARADO, não excluído: ao pagar,
 * o cliente lê o QR de novo e a mesma sessão volta, com o histórico.
 *
 * Só toca sessão cuja chave gravada é a da instalação — número conectado com a
 * conta do próprio cliente no provedor não é custo nosso e não é tocado.
 */
export async function liberarNumerosSemAcesso(
  admin: SupabaseClient,
  dados: {
    agora: Date;
    estadoDaOrganizacao: (organizationId: string, criadaEm: Date | null) => Promise<AcessoParaLiberar>;
    teto?: number;
  },
): Promise<{ conferidos: number; liberados: NumeroLiberado[] }> {
  const chave = chaveDaPlataforma();
  if (!chave) return { conferidos: 0, liberados: [] };

  const { data, error } = await queryTolerantToMissingArchived(
    () =>
      admin
        .from("channel_sessions")
        .select("id, organization_id, zernio_account_id, zernio_token_encrypted, status")
        .eq("provider", CHANNEL_PROVIDER_ZERNIO)
        .not("zernio_account_id", "is", null)
        .neq("status", "STOPPED")
        .is(ARCHIVED_AT, null)
        .limit(dados.teto ?? 200),
    () =>
      admin
        .from("channel_sessions")
        .select("id, organization_id, zernio_account_id, zernio_token_encrypted, status")
        .eq("provider", CHANNEL_PROVIDER_ZERNIO)
        .not("zernio_account_id", "is", null)
        .neq("status", "STOPPED")
        .limit(dados.teto ?? 200),
  );
  if (error) throw new Error(`liberar_numeros: ${error.message ?? "erro"}`);

  const linhas = (data ?? []) as {
    id: string;
    organization_id: string;
    zernio_account_id: string;
    zernio_token_encrypted: unknown;
  }[];
  const liberados: NumeroLiberado[] = [];

  for (const linha of linhas) {
    const chaveDaSessao = linha.zernio_token_encrypted
      ? await decryptWebhookSecret(admin, linha.zernio_token_encrypted as string)
      : null;
    if (chaveDaSessao !== chave) continue;

    const { data: org } = await admin
      .from("organizations")
      .select("created_at")
      .eq("id", linha.organization_id)
      .maybeSingle();
    const criadaEm = org?.created_at ? new Date(org.created_at as string) : null;
    const desde = semAcessoDesde(await dados.estadoDaOrganizacao(linha.organization_id, criadaEm), criadaEm);
    if (!desde || dados.agora.getTime() - desde.getTime() < FOLGA_ANTES_DE_LIBERAR_DIAS * DIA_MS) continue;

    try {
      await desconectarConta(chave, linha.zernio_account_id);
    } catch {
      // Provedor fora do ar: a próxima rodada tenta de novo. Marcar PARADO sem
      // ter desconectado esconderia da rodada seguinte um número ainda cobrado.
      continue;
    }
    await admin
      .from("channel_sessions")
      .update({
        status: "STOPPED",
        status_reason: "sem_acesso_ao_plano",
        last_status_change_at: dados.agora.toISOString(),
      })
      .eq("organization_id", linha.organization_id)
      .eq("id", linha.id);
    liberados.push({ organizationId: linha.organization_id, channelSessionId: linha.id });
  }

  return { conferidos: linhas.length, liberados };
}
