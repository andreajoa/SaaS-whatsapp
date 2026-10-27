/**
 * O canal intermediado pela conta DA INSTALAÇÃO — conexão por QR, sem o
 * cliente ter conta no provedor.
 *
 * ─── O que muda em relação ao caminho por credencial ───────────────────────
 *
 * No caminho de `../connect.ts` quem contratou o provedor é o CLIENTE: ele cola
 * a conta e a chave dele. Aqui quem contratou é a instalação (`ZERNIO_API_KEY`),
 * e cada organização ganha um PERFIL nessa conta. O cliente só escaneia o QR na
 * janela da Meta com o app WhatsApp Business — é a coexistência, o modo padrão
 * do provedor: o número segue funcionando no celular e passa a responder pela
 * API oficial.
 *
 * ─── Por que um webhook só, e não um por organização ───────────────────────
 *
 * O provedor aceita no máximo 50 webhooks por conta. Um por organização
 * travaria a instalação no 51º cliente, sem erro nenhum na tela de quem
 * tentasse conectar. Então existe UM endereço, que recebe os eventos de todos os
 * perfis, e a rota roteia pela conta do evento (`account.accountId`).
 *
 * Medido contra a API em 26/10/2026: os nomes de evento abaixo foram aceitos por
 * `POST /v1/webhooks/settings`; um nome inválido devolve 400 listando os
 * válidos. Perfis não são cobrados; cada número conectado é.
 */
import { createHmac } from "node:crypto";

import { zernioBaseUrl } from "./credentials";

/** O que o resto do sistema já sabe ler (`./webhook.ts`, `./avisos.ts`). */
export const EVENTOS_DO_WEBHOOK_DA_PLATAFORMA = [
  "message.received",
  "message.sent",
  "message.delivered",
  "message.read",
  "message.failed",
  "message.edited",
  "message.deleted",
  "account.connected",
  "account.disconnected",
  "whatsapp.template.status_updated",
  "whatsapp.template.category_updated",
  "whatsapp.account.status_updated",
  "whatsapp.account.quality_updated",
  "whatsapp.account.alert_received",
  "whatsapp.contact.identity_changed",
] as const;

const NOME_DO_WEBHOOK = "Conexão por QR (instalação)";
const TEMPO_MAXIMO_MS = 15_000;

export class ErroDoProvedor extends Error {
  constructor(
    public readonly status: number,
    public readonly codigo: string | null,
    message: string,
  ) {
    super(message);
    this.name = "ErroDoProvedor";
  }
}

/** A chave da conta da instalação, ou `null` quando o recurso está desligado. */
export function chaveDaPlataforma(): string | null {
  const chave = process.env.ZERNIO_API_KEY?.trim();
  return chave ? chave : null;
}

/**
 * Segredo do webhook único, DERIVADO do segredo do servidor.
 *
 * Derivado e não mais uma variável: uma variável nova é mais um passo que o
 * operador esquece, e o esquecimento aqui é silencioso — o provedor entregaria
 * sem assinatura e a rota recusaria tudo. O rótulo fixo separa este uso de
 * qualquer outro HMAC feito com o mesmo `INTERNAL_SECRET`.
 */
export function segredoDoWebhookDaPlataforma(segredoDoServidor: string): string {
  return createHmac("sha256", segredoDoServidor)
    .update("conexao-por-qr/webhook-da-plataforma", "utf8")
    .digest("hex");
}

type Json = Record<string, unknown>;

