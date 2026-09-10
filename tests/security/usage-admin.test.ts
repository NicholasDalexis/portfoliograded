import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import type { Server } from "node:http";

const fixture = vi.hoisted(() => ({ db: vi.fn(() => { throw new Error("Firestore prohibited in admin fixture"); }) }));
vi.mock("@server/lib/firebaseAdmin.js", () => ({ db: fixture.db, requireAuth: (req: any, res: any, next: () => void) => {
  res.setHeader("Cache-Control", "private, no-store");
  if (req.headers.authorization === "Bearer fixture-admin") req.user = { uid: "fixture-admin", provider: "google.com", emailVerified: true };
  else if (req.headers.authorization === "Bearer fixture-user") req.user = { uid: "fixture-user", provider: "google.com", emailVerified: true };
  else { res.status(401).json({ error: "unauthenticated" }); return; }
  next();
} }));
import { adminRouter } from "@server/routes/admin.js";
import { secureStore } from "@server/lib/secureStore.js";
import { beginSubmission } from "@server/lib/submissions.js";
import { recordRoleDemandInDocument, sanitizedRoleDemand, type RoleDemand } from "@server/lib/roleDemand.js";
import { GENERAL_RUBRIC } from "@shared/rubrics.js";

const servers: Server[] = [];
async function harness() {
  const app = express(); app.use(express.json()); app.use("/api/admin", adminRouter);
  const server = app.listen(0, "127.0.0.1"); servers.push(server); await new Promise<void>(resolve => server.once("listening", resolve));
  const base = `http://127.0.0.1:${(server.address() as any).port}`;
  return (path: string, account = "fixture-admin", method = "GET", extra: Record<string, string> = {}) => fetch(base + "/api/admin" + path, { method, headers: { ...(account ? { Authorization: `Bearer ${account}` } : {}), ...extra } });
}
beforeEach(() => {
  vi.stubEnv("PG_ADMIN_UIDS", "fixture-admin"); vi.stubEnv("PG_USAGE_ENABLED", "false"); vi.stubEnv("PG_DEPLOYMENT_ENV", "preview");
  vi.stubEnv("PG_USAGE_SLACK_BOT_TOKEN", ""); vi.stubEnv("PG_USAGE_SLACK_CHANNEL_ID", ""); vi.stubEnv("PG_USAGE_SLACK_DESTINATION_VERIFIED", "false");
  fixture.db.mockClear();
  secureStore.update(state => { state.audits = {}; state.histories = {}; state.quotas = {}; state.submissions = {}; state.roleDemand = {}; state.usageAttempts = {}; });
});
afterAll(async () => { await Promise.all(servers.map(server => new Promise<void>(resolve => server.close(() => resolve())))); vi.unstubAllEnvs(); });

