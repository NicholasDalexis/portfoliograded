import { createHash } from "node:crypto";
import { ACCOUNT_ACCESS_POLICY, type AuditReport, type CategoryAccess, type CategoryKey } from "../../shared/audit.js";
import type { BestAchieved } from "../../shared/reportHistory.js";
import { secureStore, type StoreDocument } from "./secureStore.js";
import { ACCOUNT_LOCKED, LOCKED, categoryAccess } from "./reportAccess.js";
export interface RunSummary { id: string; at: string; role: string; pro: boolean; builder?: string; overall: number; overallGrade: string; categories: { key: string; score: number; grade: string }[]; accessPolicy?: string; methodVersion?: string; accepted?: boolean; evidenceStatus?: "complete" | "partial"; }
export interface SuggestionState { id: string; title: string; description: string; impact: string; premium: boolean; firstSeen: string; lastSeen: string; done: boolean; doneAt?: string; auditIds?: string[]; categoryKeys?: CategoryKey[]; access?: CategoryAccess; }
export interface UrlHistory { url: string; role: string; runs: RunSummary[]; suggestions: Record<string, SuggestionState>; currentAssessment?: RunSummary; bestAchieved?: BestAchieved; milestones?: BestAchieved[]; }
const suggestionKey = (title: string) => createHash("sha256").update(title.toLowerCase().trim()).digest("hex").slice(0, 24);
export function withHistoryMilestones(entry: UrlHistory): UrlHistory {
  const copy = structuredClone(entry);
  const byMethod = new Map<string, BestAchieved>();
  for (const run of copy.runs) {
    if (run.accepted === false) continue;
    const methodVersion = run.methodVersion ?? "legacy-homepage-html";
    const prior = byMethod.get(methodVersion);
    if (!prior || run.overall > prior.overall) byMethod.set(methodVersion, { reportId: run.id, at: run.at, role: run.role,
      methodVersion, overall: run.overall, overallGrade: run.overallGrade });
  }
  copy.currentAssessment = copy.runs.at(-1);
  copy.milestones = [...byMethod.values()];
  copy.bestAchieved = byMethod.get(copy.currentAssessment?.methodVersion ?? "legacy-homepage-html");
  return copy;
}
/** Retained for screenshot filename compatibility. */
export function historyKey(rawUrl: string): string {
  try { const u = new URL(rawUrl); return u.hostname.toLowerCase().replace(/^www\./, "") + u.pathname.replace(/\/+$/, ""); }
  catch { return rawUrl.toLowerCase().trim(); }
}
function reportUrlKey(raw: string): string {
  try { const url = new URL(raw); url.hash = ""; return url.toString(); } catch { return raw.trim(); }
}
export function historyStorageKey(ownerId: string, url: string, role: string): string { return createHash("sha256").update(JSON.stringify([ownerId, reportUrlKey(url), role.trim().toLowerCase()])).digest("hex"); }
const ownedKey = historyStorageKey;
/** Preserve older history only when every run belongs to this exact page and owner.
 * Legacy screenshot keys omitted query/scheme/www and cannot safely identify portfolios. */
