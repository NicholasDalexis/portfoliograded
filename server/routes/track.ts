/**
 * First-party event counts. Store only the shared allowlist and a server date.
 * IP is used transiently for rate limiting, never written into the event.
 */
import { appendFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { Router } from "express";
import { sanitizeAnalytics, type AnalyticsRecord } from "../../shared/analytics.js";

const DATA_DIR = process.env.PG_DATA_DIR || path.resolve(process.cwd(), "data");
const FILE = path.join(DATA_DIR, "analytics.jsonl");
function persistAnalytics(record: AnalyticsRecord) {
  mkdirSync(DATA_DIR, { recursive: true });
  appendFileSync(FILE, JSON.stringify(record) + "\n", "utf8");
}

/** Injection permits offline request tests without touching application data. */
export function createTrackRouter(writeEvent: (record: AnalyticsRecord) => void = persistAnalytics) {
  const router = Router();
  const hits = new Map<string, number[]>();
  router.post("/", (req, res) => {
    const now = Date.now();
    const ip = req.ip || "unknown";
    const recent = (hits.get(ip) ?? []).filter(t => now - t < 60_000);
    if (recent.length >= 60) { res.status(429).json({ ok: false }); return; }
    recent.push(now);
    hits.set(ip, recent);
    const clean = sanitizeAnalytics(req.body);
    if (!clean) { res.status(400).json({ error: "validation_failed" }); return; }
    try {
      writeEvent({ ...clean, at: new Date(now).toISOString() });
    } catch {
      // The client ignores failures, but do not report an unwritten event as saved.
      res.status(503).json({ ok: false });
      return;
    }
    res.json({ ok: true });
  });
  return router;
}
export const trackRouter = createTrackRouter();

