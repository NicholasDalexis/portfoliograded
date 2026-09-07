import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import { createHash } from "node:crypto";
import type { Server } from "node:http";
import type { AuditReport } from "@shared/audit.js";

const fixture = vi.hoisted(() => ({ verify: vi.fn(), archive: vi.fn(), runner: vi.fn(), failRename: false }));
vi.mock("firebase-admin/app", () => ({ getApps: () => [], initializeApp: () => ({ name: "fixture" }), cert: () => ({}) }));
vi.mock("firebase-admin/auth", () => ({ getAuth: () => ({ verifyIdToken: fixture.verify }) }));
vi.mock("firebase-admin/firestore", () => ({ getFirestore: () => ({}) }));
vi.mock("node:fs", async actual => ({ ...await actual<any>(), renameSync: (...args: any[]) => {
  if (fixture.failRename) throw new Error("PRIVATE_STORAGE_FAILURE");
  return require("node:fs").renameSync(...args);
} }));
vi.mock("@server/lib/entitlements.js", () => ({ isEntitled: async () => false }));
vi.mock("@server/lib/screenshot.js", () => ({ getArchivedShot: fixture.archive, chromeAvailable: () => false, captureAndStore: () => { throw new Error("Capture forbidden in claim test"); } }));
vi.mock("@server/lib/anthropic.js", () => ({ llmConfigured: () => false, invokeClaudeJSON: () => { throw new Error("Model forbidden in claim test"); } }));
import { createReportClaimsRouter } from "@server/routes/reportClaims.js";
import { createAuditsRouter } from "@server/routes/audits.js";
import { historyRouter } from "@server/routes/history.js";
import { createAudit, getAudit, listOwnedReports } from "@server/lib/auditStore.js";
import { getHistory, historyStorageKey, recordAudit, toggleSuggestion } from "@server/lib/historyStore.js";
import { claimGuestReport, ReportNotClaimable } from "@server/lib/reportClaim.js";
import { secureStore, SecureStore } from "@server/lib/secureStore.js";
import { isFreeFeedbackAccount, optionalAuth, requireAuth } from "@server/lib/firebaseAdmin.js";
import { existingVisitorOwner } from "@server/lib/owner.js";

const token = "A".repeat(43), cookie = `pg_visitor=${token}`;
const guest = `visitor:${createHash("sha256").update(token).digest("hex")}`;
const otherCookie = `pg_visitor=${"B".repeat(43)}`;
const at = "2026-09-01T12:00:00.000Z";
const report = (title = "Selected fix", description = "Selected report feedback"): AuditReport => ({
  url: "https://example.com/portfolio?view=one", role: "Marketing", generatedAt: at, overall: 80, overallGrade: "B", headline: "Synthetic claim fixture", subhead: "No user data", bounceEstimate: 0, bounceTarget: 0, loadDesktopMs: 0, loadMobileMs: 0,
  categories: [{ key: "first_impression", title: "First Impression", blurb: "Fixture", score: 80, grade: "B", premium: false, details: [{ label: "Context", status: "warn", note: description }], recommendation: description }],
  topFixes: [{ title, description, impact: "High", premium: false }],
  rendered: { version: "1", method: "chromium-dom", scope: "homepage-first-viewport", status: "complete", devices: { web: { status: "captured", capture: { capturedAt: at, finalUrl: "https://example.com/portfolio?view=one", viewport: { width: 1440, height: 900 }, imageSha256: "a".repeat(64), imageRef: "PRIVATE_IMAGE_REF", imageChanged: null } }, mobile: { status: "unavailable" } }, limitations: [] } as any,
});
function seed(owner = guest, value = report()) {
  const audit = createAudit({ ownerId: owner, url: value.url, role: value.role, pro: false, report: value });
  const history = recordAudit(audit.id, value, { ownerId: owner, builder: "Other" });
  return { audit, history };
}
const servers: Server[] = [];
async function harness() {
  const app = express(); app.use(express.json());
  app.use("/api/report-claims", createReportClaimsRouter());
  app.use("/api/audits", createAuditsRouter(fixture.runner, async () => false));
  app.use("/api/history", historyRouter);
  app.get("/identity", optionalAuth, (req, res) => res.json({ uid: (req as any).user?.uid ?? null }));
  const server = app.listen(0, "127.0.0.1"); servers.push(server);
  await new Promise<void>(resolve => server.once("listening", resolve));
  const base = `http://127.0.0.1:${(server.address() as any).port}`;
  const headers = (account?: string, capability: string | undefined = cookie): Record<string, string> => ({ ...(account ? { Authorization: `Bearer ${account}` } : {}), ...(capability !== undefined ? { Cookie: capability } : {}) });
  return {
    get: (path: string, account?: string, capability?: string) => fetch(base + path, { headers: headers(account, capability) }),
    claim: (reportId: unknown, account: string | undefined = "alice", capability: string | undefined = cookie, extras: Record<string, string> = {}) => fetch(base + "/api/report-claims", { method: "POST", headers: { "Content-Type": "application/json", ...headers(account, capability), ...extras }, body: JSON.stringify({ reportId }) }),
    raw: (body: unknown) => fetch(base + "/api/report-claims", { method: "POST", headers: { "Content-Type": "application/json", ...headers("alice") }, body: JSON.stringify(body) }),
  };
}
beforeEach(() => {
  vi.stubEnv("FIREBASE_SERVICE_ACCOUNT", JSON.stringify({ project_id: "fixture", client_email: "fixture@example.com", private_key: "synthetic-not-a-key" }));
  fixture.failRename = false; fixture.runner.mockReset(); fixture.archive.mockReset(); fixture.archive.mockReturnValue(Buffer.from("synthetic-jpeg"));
  fixture.verify.mockImplementation(async token => {
    if (token === "alice" || token === "bob") return { uid: token, email: `${token}@example.com`, email_verified: true, firebase: { sign_in_provider: "google.com" } };
    if (token === "anonymous" || token === "password") return { uid: "alice", email_verified: true, firebase: { sign_in_provider: token } };
    if (token === "unverified-google") return { uid: "alice", email_verified: false, firebase: { sign_in_provider: "google.com" } };
    throw new Error("Invalid fixture signature");
  });
  secureStore.update(state => { state.audits = {}; state.histories = {}; state.quotas = {}; });
});
afterAll(async () => { await Promise.all(servers.map(server => new Promise<void>(resolve => server.close(() => resolve())))); vi.unstubAllEnvs(); });

