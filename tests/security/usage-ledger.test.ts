import { describe, expect, it, vi } from "vitest";
import { UsageLedger, parseRateCard, usageKey, type Activation, type UsageEvent, type UsageMilestone, type UsageRepository, type UsageTransaction } from "@server/lib/usageLedger.js";
import { milestoneMessage, slackMilestoneSender } from "@server/lib/usageNotifications.js";
import { firestoreUsageRepository } from "@server/lib/usageFirestore.js";
import { emptyTrace, measuredTokens, recordBrowserUsage, recordModelUsage, withUsageTracking, type ModelUsage } from "@server/lib/usageTracking.js";

/** A serializable shared repository with rollback and an optional discarded
 * callback retry. Reads return copies, as a remote document store does. No
 * Firestore SDK, network, production storage or notification transport is used. */
class FakeTransactionalRepository implements UsageRepository {
  rows = new Map<string, unknown>();
  private tail: Promise<unknown> = Promise.resolve();
  retryNext = false;
  sortedReads = false;
  private copy<T>(value: T): T {
    if (value === undefined) return value;
    const result = structuredClone(value);
    if (!this.sortedReads) return result;
    const sort = (item: any): any => Array.isArray(item) ? item.map(sort) : item && typeof item === "object" ? Object.fromEntries(Object.keys(item).sort().map(key => [key, sort(item[key])])) : item;
    return sort(result);
  }
  transaction<T>(work: (transaction: UsageTransaction) => Promise<T>): Promise<T> {
    const run = this.tail.then(async () => {
      const attempt = async () => {
        const draft = new Map([...this.rows].map(([key, value]) => [key, this.copy(value)])); let wrote = false;
        const result = await work({ get: async <V>(key: string) => { if (wrote) throw new Error("read_after_write"); return this.copy(draft.get(key)) as V | undefined; }, set: (key, value) => { wrote = true; draft.set(key, this.copy(value)); } });
        return { result, draft };
      };
      if (this.retryNext) { this.retryNext = false; await attempt(); }
      const { result, draft } = await attempt(); this.rows = draft; return result;
    });
    this.tail = run.catch(() => {}); return run;
  }
  async due(now: number, limit: number) {
    await this.tail;
    return [...this.rows.entries()].filter(([key, value]) => key.startsWith("outbox/") && ((value as UsageMilestone).availableAt ?? Infinity) <= now)
      .sort((a, b) => (a[1] as UsageMilestone).availableAt! - (b[1] as UsageMilestone).availableAt!).slice(0, limit).map(([key]) => key);
  }
  get<T>(key: string): T | undefined { return this.copy(this.rows.get(key)) as T | undefined; }
}
const activation: Activation = { id: "qa-activation-001", activatedAt: "2026-09-01T00:00:00.000Z", baseline: 0 };
const event = (n: number, patch: Partial<UsageEvent> = {}): UsageEvent => ({ id: `event-${n}`, activationId: activation.id, startedAt: "2026-09-06T12:00:00.000Z", finishedAt: new Date(Date.parse("2026-09-06T12:00:00.000Z") + n * 1000).toISOString(), source: "production", kind: "completed", assessmentId: `assessment-${n}`, release: "1.1.6", method: "qa-method-v1", trace: emptyTrace(), ...patch });
const model = (patch: Partial<ModelUsage> = {}): ModelUsage => ({ provider: "anthropic", model: "claude-sonnet-4-5", stage: "review", status: "succeeded", inputTokens: 1000, outputTokens: 100, cacheReadTokens: 0, cacheWriteTokens: 0, durationMs: 100, ...patch });
const create = async (repository = new FakeTransactionalRepository()) => { const ledger = new UsageLedger(repository, activation); await ledger.initialize(); return { ledger, repository }; };
const fill = async (ledger: UsageLedger, from: number, to: number) => { for (let n = from; n <= to; n++) await ledger.record(event(n)); };
const milestone = (repo: FakeTransactionalRepository, n = 100) => repo.get<UsageMilestone>(`outbox/${activation.id}-${n}`)!;
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(r => { resolve = r; }); return { promise, resolve }; }

