import type { ApiResponse } from "@/lib/api/wrappers";
export class QualityRequestError extends Error {
  constructor(public status: number) {
    super("service_quality_request_failed");
  }
}
export async function qualityFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(path, {
    ...options,
    headers: { "Content-Type": "application/json", ...options.headers },
    cache: "no-store",
  });
  const body: ApiResponse<T> = await response.json();
  if (!response.ok || "error" in body) throw new QualityRequestError(response.status);
  return body.data;
}