async function chamar(
  chave: string,
  metodo: "GET" | "POST" | "PUT" | "DELETE",
  caminho: string,
  opcoes: { corpo?: unknown; cabecalhos?: Record<string, string> } = {},
): Promise<{ status: number; json: Json | null }> {
  let res: Response;
  try {
    res = await fetch(`${zernioBaseUrl()}${caminho}`, {
      method: metodo,
      headers: {
        Authorization: `Bearer ${chave}`,
        ...(opcoes.corpo !== undefined ? { "content-type": "application/json" } : {}),
        ...opcoes.cabecalhos,
      },
      body: opcoes.corpo !== undefined ? JSON.stringify(opcoes.corpo) : undefined,
      signal: AbortSignal.timeout(TEMPO_MAXIMO_MS),
    });
  } catch {
    throw new ErroDoProvedor(0, "rede", "Não foi possível falar com o provedor do WhatsApp.");
  }
  const json = (await res.json().catch(() => null)) as Json | null;
  return { status: res.status, json };
}

function falha(r: { status: number; json: Json | null }, contexto: string): never {
  const codigo = typeof r.json?.code === "string" ? r.json.code : null;
  const texto = typeof r.json?.error === "string" ? r.json.error : `HTTP ${r.status}`;
  throw new ErroDoProvedor(r.status, codigo, `${contexto}: ${texto}`);
}

const id = (v: unknown): string | null => {
  if (typeof v === "string" && v) return v;
  if (v && typeof v === "object") {
    const o = v as Json;
    const bruto = o._id ?? o.id;
    return typeof bruto === "string" && bruto ? bruto : null;
  }
  return null;
};

/**
 * O perfil desta organização na conta da instalação — criado na primeira vez.
 *
 * `externalId` = id da organização, e é por ele que se procura: assim o perfil
 * é achado de novo mesmo sem nada gravado do nosso lado, e um retry depois de
 * timeout não cria um segundo. O nome precisa ser único no provedor, por isso
 * leva o começo do id.
 */
export async function garantirPerfil(
  chave: string,
  organizationId: string,
  nomeDaOrganizacao: string,
): Promise<string> {
  const busca = await chamar(
    chave,
    "GET",
    `/v1/profiles?externalId=${encodeURIComponent(organizationId)}`,
  );
  if (busca.status !== 200) falha(busca, "listar perfis");
  const perfis = Array.isArray(busca.json?.profiles) ? (busca.json.profiles as unknown[]) : [];
  const existente = perfis.map(id).find(Boolean);
  if (existente) return existente;

  const nome = `${nomeDaOrganizacao.trim().slice(0, 40) || "Empresa"} · ${organizationId.slice(0, 8)}`;
  const criado = await chamar(chave, "POST", "/v1/profiles", {
    corpo: { name: nome, externalId: organizationId },
    cabecalhos: { "Idempotency-Key": `perfil-${organizationId}` },
  });
  if (criado.status === 200 || criado.status === 201) {
    const novo = id((criado.json?.profile as unknown) ?? null);
    if (novo) return novo;
  }
  if (criado.status === 409) {
    const detalhes = (criado.json?.details ?? {}) as Json;
    const jaExiste = id(detalhes.existingProfileId);
    if (jaExiste) return jaExiste;
  }
  falha(criado, "criar perfil");
}

/**
 * Garante o webhook único apontando para `url`, assinado com `segredo`.
 *
 * Atualiza o que já existe em vez de só conferir que existe: o provedor
 * DESLIGA o webhook depois de três dias falhando (uma janela de deploy ruim
 * basta), e sem o `isActive: true` aqui a instalação ficaria surda até alguém
 * abrir o painel dele.
 */
export async function garantirWebhook(chave: string, url: string, segredo: string): Promise<void> {
  const lista = await chamar(chave, "GET", "/v1/webhooks/settings");
  if (lista.status !== 200) falha(lista, "listar webhooks");
  const webhooks = Array.isArray(lista.json?.webhooks) ? (lista.json.webhooks as Json[]) : [];
  const atual = webhooks.find((w) => typeof w.url === "string" && w.url.trim() === url);

  const corpo = {
    name: NOME_DO_WEBHOOK,
    url,
    secret: segredo,
    events: [...EVENTOS_DO_WEBHOOK_DA_PLATAFORMA],
    isActive: true,
  };
  const r = atual
    ? await chamar(chave, "PUT", "/v1/webhooks/settings", {
        corpo: { webhookId: id(atual), ...corpo },
      })
    : await chamar(chave, "POST", "/v1/webhooks/settings", { corpo });
  if (r.status !== 200 && r.status !== 201) falha(r, "configurar webhook");
}

