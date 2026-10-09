import { fail } from "@/lib/api/wrappers";
import type { QualityText } from "./text";
export function qualityFailure(requestId: string, text: QualityText, code?: string) {
  if (code === "P0002") return fail("not_found", text.unavailable, 404, { requestId });
  if (code === "42501") return fail("forbidden", text.readonly, 403, { requestId });
  if (code === "22023" || code === "23514")
    return fail("validation_error", text.invalid, 422, { requestId });
  return fail("internal_error", text.error, 500, { requestId });
}
