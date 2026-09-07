import { Router } from "express";
import { isFreeFeedbackAccount, requireAuth, type AuthedRequest } from "../lib/firebaseAdmin.js";
import { existingVisitorOwner, requireSameOrigin } from "../lib/owner.js";
import { claimGuestReport, ReportNotClaimable } from "../lib/reportClaim.js";

export function createReportClaimsRouter(claim = claimGuestReport) {
  const router = Router();
  router.use((_req, res, next) => { res.setHeader("Cache-Control", "private, no-store"); next(); });
  router.post("/", requireSameOrigin, requireAuth, (req, res) => {
    if (!isFreeFeedbackAccount((req as AuthedRequest).user)) {
      res.status(403).json({ error: "google_account_required", reason: "Continue with a verified Google account to save this report." }); return;
    }
    const body: unknown = req.body;
    if (!body || typeof body !== "object" || Array.isArray(body) || Object.keys(body).length !== 1
      || !("reportId" in body) || typeof body.reportId !== "string" || !/^[A-Za-z0-9_-]{24}$/.test(body.reportId)) {
      res.status(400).json({ error: "validation_failed" }); return;
    }
    const guestOwnerId = existingVisitorOwner(req);
    if (!guestOwnerId) { res.status(403).json({ error: "guest_capability_required", reason: "Open this report in the browser where you created it, then try again." }); return; }
    try {
      res.json(claim(body.reportId, guestOwnerId, `user:${(req as AuthedRequest).user!.uid}`));
    } catch (error) {
      if (error instanceof ReportNotClaimable) { res.status(404).json({ error: "report_not_claimable", reason: "This report is not available to save to this account. Open your saved reports to continue." }); return; }
      res.status(503).json({ error: "storage_unavailable", reason: "Your report could not be saved to your account. Please try again." });
    }
  });
  return router;
}
export const reportClaimsRouter = createReportClaimsRouter();