describe("private usage and role-demand admin surface", () => {
  it("denies nonadmin and unauthenticated reads/sweeps without exposing aggregate or submitted-role data", async () => {
    beginSubmission("https://example.com/PRIVATE-PORTFOLIO", "Architecture"); const request = await harness();
    for (const [path, method] of [["/usage", "GET"], ["/submissions", "GET"], ["/usage/sweep", "POST"]]) {
      const response = await request(path, "fixture-user", method); expect(response.status).toBe(403); expect(response.headers.get("cache-control")).toBe("private, no-store");
      const body = await response.text(); expect(body).toBe('{"error":"forbidden"}'); expect(body).not.toMatch(/Architecture|architecture|PRIVATE-PORTFOLIO|unsupportedRoleDemand|totals/);
      expect((await request(path, "", method)).status).toBe(401);
    }
    expect(fixture.db).not.toHaveBeenCalled();
  });
  it("shows inactive state as unavailable rather than fabricated zero totals and keeps the admin response no-store", async () => {
    beginSubmission("https://example.com/PRIVATE-PORTFOLIO", "Architecture"); const request = await harness();
    const response = await request("/usage"); expect(response.status).toBe(200); expect(response.headers.get("cache-control")).toBe("private, no-store");
    const body = await response.json(); expect(body).toMatchObject({ enabled: false, activation: null, state: null, transportConfigured: false, lastFlushAt: null, lastError: null, pendingHandoffs: 0 });
    expect(body.unsupportedRoleDemand).toEqual([expect.objectContaining({ label: "architecture", count: 1, appliedRubric: GENERAL_RUBRIC.key })]);
    expect(JSON.stringify(body)).not.toContain("PRIVATE-PORTFOLIO"); expect(body.state).not.toEqual({ totals: { completed: 0 } });
    expect((await request("/usage/sweep", "fixture-admin", "POST")).status).toBe(200);
    expect((await request("/usage/sweep", "fixture-admin", "POST", { Origin: "https://unrelated.example" })).status).toBe(403);
    expect(fixture.db).not.toHaveBeenCalled();
  });
  it("keeps requested raw role and applied rubric separate in the private submission view", async () => {
    const raw = "Architecture <private-note>"; const id = beginSubmission("https://example.com/private-fixture", raw, "Other");
    beginSubmission("https://example.com/marketing", "Marketing"); const request = await harness();
    const response = await request("/submissions"); expect(response.headers.get("cache-control")).toBe("private, no-store"); const body = await response.json();
    expect(body.submissions.find((item: any) => item.id === id)).toMatchObject({ role: raw, appliedRubric: GENERAL_RUBRIC.key, builder: "Other", status: "running" });
    expect(body.submissions.find((item: any) => item.role === "Marketing")).toMatchObject({ role: "Marketing", appliedRubric: "marketing" });
    const usage = await (await request("/usage")).json(); expect(JSON.stringify(usage)).not.toContain(raw); expect(usage.unsupportedRoleDemand).toEqual([expect.objectContaining({ label: "other (unclassified)", count: 1 })]);
  });
});

describe("bounded unsupported role demand", () => {
  it("groups safe labels and turns URL/email/HTML/control/oversized content into a generic label", () => {
    expect(sanitizedRoleDemand("  Ａrchitecture  ")).toBe("architecture"); expect(sanitizedRoleDemand("Landscape   Architecture")).toBe("landscape architecture");
    for (const raw of ["https://private.example/portfolio", "person@example.com", "<script>alert(1)</script>", "Architecture\u0000Private", "Architecture\nPrivate", "Architecture\tPrivate", "Architecture\u202EPrivate", "A".repeat(1000), "123456"])
      expect(sanitizedRoleDemand(raw)).toBe("other (unclassified)");
    const at = "2026-09-06T12:00:00.000Z";
    secureStore.update(state => { recordRoleDemandInDocument(state, "  Architecture ", at); recordRoleDemandInDocument(state, "architecture", "2026-09-06T13:00:00.000Z"); for (const role of ["Marketing", "Creative", "General portfolio", "Other"]) recordRoleDemandInDocument(state, role, at); });
    expect(Object.values(secureStore.read().roleDemand ?? {})).toEqual([expect.objectContaining({ label: "architecture", count: 2, firstAt: at, lastAt: "2026-09-06T13:00:00.000Z", appliedRubric: GENERAL_RUBRIC.key })]);
  });
  it("caps total buckets including overflow at 200, preserving total demand counts", async () => {
    const label = (n: number) => "unlisted " + String.fromCharCode(97 + Math.floor(n / 26)) + String.fromCharCode(97 + n % 26);
    secureStore.update(state => { for (let n = 0; n < 240; n++) recordRoleDemandInDocument(state, label(n), "2026-09-06T12:00:00.000Z"); });
    const buckets = Object.values(secureStore.read().roleDemand ?? {}) as RoleDemand[];
    expect(buckets.length).toBeLessThanOrEqual(200); expect(buckets.reduce((total, item) => total + item.count, 0)).toBe(240);
    expect(buckets.find(item => item.label === "other (unclassified)")?.count).toBeGreaterThan(0);
    const request = await harness(); const body = await (await request("/usage")).json(); expect(body.unsupportedRoleDemand.length).toBeLessThanOrEqual(200);
  });
});
