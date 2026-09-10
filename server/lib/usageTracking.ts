import { AsyncLocalStorage } from "node:async_hooks";

export interface ModelUsage {
  provider: "anthropic";
  model: string;
  stage: "review" | "helper";
  status: "succeeded" | "failed" | "blocked";
  inputTokens: number | null;
  outputTokens: number | null;
  cacheReadTokens: number | null;
  cacheWriteTokens: number | null;
  durationMs: number;
}
export interface BrowserUsage { durationMs: number; status: "succeeded" | "failed"; }
export interface UsageTrace { models: ModelUsage[]; browsers: BrowserUsage[]; }
interface Context { trace: UsageTrace; checkpoint?: (trace: UsageTrace) => void; }
const context = new AsyncLocalStorage<Context>();
export function emptyTrace(): UsageTrace { return { models: [], browsers: [] }; }
/** Request-local usage only. Never collect prompts, URLs, output text or credentials. */
export function withUsageTracking<T>(trace: UsageTrace, work: () => Promise<T>, checkpoint?: Context["checkpoint"]): Promise<T> {
  return context.run({ trace, checkpoint }, work);
}
export function recordModelUsage(usage: ModelUsage): void {
  const current = context.getStore();
  if (!current) return;
  current.trace.models.push(usage);
  current.checkpoint?.(structuredClone(current.trace));
}
export function recordBrowserUsage(usage: BrowserUsage): void {
  const current = context.getStore();
  if (!current) return;
  current.trace.browsers.push(usage);
  current.checkpoint?.(structuredClone(current.trace));
}
export function measuredTokens(value: unknown): number | null {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : null;
}