describe("transactional completion milestones", () => {
  it("requires explicit production activation and rejects an unsupported imported baseline", async () => {
    const { productionUsageActivation } = await import("@server/lib/usageRuntime.js");
    const configured = { PG_USAGE_ENABLED: "true", PG_DEPLOYMENT_ENV: "production", NODE_ENV: "production", PG_USAGE_ACTIVATION_ID: activation.id, PG_USAGE_ACTIVATED_AT: activation.activatedAt };
    expect(productionUsageActivation(configured)).toEqual(activation);
    for (const patch of [{ PG_USAGE_ENABLED: "false" }, { PG_DEPLOYMENT_ENV: "preview" }, { NODE_ENV: "test" }, { NODE_ENV: "development", PG_LOCAL_BOOTSTRAP: "1", PG_BIND_HOST: "127.0.0.1" }]) expect(productionUsageActivation({ ...configured, ...patch })).toBeUndefined();
    expect(() => new UsageLedger(new FakeTransactionalRepository(), { ...activation, baseline: 100 } as any)).toThrow("invalid_usage_activation");
    expect(() => productionUsageActivation({ ...configured, PG_USAGE_ACTIVATED_AT: "9999-01-01T00:00:00.000Z" })).toThrow("usage_activation_in_future");
  });
  it("uses isolated Firestore adapter namespaces and due-query fields with a fake transactional database", async () => {
    const backing = new FakeTransactionalRepository();
    const collection = (path: string, query: { now?: number; limit?: number } = {}): any => ({
      doc: (id: string) => ({ path: `${path}/${id}`, collection: (name: string) => collection(`${path}/${id}/${name}`) }),
      where: (field: string, operator: string, now: number) => { expect(field).toBe("availableAt"); expect(operator).toBe("<="); return collection(path, { ...query, now }); },
      orderBy: (field: string) => { expect(field).toBe("availableAt"); return collection(path, query); },
      limit: (limit: number) => collection(path, { ...query, limit }),
      get: async () => ({ docs: [...backing.rows.entries()].filter(([key, raw]) => key.startsWith(path + "/") && ((raw as UsageMilestone).availableAt ?? Infinity) <= query.now!).slice(0, query.limit).map(([key]) => ({ id: key.split("/").at(-1) })) }),
    });
    const db = { collection, runTransaction: (work: (tx: any) => Promise<any>) => backing.transaction(tx => work({ get: async (ref: { path: string }) => { const data = await tx.get(ref.path); return { exists: data !== undefined, data: () => data }; }, set: (ref: { path: string }, data: unknown) => tx.set(ref.path, data) })) };
    const repo = firestoreUsageRepository(db as any, activation.id), ledger = new UsageLedger(repo, activation); await ledger.initialize(); await fill(ledger, 1, 100);
    const due = await repo.due(Date.now() + 1000, 10); expect(due).toEqual([`outbox/${activation.id}-100`]);
    const otherActivation = { ...activation, id: "qa-other-activation" };
    const other = new UsageLedger(firestoreUsageRepository(db as any, otherActivation.id), otherActivation); await other.initialize(); expect((await other.state())?.totals.completed).toBe(0);
    expect(await ledger.drain(async () => "adapter-fixture-confirmation", Date.now() + 1000)).toBe(1); expect(await repo.due(Date.now() + 1000000, 10)).toEqual([]);
  });
  it("creates one outbox record at 100 and 200, none at 99 or 101, and records per-period/account counts", async () => {
    const { ledger, repository } = await create();
    for (let n = 1; n <= 99; n++) await ledger.record(event(n, { accountKey: n % 2 ? "hashed-alice" : undefined }));
    expect(milestone(repository)).toBeUndefined();
    await ledger.record(event(100, { accountKey: "hashed-bob" }));
    expect(milestone(repository)).toMatchObject({ threshold: 100, status: "pending", attempts: 0, period: { completed: 100, uniqueAccounts: 2, accountReviews: 51, anonymousReviews: 49 } });
    await ledger.record(event(101)); expect([...repository.rows.keys()].filter(key => key.startsWith("outbox/"))).toHaveLength(1);
    await fill(ledger, 102, 200); expect(milestone(repository, 200)).toMatchObject({ threshold: 200, period: { completed: 100 }, cumulative: { completed: 200 }, monthToDate: { completed: 200 } });
    expect((await ledger.state())?.period.completed).toBe(0);
  });
  it("deduplicates event delivery and accepted assessments independently without losing distinct metered attempt costs", async () => {
    const { ledger } = await create(); const first = event(1, { trace: { models: [model()], browsers: [] }, accountKey: "hashed-alice" });
    expect(await ledger.record(first)).toBe("recorded"); expect(await ledger.record(first)).toBe("duplicate");
    expect(await ledger.record({ ...first, id: "separate-metered-attempt" })).toBe("recorded");
    const totals = (await ledger.state())!.totals;
    expect(totals).toMatchObject({ completed: 1, uniqueAccounts: 1, accountReviews: 1 });
    expect(Object.values(totals.models)[0]).toMatchObject({ calls: 2, input: 2000, output: 200, unpricedCalls: 2 });
  });
  it("survives restart, reordered map keys and transaction callback retry without duplicate totals", async () => {
    const { ledger, repository } = await create(); repository.retryNext = true;
    await ledger.record(event(1)); repository.sortedReads = true;
    const restarted = new UsageLedger(repository, { ...activation });
    await expect(restarted.initialize()).resolves.toBeUndefined();
    expect(await restarted.record(event(1))).toBe("duplicate"); expect((await restarted.state())?.totals.completed).toBe(1);
    await expect(new UsageLedger(repository, { ...activation, activatedAt: "2026-09-02T00:00:00.000Z" }).initialize()).rejects.toThrow("usage_activation_mismatch");
  });
  it("serializes independent concurrent workers and repeated events at the milestone boundary", async () => {
    const { ledger, repository } = await create(); await fill(ledger, 1, 98);
    const other = new UsageLedger(repository, activation); await other.initialize();
    await Promise.all([ledger.record(event(99)), other.record(event(100)), ledger.record(event(100)), other.record(event(101))]);
    expect((await ledger.state())?.totals.completed).toBe(101); expect([...repository.rows.keys()].filter(key => key.startsWith("outbox/"))).toEqual([`outbox/${activation.id}-100`]);
  });
  it("uses the actual activity range when recovered events arrive out of chronological order", async () => {
    const { ledger, repository } = await create();
    for (let n = 1; n <= 100; n++) await ledger.record(event(n, { startedAt: "2026-09-04T12:00:00.000Z", finishedAt: "2026-09-04T12:05:00.000Z" }));
    for (let n = 101; n <= 200; n++) await ledger.record(event(n, { startedAt: n % 2 ? "2026-09-02T12:00:00.000Z" : "2026-09-03T12:00:00.000Z", finishedAt: n % 2 ? "2026-09-02T12:05:00.000Z" : "2026-09-03T12:05:00.000Z" }));
    const batch = milestone(repository, 200);
    expect(batch.from).toBe("2026-09-02T12:00:00.000Z"); expect(batch.to).toBe("2026-09-03T12:05:00.000Z");
    expect(batch.period.completed).toBe(100); expect(batch.cumulative.completed).toBe(200);
  });
  it("excludes fixtures, administrators, another activation and pre-activation attempts; non-completions retain usage only", async () => {
    const { ledger, repository } = await create();
    for (const patch of [{ source: "test" }, { source: "admin" }, { activationId: "another-activation" }, { startedAt: "2026-08-31T23:59:59.000Z" }] as Partial<UsageEvent>[]) expect(await ledger.record(event(1, patch))).toBe("excluded");
    let n = 10;
    for (const kind of ["failed", "partial", "reused", "preserved", "helper"] as const) await ledger.record(event(n++, { kind, trace: { models: [model({ status: "failed", inputTokens: null, outputTokens: null, cacheReadTokens: null, cacheWriteTokens: null })], browsers: [{ durationMs: 230, status: "failed" }] } }));
    expect((await ledger.state())?.totals).toMatchObject({ completed: 0, failed: 1, partial: 1, reused: 1, preserved: 1, helper: 1, browserCalls: 5, browserFailures: 5, unpricedBrowserCalls: 5 });
    expect(milestone(repository)).toBeUndefined(); expect(repository.rows.size).toBeGreaterThan(1);
    await expect(ledger.record(event(90, { assessmentId: undefined }))).rejects.toThrow("invalid_usage_event");
  });
});

