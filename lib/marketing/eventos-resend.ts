import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Eventos do Resend → linha de `email_envios`.
 *
 * Até 11/10/2026 nada gravava `aberto_em`, `clicado_em`, `bounce` ou `reclamou`:
 * o painel mostrava zero aberturas para sempre e a trava "não reenviar para quem
 * deu bounce/reclamou" (`automacoes`, `sequencia`) nunca disparava — o que,
 * repetido, é como um domínio vai para a lista de spam.
 */

/** Janela da assinatura, a mesma do Svix (quem assina pelo Resend): 5 minutos. */
const TOLERANCIA_S = 5 * 60;

/**
 * Verifica `svix-signature` = `v1,<base64(HMAC-SHA256(id.timestamp.corpo))>`,
 * com a chave `whsec_<base64>` que o Resend mostra ao criar o webhook.
 * O cabeçalho pode trazer várias assinaturas separadas por espaço (rotação).
 */
export function assinaturaResendValida(
  corpo: string,
  cabecalhos: { id: string | null; timestamp: string | null; assinatura: string | null },
  segredo: string,
  agoraS = Math.floor(Date.now() / 1000),
): boolean {
  const { id, timestamp, assinatura } = cabecalhos;
  if (!segredo || !id || !timestamp || !assinatura) return false;
  const ts = Number(timestamp);
  if (!Number.isFinite(ts) || Math.abs(agoraS - ts) > TOLERANCIA_S) return false;
  const chave = Buffer.from(segredo.replace(/^whsec_/, ""), "base64");
  const esperada = createHmac("sha256", chave).update(`${id}.${timestamp}.${corpo}`).digest();
  return assinatura.split(" ").some((parte) => {
    const [versao, valor] = parte.split(",");
    if (versao !== "v1" || !valor) return false;
    const recebida = Buffer.from(valor, "base64");
    return recebida.length === esperada.length && timingSafeEqual(recebida, esperada);
  });
}

export type LinhaDeEnvio = {
  status: string;
  entregue_em: string | null;
  aberto_em: string | null;
  clicado_em: string | null;
  aberturas: number;
  cliques: number;
  erro: string | null;
};

/** Ordem do funil de um e-mail; um evento atrasado nunca rebaixa o status. */
const ORDEM: Record<string, number> = {
  agendado: 0,
  falhou: 0,
  enviado: 1,
  entregue: 2,
  aberto: 3,
  clicado: 4,
};
/** Desfechos que bloqueiam o contato: nada depois os desfaz. */
const TERMINAIS = new Set(["bounce", "reclamou", "descadastrou"]);

function subir(atual: string, novo: string): string {
  if (TERMINAIS.has(atual)) return atual;
  return (ORDEM[novo] ?? 0) > (ORDEM[atual] ?? 0) ? novo : atual;
}

/**
 * O que muda na linha para cada evento. `null` = evento que não nos interessa.
 * Bounce temporário (caixa cheia, servidor fora) não bloqueia o contato: só o
 * permanente, que é o que o provedor conta contra a reputação do domínio.
 */
export function aplicarEvento(
  linha: LinhaDeEnvio,
  tipo: string,
  dados: { created_at?: string; bounce?: { type?: string; message?: string } },
  agora = new Date().toISOString(),
): Partial<LinhaDeEnvio> | null {
  const quando = dados.created_at ?? agora;
  switch (tipo) {
    case "email.delivered":
      return { status: subir(linha.status, "entregue"), entregue_em: linha.entregue_em ?? quando };
    case "email.opened":
      return {
        status: subir(linha.status, "aberto"),
        entregue_em: linha.entregue_em ?? quando,
        aberto_em: linha.aberto_em ?? quando,
        aberturas: linha.aberturas + 1,
      };
    case "email.clicked":
      return {
        status: subir(linha.status, "clicado"),
        entregue_em: linha.entregue_em ?? quando,
        aberto_em: linha.aberto_em ?? quando,
        clicado_em: linha.clicado_em ?? quando,
        cliques: linha.cliques + 1,
      };
    case "email.bounced": {
      const tipoDoBounce = dados.bounce?.type ?? "";
      if (tipoDoBounce && tipoDoBounce.toLowerCase() !== "permanent") {
        return {
          erro: `bounce_temporario: ${dados.bounce?.message ?? tipoDoBounce}`.slice(0, 500),
        };
      }
      return {
        status: "bounce",
        erro: `bounce: ${dados.bounce?.message ?? "permanente"}`.slice(0, 500),
      };
    }
    case "email.complained":
      return { status: TERMINAIS.has(linha.status) ? linha.status : "reclamou" };
    default:
      return null;
  }
}
