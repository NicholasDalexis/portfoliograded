import { createHash } from "node:crypto";
import { secureStore, type SecureStore } from "./secureStore.js";
export function positiveLimit(value: string | undefined, fallback: number): number { const parsed = Number(value); return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback; }
/** Rejected per-owner/IP attempts never spend the global budget. */
export function takeBudget(params: { scope: string; ownerId: string; ip: string; ownerLimit: number; ipLimit: number; globalLimit: number; now?: number }, store: SecureStore = secureStore): { ok: boolean; left: number; reason?: "quota" | "global_budget" } {
  const now = params.now ?? Date.now(), day = 86400_000;
  const hash = (value: string) => createHash("sha256").update(value).digest("hex");
  const keys = [`${params.scope}:global`, `${params.scope}:owner:${hash(params.ownerId)}`, `${params.scope}:ip:${hash(params.ip)}`];
  const limits = [params.globalLimit, params.ownerLimit, params.ipLimit];
  const current = keys.map((key) => { const previous = store.read().quotas[key]; return previous && now - previous.start < day ? previous : { start: now, count: 0 }; });
  if (current[1].count >= limits[1] || current[2].count >= limits[2]) return { ok: false, left: 0, reason: "quota" };
  if (current[0].count >= limits[0]) return { ok: false, left: 0, reason: "global_budget" };
  return store.update((state) => {
    for (const [key, value] of Object.entries(state.quotas)) if (now - value.start >= day) delete state.quotas[key];
    keys.forEach((key, i) => { state.quotas[key] = { ...current[i], count: current[i].count + 1 }; });
    return { ok: true, left: Math.min(limits[1] - current[1].count - 1, limits[2] - current[2].count - 1) };
  });
}