/**
 * O link da janela de conexão. `signup=hosted`: a página do provedor abre a
 * janela da Meta sozinha e conecta exatamente o número escolhido — sem SDK do
 * Facebook e sem domínio cadastrado do nosso lado. Coexistência é o padrão.
 */
export async function linkDeConexao(
  chave: string,
  dados: {
    profileId: string;
    redirectUrl: string;
    marca: string;
    idioma: "pt-BR" | "es";
    corPrimaria: string | null;
  },
): Promise<string> {
  const q = new URLSearchParams({
    profileId: dados.profileId,
    redirect_url: dados.redirectUrl,
    signup: "hosted",
    onboarding: "business_app",
    brandName: dados.marca.trim().slice(0, 60) || "WhatsApp",
    language: dados.idioma,
  });
  if (dados.corPrimaria && /^#[0-9a-fA-F]{6}$/.test(dados.corPrimaria)) {
    q.set("primaryColor", dados.corPrimaria);
  }
  const r = await chamar(chave, "GET", `/v1/connect/whatsapp?${q.toString()}`);
  const url = r.json?.authUrl;
  if (r.status !== 200 || typeof url !== "string" || !url) falha(r, "gerar link de conexão");
  return url;
}

export interface ContaConectada {
  accountId: string;
  telefone: string | null;
  nome: string | null;
}

/**
 * A conta está mesmo NESTE perfil, e é de WhatsApp?
 *
 * É a prova que importa na volta: o `accountId` chega pela barra de endereços,
 * e só o provedor sabe a qual perfil ele pertence. Uma conta de outro perfil
 * (de outra empresa) nunca pode ser gravada aqui.
 */
export async function contaDoPerfil(
  chave: string,
  profileId: string,
  accountId: string,
): Promise<ContaConectada | null> {
  const q = new URLSearchParams({ profileId, platform: "whatsapp" });
  const r = await chamar(chave, "GET", `/v1/accounts?${q.toString()}`);
  if (r.status !== 200) falha(r, "listar contas");
  const contas = Array.isArray(r.json?.accounts) ? (r.json.accounts as Json[]) : [];
  const conta = contas.find((c) => id(c) === accountId);
  if (!conta) return null;
  if (conta.platform !== undefined && conta.platform !== "whatsapp") return null;
  // Conferido de novo do lado da conta, e não só pelo filtro da busca: se o
  // filtro um dia for ignorado, a lista viria com contas de todos os perfis.
  const perfilDaConta = id(conta.profileId);
  if (perfilDaConta && perfilDaConta !== profileId) return null;

  const meta = (conta.metadata ?? {}) as Json;
  const bruto =
    (typeof meta.displayPhoneNumber === "string" && meta.displayPhoneNumber) ||
    (typeof conta.username === "string" && conta.username) ||
    null;
  const digitos = bruto ? bruto.replace(/\D/g, "") : "";
  return {
    accountId,
    telefone: digitos ? `+${digitos}` : null,
    nome: typeof conta.displayName === "string" && conta.displayName ? conta.displayName : null,
  };
}

/**
 * Desconecta o número da conta da instalação — é o que faz o provedor parar
 * de cobrar por ele. 404 é sucesso: a conta já não existe (ou nunca foi desta
 * conta), e o resultado que se queria já está de pé.
 */
export async function desconectarConta(chave: string, accountId: string): Promise<void> {
  const r = await chamar(chave, "DELETE", `/v1/accounts/${encodeURIComponent(accountId)}`);
  if (r.status === 200 || r.status === 204 || r.status === 404) return;
  falha(r, "desconectar conta");
}
