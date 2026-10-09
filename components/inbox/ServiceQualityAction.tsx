"use client";
import { ConversationQualityFeedback } from "@/app/app/service-quality/conversation-feedback";
export interface ServiceQualityActionProps {
  conversationId: string;
  /** Ação normal de envio do inbox, com seus guards. Somente um clique explícito
   * chama este callback; criar/copiar/consultar avaliação nunca envia. O destino
   * deve ser a conversa identificada por conversationId, capturada pelo caller.
   */
  onExplicitSend?: (message: string) => Promise<void>;
}
/** Montar no sidebar da conversa. A API resolve can_manage: viewer vê CSAT,
 * manager pode criar link/copiá-lo e, se disponível, enviar pelo messenger.
 * Sem callback, oferece somente cópia e link para a conversa existente.
 */
export function ServiceQualityAction({
  conversationId,
  onExplicitSend,
}: ServiceQualityActionProps) {
  return (
    <ConversationQualityFeedback
      key={conversationId}
      conversationId={conversationId}
      onExplicitSend={onExplicitSend}
    />
  );
}
