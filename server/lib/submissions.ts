import { randomBytes } from "node:crypto";
import { secureStore } from "./secureStore.js";
import { recordRoleDemandInDocument } from "./roleDemand.js";
export interface Submission { id: string; url: string; role: string; appliedRubric?: string; builder?: string; createdAt: string; status: "running" | "completed" | "failed" | "reused" | "preserved"; auditId?: string; reason?: string; }
export function beginSubmission(url: string, role: string, builder?: string): string {
  const record: Submission = {id: randomBytes(18).toString("base64url"), url, role, builder, createdAt: new Date().toISOString(), status: "running"};
  secureStore.update(state => { state.submissions ??= {}; record.appliedRubric = recordRoleDemandInDocument(state, role, record.createdAt); state.submissions[record.id] = record; });
  return record.id;
}
export function finishSubmission(id: string, update: Pick<Submission, "status" | "auditId" | "reason">): void {
  secureStore.update(state => { const record = state.submissions?.[id] as Submission | undefined; if (record) Object.assign(record, update); });
}
