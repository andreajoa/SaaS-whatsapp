import { createHash } from "node:crypto";
import type { TemplateSnapshot } from "./model";
function stable(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).sort(([a],[b]) => a.localeCompare(b)).map(([k,v]) => [k,stable(v)]));
  return value;
}
export function snapshotHash(t: TemplateSnapshot): string {
  return createHash("sha256").update(JSON.stringify(stable({ id:t.id, name:t.name, language:t.language,
    contract_hash:t.contract_hash, parameter_format:t.parameter_format, components:t.components }))).digest("hex");
}
export function assertSnapshot(saved: TemplateSnapshot, hash: string, current: TemplateSnapshot | null) {
  if (!current || current.status !== "APPROVED" || snapshotHash(current) !== hash || snapshotHash(saved) !== hash)
    throw new Error("O modelo mudou ou deixou de estar aprovado. Cancele e crie uma campanha com o modelo atual.");
}
