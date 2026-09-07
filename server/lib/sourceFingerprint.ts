import type { HomepageSourceSnapshot } from "../../shared/reportHistory.js";

type SourcePage = { finalUrl: string; html: string; sourceSha256: string };
export function fingerprintSource(desktop: SourcePage, mobile: SourcePage): HomepageSourceSnapshot {
  const page = (value: SourcePage) => ({ finalUrl: value.finalUrl, sha256: value.sourceSha256 });
  return { version: 1, capturedAt: new Date().toISOString(), desktop: page(desktop), mobile: page(mobile) };
}
export function sameHomepageSource(before: HomepageSourceSnapshot, after: HomepageSourceSnapshot): boolean {
  return before.version === 1 && after.version === 1 && (["desktop", "mobile"] as const).every(device => before[device].finalUrl === after[device].finalUrl && before[device].sha256 === after[device].sha256);
}
