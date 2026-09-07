import { createHash } from "node:crypto";
import { GENERAL_RUBRIC, rubricForRole } from "../../shared/rubrics.js";
import type { StoreDocument } from "./secureStore.js";
export interface RoleDemand { label: string; count: number; firstAt: string; lastAt: string; appliedRubric: string; }
/** A private demand label, never raw role text in public analytics or alerts. */
export function sanitizedRoleDemand(raw: string): string {
  if (/[\p{Cc}\p{Cf}]/u.test(raw)) return "other (unclassified)";
  const label = raw.normalize("NFKC").replace(/\s+/g, " ").trim().toLowerCase();
  return /^[\p{L}\p{M}][\p{L}\p{M} '&/()-]{1,59}$/u.test(label) ? label : "other (unclassified)";
}
export function recordRoleDemandInDocument(state: StoreDocument, role: string, at: string): string {
  const applied = rubricForRole(role) ?? GENERAL_RUBRIC;
  if (rubricForRole(role) || /^(general( portfolio)?|creative|other)$/i.test(role.trim())) return applied.key;
  state.roleDemand ??= {};
  let label = sanitizedRoleDemand(role);
  let key = createHash("sha256").update(label).digest("hex");
  // Reserve the final slot for every unclassified/overflow request.
  if (!state.roleDemand[key] && Object.keys(state.roleDemand).length >= 199) { label = "other (unclassified)"; key = createHash("sha256").update(label).digest("hex"); }
  const prior = state.roleDemand[key] as RoleDemand | undefined;
  state.roleDemand[key] = { label, count: (prior?.count ?? 0) + 1, firstAt: prior?.firstAt ?? at, lastAt: at, appliedRubric: applied.key } satisfies RoleDemand;
  return applied.key;
}
