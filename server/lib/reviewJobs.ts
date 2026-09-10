import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { secureStore } from "./secureStore.js";
import { withStore } from "./withStore.js";
import { positiveLimit } from "./quotaBudget.js";
import { parsePublicUrl } from "./publicNetwork.js";
import type { AuthedUser } from "./firebaseAdmin.js";
export interface ReviewJob {
  id: string; ownerId: string; user?: AuthedUser; ipKey: string;
  input: { url: string; role: string; builder?: string }; key: string;
  state: "queued" | "running" | "complete" | "failed";
  createdAt: number; startedAt?: number; reportId?: string; error?: string;
}
const JOB_LIFETIME = 15 * 60_000;
export class JobError extends Error { constructor(public status: number, public code: string, message: string) { super(message); } }
export function jobSignature(id: string): string {
  const secret = process.env.PG_JOB_SECRET;
  if (!secret || !/^[a-f0-9]{64}$/.test(secret)) throw new Error("job_secret_required");
  return createHmac("sha256", secret).update(`portfolio-review:${id}`).digest("hex");
}
export function validJobSignature(id: string, signature: string): boolean {
  if (!/^[a-f0-9]{48}$/.test(id) || !/^[a-f0-9]{64}$/.test(signature)) return false;
  return timingSafeEqual(Buffer.from(signature), Buffer.from(jobSignature(id)));
}
export async function queueReview(ownerId: string, user: AuthedUser | undefined, ip: string, input: unknown): Promise<ReviewJob> {
  const value = input as Record<string, unknown>;
  if (!value || typeof value.url !== "string" || value.url.length > 2048 || !value.url.trim()) throw new JobError(400,"validation_failed","Enter a portfolio URL under 2,048 characters.");
  let url: string;
  try { const parsed = parsePublicUrl(value.url); parsed.hash = ""; url = parsed.toString(); }
  catch { throw new JobError(400,"validation_failed","Enter a public portfolio URL."); }
  const role = typeof value.role === "string" && value.role.trim() ? value.role.trim().slice(0,100) : "Creative";
  const builder = typeof value.builder === "string" && value.builder.trim() ? value.builder.trim().slice(0,40) : undefined;
  const key = createHash("sha256").update(JSON.stringify([ownerId,url,role.toLowerCase()])).digest("hex");
  const now = Date.now();
  return withStore(() => secureStore.update(state => {
    state.jobs ??= {};
    const jobs = state.jobs as Record<string, ReviewJob>;
    for (const [id, job] of Object.entries(jobs)) {
      if (now - job.createdAt > 86400_000) delete jobs[id];
      else if (["queued","running"].includes(job.state) && now - job.createdAt > JOB_LIFETIME) { job.state = "failed"; job.error = "The scan took too long. Please try again."; }
    }
    const active = Object.values(jobs).filter(job => ["queued","running"].includes(job.state));
    const previous = active.find(job => job.key === key);
    // A repeated click resumes exactly the existing job without spending another quota.
    if (previous) return previous;
    if (active.length >= positiveLimit(process.env.AUDITS_MAX_CONCURRENT,2)) throw new JobError(429,"busy","Two portfolios are being reviewed. Try again shortly.");
    if (Object.keys(jobs).length >= 1000) throw new JobError(429,"busy","The preview has reached its daily scan limit.");
    const job: ReviewJob = { id: randomBytes(24).toString("hex"), ownerId,
      ...(user ? { user: { uid: user.uid, provider: user.provider, emailVerified: user.emailVerified } } : {}),
      ipKey: createHash("sha256").update(ip).digest("hex"), key,
      input: { url, role, ...(builder ? { builder } : {}) }, state: "queued", createdAt: now };
    jobs[job.id] = job; return job;
  }), true);
}
export async function startJob(id: string): Promise<ReviewJob | null> {
  return withStore(() => secureStore.update(state => {
    const job = state.jobs?.[id] as ReviewJob | undefined;
    if (!job || job.state !== "queued" || Date.now() - job.createdAt > JOB_LIFETIME) return null;
    job.state = "running"; job.startedAt = Date.now(); return job;
  }), true);
}
export async function finishJob(id: string, result: { reportId: string } | { error: string }) {
  return withStore(() => secureStore.update(state => {
    const job = state.jobs?.[id] as ReviewJob | undefined;
    if (!job || !["queued","running"].includes(job.state)) return;
    if ("reportId" in result) { job.state = "complete"; job.reportId = result.reportId; }
    else { job.state = "failed"; job.error = result.error.slice(0,300); }
  }), true);
}
export async function readJob(id: string, ownerId: string): Promise<ReviewJob | null> {
  return withStore(() => {
    const job = secureStore.read().jobs?.[id] as ReviewJob | undefined;
    return job && job.ownerId === ownerId && Date.now() - job.createdAt <= 86400_000 ? job : null;
  });
}
export function jobExpired(job: ReviewJob): boolean { return Date.now() - job.createdAt > JOB_LIFETIME; }
