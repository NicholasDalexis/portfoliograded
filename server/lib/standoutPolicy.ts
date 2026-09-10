import type { AuditReport, CategoryKey, ReportStandouts } from "../../shared/audit.js";

// These categories contain evaluated HTML criteria. Layout, speed and visual craft
// require a future broader evidence method and can never win by an HTML estimate.
const ASSESSED_HTML_KEYS: CategoryKey[] = ["first_impression", "narrative", "case_studies", "accessibility", "seo_discoverability", "conversion"];
export function selectStandouts(report: AuditReport): ReportStandouts {
  const empty: ReportStandouts = { version: "relative-v1", status: "unavailable", items: [] };
  if (!report.acceptedEvidence || report.verification?.mode !== "homepage-html" || !report.verification.pages.length ||
      report.verification.pages.some(page => page.status < 200 || page.status >= 300)) return empty;
  const candidate = report.categories.filter(category => ASSESSED_HTML_KEYS.includes(category.key) &&
    Number.isFinite(category.score) && category.details.some(detail => detail.status === "pass" && detail.note.trim()))
    .sort((a, b) => b.score - a.score || a.details.filter(d => d.status !== "pass").length - b.details.filter(d => d.status !== "pass").length ||
      ASSESSED_HTML_KEYS.indexOf(a.key) - ASSESSED_HTML_KEYS.indexOf(b.key))[0];
  if (!candidate) return empty;
  const remainingIssues = candidate.details.some(detail => detail.status !== "pass") || Boolean(candidate.recommendation.trim());
  return { version: "relative-v1", status: "available", items: [{ categoryKey: candidate.key, title: candidate.title,
    score: candidate.score, grade: candidate.grade, evidenceScope: "homepage-html", remainingIssues,
    explanation: `This is your strongest assessed category within the homepage HTML checks, at ${candidate.score}/100. It is a relative standout in this portfolio, not a visual or whole-portfolio judgment. ${remainingIssues ? "Its improvement notes remain in your report." : "No improvement was recorded for these specific checks; unreviewed work remains unknown."}` }] };
}
