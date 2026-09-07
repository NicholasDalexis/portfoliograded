import { createHash } from "node:crypto";
import { ACCOUNT_ACCESS_POLICY } from "../../shared/audit.js";
import type { StoredAudit } from "./auditStore.js";
import { historyForOwner, historyStorageKey, withHistoryMilestones, type RunSummary, type SuggestionState, type UrlHistory } from "./historyStore.js";
import { secureStore, type SecureStore, type StoreDocument } from "./secureStore.js";

interface ClaimProvenance { version: 1; guestOwnerId: string; accountOwnerId: string; claimedAt: string; }
type ClaimableAudit = StoredAudit & { claim?: ClaimProvenance };
type LinkedSuggestion = SuggestionState & { auditIds?: string[] };
export class ReportNotClaimable extends Error {
  constructor() { super("This report is not available to claim."); this.name = "ReportNotClaimable"; }
}
function fixId(title: string): string { return createHash("sha256").update(title.toLowerCase().trim()).digest("hex").slice(0, 24); }
function samePage(a: string, b: string): boolean {
  try { const left = new URL(a), right = new URL(b); left.hash = ""; right.hash = ""; return left.href === right.href; }
  catch { return a.trim() === b.trim(); }
}
function belongsTo(audit: StoredAudit | undefined, owner: string, selected: StoredAudit): audit is StoredAudit {
  return Boolean(audit && audit.ownerId === owner && samePage(audit.url, selected.url)
    && audit.role.trim().toLowerCase() === selected.role.trim().toLowerCase());
}
function selectedRun(audit: StoredAudit, source?: UrlHistory): RunSummary {
  return structuredClone(source?.runs.find(run => run.id === audit.id) ?? {
    id: audit.id, at: audit.createdAt, role: audit.role, pro: audit.pro,
    overall: audit.report.overall, overallGrade: audit.report.overallGrade,
    accessPolicy: audit.report.accessPolicy,
    methodVersion: audit.report.assessment?.methodVersion ?? `legacy-homepage-html-rubric-${audit.report.verification?.rubricVersion ?? "unknown"}`,
    accepted: Boolean(audit.report.acceptedEvidence) || audit.report.accessPolicy !== ACCOUNT_ACCESS_POLICY,
    evidenceStatus: audit.report.assessment?.evidenceStatus,
    categories: audit.report.categories.map(({ key, score, grade }) => ({ key, score, grade })),
  });
}

/** Rebuild only the still-owned reports' suggestions. Legacy history aggregated
 * by title has no exact provenance, so never leave selected-only feedback behind
 * or copy another guest report's prose into the claimed report. */
function remainingGuestHistory(entry: UrlHistory, selected: StoredAudit, guest: string, state: StoreDocument): UrlHistory | null {
  const runs = entry.runs.filter(run => run.id !== selected.id && belongsTo(state.audits[run.id] as StoredAudit | undefined, guest, selected));
  if (!runs.length) return null;
  const suggestions: Record<string, LinkedSuggestion> = {};
  for (const run of [...runs].sort((a, b) => a.at.localeCompare(b.at))) {
    const audit = state.audits[run.id] as StoredAudit;
    for (const fix of audit.report.topFixes) {
      const id = fixId(fix.title), prior = entry.suggestions[id];
      suggestions[id] = { ...fix, id, firstSeen: prior?.firstSeen ?? run.at, lastSeen: run.at,
        done: prior?.done ?? false, doneAt: prior?.doneAt,
        auditIds: [...new Set([...(suggestions[id]?.auditIds ?? []), run.id])],
        categoryKeys: [...new Set([...(suggestions[id]?.categoryKeys ?? []), ...(fix.categoryKey ? [fix.categoryKey] : [])])],
      };
    }
  }
  return withHistoryMilestones({ ...entry, runs, suggestions });
}

