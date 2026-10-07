/**
 * MODO TESTE "CONVERSAR COMIGO MESMO" — o dono testa o atendente com UM celular.
 *
 * Quem só tem um aparelho não consegue fazer o papel de cliente: tudo que sai do
 * número conectado chega como `fromMe=true` e é gravado como resposta da
 * EMPRESA (`handleOutboundFromUserPhone`), então nada fica "esperando resposta"
 * e nenhum atendente — interno ou o Claude Code/Codex pelo MCP — tem o que
 * responder. Com a opção ligada, o que o dono digita no chat consigo mesmo
 * ("Você", "Mensagem para mim") entra como mensagem de CLIENTE, e a resposta
 * volta para o mesmo chat.
 *
 * DESLIGADO por padrão, e por organização (`settings.teste_consigo_mesmo`): na
 * operação real esse chat é o bloco de notas do dono, e responder às anotações
 * dele seria um defeito.
 *
 * Como se reconhece o chat consigo mesmo — medido no Atenza online em
 * 07/10/2026, NOWEB 2026.7.2: a mensagem chega com `remoteJid` = o PRÓPRIO
 * `@lid` do número (o mesmo de `envelope.me.lid`) e `remoteJidAlt` = o próprio
 * telefone (`envelope.me.id`). Casa-se pelos dígitos, contra os dois.
 *
 * O LAÇO: a resposta enviada ao chat consigo mesmo também volta como
 * `fromMe=true`, no mesmo chat. Se ela fosse lida como cliente, o atendente
 * responderia a si mesmo para sempre. Quem impede é o chamador: só promove a
 * cliente o que NÃO é eco de envio nosso (`external_id` já gravado, ou envio em
 * voo com o mesmo corpo — `ehEcoDeEnvioNosso`).
 */

const soDigitos = (s: string | null | undefined): string =>
  (s ?? "").replace(/@.*$/, "").replace(/\D/g, "");

export interface EuNoEnvelope {
  id?: string | null;
  lid?: string | null;
}

/** O chat desta mensagem é o do próprio número conectado? */
export function ehChatConsigoMesmo(
  chatIds: ReadonlyArray<string | null | undefined>,
  eu: EuNoEnvelope | null | undefined,
): boolean {
  if (!eu) return false;
  const meus = new Set([soDigitos(eu.id), soDigitos(eu.lid)].filter((d) => d.length >= 8));
  if (meus.size === 0) return false;
  return chatIds.some((c) => {
    if (!c || c.endsWith("@g.us")) return false;
    const d = soDigitos(c);
    return d.length >= 8 && meus.has(d);
  });
}

/** A opção está ligada nesta organização? Lê o jsonb cru; ausente = desligado. */
export function testeConsigoMesmoLigado(settings: unknown): boolean {
  if (!settings || typeof settings !== "object") return false;
  return (settings as Record<string, unknown>).teste_consigo_mesmo === true;
}
