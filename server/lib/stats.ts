/*
 * Rolling audit-duration stats — powers the honest "audits are averaging
 * Xs right now" line on the scanning screen. Persisted to data/stats.json.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
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
  load();
  return { count: stats.count, avgMs: stats.count ? Math.round(stats.totalMs / stats.count) : null };
}