export function historyForOwner(store: StoreDocument, ownerId: string, url: string, role: string): UrlHistory | undefined {
  const current = store.histories[ownedKey(ownerId, url, role)] as UrlHistory | undefined;
  if (current) return current;
  const legacyKey = createHash("sha256").update(JSON.stringify([ownerId, historyKey(url), role.trim().toLowerCase()])).digest("hex");
  const legacy = store.histories[legacyKey] as UrlHistory | undefined;
  const exact = reportUrlKey(url);
  if (!legacy || reportUrlKey(legacy.url) !== exact || !legacy.runs.length) return undefined;
  const safe = legacy.runs.every(run => {
    const audit = store.audits[run.id] as { ownerId: string; url: string } | undefined;
    return audit?.ownerId === ownerId && reportUrlKey(audit.url) === exact;
  });
  return safe ? legacy : undefined;
}
const entryFor = historyForOwner;
export function recordAuditInDocument(store: StoreDocument, ownerId: string, report: AuditReport, auditId: string, pro: boolean, builder?: string, createdAt = new Date().toISOString()): UrlHistory {
    const key = ownedKey(ownerId, report.url, report.role);
    const entry = structuredClone(entryFor(store, ownerId, report.url, report.role)) ?? { url: report.url, role: report.role, runs: [], suggestions: {} };
    if (entry.runs.some(run => run.id === auditId)) return withHistoryMilestones(entry);
    const now = createdAt;
    entry.runs.push({ id: auditId, at: now, role: report.role, pro, builder, overall: report.overall, overallGrade: report.overallGrade,
      accessPolicy: report.accessPolicy, methodVersion: report.assessment?.methodVersion ?? `legacy-homepage-html-rubric-${report.verification?.rubricVersion ?? "unknown"}`,
      accepted: Boolean(report.acceptedEvidence) || report.accessPolicy !== ACCOUNT_ACCESS_POLICY, evidenceStatus: report.assessment?.evidenceStatus,
      categories: report.categories.map((c) => ({ key: c.key, score: c.score, grade: c.grade })) });
    for (const fix of report.topFixes) {
      const id = suggestionKey(fix.title);
      const prior = entry.suggestions[id];
      entry.suggestions[id] = { ...fix, id, firstSeen: prior?.firstSeen ?? now, lastSeen: now, done: prior?.done ?? false, doneAt: prior?.doneAt,
        auditIds: [...new Set([...(prior?.auditIds ?? []), auditId])], categoryKeys: [...new Set([...(prior?.categoryKeys ?? []), ...(fix.categoryKey ? [fix.categoryKey] : [])])] };
    }
    store.histories[key] = entry;
    return withHistoryMilestones(entry);
}
export function recordAudit(auditId: string, report: AuditReport, extra: { ownerId: string; pro?: boolean; builder?: string }): UrlHistory {
  return secureStore.update(store => recordAuditInDocument(store, extra.ownerId, report, auditId, extra.pro ?? false, extra.builder));
}
export function getHistory(url: string, ownerId: string, role = "Creative"): UrlHistory | null {
  const entry = entryFor(secureStore.read(), ownerId, url, role);
  return entry ? withHistoryMilestones(entry) : null;
}
export function redactPremium(entry: UrlHistory | null, entitled: boolean, signedIn = false): UrlHistory | null {
  if (!entry) return null;
  const copy = withHistoryMilestones(entry);
  const audits = secureStore.read().audits;
  for (const suggestion of Object.values(copy.suggestions)) {
    // Scope access to the stored report that supplied this exact version of the
    // suggestion. A legacy report's already-visible feedback is not newly gated.
    const sources = copy.runs.flatMap(run => {
      const report = (audits[run.id] as { report?: AuditReport } | undefined)?.report;
      if (!report) return [];
      return report.topFixes.filter(fix => suggestionKey(fix.title) === suggestion.id && fix.description === suggestion.description).map(fix => ({ report, fix }));
    });
    const accesses = sources.map(({ report, fix }) => {
      const category = report.categories.find(category => category.key === fix.categoryKey);
      if (category) return categoryAccess(report, category, entitled, signedIn);
      if (report.accessPolicy === ACCOUNT_ACCESS_POLICY && !signedIn && !entitled && report.categories.some(category => category.grade === "D")) return "free-account-required";
      return "open";
    });
    const access = accesses.includes("open") ? "open" : accesses.includes("free-account-required") ? "free-account-required" : accesses.includes("pro-required") ? "pro-required" :
      (!signedIn && !entitled && copy.runs.some(run => run.accessPolicy === ACCOUNT_ACCESS_POLICY) ? "free-account-required" : "open");
    suggestion.access = access;
    if (access !== "open") {
      suggestion.title = access === "free-account-required" ? "More feedback with a free account" : "Pro improvement";
      suggestion.description = access === "free-account-required" ? ACCOUNT_LOCKED : LOCKED;
    }
  }
  const includesDeepReview = copy.runs.some(run => (audits[run.id] as { report?: AuditReport } | undefined)?.report?.verification?.deepReviewVerified === true);
  if (!includesDeepReview) {
    for (const suggestion of Object.values(copy.suggestions)) suggestion.premium = false;
    return copy;
  }
  if (!entitled) for (const suggestion of Object.values(copy.suggestions)) if (suggestion.premium) { suggestion.title = "Pro improvement"; suggestion.description = LOCKED; }
  return copy;
}
export function toggleSuggestion(url: string, suggestionId: string, done: boolean, ownerId: string, role = "Creative"): SuggestionState | null {
  const key = ownedKey(ownerId, url, role);
  const existing = entryFor(secureStore.read(), ownerId, url, role);
  if (!existing?.suggestions[suggestionId]) return null;
  return secureStore.update((store) => {
    const entry = structuredClone(entryFor(store, ownerId, url, role)!);
    store.histories[key] = entry;
    const suggestion = entry.suggestions[suggestionId];
    suggestion.done = done; suggestion.doneAt = done ? new Date().toISOString() : undefined;
    return structuredClone(suggestion);
  });
}
