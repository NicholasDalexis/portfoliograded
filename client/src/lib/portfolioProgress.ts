import type { SavedReportSummary } from "@shared/reportHistory";

export interface ProgressTarget {
  key: string;
  url: string;
  role: string;
  latestAt: string;
}
export interface ProgressPoint {
  id: string;
  at: string;
  score: number;
  grade: string;
}
export interface ProgressSeries {
  methodVersion: string;
  points: ProgressPoint[];
}
const roleKey = (value: string) => value.trim().toLowerCase();
export function progressUrl(raw: string): string | null {
  try {
    const url = new URL(raw);
    if (!["https:", "http:"].includes(url.protocol)) return null;
    url.hash = "";
    return url.toString();
  } catch {
    return null;
  }
}
const validDate = (value: unknown): value is string =>
  typeof value === "string" && Number.isFinite(Date.parse(value));

/** Recent summaries discover portfolios only. Their scores never substitute for full history. */
export function progressTargets(
  reports: SavedReportSummary[]
): ProgressTarget[] {
  const targets = new Map<string, ProgressTarget>();
  for (const report of reports) {
    if (!report || typeof report !== "object") continue;
    const url = typeof report.url === "string" ? progressUrl(report.url) : null;
    if (
      !url ||
      typeof report.role !== "string" ||
      !roleKey(report.role) ||
      !validDate(report.createdAt)
    )
      continue;
    const key = JSON.stringify([url, roleKey(report.role)]);
    const prior = targets.get(key);
    if (!prior || Date.parse(report.createdAt) > Date.parse(prior.latestAt))
      targets.set(key, {
        key,
        url,
        role: report.role.trim(),
        latestAt: report.createdAt,
      });
  }
  return [...targets.values()].sort(
    (a, b) =>
      Date.parse(b.latestAt) - Date.parse(a.latestAt) ||
      a.key.localeCompare(b.key)
  );
}

/** Keep exact-page, same-role, versioned accepted runs. Never clamp declines or mix methods. */
export function progressSeries(
  history: unknown,
  target: ProgressTarget
): ProgressSeries[] {
  if (!history || typeof history !== "object") return [];
  const value = history as { url?: unknown; role?: unknown; runs?: unknown };
  if (
    typeof value.url !== "string" ||
    progressUrl(value.url) !== target.url ||
    typeof value.role !== "string" ||
    roleKey(value.role) !== roleKey(target.role) ||
    !Array.isArray(value.runs)
  )
    return [];
  const methods = new Map<string, ProgressPoint[]>(),
    seen = new Set<string>();
  for (const run of value.runs) {
    if (
      !run ||
      typeof run !== "object" ||
      typeof run.id !== "string" ||
      !/^[A-Za-z0-9_-]{24}$/.test(run.id) ||
      seen.has(run.id) ||
      typeof run.role !== "string" ||
      roleKey(run.role) !== roleKey(target.role) ||
      run.accepted === false ||
      run.evidenceStatus === "partial" ||
      typeof run.methodVersion !== "string" ||
      !run.methodVersion.trim() ||
      run.methodVersion === "legacy-homepage-html-rubric-unknown" ||
      !validDate(run.at) ||
      typeof run.overall !== "number" ||
      !Number.isFinite(run.overall) ||
      run.overall < 0 ||
      run.overall > 100 ||
      typeof run.overallGrade !== "string" ||
      !/^(S|A\+?|A-|B\+?|B-|C\+?|C-|D)$/.test(run.overallGrade)
    )
      continue;
    seen.add(run.id);
    const points = methods.get(run.methodVersion) ?? [];
    points.push({
      id: run.id,
      at: run.at,
      score: run.overall,
      grade: run.overallGrade,
    });
    methods.set(run.methodVersion, points);
  }
  return [...methods]
    .map(([methodVersion, points]) => ({
      methodVersion,
      points: points.sort(
        (a, b) =>
          Date.parse(a.at) - Date.parse(b.at) || a.id.localeCompare(b.id)
      ),
    }))
    .sort(
      (a, b) =>
        Date.parse(b.points.at(-1)!.at) - Date.parse(a.points.at(-1)!.at) ||
        a.methodVersion.localeCompare(b.methodVersion)
    );
}

export function progressMethodLabel(method: string, index: number): string {
  const current = /^homepage-bounded-evidence-v(\d+)$/.exec(method);
  if (current) return `Homepage review v${current[1]}`;
  const legacy = /^legacy-homepage-html-rubric-(\d+)$/.exec(method);
  return legacy
    ? `Earlier homepage review ${legacy[1]}`
    : `Review method ${index + 1}`;
}

/** Reserve first/latest labels; omit intermediate labels that would crowd at phone width. */
export function progressLabelIndexes(points: ProgressPoint[]): number[] {
  if (!points.length) return [];
  if (points.length === 1) return [0];
  const labels = [0, points.length - 1];
  if (points.length > 6) return labels;
  const first = Date.parse(points[0].at),
    span = Date.parse(points.at(-1)!.at) - first;
  const x = (index: number) =>
    5 +
    90 *
      (span
        ? (Date.parse(points[index].at) - first) / span
        : index / (points.length - 1));
  for (let index = 1; index < points.length - 1; index++) {
    if (labels.every(other => Math.abs(x(index) - x(other)) >= 18 - 0.001))
      labels.push(index);
  }
  return labels.sort((a, b) => a - b);
}