describe("strict supplied bearer identity", () => {
  it("permits absent auth, accepts verified user, and never falls back on forged or malformed supplied auth", async () => {
    const h = await harness();
    expect(await (await h.get("/identity")).json()).toEqual({ uid: null });
    expect(await (await h.get("/identity", "alice")).json()).toEqual({ uid: "alice" });
    for (const value of ["forged", "expired", "wrong-project", "", "Bearer ", "Basic token"]) {
      const req = { headers: { authorization: value.startsWith("Bearer") || value.startsWith("Basic") || !value ? value : `Bearer ${value}` }, user: { uid: "stale-user" } } as any;
      const response = { setHeader: vi.fn(), status: vi.fn().mockReturnThis(), json: vi.fn() } as any, next = vi.fn();
      await optionalAuth(req, response, next); expect(next).not.toHaveBeenCalled(); expect(response.status).toHaveBeenCalledWith(401); expect(req.user).toBeUndefined();
    }
    const req = { headers: {}, user: { uid: "stale-user" } } as any;
    const response = { setHeader: vi.fn(), status: vi.fn().mockReturnThis(), json: vi.fn() } as any, next = vi.fn();
    await requireAuth(req, response, next); expect(response.status).toHaveBeenCalledWith(401); expect(req.user).toBeUndefined(); expect(next).not.toHaveBeenCalled();
  });
  it("rejects invalid supplied bearer before report or screenshot access", async () => {
    const { audit } = seed(); const h = await harness();
    for (const suffix of ["", "/screenshot?device=web"]) expect((await h.get(`/api/audits/${audit.id}${suffix}`, "forged")).status).toBe(401);
    expect(fixture.archive).not.toHaveBeenCalled();
  });
});