/** Atomic for the existing single-writer preview store. A hosted multi-writer
 * deployment needs a shared transactional store before this guarantee extends
 * across instances. No report regeneration, URL-based bulk transfer or consent
 * mutation occurs here. */
export function claimGuestReport(reportId: string, guestOwnerId: string, accountOwnerId: string, store: SecureStore = secureStore): { reportId: string } {
  if (!/^[A-Za-z0-9_-]{24}$/.test(reportId) || !/^visitor:[a-f0-9]{64}$/.test(guestOwnerId) || !/^user:.{1,128}$/s.test(accountOwnerId)) throw new ReportNotClaimable();
  return store.update(state => {
    const selected = state.audits[reportId] as ClaimableAudit | undefined;
    if (!selected) throw new ReportNotClaimable();
    if (selected.ownerId === accountOwnerId && selected.claim?.version === 1
      && selected.claim.accountOwnerId === accountOwnerId && selected.claim.guestOwnerId === guestOwnerId) return { reportId };
    if (selected.ownerId !== guestOwnerId || selected.claim) throw new ReportNotClaimable();

    const source = historyForOwner(state, guestOwnerId, selected.url, selected.role);
    const existing = historyForOwner(state, accountOwnerId, selected.url, selected.role);
    // Reject corrupt/mixed target history rather than attach unrelated records.
    if (existing?.runs.some(run => !belongsTo(state.audits[run.id] as StoredAudit | undefined, accountOwnerId, selected))) throw new ReportNotClaimable();
    const target: UrlHistory = structuredClone(existing) ?? { url: selected.url, role: selected.role, runs: [], suggestions: {} };
    const run = selectedRun(selected, source);
    if (!target.runs.some(item => item.id === reportId)) target.runs.push(run);
    target.runs.sort((a, b) => a.at.localeCompare(b.at) || a.id.localeCompare(b.id));
    for (const fix of selected.report.topFixes) {
      const id = fixId(fix.title), guest = source?.suggestions[id], destination = target.suggestions[id] as LinkedSuggestion | undefined;
      if (destination) {
        // Existing account content and progress are authoritative on collision.
        target.suggestions[id] = { ...destination, lastSeen: destination.lastSeen > run.at ? destination.lastSeen : run.at,
          categoryKeys: [...new Set([...(destination.categoryKeys ?? []), ...(fix.categoryKey ? [fix.categoryKey] : [])])],
          auditIds: [...new Set([...(destination.auditIds ?? []), reportId])] } as LinkedSuggestion;
      } else {
        target.suggestions[id] = { ...fix, id, firstSeen: guest?.firstSeen ?? run.at, lastSeen: run.at,
          done: guest?.done ?? false, doneAt: guest?.doneAt, auditIds: [reportId], categoryKeys: fix.categoryKey ? [fix.categoryKey] : [] } as LinkedSuggestion;
      }
    }
    // Remove the selected run from all corresponding current/legacy guest
    // copies. No foreign-owned history can qualify through URL equality alone.
    for (const [key, raw] of Object.entries(state.histories)) {
      const entry = raw as UrlHistory;
      if (!Array.isArray(entry?.runs) || !entry.runs.some(item => item.id === reportId)) continue;
      if (!samePage(entry.url, selected.url) || entry.role.trim().toLowerCase() !== selected.role.trim().toLowerCase()) continue;
      if (!entry.runs.every(item => belongsTo(state.audits[item.id] as StoredAudit | undefined, guestOwnerId, selected))) throw new ReportNotClaimable();
      const remaining = remainingGuestHistory(entry, selected, guestOwnerId, state);
      if (remaining) state.histories[key] = remaining;
      else delete state.histories[key];
    }
    state.histories[historyStorageKey(accountOwnerId, selected.url, selected.role)] = withHistoryMilestones(target);
    selected.ownerId = accountOwnerId;
    selected.claim = { version: 1, guestOwnerId, accountOwnerId, claimedAt: new Date().toISOString() };
    return { reportId };
  });
}
