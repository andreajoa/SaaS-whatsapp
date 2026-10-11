import { dispararTransacional } from "@/lib/marketing/disparo";

/** Fatura de trial de valor zero não é pagamento. Só evento assinado resolvido pelo webhook chega aqui. */
export async function agradecerFaturaPaga(
  objeto: Record<string, unknown>,
  organizationId: string | null,
): Promise<void> {
  if (
    !organizationId ||
    typeof objeto.amount_paid !== "number" ||
    objeto.amount_paid <= 0 ||
    typeof objeto.id !== "string" ||
    !objeto.id ||
    typeof objeto.customer_email !== "string" ||
    !objeto.customer_email.includes("@")
  )
    return;
  await dispararTransacional({
    email: objeto.customer_email,
    transacionalId: "pagamento-recebido",
    chave: objeto.id,
    origem: "checkout",
  });
}
