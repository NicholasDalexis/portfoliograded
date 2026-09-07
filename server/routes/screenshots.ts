import { optionalAuth, isFreeFeedbackAccount } from "../lib/firebaseAdmin.js";
import { identifyOwner, requireSameOrigin, type OwnedRequest } from "../lib/owner.js";
import { beginUsageAttempt, checkpointUsageAttempt, finishUsageAttempt, flushUsage, type TrackedAttempt } from "../lib/usageRuntime.js";
import { emptyTrace, withUsageTracking } from "../lib/usageTracking.js";
import { Router } from "express";
import { AuditError, normalizeAuditUrl } from "../lib/auditEngine.js";
import { captureAndStore, chromeAvailable, getStoredShot } from "../lib/screenshot.js";

export const screenshotsRouter = Router();

// Light per-IP rate limit on LIVE captures (cached reads are nearly free).
const hits = new Map<string, number[]>();
function rateLimited(ip: string): boolean {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < 10 * 60_000);
  if (recent.length >= 30) return true;
  recent.push(now);
  hits.set(ip, recent);
  return false;
}

// GET /api/screenshot?url=...&device=web|mobile[&cached=1] → JPEG
//  cached=1 → serve the stored shot instantly (404 if we've never seen this URL)
//  otherwise → live capture with 1s settle, stored with 2-version rotation
screenshotsRouter.get("/", requireSameOrigin, optionalAuth, identifyOwner, async (req, res) => {
  let attempt: TrackedAttempt | undefined;
  let finalized = false;
  const { url, device, cached } = req.query as { url?: string; device?: string; cached?: string };
  if (!url || (device !== "web" && device !== "mobile")) {
    res.status(400).json({ error: "validation_failed" });
    return;
  }

  try {
    const safeUrl = await normalizeAuditUrl(url); // same SSRF guard as audits

    if (cached === "1") {
      const stored = getStoredShot(safeUrl, device);
      if (!stored) {
        res.status(404).json({ error: "no_cached_shot" });
        return;
      }
      res.type("image/jpeg").setHeader("Cache-Control", "no-store").send(stored);
      return;
    }

    if (process.env.SCREENSHOTS_ENABLED === "false" || !chromeAvailable()) {
      res.status(501).json({ error: "screenshots_unavailable" });
      return;
    }
    const ip = req.ip || req.socket.remoteAddress || "unknown";
    if (rateLimited(ip)) {
      res.status(429).json({ error: "rate_limited" });
      return;
    }

    const owner = req as OwnedRequest;
    attempt = await beginUsageAttempt(owner.user?.uid, "preview-capture-v1", isFreeFeedbackAccount(owner.user));
    const trace = attempt?.trace ?? emptyTrace();
    const { buf, changed, hadPrevious } = await withUsageTracking(trace, () => captureAndStore(safeUrl, device), captured => checkpointUsageAttempt(attempt, captured));
    finishUsageAttempt(attempt, "helper"); finalized = true;
    res
      .type("image/jpeg")
      .setHeader("Cache-Control", "no-store")
      .setHeader("X-Shot-Changed", changed && hadPrevious ? "1" : "0")
      .send(buf);
  } catch (err) {
    if (attempt && !finalized) try { finishUsageAttempt(attempt, "failed"); } catch { /* Recover the persisted trace on restart. */ }
    if (err instanceof AuditError) {
      res.status(err.status).json({ error: "invalid_url", reason: err.message });
      return;
    }
    res.status(502).json({ error: "capture_failed" });
  } finally { if (attempt) void flushUsage(); }
});
