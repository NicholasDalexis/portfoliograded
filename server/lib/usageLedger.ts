import { createHash, randomUUID } from "node:crypto";
import type { UsageTrace } from "./usageTracking.js";

export type UsageKind = "completed" | "partial" | "reused" | "preserved" | "failed" | "helper";
export interface UsageEvent {
  id: string; activationId: string; startedAt: string; finishedAt: string;
  source: "production" | "test" | "admin"; kind: UsageKind; assessmentId?: string;
  accountKey?: string; release: string; method: string; trace: UsageTrace;
}
export interface ModelTotals {
  provider: string; model: string; calls: number; failed: number; blocked: number;
  input: number; output: number; cacheRead: number; cacheWrite: number; missingUsage: number;
  estimatedUsd: number; unpricedCalls: number; rateVersions: string[];
}
export interface UsageTotals {
  completed: number; accountReviews: number; anonymousReviews: number; uniqueAccounts: number;
  partial: number; reused: number; preserved: number; failed: number; helper: number;
  browserCalls: number; browserFailures: number; browserMs: number; browserEstimatedUsd: number; unpricedBrowserCalls: number;
  models: Record<string, ModelTotals>; releases: Record<string, number>; methods: Record<string, number>;
}
export interface Activation { id: string; activatedAt: string; baseline: 0; }
export interface UsageState { activation: Activation; totals: UsageTotals; period: UsageTotals; periodStartedAt: string; periodFirstEventAt?: string; periodLastEventAt?: string; delivery?: { confirmed: number; lastThreshold: number; lastAt: string }; }
export interface UsageMilestone {
  id: string; threshold: number; from: string; to: string; cumulative: UsageTotals; period: UsageTotals;
  month: string; monthToDate: UsageTotals; status: "pending" | "sent";
  availableAt?: number; attempts: number; lease?: string; sentAt?: string; remoteId?: string; lastError?: string;
}
export interface UsageTransaction {
  get<T>(key: string): Promise<T | undefined>;
  set<T>(key: string, value: T): void;
}
export interface UsageRepository {
  transaction<T>(work: (transaction: UsageTransaction) => Promise<T>): Promise<T>;
  due(now: number, limit: number): Promise<string[]>;
}
export interface RateCard {
  version: string; source: string; verifiedAt: string;
  models: Record<string, { input: number; output: number; cacheRead: number; cacheWrite: number }>;
  browserUsdPerHour?: number;
}
export const usageKey = (value: string): string => createHash("sha256").update(value).digest("hex");
export function zeroTotals(): UsageTotals {
  return { completed: 0, accountReviews: 0, anonymousReviews: 0, uniqueAccounts: 0, partial: 0, reused: 0, preserved: 0, failed: 0, helper: 0,
    browserCalls: 0, browserFailures: 0, browserMs: 0, browserEstimatedUsd: 0, unpricedBrowserCalls: 0, models: {}, releases: {}, methods: {} };
}
function tally(t: UsageTotals, event: UsageEvent, countCompletion: boolean, uniqueAccount: boolean, rates?: RateCard): void {
  if (event.kind === "completed") {
    if (countCompletion) { t.completed++; event.accountKey ? t.accountReviews++ : t.anonymousReviews++; if (uniqueAccount) t.uniqueAccounts++; }
  } else t[event.kind]++;
  // Version labels are bounded identifiers and are hashed as Firestore map keys.
  t.releases[event.release] = (t.releases[event.release] ?? 0) + 1;
  t.methods[event.method] = (t.methods[event.method] ?? 0) + 1;
  for (const call of event.trace.models) {
    const key = usageKey(`${call.provider}:${call.model}`);
    const m = t.models[key] ??= { provider: call.provider, model: call.model, calls: 0, failed: 0, blocked: 0, input: 0, output: 0, cacheRead: 0, cacheWrite: 0, missingUsage: 0, estimatedUsd: 0, unpricedCalls: 0, rateVersions: [] };
    m.calls++; if (call.status === "failed") m.failed++; if (call.status === "blocked") m.blocked++;
    m.input += call.inputTokens ?? 0; m.output += call.outputTokens ?? 0;
    m.cacheRead += call.cacheReadTokens ?? 0; m.cacheWrite += call.cacheWriteTokens ?? 0;
    const known = [call.inputTokens, call.outputTokens, call.cacheReadTokens, call.cacheWriteTokens].every(n => n !== null);
    if (!known && call.status !== "blocked") m.missingUsage++;
    const rate = rates?.models[`${call.provider}:${call.model}`];
    if (call.status !== "blocked") {
      if (rate && known) {
        m.estimatedUsd += (call.inputTokens! * rate.input + call.outputTokens! * rate.output + call.cacheReadTokens! * rate.cacheRead + call.cacheWriteTokens! * rate.cacheWrite) / 1_000_000;
        if (!m.rateVersions.includes(rates!.version)) m.rateVersions.push(rates!.version);
      } else m.unpricedCalls++;
    }
  }
  for (const call of event.trace.browsers) {
    t.browserCalls++; t.browserMs += call.durationMs; if (call.status === "failed") t.browserFailures++;
    if (rates?.browserUsdPerHour !== undefined) t.browserEstimatedUsd += call.durationMs / 3_600_000 * rates.browserUsdPerHour;
    else t.unpricedBrowserCalls++;
  }
}
export function validateActivation(activation: Activation): void {
  if (!/^[a-zA-Z0-9_-]{8,80}$/.test(activation.id) || !Number.isFinite(Date.parse(activation.activatedAt)) || activation.baseline !== 0) throw new Error("invalid_usage_activation");
}
export function parseRateCard(raw?: string): RateCard | undefined {
  if (!raw) return undefined;
  const card = JSON.parse(raw) as RateCard;
  if (!card.version || card.version.length > 80 || !/^https:\/\//.test(card.source) || !Number.isFinite(Date.parse(card.verifiedAt)) || !card.models || Object.keys(card.models).length > 12) throw new Error("invalid_usage_rates");
  for (const [key, rate] of Object.entries(card.models)) {
    if (!/^anthropic:claude-(sonnet|haiku)-[a-zA-Z0-9.-]+$/.test(key) || Object.values(rate).some(n => typeof n !== "number" || !Number.isFinite(n) || n < 0) || [rate.input, rate.output, rate.cacheRead, rate.cacheWrite].some(n => n === undefined)) throw new Error("invalid_usage_rates");
  }
  if (card.browserUsdPerHour !== undefined && (!Number.isFinite(card.browserUsdPerHour) || card.browserUsdPerHour < 0)) throw new Error("invalid_browser_rate");
  return card;
}
/** Transactional deduplication, aggregation and outbox creation. No network send inside a transaction. */
export class UsageLedger {
  constructor(readonly repository: UsageRepository, readonly activation: Activation, private rates?: RateCard) { validateActivation(activation); }
  async initialize(): Promise<void> {
    await this.repository.transaction(async tx => {
      const state = await tx.get<UsageState>("state/active");
      if (state) {
        if (state.activation.id !== this.activation.id || state.activation.activatedAt !== this.activation.activatedAt || state.activation.baseline !== this.activation.baseline) throw new Error("usage_activation_mismatch");
      } else tx.set<UsageState>("state/active", { activation: this.activation, totals: zeroTotals(), period: zeroTotals(), periodStartedAt: this.activation.activatedAt });
    });
  }
  async record(event: UsageEvent): Promise<"recorded" | "duplicate" | "excluded"> {
    if (event.source !== "production" || event.activationId !== this.activation.id || Date.parse(event.startedAt) < Date.parse(this.activation.activatedAt)) return "excluded";
    if (!Number.isFinite(Date.parse(event.startedAt)) || !Number.isFinite(Date.parse(event.finishedAt)) || Date.parse(event.finishedAt) < Date.parse(event.startedAt) || (event.kind === "completed" && !event.assessmentId)) throw new Error("invalid_usage_event");
    const eventKey = `events/${usageKey(event.id)}`;
    return this.repository.transaction(async tx => {
      const [prior, state] = await Promise.all([tx.get(eventKey), tx.get<UsageState>("state/active")]);
      if (prior) return "duplicate";
      if (!state || state.activation.id !== event.activationId) throw new Error("usage_not_activated");
      const month = event.finishedAt.slice(0, 7);
      const assessmentKey = event.assessmentId ? `assessments/${usageKey(event.assessmentId)}` : null;
      const periodNumber = Math.floor(state.totals.completed / 100);
      const accountKeys = event.kind === "completed" && event.accountKey ? [
        `accounts/${usageKey(`all:${event.accountKey}`)}`,
        `accounts/${usageKey(`period:${periodNumber}:${event.accountKey}`)}`,
        `accounts/${usageKey(`month:${month}:${event.accountKey}`)}`,
      ] : [];
      // All reads precede all writes, including on transaction retries.
      const [oldAssessment, monthPrior, ...accounts] = await Promise.all([
        assessmentKey ? tx.get(assessmentKey) : Promise.resolve(undefined),
        tx.get<UsageTotals>(`months/${month}`), ...accountKeys.map(key => tx.get(key)),
      ]);
      const completed = event.kind === "completed" && !oldAssessment;
      const monthly = monthPrior ?? zeroTotals();
      state.periodFirstEventAt = state.periodFirstEventAt && state.periodFirstEventAt < event.startedAt ? state.periodFirstEventAt : event.startedAt;
      state.periodLastEventAt = state.periodLastEventAt && state.periodLastEventAt > event.finishedAt ? state.periodLastEventAt : event.finishedAt;
      tally(state.totals, event, completed, accountKeys.length > 0 && !accounts[0], this.rates);
      tally(state.period, event, completed, accountKeys.length > 0 && !accounts[1], this.rates);
      tally(monthly, event, completed, accountKeys.length > 0 && !accounts[2], this.rates);
      tx.set(eventKey, event);
      if (completed) {
        tx.set(assessmentKey!, { at: event.finishedAt });
        for (const key of accountKeys) tx.set(key, { at: event.finishedAt });
      }
      if (completed && state.totals.completed % 100 === 0) {
        const id = `${this.activation.id}-${state.totals.completed}`;
        tx.set<UsageMilestone>(`outbox/${id}`, { id, threshold: state.totals.completed, from: state.periodFirstEventAt, to: state.periodLastEventAt,
          cumulative: structuredClone(state.totals), period: structuredClone(state.period), month, monthToDate: structuredClone(monthly), status: "pending", availableAt: Date.now(), attempts: 0 });
        state.period = zeroTotals(); state.periodStartedAt = event.finishedAt;
        delete state.periodFirstEventAt; delete state.periodLastEventAt;
      }
      tx.set("state/active", state); tx.set(`months/${month}`, monthly);
      return "recorded";
    });
  }
  async state(): Promise<UsageState | undefined> { return this.repository.transaction(tx => tx.get<UsageState>("state/active")); }
  async drain(send: (milestone: UsageMilestone) => Promise<string>, now = Date.now()): Promise<number> {
    const keys = await this.repository.due(now, 10);
    let sent = 0;
    for (const key of keys) {
      const lease = randomUUID();
      const item = await this.repository.transaction(async tx => {
        const row = await tx.get<UsageMilestone>(key);
        if (!row || row.status !== "pending" || (row.availableAt ?? Infinity) > now) return null;
        row.lease = lease; row.availableAt = now + 120_000; row.attempts++;
        tx.set(key, row); return row;
      });
      if (!item) continue;
      let remoteId: string | undefined;
      try { remoteId = await send(item); } catch { /* The queue retains a safe error code, never a token or response body. */ }
      const committed = await this.repository.transaction(async tx => {
        const [row, state] = await Promise.all([tx.get<UsageMilestone>(key), tx.get<UsageState>("state/active")]);
        if (!row || row.status !== "pending" || row.lease !== lease) return false;
        delete row.lease;
        if (remoteId) {
          row.status = "sent"; row.remoteId = remoteId; row.sentAt = new Date().toISOString(); delete row.availableAt; delete row.lastError;
          if (state) { state.delivery = { confirmed: (state.delivery?.confirmed ?? 0) + 1, lastThreshold: Math.max(state.delivery?.lastThreshold ?? 0, row.threshold), lastAt: row.sentAt }; tx.set("state/active", state); }
        } else {
          row.lastError = "delivery_unconfirmed"; row.availableAt = now + Math.min(3_600_000, 30_000 * 2 ** Math.min(row.attempts, 7));
        }
        tx.set(key, row);
        return Boolean(remoteId);
      });
      if (committed) sent++;
    }
    return sent;
  }
}
