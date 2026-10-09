import { CHANNEL_PROVIDER_META, CHANNEL_PROVIDER_ZERNIO } from "./capabilities";
import type { ChannelProvider } from "./types";

/** Contrato implementado pelo transporte, sem espalhar identidade do canal. */
export function templateParameterSupportOf(
  provider: ChannelProvider,
): "components" | "body-positional" | null {
  if (provider === CHANNEL_PROVIDER_META) return "components";
  if (provider === CHANNEL_PROVIDER_ZERNIO) return "body-positional";
  return null;
}
