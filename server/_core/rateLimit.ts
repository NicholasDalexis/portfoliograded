/**
 * Lightweight in-memory rate limiter.
 *
 * For an early-access launch on a single Railway instance this is sufficient
 * and has zero external dependencies. If/when PortfolioGraded scales to
 * multiple instances, swap the Map for a Redis (Upstash) store — the
 * `consume()` contract stays identical.
 */
import { TRPCError } from "@trpc/server";
import type { Request } from "express";
import type { User } from "../../drizzle/schema";

type Bucket = { count: number; resetAt: number };

const store = new Map<string, Bucket>();

// Periodically evict expired buckets so the Map doesn't grow unbounded.
const SWEEP_INTERVAL_MS = 5 * 60_000;
setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of Array.from(store.entries())) {
    if (bucket.resetAt <= now) store.delete(key);
  }
}, SWEEP_INTERVAL_MS).unref?.();

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  resetAt: number;
};

/**
 * Fixed-window counter. Returns whether the action is allowed and how many
 * requests remain in the current window.
 */
export function consume(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  const bucket = store.get(key);

  if (!bucket || bucket.resetAt <= now) {
    const resetAt = now + windowMs;
    store.set(key, { count: 1, resetAt });
    return { allowed: true, remaining: limit - 1, resetAt };
  }

  if (bucket.count >= limit) {
    return { allowed: false, remaining: 0, resetAt: bucket.resetAt };
  }

  bucket.count += 1;
  return { allowed: true, remaining: limit - bucket.count, resetAt: bucket.resetAt };
}

/** Best-effort client IP, honoring Railway's proxy headers. */
export function clientIp(req: Request): string {
  const fwd = req.headers["x-forwarded-for"];
  if (typeof fwd === "string" && fwd.length > 0) return fwd.split(",")[0].trim();
  if (Array.isArray(fwd) && fwd.length > 0) return fwd[0];
  return req.ip || req.socket.remoteAddress || "unknown";
}

export type RateLimitOptions = {
  /** Requests allowed per window for anonymous (IP-keyed) callers. */
  anonLimit: number;
  /** Requests allowed per window for signed-in free users. */
  freeLimit: number;
  /** Requests allowed per window for Pro users. */
  proLimit: number;
  windowMs: number;
};

/**
 * Resolve the right key + limit for a caller, then consume one token.
 * Throws TOO_MANY_REQUESTS when exhausted.
 */
export function enforce(
  req: Request,
  user: User | null,
  isPro: boolean,
  scope: string,
  opts: RateLimitOptions,
): void {
  let key: string;
  let limit: number;

  if (!user) {
    key = `${scope}:ip:${clientIp(req)}`;
    limit = opts.anonLimit;
  } else if (isPro) {
    key = `${scope}:pro:${user.id}`;
    limit = opts.proLimit;
  } else {
    key = `${scope}:free:${user.id}`;
    limit = opts.freeLimit;
  }

  const result = consume(key, limit, opts.windowMs);
  if (!result.allowed) {
    const minutes = Math.max(1, Math.ceil((result.resetAt - Date.now()) / 60_000));
    throw new TRPCError({
      code: "TOO_MANY_REQUESTS",
      message: `Rate limit reached. Try again in about ${minutes} minute${minutes === 1 ? "" : "s"}.`,
    });
  }
}
