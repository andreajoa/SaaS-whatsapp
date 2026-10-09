import { createHash, randomBytes } from "node:crypto";
export function hashSurveyToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
export function newSurveyToken(): { token: string; hash: string } {
  const token = randomBytes(32).toString("base64url");
  return { token, hash: hashSurveyToken(token) };
}
