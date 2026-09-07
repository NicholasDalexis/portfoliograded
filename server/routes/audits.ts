import { Router } from "express";
import { createCompletedAudit, getAudit, latestAcceptedAudit, listOwnedReports } from "../lib/auditStore.js";
import { AuditError, readHomepageSource, runPortfolioAudit } from "../lib/auditEngine.js";
import { getHistory, redactPremium } from "../lib/historyStore.js";
import { getAuditStats, recordAuditDuration } from "../lib/stats.js";
import { optionalAuth, isFreeFeedbackAccount } from "../lib/firebaseAdmin.js";
import { isEntitled } from "../lib/entitlements.js";
import { identifyOwner, requireSameOrigin, type OwnedRequest } from "../lib/owner.js";
import { redactReport } from "../lib/reportAccess.js";
import { positiveLimit, takeBudget } from "../lib/quotaBudget.js";
import { beginSubmission, finishSubmission } from "../lib/submissions.js";
import { sameHomepageSource } from "../lib/sourceFingerprint.js";
import { getArchivedShot } from "../lib/screenshot.js";
import { beginUsageAttempt, checkpointUsageAttempt, finishUsageAttempt, flushUsage, type TrackedAttempt } from "../lib/usageRuntime.js";
import { emptyTrace, withUsageTracking } from "../lib/usageTracking.js";
import { ASSESSMENT_METHOD_VERSION } from "../lib/assessmentReuse.js";
import { RUBRIC_VERSION } from "../../shared/rubrics.js";
import { createHash } from "node:crypto";
import { parsePublicUrl } from "../lib/publicNetwork.js";

const hits = new Map<string, number[]>();
function rateLimited(ip: string): boolean {
  const now = Date.now();
  for (const [key, times] of hits) if (!times.some((time) => now - time < 600_000)) hits.delete(key);
  const recent = (hits.get(ip) ?? []).filter((time) => now - time < 600_000);
  if (recent.length >= 6) return true;
  hits.set(ip, [...recent, now]); return false;
}
let inFlight = 0;
const activeReviews = new Set<string>();
const MAX_CONCURRENT = positiveLimit(process.env.AUDITS_MAX_CONCURRENT, 2);

