import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const fake = vi.hoisted(() => {
  const control = { rows: new Map<string, any>(), tail: Promise.resolve() as Promise<unknown>, failNextRename: false, failDeleteAfterRecord: false, db: vi.fn(() => ({})) };
  const repository = {
    transaction<T>(work: (tx: { get<V>(key: string): Promise<V | undefined>; set(key: string, value: unknown): void }) => Promise<T>): Promise<T> {
      const run = control.tail.then(async () => {
        const draft = new Map([...control.rows].map(([key, value]) => [key, structuredClone(value)])); const writes: string[] = []; let wrote = false;
        const result = await work({ get: async <V>(key: string) => { if (wrote) throw new Error("read_after_write"); return structuredClone(draft.get(key)) as V | undefined; }, set: (key, value) => { wrote = true; writes.push(key); draft.set(key, structuredClone(value)); } });
        control.rows = draft;
        if (control.failDeleteAfterRecord && writes.some(key => key.startsWith("events/"))) { control.failDeleteAfterRecord = false; control.failNextRename = true; }
        return result;
      }); control.tail = run.catch(() => {}); return run;
    },
    async due() { return []; },
  };
  return { control, repository };
});
vi.mock("@server/lib/firebaseAdmin.js", () => ({ db: fake.control.db }));
vi.mock("@server/lib/usageFirestore.js", () => ({ firestoreUsageRepository: () => fake.repository }));
vi.mock("@server/lib/usageNotifications.js", () => ({ slackMilestoneSender: () => undefined }));
vi.mock("node:fs", async actual => ({ ...await actual<any>(), renameSync: (...args: any[]) => { if (fake.control.failNextRename) { fake.control.failNextRename = false; throw new Error("FIXTURE_PRIVATE_DISK_FAILURE"); } return require("node:fs").renameSync(...args); } }));

const production = { NODE_ENV: "production", PG_DEPLOYMENT_ENV: "production", PG_USAGE_ENABLED: "true", PG_USAGE_ACTIVATION_ID: "runtime-fixture-001", PG_USAGE_ACTIVATED_AT: "2026-09-01T00:00:00.000Z", PG_ADMIN_UIDS: "fixture-admin" };
const model = { provider: "anthropic" as const, model: "claude-sonnet-4-5", stage: "review" as const, status: "succeeded" as const, inputTokens: 200, outputTokens: 30, cacheReadTokens: 0, cacheWriteTokens: 0, durationMs: 100 };
const value = () => ({ url: "https://example.com/runtime-fixture", role: "Marketing", generatedAt: "2026-09-06T12:00:00.000Z", overall: 80, overallGrade: "B", headline: "Runtime fixture", subhead: "No real report", bounceEstimate: 0, bounceTarget: 0, loadDesktopMs: 0, loadMobileMs: 0,
  categories: [{ key: "first_impression", title: "First Impression", blurb: "Fixture", score: 80, grade: "B", premium: false, details: [], recommendation: "Add context" }], topFixes: [],
  acceptedEvidence: { version: 1, methodVersion: "fixture-method", scope: "homepage-html-and-first-viewport", rubricKey: "marketing", rubricVersion: "fixture", roleKey: "Marketing", url: "https://example.com/runtime-fixture", fingerprint: "a".repeat(64) },
}) as any;
const load = async () => ({ runtime: await import("@server/lib/usageRuntime.js"), store: (await import("@server/lib/secureStore.js")).secureStore });
const events = () => [...fake.control.rows.entries()].filter(([key]) => key.startsWith("events/")).map(([, value]) => value);
beforeEach(() => {
  vi.resetModules(); fake.control.rows = new Map(); fake.control.tail = Promise.resolve(); fake.control.failNextRename = false; fake.control.failDeleteAfterRecord = false; fake.control.db.mockClear();
  vi.stubEnv("PG_DATA_DIR", mkdtempSync(path.join(tmpdir(), "pg-usage-runtime-fixture-")));
  for (const [key, value] of Object.entries(production)) vi.stubEnv(key, value);
  vi.stubEnv("PG_USAGE_RATES_JSON", ""); vi.stubEnv("PG_LOCAL_BOOTSTRAP", ""); vi.stubEnv("PG_BIND_HOST", "");
});
afterEach(() => vi.unstubAllEnvs());

