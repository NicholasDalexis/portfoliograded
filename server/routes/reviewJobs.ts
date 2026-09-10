import { Router } from "express";
import { optionalAuth } from "../lib/firebaseAdmin.js";
import { identifyOwner, requireSameOrigin, type OwnedRequest } from "../lib/owner.js";
import { queueReview, readJob, jobSignature, finishJob, JobError, jobExpired } from "../lib/reviewJobs.js";
import { netlifyRequest } from "../lib/netlifyRequest.js";
export function createReviewJobsRouter() {
  const router = Router();
  router.post("/", requireSameOrigin, optionalAuth, identifyOwner, async (req,res) => {
    try {
      const context = netlifyRequest.getStore();
      if (!context) throw new Error("missing_platform_context");
      const owner = req as OwnedRequest;
      const job = await queueReview(owner.ownerId, owner.user, context.ip, req.body);
      if (job.state === "queued") {
        const response = await fetch(`${context.workerOrigin}/.netlify/functions/review-background`, {
          method: "POST", headers: { "content-type": "application/json", "x-pg-job-signature": jobSignature(job.id) },
          body: JSON.stringify({ id: job.id }), signal: AbortSignal.timeout(12_000),
        });
        if (response.status !== 202) { await finishJob(job.id,{error:"The scan could not start. Please try again."}); throw new Error("worker_unavailable"); }
      }
      res.status(202).json({ status: "pending", jobId: job.id });
    } catch(error) {
      if (error instanceof JobError) { res.status(error.status).json({error:error.code,reason:error.message}); return; }
      res.status(503).json({error:"scan_unavailable",reason:"The scan could not start. Please try again."});
    }
  });
  router.get("/jobs/:id", optionalAuth, identifyOwner, async (req,res) => {
    try {
      if (!/^[a-f0-9]{48}$/.test(req.params.id)) {res.status(404).json({error:"not_found"});return;}
      const job = await readJob(req.params.id,(req as OwnedRequest).ownerId);
      if (!job) {res.status(404).json({error:"not_found"});return;}
      if (job.state === "complete") {res.json({status:"complete",reportId:job.reportId});return;}
      if (job.state === "failed" || jobExpired(job)) {res.status(503).json({error:"audit_failed",reason:job.error || "The scan took too long. Please try again."});return;}
      res.status(202).set("Retry-After","3").json({status:"pending",jobId:job.id});
    } catch {res.status(503).json({error:"storage_unavailable"});}
  });
  return router;
}