export function createAuditsRouter(auditRunner = runPortfolioAudit, entitlement = isEntitled, sourceReader = readHomepageSource) {
const auditsRouter = Router();
auditsRouter.get("/", optionalAuth, identifyOwner, async (req, res) => {
  try {
    const owner = req as OwnedRequest;
    const entitled = await entitlement(owner.user?.uid);
    res.json({ reports: listOwnedReports(owner.ownerId).map(report => ({ ...report, overallGrade: !entitled && report.overallGrade === "S" ? "A+" : report.overallGrade })) });
  } catch { res.status(503).json({ error: "storage_unavailable" }); }
});
auditsRouter.post("/:id/check", requireSameOrigin, optionalAuth, identifyOwner, async (req, res) => {
  let counted = false;
  try {
    const owner = req as OwnedRequest;
    const stored = getAudit(req.params.id, owner.ownerId);
    if (!stored) { res.status(404).json({ error: "not_found" }); return; }
    const common = { checkedAt: new Date().toISOString(), reportCreatedAt: stored.createdAt, reportOutdated: stored.report.verification?.rubricVersion !== RUBRIC_VERSION };
    if (!stored.report.sourceSnapshot) { res.json({ ...common, status: "baseline-missing" }); return; }
    if (inFlight >= MAX_CONCURRENT) { res.status(429).json({ error: "busy", reason: "Other reviews are running. Try again shortly." }); return; }
    const ip = req.ip || req.socket.remoteAddress || "unknown";
    const budget = takeBudget({ scope: "source-checks", ownerId: owner.ownerId, ip, ownerLimit: 12, ipLimit: 30, globalLimit: 300 });
    if (!budget.ok) { res.status(429).json({ error: "rate_limited", reason: "Today's change-check allowance is used up. Your saved report is still available." }); return; }
    inFlight += 1; counted = true;
    const current = await sourceReader(stored.url);
    res.json({ ...common, checkedAt: new Date().toISOString(), status: sameHomepageSource(stored.report.sourceSnapshot, current) ? "no-source-change" : "source-changed" });
  } catch { res.status(502).json({ error: "comparison_unavailable", reason: "We could not compare this homepage. Your saved report is unchanged." }); }
  finally { if (counted) inFlight -= 1; }
});
auditsRouter.post("/", requireSameOrigin, optionalAuth, identifyOwner, async (req, res) => {
  const { url, role, builder } = req.body as { url?: unknown; role?: unknown; builder?: unknown };
  if (typeof url !== "string" || !url.trim() || url.length > 2048) { res.status(400).json({ error: "validation_failed", reason: "Enter a portfolio URL under 2,048 characters." }); return; }
  if (inFlight >= MAX_CONCURRENT) { res.status(429).json({ error: "busy", reason: "Two portfolios are being reviewed. Try again shortly." }); return; }
  const owner = req as OwnedRequest;
  const safeRole = typeof role === "string" && role.trim() ? role.trim().slice(0, 100) : "Creative";
  let normalized = url.trim();
  try { const parsed = parsePublicUrl(url); parsed.hash = ""; normalized = parsed.toString(); } catch { /* The runner returns the existing safe URL validation error. */ }
  const activeKey = createHash("sha256").update(JSON.stringify([owner.ownerId, normalized, safeRole.toLowerCase()])).digest("hex");
  if (activeReviews.has(activeKey)) { res.status(409).json({ error: "review_in_progress", reason: "This portfolio is already being reviewed for this account or browser. Keep the original review tab open." }); return; }
  const ip = req.ip || req.socket.remoteAddress || "unknown";
  if (rateLimited(ip)) { res.status(429).json({ error: "rate_limited", reason: "Too many audits from this connection. Try again in a few minutes." }); return; }
  inFlight += 1;
  activeReviews.add(activeKey);
  let submissionId: string | undefined;
  let usageAttempt: TrackedAttempt | undefined;
  let usageFinalized = false;
  try {
    const budget = positiveLimit(process.env.AUDITS_DAILY_BUDGET, 300);
    const allowance = takeBudget({ scope: "audits", ownerId: owner.ownerId, ip, ownerLimit: budget, ipLimit: budget, globalLimit: budget });
    if (!allowance.ok) { res.status(429).json({ error: allowance.reason, reason: "Today's audit allowance is used up. Please try tomorrow." }); return; }
    const safeBuilder = typeof builder === "string" && builder.trim() ? builder.trim().slice(0, 40) : undefined;
    const isPro = await entitlement(owner.user?.uid);
    submissionId = beginSubmission(url, safeRole, safeBuilder);
    usageAttempt = await beginUsageAttempt(owner.user?.uid, ASSESSMENT_METHOD_VERSION, isFreeFeedbackAccount(owner.user));
    const previous = latestAcceptedAudit(owner.ownerId, url, safeRole);
    const started = Date.now();
    const trace = usageAttempt?.trace ?? emptyTrace();
    const report = await withUsageTracking(trace, () => auditRunner({ url, role: safeRole, isPro, previousAccepted: previous ? { id: previous.id, report: previous.report } : undefined }), captured => checkpointUsageAttempt(usageAttempt, captured));
    recordAuditDuration(Date.now() - started);
    if (report.assessment?.status === "reused" || report.assessment?.status === "previous-preserved") {
      // Never trust an ID returned by a runner without rechecking the original owner-scoped candidate.
      if (!previous || report.assessment.previousReportId !== previous.id || !getAudit(previous.id, owner.ownerId)) throw new Error("invalid_reuse_reference");
      const reused = report.assessment.status === "reused";
      finishUsageAttempt(usageAttempt, reused ? "reused" : "preserved"); usageFinalized = true;
      finishSubmission(submissionId, { status: reused ? "reused" : "preserved", auditId: previous.id });
      res.status(200).json({ id: previous.id, status: "complete", report: redactReport(report, isPro, isFreeFeedbackAccount(owner.user)), createdAt: previous.createdAt,
        llm: false, history: redactPremium(getHistory(previous.url, owner.ownerId, previous.role), isPro, isFreeFeedbackAccount(owner.user)) });
      return;
    }
    const { stored, history } = createCompletedAudit({ ownerId: owner.ownerId, url: report.url, role: safeRole, pro: isPro, report }, { builder: safeBuilder, submissionId, usageAttempt });
    usageFinalized = true;
    res.status(201).json({ id: stored.id, status: "complete", report: redactReport(stored.report, isPro, isFreeFeedbackAccount(owner.user)), createdAt: stored.createdAt,
      llm: report.verification?.aiEnrichment === "succeeded", history: redactPremium(history, isPro, isFreeFeedbackAccount(owner.user)) });
  } catch (err) {
    if (usageAttempt && !usageFinalized) try { finishUsageAttempt(usageAttempt, "failed"); } catch { /* A persisted running trace is recovered after restart. */ }
    if (submissionId) try { finishSubmission(submissionId, { status: "failed", reason: err instanceof AuditError ? err.message : "Review unavailable" }); } catch { /* storage error is reported below */ }
    if (err instanceof AuditError) { res.status(err.status).json({ error: "audit_failed", reason: err.message }); return; }
    console.error("[audit] failed", err instanceof Error ? err.name : "unknown");
    res.status(503).json({ error: "audit_failed", reason: "The review could not be saved. Please try again." });
  } finally { inFlight -= 1; activeReviews.delete(activeKey); if (usageAttempt) void flushUsage(); }
});
auditsRouter.get("/stats", (_req, res) => res.json(getAuditStats()));
auditsRouter.get("/:id/screenshot", optionalAuth, identifyOwner, (req, res) => {
  try {
    const device = req.query.device;
    if (device !== "web" && device !== "mobile") { res.status(400).json({ error: "invalid_device" }); return; }
    const stored = getAudit(req.params.id, (req as OwnedRequest).ownerId);
    if (!stored) { res.status(404).json({ error: "not_found" }); return; }
    const ref = stored.report.rendered?.devices[device].capture?.imageRef;
    const image = ref ? getArchivedShot(ref) : null;
    if (!image) { res.status(404).json({ error: "saved_preview_unavailable" }); return; }
    res.type("image/jpeg").set("X-Content-Type-Options", "nosniff").send(image);
  } catch { res.status(503).json({ error: "storage_unavailable" }); }
});
auditsRouter.get("/:id", optionalAuth, identifyOwner, async (req, res) => {
  try {
    const owner = req as OwnedRequest;
    const stored = getAudit(req.params.id, owner.ownerId);
    if (!stored) { res.status(404).json({ error: "not_found" }); return; }
    const entitled = await entitlement(owner.user?.uid);
    res.json({ id: stored.id, url: stored.url, role: stored.role, pro: entitled, report: redactReport(stored.report, entitled, isFreeFeedbackAccount(owner.user)), createdAt: stored.createdAt });
  } catch { res.status(503).json({ error: "storage_unavailable" }); }
});

return auditsRouter;
}
export const auditsRouter = createAuditsRouter();