describe("outbox delivery leases and retry", () => {
  it("allows one worker to send while the other sees its active lease, then does not send an acknowledged milestone again", async () => {
    const { ledger, repository } = await create(); await fill(ledger, 1, 100); const now = milestone(repository).availableAt!;
    const remote = deferred<string>(), started = deferred<void>(); const send = vi.fn(async () => { started.resolve(); return remote.promise; });
    const first = ledger.drain(send, now); await started.promise;
    const other = new UsageLedger(repository, activation); expect(await other.drain(send, now)).toBe(0); expect(send).toHaveBeenCalledTimes(1);
    remote.resolve("private-channel:fixture-ts"); expect(await first).toBe(1); expect(milestone(repository)).toMatchObject({ status: "sent", attempts: 1, remoteId: "private-channel:fixture-ts" });
    expect((await ledger.state())?.delivery).toMatchObject({ confirmed: 1, lastThreshold: 100, lastAt: expect.any(String) });
    expect(await ledger.drain(send, now + 1_000_000)).toBe(0); expect(send).toHaveBeenCalledTimes(1);
  });
  it("retains a safe retry code after transport failure and retries the same durable milestone after restart", async () => {
    const { ledger, repository } = await create(); await fill(ledger, 1, 100); const now = milestone(repository).availableAt!;
    expect(await ledger.drain(async () => { throw new Error("PRIVATE_TOKEN PRIVATE_PROVIDER_BODY"); }, now)).toBe(0);
    const failed = milestone(repository); expect(failed).toMatchObject({ status: "pending", attempts: 1, lastError: "delivery_unconfirmed" }); expect(JSON.stringify(failed)).not.toContain("PRIVATE_"); expect(failed.lease).toBeUndefined();
    const restarted = new UsageLedger(repository, activation); const send = vi.fn(async () => "fixture-confirmation");
    expect(await restarted.drain(send, failed.availableAt! - 1)).toBe(0);
    expect(await restarted.drain(send, failed.availableAt!)).toBe(1); expect(send).toHaveBeenCalledTimes(1); expect(milestone(repository).attempts).toBe(2);
  });
  it("fences an expired worker's late acknowledgment after a replacement worker claims the lease", async () => {
    const { ledger, repository } = await create(); await fill(ledger, 1, 100); const now = milestone(repository).availableAt!;
    const slow = deferred<string>(), started = deferred<void>();
    const first = ledger.drain(async () => { started.resolve(); return slow.promise; }, now); await started.promise;
    expect(await ledger.drain(async () => "new-lease-confirmation", now + 120_001)).toBe(1);
    slow.resolve("stale-lease-confirmation"); expect(await first).toBe(0);
    expect(milestone(repository)).toMatchObject({ status: "sent", remoteId: "new-lease-confirmation", attempts: 2 });
    expect((await ledger.state())?.delivery).toMatchObject({ confirmed: 1, lastThreshold: 100 });
  });
});

