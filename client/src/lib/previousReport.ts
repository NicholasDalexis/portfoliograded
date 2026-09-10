import type { SavedReportSummary } from "@shared/reportHistory";
import { rubricForRole } from "@shared/rubrics";

function comparableUrl(value: string): string | null {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    url.hash = "";
    return url.href;
  } catch { return null; }
}

function comparableRole(value: string): string {
  return rubricForRole(value)?.key ?? value.trim().toLowerCase();
}

/** Input must come from the current owner's report-list endpoint. This is
 * display selection only, never authorization or an unchanged-site claim. */
export function selectPreviousReport(reports: SavedReportSummary[], url: string, role: string, before: number): SavedReportSummary | null {
  const target = comparableUrl(url);
  if (!target || !Array.isArray(reports)) return null;
  return reports.filter(report => comparableUrl(report.url) === target
    && comparableRole(report.role) === comparableRole(role)
    && Number.isFinite(Date.parse(report.createdAt))
    && Date.parse(report.createdAt) < before)
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))[0] ?? null;
}
