import { withStore } from "./withStore.js";
import { randomUUID } from "node:crypto";
import { db } from "./firebaseAdmin.js";
import { isAdminUid } from "./billingConfig.js";
import { resolveRuntime } from "./runtimeContext.js";
import { secureStore, type StoreDocument } from "./secureStore.js";
import { RELEASE_VERSION } from "../../shared/release.js";
import { firestoreUsageRepository } from "./usageFirestore.js";
import { UsageLedger, parseRateCard, usageKey, validateActivation, type Activation, type UsageEvent, type UsageKind } from "./usageLedger.js";
import { emptyTrace, type UsageTrace } from "./usageTracking.js";
import { slackMilestoneSender } from "./usageNotifications.js";

interface PendingAttempt { processId: string; event: UsageEvent; status: "running" | "ready"; }
export interface TrackedAttempt { id: string; trace: UsageTrace; }
const processId = randomUUID();
let ledger: UsageLedger | undefined;
let initialization: Promise<void> | undefined;
let flushing = false;
let lastFlushAt: string | undefined;
let lastError: string | undefined;
/** Explicit production activation only. Local/bootstrap, preview, test and admin work are excluded. */
export function productionUsageActivation(env: NodeJS.ProcessEnv = process.env): Activation | undefined {
  if (env.PG_USAGE_ENABLED !== "true" || env.PG_DEPLOYMENT_ENV !== "production" || env.NODE_ENV !== "production" || resolveRuntime(env).mode === "local") return undefined;
  const activation: Activation = { id: env.PG_USAGE_ACTIVATION_ID ?? "", activatedAt: env.PG_USAGE_ACTIVATED_AT ?? "", baseline: 0 };
  validateActivation(activation);
  if (Date.parse(activation.activatedAt) > Date.now()) throw new Error("usage_activation_in_future");
  return activation;
}
async function readyLedger(): Promise<UsageLedger | undefined> {
  const activation = productionUsageActivation();
  if (!activation) return undefined;
  if (!ledger) {
    const database = db();
    if (!database) throw new Error("usage_database_unavailable");
    ledger = new UsageLedger(firestoreUsageRepository(database, activation.id), activation, parseRateCard(process.env.PG_USAGE_RATES_JSON));
  }
  initialization ??= ledger.initialize().catch(error => { initialization = undefined; throw error; });
  await initialization;
  return ledger;
}
export async function beginUsageAttempt(uid: string | undefined, method: string, verifiedGoogle = true): Promise<TrackedAttempt | undefined> {
  if (uid && isAdminUid(uid)) return undefined;
  const active = await readyLedger();
  if (!active) return undefined;
  const id = randomUUID();
  const trace = emptyTrace();
  const at = new Date().toISOString();
  secureStore.update(state => {
    state.usageAttempts ??= {};
    if (Object.keys(state.usageAttempts).length >= 100) throw new Error("usage_handoff_backlog");
    state.usageAttempts[id] = { processId, status: "running", event: { id, activationId: active.activation.id, startedAt: at, finishedAt: at, source: "production", kind: "failed", release: RELEASE_VERSION, method,
      ...(uid && verifiedGoogle ? { accountKey: usageKey(`${active.activation.id}:${uid}`) } : {}), trace } } satisfies PendingAttempt;
  });
  return { id, trace };
}
export function checkpointUsageAttempt(attempt: TrackedAttempt | undefined, trace: UsageTrace): void {
  if (!attempt) return;
  secureStore.update(state => {
    const row = state.usageAttempts?.[attempt.id] as PendingAttempt | undefined;
    if (!row || row.status !== "running") throw new Error("usage_attempt_missing");
    row.event.trace = trace;
  });
}
/** Invoke inside the SAME local commit as the accepted report and history. */
export function finishUsageInDocument(state: StoreDocument, attempt: TrackedAttempt | undefined, kind: UsageKind, assessmentId?: string): void {
  if (!attempt) return;
  const row = state.usageAttempts?.[attempt.id] as PendingAttempt | undefined;
  if (!row || row.status !== "running") throw new Error("usage_attempt_missing");
  row.status = "ready";
  row.event.kind = kind; row.event.finishedAt = new Date().toISOString(); row.event.trace = structuredClone(attempt.trace);
  if (assessmentId) row.event.assessmentId = assessmentId;
}
export function finishUsageAttempt(attempt: TrackedAttempt | undefined, kind: UsageKind, assessmentId?: string): void {
  if (!attempt) return;
  secureStore.update(state => finishUsageInDocument(state, attempt, kind, assessmentId));
}
/** Durable single-writer handoff into distributed Firestore. Recovery runs on the Node host, never this chat. */
export async function flushUsage(): Promise<void> {
  if (flushing) return;
  flushing = true;
  try {
    const active = await readyLedger();
    if (!active) return;
    const pending = Object.entries(secureStore.read().usageAttempts ?? {}) as [string, PendingAttempt][];
    for (const [id, row] of pending.sort((a,b) => a[1].event.startedAt.localeCompare(b[1].event.startedAt)).slice(0, 50)) {
      if (row.status === "running") {
        if (row.processId === processId) continue;
        // Interrupted work is a failure, with all provider responses checkpointed before the interruption.
        secureStore.update(state => { const old = state.usageAttempts?.[id] as PendingAttempt | undefined; if (old) { old.status = "ready"; old.event.kind = "failed"; old.event.finishedAt = new Date().toISOString(); } });
      }
      const current = secureStore.read().usageAttempts?.[id] as PendingAttempt | undefined;
      if (!current) continue;
      if (current.event.activationId !== active.activation.id) throw new Error("usage_activation_backlog_mismatch");
      await active.record(current.event);
      secureStore.update(state => { delete state.usageAttempts?.[id]; });
    }
    const sender = slackMilestoneSender();
    if (sender) await active.drain(sender);
    lastFlushAt = new Date().toISOString(); lastError = undefined;
  } catch (error) { lastError = error instanceof Error && /^[a-z_]+$/.test(error.message) ? error.message : "usage_sync_unavailable"; console.warn("[usage] sync unavailable; durable queue retained"); }
  finally { flushing = false; }
}
export function startUsageWorker(): () => void {
  if (!productionUsageActivation()) return () => {};
  void flushUsage();
  const timer = setInterval(() => { void flushUsage(); }, 30_000); timer.unref();
  return () => clearInterval(timer);
}
export async function usageStatus() {
  const activation = productionUsageActivation();
  const active = await readyLedger();
  return { enabled: Boolean(activation), activation: activation ?? null, transportConfigured: Boolean(slackMilestoneSender()),
    pendingHandoffs: await withStore(() => Object.keys(secureStore.read().usageAttempts ?? {}).length), lastFlushAt: lastFlushAt ?? null, lastError: lastError ?? null,
    state: active ? await active.state() : null,
    boundary: "Local preview report storage needs one writer and a persistent volume. Firestore metering uses transactions; delivery is unverified until a transport smoke test and deployment." };
}