describe("cost labels and safe notification content", () => {
  it("prices measured tokens using configured rates while labeling missing usage and unconfigured browser cost", async () => {
    const repository = new FakeTransactionalRepository();
    const rates = parseRateCard(JSON.stringify({ version: "qa-rates-v1", source: "https://example.com/fixture-rates", verifiedAt: activation.activatedAt, models: { "anthropic:claude-sonnet-4-5": { input: 3, output: 15, cacheRead: 0.3, cacheWrite: 3.75 } } }))!;
    const ledger = new UsageLedger(repository, activation, rates); await ledger.initialize();
    await ledger.record(event(1, { trace: { models: [model(), model({ status: "failed", inputTokens: null, outputTokens: null, cacheReadTokens: null, cacheWriteTokens: null }), model({ status: "blocked", inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 })], browsers: [{ durationMs: 500, status: "failed" }] } }));
    await fill(ledger, 2, 100);
    const totals = milestone(repository).period; expect(Object.values(totals.models)[0]).toMatchObject({ calls: 3, failed: 1, blocked: 1, unpricedCalls: 1, missingUsage: 1, rateVersions: ["qa-rates-v1"] }); expect(Object.values(totals.models)[0].estimatedUsd).toBeCloseTo(0.0045);
    const message = milestoneMessage(milestone(repository));
    expect(message).toContain("estimated priced portion"); expect(message).toContain("1 calls unpriced"); expect(message).toContain("1 calls with unavailable usage"); expect(message).toContain("not invoices"); expect(message).not.toMatch(/assessment-\d|event-\d|hashed-alice/);
  });
  it("requires a configured verified destination, posts only aggregate fields, disables link unfurls and checks the returned destination", async () => {
    const { ledger, repository } = await create(); await fill(ledger, 1, 100);
    expect(slackMilestoneSender({ PG_USAGE_SLACK_BOT_TOKEN: "synthetic-token", PG_USAGE_SLACK_CHANNEL_ID: "C12345678" })).toBeUndefined();
    const fake = vi.fn(async () => new Response(JSON.stringify({ ok: true, channel: "C12345678", ts: "1.2" }), { status: 200 }));
    const send = slackMilestoneSender({ PG_USAGE_SLACK_BOT_TOKEN: "synthetic-token", PG_USAGE_SLACK_CHANNEL_ID: "C12345678", PG_USAGE_SLACK_DESTINATION_VERIFIED: "true" }, fake)!;
    expect(await send(milestone(repository))).toBe("C12345678:1.2"); expect(await send(milestone(repository))).toBe("C12345678:1.2");
    const one = JSON.parse((fake.mock.calls[0] as any)[1].body), two = JSON.parse((fake.mock.calls[1] as any)[1].body);
    expect(one.client_msg_id).toBe(two.client_msg_id); expect(one).toMatchObject({ channel: "C12345678", mrkdwn: false, unfurl_links: false, unfurl_media: false }); expect(one.text).not.toContain("synthetic-token");
    fake.mockImplementationOnce(async () => new Response(JSON.stringify({ ok: true, channel: "COTHER000", ts: "1.2" }), { status: 200 }));
    await expect(send(milestone(repository))).rejects.toThrow("delivery_unconfirmed");
  });
  it("keeps concurrent request traces independent and normalizes invalid usage to unknown", async () => {
    const a = emptyTrace(), b = emptyTrace(), aReady = deferred<void>(), finish = deferred<void>();
    await Promise.all([
      withUsageTracking(a, async () => { recordModelUsage(model()); aReady.resolve(); await finish.promise; recordBrowserUsage({ durationMs: 123, status: "succeeded" }); }),
      withUsageTracking(b, async () => { await aReady.promise; recordModelUsage(model({ status: "failed", inputTokens: null })); finish.resolve(); }),
    ]);
    expect(a.models).toHaveLength(1); expect(a.models[0].status).toBe("succeeded"); expect(a.browsers).toHaveLength(1); expect(b.models[0].status).toBe("failed"); expect(b.browsers).toHaveLength(0);
    for (const input of [-1, 2.5, NaN, Infinity, undefined, "10", Number.MAX_SAFE_INTEGER + 1]) expect(measuredTokens(input)).toBeNull();
    expect(measuredTokens(0)).toBe(0); expect(measuredTokens(10)).toBe(10);
  });
});
