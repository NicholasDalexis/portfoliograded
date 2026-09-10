import { currentStoreScope } from "./storeContext.js";
/*
 * Rolling audit-duration stats — powers the honest "audits are averaging
 * Xs right now" line on the scanning screen. Persisted to data/stats.json.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DATA_DIR = process.env.PG_DATA_DIR || path.resolve(process.cwd(), "data");
const FILE = path.join(DATA_DIR, "stats.json");

let stats = { count: 0, totalMs: 0 };
let loaded = false;

function load() {
  if (loaded) return;
  loaded = true;
  try {
    if (existsSync(FILE)) stats = JSON.parse(readFileSync(FILE, "utf8"));
  } catch {
    stats = { count: 0, totalMs: 0 };
  }
}

export function recordAuditDuration(ms: number) {
  const scope = currentStoreScope();
  if (scope) {
    if (!scope.writable) throw new Error("read_only_storage_operation");
    const current = scope.document.stats ?? { count: 0, totalMs: 0 };
    scope.document.stats = { count: current.count + 1, totalMs: current.totalMs + ms };
    scope.changed = true; return;
  }
  load();
  stats.count += 1;
  stats.totalMs += ms;
  try {
    if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
    writeFileSync(FILE, JSON.stringify(stats), "utf8");
  } catch {
    /* stats must never break audits */
  }
}

export function getAuditStats(): { count: number; avgMs: number | null } {
  const scope = currentStoreScope();
  if (scope) {
    const current = scope.document.stats ?? { count: 0, totalMs: 0 };
    return { count: current.count, avgMs: current.count ? Math.round(current.totalMs / current.count) : null };
  }
  load();
  return { count: stats.count, avgMs: stats.count ? Math.round(stats.totalMs / stats.count) : null };
}
