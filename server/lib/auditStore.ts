import { randomBytes } from "node:crypto";
import type { AuditReport } from "../../shared/audit.js";
import { secureStore } from "./secureStore.js";
import type { SavedReportSummary } from "../../shared/reportHistory.js";
import { getHistory, recordAuditInDocument } from "./historyStore.js";
import { parsePublicUrl } from "./publicNetwork.js";
import { previousMatchesRequest } from "./assessmentReuse.js";
import { finishUsageInDocument, type TrackedAttempt } from "./usageRuntime.js";
export interface StoredAudit { id: string; ownerId: string; url: string; role: string; pro: boolean; report: AuditReport; createdAt: string; }
export function createAudit(params: Omit<StoredAudit, "id" | "createdAt">): StoredAudit {
  const record = { ...params, id: randomBytes(18).toString("base64url"), createdAt: new Date().toISOString() };
  return secureStore.update((state) => { state.audits[record.id] = record; return record; });
}
/** One durable commit: report, history, completed submission and the usage handoff. */
export function createCompletedAudit(params: Omit<StoredAudit, "id" | "createdAt">, extra: { builder?: string; submissionId?: string; usageAttempt?: TrackedAttempt } = {}) {
  const stored: StoredAudit = { ...params, id: randomBytes(18).toString("base64url"), createdAt: new Date().toISOString() };
  return secureStore.update(state => {
    state.audits[stored.id] = stored;
    const history = recordAuditInDocument(state, stored.ownerId, stored.report, stored.id, stored.pro, extra.builder, stored.createdAt);
    const submission = extra.submissionId ? state.submissions?.[extra.submissionId] as { status: string; auditId?: string } | undefined : undefined;
    if (submission) { submission.status = "completed"; submission.auditId = stored.id; }
    finishUsageInDocument(state, extra.usageAttempt, stored.report.acceptedEvidence ? "completed" : "partial", stored.id);
    return { stored, history };
  });
}
/** Candidate lookup is owner + exact URL + requested role. Engine verifies method and complete evidence before reuse. */
export function latestAcceptedAudit(ownerId: string, inputUrl: string, role: string): StoredAudit | undefined {
  let url: string;
  try { const parsed = parsePublicUrl(inputUrl); parsed.hash = ""; url = parsed.toString(); } catch { return undefined; }
  const candidate = (Object.values(secureStore.read().audits) as StoredAudit[])
    .filter(record => record.ownerId === ownerId && previousMatchesRequest({ id: record.id, report: record.report }, url, role))
    .sort((a,b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id))[0];
  return candidate ? structuredClone(candidate) : undefined;
}
export function getAudit(id: string, ownerId: string): StoredAudit | undefined {
  const record = secureStore.read().audits[id] as StoredAudit | undefined;
  return record?.ownerId === ownerId ? structuredClone(record) : undefined;
}
/** Account/visitor-scoped library. Never return owner IDs, raw reports or fingerprints. */
export function listOwnedReports(ownerId: string): SavedReportSummary[] {
  return (Object.values(secureStore.read().audits) as StoredAudit[])
    .filter(record => record.ownerId === ownerId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id))
    .slice(0, 50)
    .map(record => ({ id: record.id, url: record.url, role: record.role, createdAt: record.createdAt, overall: record.report.overall, overallGrade: record.report.overallGrade === "S" && record.report.verification?.deepReviewVerified !== true ? "A+" : record.report.overallGrade,
      methodVersion: record.report.assessment?.methodVersion, bestAchieved: getHistory(record.url, ownerId, record.role)?.bestAchieved }));
}
/** Any future admin HTTP route must verify an explicit admin UID allowlist. */
export function listAuditSummaries(ownerId?: string) {
  return (Object.values(secureStore.read().audits) as StoredAudit[]).filter((record) => !ownerId || record.ownerId === ownerId).map(({ report: _report, ...record }) => record);
}