describe("durable runtime handoff with all cloud services mocked", () => {
  it("counts only verified Google identities as converted accounts and keeps other valid providers in the anonymous split", async () => {
    const { runtime } = await load();
    const inputs = [{ uid: "google-user", verified: true }, { uid: "firebase-anonymous-user", verified: false }, { uid: undefined, verified: false }];
    for (const [index, input] of inputs.entries()) {
      const attempt = (await runtime.beginUsageAttempt(input.uid, "fixture-method", input.verified))!;
      runtime.finishUsageAttempt(attempt, "completed", `fixture-assessment-${index}`);
    }
    await runtime.flushUsage();
    expect(fake.control.rows.get("state/active").totals).toMatchObject({ completed: 3, accountReviews: 1, anonymousReviews: 2, uniqueAccounts: 1 });
    expect(events().filter(event => event.accountKey)).toHaveLength(1);
    expect(JSON.stringify(events())).not.toContain("google-user"); expect(JSON.stringify(events())).not.toContain("firebase-anonymous-user");
  });
  it("does not initialize a service or create attempts in local/preview/test/admin mode and rejects malformed production activation", async () => {
    const { runtime, store } = await load();
    for (const [key, value] of [["PG_USAGE_ENABLED", "false"], ["PG_DEPLOYMENT_ENV", "preview"], ["NODE_ENV", "test"]]) {
      vi.stubEnv(key, value); expect(await runtime.beginUsageAttempt("fixture-user", "fixture-method")).toBeUndefined(); vi.stubEnv(key, production[key as keyof typeof production]);
    }
    vi.stubEnv("NODE_ENV", "development"); vi.stubEnv("PG_LOCAL_BOOTSTRAP", "1"); vi.stubEnv("PG_BIND_HOST", "127.0.0.1");
    expect(await runtime.beginUsageAttempt("fixture-user", "fixture-method")).toBeUndefined(); vi.stubEnv("NODE_ENV", "production");
    expect(await runtime.beginUsageAttempt("fixture-admin", "fixture-method")).toBeUndefined(); expect(fake.control.db).not.toHaveBeenCalled(); expect(store.read().usageAttempts).toBeUndefined();
    vi.stubEnv("PG_USAGE_ACTIVATION_ID", "bad"); await expect(runtime.beginUsageAttempt("fixture-user", "fixture-method")).rejects.toThrow("invalid_usage_activation"); expect(fake.control.db).not.toHaveBeenCalled();
  });
  it("commits accepted report/history/submission and ready usage together, or leaves all unchanged when durable rename fails", async () => {
    const { runtime, store } = await load(); const { createCompletedAudit } = await import("@server/lib/auditStore.js");
    const attempt = (await runtime.beginUsageAttempt("fixture-user", "fixture-method"))!;
    store.update(state => { state.submissions = { submission: { status: "pending" } }; });
    const before = structuredClone(store.read()); fake.control.failNextRename = true;
    const params = { ownerId: "user:fixture-user", url: value().url, role: "Marketing", pro: false, report: value() };
    expect(() => createCompletedAudit(params, { usageAttempt: attempt, submissionId: "submission" })).toThrow("FIXTURE_PRIVATE_DISK_FAILURE"); expect(store.read()).toEqual(before);
    const result = createCompletedAudit(params, { usageAttempt: attempt, submissionId: "submission" });
    const state = store.read(), pending = state.usageAttempts![attempt.id] as any;
    expect(state.audits[result.stored.id]).toBeDefined(); expect(Object.values(state.histories)).toHaveLength(1); expect(state.submissions?.submission).toMatchObject({ status: "completed", auditId: result.stored.id });
    expect(pending).toMatchObject({ status: "ready", event: { kind: "completed", assessmentId: result.stored.id } });
    await runtime.flushUsage(); expect(events()).toHaveLength(1); expect(events()[0].assessmentId).toBe(result.stored.id); expect(store.read().usageAttempts).toEqual({});
  });
  it("recovers an interrupted prior-process attempt as failed with its checkpointed tokens after module restart", async () => {
    const initial = await load(); const attempt = (await initial.runtime.beginUsageAttempt(undefined, "fixture-method"))!;
    attempt.trace.models.push(model); attempt.trace.browsers.push({ status: "failed", durationMs: 430 }); initial.runtime.checkpointUsageAttempt(attempt, attempt.trace);
    expect((initial.store.read().usageAttempts?.[attempt.id] as any).status).toBe("running");
    vi.resetModules(); const restarted = await load(); await restarted.runtime.flushUsage();
    expect(events()).toHaveLength(1); expect(events()[0]).toMatchObject({ id: attempt.id, kind: "failed", trace: { models: [model], browsers: [{ durationMs: 430, status: "failed" }] } });
    const totals = fake.control.rows.get("state/active").totals; expect(totals).toMatchObject({ completed: 0, failed: 1, browserCalls: 1 }); expect(Object.values(totals.models)[0]).toMatchObject({ calls: 1, input: 200, output: 30 }); expect(restarted.store.read().usageAttempts).toEqual({});
  });
  it("replays one stable event after remote commit succeeds but local queue deletion fails, without double counting", async () => {
    const initial = await load(); const attempt = (await initial.runtime.beginUsageAttempt("fixture-user", "fixture-method"))!;
    attempt.trace.models.push(model); initial.runtime.finishUsageAttempt(attempt, "completed", "fixture-accepted-report");
    fake.control.failDeleteAfterRecord = true; await initial.runtime.flushUsage();
    expect(events()).toHaveLength(1); expect(initial.store.read().usageAttempts?.[attempt.id]).toBeDefined(); expect(fake.control.rows.get("state/active").totals.completed).toBe(1);
    vi.resetModules(); const restarted = await load(); await restarted.runtime.flushUsage();
    expect(events()).toHaveLength(1); expect(fake.control.rows.get("state/active").totals.completed).toBe(1); expect(Object.values(fake.control.rows.get("state/active").totals.models)[0]).toMatchObject({ calls: 1, input: 200, output: 30 }); expect(restarted.store.read().usageAttempts).toEqual({});
  });
});
