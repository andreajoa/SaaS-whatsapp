import type { NextRequest } from "next/server";
import { checkRateLimit } from "@/lib/ai/dispatcher/rate-limit";
import { fail } from "@/lib/api/wrappers";
import { hashSurveyToken } from "./token";
/** Guarda própria mesmo fora do proxy autenticado. O hash preserva maiúsculas.
 * Sem proxy/IP, ainda limita por token. Redis compartilha entre instâncias;
 * o contador canônico cai para memória por processo se Redis estiver indisponível.
 */
export async function guardPublicFeedback(req: NextRequest, token: string, requestId: string) {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip")?.trim();
  const tokenLimit = await checkRateLimit(
    `service-quality:token:${hashSurveyToken(token.slice(0, 128))}`,
    20,
    60,
  );
  const ipLimit = ip
    ? await checkRateLimit(`service-quality:ip:${hashSurveyToken(ip.slice(0, 128))}`, 60, 60)
    : null;
  if (!tokenLimit.allowed || (ipLimit && !ipLimit.allowed))
    return fail("rate_limited", "Too many attempts.", 429, {
      requestId,
      headers: {
        "Retry-After": "60",
        "X-RateLimit-Limit": "20",
        "X-RateLimit-Remaining": "0",
        "Cache-Control": "no-store",
      },
    });
  return null;
}