describe("exact selected guest report claim", () => {
  it("requires verified Google sign-in for claiming while generic auth still recognizes other valid providers", async () => {
    const { audit } = seed(); const h = await harness();
    for (const token of ["anonymous", "password", "unverified-google"]) {
      expect((await h.get("/identity", token)).status).toBe(200);
      const response = await h.claim(audit.id, token); expect(response.status).toBe(403); expect(await response.json()).toMatchObject({ error: "google_account_required" });
      expect(getAudit(audit.id, guest)).toBeDefined();
    }
    expect(isFreeFeedbackAccount({ uid: "a", provider: "google.com", emailVerified: true })).toBe(true);
    for (const user of [undefined, { uid: "a" }, { uid: "a", provider: "google.com" }, { uid: "a", provider: "google.com", emailVerified: false }, { uid: "a", provider: "password", emailVerified: true }]) expect(isFreeFeedbackAccount(user)).toBe(false);
  });
  it("moves one report and its progress atomically, preserving metadata and screenshot reference without grading", async () => {
    const selected = seed(), unrelated = seed(guest, report("Other fix", "Unrelated guest feedback"));
    const suggestionId = Object.keys(selected.history.suggestions)[0];
    toggleSuggestion(selected.audit.url, suggestionId, true, guest, selected.audit.role);
    const before = structuredClone(getAudit(selected.audit.id, guest)!); const h = await harness();
    const response = await h.claim(selected.audit.id); expect(response.status).toBe(200); expect(await response.json()).toEqual({ reportId: selected.audit.id }); expect(response.headers.get("set-cookie")).toBeNull(); expect(response.headers.get("cache-control")).toBe("private, no-store");
    const saved = getAudit(selected.audit.id, "user:alice")!; expect(saved.createdAt).toBe(before.createdAt); expect(saved.report).toEqual(before.report); expect(saved.pro).toBe(before.pro);
    const accountHistory = getHistory(saved.url, "user:alice", saved.role)!;
    expect(accountHistory.runs.map(run => run.id)).toEqual([saved.id]); expect(accountHistory.runs[0]).toEqual(selected.history.runs[0]); expect(accountHistory.suggestions[suggestionId].done).toBe(true); expect(accountHistory.suggestions[suggestionId].doneAt).toBeTruthy();
    expect(JSON.stringify(accountHistory)).not.toContain("Unrelated guest feedback");
    const remainder = getHistory(saved.url, guest, saved.role)!; expect(remainder.runs.map(run => run.id)).toEqual([unrelated.audit.id]); expect(JSON.stringify(remainder)).not.toContain("Selected report feedback");
    expect((await h.get(`/api/audits/${saved.id}`)).status).toBe(404); expect((await h.get(`/api/audits/${saved.id}/screenshot?device=web`)).status).toBe(404);
    expect((await h.get(`/api/audits/${saved.id}`, "alice")).status).toBe(200); expect((await h.get(`/api/audits/${saved.id}/screenshot?device=web`, "alice")).status).toBe(200);
    expect((await h.get(`/api/audits/${saved.id}/screenshot?device=web`, "bob")).status).toBe(404);
    expect(fixture.archive).toHaveBeenCalledTimes(1); expect(fixture.runner).not.toHaveBeenCalled(); expect(listOwnedReports(guest).map(item => item.id)).toEqual([unrelated.audit.id]);
  });
  it("requires a real existing unambiguous visitor capability and never mints one during claim", async () => {
    const { audit } = seed(); const h = await harness();
    for (const capability of ["", "pg_visitor=short", cookie + "; " + cookie]) {
      const response = await h.claim(audit.id, "alice", capability); expect(response.status).toBe(403); expect(response.headers.get("set-cookie")).toBeNull();
    }
    expect(existingVisitorOwner({ headers: {} } as any)).toBeNull();
    expect((await h.claim(audit.id, "alice", otherCookie)).status).toBe(404);
    expect((await h.claim(audit.id, "")).status).toBe(401);
    expect((await h.claim(audit.id, "forged")).status).toBe(401); expect(getAudit(audit.id, guest)).toBeDefined();
  });
  it("replays only a legitimate same-account same-guest claim and denies account theft or accidental same-account claims", async () => {
    const { audit } = seed(); const h = await harness();
    expect((await h.claim(audit.id)).status).toBe(200); const first = structuredClone(secureStore.read());
    expect((await h.claim(audit.id)).status).toBe(200); expect(secureStore.read()).toEqual(first);
    expect((await h.claim(audit.id, "bob")).status).toBe(404); expect((await h.claim(audit.id, "alice", otherCookie)).status).toBe(404);
    const own = seed("user:alice"); expect((await h.claim(own.audit.id)).status).toBe(404);
    const foreign = seed("user:bob"); expect((await h.claim(foreign.audit.id)).status).toBe(404);
  });
  it("allows only one account to win concurrent claims in the single writer", async () => {
    const { audit } = seed(); const h = await harness();
    const responses = await Promise.all([h.claim(audit.id, "alice"), h.claim(audit.id, "bob")]);
    expect(responses.map(item => item.status).sort()).toEqual([200, 404]);
    expect([getAudit(audit.id, "user:alice"), getAudit(audit.id, "user:bob")].filter(Boolean)).toHaveLength(1);
  });
  it("preserves existing account checklist state/content when guest suggestions collide", async () => {
    const account = seed("user:alice", report("Same title", "Established account feedback"));
    const selected = seed(guest, report("Same title", "Selected guest feedback")); const id = Object.keys(selected.history.suggestions)[0];
    toggleSuggestion(selected.audit.url, id, true, guest, selected.audit.role);
    claimGuestReport(selected.audit.id, guest, "user:alice");
    const history = getHistory(account.audit.url, "user:alice", account.audit.role)!;
    expect(history.runs.map(run => run.id)).toEqual(expect.arrayContaining([selected.audit.id, account.audit.id])); expect(history.runs).toHaveLength(2);
    expect(history.suggestions[id]).toMatchObject({ description: "Established account feedback", done: false }); expect((history.suggestions[id] as any).auditIds).toContain(selected.audit.id); expect(getHistory(selected.audit.url, guest, selected.audit.role)).toBeNull();
  });
  it("removes selected report data from legacy duplicate histories without transferring other pages or roles", () => {
    const selected = seed(); const copied = structuredClone(selected.history);
    secureStore.update(state => { state.histories["legacy-fixture-key"] = copied; });
    const otherValue = report(); otherValue.url += "&another=1"; const other = seed(guest, otherValue);
    claimGuestReport(selected.audit.id, guest, "user:alice");
    expect(secureStore.read().histories["legacy-fixture-key"]).toBeUndefined(); expect(getAudit(other.audit.id, guest)).toBeDefined();
    expect(getHistory(other.audit.url, guest, other.audit.role)?.runs[0].id).toBe(other.audit.id);
  });
  it("claims an older report without inheriting a later unclaimed report's feedback or last-seen date", () => {
    const selected = seed(guest, report("Repeated fix", "Selected original guidance"));
    const later = seed(guest, report("Repeated fix", "Later unrelated guidance"));
    const key = historyStorageKey(guest, selected.audit.url, selected.audit.role), id = Object.keys(selected.history.suggestions)[0];
    secureStore.update(state => { const entry = state.histories[key] as any; entry.runs[0].at = at; entry.runs[1].at = "2026-09-05T12:00:00.000Z"; entry.suggestions[id].lastSeen = entry.runs[1].at; });
    claimGuestReport(selected.audit.id, guest, "user:alice");
    const account = getHistory(selected.audit.url, "user:alice", selected.audit.role)!;
    expect(account.suggestions[id]).toMatchObject({ description: "Selected original guidance", lastSeen: at });
    const remaining = getHistory(later.audit.url, guest, later.audit.role)!;
    expect(remaining.suggestions[id]).toMatchObject({ description: "Later unrelated guidance", lastSeen: "2026-09-05T12:00:00.000Z" });
  });
  it("leaves ownership and progress intact when durable commit fails, then can retry after recovery", async () => {
    const { audit } = seed(); const before = structuredClone(secureStore.read()); const h = await harness(); fixture.failRename = true;
    const response = await h.claim(audit.id); expect(response.status).toBe(503); expect(await response.text()).not.toContain("PRIVATE_STORAGE_FAILURE"); expect(secureStore.read()).toEqual(before);
    fixture.failRename = false; const reopened = new SecureStore(process.env.PG_DATA_DIR!); expect(reopened.read()).toEqual(before);
    expect((await h.claim(audit.id)).status).toBe(200); expect(new SecureStore(process.env.PG_DATA_DIR!).read().audits[audit.id]).toMatchObject({ ownerId: "user:alice" });
  });
  it("rejects cross-origin, injected owner fields, invalid IDs and corrupt foreign history without partial changes", async () => {
    const { audit } = seed(); const h = await harness();
    expect((await h.claim(audit.id, "alice", cookie, { Origin: "https://unrelated.example" })).status).toBe(403);
    for (const body of [null, [], {}, { reportId: "bad" }, { reportId: audit.id, ownerId: "user:bob" }]) expect((await h.raw(body)).status).toBe(400);
    const foreign = seed("user:bob");
    secureStore.update(state => { const key = historyStorageKey("user:alice", audit.url, audit.role); state.histories[key] = foreign.history; });
    const before = structuredClone(secureStore.read()); expect(() => claimGuestReport(audit.id, guest, "user:alice")).toThrow(ReportNotClaimable); expect(secureStore.read()).toEqual(before);
  });
});
